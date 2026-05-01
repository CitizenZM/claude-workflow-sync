require('dotenv').config();
const lark = require('@larksuiteoapi/node-sdk');
const OpenAI = require('openai');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!APP_ID || !APP_SECRET || !OPENAI_API_KEY) {
  console.error('Missing env vars'); process.exit(1);
}

const client = new lark.Client({ appId: APP_ID, appSecret: APP_SECRET });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ── Persistent store ──────────────────────────────────────────────────────────
const DATA_FILE = path.join(__dirname, 'ops_data.json');
function loadData() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return { tasks: [], timeline: [], chats: {}, bitables: [], userTokens: {} }; }
}
function saveData(d) { fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2)); }

// ── Feishu API helper (raw HTTP for cross-tenant support) ──────────────────
async function feishuGet(path, token) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'open.feishu.cn',
      path: `/open-apis${path}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Bitable task reader ───────────────────────────────────────────────────────
async function readBitableTasks(appToken, tableId, userToken) {
  try {
    // Use user_access_token for cross-tenant Bitable access
    const res = await feishuGet(
      `/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=100`,
      userToken
    );
    if (res.code !== 0) return { error: res.msg, tasks: [] };

    const items = res.data?.items || [];
    const tasks = items.map(r => {
      const f = r.fields || {};
      // Handle different field name patterns
      const task = (f['具体任务'] || f['Task'] || f['任务'] || '').toString().trim();
      const status = (f['当前状态'] || f['Status'] || f['状态'] || '').toString().trim();
      // Handle user field (can be array of objects, single object, or string)
      const ownerRaw = f['Owner（Owner&执行人）'] || f['Owner'] || f['负责人'] || f['执行人'] || f['所有人'] || '';
      const owner = Array.isArray(ownerRaw)
        ? ownerRaw.map(u => (typeof u === 'object' ? u.name || u.en_name || JSON.stringify(u) : u)).join(', ')
        : (typeof ownerRaw === 'object' ? ownerRaw.name || ownerRaw.en_name || '' : String(ownerRaw)).trim();
      const due = f['承诺交付时间'] ? new Date(f['承诺交付时间']).toISOString().slice(0, 10) : null;
      const priority = (f['优先级'] || f['Priority'] || '').toString().trim();
      const module_ = (f['所属模块'] || f['Module'] || '').toString().trim();

      return { recordId: r.record_id, task, status, owner, due, priority, module: module_ };
    }).filter(t => t.task); // only rows with a task name

    return { tasks };
  } catch(e) {
    return { error: e.message, tasks: [] };
  }
}

// ── GPT brain ─────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Clawdbot, an AI Operations Manager for Barron Zuo at GoGlobal Accelerator.

Responsibilities:
1. Task Tracking — extract and track tasks, deadlines, action items
2. Bitable Monitoring — read TCL Weekly Execution Tracker and remind owners of incomplete tasks
3. Timeline Management — flag overdue items, send proactive reminders
4. Daily Briefings — surface top priorities and blockers
5. Group Oversight — monitor all group chats for action items

Commands:
- "show tasks" / "任务列表" → open task board
- "show timeline" / "时间线" → deadlines sorted by date
- "daily briefing" / "日报" → priorities summary
- "bitable status" → show tasks from TCL Tracker that are not completed
- "setup bitable" → get Bitable authorization link
- "done [task]" → mark complete
- "clear done" → remove completed

Response style: Concise, direct. Barron is busy. Support English and Chinese.`;

async function askGPT(msg, ctx, data, bitableTasks) {
  const open = data.tasks.filter(t => !t.done);
  const now = new Date();

  let bitableCtx = '';
  if (bitableTasks?.length > 0) {
    const incomplete = bitableTasks.filter(t => t.status !== '已完成' && t.status !== 'Done' && t.status !== 'Completed');
    bitableCtx = `\nTCL Tracker (${incomplete.length} incomplete):\n${incomplete.slice(0,10).map(t =>
      `- ${t.task} | Owner: ${t.owner} | Due: ${t.due || 'TBD'} | Status: ${t.status}`
    ).join('\n')}`;
  }

  const contextBlock = `Manual Tasks (${open.length} open): ${open.slice(0,5).map(t=>`[${t.id?.slice(-4)}] ${t.title}`).join(', ') || 'None'}${bitableCtx}
Chat: ${ctx.chatId} (${ctx.chatType})`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1024,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `[Context]\n${contextBlock}\n\n[Message]\n${msg}` }
    ]
  });
  return res.choices[0].message.content;
}

