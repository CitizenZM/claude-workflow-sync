require('dotenv').config();
const lark = require('@larksuiteoapi/node-sdk');
const OpenAI = require('openai');
const cron = require('node-cron');
const https = require('https');
const fs = require('fs');
const path = require('path');
const conv = require('./conversation');
const vault = require('./vault');
const fac  = require('./facilitator');
const wt   = require('./work_threads');
const mtg  = require('./meeting_report');
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

// ── Rich text (post) sender — supports bold, at-mentions, line breaks ─────────
// content: array of paragraphs, each paragraph is array of inline elements
// element: { tag: 'text'|'at', text?, user_id? }
async function sendPostToChat(chatId, title, content) {
  await sendPost(chatId, 'chat_id', title, content);
}
async function sendPostToDM(openId, title, content) {
  await sendPost(openId, 'open_id', title, content);
}
async function sendPost(receiveId, receiveIdType, title, content) {
  await client.im.message.create({
    params: { receive_id_type: receiveIdType },
    data: {
      receive_id: receiveId,
      msg_type: 'post',
      content: JSON.stringify({ post: { zh_cn: { title, content } } })
    }
  });
}

// Build a bold section header paragraph
function postHeader(label) {
  return [{ tag: 'text', text: label, style: { bold: true } }];
}
// Build a plain text paragraph
function postLine(text) {
  return [{ tag: 'text', text }];
}
// Build a task item paragraph
function postTask(emoji, text) {
  return [{ tag: 'text', text: `${emoji} ${text}` }];
}

// ── Shared title truncator ────────────────────────────────────────────────────
function shortTitle(raw) {
  if (!raw) return '(无标题)';
  let t = raw.replace(/https?:\/\/\S+/g, '[链接]');
  t = t.split(/\n/)[0].trim();
  return t.length > 38 ? t.slice(0, 38) + '…' : t;
}

