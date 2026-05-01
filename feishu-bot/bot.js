require('dotenv').config();
const lark = require('@larksuiteoapi/node-sdk');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!APP_ID || !APP_SECRET) {
  console.error('Missing FEISHU_APP_ID or FEISHU_APP_SECRET in .env');
  process.exit(1);
}
if (!ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY in .env');
  process.exit(1);
}

// ── Feishu client ────────────────────────────────────────────────────────────
const client = new lark.Client({ appId: APP_ID, appSecret: APP_SECRET });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

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

// ── Claude AI brain ──────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Clawdbot, an Operations Manager AI for Barron Zuo at GoGlobal Accelerator / Cell Digital Technology Inc.

Your responsibilities:
1. **Task Tracking** — When anyone mentions a task, deadline, action item, or commitment in any group chat, extract and track it.
2. **Timeline Management** — Monitor deadlines and send proactive reminders. Flag overdue tasks.
3. **Daily Ops Oversight** — Summarize what's happening across all group chats. Surface blockers and priorities.
4. **Meeting & Follow-up** — Log action items from discussions. Follow up on unresolved items.
5. **Smart Replies** — Answer operational questions using context from tracked tasks and timelines.

When responding:
- Be concise and direct. Barron is a busy founder.
- Use structured formats (bullet points, tables) for task lists and timelines.
- Tag urgency: 🔴 Overdue  🟡 Due Soon (< 48h)  🟢 On Track
- Proactively surface the most important 3 items when asked for an update.
- Support both English and Chinese naturally.

Current data context will be injected per request.

Commands you recognize:
- "show tasks" / "任务列表" → list all open tasks
- "show timeline" / "时间线" → show upcoming deadlines
- "add task [desc] by [date]" → create a task
- "done [task]" → mark task complete
- "daily briefing" / "日报" → today's priorities and blockers
- "clear done" → remove completed tasks`;

async function askClaude(userMessage, chatContext, data) {
  const contextBlock = `
Current Tasks (${data.tasks.filter(t => !t.done).length} open):
${data.tasks.filter(t => !t.done).map(t => `- [${t.id}] ${t.title} | Due: ${t.due || 'TBD'} | Group: ${t.chat}`).join('\n') || 'None'}

Recent Timeline Items:
${data.timeline.slice(-5).map(t => `- ${t.date}: ${t.event}`).join('\n') || 'None'}

Chat: ${chatContext.chatId} (${chatContext.chatType})
Sender: ${chatContext.sender}
`.trim();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `[Context]\n${contextBlock}\n\n[Message]\n${userMessage}`
      }
    ]
  });

  return response.content[0].text;
}

// ── Task extraction from messages ────────────────────────────────────────────
async function extractTasksFromMessage(text, chatId, sender) {
  const prompt = `Extract any tasks, action items, or deadlines from this message. Return JSON array or empty array [].