async function extractTasks(text, chatId, sender) {
  try {
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini', max_tokens: 256,
      messages: [{ role: 'user', content: `Extract tasks/action items from this message as JSON array or []. Format: [{"title":"...","due":"YYYY-MM-DD or null","assignee":"name or null"}]\nMessage: "${text}"\nReturn ONLY the JSON array.` }]
    });
    const raw = res.choices[0].message.content.trim().replace(/```json|```/g, '').trim();
    const tasks = JSON.parse(raw);
    if (!Array.isArray(tasks) || !tasks.length) return [];
    return tasks.map(t => ({
      id: `${Date.now()}${Math.random().toString(36).slice(2,5)}`,
      title: t.title, due: t.due || null, assignee: t.assignee || null,
      chat: chatId, createdBy: sender, createdAt: new Date().toISOString(), done: false
    }));
  } catch { return []; }
}

// ── Send message ──────────────────────────────────────────────────────────────
async function send(receiveId, type, text) {
  await client.im.message.create({
    params: { receive_id_type: type },
    data: { receive_id: receiveId, content: JSON.stringify({ text }), msg_type: 'text' }
  });
}

// ── Format tasks ──────────────────────────────────────────────────────────────
function formatTasks(tasks) {
  const open = tasks.filter(t => !t.done);
  if (!open.length) return '✅ No open tasks. All clear!';
  const now = new Date();
  return open.map(t => {
    let flag = '🟢';
    if (t.due) { const h = (new Date(t.due) - now) / 3.6e6; flag = h < 0 ? '🔴' : h < 48 ? '🟡' : '🟢'; }
    return `${flag} [${(t.id||'').slice(-4)}] ${t.title}${t.due ? ` | 📅 ${t.due}` : ''}${t.assignee ? ` | 👤 ${t.assignee}` : ''}`;
  }).join('\n');
}

// ── Bitable status formatter ──────────────────────────────────────────────────
function formatBitableStatus(tasks) {
  const incomplete = tasks.filter(t => t.status !== '已完成' && t.status !== 'Done');
  if (!incomplete.length) return '✅ All TCL Tracker tasks are completed!';
  const now = new Date();
  return `📊 TCL Tracker — ${incomplete.length} incomplete tasks:\n\n` +
    incomplete.slice(0, 15).map(t => {
      let flag = '⚪';
      if (t.due) { const h = (new Date(t.due) - now) / 3.6e6; flag = h < 0 ? '🔴' : h < 48 ? '🟡' : '🟢'; }
      return `${flag} ${t.task}\n   Owner: ${t.owner || 'Unassigned'} | Status: ${t.status || 'Unknown'}${t.due ? ` | Due: ${t.due}` : ''}`;
    }).join('\n');
}

// ── OAuth URL for Bitable authorization ───────────────────────────────────────
function getBitableAuthUrl() {
  const redirectUri = encodeURIComponent(`https://open.feishu.cn/connect/qrconnect/page/`);
  return `https://open.feishu.cn/open-apis/authen/v1/index?app_id=${APP_ID}&redirect_uri=${redirectUri}&state=bitable_setup\n\n⚠️ Note: Since Clawdbot is registered in a different org from the TCL Tracker, you'll need to authorize cross-tenant access. \n\nAlternatively, share the Bitable with an account in GoGlobal Accelerator org, or use the Feishu Bitable automation (already set up in the Base).`;
}

// ── Command parser ────────────────────────────────────────────────────────────
function parseCmd(text) {
  const t = text.trim().toLowerCase();
  if (t.includes('show tasks') || t.includes('任务列表')) return 'LIST';
  if (t.includes('show timeline') || t.includes('时间线')) return 'TIMELINE';
  if (t.includes('daily briefing') || t.includes('日报')) return 'BRIEFING';
  if (t.includes('bitable status') || t.includes('任务追踪') || t.includes('tracker')) return 'BITABLE';
  if (t.includes('setup bitable') || t.includes('授权')) return 'SETUP_BITABLE';
  if (t.startsWith('done ') || t.startsWith('完成 ')) return 'DONE';
  if (t === 'clear done' || t === '清除完成') return 'CLEAR';
  if (t.includes('join group') || t.includes('add to group') || t.includes('加入群')) return 'GROUP_HELP';
  return 'AI';
}

// ── WS bot ────────────────────────────────────────────────────────────────────
const wsClient = new lark.WSClient({ appId: APP_ID, appSecret: APP_SECRET, loggerLevel: lark.LoggerLevel.warn });

