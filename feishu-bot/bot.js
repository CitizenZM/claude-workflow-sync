require('dotenv').config();
const lark = require('@larksuiteoapi/node-sdk');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!APP_ID || !APP_SECRET) {
  console.error('Missing FEISHU_APP_ID or FEISHU_APP_SECRET in .env');
  process.exit(1);
}
if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY in .env');
  process.exit(1);
}

// ── Clients ───────────────────────────────────────────────────────────────────
const client = new lark.Client({ appId: APP_ID, appSecret: APP_SECRET });
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// ── Persistent task + timeline store ─────────────────────────────────────────
const DATA_FILE = path.join(__dirname, 'ops_data.json');

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { tasks: [], timeline: [], chats: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Clawdbot, an Operations Manager AI for Barron Zuo at GoGlobal Accelerator / Cell Digital Technology Inc.

Your responsibilities:
1. Task Tracking — Extract and track tasks, deadlines, action items from group chats.
2. Timeline Management — Monitor deadlines, flag overdue items, send reminders.
3. Daily Ops Oversight — Summarize activity, surface blockers and top priorities.
4. Meeting Follow-up — Log action items from discussions, follow up on unresolved items.
5. Smart Replies — Answer operational questions using tracked task context.

Response style:
- Concise and direct. Barron is a busy founder.
- Use bullet points and tables for lists.
- Tag urgency: 🔴 Overdue  🟡 Due Soon (<48h)  🟢 On Track
- Surface top 3 priorities when asked for updates.
- Support English and Chinese naturally.

Commands you recognize:
- "show tasks" / "任务列表" → list all open tasks
- "show timeline" / "时间线" → upcoming deadlines sorted by date
- "daily briefing" / "日报" → today's priorities and blockers summary
- "done [task id or name]" / "完成 [任务]" → mark task complete
- "clear done" / "清除完成" → remove all completed tasks
- "add task [desc] by [date]" → create a task manually`;

// ── OpenAI helpers ────────────────────────────────────────────────────────────
async function askGPT(userMessage, chatContext, data) {
  const contextBlock = `Current Tasks (${data.tasks.filter(t => !t.done).length} open):
${data.tasks.filter(t => !t.done).map(t => `- [${t.id.slice(-4)}] ${t.title} | Due: ${t.due || 'TBD'} | Group: ${t.chat}`).join('\n') || 'None'}

Recent Timeline:
${data.timeline.slice(-5).map(t => `- ${t.date}: ${t.event}`).join('\n') || 'None'}

Chat: ${chatContext.chatId} (${chatContext.chatType}) | Sender: ${chatContext.sender}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1024,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `[Context]\n${contextBlock}\n\n[Message]\n${userMessage}` }
    ]
  });

  return response.choices[0].message.content;
}

