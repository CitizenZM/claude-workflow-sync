// ─────────────────────────────────────────────────────────────────────────────
// learn_files.js — Learn from pinned/shared Word & Excel files in groups
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const OpenAI = require('openai');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const xlsx = require('xlsx');
const mammoth = require('mammoth');

const VAULT = process.env.VAULT_PATH || path.join(os.homedir(), 'ObsidianVault/Clawdbot');
const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STATS = { tokensIn: 0, tokensOut: 0, calls: 0, costUSD: 0, filesProcessed: 0, filesSkipped: 0 };

function trackCost(model, usage) {
  if (!usage) return;
  const rates = { 'gpt-4o-mini': { in: 0.15, out: 0.60 }, 'gpt-4o': { in: 2.50, out: 10.00 } };
  const r = rates[model] || rates['gpt-4o-mini'];
  STATS.tokensIn += usage.prompt_tokens;
  STATS.tokensOut += usage.completion_tokens;
  STATS.costUSD += (usage.prompt_tokens / 1e6) * r.in + (usage.completion_tokens / 1e6) * r.out;
  STATS.calls++;
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

async function apiGet(apiPath) {
  const tok = await getToken();
  return new Promise((res, rej) => {
    https.get({ hostname:'open.feishu.cn', path:`/open-apis${apiPath}`, headers:{Authorization:`Bearer ${tok}`}},
      r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(JSON.parse(d))); }).on('error',rej);
  });
}

// Download file binary using message_id + file_key
async function downloadFile(messageId, fileKey, fileName) {
  const tok = await getToken();
  const apiPath = `/open-apis/im/v1/messages/${messageId}/resources/${fileKey}?type=file`;
  return new Promise((resolve, reject) => {
    https.get({ hostname:'open.feishu.cn', path: apiPath, headers:{Authorization:`Bearer ${tok}`}}, res => {
      if (res.statusCode !== 200) {
        let err = ''; res.on('data', c => err += c); res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${err.slice(0,200)}`)));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

// ── File parsers ──────────────────────────────────────────────────────────────
function parseExcel(buffer, fileName) {
  try {
    const wb = xlsx.read(buffer, { type: 'buffer' });
    const result = { fileName, sheetCount: wb.SheetNames.length, sheets: [] };

    for (const sheetName of wb.SheetNames.slice(0, 8)) { // cap at 8 sheets
      const sheet = wb.Sheets[sheetName];
      const json = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
      const rows = json.slice(0, 100); // cap at 100 rows per sheet
      const cols = rows[0]?.length || 0;

      result.sheets.push({
        name: sheetName,
        rows: rows.length,
        cols,
        headers: rows[0] || [],
        sample: rows.slice(0, 30) // first 30 rows for context
      });
    }
    return result;
  } catch(e) { return { error: e.message }; }
}

async function parseWord(buffer, fileName) {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return { fileName, text: result.value, messages: result.messages.length };
  } catch(e) { return { error: e.message }; }
}

// ── Summarize file contents (cheap) ───────────────────────────────────────────
async function summarizeFile(parsed) {
  if (parsed.error) return { error: parsed.error };

  // Build content preview
  let content = '';
  if (parsed.sheets) {
    // Excel
    content = parsed.sheets.map(s =>
      `## Sheet: ${s.name} (${s.rows}r × ${s.cols}c)\nHeaders: ${(s.headers||[]).slice(0,20).join(' | ')}\nSample rows:\n${s.sample.slice(0,15).map(r => (r||[]).slice(0,15).join(' | ')).join('\n')}`
    ).join('\n\n').slice(0, 6000);
  } else if (parsed.text) {
    // Word
    content = parsed.text.slice(0, 6000);
  } else {
    return { error: 'unknown format' };
  }

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `Summarize this file from a TCL operations team. Output strict markdown:

## Purpose
<1 sentence — what is this file for>

## Key Content
- <bullet points of what's in it, max 6>

## Important Numbers/Dates/People
- <specific data points worth remembering>

## Why it matters
<1 sentence — operational relevance>

File: ${parsed.fileName}

Content:
${content}`
    }]
  });
  trackCost('gpt-4o-mini', res.usage);
  return { summary: res.choices[0].message.content };
}

