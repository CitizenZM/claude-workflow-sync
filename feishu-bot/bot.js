require('dotenv').config();
const lark = require('@larksuiteoapi/node-sdk');
const OpenAI = require('openai');
const cron = require('node-cron');
const https = require('https');
const fs = require('fs');
const path = require('path');
const conv = require('./conversation');
const vault = require('./vault');
const { spawn } = require('child_process');

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!APP_ID || !APP_SECRET || !OPENAI_API_KEY) { console.error('Missing env vars'); process.exit(1); }

const client = new lark.Client({ appId: APP_ID, appSecret: APP_SECRET });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ── Persistent store ──────────────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, 'ops_data.json');
function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { tasks: [], bitables: [], chats: {}, barronOpenId: null, monitorGroups: [] }; }
}
function saveData(d) { fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2)); }

// ── Tenant token (cached) ─────────────────────────────────────────────────────
let _tok = '', _tokExp = 0;
async function getTenantToken() {
  if (_tok && Date.now() < _tokExp) return _tok;
  const body = JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET });
  const res = await new Promise((res, rej) => {
    const r = https.request({ hostname:'open.feishu.cn', path:'/open-apis/auth/v3/tenant_access_token/internal',
      method:'POST', headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)} },
      resp => { let d=''; resp.on('data',c=>d+=c); resp.on('end',()=>res(JSON.parse(d))); });
    r.on('error', rej); r.write(body); r.end();
  });
  _tok = res.tenant_access_token || '';
  _tokExp = Date.now() + (res.expire - 60) * 1000;
  return _tok;
}

// ── Raw Feishu API call ───────────────────────────────────────────────────────
async function feishuApi(method, apiPath, body, token) {
  const tok = token || await getTenantToken();
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { hostname:'open.feishu.cn', path:`/open-apis${apiPath}`, method,
      headers:{ Authorization:`Bearer ${tok}`, 'Content-Type':'application/json',
        ...(bodyStr ? {'Content-Length': Buffer.byteLength(bodyStr)} : {}) } };
    const req = https.request(opts, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve(JSON.parse(d));}catch(e){reject(e);} });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Send message ──────────────────────────────────────────────────────────────
async function send(receiveId, type, text) {
  await client.im.message.create({
    params: { receive_id_type: type },
    data: { receive_id: receiveId, content: JSON.stringify({ text }), msg_type: 'text' }
  });
}

async function sendToChat(chatId, text) { await send(chatId, 'chat_id', text); }
async function sendToDM(openId, text) { await send(openId, 'open_id', text); }

// ── GPT helpers ───────────────────────────────────────────────────────────────
async function gptAnalyze(systemPrompt, userContent) {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o', max_tokens: 1500,
    messages: [{ role:'system', content:systemPrompt }, { role:'user', content:userContent }]
  });
  return res.choices[0].message.content;
}

async function gptMini(prompt) {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini', max_tokens: 400,
    messages: [{ role:'user', content:prompt }]
  });
  return res.choices[0].message.content;
}

