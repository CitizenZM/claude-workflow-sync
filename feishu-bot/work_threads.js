// ─────────────────────────────────────────────────────────────────────────────
// work_threads.js — Per-person work thread tracker
//
// Each person gets a rolling thread file in the vault:
//   ~/ObsidianVault/Clawdbot/06-WorkThreads/<name>.md
//
// Tracks: daily activities, task completions, responses, blockers
// Queryable: "what did 冯昭祥 do today?" → read their thread file
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const VAULT = process.env.OBSIDIAN_VAULT || path.join(require('os').homedir(), 'ObsidianVault/Clawdbot');
const THREADS_DIR = path.join(VAULT, '06-WorkThreads');
const NAME_MAP_FILE = path.join(__dirname, 'id_name_map.json');

// Ensure directory exists
if (!fs.existsSync(THREADS_DIR)) fs.mkdirSync(THREADS_DIR, { recursive: true });

// ── Name resolution ──────────────────────────────────────────────────────────
let _nameMap = null;
function getNameMap() {
  if (_nameMap) return _nameMap;
  try { _nameMap = JSON.parse(fs.readFileSync(NAME_MAP_FILE, 'utf8')); }
  catch { _nameMap = {}; }
  return _nameMap;
}

function resolveName(idOrName) {
  if (!idOrName) return null;
  const map = getNameMap();
  // Try direct match
  if (map[idOrName]) return map[idOrName];
  // Try last 6 chars of open_id
  const short = idOrName.slice(-6);
  if (map[short]) return map[short];
  // Already a name
  if (idOrName.length > 6 && !idOrName.startsWith('ou_')) return idOrName;
  return idOrName;
}

