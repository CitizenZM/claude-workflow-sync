// ─────────────────────────────────────────────────────────────────────────────
// fetch_history.js — Fetch historical messages from ANY Feishu group
// Uses user_access_token → bypasses bot-membership restriction
// Fetches with start_time/end_time → full date range support
//
// Usage:
//   node fetch_history.js --all                  # all groups, last 90 days
//   node fetch_history.js --group oc_xxx --days 30
//   node fetch_history.js --list                 # list accessible groups
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { getValidToken } = require('./oauth_server');
const { spawn } = require('child_process');

const HISTORY_DIR = path.join(__dirname, 'history');
const VAULT = process.env.VAULT_PATH || path.join(os.homedir(), 'ObsidianVault/Clawdbot');

const STATS = { groups: 0, messages: 0, errors: 0 };

// ── API helper ────────────────────────────────────────────────────────────────
async function apiGet(apiPath, userToken) {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: 'open.feishu.cn',
      path: `/open-apis${apiPath}`,
      headers: { Authorization: `Bearer ${userToken}` }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

// ── List all chats the user is in ─────────────────────────────────────────────
async function listUserChats(userToken) {
  const chats = [];
  let pageToken = '';
  let page = 0;

  while (page < 20) { // safety cap
    const url = `/im/v1/chats?page_size=100&user_id_type=open_id${pageToken ? `&page_token=${pageToken}` : ''}`;
    const res = await apiGet(url, userToken);
    if (res.code !== 0) { console.error(`❌ List chats failed: ${res.msg}`); break; }
    chats.push(...(res.data?.items || []));
    if (!res.data?.has_more || !res.data?.page_token) break;
    pageToken = res.data.page_token;
    page++;
  }
  return chats;
}

// ── Fetch messages with full pagination ───────────────────────────────────────
async function fetchChatMessages(chatId, userToken, opts = {}) {
  const {
    startTime,  // epoch seconds
    endTime,    // epoch seconds
    maxMessages = 10000,
    onProgress
  } = opts;

  const messages = [];
  let pageToken = '';
  let page = 0;

  while (messages.length < maxMessages && page < 200) {
    const params = new URLSearchParams({
      container_id_type: 'chat',
      container_id: chatId,
      sort_type: 'ByCreateTimeDesc',
      page_size: '50'
    });
    if (startTime) params.set('start_time', String(startTime));
    if (endTime) params.set('end_time', String(endTime));
    if (pageToken) params.set('page_token', pageToken);

    const res = await apiGet(`/im/v1/messages?${params}`, userToken);

    if (res.code !== 0) {
      console.error(`     ❌ API error: ${res.msg} (code: ${res.code})`);
      STATS.errors++;
      break;
    }

    const items = res.data?.items || [];
    if (!items.length) break;

    for (const msg of items) {
      const body = msg.body?.content;
      let text = '';
      try { text = JSON.parse(body || '{}').text || ''; } catch {}

      // Parse sender info
      const senderId = msg.sender?.id;
      const senderType = msg.sender?.id_type;

      // Extract links from content
      const links = [];
      try {
        const parsed = JSON.parse(body || '{}');
        (parsed.elements || parsed.content || []).flat().forEach(el => {
          if (el?.tag === 'a' && el.href) links.push(el.href);
        });
      } catch {}

      messages.push({
        id: msg.message_id,
        chatId,
        msgType: msg.msg_type,
        senderId,
        senderType,
        text: text.trim(),
        rawContent: body || '',
        createTime: parseInt(msg.create_time),
        updateTime: parseInt(msg.update_time || msg.create_time),
        hasLinks: links.length > 0,
        links: links.slice(0, 5),
        thread: msg.thread_id || null,
        replyMsgId: msg.parent_id || null
      });
    }

    if (onProgress) onProgress(messages.length, page + 1);

    if (!res.data?.has_more || !res.data?.page_token) break;
    pageToken = res.data.page_token;
    page++;

    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 100));
  }

  return messages;
}

// ── Save to history directory ─────────────────────────────────────────────────
function saveHistory(groupName, chatId, messages) {
  if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });
  const safeKey = chatId.slice(-8);
  const fileName = `${groupName.replace(/[^\w一-龥]/g,'_').slice(0,30)}_${safeKey}.json`;
  const filePath = path.join(HISTORY_DIR, fileName);

  // Merge with existing if present
  let existing = [];
  if (fs.existsSync(filePath)) {
    try {
      existing = JSON.parse(fs.readFileSync(filePath));
      const existingIds = new Set(existing.map(m => m.id));
      const newMsgs = messages.filter(m => !existingIds.has(m.id));
      existing.push(...newMsgs);
      existing.sort((a, b) => a.createTime - b.createTime);
    } catch { existing = messages; }
  } else {
    existing = messages.sort((a, b) => a.createTime - b.createTime);
  }

  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));
  return { filePath, fileName, total: existing.length };
}

