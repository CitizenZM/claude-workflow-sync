// ─────────────────────────────────────────────────────────────────────────────
// sync_bitable.js — Sync Feishu Bitable (TCL Tracker) to Obsidian vault
//
// Pulls all records from the TCL Weekly Execution Tracker and writes:
//   1. A summary dashboard markdown file
//   2. Per-module breakdown with task status
//
// Usage: node sync_bitable.js
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const dr = require('./doc_reader');

const VAULT = path.join(process.env.HOME, 'Documents/Obsidian/Clawdbot');
const TCL_DIR = path.join(VAULT, '01-Projects/TCL');
const TRACKER_FILE = path.join(TCL_DIR, 'TCL-Tracker-Live.md');

// TCL Bitable config
const APP_TOKEN = 'ULgAbO391aTHXvsh2q5cECE1nwd';
const TABLE_ID = 'tblbmakMHbl2ndk0';

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return '-';
  const d = new Date(typeof ts === 'number' ? ts : parseInt(ts));
  if (isNaN(d.getTime())) return String(ts);
  return d.toISOString().split('T')[0];
}

function statusEmoji(status) {
  const map = {
    '已完成': '✅',
    '进行中': '🔄',
    '待开始': '⏳',
    '已延期': '🔴',
    '已取消': '❌',
    '阻塞': '🚫',
  };
  return map[status] || '📋';
}

function prioritySort(p) {
  const order = { 'P0': 0, 'P1': 1, 'P2': 2, 'P3': 3 };
  return order[p] ?? 9;
}

// ── Main sync ────────────────────────────────────────────────────────────────
async function syncBitable() {
  console.log('📊 Syncing TCL Bitable Tracker...');

  // Fetch all records
  const records = await dr.readBitableAsObjects(APP_TOKEN, TABLE_ID);
  console.log(`   Fetched ${records.length} records`);

  if (!records.length) {
    console.log('   No records found, skipping sync');
    return;
  }

  // ── Categorize ──
  const byModule = {};
  const byStatus = {};
  let incomplete = 0;
  let stale = 0;
  const now = Date.now();
  const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

  for (const r of records) {
    const mod = r['所属模块'] || 'Uncategorized';
    const status = r['当前状态'] || 'Unknown';
    const lastUpdate = r['最后更新时间'];

    if (!byModule[mod]) byModule[mod] = [];
    byModule[mod].push(r);

    if (!byStatus[status]) byStatus[status] = 0;
    byStatus[status]++;

    if (status !== '已完成' && status !== '已取消') {
      incomplete++;
      if (lastUpdate && (now - lastUpdate) > THREE_DAYS) stale++;
    }
  }

  // ── Build markdown ──
  const lines = [];
  const syncTime = new Date().toISOString().replace('T', ' ').split('.')[0];

  lines.push(`# TCL Tracker — Live Dashboard`);
  lines.push(`> Auto-synced from [Feishu Bitable](https://k1dlid7h4q3.feishu.cn/base/${APP_TOKEN}) at ${syncTime}`);
  lines.push('');

  // Summary stats
  lines.push('## 📈 Overview');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Tasks | ${records.length} |`);
  lines.push(`| Incomplete | ${incomplete} |`);
  lines.push(`| Stale (>3d no update) | ${stale} |`);
  lines.push(`| Modules | ${Object.keys(byModule).length} |`);
  lines.push('');

  // Status breakdown
  lines.push('## 📊 By Status');
  lines.push('| Status | Count |');
  lines.push('|--------|-------|');
  const statusOrder = ['进行中', '待开始', '阻塞', '已延期', '已完成', '已取消'];
  const sortedStatuses = Object.entries(byStatus).sort((a, b) => {
    const ai = statusOrder.indexOf(a[0]);
    const bi = statusOrder.indexOf(b[0]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  for (const [status, count] of sortedStatuses) {
    lines.push(`| ${statusEmoji(status)} ${status} | ${count} |`);
  }
  lines.push('');

  // Per-module sections — only show incomplete tasks in detail
  lines.push('## 🔥 Active Tasks by Module');
  lines.push('');

  const sortedModules = Object.entries(byModule).sort((a, b) => {
    // Sort by number of incomplete tasks descending
    const aInc = a[1].filter(r => r['当前状态'] !== '已完成' && r['当前状态'] !== '已取消').length;
    const bInc = b[1].filter(r => r['当前状态'] !== '已完成' && r['当前状态'] !== '已取消').length;
    return bInc - aInc;
  });

  for (const [mod, tasks] of sortedModules) {
    const activeTasks = tasks
      .filter(r => r['当前状态'] !== '已完成' && r['当前状态'] !== '已取消')
      .sort((a, b) => prioritySort(a['优先级']) - prioritySort(b['优先级']));

    const completed = tasks.filter(r => r['当前状态'] === '已完成').length;
    const total = tasks.length;

    lines.push(`### ${mod} (${activeTasks.length} active / ${total} total)`);

    if (activeTasks.length === 0) {
      lines.push('> All tasks completed ✅');
      lines.push('');
      continue;
    }

    lines.push('| Priority | Task | Owner | Status | Last Update |');
    lines.push('|----------|------|-------|--------|-------------|');

    for (const t of activeTasks) {
      const pri = t['优先级'] || '-';
      const task = (t['具体任务'] || '-').replace(/\|/g, '\\|');
      const owner = t['Owner（提出人+跟进人）'] || t['执行人'] || '-';
      const status = t['当前状态'] || '-';
      const lastUp = formatDate(t['最后更新时间']);
      const isStale = t['最后更新时间'] && (now - t['最后更新时间']) > THREE_DAYS;
      const staleFlag = isStale ? ' ⚠️' : '';

      lines.push(`| ${pri} | ${task} | ${owner} | ${statusEmoji(status)} ${status} | ${lastUp}${staleFlag} |`);
    }
    lines.push('');
  }

  // Recently completed (last 7 days)
  lines.push('## ✅ Recently Completed (7 days)');
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const recentlyCompleted = records
    .filter(r => r['当前状态'] === '已完成' && r['完成时间'] && (now - r['完成时间']) < SEVEN_DAYS)
    .sort((a, b) => (b['完成时间'] || 0) - (a['完成时间'] || 0));

  if (recentlyCompleted.length > 0) {
    lines.push('| Task | Module | Completed |');
    lines.push('|------|--------|-----------|');
    for (const t of recentlyCompleted) {
      lines.push(`| ${(t['具体任务'] || '-').replace(/\|/g, '\\|')} | ${t['所属模块'] || '-'} | ${formatDate(t['完成时间'])} |`);
    }
  } else {
    lines.push('> No tasks completed in the last 7 days');
  }
  lines.push('');

  // Write file
  const content = lines.join('\n');
  fs.mkdirSync(TCL_DIR, { recursive: true });
  fs.writeFileSync(TRACKER_FILE, content);
  console.log(`   ✅ Written to ${TRACKER_FILE}`);
  console.log(`   📊 ${records.length} records | ${incomplete} incomplete | ${stale} stale`);
}

// ── Run ──────────────────────────────────────────────────────────────────────
if (require.main === module) {
  syncBitable().catch(err => {
    console.error('❌ Sync failed:', err.message);
    process.exit(1);
  });
}

module.exports = { syncBitable };
