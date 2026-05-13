// ─────────────────────────────────────────────────────────────────────────────
// doc_reader.js — Read Feishu documents, wiki pages, bitable data, and minutes
//
// Prefers user_access_token (Barron's personal access) when available,
// falls back to tenant_access_token (bot-level) otherwise.
// Scopes needed (v1.1.4):
//   - docx:document:readonly  — read document content
//   - wiki:node:read          — read wiki node info
//   - wiki:node:retrieve      — list wiki nodes
//   - wiki:space:read         — read wiki space info
//   - bitable:app:readonly    — read bitable/base data
//   - minutes:minutes:readonly — read meeting minutes
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const lark = require('@larksuiteoapi/node-sdk');
const https = require('https');
const path = require('path');

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;

if (!APP_ID || !APP_SECRET) {
  console.error('Missing FEISHU_APP_ID or FEISHU_APP_SECRET');
  process.exit(1);
}

const client = new lark.Client({ appId: APP_ID, appSecret: APP_SECRET });

// ── User token (from oauth_server.js) ───────────────────────────────────────
const { getValidToken } = require('./oauth_server');

// ── Tenant token (cached, fallback) ─────────────────────────────────────────
let _tenantTok = '', _tenantTokExp = 0;
async function getTenantToken() {
  if (_tenantTok && Date.now() < _tenantTokExp) return _tenantTok;
  const body = JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET });
  const res = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'open.feishu.cn',
      path: '/open-apis/auth/v3/tenant_access_token/internal',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, resp => {
      let d = ''; resp.on('data', c => d += c);
      resp.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
  _tenantTok = res.tenant_access_token;
  _tenantTokExp = Date.now() + (res.expire - 60) * 1000;
  return _tenantTok;
}

// ── Get best available token (user > tenant) ────────────────────────────────
async function getToken() {
  try {
    const userTok = await getValidToken();
    if (userTok) return userTok;
  } catch (e) { /* user token unavailable, fall back */ }
  return getTenantToken();
}

