// ─────────────────────────────────────────────────────────────────────────────
// synthesize_people.js — MODULE B: Real synthesized people profiles
// Reads sample dumps in 02-People/*.md → produces structured profiles
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');

const VAULT = process.env.VAULT_PATH || path.join(os.homedir(), 'ObsidianVault/Clawdbot');
const PEOPLE_DIR = path.join(VAULT, '02-People');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STATS = { processed: 0, skipped: 0, costUSD: 0, calls: 0 };

function trackCost(usage) {
  if (!usage) return;
  STATS.tokensIn = (STATS.tokensIn || 0) + usage.prompt_tokens;
  STATS.tokensOut = (STATS.tokensOut || 0) + usage.completion_tokens;
  STATS.costUSD += (usage.prompt_tokens / 1e6) * 0.15 + (usage.completion_tokens / 1e6) * 0.60;
  STATS.calls++;
}

// Parse existing person markdown
function parsePerson(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const fm = {};
  if (fmMatch) {
    fmMatch[1].split('\n').forEach(line => {
      const m = line.match(/^(\w+):\s*(.+)$/);
      if (m) fm[m[1]] = m[2].trim();
    });
  }

  // Extract all sample blocks (lines starting with >)
  const samples = [];
  const sampleRegex = /^>\s*(.+)$/gm;
  let match;
  while ((match = sampleRegex.exec(content)) !== null) {
    const text = match[1].trim();
    if (text.length > 5 && !samples.includes(text)) samples.push(text);
  }

  return { frontmatter: fm, samples, raw: content };
}

// Get task references from daily digests for this person
function findTaskRefs(personKey) {
  const digestsDir = path.join(VAULT, '05-Conversations');
  if (!fs.existsSync(digestsDir)) return [];
  const tasks = [];
  for (const file of fs.readdirSync(digestsDir)) {
    if (!file.endsWith('.md')) continue;
    const content = fs.readFileSync(path.join(digestsDir, file), 'utf8');
    const lines = content.split('\n');
    let inTaskSection = false;
    for (const line of lines) {
      if (line.startsWith('## 📋 Tasks')) { inTaskSection = true; continue; }
      if (line.startsWith('##') && inTaskSection) inTaskSection = false;
      if (inTaskSection && line.includes(personKey)) {
        tasks.push({ file: file.replace('.md',''), task: line.replace(/^-\s*\[.\]\s*/,'').trim() });
      }
    }
  }
  return tasks.slice(0, 10);
}

// Synthesize a person profile via gpt-4o-mini
async function synthesize(personKey, parsed) {
  const samples = parsed.samples.slice(-30); // last 30 samples
  if (samples.length < 3) return null;

  const sampleText = samples.map((s,i) => `${i+1}. ${s.slice(0,300)}`).join('\n');

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 800,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: `Synthesize a profile of this person from their Feishu group messages. Return strict JSON.

{
  "displayName": "best-guess Chinese/English name (or null if not derivable)",
  "inferredRole": "1-line role guess (e.g. 'Ad operations specialist', 'Customer service lead')",
  "expertise": ["3-5 topics they speak about with authority"],
  "communicationStyle": "1-2 sentence style description",
  "language": "ZH | EN | mixed",
  "formality": "casual | neutral | formal",
  "seniority": "junior | mid | senior | lead",
  "frequentTopics": ["top 4-6 recurring topics"],
  "owns": ["3-5 things they appear responsible for"],
  "interactsWith": ["names mentioned by them"],
  "bestSample": "the single most representative message to keep",
  "redFlags": ["any blockers/concerns they've raised"]
}

Messages from person ${personKey}:
${sampleText}`
    }]
  });

  trackCost(res.usage);
  try { return JSON.parse(res.choices[0].message.content); }
  catch { return null; }
}