// ── Bitable reader ────────────────────────────────────────────────────────────
async function readBitableTasks(appToken, tableId) {
  const tok = await getTenantToken();
  const res = await feishuApi('GET', `/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=100`, null, tok);
  if (res.code !== 0) return { error: res.msg, tasks: [] };
  return {
    tasks: (res.data?.items || []).map(r => {
      const f = r.fields || {};
      const ownerRaw = f['Owner（Owner&执行人）'] || f['Owner'] || f['负责人'] || f['执行人'] || '';
      const owner = Array.isArray(ownerRaw)
        ? ownerRaw.map(u => typeof u==='object' ? u.name||u.en_name||'' : String(u)).filter(Boolean).join(', ')
        : (typeof ownerRaw==='object' ? ownerRaw.name||ownerRaw.en_name||'' : String(ownerRaw||'')).trim();
      return {
        recordId: r.record_id,
        task: String(f['具体任务']||f['Task']||f['任务']||'').trim(),
        status: String(f['当前状态']||f['Status']||f['状态']||'').trim(),
        owner, module: String(f['所属模块']||'').trim(),
        due: f['承诺交付时间'] ? new Date(f['承诺交付时间']).toISOString().slice(0,10) : null,
        priority: String(f['优先级']||'').trim(),
        updatedTime: r.last_modified_time || 0
      };
    }).filter(t => t.task)
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 1: N2M Group Daily Monitoring
// Read group messages, find unanswered threads, remind owners, report to Barron
// ─────────────────────────────────────────────────────────────────────────────
async function runN2MMonitoring(forceReport = false) {
  const ops = loadData();
  const n2mChatId = ops.chats?.['N2M'];
  const barronId = ops.barronOpenId;

  if (!n2mChatId) {
    console.log('⚠️  N2M chat_id not set. Bot needs to be added to the group first.');
    return null;
  }

  console.log(`[${new Date().toISOString()}] 🔍 Running N2M group monitoring...`);

  try {
    // Get messages from the last 24 hours
    const since = Math.floor((Date.now() - 24 * 3600 * 1000) / 1000);
    const msgRes = await feishuApi('GET',
      `/im/v1/messages?container_id_type=chat&container_id=${n2mChatId}&start_time=${since}&page_size=50`
    );

    const messages = msgRes.data?.items || [];
    if (!messages.length) {
      console.log('No messages in N2M group in last 24h');
      return null;
    }

    // Format messages for GPT analysis
    const msgText = messages.map(m => {
      let content = '';
      try { content = JSON.parse(m.body?.content || '{}')?.text || m.body?.content || ''; } catch {}
      return `[${new Date(parseInt(m.create_time)*1000).toLocaleString('zh-CN')}] ${m.sender?.id || 'Unknown'}: ${content.slice(0,200)}`;
    }).join('\n');

    // GPT analysis
    const analysis = await gptAnalyze(
      `You are an operations manager AI. Analyze these Feishu group chat messages from the TCL N2M tech team over the last 24 hours.

Identify:
1. UNANSWERED questions/requests (messages that have no follow-up response)
2. Tasks or action items mentioned
3. People responsible for items that haven't responded
4. Blockers or urgent issues

Output in this exact format:
## Summary
[2-3 sentence overview]

## Unanswered Items
[list each with: who asked, what they asked, when]

## Action Items
[task | owner | urgency]

## Urgent Alerts
[anything needing immediate attention]

If nothing significant, just write "## Summary\nNo critical unanswered items in the last 24 hours."`,
      `Messages:\n${msgText}`
    );

    // Send report to Barron via DM
    if (barronId) {
      const report = `📊 N2M Group Daily Monitoring Report\n${new Date().toLocaleDateString('zh-CN')}\n\n${analysis}`;
      await sendToDM(barronId, report);
    }

    // Check for specific @mentions that need follow-up
    const urgentItems = messages.filter(m => {
      try {
        const content = JSON.parse(m.body?.content || '{}')?.text || '';
        return content.includes('@') && !content.includes('已完成') && !content.includes('好的');
      } catch { return false; }
    });

    console.log(`✅ N2M monitoring: ${messages.length} messages, ${urgentItems.length} with mentions`);
    return analysis;

  } catch(e) {
    console.error('N2M monitoring error:', e.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 2: Bitable Stale Task Reminder (>3 days not updated)
// ─────────────────────────────────────────────────────────────────────────────
async function runBitableStaleCheck(testMode = false) {
  const ops = loadData();
  const conf = ops.bitables?.[0];
  const n2mChatId = ops.chats?.['N2M'];

  if (!conf) { console.log('⚠️  No Bitable configured'); return null; }

  console.log(`[${new Date().toISOString()}] 🔍 Checking Bitable for stale tasks...`);

  const result = await readBitableTasks(conf.appToken, conf.tableId);
  if (result.error) { console.error('Bitable error:', result.error); return null; }

  const now = Date.now();
  const THREE_DAYS_MS = testMode ? 0 : 3 * 24 * 3600 * 1000;

  const staleTasks = result.tasks.filter(t => {
    const isActive = t.status && !['已完成','Done','Completed','取消','Cancelled'].includes(t.status);
    const lastUpdate = t.updatedTime ? t.updatedTime * 1000 : 0;
    const stale = !lastUpdate || (now - lastUpdate > THREE_DAYS_MS);
    return isActive && stale;
  });

  if (!staleTasks.length) {
    console.log('✅ No stale tasks found');
    return '✅ All active tasks have been updated within 3 days!';
  }

  console.log(`Found ${staleTasks.length} stale tasks`);

  // Build reminder message for the group
  const reminderLines = staleTasks.slice(0, 15).map(t => {
    const daysSince = t.updatedTime ? Math.floor((now - t.updatedTime * 1000) / 86400000) : '?';
    const ownerTag = t.owner ? `@${t.owner}` : '@负责人';
    return `• ${t.task}\n  ${ownerTag} | 状态: ${t.status||'未知'} | ${daysSince}天未更新${t.due ? ` | 截止: ${t.due}` : ''}`;
  }).join('\n\n');

  const groupMsg = `📋 TCL任务进度提醒\n\n以下 ${staleTasks.length} 个任务超过3天未更新，请相关负责人更新进展：\n\n${reminderLines}\n\n请在飞书多维表格更新最新状态 👆`;

  // Send to N2M group if bot is a member
  if (n2mChatId && !testMode) {
    try {
      await sendToChat(n2mChatId, groupMsg);
      console.log(`✅ Sent stale task reminder to N2M group`);
    } catch(e) {
      console.error('Failed to send to N2M group:', e.message);
    }
  }

  // Always send summary to Barron
  const barronId = ops.barronOpenId;
  if (barronId) {
    const summary = testMode
      ? `🧪 [TEST] Bitable Stale Check Results:\n\n${groupMsg}`
      : `✅ Stale task reminder sent to N2M group (${staleTasks.length} tasks)`;
    await sendToDM(barronId, summary);
  }

  return groupMsg;
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE 3: Auto-reply when someone asks @Barron a question in group chats
// ─────────────────────────────────────────────────────────────────────────────
async function autoReplyForBarron(text, chatId, senderId, senderName) {
  const ops = loadData();
  const barronId = ops.barronOpenId;
  if (!barronId) return null;

  // Detect if this message is directed at Barron
  const isAskingBarron =
    text.includes('Barron') ||
    text.includes('barron') ||
    (text.includes('@') && (text.toLowerCase().includes('baron') || text.includes('6820669941344108546')));

  if (!isAskingBarron) return null;

  // Don't reply to Barron's own messages
  if (senderId === barronId) return null;

  console.log(`[${new Date().toISOString()}] 💬 Auto-reply triggered: "${text.slice(0,50)}" from ${senderName || senderId}`);

  // Get Bitable context
  let bitableCtx = '';
  const conf = ops.bitables?.[0];
  if (conf) {
    try {
      const { tasks } = await readBitableTasks(conf.appToken, conf.tableId);
      const active = tasks.filter(t => t.status && !['已完成','Done'].includes(t.status)).slice(0, 10);
      bitableCtx = active.length ? `\nCurrent active tasks:\n${active.map(t => `- ${t.task} (${t.status}, owner: ${t.owner})`).join('\n')}` : '';
    } catch {}
  }

  // Use conversation framework with voice profile for authentic auto-reply
  const recentTurns = conv.getRecentTurns(chatId, 4);
  const voiceProfile = conv.getVoiceProfile();

  const ctx = `Date: ${new Date().toLocaleDateString('zh-CN')}${bitableCtx}${
    recentTurns.length ? `\nRecent group chat:\n${recentTurns.map(t => `[${t.sender||'?'}]: ${t.content}`).join('\n')}` : ''
  }`;

  const sysPrompt = conv.buildSystemPrompt({
    context: ctx,
    voice: voiceProfile,
    mode: 'auto-reply'
  });

  const res = await openai.chat.completions.create({
    model: 'gpt-4o', max_tokens: 200, temperature: 0.7,
    messages: [
      { role: 'system', content: sysPrompt },
      { role: 'user', content: `${senderName || 'Someone'} just asked: "${text}"` }
    ]
  });

  let reply = res.choices[0].message.content;
  reply = conv.stripMechanicalOpening(reply);
  return reply;
}

// ─────────────────────────────────────────────────────────────────────────────
// Command handlers
// ─────────────────────────────────────────────────────────────────────────────
function parseCmd(text) {
  const t = text.trim().toLowerCase();
  if (t === 'show tasks' || t === '任务列表') return 'LIST';
  if (t === 'show timeline' || t === '时间线') return 'TIMELINE';
  if (t.includes('daily briefing') || t === '日报') return 'BRIEFING';
  if (t === 'bitable status' || t === '任务追踪') return 'BITABLE';
  if (t === 'setup bitable' || t === '授权bitable') return 'SETUP_BITABLE';
  if (t.includes('stale check') || t.includes('超期提醒') || t.includes('test stale')) return 'STALE_TEST';
  if (t.includes('n2m report') || t.includes('监控报告') || t.includes('test n2m')) return 'N2M_TEST';
  if (t.startsWith('done ') || t.startsWith('完成 ')) return 'DONE';
  if (t === 'clear done' || t === '清除完成') return 'CLEAR';
  if (t.includes('join group') || t.includes('add to group') || t.includes('加入群')) return 'GROUP_HELP';
  if (t.includes('my id') || t === 'open id') return 'MYID';
  if (t.includes('set n2m') || t.includes('register group')) return 'SET_GROUP';
  if (t === 'status' || t === '状态') return 'SYSTEM_STATUS';
  if (t === 'voice' || t === 'voice profile' || t === '风格') return 'VOICE';
  if (t === 'update voice' || t === '更新风格') return 'VOICE_UPDATE';
  if (t === 'forget' || t === 'reset memory' || t === '清除记忆') return 'RESET_MEMORY';
  if (t === 'silent on' || t === 'mute' || t === '静默' || t === '关闭对话') return 'SILENT_ON';
  if (t === 'silent off' || t === 'unmute' || t === '解除静默' || t === '开启对话') return 'SILENT_OFF';
  if (t === 'help' || t === '帮助' || t === '?') return 'HELP';
  if (t === 'learn' || t === 'learn now' || t === '学习' || t.startsWith('learn ')) return 'LEARN';
  if (t === 'vault' || t === 'memory' || t === '记忆库') return 'VAULT_INFO';
  return 'AI';
}

function formatTasks(tasks) {
  const open = tasks.filter(t => !t.done);
  if (!open.length) return '✅ No open tasks. All clear!';
  const now = new Date();
  return open.map(t => {
    let flag = '🟢';
    if (t.due) { const h = (new Date(t.due)-now)/3.6e6; flag = h<0?'🔴':h<48?'🟡':'🟢'; }
    return `${flag} [${(t.id||'').slice(-4)}] ${t.title}${t.due?` | 📅 ${t.due}`:''}${t.assignee?` | 👤 ${t.assignee}`:''}`;
  }).join('\n');
}

function formatBitableStatus(tasks) {
  const incomplete = tasks.filter(t => !['已完成','Done','Completed'].includes(t.status));
  if (!incomplete.length) return '✅ All TCL Tracker tasks completed!';
  const now = new Date();
  return `📊 TCL Tracker — ${incomplete.length} incomplete:\n\n${
    incomplete.slice(0,12).map(t => {
      let flag = '⚪';
      if (t.due) { const h=(new Date(t.due)-now)/3.6e6; flag=h<0?'🔴':h<48?'🟡':'🟢'; }
      return `${flag} ${t.task}\n   👤 ${t.owner||'Unassigned'} | ${t.status||'Unknown'}${t.due?` | 📅 ${t.due}`:''}`;
    }).join('\n')}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket event handler
// ─────────────────────────────────────────────────────────────────────────────
const wsClient = new lark.WSClient({ appId: APP_ID, appSecret: APP_SECRET, loggerLevel: lark.LoggerLevel.warn });

wsClient.start({
  eventDispatcher: new lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (event) => {
      const { message, sender } = event;
      if (message.message_type !== 'text') return;

      let text;
      try { text = JSON.parse(message.content).text || ''; } catch { return; }

      const chatId = message.chat_id;
      const chatType = message.chat_type; // p2p or group
      const senderId = sender.sender_id?.open_id || '';
      const receiveIdType = chatType === 'p2p' ? 'open_id' : 'chat_id';
      const receiveId = chatType === 'p2p' ? senderId : chatId;

      // Auto-capture Barron's open_id from his DMs
      if (chatType === 'p2p') {
        const ops = loadData();
        if (!ops.barronOpenId && senderId) {
          ops.barronOpenId = senderId;
          saveData(ops);
          console.log(`✅ Captured Barron's open_id: ${senderId}`);
        }
        // Record Barron's DM messages for voice learning (he's the one writing here)
        if (ops.barronOpenId === senderId) {
          conv.recordBarronMessage(text);
        }
      }

      // Auto-register new group chats the bot is added to
      if (chatType === 'group') {
        const ops = loadData();
        // Detect N2M group by message content or group name
        if (!ops.chats?.N2M && (text.includes('N2M') || text.includes('技术协同'))) {
          if (!ops.chats) ops.chats = {};
          ops.chats.N2M = chatId;
          saveData(ops);
          console.log(`✅ Registered N2M group chat_id: ${chatId}`);
        }
        // Record Barron's group messages for voice learning
        if (senderId === ops.barronOpenId) {
          conv.recordBarronMessage(text);
        }
      }

      const isMentioned = text.includes('@') || text.toLowerCase().includes('clawdbot');
      const clean = text.replace(/@\S+/g, '').trim();
      const cmd = parseCmd(clean);

      // ── Group: silent task extraction + Feature 3 auto-reply ───────────────
      if (chatType === 'group' && !isMentioned) {
        const ops = loadData();

        // Feature 3: Auto-reply when someone asks @Barron (DISABLED in silent mode)
        if (ops.barronOpenId && !ops.silentMode) {
          const autoReply = await autoReplyForBarron(text, chatId, senderId, sender.sender_id?.name);
          if (autoReply) {
            await sendToChat(chatId, `[Clawdbot代Barron回复]\n\n${autoReply}`);
            console.log(`[${new Date().toISOString()}] 🤖 Auto-replied for Barron in group ${chatId}`);
            return;
          }
        }

        // Silent task extraction
        try {
          const res = await openai.chat.completions.create({
            model: 'gpt-4o-mini', max_tokens: 200,
            messages: [{ role:'user', content:`Extract tasks from: "${text}". Return JSON array [{"title":"...","due":"date or null","assignee":"name or null"}] or [].` }]
          });
          const tasks = JSON.parse(res.choices[0].message.content.trim().replace(/```json|```/g,'').trim());
          if (Array.isArray(tasks) && tasks.length) {
            const ops2 = loadData();
            ops2.tasks.push(...tasks.map(t => ({
              id: `${Date.now()}${Math.random().toString(36).slice(2,5)}`,
              title: t.title, due: t.due||null, assignee: t.assignee||null,
              chat: chatId, createdAt: new Date().toISOString(), done: false
            })));
            saveData(ops2);
            console.log(`📌 Extracted ${tasks.length} task(s) from group`);
          }
        } catch {}
        return;
      }

      // ── Handle commands (DM or @mentioned in group) ─────────────────────────
      const ops = loadData();
      let reply = '';

      try {
        switch (cmd) {

          case 'LIST':
            reply = `📋 Task Board\n\n${formatTasks(ops.tasks)}`;
            break;

          case 'TIMELINE': {
            const upcoming = ops.tasks.filter(t=>!t.done&&t.due).sort((a,b)=>new Date(a.due)-new Date(b.due)).slice(0,10);
            reply = upcoming.length ? `📅 Deadlines\n\n${upcoming.map(t=>`• ${t.due} — ${t.title}`).join('\n')}` : '📅 No upcoming deadlines.';
            break;
          }

          case 'BRIEFING': {
            const open = ops.tasks.filter(t=>!t.done);
            const now = new Date();
            const ov = open.filter(t=>t.due&&new Date(t.due)<now);
            const soon = open.filter(t=>t.due&&new Date(t.due)>=now&&(new Date(t.due)-now)<48*3.6e6);
            reply = `📊 Daily Briefing — ${new Date().toLocaleDateString('zh-CN')}\n\n🔴 Overdue: ${ov.length}  🟡 Due <48h: ${soon.length}  🟢 On track: ${open.length-ov.length-soon.length}\n`
              + (ov.length ? `\n🔴 Overdue:\n${ov.map(t=>`• ${t.title} (${t.due})`).join('\n')}` : '')
              + (soon.length ? `\n🟡 Due soon:\n${soon.map(t=>`• ${t.title} (${t.due})`).join('\n')}` : '')
              + (!ov.length && !soon.length ? '\n✅ All tasks on track!' : '');
            break;
          }

          case 'BITABLE': {
            const conf = ops.bitables?.[0];
            if (!conf) { reply = 'No Bitable configured. Type "setup bitable".'; break; }
            const tok = await getTenantToken();
            if (!tok) { reply = '❌ Auth error. Try again.'; break; }
            const result = await readBitableTasks(conf.appToken, conf.tableId);
            reply = result.error ? `❌ Bitable error: ${result.error}` : formatBitableStatus(result.tasks);
            break;
          }

          case 'SETUP_BITABLE': {
            const appToken = 'ULgAbO391aTHXvsh2q5cECE1nwd';
            const tableId = 'tblbmakMHbl2ndk0';
            const result = await readBitableTasks(appToken, tableId);
            if (result.tasks?.length > 0) {
              ops.bitables = [{ appToken, tableId, name: 'TCL Weekly Execution Tracker' }];
              saveData(ops);
              reply = `✅ Bitable connected! ${result.tasks.length} tasks found.\n\nType "bitable status" to view incomplete tasks.`;
            } else {
              reply = `❌ Cannot access Bitable. It may require cross-tenant authorization.\n\nManual option: Share tasks here and I'll track them.`;
            }
            break;
          }

          case 'STALE_TEST': {
            reply = '🧪 Running stale task check (test mode)...';
            await send(receiveId, receiveIdType, reply);
            const staleResult = await runBitableStaleCheck(true);
            reply = staleResult || '✅ No stale tasks found.';
            break;
          }

          case 'N2M_TEST': {
            const n2mId = ops.chats?.N2M;
            if (!n2mId) {
              reply = `⚠️ N2M group not registered yet.\n\nTo register:\n1. Add Clawdbot to the N2M group (via Feishu Desktop → Group Settings → 群机器人 → +)\n2. Once added, send any message in the group\n3. Clawdbot will auto-register the group\n\nAlternatively, type: "set n2m <chat_id>"`;
            } else {
              reply = '🧪 Running N2M monitoring (test mode)...';
              await send(receiveId, receiveIdType, reply);
              const report = await runN2MMonitoring(true);
              reply = report || '📊 No significant activity in N2M in the last 24h.';
            }
            break;
          }

          case 'SET_GROUP': {
            // Allow Barron to manually register a group: "set n2m oc_xxxx"
            const parts = clean.split(/\s+/);
            const groupName = parts[1] || 'N2M';
            const chatIdInput = parts[2] || chatId;
            if (!ops.chats) ops.chats = {};
            ops.chats[groupName.toUpperCase()] = chatIdInput;
            saveData(ops);
            reply = `✅ Registered group "${groupName.toUpperCase()}" with chat_id: ${chatIdInput}`;
            break;
          }

          case 'MYID':
            reply = `Your Feishu open_id: ${senderId}\n\nThis is stored for auto-reply and reminders.`;
            if (!ops.barronOpenId) { ops.barronOpenId = senderId; saveData(ops); reply += '\n✅ Saved!'; }
            break;

          case 'SYSTEM_STATUS': {
            const n2mStatus = ops.chats?.N2M ? `✅ ${ops.chats.N2M.slice(-8)}` : '❌ Not registered';
            const bitableStatus = ops.bitables?.length ? `✅ ${ops.bitables[0].name}` : '❌ Not connected';
            const barronStatus = ops.barronOpenId ? `✅ ${ops.barronOpenId.slice(-8)}` : '❌ Not captured';
            const voice = conv.loadVoice();
            const voiceStatus = voice.profile ? `✅ ${voice.sampleCount} samples learned` : `📝 ${voice.sampleCount}/5 samples (need 5+)`;
            const silentStatus = ops.silentMode ? '🔇 ON (AI回复关闭)' : '🔊 OFF (AI回复正常)';
            reply = `🤖 Clawdbot v5\n\n📊 Bitable: ${bitableStatus}\n💬 N2M Group: ${n2mStatus}\n👤 Barron ID: ${barronStatus}\n📋 Tasks: ${ops.tasks?.length || 0}\n🎭 Voice: ${voiceStatus}\n🔇 Silent Mode: ${silentStatus}\n\n⏰ Cron: 09:00 stale+N2M | 18:00 briefing | 03:00 voice update`;
            break;
          }

          case 'VOICE': {
            const v = conv.loadVoice();
            if (!v.profile) reply = `📝 Voice profile not built yet.\n\nSamples collected: ${v.sampleCount}\nNeed 5+ samples. Type "update voice" to force build.`;
            else reply = `🎭 Your voice profile:\n\n${v.profile}\n\n(Based on ${v.sampleCount} samples, last updated ${new Date(v.lastUpdate).toLocaleString('zh-CN')})`;
            break;
          }

          case 'VOICE_UPDATE': {
            const profile = await conv.updateVoiceProfile(openai);
            if (profile) reply = `✅ Voice profile updated:\n\n${profile}`;
            else reply = `⚠️ Need at least 5 samples. Currently have ${conv.loadVoice().sampleCount}. Send more messages to teach me your style.`;
            break;
          }

          case 'RESET_MEMORY': {
            const fs = require('fs');
            try { fs.writeFileSync(path.join(__dirname, 'conversation_memory.json'), '{}'); } catch {}
            reply = `🧹 Conversation memory cleared. Starting fresh.`;
            break;
          }

          case 'DONE': {
            const frag = clean.replace(/^done\s+/i,'').replace(/^完成\s+/i,'').trim();
            const t = ops.tasks.find(t=>!t.done&&(t.id?.slice(-4)===frag||t.title?.toLowerCase().includes(frag.toLowerCase())));
            if (t) { t.done = true; t.completedAt = new Date().toISOString(); saveData(ops); reply = `✅ Done: ${t.title}`; }
            else reply = `❓ Task not found: "${frag}"`;
            break;
          }

          case 'CLEAR': {
            const before = ops.tasks.length;
            ops.tasks = ops.tasks.filter(t=>!t.done);
            saveData(ops);
            reply = `🧹 Cleared ${before-ops.tasks.length} completed task(s).`;
            break;
          }

          case 'GROUP_HELP':
            reply = `🤖 How to add Clawdbot to a group:\n\n**Feishu Desktop App** (recommended):\n1. Open the group\n2. Click ⋯ → 设置 → 群机器人\n3. Click + → Search "Clawdbot" → Add\n\nOnce added, Clawdbot will:\n✅ Monitor all messages\n✅ Auto-reply when someone @Barron\n✅ Extract tasks silently\n✅ Send daily reminders`;
            break;

          case 'LEARN': {
            const isFiles = clean.toLowerCase().includes('file') || clean.includes('文件');
            const isAll = clean.toLowerCase().includes('all') || clean.includes('全部') || clean.includes('所有');
            const script = isFiles ? 'learn_files.js' : 'learn.js';
            const hours = parseInt(clean.replace(/[^\d]/g,'')) || 24;

            // "learn all" — first refresh chat list, then learn from everything
            if (isAll) {
              reply = `🌐 全量学习启动：刷新群成员 → 对话学习 → 文件学习...`;
              await send(receiveId, receiveIdType, reply);

              // Step 1: refresh chat list from Feishu API
              const tok = await getTenantToken();
              const chatsRes = await feishuApi('GET', '/im/v1/chats?page_size=100', null, tok);
              const liveChats = chatsRes.data?.items || [];
              if (!ops.chats) ops.chats = {};
              for (const c of liveChats) {
                const key = (c.name || c.chat_id.slice(-8)).replace(/[（）()【】\[\]\s]/g,'_').replace(/[^\w一-鿿_]/g,'').slice(0,30);
                ops.chats[key] = c.chat_id;
              }
              saveData(ops);

              // Step 2: run both learn scripts
              const conv = spawn('node', [path.join(__dirname,'learn.js'), '168'], { cwd: __dirname });
              let cOut = '';
              conv.stdout.on('data', d => cOut += d);
              await new Promise(r => conv.on('close', r));

              const files = spawn('node', [path.join(__dirname,'learn_files.js')], { cwd: __dirname });
              let fOut = '';
              files.stdout.on('data', d => fOut += d);
              await new Promise(r => files.on('close', r));

              const summary = (cOut + '\n' + fOut).split('\n').filter(l =>
                l.includes('🧠') || l.includes('📎') || l.includes('📥') || l.includes('📊') || l.includes('📌') || l.includes('✅') || l.includes('⏭️') || l.includes('Cost') || l.includes('Files')
              ).slice(-30).join('\n');
              reply = `🌐 全量学习完成\n\n📋 ${liveChats.length} 个群组已扫描:\n${liveChats.map(c=>`  • ${c.name}`).join('\n')}\n\n${summary}`;
              break;
            }


            reply = isFiles
              ? `📎 启动文件学习（Word/Excel 从置顶+群文件）...`
              : `🧠 启动对话学习，处理过去 ${hours} 小时...`;
            await send(receiveId, receiveIdType, reply);

            const args = isFiles ? [path.join(__dirname, script)] : [path.join(__dirname, script), String(hours)];
            const child = spawn('node', args, { cwd: __dirname });
            let out = '';
            child.stdout.on('data', d => out += d);
            child.stderr.on('data', d => out += d);
            await new Promise(res => child.on('close', res));

            const summary = out.split('\n').filter(l =>
              l.includes('🧠') || l.includes('📎') || l.includes('📥') || l.includes('📊') || l.includes('📌') || l.includes('✅') || l.includes('⬇️') || l.includes('Cost') || l.includes('Files')
            ).slice(-20).join('\n');
            reply = `${isFiles ? '📎 文件学习' : '🧠 对话学习'} 完成\n\n${summary}\n\n📂 ~/ObsidianVault/Clawdbot/04-Files/`;
            break;
          }

          case 'VAULT_INFO': {
            const idx = vault.buildIndex();
            const byFolder = {};
            idx.forEach(f => {
              const folder = f.relPath.split('/')[0];
              byFolder[folder] = (byFolder[folder] || 0) + 1;
            });
            const totalSize = idx.reduce((s,f) => s + f.size, 0);
            reply = `📚 Memory Vault\n\n📂 ${vault.VAULT}\n\n${Object.entries(byFolder).map(([k,v]) => `• ${k}: ${v} files`).join('\n')}\n\n📊 Total: ${idx.length} files, ${(totalSize/1024).toFixed(1)} KB\n\nCommands:\n• "learn" — process last 24h\n• "learn 168" — process last 7 days\n• "voice" — show voice profile`;
            break;
          }

          case 'SILENT_ON': {
            ops.silentMode = true;
            saveData(ops);
            reply = `🔇 静默模式已开启\n\n关闭功能：\n❌ AI 对话回复\n❌ 群里 @Barron 自动回复\n\n保留功能：\n✅ 命令响应（status / bitable / show tasks 等）\n✅ 定时任务（09:00 超期检查 / 18:00 摘要）\n✅ 任务静默提取\n✅ Bitable 监控\n\n输入 "silent off" 重新开启对话。`;
            break;
          }

          case 'SILENT_OFF': {
            ops.silentMode = false;
            saveData(ops);
            reply = `🔊 静默模式已关闭。AI 对话和自动回复已恢复。`;
            break;
          }

          case 'HELP': {
            reply = `🤖 Clawdbot 命令\n\n📊 数据查询\n• status / 状态 — 系统状态\n• bitable status — TCL Tracker 未完成任务\n• show tasks — 任务列表\n• show timeline — 截止日期\n• daily briefing / 日报 — 今日摘要\n\n🧪 测试\n• test stale — 立即超期检查\n• test n2m — 立即 N2M 监控\n\n⚙️ 控制\n• silent on / 关闭对话 — 关闭 AI 回复\n• silent off / 开启对话 — 恢复 AI 回复\n• voice — 查看语言风格\n• forget — 清除对话记忆\n\n✏️ 任务\n• done [任务名] — 标记完成\n• clear done — 清除已完成`;
            break;
          }

          default: {
            // Silent mode: don't reply with AI, only acknowledge
            if (ops.silentMode) {
              // Still extract tasks silently in DM
              if (chatType === 'p2p') {
                try {
                  const ex = JSON.parse((await gptMini(`Extract concrete tasks from: "${clean}". JSON [{"title":"...","due":"YYYY-MM-DD or null","assignee":"name or null"}] or []. Only real tasks. Return ONLY JSON.`)).trim().replace(/```json|```/g,''));
                  if (Array.isArray(ex) && ex.length) {
                    ops.tasks.push(...ex.map(t=>({ id:`${Date.now()}${Math.random().toString(36).slice(2,5)}`, title:t.title, due:t.due||null, assignee:t.assignee||null, chat:chatId, createdAt:new Date().toISOString(), done:false })));
                    saveData(ops);
                    console.log(`[silent mode] extracted ${ex.length} task(s) from DM`);
                  }
                } catch {}
              }
              // No reply in silent mode
              console.log(`[${new Date().toISOString()}] [${chatType}] 🔇 silent mode — ignored`);
              return;
            }

            // AI response with full context
            let bitableTasks = [];
            const conf = ops.bitables?.[0];
            if (conf) {
              try {
                const r = await readBitableTasks(conf.appToken, conf.tableId);
                bitableTasks = r.tasks || [];
              } catch {}
            }

            const open = ops.tasks.filter(t=>!t.done);
            const incomplete = bitableTasks.filter(t=>!['已完成','Done'].includes(t.status));

            // Build context — only include what's relevant
            const ctxParts = [];
            if (open.length) ctxParts.push(`Open manual tasks: ${open.slice(0,3).map(t=>t.title).join('; ')}`);
            if (incomplete.length) ctxParts.push(`TCL Tracker incomplete: ${incomplete.length} tasks. Top 3: ${incomplete.slice(0,3).map(t=>`${t.task} (${t.owner})`).join('; ')}`);

            // Retrieve from vault (free, keyword search)
            if (vault.shouldRetrieve(clean)) {
              const r = vault.retrieve(clean, { maxResults: 3, maxChars: 2000 });
              if (r.context) ctxParts.push(r.context);
            }

            const recentTurns = conv.getRecentTurns(chatId, 6);
            const ctxString = ctxParts.join('\n') || 'No active tasks.';

            // Classify intent for response length
            const mode = conv.classifyMode(clean);
            const voice = conv.getVoiceProfile();

            const sysPrompt = conv.buildSystemPrompt({ context: ctxString, voice, mode });

            // Build message history with conversation memory
            const messages = [{ role: 'system', content: sysPrompt }];
            recentTurns.forEach(t => {
              messages.push({ role: t.role, content: t.content });
            });
            messages.push({ role: 'user', content: clean });

            // Token budget per mode
            const maxTok = mode === 'concise' ? 120 : (mode === 'detailed' ? 600 : 250);

            const res = await openai.chat.completions.create({
              model: 'gpt-4o',
              max_tokens: maxTok,
              temperature: 0.75,
              presence_penalty: 0.4,
              frequency_penalty: 0.3,
              messages
            });

            reply = res.choices[0].message.content;
            reply = conv.stripMechanicalOpening(reply);

            // Record this turn in memory
            conv.recordTurn(chatId, 'user', clean, sender.sender_id?.name || senderId.slice(-6));
            conv.recordTurn(chatId, 'assistant', reply, 'Clawdbot');

            // Silently extract tasks (only in DM)
            if (chatType === 'p2p') {
              try {
                const ex = JSON.parse((await gptMini(`Extract concrete tasks (with deadlines) from: "${clean}". JSON [{"title":"...","due":"YYYY-MM-DD or null","assignee":"name or null"}] or []. Only real tasks, not questions. Return ONLY JSON.`)).trim().replace(/```json|```/g,''));
                if (Array.isArray(ex) && ex.length) {
                  ops.tasks.push(...ex.map(t=>({ id:`${Date.now()}${Math.random().toString(36).slice(2,5)}`, title:t.title, due:t.due||null, assignee:t.assignee||null, chat:chatId, createdAt:new Date().toISOString(), done:false })));
                  saveData(ops);
                  // Don't append visible task notification — keep replies clean
                }
              } catch {}
            }
          }
        }

        if (reply) {
          await send(receiveId, receiveIdType, reply);
          console.log(`[${new Date().toISOString()}] [${chatType}] cmd=${cmd}`);
        }

      } catch(e) {
        console.error('Handler error:', e.message);
        try { await send(receiveId, receiveIdType, `⚠️ Error: ${e.message.slice(0,100)}`); } catch {}
      }
    },

    // Bot added to group — auto-register and auto-learn
    'im.chat.member.bot.added_v1': async (event) => {
      const chatId = event.chat_id;
      const ops = loadData();
      if (!ops.chats) ops.chats = {};

      try {
        const info = await feishuApi('GET', `/im/v1/chats/${chatId}`);
        const name = info.data?.name || '';
        console.log(`🤖 Bot added to: "${name}" (${chatId})`);

        // Generate a clean key from group name (used for vault paths)
        const cleanKey = name
          .replace(/[（）()【】\[\]\s]/g,'_')
          .replace(/[^\w一-鿿_]/g,'')
          .slice(0, 30) || chatId.slice(-8);
        ops.chats[cleanKey] = chatId;

        // Special-case key registrations
        if (name.includes('N2M') || name.includes('技术协同')) ops.chats.N2M = chatId;
        if (name.includes('CELL') && name.includes('付费')) ops.chats.CELL_EDM = chatId;

        saveData(ops);
        console.log(`✅ Registered as "${cleanKey}"`);

        // Notify Barron via DM (silent join — don't message in group)
        if (ops.barronOpenId) {
          try {
            await sendToDM(ops.barronOpenId, `🤖 加入群组: "${name}"\n\n开始自动学习对话历史和文件...`);
          } catch {}
        }

        // Auto-learn: trigger learn.js + learn_files.js for this new group
        setTimeout(async () => {
          console.log(`🧠 Auto-learning from "${name}"...`);
          // Run conversation learn for this specific group (24h)
          const learnChild = spawn('node', [path.join(__dirname, 'learn.js'), '24'], { cwd: __dirname });
          let convOut = '';
          learnChild.stdout.on('data', d => convOut += d);
          await new Promise(r => learnChild.on('close', r));

          // Run files learn (idempotent — skips already processed)
          const fileChild = spawn('node', [path.join(__dirname, 'learn_files.js')], { cwd: __dirname });
          let fileOut = '';
          fileChild.stdout.on('data', d => fileOut += d);
          await new Promise(r => fileChild.on('close', r));

          if (ops.barronOpenId) {
            const summary = (convOut + '\n' + fileOut).split('\n').filter(l =>
              l.includes('🧠') || l.includes('📥') || l.includes('📊') || l.includes('📎') || l.includes('📌') || l.includes('Cost')
            ).slice(-15).join('\n');
            try { await sendToDM(ops.barronOpenId, `✅ "${name}" 学习完成\n\n${summary}`); } catch {}
          }
          console.log(`✅ Auto-learn complete for "${name}"`);
        }, 3000); // small delay to ensure event registration completes
      } catch(e) {
        console.error('Bot added handler error:', e.message);
      }
    }
  })
});