// ── Bitable change notification builder ──────────────────────────────────────
// Returns [title, paragraphs]. Also accepts pendingWrite[] collector for
// caller to batch-write new unowned tasks into Bitable.
function buildBitableChangePost(changes, pendingWrites) {
  function dedup(tasks) {
    const seen = new Set();
    return tasks.filter(t => {
      const key = shortTitle(t.task).slice(0, 18).replace(/\s/g, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' });
  const completedCount = changes.completed?.length || 0;
  const overdueRaw = dedup(changes.overdueNew || []);

  // Tier: actionable ≤7 days late (or no due), stale >7 days late
  const actionable = overdueRaw.filter(t => !t.due || (Date.now() - new Date(t.due)) / 86400000 <= 7);
  const stale      = overdueRaw.filter(t => t.due && (Date.now() - new Date(t.due)) / 86400000 > 7);

  const title = `📊 Bitable 变更 · ${dateStr}`;
  const paragraphs = [];

  // Summary bar
  const summaryParts = [];
  if (completedCount)    summaryParts.push(`✅ 完成 ${completedCount}`);
  if (actionable.length) summaryParts.push(`🟠 待处理 ${actionable.length}`);
  if (stale.length)      summaryParts.push(`⚫ 积压 ${stale.length}`);
  paragraphs.push([{ tag: 'text', text: summaryParts.join('　|　') }]);
  paragraphs.push([{ tag: 'text', text: '─────────────────────────────────' }]);

  // Completed
  if (completedCount) {
    paragraphs.push(postHeader(`✅ 今日完成（${completedCount}）`));
    (changes.completed || []).slice(0, 8).forEach(t => {
      paragraphs.push(postTask('▸', `${shortTitle(t.task)}${t.owner ? ' · ' + t.owner : ''}`));
    });
    if (completedCount > 8) paragraphs.push(postLine(`　…另有 ${completedCount - 8} 项`));
    paragraphs.push(postLine(''));
  }

  // Actionable overdue — table with owner suggestion + @mention
  if (actionable.length) {
    paragraphs.push(postHeader(`🟠 本周需处理（${actionable.length}）`));
    paragraphs.push([{ tag: 'text', text: '  任务　　　　　　　　　　　责任人　　　截止　　　来源' }]);
    paragraphs.push([{ tag: 'text', text: '  ──────────────────────────────────────────────' }]);

    actionable.forEach(t => {
      let ownerDisplay, ownerName;
      if (t.owner) {
        ownerName    = t.owner;
        ownerDisplay = t.owner;
      } else {
        // Suggest owner — use groupKey from task if available, else cross-group lookup
        const suggestion = fac.suggestOwner(t.groupKey || '', t.task);
        ownerName    = suggestion.suggested;
        const conf   = suggestion.confidence === 'high' ? '' : suggestion.confidence === 'medium' ? '?' : '??';
        ownerDisplay = ownerName ? `→${ownerName}${conf}` : '🔴待认领';

        // Collect for Bitable write
        if (pendingWrites && ownerName) {
          pendingWrites.push({
            title:       t.task,
            module:      t.module || 'Clawdbot追踪',
            priority:    t.priority || 'P2',
            dueMs:       t.due ? new Date(t.due).getTime() : null,
            ownerOpenIds: [nameToOpenId(ownerName)].filter(Boolean),
            status:      '进行中',
            note:        `AI推断责任人: ${ownerName}（${suggestion.reason}）`,
            source:      `来源群组: ${t.groupKey || '未知'}`,
          });
        }
      }

      const due = t.due
        ? new Date(t.due).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
        : '无截止';
      const grp = shortTitle(t.groupKey || t.group || '').slice(0, 8);
      const titlePad = shortTitle(t.task).padEnd(22);
      const ownerPad = ownerDisplay.padEnd(12);

      // Build rich paragraph: @mention if we have open_id
      const ownerOpenId = ownerName ? nameToOpenId(ownerName) : null;
      const para = [{ tag: 'text', text: `  ▸ ${titlePad}` }];
      if (ownerOpenId && !t.owner) {
        para.push({ tag: 'at', user_id: ownerOpenId });
        para.push({ tag: 'text', text: `(建议)　${due.padEnd(8)}${grp}` });
      } else {
        para.push({ tag: 'text', text: `${ownerPad}${due.padEnd(8)}${grp}` });
      }
      paragraphs.push(para);
    });
    paragraphs.push(postLine(''));
  }

  // Stale
  if (stale.length) {
    paragraphs.push(postHeader(`⚫ 长期积压（${stale.length}项，>7天）— 建议关闭或重分配`));
    stale.slice(0, 8).forEach(t => {
      const days = t.due ? `${Math.floor((Date.now() - new Date(t.due)) / 86400000)}天` : '无截止';
      let ownerStr = t.owner || '';
      if (!ownerStr) {
        const s = fac.suggestOwner(t.groupKey || '', t.task);
        ownerStr = s.suggested ? `→${s.suggested}?` : '待认领';
      }
      paragraphs.push(postTask('▹', `${shortTitle(t.task)} · ${ownerStr} · 逾期${days}`));
    });
    if (stale.length > 8) paragraphs.push(postLine(`　…另有 ${stale.length - 8} 项`));
    paragraphs.push(postLine(''));
  }

  paragraphs.push([{
    tag: 'text',
    text: `💡 「bitable status」完整列表　|　「责任人建议」查看推断　|　已自动写入 Bitable ${pendingWrites?.length ? pendingWrites.length + '条' : ''}`,
    style: { bold: true },
  }]);

  return [title, paragraphs];
}

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
      // Support both old and new owner field names
      const ownerRaw = f['Owner（提出人+跟进人）'] || f['Owner（Owner&执行人）'] || f['Owner'] || f['负责人'] || f['执行人'] || '';
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

// ── Bitable write: create a new tracking record ───────────────────────────────
// ownerOpenIds: array of open_id strings (for Person fields)
// dueMs: timestamp in ms, or null
async function writeBitableTask({ title, module, priority, dueMs, ownerOpenIds, status, note, source }) {
  const APP_TOKEN = 'ULgAbO391aTHXvsh2q5cECE1nwd';
  const TABLE_ID  = 'tblbmakMHbl2ndk0';
  const tok = await getTenantToken();

  const fields = {
    '具体任务': title,
    '所属模块': module || 'Clawdbot追踪',
    '优先级': priority || 'P2',
    '当前状态': status || '进行中',
  };

  if (dueMs) fields['承诺交付时间'] = dueMs;
  if (note)  fields['当日进展'] = note;
  if (source) fields['说明'] = [{ type: 'text', text: source }];

  // Person field: array of { id: open_id }
  if (ownerOpenIds?.length) {
    fields['Owner（提出人+跟进人）'] = ownerOpenIds.map(id => ({ id }));
  }

  const res = await feishuApi('POST',
    `/bitable/v1/apps/${APP_TOKEN}/tables/${TABLE_ID}/records`,
    { fields },
    tok
  );

  if (res.code !== 0) {
    console.error('[Bitable write] Error:', res.msg, res.code);
    return null;
  }
  return res.data?.record?.record_id;
}

// ── name → open_id lookup ─────────────────────────────────────────────────────
const ID_NAME_MAP = (() => {
  try { return JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'id_name_map.json'), 'utf8')); }
  catch { return {}; }
})();
// Build reverse map: name → open_id (full ou_ entries only)
const NAME_TO_ID = {};
for (const [id, name] of Object.entries(ID_NAME_MAP)) {
  if (id.startsWith('ou_') && name) NAME_TO_ID[name] = id;
}
function nameToOpenId(name) {
  return NAME_TO_ID[name] || null;
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
// ── Resolve group key from chat_id (per-group isolation, Req 6) ─────────────
function resolveGroupKey(chatId) {
  const ops = loadData();
  // Reverse lookup: find the registered name for this chatId
  for (const [key, id] of Object.entries(ops.chats || {})) {
    if (id === chatId) return key;
  }
  return chatId.slice(-8); // fallback
}

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
  if (t.startsWith('客户已确认 ') || t.startsWith('client confirmed ')) return 'CLIENT_RESOLVED';
  if (t.startsWith('完成 ') || t.startsWith('done ') || t.startsWith('✅ ')) return 'FAC_DONE';
  if (t.startsWith('延期 ') || t.startsWith('defer ')) return 'FAC_DEFER';
  if (t.startsWith('取消 ') || t.startsWith('cancel ')) return 'FAC_CANCEL';
  if (t === '群任务' || t === 'group tasks' || t === '本群任务') return 'FAC_GROUP_TASKS';
  if (t === '项目总览' || t === 'project overview') return 'FAC_OVERVIEW';
  if (t === '会议报告' || t === 'meeting report' || t === '会议') return 'MEETING_REPORT';
  if (t.startsWith('谁做了') || t.startsWith('做了什么') || t.match(/^(.+)(今天|本周|做了什么)/)) return 'PERSON_QUERY';
  if (t.startsWith('who did') || t.startsWith('what did')) return 'PERSON_QUERY';
  if (t === 'chase' || t === '催进度' || t === '跟进') return 'FAC_CHASE';
  if (t === 'dashboard' || t === '仪表盘' || t === '面板') return 'DASHBOARD';
  if (t === '客户阻塞' || t === 'client sla' || t === '等客户') return 'CLIENT_SLA';
  if (t === '项目文件' || t.startsWith('project files')) return 'PROJECT_FILES';
  if (t === '未回答' || t === 'unanswered' || t === '问题追踪') return 'UNANSWERED';
  if (t.startsWith('添加里程碑') || t.startsWith('add milestone')) return 'ADD_MILESTONE';
  if (t === '里程碑' || t === 'milestones') return 'MILESTONES';
  if (t === '责任人建议' || t === 'suggest owners' || t === '推断责任人' || t === '谁负责') return 'SUGGEST_OWNERS';
  if (t === '全局责任人' || t === 'global owners' || t === '所有缺责任人') return 'GLOBAL_OWNERS';
  if (t === 'pm总览' || t === 'pm brief' || t === '协调总览' || t === 'pm') return 'PM_BRIEF';
  if (t.startsWith('策略 ') || t.startsWith('pm ')) return 'PM_GROUP_DETAIL';
  if (t === 'help' || t === '帮助' || t === '?') return 'HELP';
  if (t === 'learn' || t === 'learn now' || t === '学习' || t.startsWith('learn ')) return 'LEARN';
  if (t === 'vault' || t === 'memory' || t === '记忆库') return 'VAULT_INFO';
  if (t === 'brain' || t === '大脑' || t.startsWith('brain ') || t.startsWith('知道 ') || t.startsWith('知道')) return 'BRAIN';
  if (t === 'synthesize people' || t === '更新人物') return 'SYNTH_PEOPLE';
  if (t === 'decisions' || t === '决策日志') return 'DECISIONS';
  if (t.startsWith('import history') || t.startsWith('导入历史')) return 'IMPORT_HISTORY';
  if (t === 'scrape help' || t === '抓取帮助') return 'SCRAPE_HELP';
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
  const done = ['已完成','Done','Completed'];
  const incomplete = tasks.filter(t => !done.includes(t.status));
  if (!incomplete.length) return '✅ TCL Tracker 所有任务已完成';

  function shortTitle(raw) {
    if (!raw) return '(无标题)';
    let t = raw.replace(/https?:\/\/\S+/g, '[链接]').split(/\n/)[0].trim();
    return t.length > 36 ? t.slice(0, 36) + '…' : t;
  }

  const now = new Date();
  const overdue  = incomplete.filter(t => t.due && new Date(t.due) < now);
  const dueSoon  = incomplete.filter(t => t.due && new Date(t.due) >= now && (new Date(t.due) - now) < 48 * 3.6e6);
  const onTrack  = incomplete.filter(t => !t.due || (new Date(t.due) - now) >= 48 * 3.6e6);

  const lines = [`📊 TCL Tracker · ${incomplete.length} 项未完成\n`];
  lines.push(`🔴 逾期 ${overdue.length}　🟡 48h内到期 ${dueSoon.length}　🟢 正常 ${onTrack.length}\n`);
  lines.push('─────────────────────');

  function renderGroup(label, items, limit = 6) {
    if (!items.length) return;
    lines.push(`\n${label}`);
    items.slice(0, limit).forEach(t => {
      const owner = t.owner || '待认领';
      const due = t.due ? new Date(t.due).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : '无截止';
      lines.push(`  ${shortTitle(t.task)}`);
      lines.push(`    → ${owner} | ${due} | ${t.status || '-'}`);
    });
    if (items.length > limit) lines.push(`    …另有 ${items.length - limit} 项`);
  }

  renderGroup('🔴 逾期任务', overdue, 6);
  renderGroup('🟡 48小时内到期', dueSoon, 4);
  if (onTrack.length <= 5) renderGroup('🟢 进行中', onTrack, 5);
  else lines.push(`\n🟢 进行中：${onTrack.length} 项（输入「bitable status」查看全部）`);

  return lines.join('\n');
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

      // ── Resolve group key for per-group isolation ─────────────────────────
      const groupKey = resolveGroupKey(chatId);

      // ── Group: facilitation engine (Req 3: smart intervention) ──────────
      if (chatType === 'group' && !isMentioned) {
        const ops = loadData();
        const senderName = sender.sender_id?.name || senderId.slice(-6);

        // --- Req 2: Track @mentions for 30-min follow-up ---
        const atMatches = text.match(/[@＠](\S+)/g);
        if (atMatches) {
          for (const at of atMatches) {
            const mentioned = at.replace(/[@＠]/, '');
            if (mentioned && !mentioned.includes('all') && !mentioned.includes('所有人')) {
              fac.recordMention(groupKey, {
                mentionedUser: mentioned,
                mentionerName: senderName,
                messageText: text,
              });
              console.log(`📡 @mention tracked: ${mentioned} by ${senderName} in ${groupKey}`);
            }
          }
        }

        // --- Req 2: Clear mentions if the mentioned person speaks ---
        fac.markMentionResponded(groupKey, senderName);
        fac.markMentionResponded(groupKey, senderId);

        // --- Req 7: Record to per-person work thread ---
        wt.recordMessage(senderId, { group: groupKey, text: clean, timestamp: Date.now() });

        // --- Req 2: Handle "稍后" defer ---
        if (/^(稍后|later|hold|等一下)/i.test(clean)) {
          fac.deferMention(groupKey, senderName);
          fac.deferMention(groupKey, senderId);
        }

        // --- Req 4: Record for hourly digest ---
        const hasUrgent = fac.detectUrgency(text);
        const hasChase = fac.detectChase(text);
        fac.recordHourlyMessage(groupKey, {
          sender: senderName,
          text,
          hasChase,
          hasUrgent,
        });

        // --- Req 3: Check smart intervention rules ---
        const today = new Date().toISOString().slice(0, 10);
        const groupTasks = fac.getGroupTasks(groupKey, 'open');
        const isDeadlineDay = groupTasks.some(t => t.deadline === today);
        const pendingMentions = fac.getMentionsNeedingReminder(groupKey);
        const hourlyUrgent = fac.getHourlyUrgentItems(groupKey);
        const isMultipleChase = Object.values(hourlyUrgent.chaseTargets).some(c => c >= 3);

        const intervention = fac.shouldIntervene({
          isMentioned: false,
          isScheduledTime: false,
          isDeadlineDay,
          isPreMeeting: false,
          mentionEscalation: pendingMentions.length > 0,
          isMultipleChaseNoReply: isMultipleChase,
          isUrgentKeyword: hasUrgent && hasChase,
        });

        // --- Req 2: Send @mention reminders ---
        if (pendingMentions.length > 0) {
          for (const m of pendingMentions) {
            const elapsed = Math.floor((Date.now() - m.timestamp) / 60000);
            if (m.remindersSent === 0) {
              // 30min: gentle group reminder
              await sendToChat(chatId,
                `⏰ @${m.mentionedUser} ${m.mentionerName}在${elapsed}分钟前提到了你：\n「${m.messageText.slice(0, 100)}」\n——回复「稍后」我帮你记着`
              );
              fac.bumpMentionReminder(groupKey, m.id);
              console.log(`⏰ 30min reminder sent: ${m.mentionedUser} in ${groupKey}`);
            } else if (m.remindersSent === 1) {
              // 2h: DM the person (if we have their ID — for now group msg)
              await sendToChat(chatId,
                `🔔 @${m.mentionedUser} 已过${elapsed}分钟未回复 ${m.mentionerName} 的消息，请确认`
              );
              fac.bumpMentionReminder(groupKey, m.id);
            } else if (m.remindersSent === 2) {
              // 4h: escalate to Barron
              if (ops.barronOpenId) {
                await sendToDM(ops.barronOpenId,
                  `🚨 升级提醒 | ${groupKey}\n\n@${m.mentionedUser} 超过${elapsed}分钟未回复\n原消息: 「${m.messageText.slice(0, 100)}」\n发送人: ${m.mentionerName}`
                );
              }
              fac.bumpMentionReminder(groupKey, m.id);
            }
          }
        }

        // --- v7: Detect client dependencies ---
        if (fac.detectClientDependency(text)) {
          try {
            const cdRes = await openai.chat.completions.create({
              model: 'gpt-4o-mini', max_tokens: 150,
              messages: [{ role: 'user', content: `从这条消息提取"等客户确认/提供"的具体事项。\n消息: "${text}"\n\n返回JSON: {"item":"等什么", "details":"细节"} 或 null。只返回JSON。` }]
            });
            const cd = JSON.parse(cdRes.choices[0].message.content.trim().replace(/```json|```/g, '').trim());
            if (cd && cd.item) {
              fac.recordClientDependency(groupKey, { item: cd.item, requestedBy: senderName, details: cd.details || '' });
              console.log(`🔶 Client dep tracked: ${cd.item} in ${groupKey}`);
            }
          } catch {}
        }

        // --- v7: Detect questions for gap tracking ---
        if (text.includes('？') || text.includes('?') || /吗$|呢$|么$/.test(text.trim())) {
          fac.recordQuestion(groupKey, { asker: senderName, question: text.slice(0, 200), timestamp: Date.now() });
        }

        // --- v7: Detect file links → register to project ---
        if (fac.detectFileLink(text)) {
          const projMatch = fac.findProjectForGroup(groupKey);
          if (projMatch) {
            const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
            if (urlMatch) {
              fac.registerFile(projMatch.project, {
                url: urlMatch[1],
                type: 'shared',
                name: urlMatch[1].slice(-40),
                sharedBy: senderName,
                group: groupKey,
              });
              console.log(`📎 File registered: ${projMatch.project} from ${groupKey}`);
            }
          }
        }

        // --- v7: Mark questions answered when someone replies ---
        // If the previous message was a question and this is a non-question response
        if (!(text.includes('？') || text.includes('?')) && text.length > 5) {
          const unanswered = fac.getUnansweredQuestions(groupKey, 60);
          if (unanswered.length > 0) {
            // Mark the most recent question as answered (best-effort)
            const recent = unanswered[unanswered.length - 1];
            if (recent.minutesAgo < 30) {
              fac.markQuestionAnswered(groupKey, recent.question.slice(0, 20), senderName);
            }
          }
        }

        // --- Silent task extraction with accountability (Req 1) ---
        try {
          const res = await openai.chat.completions.create({
            model: 'gpt-4o-mini', max_tokens: 300,
            messages: [{ role: 'user', content: `${fac.TASK_EXTRACT_PROMPT}\n\nMessage from ${senderName}:\n"${text}"` }]
          });
          const tasks = JSON.parse(res.choices[0].message.content.trim().replace(/```json|```/g, '').trim());
          if (Array.isArray(tasks) && tasks.length) {
            const needsInfo = [];
            for (const t of tasks) {
              const result = fac.createTask(groupKey, {
                title: t.title,
                owner: t.owner,
                deadline: t.deadline,
                source: 'chat',
                urgency: t.urgency || 'normal',
              });
              if (!result.validation.valid) needsInfo.push(result);
            }
            console.log(`📌 Extracted ${tasks.length} task(s) from ${groupKey}`);

            // Req 1: Prompt for missing owner/deadline
            if (needsInfo.length > 0) {
              const prompt = fac.formatMissingPrompt(needsInfo.map(r => r.task));
              if (prompt) {
                await sendToChat(chatId, prompt);
              }
            }
          }
        } catch {}

        // --- Feature 3: Auto-reply @Barron (only when not in silent mode) ---
        if (ops.barronOpenId && !ops.silentMode) {
          const autoReply = await autoReplyForBarron(text, chatId, senderId, senderName);
          if (autoReply) {
            await sendToChat(chatId, `[Clawdbot代Barron回复]\n\n${autoReply}`);
            console.log(`[${new Date().toISOString()}] 🤖 Auto-replied for Barron in ${groupKey}`);
            return;
          }
        }

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
            const facState = fac.loadState();
            const groupCount = Object.keys(facState.groups || {}).filter(g => facState.groups[g].chatId).length;
            const clientSLACount = fac.getPendingClientSLA().length;
            const milestoneCount = fac.getUpcomingMilestones(14).length;
            reply = `🤖 Clawdbot v7\n\n📊 Bitable: ${bitableStatus}\n💬 N2M Group: ${n2mStatus}\n👤 Barron ID: ${barronStatus}\n📋 Tasks: ${ops.tasks?.length || 0}\n🎭 Voice: ${voiceStatus}\n🔇 Silent Mode: ${silentStatus}\n📡 活跃群组: ${groupCount}\n🔶 客户阻塞: ${clientSLACount}项\n🏗️ 近期里程碑: ${milestoneCount}\n\n⏰ Cron:\n• 08:00 Barron Dashboard\n• 09:00 各群早报\n• */30min Gap检测\n• */5min @mention升级+Bitable\n• 10-23h 每小时紧急追踪\n• 17:00 客户SLA预警\n• 18:00 各群晚报+日结\n• 03:00 学习+voice更新`;
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

            // "learn all" — history fetch → batch_learn → conversation learn → file learn
            if (isAll) {
              reply = `🌐 全量学习启动：获取历史记录 → 批量提炼 → 对话学习 → 文件学习...`;
              await send(receiveId, receiveIdType, reply);

              // Step 1: fetch 7 days of history from all groups
              const fetchChild = spawn('node', [path.join(__dirname,'fetch_history.js'), '--all', '--days', '7', '--no-process'], { cwd: __dirname });
              let fetchOut = '';
              fetchChild.stdout.on('data', d => fetchOut += d);
              await new Promise(r => fetchChild.on('close', r));
              const fetchGroups = (fetchOut.match(/Groups fetched: (\d+)/) || [])[1] || '?';
              const fetchMsgs = (fetchOut.match(/Total messages: (\d+)/) || [])[1] || '?';

              // Step 2: batch learn from history (dedup, only processes new days)
              const batchChild = spawn('node', [path.join(__dirname,'batch_learn.js')], { cwd: __dirname });
              let batchOut = '';
              batchChild.stdout.on('data', d => batchOut += d);
              await new Promise(r => batchChild.on('close', r));
              const batchDays = (batchOut.match(/Days digested: (\d+)/) || [])[1] || '0';
              const batchCost = (batchOut.match(/Cost: \$([0-9.]+)/) || [])[1] || '?';

              // Step 3: refresh chat list from Feishu API
              const tok = await getTenantToken();
              const chatsRes = await feishuApi('GET', '/im/v1/chats?page_size=100', null, tok);
              const liveChats = chatsRes.data?.items || [];
              if (!ops.chats) ops.chats = {};
              for (const c of liveChats) {
                const key = (c.name || c.chat_id.slice(-8)).replace(/[（）()【】\[\]\s]/g,'_').replace(/[^\w一-鿿_]/g,'').slice(0,30);
                ops.chats[key] = c.chat_id;
              }
              saveData(ops);

              // Step 4: run conversation + file learn scripts
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
              ).slice(-20).join('\n');
              reply = `🌐 全量学习完成\n\n📡 历史获取: ${fetchGroups} 群, ${fetchMsgs} 条消息\n🧠 批量提炼: ${batchDays} 天 (¥${batchCost})\n📋 ${liveChats.length} 个群组已扫描\n\n${summary}`;
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

          case 'BRAIN': {
            // "brain X" = show what bot knows about X
            const query = clean.replace(/^(brain|大脑|知道)\s*/i, '').trim();
            if (!query) {
              reply = `🧠 用法: "brain <topic>" — 显示我对该话题的所有知识\n\n例子:\n• brain mingyi\n• brain 母亲节\n• brain TCL`;
            } else {
              try {
                const r = await vault.retrieve(query, { maxResults: 5, maxChars: 4000 });
                if (!r.files.length) {
                  reply = `🤷 关于 "${query}"，记忆库里还没有相关知识。`;
                } else {
                  reply = `🧠 关于 "${query}"，我知道:\n\n📂 来源 (${r.semanticUsed ? '语义+关键词搜索' : '关键词搜索'}):\n${r.files.map((f,i)=>`${i+1}. ${f}`).join('\n')}\n\n${r.context.slice(0, 2000)}`;
                }
              } catch(e) { reply = `❌ ${e.message}`; }
            }
            break;
          }

          case 'SYNTH_PEOPLE': {
            reply = '🧠 启动人物档案合成...';
            await send(receiveId, receiveIdType, reply);
            const child = spawn('node', [path.join(__dirname, 'synthesize_people.js')], { cwd: __dirname });
            let out = '';
            child.stdout.on('data', d => out += d);
            await new Promise(r => child.on('close', r));
            const summary = out.split('\n').filter(l => l.includes('🧠') || l.includes('✅') || l.includes('💰') || l.includes('Cost')).slice(-15).join('\n');
            reply = `✅ 完成\n\n${summary}`;
            break;
          }

          case 'SCRAPE_HELP': {
            const scrapeHelperPath = path.join(__dirname, 'scrape_helper.js');
            const helperJs = fs.readFileSync(scrapeHelperPath, 'utf8');
            reply = `📜 历史抓取流程 (浏览器辅助方式)

由于飞书API只能看到机器人加入后的消息，要抓取历史数据请按以下步骤：

**步骤 1**: 在飞书网页版打开目标群聊
**步骤 2**: 按 F12 打开开发者控制台 → Console 标签
**步骤 3**: 粘贴以下代码并回车:

\`\`\`js
${helperJs.slice(0, 1500)}...
\`\`\`

(完整代码在 ~/Developer/claude-workflow-sync/feishu-bot/scrape_helper.js)

**步骤 4**: 用鼠标向上滚动消息区域 (触发懒加载)
每滚动几屏运行: \`window.__clawd.capture()\`

**步骤 5**: 完成后导出:
\`\`\`js
copy(JSON.stringify(window.__clawd.export()))
\`\`\`

**步骤 6**: 保存到文件 \`feishu-bot/history/<group>.json\`

**步骤 7**: 在 DM 里发送: \`import history <filename> <groupname>\`
例如: \`import history n2m_scrape.json N2M\``;
            break;
          }

          case 'IMPORT_HISTORY': {
            // "import history <file> <group>"
            const parts = clean.split(/\s+/);
            const file = parts[2] || parts[1];
            const group = parts[3] || parts[2] || 'Unknown';
            if (!file) {
              reply = `用法: import history <file.json> <group_name>\n\n例如: import history n2m_scrape.json N2M`;
              break;
            }
            reply = `📥 导入历史 ${file} 到 ${group}...`;
            await send(receiveId, receiveIdType, reply);

            const child = spawn('node', [path.join(__dirname, 'import_history.js'), file, group], { cwd: __dirname });
            let out = '';
            child.stdout.on('data', d => out += d);
            child.stderr.on('data', d => out += d);
            await new Promise(r => child.on('close', r));

            const summary = out.split('\n').filter(l => l.includes('📥') || l.includes('🧠') || l.includes('✅') || l.includes('📊') || l.includes('👥') || l.includes('💰')).join('\n');
            reply = `✅ 导入完成\n\n${summary}`;
            break;
          }

          case 'DECISIONS': {
            const child = spawn('node', [path.join(__dirname, 'decisions.js')], { cwd: __dirname });
            let out = '';
            child.stdout.on('data', d => out += d);
            await new Promise(r => child.on('close', r));
            const summary = out.split('\n').filter(l => l.includes('➕') || l.includes('🔍') || l.includes('💰') || l.includes('Added')).slice(-15).join('\n');
            reply = `🎯 决策日志已更新\n\n${summary}\n\n📂 ~/ObsidianVault/Clawdbot/00-Brain/Decisions.md`;
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

          // ── v7: Client SLA resolved ──────────────────────────────────────
          case 'CLIENT_RESOLVED': {
            const frag = clean.replace(/^(客户已确认|client confirmed)\s+/i, '').trim();
            const gk = resolveGroupKey(chatId);
            const entry = fac.resolveClientDependency(gk, frag);
            reply = entry
              ? `✅ 客户已确认: ${entry.item} (等了${Math.floor((Date.now() - new Date(entry.requestedAt).getTime()) / 86400000)}天)`
              : `❓ 未找到相关客户阻塞项: "${frag}"`;
            break;
          }

          // ── Facilitator commands (Req 1/6) ──────────────────────────────────
          case 'FAC_DONE': {
            const frag = clean.replace(/^(完成|done|✅)\s+/i, '').trim();
            const gk = resolveGroupKey(chatId);
            const task = fac.completeTask(gk, frag);
            reply = task
              ? `✅ 完成: ${task.title}${task.owner ? ` (@${task.owner})` : ''}`
              : `❓ 未找到任务: "${frag}"`;
            break;
          }

          case 'FAC_DEFER': {
            const parts = clean.replace(/^(延期|defer)\s+/i, '').split(/\s+/);
            const frag = parts[0];
            const reason = parts.slice(1).join(' ') || '未说明原因';
            const gk = resolveGroupKey(chatId);
            const task = fac.deferTask(gk, frag, reason);
            reply = task
              ? `⏸️ 延期: ${task.title}\n原因: ${reason}\n\n下次提醒时我会跟进`
              : `❓ 未找到任务: "${frag}"`;
            break;
          }

          case 'FAC_CANCEL': {
            const frag = clean.replace(/^(取消|cancel)\s+/i, '').trim();
            const gk = resolveGroupKey(chatId);
            const task = fac.completeTask(gk, frag); // reuse complete to remove
            if (task) { task.status = 'cancelled'; }
            reply = task ? `🗑️ 已取消: ${task.title}` : `❓ 未找到任务: "${frag}"`;
            break;
          }

          case 'FAC_GROUP_TASKS': {
            const gk = resolveGroupKey(chatId);
            const ctx = fac.getGroupContext(gk);
            const tasks = ctx.tasks;
            if (!tasks.length) {
              reply = `✅ ${ctx.name || gk} — 暂无待办任务`;
            } else {
              const now = new Date();
              const today = now.toISOString().slice(0, 10);
              const overdue = tasks.filter(t => t.deadline && t.deadline < today);
              const dueToday = tasks.filter(t => t.deadline === today);
              const upcoming = tasks.filter(t => !t.deadline || t.deadline > today);
              const noOwner = tasks.filter(t => !t.owner);

              reply = `📋 ${ctx.name || gk} 任务看板\n\n`;
              if (overdue.length) reply += `🔴 逾期 (${overdue.length}):\n${overdue.map(t => `• ${t.title} — @${t.owner||'❓'} | 截止 ${t.deadline}`).join('\n')}\n\n`;
              if (dueToday.length) reply += `🟡 今日到期 (${dueToday.length}):\n${dueToday.map(t => `• ${t.title} — @${t.owner||'❓'}`).join('\n')}\n\n`;
              if (upcoming.length) reply += `🟢 进行中 (${upcoming.length}):\n${upcoming.slice(0, 8).map(t => `• ${t.title} — @${t.owner||'❓'}${t.deadline ? ` | ${t.deadline}` : ' | ⚠️无截止日期'}`).join('\n')}\n\n`;
              if (noOwner.length) reply += `⚠️ ${noOwner.length} 个任务缺少责任人，请补充`;
            }
            break;
          }

          case 'FAC_OVERVIEW': {
            const state = fac.loadState();
            const groups = Object.keys(state.groups);
            if (!groups.length) {
              reply = '📊 暂无项目数据。加入群组后会自动开始追踪。';
            } else {
              reply = `📊 项目总览 | ${new Date().toLocaleDateString('zh-CN')}\n\n`;
              for (const gk of groups) {
                const ctx = fac.getGroupContext(gk);
                const open = ctx.tasks.filter(t => t.status !== 'done');
                const overdue = open.filter(t => t.deadline && t.deadline < new Date().toISOString().slice(0, 10));
                const mentions = ctx.mentions.length;
                reply += `📌 ${ctx.name || gk}: ${open.length}待办${overdue.length ? ` | 🔴${overdue.length}逾期` : ''}${mentions ? ` | ⏰${mentions}未回复` : ''}\n`;
              }
            }
            break;
          }

          case 'FAC_CHASE': {
            const gk = resolveGroupKey(chatId);
            const urgent = fac.getHourlyUrgentItems(gk);
            const mentions = fac.getPendingMentions(gk);
            if (!urgent.urgentCount && !mentions.length) {
              reply = `✅ ${gk} 过去1小时无紧急待跟进事项`;
            } else {
              reply = `🔔 ${gk} 待跟进\n\n`;
              if (mentions.length) {
                reply += `⏰ 未回复 @提醒 (${mentions.length}):\n`;
                mentions.forEach(m => {
                  const min = Math.floor((Date.now() - m.timestamp) / 60000);
                  reply += `• @${m.mentionedUser} — ${min}分钟未回复 (${m.mentionerName})\n`;
                });
                reply += '\n';
              }
              if (Object.keys(urgent.chaseTargets).length) {
                reply += `📢 被催促人员:\n`;
                for (const [person, count] of Object.entries(urgent.chaseTargets)) {
                  reply += `• @${person} — 被催 ${count} 次\n`;
                }
              }
            }
            break;
          }

          case 'DASHBOARD': {
            const dashboard = fac.buildBarronDashboard();
            reply = fac.formatBarronDashboard(dashboard, null);
            break;
          }

          case 'CLIENT_SLA': {
            const pending = fac.getPendingClientSLA();
            if (!pending.length) {
              reply = '✅ 暂无客户侧阻塞项';
            } else {
              reply = `🔶 等客户确认 (${pending.length}):\n\n`;
              pending.sort((a, b) => b.waitingDays - a.waitingDays).forEach(c => {
                const flag = c.waitingDays >= 5 ? '🔴' : c.waitingDays >= 3 ? '🟡' : '⚪';
                reply += `${flag} ${c.item} — 已等${c.waitingDays}天\n   来源: ${c.groupKey} | 提出人: ${c.requestedBy || '?'}\n`;
              });
              reply += '\n回复「客户已确认 <事项关键词>」标记完成';
            }
            break;
          }

          case 'PROJECT_FILES': {
            const q = clean.replace(/^(项目文件|project files)\s*/i, '').trim().toUpperCase() || 'TCL';
            const files = fac.getProjectFiles(q);
            if (!files.length) {
              reply = `📂 ${q} 暂无注册文件\n\n群内分享的文件链接会自动归档`;
            } else {
              reply = `📂 ${q} 项目文件 (${files.length}):\n\n`;
              files.forEach((f, i) => {
                reply += `${i + 1}. ${f.name}\n   📅 ${f.sharedAt} | 👤 ${f.sharedBy} | 来自 ${f.group}\n   🔗 ${f.url.slice(0, 60)}...\n`;
              });
            }
            break;
          }

          case 'UNANSWERED': {
            const gk = resolveGroupKey(chatId);
            const questions = fac.getUnansweredQuestions(gk, 480);
            if (!questions.length) {
              reply = `✅ ${gk} 过去8小时无未回答问题`;
            } else {
              reply = `❓ ${gk} 未回答问题 (${questions.length}):\n\n`;
              questions.slice(0, 10).forEach((q, i) => {
                reply += `${i + 1}. "${q.question.slice(0, 80)}" — ${q.asker} (${q.minutesAgo}分钟前)\n`;
              });
            }
            break;
          }

          case 'ADD_MILESTONE': {
            // 添加里程碑 TCL 母亲节促销 2026-05-11
            const parts = clean.replace(/^(添加里程碑|add milestone)\s*/i, '').split(/\s+/);
            const project = (parts[0] || '').toUpperCase();
            const date = parts[parts.length - 1];
            const title = parts.slice(1, -1).join(' ');
            if (!project || !title || !date || !/\d{4}-\d{2}-\d{2}/.test(date)) {
              reply = '用法: 添加里程碑 <项目> <标题> <YYYY-MM-DD>\n例: 添加里程碑 TCL 母亲节促销 2026-05-11';
            } else {
              const ms = fac.addMilestone(project, { title, date });
              reply = ms ? `🏗️ 里程碑已添加: ${title} — ${date} (${project})` : `❌ 项目 ${project} 不存在`;
            }
            break;
          }

          case 'MILESTONES': {
            const ms = fac.getUpcomingMilestones(30);
            if (!ms.length) {
              reply = '🏗️ 暂无近期里程碑\n\n添加: 添加里程碑 TCL 母亲节促销 2026-05-11';
            } else {
              reply = `🏗️ 近期里程碑:\n\n`;
              ms.forEach(m => {
                const flag = m.daysLeft <= 0 ? '🔴' : m.daysLeft <= 3 ? '🟡' : '🟢';
                reply += `${flag} ${m.title} — ${m.daysLeft <= 0 ? '已过期' : `T-${m.daysLeft}天`} (${m.project})\n`;
              });
            }
            break;
          }

          case 'SUGGEST_OWNERS': {
            // Per-group owner suggestion for the current group
            const soData = fac.formatOwnerSuggestionPost(groupKey, group.name || groupKey);
            if (!soData) {
              reply = '✅ 本群所有任务均已指定责任人';
            } else {
              try {
                await sendPostToChat(chatId, soData.title, soData.paragraphs);
                reply = '';
              } catch {
                const plain = soData.paragraphs.map(p => p.map(e => e.text).join('')).join('\n');
                reply = `${soData.title}\n\n${plain}`;
              }
            }
            break;
          }

          case 'GLOBAL_OWNERS': {
            // Cross-group owner report (DM-worthy output)
            const globalRows = fac.buildGlobalOwnerReport();
            if (!globalRows.length) {
              reply = '✅ 所有群组任务均已指定责任人';
              break;
            }
            const urgencyIcon = u => u === 'critical' ? '🔴' : u === 'urgent' ? '🟡' : '⚪';
            const confIcon = c => c === 'high' ? '✅' : c === 'medium' ? '🔶' : '❓';
            const title = `🧠 全局责任人推断 — ${globalRows.length} 项待认领`;
            const paragraphs = [];
            paragraphs.push([{ tag: 'text', text: `共 ${globalRows.length} 项任务缺少责任人，以下为推断结果：` }]);
            paragraphs.push([{ tag: 'text', text: '─────────────────────────────' }]);

            let currentGroup = null;
            for (const row of globalRows) {
              if (row.group !== currentGroup) {
                if (currentGroup) paragraphs.push([{ tag: 'text', text: '' }]);
                paragraphs.push([{ tag: 'text', text: `📌 ${row.group}`, style: { bold: true } }]);
                currentGroup = row.group;
              }
              const dl = row.deadline ? ` · ${row.deadline}` : '';
              const alt = row.alternatives.length ? `  备选: ${row.alternatives.join('/')}` : '';
              paragraphs.push([{
                tag: 'text',
                text: `${urgencyIcon(row.urgency)} ${row.title}${dl}\n    → ${row.suggested || '待认领'}  ${confIcon(row.confidence)}${alt}\n    ${row.reason}`,
              }]);
            }
            paragraphs.push([{ tag: 'text', text: '' }]);
            paragraphs.push([{ tag: 'text', text: '💡 如推断有误，@Clawdbot 指定：「任务名 由 XXX 负责」', style: { bold: true } }]);

            try {
              await sendPostToChat(chatId, title, paragraphs);
              reply = '';
            } catch {
              const plain = paragraphs.map(p => p.map(e => e.text).join('')).join('\n');
              reply = `${title}\n\n${plain}`;
            }
            break;
          }

          case 'PM_BRIEF': {
            const pmPost = fac.formatPMBriefPost();
            try {
              await sendPostToChat(chatId, pmPost.title, pmPost.paragraphs);
              reply = '';
            } catch {
              const plain = pmPost.paragraphs.map(p => p.map(e => e.text).join('')).join('\n');
              reply = `${pmPost.title}\n\n${plain}`;
            }
            break;
          }

          case 'PM_GROUP_DETAIL': {
            const groupArg = text.replace(/^(策略|pm)\s+/i, '').trim();
            let targetKey = null;
            for (const gk of Object.keys(fac.GROUP_PM_STRATEGY)) {
              if (gk.includes(groupArg) || gk.replace(/_/g, '').includes(groupArg.replace(/\s/g, ''))) {
                targetKey = gk;
                break;
              }
            }
            if (!targetKey) {
              reply = `未找到匹配群组「${groupArg}」。可用群组:\n${Object.keys(fac.GROUP_PM_STRATEGY).map(k => '  • ' + k).join('\n')}`;
              break;
            }
            const detail = fac.formatGroupPMDetail(targetKey);
            if (!detail) { reply = '该群暂无PM策略'; break; }
            try {
              await sendPostToChat(chatId, detail.title, detail.paragraphs);
              reply = '';
            } catch {
              const plain = detail.paragraphs.map(p => p.map(e => e.text).join('')).join('\n');
              reply = `${detail.title}\n\n${plain}`;
            }
            break;
          }

          case 'MEETING_REPORT': {
            reply = '📹 正在扫描最近会议...';
            await send(receiveId, receiveIdType, reply);
            try {
              const report = await mtg.scanAndReport(7);
              reply = report;
            } catch(e) { reply = `❌ 会议报告失败: ${e.message}`; }
            break;
          }

          case 'PERSON_QUERY': {
            // Extract person name from query
            const q = clean.replace(/^(谁做了|做了什么|who did|what did)\s*/i, '').replace(/(今天|本周|today|this week|做了什么)/gi, '').trim();
            const name = wt.resolveName(q) || q;
            const isWeek = /本周|this week|week/.test(clean);
            const data = isWeek ? wt.getPersonWeek(name) : wt.getPersonToday(name);
            reply = data ? data.summary : `❓ 未找到 "${q}" 的工作记录`;
            break;
          }

          case 'HELP': {
            reply = `🤖 Clawdbot v8 命令\n\n📊 数据查询\n• dashboard / 仪表盘 — Barron管理面板\n• status — 系统状态\n• 群任务 — 本群任务看板\n• 项目总览 — 所有群项目\n• 催进度 — 本群待跟进\n\n🧠 责任人推断\n• 责任人建议 — 本群缺责任人任务推断\n• 全局责任人 — 所有群组缺责任人推断\n\n🏗️ 项目管理\n• 里程碑 — 查看近期里程碑\n• 添加里程碑 <项目> <标题> <日期>\n• 客户阻塞 / 等客户 — 客户侧SLA\n• 项目文件 <项目> — 查看关键文件\n• 未回答 — 本群未回答问题\n\n✏️ 任务\n• 完成 <任务> — 标记完成\n• 延期 <任务> <原因>\n• 取消 <编号>\n\n👤 人员\n• 谁做了什么 / <名字>今天做了什么\n• 会议报告 — 最近会议\n\n⚙️ 控制\n• silent on/off — 切换静默\n• learn all — 全量学习\n• brain <话题> — 查询记忆`;
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

            // Retrieve from vault (hybrid: semantic + keyword)
            if (vault.shouldRetrieve(clean)) {
              try {
                const r = await vault.retrieve(clean, { maxResults: 3, maxChars: 2000 });
                if (r.context) ctxParts.push(r.context);
              } catch(e) { /* fall through */ }
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

    // Meeting ended — auto-generate report + extract action items
    'vc.meeting.meeting_ended_v1': async (event) => {
      console.log(`📹 Meeting ended event received`);
      try {
        const result = await mtg.handleMeetingEnded(event);
        const ops = loadData();
        if (ops.barronOpenId && result.report) {
          const msg = `📹 会议报告 | ${result.meetingData.topic}\n\n${result.report.slice(0, 1500)}`;
          await sendToDM(ops.barronOpenId, msg);
          console.log(`✅ Meeting report sent to Barron`);

          // v7: Extract action items from meeting report → create tasks
          try {
            const actionRes = await openai.chat.completions.create({
              model: 'gpt-4o-mini', max_tokens: 400,
              messages: [{ role: 'user', content: `${fac.TASK_EXTRACT_PROMPT}\n\nMeeting report:\n"${result.report}"` }]
            });
            const meetingTasks = JSON.parse(actionRes.choices[0].message.content.trim().replace(/```json|```/g, '').trim());
            if (Array.isArray(meetingTasks) && meetingTasks.length) {
              // Find which group this meeting belongs to
              const topic = result.meetingData.topic || '';
              let targetGroup = 'N2M'; // default
              for (const [key] of Object.entries(ops.chats || {})) {
                if (topic.includes(key) || key.includes(topic.slice(0, 10))) {
                  targetGroup = key;
                  break;
                }
              }
              for (const t of meetingTasks) {
                fac.createTask(targetGroup, {
                  title: t.title,
                  owner: t.owner,
                  deadline: t.deadline,
                  source: 'meeting',
                  urgency: t.urgency || 'normal',
                });
              }
              console.log(`📌 Extracted ${meetingTasks.length} action item(s) from meeting`);
            }
          } catch {}

          // Record to participants' work threads
          (result.meetingData.participants || []).forEach(p => {
            const name = wt.resolveName(p.id || p);
            if (name) {
              wt.recordMessage(name, {
                group: 'Meeting',
                text: `参加会议: ${result.meetingData.topic} (${Math.round(result.meetingData.duration/60)}min)`,
              });
            }
          });
        }
      } catch(e) {
        console.error('Meeting report error:', e.message);
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

        // Register with facilitator (Req 6: per-group isolation)
        fac.registerGroup(cleanKey, chatId, name);
        console.log(`✅ Registered as "${cleanKey}" (facilitator + ops)`);

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
// Scheduled jobs — Facilitation Engine v6
// ─────────────────────────────────────────────────────────────────────────────

// ═══ Req 2: Every 5 minutes — Real-time sync + @mention escalation check ═══
cron.schedule('*/5 * * * *', async () => {
  const ops = loadData();
  const state = fac.loadState();

  // Scan all active groups for pending @mention reminders
  for (const gk of Object.keys(state.groups)) {
    const group = state.groups[gk];
    if (!group.chatId) continue;

    const pending = fac.getMentionsNeedingReminder(gk);
    for (const m of pending) {
      const elapsed = Math.floor((Date.now() - m.timestamp) / 60000);
      if (m.remindersSent === 0) {
        await sendToChat(group.chatId,
          `⏰ @${m.mentionedUser} ${m.mentionerName}在${elapsed}分钟前提到了你：\n「${m.messageText.slice(0, 120)}」\n——回复「稍后」我帮你记着`
        );
        fac.bumpMentionReminder(gk, m.id);
        console.log(`[5min] ⏰ 30min reminder: ${m.mentionedUser} in ${gk}`);
      } else if (m.remindersSent === 1) {
        await sendToChat(group.chatId,
          `🔔 @${m.mentionedUser} 已过${elapsed}分钟未回复，请确认`
        );
        fac.bumpMentionReminder(gk, m.id);
        console.log(`[5min] 🔔 2h reminder: ${m.mentionedUser} in ${gk}`);
      } else if (m.remindersSent === 2 && ops.barronOpenId) {
        await sendToDM(ops.barronOpenId,
          `🚨 升级提醒 | ${group.name || gk}\n\n@${m.mentionedUser} 超过${elapsed}分钟未回复\n原消息: 「${m.messageText.slice(0, 120)}」\n发送人: ${m.mentionerName}`
        );
        fac.bumpMentionReminder(gk, m.id);
        console.log(`[5min] 🚨 4h escalation: ${m.mentionedUser} → Barron`);
      }
    }
  }

  // Req 5: Sync Bitable every 5 min, detect changes
  const conf = ops.bitables?.[0];
  if (conf) {
    try {
      const result = await readBitableTasks(conf.appToken, conf.tableId);
      if (result.tasks?.length) {
        const oldTasks = state.bitableTasks || [];
        const changes = fac.getBitableChanges(oldTasks, result.tasks);
        fac.recordBitableSync(result.tasks);

        if ((changes.completed.length || changes.overdueNew.length) && ops.barronOpenId) {
          const pendingWrites = [];
          const [title, paragraphs] = buildBitableChangePost(changes, pendingWrites);
          try {
            await sendPostToDM(ops.barronOpenId, title, paragraphs);
          } catch {
            const plain = paragraphs.map(p => p.map(e => e.text || '').join('')).join('\n');
            await sendToDM(ops.barronOpenId, `${title}\n\n${plain}`);
          }
          // Write unowned tasks back to Bitable with suggested owner
          for (const w of pendingWrites) {
            try { await writeBitableTask(w); }
            catch(e) { console.error('[Bitable write]', e.message); }
          }
          if (pendingWrites.length) {
            console.log(`[Bitable] Wrote ${pendingWrites.length} new tracking records`);
          }
        }
      }
    } catch(e) { /* silent fail for 5-min sync */ }
  }
}, { timezone: 'Asia/Shanghai' });

// ═══ Req 4: Every hour (China 8am-11pm) — Urgent chase summary ═══════════
cron.schedule('0 8-23 * * 1-6', async () => {
  const ops = loadData();
  const state = fac.loadState();

  for (const gk of Object.keys(state.groups)) {
    const group = state.groups[gk];
    if (!group.chatId) continue;

    const urgent = fac.getHourlyUrgentItems(gk);
    const mentions = fac.getPendingMentions(gk);

    // Only send hourly chase if there ARE urgent items
    if (urgent.urgentCount === 0 && mentions.length === 0) continue;

    const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const title = `🔔 整点跟进 · ${group.name || gk} · ${timeStr}`;
    const paragraphs = [];
    let hasSomething = false;

    if (mentions.length) {
      paragraphs.push(postHeader(`⏰ 待回复（${mentions.length}）`));
      mentions.forEach(m => {
        const min = Math.floor((Date.now() - m.timestamp) / 60000);
        paragraphs.push(postTask('▸', `${m.mentionedUser} — ${min} 分钟未回 · 来自 ${m.mentionerName}`));
      });
      paragraphs.push(postLine(''));
      hasSomething = true;
    }

    const chaseEntries = Object.entries(urgent.chaseTargets).filter(([_, c]) => c >= 2);
    if (chaseEntries.length) {
      paragraphs.push(postHeader('📢 被多次催促'));
      chaseEntries.forEach(([person, count]) => {
        paragraphs.push(postTask('▸', `${person} — 已被催 ${count} 次`));
      });
      paragraphs.push(postLine(''));
      hasSomething = true;
    }

    if (urgent.urgentCount) {
      paragraphs.push(postHeader(`🚨 紧急消息（${urgent.urgentCount}）`));
      urgent.urgentMessages.slice(0, 3).forEach(m => {
        paragraphs.push(postTask('▸', `${m.sender}: ${m.text.slice(0, 80)}`));
      });
      hasSomething = true;
    }

    if (hasSomething) {
      try {
        await sendPostToChat(group.chatId, title, paragraphs);
      } catch {
        const plain = paragraphs.map(p => p.map(e => e.text).join('')).join('\n');
        await sendToChat(group.chatId, `${title}\n\n${plain}`);
      }
      if (ops.barronOpenId) {
        const plain = paragraphs.map(p => p.map(e => e.text).join('')).join('\n');
        await sendToDM(ops.barronOpenId, `${title}\n\n${plain}`);
      }
      console.log(`[hourly] 🔔 Chase sent for ${gk}`);
    }
  }
}, { timezone: 'Asia/Shanghai' });

// ═══ v7: 08:00 — Barron Dashboard (DM only) ═══════════════════════════════
cron.schedule('0 8 * * *', async () => {
  console.log('[CRON] 08:00 — Barron Dashboard...');
  const ops = loadData();
  if (!ops.barronOpenId) return;

  try {
    const dashboard = fac.buildBarronDashboard();
    const msg = fac.formatBarronDashboard(dashboard, null);
    await sendToDM(ops.barronOpenId, msg);
    console.log('[08:00] 🎯 Dashboard sent to Barron');
  } catch(e) {
    console.error('[08:00] Dashboard error:', e.message);
  }
}, { timezone: 'Asia/Shanghai' });

// ═══ v7: Every 30min — Gap detection (unanswered questions alert) ══════════
cron.schedule('*/30 * * * *', async () => {
  const state = fac.loadState();
  const ops = loadData();

  for (const gk of Object.keys(state.groups)) {
    const group = state.groups[gk];
    if (!group.chatId) continue;

    const unanswered = fac.getUnansweredQuestions(gk, 60); // Last 60 min
    if (unanswered.length < 3) continue; // Only alert if 3+ accumulated

    let msg = `❓ 未回答提醒 | ${group.name || gk}\n\n以下问题暂无人回应:\n`;
    unanswered.slice(0, 5).forEach((q, i) => {
      msg += `${i + 1}. "${q.question.slice(0, 80)}" — ${q.asker} (${q.minutesAgo}分钟前)\n`;
    });
    msg += `\n请知道答案的同事回复`;

    await sendToChat(group.chatId, msg);
    console.log(`[30min] ❓ Gap alert: ${unanswered.length} unanswered in ${gk}`);
  }
}, { timezone: 'Asia/Shanghai' });

// ═══ v7: Client SLA daily check — 17:00 pre-EOD warning to Barron ══════════
cron.schedule('0 17 * * 1-6', async () => {
  const ops = loadData();
  if (!ops.barronOpenId) return;

  const pending = fac.getPendingClientSLA();
  if (!pending.length) return;

  const critical = pending.filter(c => c.waitingDays >= 3);
  if (!critical.length) return;

  let msg = `🔶 收工前提醒 | 客户侧阻塞\n\n`;
  critical.sort((a, b) => b.waitingDays - a.waitingDays).forEach(c => {
    const action = c.waitingDays >= 5 ? '🔴 建议直接call' : '🟡 建议催促';
    msg += `• ${c.item} — 已等${c.waitingDays}天 ${action}\n  来源: ${c.groupKey}\n`;
  });
  msg += `\n共 ${pending.length} 项等客户确认`;

  await sendToDM(ops.barronOpenId, msg);
  console.log(`[17:00] 🔶 Client SLA warning sent to Barron (${critical.length} critical)`);
}, { timezone: 'Asia/Shanghai' });

// ═══ Req 4 + Morning brief: 09:00 — Day start summary per group ════════════
cron.schedule('0 9 * * *', async () => {
  console.log('[CRON] 09:00 — Morning brief + stale check...');
  const ops = loadData();
  const state = fac.loadState();

  // Per-group morning briefs (NO workload info in group messages)
  for (const gk of Object.keys(state.groups)) {
    const group = state.groups[gk];
    if (!group.chatId || !group.tasks.length) continue;

    const data = fac.buildMorningBriefData(gk);
    if (data.totalOpen === 0) continue;

    const dateStr = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
    const title = `🌅 早报 · ${data.groupName} · ${dateStr}`;
    const paragraphs = [];

    // Stats summary line
    const parts = [];
    if (data.overdue.length)   parts.push(`🔴 逾期 ${data.overdue.length}`);
    if (data.dueToday.length)  parts.push(`🟡 今日到期 ${data.dueToday.length}`);
    if (data.noOwner.length)   parts.push(`⚠️ 缺责任人 ${data.noOwner.length}`);
    paragraphs.push([{ tag: 'text', text: parts.join('　|　') || `共 ${data.totalOpen} 项待办` }]);
    paragraphs.push(postLine('─────────────────────'));

    if (data.overdue.length) {
      paragraphs.push(postHeader('🔴 逾期任务（需立即处理）'));
      data.overdue.forEach(t => {
        const deadline = t.deadline ? ` · 截止 ${t.deadline}` : '';
        paragraphs.push(postTask('▸', `${t.title} — ${t.owner || '待认领'}${deadline}`));
      });
      paragraphs.push(postLine(''));
    }

    if (data.dueToday.length) {
      paragraphs.push(postHeader('🟡 今日到期'));
      data.dueToday.forEach(t => {
        paragraphs.push(postTask('▸', `${t.title} — ${t.owner || '待认领'}`));
      });
      paragraphs.push(postLine(''));
    }

    // v7: Client SLA per group (if any)
    const clientSLA = fac.getPendingClientSLA(gk);
    if (clientSLA.length) {
      paragraphs.push(postHeader('🔶 等客户回复'));
      clientSLA.forEach(c => {
        const flag = c.waitingDays >= 5 ? '🔴' : c.waitingDays >= 3 ? '🟡' : '⚪';
        paragraphs.push(postTask(flag, `${c.item} · 已等 ${c.waitingDays} 天`));
      });
      paragraphs.push(postLine(''));
    }

    if (data.noOwner.length) {
      paragraphs.push(postHeader('⚠️ 缺责任人（请认领）'));
      data.noOwner.forEach(t => paragraphs.push(postTask('▹', t.title)));
      paragraphs.push(postLine(''));
    }

    if (data.noDeadline.length) {
      paragraphs.push(postHeader('⚠️ 缺截止日期'));
      data.noDeadline.slice(0, 5).forEach(t => {
        paragraphs.push(postTask('▹', `${t.title} — ${t.owner || '待认领'}`));
      });
      paragraphs.push(postLine(''));
    }

    paragraphs.push([{ tag: 'text', text: `📋 共 ${data.totalOpen} 项待办　请相关同事确认今日重点 👇`, style: { bold: true } }]);

    // Append owner suggestions inline + @mention + write to Bitable
    if (data.noOwner.length) {
      paragraphs.push(postLine(''));
      paragraphs.push([{ tag: 'text', text: '─────────────────────' }]);
      paragraphs.push([{ tag: 'text', text: '🧠 责任人推断（AI）— 已写入 Bitable', style: { bold: true } }]);
      const confIcon = c => c === 'high' ? '✅' : c === 'medium' ? '🔶' : '❓';

      for (const t of data.noOwner) {
        const s = fac.suggestOwner(gk, t.title);
        const alt = s.alternatives.length ? `  备选: ${s.alternatives.slice(0,2).join('/')}` : '';
        const ownerOpenId = s.suggested ? nameToOpenId(s.suggested) : null;

        // Rich paragraph: text + @mention inline
        const para = [{ tag: 'text', text: `▸ ${shortTitle(t.title)}  →  ` }];
        if (ownerOpenId) {
          para.push({ tag: 'at', user_id: ownerOpenId });
          para.push({ tag: 'text', text: ` ${confIcon(s.confidence)}${alt}` });
        } else {
          para.push({ tag: 'text', text: `${s.suggested || '待认领'} ${confIcon(s.confidence)}${alt}` });
        }
        paragraphs.push(para);
        paragraphs.push([{ tag: 'text', text: `    ${s.reason}` }]);

        // Write to Bitable
        if (s.suggested) {
          writeBitableTask({
            title:        t.title,
            module:       '早报-待认领',
            priority:     t.urgency === 'critical' ? 'P0' : t.urgency === 'urgent' ? 'P1' : 'P2',
            dueMs:        t.deadline ? new Date(t.deadline).getTime() : null,
            ownerOpenIds: ownerOpenId ? [ownerOpenId] : [],
            status:       '待确认',
            note:         `AI推断: ${s.suggested}（${s.reason}）`,
            source:       `来源群组: ${data.groupName}`,
          }).catch(e => console.error('[Bitable write morning]', e.message));
        }
      }
      paragraphs.push([{ tag: 'text', text: '💡 确认分工：@Clawdbot「任务名 由 XXX 负责」' }]);
    }

    try {
      await sendPostToChat(group.chatId, title, paragraphs);
    } catch {
      // Fallback to plain text if post fails
      const plain = paragraphs.map(p => p.map(e => e.text).join('')).join('\n');
      await sendToChat(group.chatId, `${title}\n\n${plain}`);
    }
    console.log(`[09:00] 🌅 Morning brief sent: ${gk}`);
  }

  // Also run legacy checks
  await runBitableStaleCheck(false);
  await runN2MMonitoring(false);
}, { timezone: 'Asia/Shanghai' });

// Sunday 04:30 — Module B: Synthesize people profiles
cron.schedule('30 4 * * 0', async () => {
  console.log('[CRON] Sunday 04:30 — Synthesizing people profiles (Module B)...');
  try {
    const child = spawn('node', [path.join(__dirname, 'synthesize_people.js')], { cwd: __dirname });
    child.stdout.on('data', d => console.log('[people]', d.toString().trim()));
  } catch(e) { console.error('[CRON] People synth error:', e.message); }
}, { timezone: 'Asia/Shanghai' });

// Sunday 04:45 — Module C: Decision log update
cron.schedule('45 4 * * 0', async () => {
  console.log('[CRON] Sunday 04:45 — Decision log update (Module C)...');
  try {
    const child = spawn('node', [path.join(__dirname, 'decisions.js')], { cwd: __dirname });
    child.stdout.on('data', d => console.log('[decisions]', d.toString().trim()));
  } catch(e) { console.error('[CRON] Decisions error:', e.message); }
}, { timezone: 'Asia/Shanghai' });

// Daily 03:30 — Module E: Embeddings refresh (incremental, only re-embeds changed files)
cron.schedule('30 3 * * *', async () => {
  console.log('[CRON] 03:30 — Refreshing embeddings (Module E)...');
  try {
    const child = spawn('node', [path.join(__dirname, 'embeddings.js')], { cwd: __dirname });
    child.stdout.on('data', d => console.log('[embed]', d.toString().trim()));
  } catch(e) { console.error('[CRON] Embeddings error:', e.message); }
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

// Every Sunday at 02:00 AM — Fetch last 7 days of history from all groups
cron.schedule('0 2 * * 0', async () => {
  console.log('[CRON] Sunday 02:00 — Fetching group history (7 days)...');
  try {
    const child = spawn('node', [path.join(__dirname, 'fetch_history.js'), '--all', '--days', '7', '--no-process'], { cwd: __dirname });
    child.stdout.on('data', d => console.log('[fetch]', d.toString().trim()));
    child.stderr.on('data', d => console.error('[fetch err]', d.toString().trim()));
    await new Promise(r => child.on('close', r));
    console.log('[CRON] ✅ History fetch complete');
  } catch(e) { console.error('[CRON] History fetch error:', e.message); }
}, { timezone: 'Asia/Shanghai' });

// Every Sunday at 02:30 AM — Batch learn: process history into vault (dedup, low-cost)
cron.schedule('30 2 * * 0', async () => {
  console.log('[CRON] Sunday 02:30 — Batch learning from history into vault...');
  try {
    const child = spawn('node', [path.join(__dirname, 'batch_learn.js')], { cwd: __dirname });
    child.stdout.on('data', d => console.log('[batch_learn]', d.toString().trim()));
    child.stderr.on('data', d => console.error('[batch_learn err]', d.toString().trim()));
    await new Promise(r => child.on('close', r));
    console.log('[CRON] ✅ Batch learn complete');
  } catch(e) { console.error('[CRON] Batch learn error:', e.message); }
}, { timezone: 'Asia/Shanghai' });

// ═══ Evening review: 18:00 — Day end per-group review + DM Barron ═══════════
cron.schedule('0 18 * * *', async () => {
  console.log('[CRON] 18:00 — Evening review...');
  const ops = loadData();
  const barronId = ops.barronOpenId;
  const state = fac.loadState();

  let barronSummary = `🌆 日结总览 | ${new Date().toLocaleDateString('zh-CN')}\n\n`;

  // Per-group evening review (NO workload info in group messages)
  for (const gk of Object.keys(state.groups)) {
    const group = state.groups[gk];
    if (!group.chatId) continue;

    const data = fac.buildEveningReviewData(gk);
    const openTasks = group.tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled');
    if (!data.completed.length && !openTasks.length) continue;

    const notDone = openTasks.filter(t => data.stillOpen.find(s => s.id === t.id));
    const carriedOver = openTasks.filter(t => !data.stillOpen.find(s => s.id === t.id));

    const dateStr = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
    const title = `🌆 日结 · ${data.groupName} · ${dateStr}`;
    const paragraphs = [];

    // Stats summary line
    const statParts = [];
    if (data.completed.length) statParts.push(`✅ 完成 ${data.completed.length}`);
    if (notDone.length)        statParts.push(`🟡 未完成 ${notDone.length}`);
    if (carriedOver.length)    statParts.push(`📋 待跟进 ${carriedOver.length}`);
    paragraphs.push([{ tag: 'text', text: statParts.join('　|　') }]);
    paragraphs.push(postLine('─────────────────────'));

    if (data.completed.length) {
      paragraphs.push(postHeader('✅ 今日完成'));
      data.completed.forEach(t => paragraphs.push(postTask('▸', `${t.title} — ${t.owner || '?'}`)));
      paragraphs.push(postLine(''));
    }

    if (notDone.length) {
      paragraphs.push(postHeader('🟡 今日未完成'));
      notDone.forEach(t => {
        const defer = t.deferReason ? ` · 延期原因: ${t.deferReason}` : '';
        paragraphs.push(postTask('▸', `${t.title} — ${t.owner || '❓'}${defer}`));
      });
      paragraphs.push(postLine(''));
    }

    if (carriedOver.length) {
      paragraphs.push(postHeader('📋 继续跟进'));
      carriedOver.slice(0, 5).forEach(t => {
        const dl = t.deadline ? ` · 截止 ${t.deadline}` : '';
        paragraphs.push(postTask('▹', `${t.title} — ${t.owner || '❓'}${dl}`));
      });
      if (carriedOver.length > 5) {
        paragraphs.push(postLine(`　…另有 ${carriedOver.length - 5} 项`));
      }
      paragraphs.push(postLine(''));
    }

    paragraphs.push([{ tag: 'text', text: '辛苦了，明天见 🤝', style: { bold: true } }]);

    try {
      await sendPostToChat(group.chatId, title, paragraphs);
    } catch {
      const plain = paragraphs.map(p => p.map(e => e.text).join('')).join('\n');
      await sendToChat(group.chatId, `${title}\n\n${plain}`);
    }

    // Add to Barron's summary
    barronSummary += `📌 ${data.groupName}: ✅${data.completed.length} 🟡${notDone.length} 📋${carriedOver.length}\n`;
  }

  // v7: Workload analysis — Barron DM ONLY (never in group)
  const workload = fac.analyzeWorkload();
  const overloaded = Object.entries(workload.loadMap).filter(([_, v]) => v.level === 'overloaded');
  if (overloaded.length) {
    barronSummary += `\n👥 人员负荷预警:\n`;
    overloaded.forEach(([name, data]) => {
      barronSummary += `🔴 ${name}: ${data.tasks}项/${data.groups}群 (${data.groupList.join(', ')})\n`;
    });
  }

  // v7: Client SLA in Barron summary
  const clientSLA = fac.getPendingClientSLA();
  if (clientSLA.length) {
    const critical = clientSLA.filter(c => c.waitingDays >= 3);
    if (critical.length) {
      barronSummary += `\n🔶 客户侧阻塞 (${critical.length}项≥3天):\n`;
      critical.slice(0, 5).forEach(c => {
        barronSummary += `• ${c.item} — ${c.waitingDays}天 (${c.groupKey})\n`;
      });
    }
  }

  // Bitable summary for Barron
  const conf = ops.bitables?.[0];
  if (conf) {
    try {
      const result = await readBitableTasks(conf.appToken, conf.tableId);
      const incomplete = (result.tasks||[]).filter(t=>!['已完成','Done'].includes(t.status));
      const now = new Date();
      const overdue = incomplete.filter(t=>t.due&&new Date(t.due)<now);
      barronSummary += `\n📊 Bitable: ${incomplete.length}未完成, ${overdue.length}逾期`;
      if (overdue.length) {
        barronSummary += `\n${overdue.slice(0,5).map(t=>`  🔴 ${t.task} (@${t.owner||'?'})`).join('\n')}`;
      }
    } catch {}
  }

  if (barronId) {
    await sendToDM(barronId, barronSummary);
    console.log('[CRON] Evening review sent');
  }

  // Daily reset
  fac.resetDaily();
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

  // Initialize facilitator with existing groups
  const facState = fac.loadState();
  for (const [key, id] of Object.entries(ops.chats || {})) {
    fac.registerGroup(key, id, key);
  }
  const facGroups = Object.keys(facState.groups).length;

  console.log(`
╔══════════════════════════════════════════════╗
║   Clawdbot — Facilitation Engine v6          ║
║   App: ${APP_ID}        ║
║   Mode: WebSocket Long Connection            ║
╠══════════════════════════════════════════════╣
║ Bitable:  ${bitableStatus.padEnd(34)} ║
║ N2M Group:${n2mStatus.padEnd(34)} ║
║ Barron ID:${barronStatus.padEnd(34)} ║
║ Groups:   ${String(facGroups + ' tracked').padEnd(34)} ║
╠══════════════════════════════════════════════╣
║ Facilitation Engine:                         ║
║ ✅ R1: Accountability (owner+deadline)       ║
║ ✅ R2: @Mention 30min/2h/4h escalation      ║
║ ✅ R3: Smart intervention (no random chat)   ║
║ ✅ R4: Hourly urgent chase (10:00-21:00)     ║
║ ✅ R5: Bitable/file sync (5-min refresh)     ║
║ ✅ R6: Per-group task isolation              ║
║ ⏰ Cron: */5min sync | 09:00 AM | 18:00 PM  ║
║ ✅ R7: Per-person work threads              ║
║ ⏰ Hourly chase: 08-23 Mon-Sat (CST)       ║
╚══════════════════════════════════════════════╝
`);
}

startup();
