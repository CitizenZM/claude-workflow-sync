// ─────────────────────────────────────────────────────────────────────────────
// learn.js — Learning Pipeline
// Processes group conversations into Obsidian vault notes
// Uses tiered model strategy: gpt-4o-mini for extraction, gpt-4o for synthesis
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const OpenAI = require('openai');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const VAULT = process.env.VAULT_PATH || path.join(os.homedir(), 'ObsidianVault/Clawdbot');
const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STATS = { tokensIn: 0, tokensOut: 0, calls: 0, costUSD: 0 };

function trackCost(model, usage) {
  if (!usage) return;
  const rates = {
    'gpt-4o-mini': { in: 0.15, out: 0.60 },
    'gpt-4o': { in: 2.50, out: 10.00 }
  };
  const r = rates[model] || rates['gpt-4o-mini'];
  STATS.tokensIn += usage.prompt_tokens;
  STATS.tokensOut += usage.completion_tokens;
  STATS.costUSD += (usage.prompt_tokens / 1e6) * r.in + (usage.completion_tokens / 1e6) * r.out;
  STATS.calls++;
}

// ── Token-saving local filter ─────────────────────────────────────────────────
const NOISE_PATTERNS = [
  /^(好的|ok|okay|收到|了解|明白|嗯|哦|阿|啊)$/i,
  /^[\u{1F300}-\u{1F9FF}\s]+$/u,  // emoji-only
  /^(\.|。|！|!|\?|？|~|～)+$/,
];

function isNoise(text) {
  if (!text || text.length < 4) return true;
  if (text.length > 2000) return true; // skip very long (likely auto-generated)
  if (text.startsWith('http') && !text.includes(' ')) return true; // bare link
  for (const p of NOISE_PATTERNS) if (p.test(text.trim())) return true;
  return false;
}

// ── Feishu API ────────────────────────────────────────────────────────────────
let _tok = '', _exp = 0;
async function getToken() {
  if (_tok && Date.now() < _exp) return _tok;
  const body = JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET });
  const r = await new Promise((res, rej) => {
    const req = https.request({ hostname:'open.feishu.cn', path:'/open-apis/auth/v3/tenant_access_token/internal',
      method:'POST', headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)} },
      resp => { let d=''; resp.on('data',c=>d+=c); resp.on('end',()=>res(JSON.parse(d))); });
    req.on('error',rej); req.write(body); req.end();
  });
  _tok = r.tenant_access_token;
  _exp = Date.now() + (r.expire - 60) * 1000;
  return _tok;
}

async function fetchMessages(chatId, sinceHours = 24) {
  const cutoffTs = Date.now() - sinceHours * 3600 * 1000;
  const tok = await getToken();
  // No start_time param (causes validation error); fetch latest 100 then filter client-side
  const all = [];
  let pageToken = '';
  for (let pageCount = 0; pageCount < 5; pageCount++) {
    const url = `/im/v1/messages?container_id_type=chat&container_id=${chatId}&page_size=50&sort_type=ByCreateTimeDesc${pageToken ? `&page_token=${pageToken}` : ''}`;
    const res = await new Promise((res, rej) => {
      https.get({ hostname:'open.feishu.cn', path:`/open-apis${url}`, headers:{Authorization:`Bearer ${tok}`}},
        r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(JSON.parse(d))); }).on('error',rej);
    });
    if (res.code !== 0) return res;
    const items = res.data?.items || [];
    let stop = false;
    for (const m of items) {
      const ts = parseInt(m.create_time);
      if (ts < cutoffTs) { stop = true; break; }
      all.push(m);
    }
    if (stop || !res.data?.has_more) break;
    pageToken = res.data.page_token;
    if (!pageToken) break;
  }
  return { code: 0, msg: 'success', data: { items: all } };
}

// ── Parse messages into clean text + sender info ──────────────────────────────
function parseMessages(items) {
  return items.map(m => {
    let text = '';
    try { text = JSON.parse(m.body?.content || '{}').text || ''; } catch {}
    return {
      ts: parseInt(m.create_time) || 0,
      sender: m.sender?.id || m.sender?.sender_id || 'unknown',
      text: text.replace(/<at[^>]*>([^<]*)<\/at>/g, '@$1').trim(),
      msgType: m.body?.content_type || m.message_type || 'text'
    };
  }).filter(m => m.text && !isNoise(m.text));
}