// ─────────────────────────────────────────────────────────────────────────────
// Scheduled jobs
// ─────────────────────────────────────────────────────────────────────────────

// Every day at 9:00 AM — Bitable stale check + N2M monitoring report
cron.schedule('0 9 * * *', async () => {
  console.log('[CRON] 09:00 — Running daily checks...');
  await runBitableStaleCheck(false);
  await runN2MMonitoring(false);
}, { timezone: 'Asia/Shanghai' });

// Every Sunday at 4:00 AM — Scan for new pinned/shared Word & Excel files
cron.schedule('0 4 * * 0', async () => {
  console.log('[CRON] Sunday 04:00 — Learning files...');
  try {
    const child = spawn('node', [path.join(__dirname, 'learn_files.js')], { cwd: __dirname });
    child.stdout.on('data', d => console.log('[learn_files]', d.toString().trim()));
  } catch(e) { console.error('[CRON] File learn error:', e.message); }
}, { timezone: 'Asia/Shanghai' });

// Every day at 3:00 AM — Update voice profile + learn from yesterday's chats
cron.schedule('0 3 * * *', async () => {
  console.log('[CRON] 03:00 — Updating voice profile + learning...');
  try {
    const profile = await conv.updateVoiceProfile(openai);
    if (profile) console.log('[CRON] ✅ Voice profile refreshed');
  } catch(e) { console.error('[CRON] Voice update error:', e.message); }

  // Run learn.js in subprocess
  try {
    const child = spawn('node', [path.join(__dirname, 'learn.js'), '24'], { cwd: __dirname });
    child.stdout.on('data', d => console.log('[learn]', d.toString().trim()));
    child.stderr.on('data', d => console.error('[learn err]', d.toString().trim()));
  } catch(e) { console.error('[CRON] Learn error:', e.message); }
}, { timezone: 'Asia/Shanghai' });