// ── Raw API helper (for endpoints not in SDK) ───────────────────────────────
async function feishuApi(method, apiPath, body) {
  const tok = await getToken();
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'open.feishu.cn',
      path: `/open-apis${apiPath}`,
      method,
      headers: {
        Authorization: `Bearer ${tok}`,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    };
    const req = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { resolve({ raw: d }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. DOCUMENT READER — Read Feishu Docs (docx)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Get raw content of a Feishu document.
 * @param {string} documentId - The document ID (from URL: /docx/{documentId})
 * @returns {object} - Document content with blocks
 */
async function readDocument(documentId) {
  try {
    // Get document metadata (using user token via feishuApi)
    const metaRes = await feishuApi('GET', `/docx/v1/documents/${documentId}`);
    if (metaRes.code && metaRes.code !== 0) throw new Error(metaRes.msg || `API error ${metaRes.code}`);
    const meta = metaRes?.data?.document || {};

    // Get all blocks (content)
    const blocks = [];
    let pageToken = '';
    do {
      const url = `/docx/v1/documents/${documentId}/blocks?page_size=500${pageToken ? `&page_token=${pageToken}` : ''}`;
      const blockRes = await feishuApi('GET', url);
      if (blockRes.code && blockRes.code !== 0) throw new Error(blockRes.msg || `API error ${blockRes.code}`);
      if (blockRes?.data?.items) blocks.push(...blockRes.data.items);
      pageToken = blockRes?.data?.page_token || '';
    } while (pageToken);

    return { meta, blocks, blockCount: blocks.length };
  } catch (err) {
    console.error(`Failed to read document ${documentId}:`, err.message);
    return { error: err.message };
  }
}

/**
 * Extract plain text from document blocks.
 * Handles paragraphs, headings, lists, code blocks, tables, etc.
 */
function blocksToText(blocks) {
  if (!blocks || !blocks.length) return '';
  const lines = [];

  for (const block of blocks) {
    const type = block.block_type;
    let text = '';

    // Extract text elements from a block's content
    const extractElements = (elements) => {
      if (!elements) return '';
      return elements.map(el => {
        if (el.text_run) return el.text_run.content || '';
        if (el.mention_user) return `@${el.mention_user.user_id || 'user'}`;
        if (el.mention_doc) return `[doc:${el.mention_doc.token || ''}]`;
        return '';
      }).join('');
    };

    switch (type) {
      case 1: // Page (root)
        break;
      case 2: // Text / Paragraph
        text = extractElements(block.paragraph?.elements);
        if (text) lines.push(text);
        break;
      case 3: // Heading 1
      case 4: // Heading 2
      case 5: // Heading 3
      case 6: // Heading 4
      case 7: // Heading 5
      case 8: // Heading 6
      case 9: // Heading 7-9
        text = extractElements(block[`heading${type - 2}`]?.elements || block.paragraph?.elements);
        if (text) lines.push(`${'#'.repeat(type - 2)} ${text}`);
        break;
      case 10: // Unordered list
        text = extractElements(block.bullet?.elements || block.paragraph?.elements);
        if (text) lines.push(`- ${text}`);
        break;
      case 11: // Ordered list
        text = extractElements(block.ordered?.elements || block.paragraph?.elements);
        if (text) lines.push(`1. ${text}`);
        break;
      case 12: // Code block
        text = extractElements(block.code?.elements || block.paragraph?.elements);
        if (text) lines.push(`\`\`\`\n${text}\n\`\`\``);
        break;
      case 13: // Quote
        text = extractElements(block.quote?.elements || block.paragraph?.elements);
        if (text) lines.push(`> ${text}`);
        break;
      case 14: // Todo / Checkbox
        text = extractElements(block.todo?.elements || block.paragraph?.elements);
        const checked = block.todo?.style?.done ? 'x' : ' ';
        if (text) lines.push(`- [${checked}] ${text}`);
        break;
      case 18: // Divider
        lines.push('---');
        break;
      case 22: // Table (handle child blocks separately)
        lines.push('[Table]');
        break;
      default:
        // Try generic paragraph extraction
        if (block.paragraph) {
          text = extractElements(block.paragraph.elements);
          if (text) lines.push(text);
        }
    }
  }

  return lines.join('\n');
}

/**
 * Read a Feishu document and return its plain text.
 * @param {string} documentId - Document ID
 * @returns {string} - Plain text content
 */
async function readDocumentAsText(documentId) {
  const { blocks, error } = await readDocument(documentId);
  if (error) return `Error: ${error}`;
  return blocksToText(blocks);
}

// ═════════════════════════════════════════════════════════════════════════════
// 2. WIKI READER — Read Feishu Wiki spaces and nodes
// ═════════════════════════════════════════════════════════════════════════════

/**
 * List all wiki spaces the app can access.
 */
async function listWikiSpaces() {
  const spaces = [];
  let pageToken = '';
  do {
    const res = await feishuApi('GET',
      `/wiki/v2/spaces?page_size=50${pageToken ? '&page_token=' + pageToken : ''}`);
    if (res?.data?.items) spaces.push(...res.data.items);
    pageToken = res?.data?.page_token || '';
  } while (pageToken);
  return spaces;
}

/**
 * List child nodes of a wiki space or parent node.
 * @param {string} spaceId - Wiki space ID
 * @param {string} [parentNodeToken] - Parent node token (omit for root)
 */
async function listWikiNodes(spaceId, parentNodeToken) {
  const nodes = [];
  let pageToken = '';
  do {
    let url = `/wiki/v2/spaces/${spaceId}/nodes?page_size=50`;
    if (parentNodeToken) url += `&parent_node_token=${parentNodeToken}`;
    if (pageToken) url += `&page_token=${pageToken}`;
    const res = await feishuApi('GET', url);
    if (res?.data?.items) nodes.push(...res.data.items);
    pageToken = res?.data?.page_token || '';
  } while (pageToken);
  return nodes;
}

/**
 * Get wiki node info (returns obj_type + obj_token for the underlying doc).
 * @param {string} nodeToken - The wiki node token (from wiki URL)
 */
async function getWikiNode(nodeToken) {
  const res = await feishuApi('GET', `/wiki/v2/spaces/get_node?token=${nodeToken}`);
  return res?.data?.node || null;
}

/**
 * Read a wiki page as text — resolves node → document → text.
 * @param {string} nodeToken - Wiki node token
 */
async function readWikiPageAsText(nodeToken) {
  const node = await getWikiNode(nodeToken);
  if (!node) return 'Error: Wiki node not found';

  if (node.obj_type === 'docx' || node.obj_type === 'doc') {
    return await readDocumentAsText(node.obj_token);
  }
  return `Wiki node type "${node.obj_type}" — obj_token: ${node.obj_token}`;
}

// ═════════════════════════════════════════════════════════════════════════════
// 3. BITABLE READER — Read Feishu Base (multidimensional table) data
// ═════════════════════════════════════════════════════════════════════════════

/**
 * List tables in a bitable app.
 * @param {string} appToken - The bitable app token (from URL)
 */
async function listBitableTables(appToken) {
  const res = await feishuApi('GET', `/bitable/v1/apps/${appToken}/tables?page_size=100`);
  return res?.data?.items || [];
}

/**
 * List fields (columns) of a bitable table.
 */
async function listBitableFields(appToken, tableId) {
  const res = await feishuApi('GET',
    `/bitable/v1/apps/${appToken}/tables/${tableId}/fields?page_size=100`);
  return res?.data?.items || [];
}

/**
 * Read all records from a bitable table.
 * @param {string} appToken - Bitable app token
 * @param {string} tableId - Table ID
 * @param {object} [opts] - Options: { filter, sort, fieldNames, pageSize }
 */
async function readBitableRecords(appToken, tableId, opts = {}) {
  const records = [];
  let pageToken = '';
  const pageSize = opts.pageSize || 500;

  do {
    let url = `/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=${pageSize}`;
    if (pageToken) url += `&page_token=${pageToken}`;
    if (opts.filter) url += `&filter=${encodeURIComponent(opts.filter)}`;
    if (opts.sort) url += `&sort=${encodeURIComponent(JSON.stringify(opts.sort))}`;
    if (opts.fieldNames) url += `&field_names=${encodeURIComponent(JSON.stringify(opts.fieldNames))}`;

    const res = await feishuApi('GET', url);
    if (res?.data?.items) records.push(...res.data.items);
    pageToken = res?.data?.page_token || '';
  } while (pageToken);

  return records;
}

/**
 * Read bitable as a flat array of objects (field name → value).
 */
async function readBitableAsObjects(appToken, tableId, opts = {}) {
  const records = await readBitableRecords(appToken, tableId, opts);
  return records.map(r => {
    const obj = { _record_id: r.record_id };
    if (r.fields) {
      for (const [key, val] of Object.entries(r.fields)) {
        // Flatten Feishu field types to simple values
        if (val === null || val === undefined) {
          obj[key] = null;
        } else if (typeof val === 'object' && val.text) {
          obj[key] = val.text;
        } else if (Array.isArray(val)) {
          obj[key] = val.map(v => v?.text || v?.name || v?.en_name || v).join(', ');
        } else {
          obj[key] = val;
        }
      }
    }
    return obj;
  });
}

// ═════════════════════════════════════════════════════════════════════════════
// 4. MINUTES READER — Read Feishu meeting minutes (妙记)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Get minutes overview (basic info).
 * @param {string} minuteToken - Minutes token (from URL or meeting event)
 */
async function getMinutesInfo(minuteToken) {
  const res = await feishuApi('GET', `/minutes/v1/minutes/${minuteToken}`);
  return res?.data?.minute || null;
}

/**
 * Get minutes transcript (full text of the recording).
 * @param {string} minuteToken - Minutes token
 */
async function getMinutesTranscript(minuteToken) {
  const res = await feishuApi('GET', `/minutes/v1/minutes/${minuteToken}/transcript`);
  return res?.data || null;
}

/**
 * Get minutes as readable text.
 */
async function readMinutesAsText(minuteToken) {
  const [info, transcript] = await Promise.all([
    getMinutesInfo(minuteToken),
    getMinutesTranscript(minuteToken)
  ]);

  const lines = [];
  if (info) {
    lines.push(`# Meeting Minutes: ${info.title || 'Untitled'}`);
    if (info.create_time) lines.push(`Date: ${new Date(info.create_time * 1000).toISOString().slice(0, 10)}`);
    if (info.owner) lines.push(`Owner: ${info.owner.user_name || info.owner.open_id || 'unknown'}`);
    lines.push('');
  }

  if (transcript?.phrases) {
    for (const phrase of transcript.phrases) {
      const speaker = phrase.speaker?.user_name || phrase.speaker?.open_id || 'Unknown';
      const text = phrase.content || '';
      if (text.trim()) lines.push(`[${speaker}]: ${text}`);
    }
  } else if (transcript?.paragraphs) {
    for (const para of transcript.paragraphs) {
      const speaker = para.speaker?.user_name || para.speaker?.open_id || '';
      const text = (para.sentences || []).map(s => s.text || '').join(' ');
      if (text.trim()) lines.push(`${speaker ? `[${speaker}]: ` : ''}${text}`);
    }
  }

  return lines.join('\n') || 'No transcript available';
}

// ═════════════════════════════════════════════════════════════════════════════
// URL PARSER — Extract document ID from Feishu URLs
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Parse a Feishu URL and return { type, token }.
 * Supports: /docx/XXX, /wiki/XXX, /base/XXX, /minutes/XXX
 */
function parseFeishuUrl(url) {
  if (!url) return null;
  const patterns = [
    { regex: /\/docx\/([A-Za-z0-9]+)/, type: 'docx' },
    { regex: /\/wiki\/([A-Za-z0-9]+)/, type: 'wiki' },
    { regex: /\/base\/([A-Za-z0-9]+)/, type: 'bitable' },
    { regex: /\/minutes\/([A-Za-z0-9_-]+)/, type: 'minutes' },
    { regex: /\/sheets\/([A-Za-z0-9]+)/, type: 'sheet' },
  ];

  for (const { regex, type } of patterns) {
    const match = url.match(regex);
    if (match) return { type, token: match[1] };
  }
  return null;
}

/**
 * Read any Feishu content by URL.
 */
async function readByUrl(url) {
  const parsed = parseFeishuUrl(url);
  if (!parsed) return { error: `Cannot parse Feishu URL: ${url}` };

  switch (parsed.type) {
    case 'docx':
      return { type: 'docx', text: await readDocumentAsText(parsed.token) };
    case 'wiki':
      return { type: 'wiki', text: await readWikiPageAsText(parsed.token) };
    case 'minutes':
      return { type: 'minutes', text: await readMinutesAsText(parsed.token) };
    case 'bitable': {
      const tables = await listBitableTables(parsed.token);
      const result = { type: 'bitable', tables: [] };
      for (const table of tables.slice(0, 5)) { // limit to 5 tables
        const records = await readBitableAsObjects(parsed.token, table.table_id);
        result.tables.push({ name: table.name, tableId: table.table_id, recordCount: records.length, records });
      }
      return result;
    }
    default:
      return { error: `Unsupported type: ${parsed.type}` };
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// CLI — Run standalone for testing
// ═════════════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const target = args[1];

  if (!cmd) {
    console.log(`
Usage:
  node doc_reader.js doc <documentId>      Read a Feishu document
  node doc_reader.js wiki <nodeToken>      Read a wiki page
  node doc_reader.js wiki-spaces           List wiki spaces
  node doc_reader.js bitable <appToken>    Read bitable tables & records
  node doc_reader.js minutes <minuteToken> Read meeting minutes transcript
  node doc_reader.js url <feishuUrl>       Auto-detect and read by URL
`);
    return;
  }

  try {
    switch (cmd) {
      case 'doc': {
        console.log(`Reading document: ${target}`);
        const text = await readDocumentAsText(target);
        console.log('\n' + text);
        break;
      }
      case 'wiki': {
        console.log(`Reading wiki page: ${target}`);
        const text = await readWikiPageAsText(target);
        console.log('\n' + text);
        break;
      }
      case 'wiki-spaces': {
        const spaces = await listWikiSpaces();
        console.log(`Found ${spaces.length} wiki spaces:`);
        for (const s of spaces) {
          console.log(`  [${s.space_id}] ${s.name} — ${s.description || 'no description'}`);
        }
        break;
      }
      case 'bitable': {
        console.log(`Reading bitable: ${target}`);
        const tables = await listBitableTables(target);
        for (const t of tables) {
          console.log(`\n── Table: ${t.name} (${t.table_id}) ──`);
          const records = await readBitableAsObjects(target, t.table_id);
          console.log(`  ${records.length} records`);
          if (records.length > 0) {
            console.log('  Fields:', Object.keys(records[0]).filter(k => k !== '_record_id').join(', '));
            for (const r of records.slice(0, 3)) {
              console.log('  ', JSON.stringify(r, null, 0).slice(0, 200));
            }
            if (records.length > 3) console.log(`  ... and ${records.length - 3} more`);
          }
        }
        break;
      }
      case 'minutes': {
        console.log(`Reading minutes: ${target}`);
        const text = await readMinutesAsText(target);
        console.log('\n' + text);
        break;
      }
      case 'url': {
        console.log(`Reading URL: ${target}`);
        const result = await readByUrl(target);
        if (result.error) {
          console.error(result.error);
        } else if (result.text) {
          console.log('\n' + result.text);
        } else if (result.tables) {
          for (const t of result.tables) {
            console.log(`\n── ${t.name} (${t.recordCount} records) ──`);
            for (const r of t.records.slice(0, 3)) {
              console.log('  ', JSON.stringify(r, null, 0).slice(0, 200));
            }
          }
        }
        break;
      }
      default:
        console.log(`Unknown command: ${cmd}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
    if (err.response?.data) console.error('API response:', JSON.stringify(err.response.data, null, 2));
  }
}

if (require.main === module) main();

module.exports = {
  // Document
  readDocument,
  readDocumentAsText,
  blocksToText,
  // Wiki
  listWikiSpaces,
  listWikiNodes,
  getWikiNode,
  readWikiPageAsText,
  // Bitable
  listBitableTables,
  listBitableFields,
  readBitableRecords,
  readBitableAsObjects,
  // Minutes
  getMinutesInfo,
  getMinutesTranscript,
  readMinutesAsText,
  // Utility
  parseFeishuUrl,
  readByUrl,
  client
};