function buildMarkdown(personKey, fm, profile, tasks, sampleCount) {
  const today = new Date().toISOString().slice(0, 10);
  const displayName = profile.displayName || personKey;

  return `---
name: ${displayName}
feishu_open_id: ${fm.feishu_open_id || 'unknown'}
inferred_role: ${profile.inferredRole || '_unknown_'}
org: ${fm.org || 'external'}
language: ${profile.language || 'unknown'}
formality: ${profile.formality || 'unknown'}
seniority: ${profile.seniority || 'unknown'}
last_seen: ${fm.last_seen || today}
sample_count: ${sampleCount}
synthesized_at: ${new Date().toISOString()}
tags: [person, synthesized]
---

# ${displayName}

> ${profile.inferredRole || 'Role to be inferred'}

## 🎯 Role & Responsibilities
${profile.inferredRole || '_Unknown_'}

## 🧠 Expertise
${(profile.expertise || []).map(e => `- ${e}`).join('\n') || '_Unknown_'}

## 💬 Communication Style
- **Language**: ${profile.language || 'unknown'}
- **Formality**: ${profile.formality || 'unknown'}
- **Seniority signal**: ${profile.seniority || 'unknown'}
- ${profile.communicationStyle || ''}

## 📊 Frequent Topics
${(profile.frequentTopics || []).map(t => `- ${t}`).join('\n') || '_None observed_'}

## ✋ Owns / Drives
${(profile.owns || []).map(o => `- ${o}`).join('\n') || '_None inferred_'}

## 🤝 Frequently Interacts With
${(profile.interactsWith || []).map(p => `- [[${p}]]`).join('\n') || '_None observed_'}

## ⚠️ Concerns / Red Flags Raised
${(profile.redFlags || []).map(r => `- ${r}`).join('\n') || '_None_'}

## 📋 Recent Tasks (auto-linked from digests)
${tasks.length ? tasks.map(t => `- ${t.task} _(from [[${t.file}]])_`).join('\n') : '_None tracked_'}

## 📝 Best Representative Sample
> ${profile.bestSample || '_None_'}

---
*Profile synthesized ${today}. Refreshes every Sunday 04:30 from accumulated samples.*
`;
}

async function main() {
  console.log('🧠 Module B — Synthesizing People Profiles');
  console.log(`📂 Vault: ${PEOPLE_DIR}\n`);

  if (!fs.existsSync(PEOPLE_DIR)) {
    console.log('No people directory yet. Run learn.js first.');
    return;
  }

  const files = fs.readdirSync(PEOPLE_DIR).filter(f => f.endsWith('.md') && !f.startsWith('_'));
  console.log(`Found ${files.length} person files\n`);

  for (const file of files) {
    const fullPath = path.join(PEOPLE_DIR, file);
    const content = fs.readFileSync(fullPath, 'utf8');
    const personKey = file.replace('.md', '');
    const parsed = parsePerson(content);

    // Skip if already synthesized recently and no new samples
    const lastSynth = parsed.frontmatter.synthesized_at;
    if (lastSynth && parsed.frontmatter.tags?.includes('synthesized')) {
      const ageHours = (Date.now() - new Date(lastSynth).getTime()) / 3600000;
      if (ageHours < 24 * 6) {
        console.log(`  ⏭️  Skip ${personKey} (synthesized ${ageHours.toFixed(0)}h ago)`);
        STATS.skipped++;
        continue;
      }
    }

    if (parsed.samples.length < 3) {
      console.log(`  ⏭️  Skip ${personKey} (only ${parsed.samples.length} samples)`);
      STATS.skipped++;
      continue;
    }

    console.log(`  🧠 Synthesizing ${personKey} (${parsed.samples.length} samples)...`);
    const profile = await synthesize(personKey, parsed);
    if (!profile) {
      console.log(`     ❌ Failed`);
      continue;
    }

    const tasks = findTaskRefs(personKey);
    const md = buildMarkdown(personKey, parsed.frontmatter, profile, tasks, parsed.samples.length);
    fs.writeFileSync(fullPath, md);

    // Also save to a more readable filename if we got a real name
    if (profile.displayName && profile.displayName !== personKey && !profile.displayName.includes('null')) {
      const safeName = profile.displayName.replace(/[^\w一-龥\.\-]/g, '_').slice(0, 50);
      const aliasFile = path.join(PEOPLE_DIR, `${safeName}.md`);
      if (!fs.existsSync(aliasFile) && safeName !== personKey) {
        fs.writeFileSync(aliasFile, md);
      }
    }

    STATS.processed++;
    console.log(`     ✅ ${profile.inferredRole || 'unknown role'} | ${profile.expertise?.length || 0} expertise areas`);
  }

  console.log('\n💰 Summary:');
  console.log(`  Processed: ${STATS.processed} | Skipped: ${STATS.skipped}`);
  console.log(`  Calls: ${STATS.calls} | Cost: $${STATS.costUSD.toFixed(4)}`);

  fs.appendFileSync(path.join(VAULT, '00-Brain', 'Learning-Log.md'),
    `\n## ${new Date().toISOString()} — People Synthesis (Module B)\n- Processed: ${STATS.processed} | Cost: $${STATS.costUSD.toFixed(4)}\n`);
}

if (require.main === module) main().catch(e => { console.error('❌', e.message); process.exit(1); });

module.exports = { main, STATS };