// Every day at 6:00 PM — Evening summary to Barron
cron.schedule('0 18 * * *', async () => {
  console.log('[CRON] 18:00 — Evening summary...');
  const ops = loadData();
  const barronId = ops.barronOpenId;
  if (!barronId) return;

  const conf = ops.bitables?.[0];
  if (!conf) return;

  const result = await readBitableTasks(conf.appToken, conf.tableId);
  const incomplete = (result.tasks||[]).filter(t=>!['已完成','Done'].includes(t.status));
  const now = new Date();
  const overdue = incomplete.filter(t=>t.due&&new Date(t.due)<now);
  const dueSoon = incomplete.filter(t=>t.due&&new Date(t.due)>=now&&(new Date(t.due)-now)<48*3.6e6);

  const summary = `📊 Evening Summary — ${new Date().toLocaleDateString('zh-CN')}\n\n🔴 Overdue: ${overdue.length}\n🟡 Due tomorrow: ${dueSoon.length}\n📋 Total incomplete: ${incomplete.length}\n\n${overdue.length ? `Overdue:\n${overdue.slice(0,5).map(t=>`• ${t.task} (${t.owner||'?'})`).join('\n')}` : '✅ No overdue tasks!'}`;

  await sendToDM(barronId, summary);
  console.log('[CRON] Evening summary sent to Barron');
}, { timezone: 'Asia/Shanghai' });