Format: [{"title": "...", "due": "YYYY-MM-DD or null", "assignee": "name or null"}]
Message: "${text}"
Only return the JSON array, nothing else.`;

  try {
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }]
    });
    const raw = resp.content[0].text.trim();
    const tasks = JSON.parse(raw);
    if (!Array.isArray(tasks) || tasks.length === 0) return [];
    return tasks.map(t => ({
      id: Date.now() + Math.random().toString(36).slice(2, 6),
      title: t.title,
      due: t.due,
      assignee: t.assignee,
      chat: chatId,
      createdBy: sender,
      createdAt: new Date().toISOString(),
      done: false
    }));
  } catch {
    return [];
  }
}

// ── Send message helper ───────────────────────────────────────────────────────
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

// ── Command parser ────────────────────────────────────────────────────────────
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
      const due = new Date(t.due);
      const diff = (due - now) / 36e5; // hours
      if (diff < 0) flag = '🔴';
      else if (diff < 48) flag = '🟡';
    }
    return `${flag} [${t.id.slice(-4)}] ${t.title}${t.due ? ` | 📅 ${t.due}` : ''}${t.assignee ? ` | 👤 ${t.assignee}` : ''}`;
  }).join('\n');
}

// ── Main event handler ────────────────────────────────────────────────────────
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
      const chatType = message.chat_type; // p2p or group
      const senderId = sender.sender_id?.open_id || '';
      const receiveIdType = chatType === 'p2p' ? 'open_id' : 'chat_id';
      const receiveId = chatType === 'p2p' ? senderId : chatId;

      // In group chats, only respond to @mentions or direct commands
      const isMentioned = text.includes('@') || text.toLowerCase().includes('clawdbot');
      const cleanText = text.replace(/@\w+/g, '').trim();
      if (chatType === 'group' && !isMentioned && parseCommand(cleanText) === 'AI') {
        // Silently extract tasks from all group messages
        const ops = loadData();
        const extracted = await extractTasksFromMessage(cleanText, chatId, senderId);
        if (extracted.length > 0) {
          ops.tasks.push(...extracted);
          saveData(ops);
          console.log(`[${new Date().toISOString()}] Auto-extracted ${extracted.length} task(s) from ${chatId}`);
        }
        return;
      }

      const ops = loadData();
      const cmd = parseCommand(cleanText);
      let reply = '';

      try {
        if (cmd === 'LIST_TASKS') {
          reply = `📋 *Task Board*\n\n${formatTaskList(ops.tasks)}`;

        } else if (cmd === 'TIMELINE') {
          const upcoming = ops.tasks
            .filter(t => !t.done && t.due)
            .sort((a, b) => new Date(a.due) - new Date(b.due))
            .slice(0, 10);
          reply = upcoming.length
            ? `📅 *Upcoming Deadlines*\n\n${upcoming.map(t => `• ${t.due} — ${t.title}`).join('\n')}`
            : '📅 No deadlines on the timeline.';

        } else if (cmd === 'DONE') {
          const idFrag = cleanText.replace(/^done\s+/i, '').replace(/^完成\s+/i, '').trim();
          const task = ops.tasks.find(t => t.id.endsWith(idFrag) || t.title.toLowerCase().includes(idFrag.toLowerCase()));
          if (task) {
            task.done = true;
            task.completedAt = new Date().toISOString();
            saveData(ops);
            reply = `✅ Marked done: *${task.title}*`;
          } else {
            reply = `❓ Task not found: "${idFrag}". Use "show tasks" to see IDs.`;
          }

        } else if (cmd === 'CLEAR_DONE') {
          const before = ops.tasks.length;
          ops.tasks = ops.tasks.filter(t => !t.done);
          saveData(ops);
          reply = `🧹 Cleared ${before - ops.tasks.length} completed task(s).`;

        } else if (cmd === 'BRIEFING') {
          const openTasks = ops.tasks.filter(t => !t.done);
          const now = new Date();
          const overdue = openTasks.filter(t => t.due && new Date(t.due) < now);
          const dueSoon = openTasks.filter(t => t.due && new Date(t.due) >= now && (new Date(t.due) - now) < 48 * 36e5);
          reply = `📊 *Daily Briefing — ${new Date().toLocaleDateString()}*\n\n🔴 Overdue: ${overdue.length}\n🟡 Due in 48h: ${dueSoon.length}\n🟢 On track: ${openTasks.length - overdue.length - dueSoon.length}\n\n` +
            (overdue.length ? `*Overdue:*\n${overdue.map(t => `• ${t.title} (${t.due})`).join('\n')}\n\n` : '') +
            (dueSoon.length ? `*Due Soon:*\n${dueSoon.map(t => `• ${t.title} (${t.due})`).join('\n')}` : '');

        } else {
          // AI-powered response
          reply = await askClaude(cleanText, { chatId, chatType, sender: senderId }, ops);

          // Also extract any tasks mentioned
          const extracted = await extractTasksFromMessage(cleanText, chatId, senderId);
          if (extracted.length > 0) {
            ops.tasks.push(...extracted);
            saveData(ops);
            reply += `\n\n📌 *Auto-tracked ${extracted.length} task(s) from this message.*`;
          }
        }

        if (reply) {
          await sendMessage(receiveId, receiveIdType, reply);
          console.log(`[${new Date().toISOString()}] [${chatType}] Replied to ${senderId}`);
        }

      } catch (err) {
        console.error('Handler error:', err.message);
        await sendMessage(receiveId, receiveIdType, '⚠️ Error processing request. Please try again.');
      }
    }
  })
});

console.log(`
╔════════════════════════════════════════╗
║   Clawdbot — Operations Manager        ║
║   App: ${APP_ID}  ║
║   Mode: WebSocket Long Connection      ║
║   AI: Claude Sonnet 4.6                ║
╚════════════════════════════════════════╝
`);