// ── Tier 1: Extract entities (cheap) ──────────────────────────────────────────
async function extractEntities(messages, groupName) {
  const conversation = messages.map(m =>
    `[${new Date(m.ts*1000).toLocaleString('zh-CN')}] ${m.sender.slice(-6)}: ${m.text}`
  ).join('\n').slice(0, 8000); // cap at 8KB

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 1200,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: `From this ${groupName} group conversation, extract structured data. Return JSON only:
{
  "decisions": [{"decision":"...", "by":"sender_id_last6", "ts":"HH:MM"}],
  "tasks": [{"task":"...", "owner":"sender_id_or_name", "due":"YYYY-MM-DD or null"}],
  "questions_unanswered": [{"q":"verbatim question", "by":"sender", "ts":"HH:MM"}],
  "files_shared": [{"title":"...", "url":"...", "by":"sender"}],
  "key_topics": ["topic1", "topic2"],
  "people_mentioned": ["name1", "name2"],
  "blockers": ["..."]
}

Conversation:
${conversation}`
    }]
  });
  trackCost('gpt-4o-mini', res.usage);
  try { return JSON.parse(res.choices[0].message.content); }
  catch { return { decisions:[], tasks:[], questions_unanswered:[], files_shared:[], key_topics:[], people_mentioned:[], blockers:[] }; }
}

// ── Tier 2: Build daily digest markdown ───────────────────────────────────────
function buildDigestMarkdown(date, groupName, chatId, messages, entities) {
  return `---
date: ${date}
group: ${groupName}
group_chat_id: ${chatId}
msg_count: ${messages.length}
processed_at: ${new Date().toISOString()}
tags: [digest, conversation, ${groupName.toLowerCase()}]
---

# ${date} — ${groupName}

## 📊 Overview
- Total messages: ${messages.length}
- Active senders: ${[...new Set(messages.map(m=>m.sender))].length}
- Topics: ${(entities.key_topics||[]).join(', ') || '_none_'}

## 🎯 Decisions Made
${(entities.decisions||[]).length ? entities.decisions.map(d => `- **${d.decision}** — by \`${d.by}\` at ${d.ts}`).join('\n') : '_none_'}

## 📋 Tasks
${(entities.tasks||[]).length ? entities.tasks.map(t => `- [ ] ${t.task}${t.owner?` — [[${t.owner}]]`:''}${t.due?` — due ${t.due}`:''}`).join('\n') : '_none_'}

## ❓ Unanswered Questions
${(entities.questions_unanswered||[]).length ? entities.questions_unanswered.map(q => `- "${q.q}" — \`${q.by}\` @ ${q.ts}`).join('\n') : '_none_'}

## 📁 Files Shared
${(entities.files_shared||[]).length ? entities.files_shared.map(f => `- [${f.title}](${f.url}) — by \`${f.by}\``).join('\n') : '_none_'}

## 👥 People Mentioned
${(entities.people_mentioned||[]).map(p => `[[${p}]]`).join(', ') || '_none_'}

## 🚧 Blockers
${(entities.blockers||[]).length ? entities.blockers.map(b => `- ${b}`).join('\n') : '_none_'}
`;
}

// ── Update People profiles ────────────────────────────────────────────────────
function updatePersonFile(senderId, msgs, vaultPath) {
  const peopleDir = path.join(vaultPath, '02-People');
  if (!fs.existsSync(peopleDir)) fs.mkdirSync(peopleDir, { recursive: true });
  const safeName = senderId.slice(-12);
  const file = path.join(peopleDir, `${safeName}.md`);

  let existing = '';
  let sampleCount = 0;
  if (fs.existsSync(file)) {
    existing = fs.readFileSync(file, 'utf8');
    const m = existing.match(/sample_count:\s*(\d+)/);
    sampleCount = m ? parseInt(m[1]) : 0;
  }

  const newSamples = msgs.slice(0, 5).map(m => `> ${m.text.slice(0,200)}`).join('\n');
  const totalSamples = sampleCount + msgs.length;

  const content = existing
    ? existing.replace(/sample_count:\s*\d+/, `sample_count: ${totalSamples}`)
              .replace(/last_seen:\s*[^\n]+/, `last_seen: ${new Date().toISOString().slice(0,10)}`)
              + `\n\n## Recent samples (${new Date().toISOString().slice(0,10)})\n${newSamples}\n`
    : `---
name: ${safeName}
feishu_open_id: ${senderId}
role: _to be inferred_
org: external
last_seen: ${new Date().toISOString().slice(0,10)}
sample_count: ${msgs.length}
tags: [person]
---

# ${safeName}

## Recent samples
${newSamples}
`;

  fs.writeFileSync(file, content);
}

