// batch_learn.js — Process all history files into structured vault learning database
// Optimized for low token usage: chunks by date, uses gpt-4o-mini, dedup
// Usage: node batch_learn.js [--group name] [--force]

require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');

const VAULT = process.env.VAULT_PATH || path.join(os.homedir(), 'Documents/Obsidian/Clawdbot');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const HISTORY_DIR = path.join(__dirname, 'history');
const PROCESSED_FILE = path.join(__dirname, '.batch_processed.json');

const STATS = { files: 0, days: 0, messages: 0, costUSD: 0, calls: 0, skipped: 0 };

function trackCost(usage, model = 'gpt-4o-mini') {
  if (!usage) return;
  const rates = { 'gpt-4o-mini': { in: 0.15, out: 0.60 } };
  const r = rates[model];
  STATS.costUSD += (usage.prompt_tokens / 1e6) * r.in + (usage.completion_tokens / 1e6) * r.out;
  STATS.calls++;
}

function isNoise(text) {
  if (!text || text.length < 4) return true;
  if (/^(好的|ok|okay|收到|了解|明白|嗯|谢谢|感谢|辛苦|👍|嗯嗯)$/i.test(text.trim())) return true;
  if (/^[\u{1F300}-\u{1F9FF}\s.。，,!！?？~～]+$/u.test(text)) return true;
  return false;
}

// Group messages by date
function bucketByDate(messages) {
  const buckets = {};
  for (const m of messages) {
    if (!m.createTime) continue;
    // createTime can be seconds (10 digits) or milliseconds (13 digits)
    const ts = m.createTime > 1e12 ? m.createTime : m.createTime * 1000;
    const date = new Date(ts).toISOString().slice(0, 10);
    (buckets[date] ||= []).push(m);
  }
  return buckets;
}

// Extract group name from filename
function parseGroupName(fileName) {
  return fileName.replace(/_[a-f0-9]{8}\.json$/, '').replace(/_/g, ' ').trim();
}

// Compact message format for LLM (minimize tokens)
function compactMessages(messages, maxChars = 6000) {
  let out = '';
  for (const m of messages) {
    const text = m.text?.trim();
    if (!text || isNoise(text)) continue;
    const sender = m.senderId?.slice(-6) || '?';
    const line = `[${sender}] ${text.slice(0, 200)}\n`;
    if (out.length + line.length > maxChars) break;
    out += line;
  }
  return out;
}

// Extract structured data from a day's messages
async function extractDayDigest(messages, groupName, date) {
  const conv = compactMessages(messages);
  if (conv.length < 50) return null; // too few meaningful messages

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 800,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: `Extract from ${groupName} chat on ${date}. Return JSON:
{"decisions":[{"d":"...","by":"..."}],"tasks":[{"t":"...","owner":"..."}],"topics":["..."],"questions":[{"q":"..."}],"blockers":["..."],"links":["url"],"key_people":["name"]}
Keep each field max 5 items. Be concise.

Chat:
${conv}`
    }]
  });
  trackCost(res.usage);
  try { return JSON.parse(res.choices[0].message.content); }
  catch { return null; }
}

// Extract topic taxonomy from all days
async function extractTopics(allDigests, groupName) {
  const topicList = allDigests.flatMap(d => d.entities?.topics || []);
  if (topicList.length < 3) return [];

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 600,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: `Categorize these topics from ${groupName} into a taxonomy. Return JSON:
{"categories":[{"name":"category","topics":["topic"],"frequency":"high|med|low"}]}
Max 8 categories. Merge similar topics.

Topics: ${[...new Set(topicList)].join(', ')}`
    }]
  });
  trackCost(res.usage);
  try { return JSON.parse(res.choices[0].message.content).categories || []; }
  catch { return []; }
}

