// ─────────────────────────────────────────────────────────────────────────────
// embeddings.js — MODULE E: Semantic search index
// Embeds vault notes (chunked) using text-embedding-3-small ($0.02/1M tokens)
// Persists to embeddings.json for hybrid (semantic + keyword) retrieval
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');

const VAULT = process.env.VAULT_PATH || path.join(os.homedir(), 'Documents/Obsidian/Clawdbot');
const INDEX_PATH = path.join(__dirname, 'embeddings.json');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const STATS = { added: 0, updated: 0, skipped: 0, costUSD: 0 };

function loadIndex() {
  try { return JSON.parse(fs.readFileSync(INDEX_PATH)); }
  catch { return { vectors: [], builtAt: 0 }; }
}
function saveIndex(idx) { fs.writeFileSync(INDEX_PATH, JSON.stringify(idx)); }

// Walk vault, return all .md files with hash + content
function walkVault() {
  const files = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir)) {
      if (entry.startsWith('.') || entry.startsWith('_')) continue;
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (entry.endsWith('.md')) {
        const content = fs.readFileSync(full, 'utf8');
        files.push({
          path: full,
          relPath: full.replace(VAULT + '/', ''),
          content,
          mtime: stat.mtimeMs
        });
      }
    }
  }
  walk(VAULT);
  return files;
}

// Chunk a markdown file into ~500-token sections (rough — split on headings)
function chunkFile(file) {
  const content = file.content.replace(/^---[\s\S]*?---\n/, ''); // strip frontmatter
  // Split on H2/H3 headings, otherwise into ~600-char chunks
  let chunks = [];
  if (content.match(/^##\s/m)) {
    const sections = content.split(/(?=^##\s)/m);
    chunks = sections.filter(s => s.trim().length > 50).map(s => s.trim());
  } else {
    for (let i = 0; i < content.length; i += 600) {
      const chunk = content.slice(i, i + 700);
      if (chunk.trim().length > 50) chunks.push(chunk);
    }
  }
  if (chunks.length === 0) chunks = [content];

  return chunks.map((text, i) => ({
    chunkId: `${file.relPath}#${i}`,
    file: file.relPath,
    chunkIdx: i,
    text: text.slice(0, 2000), // cap chunk size
    mtime: file.mtime
  }));
}

// Get embeddings for a batch of texts
async function embedBatch(texts) {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts
  });
  // text-embedding-3-small: $0.02 per 1M tokens
  STATS.costUSD += (res.usage.total_tokens / 1e6) * 0.02;
  return res.data.map(d => d.embedding);
}

async function main() {
  console.log('🔍 Module E — Embeddings Index');
  console.log(`📂 Vault: ${VAULT}\n`);

  const idx = loadIndex();
  const knownChunks = new Map(idx.vectors.map(v => [v.chunkId, v]));

  const files = walkVault();
  console.log(`Scanning ${files.length} markdown files...`);

  const allChunks = files.flatMap(chunkFile);
  console.log(`Total chunks: ${allChunks.length}`);

  // Determine which need re-embedding (new or changed)
  const toEmbed = [];
  const newIndex = [];

  for (const chunk of allChunks) {
    const existing = knownChunks.get(chunk.chunkId);
    if (existing && existing.mtime === chunk.mtime && existing.textHash === chunk.text.length) {
      newIndex.push(existing); // reuse
      STATS.skipped++;
    } else {
      toEmbed.push(chunk);
    }
  }

  console.log(`To embed: ${toEmbed.length} (skip: ${STATS.skipped})`);

  // Batch embed (max 100 per call, ~8000 token cap each)
  const BATCH = 50;
  for (let i = 0; i < toEmbed.length; i += BATCH) {
    const batch = toEmbed.slice(i, i + BATCH);
    const texts = batch.map(c => c.text);
    try {
      const vectors = await embedBatch(texts);
      batch.forEach((c, j) => {
        newIndex.push({
          chunkId: c.chunkId,
          file: c.file,
          chunkIdx: c.chunkIdx,
          text: c.text,
          mtime: c.mtime,
          textHash: c.text.length,
          embedding: vectors[j]
        });
        STATS.added++;
      });
      console.log(`  ✅ Batch ${Math.floor(i/BATCH)+1}: ${batch.length} embedded`);
    } catch(e) {
      console.error(`  ❌ Batch error: ${e.message}`);
    }
  }

  saveIndex({ vectors: newIndex, builtAt: Date.now() });

  console.log(`\n💰 Summary:`);
  console.log(`  Added: ${STATS.added} | Reused: ${STATS.skipped}`);
  console.log(`  Total chunks indexed: ${newIndex.length}`);
  console.log(`  Cost: $${STATS.costUSD.toFixed(4)}`);
  console.log(`  Index size: ${(fs.statSync(INDEX_PATH).size / 1024).toFixed(1)} KB`);

  fs.appendFileSync(path.join(VAULT, '00-Brain', 'Learning-Log.md'),
    `\n## ${new Date().toISOString()} — Embeddings (Module E)\n- Added: ${STATS.added} | Total: ${newIndex.length} | Cost: $${STATS.costUSD.toFixed(4)}\n`);
}

// ── Cosine similarity ─────────────────────────────────────────────────────────
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Public: semantic search
async function search(query, opts = {}) {
  const k = opts.k || 5;
  const idx = loadIndex();
  if (!idx.vectors.length) return [];

  const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input: [query] });
  const qVec = res.data[0].embedding;

  const scored = idx.vectors.map(v => ({ ...v, score: cosine(qVec, v.embedding) }));
  return scored.sort((a, b) => b.score - a.score).slice(0, k);
}

if (require.main === module) main().catch(e => { console.error('❌', e.message); process.exit(1); });

module.exports = { main, search, STATS };