async function extractTasksFromMessage(text, chatId, sender) {
  const prompt = `Extract any tasks, action items, or deadlines from this message. Return a JSON array or [].
Format: [{"title": "...", "due": "YYYY-MM-DD or null", "assignee": "name or null"}]
Message: "${text}"
Return ONLY the JSON array, nothing else.`;

  try {
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }]
    });
    const raw = resp.choices[0].message.content.trim().replace(/^```json|```$/g, '').trim();
    const tasks = JSON.parse(raw);
    if (!Array.isArray(tasks) || tasks.length === 0) return [];
    return tasks.map(t => ({
      id: `${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      title: t.title,
      due: t.due || null,
      assignee: t.assignee || null,
      chat: chatId,
      createdBy: sender,
      createdAt: new Date().toISOString(),
      done: false
    }));
  } catch {
    return [];
  }
}

// ── Send message ──────────────────────────────────────────────────────────────
async function sendMessage(receiveId, receiveIdType, text) {
  await client.im.message.create({
    params: { receive_id_type: receiveIdType },
    data: {
      receive_id: receiveId,
      content: JSON.stringify({ text }),
      msg_type: 'text'
    }
  });
}

// ── Command detection ─────────────────────────────────────────────────────────
function parseCommand(text) {
  const t = text.trim().toLowerCase();
  if (t.includes('show tasks') || t.includes('任务列表')) return 'LIST_TASKS';
  if (t.includes('show timeline') || t.includes('时间线')) return 'TIMELINE';
  if (t.includes('daily briefing') || t.includes('日报')) return 'BRIEFING';
  if (t.startsWith('done ') || t.startsWith('完成 ')) return 'DONE';
  if (t === 'clear done' || t === '清除完成') return 'CLEAR_DONE';
  return 'AI';
}

function formatTaskList(tasks) {
  const open = tasks.filter(t => !t.done);
  if (open.length === 0) return '✅ No open tasks. All clear!';
  const now = new Date();
  return open.map(t => {
    let flag = '🟢';
    if (t.due) {
      const diffHours = (new Date(t.due) - now) / 36e5;
      if (diffHours < 0) flag = '🔴';
      else if (diffHours < 48) flag = '🟡';
    }
    return `${flag} [${t.id.slice(-4)}] ${t.title}${t.due ? ` | 📅 ${t.due}` : ''}${t.assignee ? ` | 👤 ${t.assignee}` : ''}`;
  }).join('\n');
}

// ── WebSocket event handler ───────────────────────────────────────────────────
const wsClient = new lark.WSClient({
  appId: APP_ID,
  appSecret: APP_SECRET,
  loggerLevel: lark.LoggerLevel.warn
});

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
      const cleanText = text.replace(/@\S+/g, '').trim();

      // Group chat: silently extract tasks from all messages; only reply when mentioned
      if (chatType === 'group' && !isMentioned && parseCommand(cleanText) === 'AI') {
        const ops = loadData();
        const extracted = await extractTasksFromMessage(cleanText, chatId, senderId);
        if (extracted.length > 0) {
          ops.tasks.push(...extracted);
          saveData(ops);
          console.log(`[${new Date().toISOString()}] 📌 Auto-extracted ${extracted.length} task(s) from group ${chatId}`);
        }
        return;
      }

      const ops = loadData();
      const cmd = parseCommand(cleanText);
      let reply = '';

      try {
        switch (cmd) {
          case 'LIST_TASKS':
            reply = `📋 Task Board\n\n${formatTaskList(ops.tasks)}`;
            break;

          case 'TIMELINE': {
            const upcoming = ops.tasks
              .filter(t => !t.done && t.due)
              .sort((a, b) => new Date(a.due) - new Date(b.due))
              .slice(0, 10);
            reply = upcoming.length
              ? `📅 Upcoming Deadlines\n\n${upcoming.map(t => `• ${t.due} — ${t.title}`).join('\n')}`
              : '📅 No upcoming deadlines tracked.';
            break;
          }

          case 'BRIEFING': {
            const open = ops.tasks.filter(t => !t.done);
            const now = new Date();
            const overdue = open.filter(t => t.due && new Date(t.due) < now);
            const dueSoon = open.filter(t => t.due && new Date(t.due) >= now && (new Date(t.due) - now) < 48 * 36e5);
            const onTrack = open.length - overdue.length - dueSoon.length;
            reply = `📊 Daily Briefing — ${new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}\n\n` +
              `🔴 Overdue: ${overdue.length}   🟡 Due <48h: ${dueSoon.length}   🟢 On Track: ${onTrack}\n` +
              `Total open: ${open.length}\n` +
              (overdue.length ? `\nOverdue:\n${overdue.map(t => `• ${t.title} (${t.due})`).join('\n')}` : '') +
              (dueSoon.length ? `\nDue Soon:\n${dueSoon.map(t => `• ${t.title} (${t.due})`).join('\n')}` : '') +
              (!overdue.length && !dueSoon.length ? '\n✅ All tasks on track!' : '');
            break;
          }

          case 'DONE': {
            const fragment = cleanText.replace(/^done\s+/i, '').replace(/^完成\s+/i, '').trim();
            const task = ops.tasks.find(t =>
              (!t.done) && (t.id.slice(-4) === fragment || t.title.toLowerCase().includes(fragment.toLowerCase()))
            );
            if (task) {
              task.done = true;
              task.completedAt = new Date().toISOString();
              saveData(ops);
              reply = `✅ Done: ${task.title}`;
            } else {
              reply = `❓ Task not found: "${fragment}"\nTry "show tasks" to see task IDs.`;
            }
            break;
          }

          case 'CLEAR_DONE': {
            const before = ops.tasks.length;
            ops.tasks = ops.tasks.filter(t => !t.done);
            saveData(ops);
            reply = `🧹 Cleared ${before - ops.tasks.length} completed task(s).`;
            break;
          }

          default: {
            // GPT-4o handles all other queries
            reply = await askGPT(cleanText, { chatId, chatType, sender: senderId }, ops);
            // Also auto-extract tasks from the message
            const extracted = await extractTasksFromMessage(cleanText, chatId, senderId);
            if (extracted.length > 0) {
              ops.tasks.push(...extracted);
              saveData(ops);
              reply += `\n\n📌 Auto-tracked ${extracted.length} task(s).`;
            }
            break;
          }
        }

        if (reply) {
          await sendMessage(receiveId, receiveIdType, reply);
          console.log(`[${new Date().toISOString()}] [${chatType}] ✉️  Replied | cmd=${cmd}`);
        }

      } catch (err) {
        console.error('Handler error:', err.message);
        try {
          await sendMessage(receiveId, receiveIdType, '⚠️ Something went wrong. Please try again.');
        } catch {}
      }
    }
  })
});

console.log(`
╔══════════════════════════════════════════╗
║   Clawdbot — Operations Manager v2       ║
║   Feishu: ${APP_ID}    ║
║   Mode:   WebSocket Long Connection      ║
║   AI:     GPT-4o + GPT-4o-mini           ║
╚══════════════════════════════════════════╝
`);