// ── Vault writer ──────────────────────────────────────────────────────────────
function safeFilename(name) {
  return name.replace(/[^\w一-龥\.\-]/g, '_').slice(0, 80);
}

function writeFileNote(fileName, fileType, parsed, summary, meta) {
  const filesDir = path.join(VAULT, '04-Files');
  if (!fs.existsSync(filesDir)) fs.mkdirSync(filesDir, { recursive: true });

  const safe = safeFilename(fileName.replace(/\.[^.]+$/, ''));
  const notePath = path.join(filesDir, `${safe}.md`);

  let extra = '';
  if (parsed.sheets) {
    extra = `\n## 📊 Excel Structure\n${parsed.sheets.map(s =>
      `### ${s.name}\n- ${s.rows} rows × ${s.cols} cols\n- Headers: ${(s.headers||[]).slice(0,15).join(', ')}`
    ).join('\n\n')}`;
  } else if (parsed.text) {
    extra = `\n## 📄 Word Preview (first 500 chars)\n> ${parsed.text.slice(0,500).replace(/\n/g,' ')}`;
  }

  const md = `---
file_name: ${fileName}
file_type: ${fileType}
group: ${meta.groupName}
group_chat_id: ${meta.chatId}
message_id: ${meta.messageId}
file_key: ${meta.fileKey}
shared_at: ${meta.sharedAt}
processed_at: ${new Date().toISOString()}
tags: [file, ${fileType}]
---

# 📎 ${fileName}

${summary?.summary || '_No summary generated_'}

${extra}

## Source
- Group: [[${meta.groupName}]]
- Shared at: ${meta.sharedAt}
- Pinned: ${meta.pinned ? '✅ yes' : 'no'}
`;

  fs.writeFileSync(notePath, md);
  return notePath;
}

// ── Already-processed tracker (avoid re-processing) ───────────────────────────
const PROCESSED_FILE = path.join(__dirname, 'processed_files.json');
function loadProcessed() {
  try { return JSON.parse(fs.readFileSync(PROCESSED_FILE)); }
  catch { return {}; }
}
function saveProcessed(p) { fs.writeFileSync(PROCESSED_FILE, JSON.stringify(p, null, 2)); }