wsClient.start({
  eventDispatcher: new lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (data) => {
      const { message, sender } = data;
      if (message.message_type !== 'text') return;

      let text;
      try { text = JSON.parse(message.content).text || ''; } catch { return; }

      const chatId = message.chat_id;
      const chatType = message.chat_type;
      const senderId = sender.sender_id?.open_id || '';
      const receiveIdType = chatType === 'p2p' ? 'open_id' : 'chat_id';
      const receiveId = chatType === 'p2p' ? senderId : chatId;
      const isMentioned = text.includes('@') || text.toLowerCase().includes('clawdbot');
      const clean = text.replace(/@\S+/g, '').trim();
      const cmd = parseCmd(clean);

      // Group: silently extract tasks unless mentioned
      if (chatType === 'group' && !isMentioned && cmd === 'AI') {
        const ops = loadData();
        const ex = await extractTasks(clean, chatId, senderId);
        if (ex.length) { ops.tasks.push(...ex); saveData(ops); console.log(`📌 Auto-extracted ${ex.length} task(s) from ${chatId}`); }
        return;
      }

      const ops = loadData();
      let reply = '';

      try {
        switch (cmd) {
          case 'LIST':
            reply = `📋 Task Board\n\n${formatTasks(ops.tasks)}`;
            break;

          case 'TIMELINE': {
            const upcoming = ops.tasks.filter(t => !t.done && t.due).sort((a,b) => new Date(a.due)-new Date(b.due)).slice(0,10);
            reply = upcoming.length ? `📅 Upcoming Deadlines\n\n${upcoming.map(t=>`• ${t.due} — ${t.title}`).join('\n')}` : '📅 No upcoming deadlines.';
            break;
          }

          case 'BRIEFING': {
            const open = ops.tasks.filter(t=>!t.done);
            const now = new Date();
            const ov = open.filter(t=>t.due && new Date(t.due)<now);
            const soon = open.filter(t=>t.due && new Date(t.due)>=now && (new Date(t.due)-now)<48*3.6e6);
            reply = `📊 Daily Briefing — ${new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}\n\n🔴 Overdue: ${ov.length}  🟡 Due <48h: ${soon.length}  🟢 On Track: ${open.length-ov.length-soon.length}\nTotal: ${open.length}\n`
              + (ov.length ? `\nOverdue:\n${ov.map(t=>`• ${t.title} (${t.due})`).join('\n')}` : '')
              + (soon.length ? `\nDue Soon:\n${soon.map(t=>`• ${t.title} (${t.due})`).join('\n')}` : '')
              + (!ov.length && !soon.length ? '\n✅ All tasks on track!' : '');
            break;
          }

          case 'BITABLE': {
            const bitableConf = ops.bitables?.[0];
            if (!bitableConf) {
              reply = `📊 TCL Weekly Execution Tracker\n\nType "setup bitable" to connect.\nOr paste tasks here and I'll track them.`;
            } else {
              const tok = await getTenantToken();
              if (!tok) { reply = '❌ Could not get auth token. Please try again.'; break; }
              const result = await readBitableTasks(bitableConf.appToken, bitableConf.tableId, tok);
              if (result.error) reply = `❌ Bitable error: ${result.error}`;
              else reply = formatBitableStatus(result.tasks);
            }
            break;
          }

          case 'SETUP_BITABLE': {
            // Store Bitable config and provide instructions
            const appToken = 'ULgAbO391aTHXvsh2q5cECE1nwd';
            const tableId = 'tblbmakMHbl2ndk0';
            const ops2 = loadData();
            if (!ops2.bitables) ops2.bitables = [];

            // Try with tenant token first (works if same org)
            const tenantRes = await readBitableTasks(appToken, tableId, await getTenantToken());
            if (tenantRes.tasks?.length > 0) {
              // Same org access works!
              ops2.bitables = [{ appToken, tableId, name: 'TCL Weekly Execution Tracker' }];
              saveData(ops2);
              reply = `✅ Bitable connected! Found ${tenantRes.tasks.length} tasks.\n\nType "bitable status" to see incomplete tasks.\nI'll remind you daily about overdue items.`;
            } else {
              reply = `📋 TCL Weekly Execution Tracker Setup\n\nThe Bitable is in a different Feishu org (宇舟ION). To connect:\n\n1. In the Bitable, go to Automation (自动化)\n2. Create a new automation: "When record updated → Send Webhook notification"\n3. Send to: https://your-server/webhook\n\nOR: Share me a copy of the task list directly in this chat, and I'll track it for you!\n\nCurrent tasks I can track (from our conversation): Type "show tasks"`;
            }
            break;
          }

          case 'DONE': {
            const frag = clean.replace(/^done\s+/i,'').replace(/^完成\s+/i,'').trim();
            const t = ops.tasks.find(t => !t.done && (t.id?.slice(-4)===frag || t.title?.toLowerCase().includes(frag.toLowerCase())));
            if (t) { t.done = true; t.completedAt = new Date().toISOString(); saveData(ops); reply = `✅ Done: ${t.title}`; }
            else reply = `❓ Task not found: "${frag}". Type "show tasks" to see IDs.`;
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
            reply = `🤖 To add Clawdbot to a group chat:\n\n**Option 1 — Feishu Desktop App** (recommended):\n1. Open the group → Settings (⋯) → 群机器人\n2. Click + → Search "Clawdbot" → Add\n\n**Option 2 — Group Invite Link**:\n1. In the group, click ⋯ → 添加群成员 → 群链接\n2. Send me that link and I'll join\n\n**Option 3 — @mention me in the group**:\nType @Clawdbot in the group — Feishu may auto-prompt to add me.`;
            break;

          default: {
            let bitableTasks = [];
            const conf = ops.bitables?.[0];
            if (conf) {
              const tok = await getTenantToken();
              if (tok) {
                const r = await readBitableTasks(conf.appToken, conf.tableId, tok);
                bitableTasks = r.tasks || [];
              }
            }

            reply = await askGPT(clean, { chatId, chatType, sender: senderId }, ops, bitableTasks);
            const ex = await extractTasks(clean, chatId, senderId);
            if (ex.length) {
              ops.tasks.push(...ex);
              saveData(ops);
              reply += `\n\n📌 Auto-tracked ${ex.length} task(s).`;
            }
          }
        }

        if (reply) {
          await send(receiveId, receiveIdType, reply);
          console.log(`[${new Date().toISOString()}] [${chatType}] cmd=${cmd}`);
        }
      } catch(e) {
        console.error('Error:', e.message);
        try { await send(receiveId, receiveIdType, '⚠️ Error processing. Please try again.'); } catch {}
      }
    }
  })
});

