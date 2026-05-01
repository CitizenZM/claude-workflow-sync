// ─────────────────────────────────────────────────────────────────────────────
// vault.js — Obsidian Vault Retrieval
// Cheap (free) keyword-based search; loaded into prompt only when relevant
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const os = require('os');

const VAULT = process.env.VAULT_PATH || path.join(os.homedir(), 'ObsidianVault/Clawdbot');
const EMBEDDINGS_PATH = path.join(__dirname, 'embeddings.json');

// Lazy-load embeddings module + index
let _embModule = null, _embIdx = null;
function loadEmbeddings() {
  if (_embIdx !== null) return _embIdx;
  try {
    if (fs.existsSync(EMBEDDINGS_PATH)) {
      _embIdx = JSON.parse(fs.readFileSync(EMBEDDINGS_PATH));
      _embModule = require('./embeddings');
    } else _embIdx = { vectors: [] };
  } catch { _embIdx = { vectors: [] }; }
  return _embIdx;
}

// Cosine similarity
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Walk vault and build an in-memory file index (cached at startup)
let _index = null;
let _indexBuilt = 0;

function buildIndex() {
  if (!fs.existsSync(VAULT)) return [];
  const files = [];
  function walk(dir, prefix = '') {
    try {
      for (const entry of fs.readdirSync(dir)) {
        if (entry.startsWith('.')) continue;
        const full = path.join(dir, entry);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) walk(full, `${prefix}${entry}/`);
        else if (entry.endsWith('.md')) {
          let content = '';
          try { content = fs.readFileSync(full, 'utf8'); } catch {}
          files.push({
            path: full,
            relPath: `${prefix}${entry}`,
            name: entry.replace(/\.md$/, ''),
            content,
            size: stat.size
          });
        }
      }
    } catch {}
  }
  walk(VAULT);
  _index = files;
  _indexBuilt = Date.now();
  return files;
}

function getIndex() {
  if (!_index || Date.now() - _indexBuilt > 60_000) buildIndex();
  return _index || [];
}

// ── Search: keyword scoring ───────────────────────────────────────────────────
function searchVault(query, maxResults = 4) {
  const idx = getIndex();
  if (!idx.length) return [];

  // Normalize query
  const q = query.toLowerCase();
  const tokens = q.split(/[\s　，,。、!?！？]+/).filter(t => t.length >= 2);
  if (!tokens.length) return [];

  const scored = idx.map(file => {
    const lc = file.content.toLowerCase();
    const lcName = file.name.toLowerCase();
    let score = 0;

    for (const tok of tokens) {
      // Filename match is high signal
      if (lcName.includes(tok)) score += 10;
      // Content match
      const matches = (lc.match(new RegExp(tok, 'g')) || []).length;
      score += matches;
    }

    // Boost recently modified files
    if (file.relPath.includes('05-Conversations/')) score *= 0.7; // de-emphasize raw digests
    if (file.relPath.startsWith('00-Brain/')) score *= 1.5;
    if (file.relPath.startsWith('01-Projects/')) score *= 1.3;
    if (file.relPath.startsWith('02-People/')) score *= 1.2;

    return { file, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.file);
}

// ── Format retrieved files for prompt injection (token-conscious) ─────────────
function formatForPrompt(files, maxTotalChars = 3000) {
  if (!files.length) return '';
  let out = '## RELEVANT VAULT KNOWLEDGE\n\n';
  let usedChars = out.length;

  for (const f of files) {
    // Strip frontmatter for cleaner injection
    const body = f.content.replace(/^---[\s\S]*?---\n/, '').trim();
    const snippet = body.slice(0, 800); // per-file cap
    const block = `### ${f.relPath}\n${snippet}\n\n`;
    if (usedChars + block.length > maxTotalChars) break;
    out += block;
    usedChars += block.length;
  }

  return out;
}

// ── Hybrid retrieve: semantic + keyword (free if no LLM call needed) ──────────
async function retrieve(query, opts = {}) {
  const maxResults = opts.maxResults || 5;
  const maxChars = opts.maxChars || 3000;

  // 1. Keyword search (free, fast)
  const keywordHits = searchVault(query, maxResults * 2);

  // 2. Semantic search (only if openai client available + embeddings exist)
  const idx = loadEmbeddings();
  let semanticHits = [];
  if (idx.vectors.length > 0 && _embModule && opts.openai !== false) {
    try {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const qRes = await openai.embeddings.create({ model: 'text-embedding-3-small', input: [query] });
      const qVec = qRes.data[0].embedding;
      semanticHits = idx.vectors
        .map(v => ({ ...v, score: cosine(qVec, v.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults * 2);
    } catch(e) { /* fall through to keyword-only */ }
  }

  // 3. Hybrid fusion: combine and dedupe by file
  const fileScores = {};
  keywordHits.forEach((f, i) => {
    fileScores[f.relPath] = (fileScores[f.relPath] || 0) + (maxResults * 2 - i);
  });
  semanticHits.forEach((s, i) => {
    fileScores[s.file] = (fileScores[s.file] || 0) + (maxResults * 2 - i) * 1.5; // semantic weighted higher
  });

  // 4. Get top files
  const topFiles = Object.entries(fileScores)
    .sort(([,a], [,b]) => b - a)
    .slice(0, maxResults)
    .map(([relPath]) => getIndex().find(f => f.relPath === relPath))
    .filter(Boolean);

  const formatted = formatForPrompt(topFiles, maxChars);
  return {
    files: topFiles.map(f => f.relPath),
    context: formatted,
    chars: formatted.length,
    semanticUsed: semanticHits.length > 0
  };
}

// ── Heuristic: should we even retrieve? (saves tokens) ────────────────────────
function shouldRetrieve(text) {
  const t = text.toLowerCase().trim();
  // Skip pure commands
  if (['status','help','show tasks','daily briefing','bitable status','test stale','test n2m'].some(c => t === c)) return false;
  // Skip very short greetings
  if (t.length < 6) return false;
  // Retrieve when there's a name/topic
  return /[A-Za-z一-龥]{3,}/.test(t);
}

module.exports = { retrieve, searchVault, buildIndex, shouldRetrieve, VAULT };