// ── Main learn function ──────────────────────────────────────────────────────
async function learnFromGroup(groupName, chatId, sinceHours = 24) {
  console.log(`\n🧠 Learning from ${groupName} (last ${sinceHours}h)...`);

  const res = await fetchMessages(chatId, sinceHours);
  if (res.code !== 0) {
    console.log(`  ⚠️ Cannot fetch ${groupName}: ${res.msg} (code: ${res.code})`);
    return null;
  }

  const raw = res.data?.items || [];
  const cleaned = parseMessages(raw);
  console.log(`  📥 ${raw.length} raw → ${cleaned.length} after noise filter`);

  if (cleaned.length === 0) return null;

  // Extract entities (cheap mini call)
  const entities = await extractEntities(cleaned, groupName);
  console.log(`  📊 Decisions: ${entities.decisions?.length || 0}, Tasks: ${entities.tasks?.length || 0}, Questions: ${entities.questions_unanswered?.length || 0}`);

  // Write daily digest
  const date = new Date().toISOString().slice(0,10);
  const digestDir = path.join(VAULT, '05-Conversations');
  if (!fs.existsSync(digestDir)) fs.mkdirSync(digestDir, { recursive: true });
  const digestPath = path.join(digestDir, `${date}-${groupName}.md`);
  fs.writeFileSync(digestPath, buildDigestMarkdown(date, groupName, chatId, cleaned, entities));
  console.log(`  ✅ Wrote ${digestPath.replace(VAULT,'')}`);

  // Update people profiles (group by sender)
  const bySender = {};
  cleaned.forEach(m => { (bySender[m.sender] ||= []).push(m); });
  for (const [sender, msgs] of Object.entries(bySender)) {
    if (msgs.length >= 2) updatePersonFile(sender, msgs, VAULT);
  }

  return { entities, msgCount: cleaned.length };
}

// ── CLI runner ────────────────────────────────────────────────────────────────
async function main() {
  console.log('🤖 Clawdbot Learning Pipeline');
  console.log(`📂 Vault: ${VAULT}\n`);

  const opsPath = path.join(__dirname, 'ops_data.json');
  const ops = JSON.parse(fs.readFileSync(opsPath));
  const groups = ops.chats || {};

  if (!Object.keys(groups).length) {
    console.log('No groups configured. Add bot to groups first.');
    return;
  }

  const sinceHours = parseInt(process.argv[2]) || 24;
  console.log(`Window: last ${sinceHours} hours\n`);

  for (const [name, chatId] of Object.entries(groups)) {
    await learnFromGroup(name, chatId, sinceHours);
  }

  console.log('\n💰 Cost summary:');
  console.log(`  Calls: ${STATS.calls}`);
  console.log(`  Tokens in/out: ${STATS.tokensIn}/${STATS.tokensOut}`);
  console.log(`  Cost: $${STATS.costUSD.toFixed(4)}`);

  // Append to a learning log
  const logPath = path.join(VAULT, '00-Brain', 'Learning-Log.md');
  const logEntry = `\n## ${new Date().toISOString()}\n- Groups processed: ${Object.keys(groups).length}\n- Calls: ${STATS.calls}\n- Cost: $${STATS.costUSD.toFixed(4)}\n`;
  fs.appendFileSync(logPath, logEntry);
}

if (require.main === module) {
  main().catch(e => { console.error('❌', e.message); process.exit(1); });
}

module.exports = { learnFromGroup, STATS, VAULT };