// ── Process through learn pipeline ───────────────────────────────────────────
async function processWithLearn(filePath, groupName) {
  return new Promise(resolve => {
    const child = spawn('node', ['import_history.js', path.basename(filePath), groupName], {
      cwd: __dirname, stdio: ['pipe', 'pipe', 'pipe']
    });
    let out = '';
    child.stdout.on('data', d => { out += d; process.stdout.write('.'); });
    child.on('close', () => {
      const summary = out.split('\n').filter(l => l.includes('📊') || l.includes('💰') || l.includes('✅')).join(' | ');
      resolve(summary);
    });
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const listOnly = args.includes('--list');
  const fetchAll = args.includes('--all');
  const groupIdx = args.indexOf('--group');
  const groupArg = groupIdx >= 0 ? args[groupIdx + 1] : null;
  const daysIdx = args.indexOf('--days');
  const daysArg = daysIdx >= 0 ? parseInt(args[daysIdx + 1]) || 90 : 90;
  const processArg = !args.includes('--no-process'); // default: auto-process

  console.log('📡 Feishu History Fetcher');
  console.log(`   user_access_token: enabled`);
  console.log(`   Lookback: ${daysArg} days\n`);

  // Get valid user token
  const userToken = await getValidToken();
  if (!userToken) {
    console.error('❌ No valid user_access_token. Run: node oauth_server.js');
    process.exit(1);
  }
  console.log('✅ user_access_token valid\n');

  // List all accessible chats
  console.log('📋 Fetching chat list...');
  const chats = await listUserChats(userToken);
  console.log(`   Found ${chats.length} chats\n`);

  if (listOnly || chats.length === 0) {
    console.log('Chat list:');
    chats.forEach(c => console.log(`  ${c.chat_type === 'p2p' ? '👤' : '👥'} ${c.name || '(unnamed)'} | ${c.chat_id} | ${c.member_count || '?'} members`));
    return;
  }

  // Update ops_data with all accessible groups
  const opsPath = path.join(__dirname, 'ops_data.json');
  const ops = JSON.parse(fs.readFileSync(opsPath));
  let newGroupsFound = 0;
  for (const c of chats) {
    if (c.chat_type !== 'group') continue;
    const key = (c.name || '').replace(/[（）()【】\[\]\s]/g,'_').replace(/[^\w一-鿿_]/g,'').slice(0,30) || c.chat_id.slice(-8);
    if (!ops.chats[key]) {
      ops.chats[key] = c.chat_id;
      newGroupsFound++;
    }
  }
  if (newGroupsFound > 0) {
    fs.writeFileSync(opsPath, JSON.stringify(ops, null, 2));
    console.log(`✅ Added ${newGroupsFound} new groups to ops_data.json\n`);
  }

  // Time range
  const endTime = Math.floor(Date.now() / 1000);
  const startTime = endTime - daysArg * 86400;

  // Select target chats
  let targets = [];
  if (groupArg) {
    const found = chats.find(c => c.chat_id === groupArg || c.name?.includes(groupArg));
    if (!found) { console.error(`Group not found: ${groupArg}`); process.exit(1); }
    targets = [found];
  } else if (fetchAll) {
    // chat_type may be missing from user-token API; include all non-p2p chats
    targets = chats.filter(c => c.chat_type === 'group' || !c.chat_type);
  } else {
    // Default: priority groups (ones already in ops_data)
    const knownIds = new Set(Object.values(ops.chats));
    targets = chats.filter(c => knownIds.has(c.chat_id));
    if (!targets.length) targets = chats.filter(c => c.chat_type === 'group').slice(0, 5);
  }

  console.log(`🎯 Fetching ${targets.length} group(s):\n`);

  // Fetch each
  for (const chat of targets) {
    const name = chat.name || chat.chat_id.slice(-8);
    console.log(`\n📥 ${name} (${chat.chat_id})`);
    console.log(`   Members: ${chat.member_count || '?'} | Type: ${chat.chat_type}`);

    try {
      const messages = await fetchChatMessages(chat.chat_id, userToken, {
        startTime, endTime,
        maxMessages: 5000,
        onProgress: (count, page) => {
          if (page % 5 === 0) process.stdout.write(`\r   Fetched: ${count} msgs (page ${page})`);
        }
      });

      console.log(`\r   ✅ Fetched: ${messages.length} messages`);
      STATS.messages += messages.length;
      STATS.groups++;

      if (messages.length === 0) { console.log('   (no messages in range)'); continue; }

      // Save to disk
      const { filePath, total } = saveHistory(name, chat.chat_id, messages);
      console.log(`   💾 Saved: ${path.basename(filePath)} (${total} total incl. previous)`);

      // Auto-process through learn pipeline
      if (processArg && messages.length > 0) {
        process.stdout.write('   🧠 Processing through vault pipeline');
        const summary = await processWithLearn(filePath, name);
        console.log(`\n   ${summary}`);
      }
    } catch(e) {
      console.error(`\n   ❌ Error: ${e.message}`);
      STATS.errors++;
    }
  }

  // Final summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 Summary');
  console.log(`   Groups fetched: ${STATS.groups}`);
  console.log(`   Total messages: ${STATS.messages}`);
  console.log(`   Errors: ${STATS.errors}`);
  console.log(`   Files in: ${HISTORY_DIR}`);
  if (!listOnly && processArg) console.log(`   Vault updated: ${VAULT}`);

  // Append to learning log
  const logPath = path.join(VAULT, '00-Brain', 'Learning-Log.md');
  if (fs.existsSync(path.dirname(logPath))) {
    fs.appendFileSync(logPath,
      `\n## ${new Date().toISOString()} — user_access_token History Fetch\n- Groups: ${STATS.groups} | Messages: ${STATS.messages} | Days: ${daysArg}\n`);
  }
}

if (require.main === module) main().catch(e => { console.error('❌', e.message); process.exit(1); });

module.exports = { fetchChatMessages, listUserChats };
