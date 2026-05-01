// import_history.js — Process scraped chat history into vault
// Usage: node import_history.js <history.json> <group_name>

require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');

const VAULT = process.env.VAULT_PATH || path.join(os.homedir(), 'ObsidianVault/Clawdbot');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const HISTORY_DIR = path.join(__dirname, 'history');

const STATS = { processed: 0, costUSD: 0, calls: 0 };

function trackCost(usage, model = 'gpt-4o-mini') {
  if (!usage) return;
  const rates = { 'gpt-4o-mini': { in: 0.15, out: 0.60 }, 'gpt-4o': { in: 2.50, out: 10.00 } };
  const r = rates[model];
  STATS.costUSD += (usage.prompt_tokens / 1e6) * r.in + (usage.completion_tokens / 1e6) * r.out;
  STATS.calls++;
}

// Filter noise
function isNoise(text) {
  if (!text || text.length < 4) return true;
  if (/^(好的|ok|okay|收到|了解|明白|嗯)$/i.test(text.trim())) return true;
  if (/^[\u{1F300}-\u{1F9FF}\s.。，,!！?？~～]+$/u.test(text)) return true;
  return false;
}

// Group messages by date guessed from position (approximate)
function bucketByDay(messages) {
  // Without real timestamps, treat all messages from one scrape as same day
  // (ideal: parse "HH:MM" + assume yesterday/today based on position trends)
  const today = new Date().toISOString().slice(0, 10);
  return { [today]: messages };
}

async function extractEntities(messages, groupName) {
  const conv = messages.slice(0, 60).map(m => `${m.sender || '?'} ${m.time || ''}: ${m.text.slice(0,200)}`).join('\n').slice(0, 8000);

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 1200,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: `Extract from this ${groupName} chat history (scraped from Feishu). Return JSON:
{
  "decisions": [{"decision":"...", "by":"name", "context":"..."}],
  "tasks": [{"task":"...", "owner":"name", "due":"YYYY-MM-DD or null"}],
  "questions_unanswered": [{"q":"...", "by":"name"}],
  "files_links": [{"title":"...", "url":"...", "by":"name"}],
  "key_topics": ["topic"],
  "people_discovered": ["name"],
  "blockers": ["..."],
  "patterns": ["recurring discussions"]
}

History:
${conv}`
    }]
  });
  trackCost(res.usage);
  try { return JSON.parse(res.choices[0].message.content); }
  catch { return null; }
}

function buildHistoricalDigest(date, group, messages, entities) {
  const senders = [...new Set(messages.map(m => m.sender).filter(Boolean))];

  return `---
date: ${date}
group: ${group}
source: scraped_history
msg_count: ${messages.length}
processed_at: ${new Date().toISOString()}
tags: [digest, history, ${group.toLowerCase()}]
---

# ${date} — ${group} (Historical Scrape)

## 📊 Overview
- Total messages: ${messages.length}
- Senders: ${senders.length} (${senders.slice(0,8).join(', ')})
- Source: browser scrape

## 🎯 Decisions
${(entities?.decisions||[]).map(d => `- **${d.decision}** — by ${d.by} (${d.context||''})`).join('\n') || '_none_'}

## 📋 Tasks
${(entities?.tasks||[]).map(t => `- [ ] ${t.task} — ${t.owner||'?'} ${t.due?`due ${t.due}`:''}`).join('\n') || '_none_'}

## ❓ Unanswered
${(entities?.questions_unanswered||[]).map(q => `- "${q.q}" — ${q.by}`).join('\n') || '_none_'}

## 📁 Files / Links
${(entities?.files_links||[]).map(f => `- [${f.title}](${f.url}) — ${f.by}`).join('\n') || '_none_'}

## 🔍 Key Topics
${(entities?.key_topics||[]).map(t => `- ${t}`).join('\n') || '_none_'}

## 👥 People Discovered
${(entities?.people_discovered||[]).map(p => `- [[${p}]]`).join('\n') || '_none_'}

## 🚧 Blockers
${(entities?.blockers||[]).map(b => `- ${b}`).join('\n') || '_none_'}

## 🔁 Recurring Patterns
${(entities?.patterns||[]).map(p => `- ${p}`).join('\n') || '_none_'}
`;
}

async function main() {
  const inputFile = process.argv[2];
  const groupName = process.argv[3] || 'Unknown';

  if (!inputFile) {
    console.log('Usage: node import_history.js <history.json> <group_name>');
    return;
  }

  const filePath = path.isAbsolute(inputFile) ? inputFile : path.join(HISTORY_DIR, inputFile);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }

  console.log(`📥 Importing history from ${filePath}`);
  console.log(`   Group: ${groupName}`);

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const messages = (Array.isArray(raw) ? raw : raw.messages || [])
    .filter(m => m.text && !isNoise(m.text))
    .sort((a, b) => (a.position || 0) - (b.position || 0));

  console.log(`   Raw: ${(Array.isArray(raw) ? raw.length : raw.messages?.length || 0)} | After filter: ${messages.length}`);

  if (messages.length === 0) { console.log('No messages to process.'); return; }

  // Extract entities from full batch
  console.log('\n🧠 Extracting entities (gpt-4o-mini)...');
  const entities = await extractEntities(messages, groupName);

  // Write digest
  const today = new Date().toISOString().slice(0,10);
  const digestPath = path.join(VAULT, '05-Conversations', `${today}-${groupName}-history.md`);
  fs.writeFileSync(digestPath, buildHistoricalDigest(today, groupName, messages, entities));

  console.log(`✅ Digest: ${digestPath.replace(VAULT,'')}`);
  console.log(`📊 Decisions: ${entities?.decisions?.length||0} | Tasks: ${entities?.tasks?.length||0} | Topics: ${entities?.key_topics?.length||0}`);

  // Update people profiles with new samples
  const peopleDir = path.join(VAULT, '02-People');
  const bySender = {};
  messages.forEach(m => {
    if (m.sender) (bySender[m.sender] ||= []).push(m);
  });

  for (const [sender, msgs] of Object.entries(bySender)) {
    if (msgs.length < 2) continue;
    const safeName = sender.replace(/[^\w一-龥]/g, '_').slice(0, 30);
    const file = path.join(peopleDir, `${safeName}.md`);
    const samples = msgs.slice(0, 10).map(m => `> [${m.time||'?'}] ${m.text.slice(0,200)}`).join('\n');
    const block = `\n\n## Historical samples (scraped ${today})\n${samples}\n`;
    if (fs.existsSync(file)) fs.appendFileSync(file, block);
    else fs.writeFileSync(file, `---\nname: ${sender}\norg: external\nlast_seen: ${today}\nsample_count: ${msgs.length}\ntags: [person]\n---\n\n# ${sender}\n${block}`);
  }

  console.log(`👥 Updated ${Object.keys(bySender).length} people profiles`);
  console.log(`\n💰 Cost: $${STATS.costUSD.toFixed(4)} | Calls: ${STATS.calls}`);

  // Append to learning log
  fs.appendFileSync(path.join(VAULT, '00-Brain', 'Learning-Log.md'),
    `\n## ${new Date().toISOString()} — History Import\n- Group: ${groupName} | Messages: ${messages.length} | Cost: $${STATS.costUSD.toFixed(4)}\n`);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });

module.exports = { main, STATS };