// ── Get tenant token helper ───────────────────────────────────────────────────
let _cachedToken = '';
let _tokenExpiry = 0;

async function getTenantToken() {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;
  try {
    const body = JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET });
    const res = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'open.feishu.cn', path: '/open-apis/auth/v3/tenant_access_token/internal',
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => resolve(JSON.parse(d))); });
      req.on('error', reject);
      req.write(body); req.end();
    });
    _cachedToken = res.tenant_access_token || '';
    _tokenExpiry = Date.now() + (res.expire - 60) * 1000;
    return _cachedToken;
  } catch { return ''; }
}

// ── Startup: auto-setup Bitable if not configured ─────────────────────────────
async function autoSetupBitable() {
  const ops = loadData();
  if (ops.bitables?.length > 0) return;

  const appToken = 'ULgAbO391aTHXvsh2q5cECE1nwd';
  const tableId = 'tblbmakMHbl2ndk0';

  try {
    const tokenRes = await new Promise((resolve, reject) => {
      const body = JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET });
      const req = https.request({
        hostname: 'open.feishu.cn', path: '/open-apis/auth/v3/tenant_access_token/internal',
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': body.length }
      }, res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d)));
      });
      req.on('error', reject);
      req.write(body); req.end();
    });

    const token = tokenRes.tenant_access_token;
    if (!token) return;

    const result = await readBitableTasks(appToken, tableId, token);
    if (result.tasks?.length > 0) {
      ops.bitables = [{ appToken, tableId, name: 'TCL Weekly Execution Tracker' }];
      saveData(ops);
      console.log(`✅ Auto-connected Bitable: ${result.tasks.length} tasks found`);
    } else {
      console.log('ℹ️  Bitable requires cross-tenant auth (different org). Type "setup bitable" in DM to configure.');
    }
  } catch(e) {
    console.log('ℹ️  Bitable auto-setup skipped:', e.message);
  }
}

autoSetupBitable();

console.log(`
╔══════════════════════════════════════════╗
║   Clawdbot — Operations Manager v3       ║
║   Feishu: ${APP_ID}    ║
║   Mode:   WebSocket Long Connection      ║
║   AI:     GPT-4o + GPT-4o-mini           ║
║   Features: Tasks + Bitable + Reminders  ║
╚══════════════════════════════════════════╝
`);