// ── Main: collect pinned + recent files from a group ──────────────────────────
async function learnFilesFromGroup(groupName, chatId) {
  console.log(`\n📎 Learning files from ${groupName}...`);
  const processed = loadProcessed();

  // Step 1: Get pinned message IDs (page_size max is 50)
  const pinsRes = await apiGet(`/im/v1/pins?chat_id=${chatId}&page_size=50`);
  if (pinsRes.code !== 0) {
    console.log(`  ⚠️ Cannot fetch pins: ${pinsRes.msg} (code: ${pinsRes.code})`);
    return;
  }
  const pinnedIds = (pinsRes.data?.items || []).map(p => p.message_id);
  console.log(`  📌 ${pinnedIds.length} pinned messages`);

  // Step 2: Also scan recent messages for files
  const msgsRes = await apiGet(`/im/v1/messages?container_id_type=chat&container_id=${chatId}&page_size=100&sort_type=ByCreateTimeDesc`);
  const recentMsgs = msgsRes.data?.items || [];
  console.log(`  📥 ${recentMsgs.length} recent messages to scan`);

  // Step 3: Identify file messages (Word/Excel only)
  const allMsgs = [...new Map([...pinnedIds.map(id => [id, { id, pinned: true }]), ...recentMsgs.map(m => [m.message_id, { id: m.message_id, pinned: pinnedIds.includes(m.message_id), msg: m }])]).values()];
  console.log(`  📋 ${allMsgs.length} unique messages to check`);

  const targetExts = ['.docx', '.doc', '.xlsx', '.xls'];
  const candidates = [];

  for (const item of allMsgs) {
    let body, msgType, createTime;
    if (item.msg) {
      // From recent messages list
      body = item.msg.body?.content;
      msgType = item.msg.msg_type || item.msg.message_type;
      createTime = parseInt(item.msg.create_time);
    } else {
      // Need to fetch detail
      const detail = await apiGet(`/im/v1/messages/${item.id}`);
      const m = detail.data?.items?.[0];
      if (!m) continue;
      body = m.body?.content;
      msgType = m.msg_type || m.message_type;
      createTime = parseInt(m.create_time);
    }

    if (msgType !== 'file' || !body) continue;
    let parsed;
    try { parsed = JSON.parse(body); } catch { continue; }
    if (!parsed.file_key || !parsed.file_name) continue;

    const ext = path.extname(parsed.file_name).toLowerCase();
    if (!targetExts.includes(ext)) {
      STATS.filesSkipped++;
      continue;
    }

    candidates.push({
      messageId: item.id,
      fileKey: parsed.file_key,
      fileName: parsed.file_name,
      pinned: item.pinned,
      sharedAt: createTime ? new Date(createTime).toISOString() : '',
      ext
    });
  }

  console.log(`  📎 ${candidates.length} Word/Excel files found`);

  // Step 4: Process each candidate
  let processedNow = 0;
  for (const c of candidates) {
    if (processed[c.fileKey]) {
      console.log(`     ⏭️  Skip (already processed): ${c.fileName}`);
      continue;
    }

    try {
      console.log(`     ⬇️  ${c.pinned ? '📌' : ''} ${c.fileName}`);
      const buf = await downloadFile(c.messageId, c.fileKey, c.fileName);
      console.log(`        Size: ${(buf.length/1024).toFixed(1)}KB`);

      let parsed;
      const ft = c.ext.includes('xls') ? 'excel' : 'word';
      if (ft === 'excel') parsed = parseExcel(buf, c.fileName);
      else parsed = await parseWord(buf, c.fileName);

      if (parsed.error) {
        console.log(`        ❌ Parse error: ${parsed.error}`);
        continue;
      }

      const summary = await summarizeFile(parsed);
      const notePath = writeFileNote(c.fileName, ft, parsed, summary, {
        groupName, chatId: chatId, messageId: c.messageId, fileKey: c.fileKey,
        sharedAt: c.sharedAt, pinned: c.pinned
      });

      processed[c.fileKey] = { fileName: c.fileName, processedAt: new Date().toISOString(), notePath };
      STATS.filesProcessed++;
      processedNow++;
      console.log(`        ✅ → ${notePath.replace(VAULT, '')}`);
    } catch(e) {
      console.log(`        ❌ ${e.message}`);
    }
  }

  saveProcessed(processed);
  console.log(`  ✨ Processed ${processedNow} new files`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('📎 File Learning Pipeline');
  console.log(`📂 Vault: ${VAULT}\n`);

  const ops = JSON.parse(fs.readFileSync(path.join(__dirname, 'ops_data.json')));
  const groups = ops.chats || {};

  for (const [name, chatId] of Object.entries(groups)) {
    try {
      await learnFilesFromGroup(name, chatId);
    } catch(e) {
      console.error(`❌ ${name}:`, e.message);
    }
  }

  console.log('\n💰 Summary:');
  console.log(`  Files processed: ${STATS.filesProcessed}`);
  console.log(`  Files skipped (non-Word/Excel): ${STATS.filesSkipped}`);
  console.log(`  API calls: ${STATS.calls}`);
  console.log(`  Cost: $${STATS.costUSD.toFixed(4)}`);

  // Append to learning log
  const logPath = path.join(VAULT, '00-Brain', 'Learning-Log.md');
  fs.appendFileSync(logPath, `\n## ${new Date().toISOString()} — Files\n- Processed: ${STATS.filesProcessed} | Skipped: ${STATS.filesSkipped} | Cost: $${STATS.costUSD.toFixed(4)}\n`);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });

module.exports = { learnFilesFromGroup, STATS };