// Build daily digest markdown
function buildDayDigest(date, group, messages, entities) {
  const meaningful = messages.filter(m => m.text && !isNoise(m.text));
  return `---
date: ${date}
group: ${group}
msg_count: ${messages.length}
meaningful: ${meaningful.length}
tags: [digest, ${group.toLowerCase().replace(/\s+/g,'-')}]
---

# ${date} — ${group}

## Overview
- Messages: ${messages.length} (${meaningful.length} meaningful)

## Decisions
${(entities?.decisions||[]).map(d => `- **${d.d}** — ${d.by||'?'}`).join('\n') || '_none_'}

## Tasks
${(entities?.tasks||[]).map(t => `- [ ] ${t.t} — ${t.owner||'?'}`).join('\n') || '_none_'}

## Topics
${(entities?.topics||[]).map(t => `- ${t}`).join('\n') || '_none_'}

## Questions
${(entities?.questions||[]).map(q => `- ${q.q}`).join('\n') || '_none_'}

## Blockers
${(entities?.blockers||[]).map(b => `- ${b}`).join('\n') || '_none_'}
`;
}

// Build topic index for a group
function buildTopicIndex(groupName, categories, dateRange) {
  return `---
group: ${groupName}
type: topic-index
date_range: ${dateRange}
updated: ${new Date().toISOString()}
tags: [index, topics, ${groupName.toLowerCase().replace(/\s+/g,'-')}]
---

# ${groupName} — Topic Index

${categories.map(c => `## ${c.name} (${c.frequency || '?'})
${(c.topics || []).map(t => `- ${t}`).join('\n')}`).join('\n\n')}
`;
}

// Build people index from all digests
function buildPeopleFromHistory(allDigests, groupName) {
  const people = {};
  for (const d of allDigests) {
    for (const p of (d.entities?.key_people || [])) {
      people[p] = (people[p] || 0) + 1;
    }
    for (const t of (d.entities?.tasks || [])) {
      if (t.owner) people[t.owner] = (people[t.owner] || 0) + 1;
    }
    for (const dec of (d.entities?.decisions || [])) {
      if (dec.by) people[dec.by] = (people[dec.by] || 0) + 1;
    }
  }
  return Object.entries(people)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, mentions: count }));
}