// ─────────────────────────────────────────────────────────────────────────────
// Startup
// ─────────────────────────────────────────────────────────────────────────────
async function startup() {
  const ops = loadData();

  // Auto-connect Bitable if not already configured
  if (!ops.bitables?.length) {
    const result = await readBitableTasks('ULgAbO391aTHXvsh2q5cECE1nwd', 'tblbmakMHbl2ndk0');
    if (result.tasks?.length > 0) {
      ops.bitables = [{ appToken: 'ULgAbO391aTHXvsh2q5cECE1nwd', tableId: 'tblbmakMHbl2ndk0', name: 'TCL Weekly Execution Tracker' }];
      saveData(ops);
      console.log(`✅ Bitable auto-connected: ${result.tasks.length} tasks`);
    }
  }

  const n2mStatus = ops.chats?.N2M ? `✅ Registered (${ops.chats.N2M.slice(-8)})` : '⚠️  Waiting for bot to join group';
  const barronStatus = ops.barronOpenId ? `✅ ${ops.barronOpenId.slice(-8)}` : '⚠️  Send a DM to capture';
  const bitableStatus = ops.bitables?.length ? `✅ ${ops.bitables[0].name}` : '❌ Not connected';

  console.log(`
╔══════════════════════════════════════════╗
║   Clawdbot — Operations Manager v4       ║
║   App: ${APP_ID}    ║
║   Mode: WebSocket Long Connection        ║
╠══════════════════════════════════════════╣
║ Bitable:  ${bitableStatus.padEnd(30)} ║
║ N2M Group:${n2mStatus.padEnd(30)} ║
║ Barron ID:${barronStatus.padEnd(30)} ║
╠══════════════════════════════════════════╣
║ Features:                                ║
║ ✅ F1: N2M daily unanswered scan         ║
║ ✅ F2: Bitable stale task @reminders     ║
║ ✅ F3: Auto-reply @Barron questions      ║
║ ⏰ Cron: 09:00 & 18:00 (Asia/Shanghai)  ║
╚══════════════════════════════════════════╝
`);
}

startup();