// ── Thread file management ───────────────────────────────────────────────────
function getThreadPath(personName) {
  const safeName = personName.replace(/[/\\:*?"<>|]/g, '_');
  return path.join(THREADS_DIR, `${safeName}.md`);
}

function loadThread(personName) {
  const fp = getThreadPath(personName);
  try { return fs.readFileSync(fp, 'utf8'); }
  catch { return null; }
}

function initThread(personName) {
  const fp = getThreadPath(personName);
  const today = new Date().toISOString().slice(0, 10);
  const content = `---
name: ${personName}
type: work-thread
created: ${today}
updated: ${today}
tags: [work-thread, person]
---

# ${personName} — Work Thread

`;
  fs.writeFileSync(fp, content);
  return content;
}

function appendToThread(personName, entry) {
  const fp = getThreadPath(personName);
  let content = loadThread(personName);
  if (!content) content = initThread(personName);

  // Update the 'updated' date in frontmatter
  const today = new Date().toISOString().slice(0, 10);
  content = content.replace(/updated: \d{4}-\d{2}-\d{2}/, `updated: ${today}`);

  content += entry + '\n';
  fs.writeFileSync(fp, content);
}

// ── Record activities ────────────────────────────────────────────────────────

function recordMessage(personIdOrName, { group, text, timestamp }) {
  const name = resolveName(personIdOrName);
  if (!name || name === 'Clawdbot' || name === 'System') return;

  const time = timestamp ? new Date(timestamp) : new Date();
  const timeStr = time.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
  const date = time.toISOString().slice(0, 10);

  // Check if we need a new day header
  const thread = loadThread(name) || '';
  const dayHeader = `## ${date}`;
  let entry = '';

  if (!thread.includes(dayHeader)) {
    entry += `\n${dayHeader}\n`;
  }

  // Record as activity
  entry += `- [${timeStr}] 💬 **${group}**: ${text.slice(0, 150)}\n`;
  appendToThread(name, entry);
}

function recordTaskAssigned(personIdOrName, { task, group, deadline }) {
  const name = resolveName(personIdOrName);
  if (!name) return;

  const date = new Date().toISOString().slice(0, 10);
  const thread = loadThread(name) || '';
  const dayHeader = `## ${date}`;
  let entry = '';
  if (!thread.includes(dayHeader)) entry += `\n${dayHeader}\n`;

  entry += `- 📌 **任务分配**: ${task}${deadline ? ` (截止 ${deadline})` : ''} — ${group}\n`;
  appendToThread(name, entry);
}

function recordTaskCompleted(personIdOrName, { task, group }) {
  const name = resolveName(personIdOrName);
  if (!name) return;

  const date = new Date().toISOString().slice(0, 10);
  const thread = loadThread(name) || '';
  const dayHeader = `## ${date}`;
  let entry = '';
  if (!thread.includes(dayHeader)) entry += `\n${dayHeader}\n`;

  entry += `- ✅ **完成**: ${task} — ${group}\n`;
  appendToThread(name, entry);
}

function recordResponse(personIdOrName, { group, question, response }) {
  const name = resolveName(personIdOrName);
  if (!name) return;

  const date = new Date().toISOString().slice(0, 10);
  const thread = loadThread(name) || '';
  const dayHeader = `## ${date}`;
  let entry = '';
  if (!thread.includes(dayHeader)) entry += `\n${dayHeader}\n`;

  entry += `- 💬 **回复**: ${response.slice(0, 120)} — ${group}\n`;
  appendToThread(name, entry);
}

function recordBlocker(personIdOrName, { blocker, group }) {
  const name = resolveName(personIdOrName);
  if (!name) return;

  const date = new Date().toISOString().slice(0, 10);
  const thread = loadThread(name) || '';
  const dayHeader = `## ${date}`;
  let entry = '';
  if (!thread.includes(dayHeader)) entry += `\n${dayHeader}\n`;

  entry += `- 🚧 **阻塞**: ${blocker} — ${group}\n`;
  appendToThread(name, entry);
}

function recordMentionTimeout(personIdOrName, { mentioner, question, group, minutes }) {
  const name = resolveName(personIdOrName);
  if (!name) return;

  const date = new Date().toISOString().slice(0, 10);
  const thread = loadThread(name) || '';
  const dayHeader = `## ${date}`;
  let entry = '';
  if (!thread.includes(dayHeader)) entry += `\n${dayHeader}\n`;

  entry += `- ⏰ **${minutes}分钟未回复**: ${mentioner}问「${question.slice(0, 80)}」— ${group}\n`;
  appendToThread(name, entry);
}

// ── Query: What did someone do today/this week? ──────────────────────────────

function getPersonToday(personIdOrName) {
  const name = resolveName(personIdOrName);
  if (!name) return null;

  const thread = loadThread(name);
  if (!thread) return { name, activities: [], summary: `${name} 暂无工作记录` };

  const today = new Date().toISOString().slice(0, 10);
  const dayHeader = `## ${today}`;
  const idx = thread.indexOf(dayHeader);
  if (idx === -1) return { name, activities: [], summary: `${name} 今日暂无记录` };

  // Extract today's section
  const nextDay = thread.indexOf('\n## ', idx + 1);
  const section = nextDay === -1 ? thread.slice(idx) : thread.slice(idx, nextDay);
  const lines = section.split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2));

  return {
    name,
    activities: lines,
    summary: lines.length
      ? `${name} 今日 (${lines.length} 条):\n${lines.join('\n')}`
      : `${name} 今日暂无记录`
  };
}

function getPersonWeek(personIdOrName) {
  const name = resolveName(personIdOrName);
  if (!name) return null;

  const thread = loadThread(name);
  if (!thread) return { name, days: [], summary: `${name} 暂无工作记录` };

  // Get last 7 days
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayHeader = `## ${dateStr}`;
    const idx = thread.indexOf(dayHeader);
    if (idx === -1) continue;

    const nextDay = thread.indexOf('\n## ', idx + 1);
    const section = nextDay === -1 ? thread.slice(idx) : thread.slice(idx, nextDay);
    const lines = section.split('\n').filter(l => l.startsWith('- ')).map(l => l.slice(2));
    if (lines.length) days.push({ date: dateStr, activities: lines });
  }

  const summary = days.length
    ? days.map(d => `📅 ${d.date} (${d.activities.length} 条):\n${d.activities.join('\n')}`).join('\n\n')
    : `${name} 近7天暂无记录`;

  return { name, days, summary: `${name} 本周工作:\n\n${summary}` };
}

// ── List all tracked people ──────────────────────────────────────────────────
function listTrackedPeople() {
  try {
    return fs.readdirSync(THREADS_DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => f.replace('.md', ''));
  } catch { return []; }
}

module.exports = {
  resolveName, getNameMap,
  recordMessage, recordTaskAssigned, recordTaskCompleted,
  recordResponse, recordBlocker, recordMentionTimeout,
  getPersonToday, getPersonWeek, listTrackedPeople,
  THREADS_DIR,
};