async function processFile(filePath, force = false) {
  const fileName = path.basename(filePath);
  const groupName = parseGroupName(fileName);

  // Load processed state
  let processed = {};
  try { processed = JSON.parse(fs.readFileSync(PROCESSED_FILE)); } catch {}

  console.log(`\n📂 ${groupName} (${fileName})`);

  // Load messages
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const messages = Array.isArray(raw) ? raw : raw.messages || [];
  console.log(`   Total messages: ${messages.length}`);

  // Bucket by date
  const byDate = bucketByDate(messages);
  const dates = Object.keys(byDate).sort();
  console.log(`   Date range: ${dates[0]} → ${dates[dates.length-1]} (${dates.length} days)`);

  // Ensure vault dirs
  const digestDir = path.join(VAULT, '05-Conversations');
  const topicDir = path.join(VAULT, '03-Topics');
  [digestDir, topicDir].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

  const allDigests = [];

  for (const date of dates) {
    const dayMsgs = byDate[date];
    const key = `${groupName}:${date}`;

    // Skip if already processed (unless force)
    if (!force && processed[key]) {
      STATS.skipped++;
      continue;
    }

    // Skip days with very few messages
    const meaningful = dayMsgs.filter(m => m.text && !isNoise(m.text));
    if (meaningful.length < 3) {
      processed[key] = { skipped: true, reason: 'too_few', count: meaningful.length };
      continue;
    }

    process.stdout.write(`   ${date} (${dayMsgs.length} msgs)...`);

    const entities = await extractDayDigest(dayMsgs, groupName, date);
    allDigests.push({ date, entities, msgCount: dayMsgs.length });

    if (entities) {
      const digest = buildDayDigest(date, groupName, dayMsgs, entities);
      const safeGroup = groupName.replace(/[^\w一-鿿]/g, '_').slice(0, 20);
      fs.writeFileSync(path.join(digestDir, `${date}-${safeGroup}.md`), digest);
      processed[key] = { processed: true, decisions: entities.decisions?.length || 0, tasks: entities.tasks?.length || 0 };
      console.log(` ✅ D:${entities.decisions?.length||0} T:${entities.tasks?.length||0}`);
    } else {
      processed[key] = { skipped: true, reason: 'no_content' };
      console.log(' (skipped)');
    }

    STATS.days++;
    STATS.messages += dayMsgs.length;

    // Small delay for rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  // Build topic index if we have enough data
  if (allDigests.length >= 3) {
    console.log(`   📊 Building topic taxonomy...`);
    const categories = await extractTopics(allDigests, groupName);
    if (categories.length > 0) {
      const safeGroup = groupName.replace(/[^\w一-鿿]/g, '_').slice(0, 20);
      const dateRange = `${dates[0]} to ${dates[dates.length-1]}`;
      fs.writeFileSync(path.join(topicDir, `${safeGroup}-topics.md`), buildTopicIndex(groupName, categories, dateRange));
      console.log(`   ✅ Topic index: ${categories.length} categories`);
    }
  }

  // Build people summary
  const people = buildPeopleFromHistory(allDigests, groupName);
  if (people.length > 0) {
    const peopleDir = path.join(VAULT, '02-People');
    if (!fs.existsSync(peopleDir)) fs.mkdirSync(peopleDir, { recursive: true });
    for (const p of people.slice(0, 20)) {
      const safeName = p.name.replace(/[^\w一-鿿]/g, '_').slice(0, 30);
      const file = path.join(peopleDir, `${safeName}.md`);
      const block = `\n\n## Activity in ${groupName}\n- Mentions: ${p.mentions}\n- Period: ${dates[0]} to ${dates[dates.length-1]}\n`;
      if (fs.existsSync(file)) {
        const existing = fs.readFileSync(file, 'utf8');
        if (!existing.includes(`Activity in ${groupName}`)) fs.appendFileSync(file, block);
      } else {
        fs.writeFileSync(file, `---\nname: ${p.name}\nlast_seen: ${dates[dates.length-1]}\ntags: [person]\n---\n\n# ${p.name}\n${block}`);
      }
    }
    console.log(`   👥 People: ${people.length} discovered`);
  }

  // Save processed state
  fs.writeFileSync(PROCESSED_FILE, JSON.stringify(processed, null, 2));
  STATS.files++;
}

async function main() {
  const args = process.argv.slice(2);
  const groupFilter = args.indexOf('--group') >= 0 ? args[args.indexOf('--group') + 1] : null;
  const force = args.includes('--force');

  console.log('🧠 Batch Learn — Process History into Vault');
  console.log(`   Vault: ${VAULT}`);
  console.log(`   Force reprocess: ${force}`);

  // Find history files
  const files = fs.readdirSync(HISTORY_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('.'))
    .filter(f => !groupFilter || f.toLowerCase().includes(groupFilter.toLowerCase()));

  console.log(`   Files: ${files.length}`);

  for (const f of files) {
    await processFile(path.join(HISTORY_DIR, f), force);
  }

  // Build master learning log
  const logPath = path.join(VAULT, '00-Brain', 'Learning-Log.md');
  if (fs.existsSync(path.dirname(logPath))) {
    fs.appendFileSync(logPath,
      `\n## ${new Date().toISOString()} — Batch History Learn\n` +
      `- Files: ${STATS.files} | Days: ${STATS.days} | Messages: ${STATS.messages}\n` +
      `- Skipped: ${STATS.skipped} (already processed)\n` +
      `- Cost: $${STATS.costUSD.toFixed(4)} | API calls: ${STATS.calls}\n`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 Batch Learn Summary');
  console.log(`   Files processed: ${STATS.files}`);
  console.log(`   Days digested: ${STATS.days}`);
  console.log(`   Messages processed: ${STATS.messages}`);
  console.log(`   Skipped (dedup): ${STATS.skipped}`);
  console.log(`   💰 Cost: $${STATS.costUSD.toFixed(4)} | Calls: ${STATS.calls}`);
  console.log(`   Vault: ${VAULT}`);
}

if (require.main === module) main().catch(e => { console.error('❌', e.message); process.exit(1); });

module.exports = { processFile, STATS };
