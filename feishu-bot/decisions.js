// ─────────────────────────────────────────────────────────────────────────────
// decisions.js — MODULE C: Decision Log with outcome tracking
// Reads daily digests → appends new decisions to persistent log
// Weekly: re-checks decisions made 7+ days ago, annotates outcomes
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');

const VAULT = process.env.VAULT_PATH || path.join(os.homedir(), 'ObsidianVault/Clawdbot');
const DIGESTS = path.join(VAULT, '05-Conversations');
const LOG_PATH = path.join(VAULT, '00-Brain', 'Decisions.md');
const DB_PATH = path.join(VAULT, '00-Brain', '_decisions.json');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STATS = { added: 0, updated: 0, costUSD: 0, calls: 0 };

function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_PATH)); }
  catch { return { decisions: [], lastSync: 0 }; }
}
function saveDB(db) { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }

function fingerprint(date, group, decision) {
  return `${date}|${group}|${decision.slice(0, 80)}`.toLowerCase().replace(/\s+/g, ' ');
}

// Extract decisions from a single digest file
function extractDecisions(content, group, date) {
  const decisions = [];
  const lines = content.split('\n');
  let inDecisions = false;

  for (const line of lines) {
    if (line.match(/^##\s*🎯/) && line.toLowerCase().includes('decision')) { inDecisions = true; continue; }
    if (line.match(/^##\s*\S/) && inDecisions) inDecisions = false;
    if (!inDecisions) continue;

    const m = line.match(/^-\s*\*\*(.+?)\*\*\s*—\s*by\s*[`']?(\S+?)[`']?(?:\s+at\s+(\S+))?/i);
    if (m) {
      decisions.push({
        date,
        group,
        decision: m[1].trim(),
        owner: m[2].trim(),
        time: m[3] || '',
        fp: fingerprint(date, group, m[1])
      });
    }
  }
  return decisions;
}

// Annotate decision outcome (called for decisions ≥7 days old)
async function checkOutcome(decision) {
  // Look at digests AFTER the decision date for evidence
  const decisionDate = new Date(decision.date);
  const allDigests = fs.readdirSync(DIGESTS).filter(f => f.endsWith('.md'));
  const laterContexts = [];

  for (const f of allDigests) {
    const m = f.match(/^(\d{4}-\d{2}-\d{2})/);
    if (!m) continue;
    const fileDate = new Date(m[1]);
    if (fileDate <= decisionDate) continue;
    const daysSince = (fileDate - decisionDate) / 86400000;
    if (daysSince > 30) continue;

    const content = fs.readFileSync(path.join(DIGESTS, f), 'utf8');
    // Pull keywords from decision and search later digests
    const keywords = decision.decision.match(/[一-龥a-zA-Z]{2,}/g)?.slice(0, 6) || [];
    const score = keywords.filter(k => content.includes(k)).length;
    if (score >= 2) laterContexts.push({ file: f, snippet: content.slice(0, 1500) });
    if (laterContexts.length >= 3) break;
  }

  if (laterContexts.length === 0) {
    return { status: 'no signal', summary: 'No follow-up evidence found in later digests' };
  }

  // Use mini to determine outcome
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 200,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: `A decision was made: "${decision.decision}" on ${decision.date} in ${decision.group} group.
Did it actually happen? Look at later messages for evidence.

Return JSON: {"status": "executed | partially | abandoned | unclear", "evidence": "1 sentence what you saw"}

Later digest excerpts:
${laterContexts.map(c => `[${c.file}]\n${c.snippet}`).join('\n\n')}`
    }]
  });

  STATS.costUSD += (res.usage.prompt_tokens / 1e6) * 0.15 + (res.usage.completion_tokens / 1e6) * 0.60;
  STATS.calls++;

  try {
    const parsed = JSON.parse(res.choices[0].message.content);
    return { status: parsed.status, summary: parsed.evidence };
  } catch {
    return { status: 'unclear', summary: 'parse error' };
  }
}

// Render the Decision Log markdown
function renderLog(db) {
  const sortedAll = [...db.decisions].sort((a, b) => b.date.localeCompare(a.date));
  const open = sortedAll.filter(d => !d.outcome);
  const closed = sortedAll.filter(d => d.outcome);

  let md = `# 🎯 Decision Log

> Persistent log of decisions made across all groups. Outcomes auto-annotated 7-30 days after decision date.
> Last refreshed: ${new Date().toISOString()}
> Total: ${db.decisions.length} (open: ${open.length}, with outcome: ${closed.length})

## 🟡 Open Decisions (awaiting outcome verification)

| Date | Group | Decision | Owner |
|---|---|---|---|
${open.length ? open.slice(0, 30).map(d => `| ${d.date} | ${d.group} | ${d.decision.slice(0,100)} | ${d.owner || '?'} |`).join('\n') : '| — | — | _none_ | — |'}

## ✅ Closed Decisions (with outcome)

`;

  if (closed.length === 0) {
    md += '_No decisions have been verified yet. Outcomes get annotated 7+ days after the decision._\n';
  } else {
    const byStatus = { executed: [], partially: [], abandoned: [], unclear: [] };
    closed.forEach(d => {
      const k = (d.outcome.status || 'unclear').toLowerCase();
      (byStatus[k] || byStatus.unclear).push(d);
    });

    for (const [status, items] of Object.entries(byStatus)) {
      if (!items.length) continue;
      const emoji = { executed: '✅', partially: '🟡', abandoned: '❌', unclear: '❓' }[status];
      md += `### ${emoji} ${status} (${items.length})\n\n`;
      items.slice(0, 20).forEach(d => {
        md += `- **${d.date}** [${d.group}] ${d.decision.slice(0, 120)}\n  - Owner: \`${d.owner || '?'}\`\n  - Evidence: ${d.outcome.summary}\n\n`;
      });
    }
  }

  md += `\n## 📊 Statistics

- Total decisions: ${db.decisions.length}
- Open (no outcome yet): ${open.length}
- Executed: ${closed.filter(d => d.outcome.status === 'executed').length}
- Partial: ${closed.filter(d => d.outcome.status === 'partially').length}
- Abandoned: ${closed.filter(d => d.outcome.status === 'abandoned').length}
- Unclear: ${closed.filter(d => d.outcome.status === 'unclear').length}

_Run \`node decisions.js\` to refresh. Auto-runs Sunday 04:45._
`;
  return md;
}

async function main() {
  console.log('🎯 Module C — Decision Log');

  if (!fs.existsSync(DIGESTS)) {
    console.log('No digests found.');
    return;
  }

  const db = loadDB();
  const known = new Set(db.decisions.map(d => d.fp));

  // Step 1: scan all digests for new decisions
  const digestFiles = fs.readdirSync(DIGESTS).filter(f => f.endsWith('.md'));
  for (const file of digestFiles) {
    const m = file.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
    if (!m) continue;
    const date = m[1], group = m[2];
    const content = fs.readFileSync(path.join(DIGESTS, file), 'utf8');
    const decisions = extractDecisions(content, group, date);
    for (const d of decisions) {
      if (!known.has(d.fp)) {
        db.decisions.push(d);
        known.add(d.fp);
        STATS.added++;
        console.log(`  ➕ ${date} [${group}] ${d.decision.slice(0,80)}`);
      }
    }
  }

  // Step 2: check outcomes for decisions 7+ days old without outcomes
  const now = Date.now();
  const SEVEN_DAYS = 7 * 86400000;
  const candidates = db.decisions.filter(d => !d.outcome && (now - new Date(d.date).getTime()) >= SEVEN_DAYS);

  console.log(`\n🔍 ${candidates.length} decisions ready for outcome check (7+ days old)`);
  for (const d of candidates.slice(0, 20)) { // cap per run
    console.log(`  🕐 Checking: ${d.decision.slice(0,60)}...`);
    const outcome = await checkOutcome(d);
    d.outcome = { ...outcome, checkedAt: new Date().toISOString() };
    STATS.updated++;
    console.log(`     → ${outcome.status}: ${outcome.summary}`);
  }

  db.lastSync = Date.now();
  saveDB(db);

  // Render the human-readable log
  fs.writeFileSync(LOG_PATH, renderLog(db));

  console.log(`\n💰 Summary:`);
  console.log(`  Added: ${STATS.added} | Outcomes annotated: ${STATS.updated}`);
  console.log(`  Calls: ${STATS.calls} | Cost: $${STATS.costUSD.toFixed(4)}`);

  fs.appendFileSync(path.join(VAULT, '00-Brain', 'Learning-Log.md'),
    `\n## ${new Date().toISOString()} — Decision Log (Module C)\n- Added: ${STATS.added} | Outcomes: ${STATS.updated} | Cost: $${STATS.costUSD.toFixed(4)}\n`);
}

if (require.main === module) main().catch(e => { console.error('❌', e.message); process.exit(1); });

module.exports = { main, STATS };
