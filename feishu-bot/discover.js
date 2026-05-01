// discover.js — List all conversations the bot can access + what's learnable
require('dotenv').config();
const https = require('https');

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;

let _tok = '';
async function getToken() {
  if (_tok) return _tok;
  const body = JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET });
  const r = await new Promise((res, rej) => {
    const req = https.request({ hostname:'open.feishu.cn', path:'/open-apis/auth/v3/tenant_access_token/internal',
      method:'POST', headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)} },
      resp => { let d=''; resp.on('data',c=>d+=c); resp.on('end',()=>res(JSON.parse(d))); });
    req.on('error',rej); req.write(body); req.end();
  });
  _tok = r.tenant_access_token;
  return _tok;
}

async function api(path) {
  const tok = await getToken();
  return new Promise(res => {
    https.get({ hostname:'open.feishu.cn', path:`/open-apis${path}`, headers:{Authorization:`Bearer ${tok}`}},
      r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>{ try{res(JSON.parse(d));}catch{res({code:-1,raw:d});} }); });
  });
}

async function exploreChat(chat) {
  const result = {
    chat_id: chat.chat_id,
    name: chat.name,
    description: chat.description || '',
    chat_mode: chat.chat_mode,
    chat_type: chat.chat_type,
    tenant_key: chat.tenant_key,
    external: chat.external,
    avatar: !!chat.avatar
  };

  // Member count
  try {
    const members = await api(`/im/v1/chats/${chat.chat_id}/members?page_size=20`);
    result.memberCount = members.data?.member_total || (members.data?.items?.length || 0);
    result.sampleMembers = (members.data?.items || []).slice(0, 5).map(m => m.name || m.member_id_type || '');
  } catch { result.memberCount = '?'; }

  // Pinned messages
  try {
    const pins = await api(`/im/v1/pins?chat_id=${chat.chat_id}&page_size=50`);
    result.pinnedCount = pins.code === 0 ? (pins.data?.items?.length || 0) : 0;
  } catch { result.pinnedCount = 0; }

  // Recent messages + file count
  try {
    const msgs = await api(`/im/v1/messages?container_id_type=chat&container_id=${chat.chat_id}&page_size=20&sort_type=ByCreateTimeDesc`);
    const items = msgs.data?.items || [];
    result.recentMsgCount = items.length;
    const types = {};
    items.forEach(m => { const t = m.msg_type || m.message_type || '?'; types[t] = (types[t]||0)+1; });
    result.msgTypes = types;
    result.fileCount = types.file || 0;
    if (items.length > 0) {
      result.lastMsgTime = new Date(parseInt(items[0].create_time)).toISOString();
    }
  } catch { result.recentMsgCount = '?'; }

  return result;
}

async function main() {
  console.log('🔍 Discovering all conversations the bot can access...\n');
  const tok = await getToken();

  const chats = [];
  let pageToken = '';
  for (let p = 0; p < 10; p++) {
    const r = await api(`/im/v1/chats?page_size=50${pageToken ? `&page_token=${pageToken}` : ''}`);
    chats.push(...(r.data?.items || []));
    if (!r.data?.has_more || !r.data?.page_token) break;
    pageToken = r.data.page_token;
  }

  console.log(`📋 Bot is in ${chats.length} conversation(s)\n`);
  console.log('='.repeat(80));

  let totalLearnable = { msgs: 0, pins: 0, files: 0 };
  for (const c of chats) {
    const info = await exploreChat(c);
    totalLearnable.msgs += info.recentMsgCount || 0;
    totalLearnable.pins += info.pinnedCount || 0;
    totalLearnable.files += info.fileCount || 0;

    console.log(`\n📍 ${info.name || '(unnamed)'}  ${info.external ? '🌍 External' : '🏢 Internal'}`);
    console.log(`   chat_id: ${info.chat_id}`);
    console.log(`   👥 Members: ${info.memberCount}`);
    console.log(`   📌 Pinned messages: ${info.pinnedCount}`);
    console.log(`   📥 Recent visible: ${info.recentMsgCount} msgs (${Object.entries(info.msgTypes||{}).map(([k,v])=>`${k}:${v}`).join(', ')})`);
    console.log(`   📎 Files in recent: ${info.fileCount}`);
    if (info.lastMsgTime) console.log(`   🕐 Last msg: ${info.lastMsgTime}`);
    if (info.description) console.log(`   📝 ${info.description.slice(0,100)}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Total accessible across all conversations:');
  console.log(`   Conversations: ${chats.length}`);
  console.log(`   📥 Recent messages: ${totalLearnable.msgs}`);
  console.log(`   📌 Pinned: ${totalLearnable.pins}`);
  console.log(`   📎 File messages (recent): ${totalLearnable.files}`);
  console.log('\n💡 Note: Bot only sees messages from AFTER it was added to each group.');
  console.log('   To unlock more groups: Add Clawdbot to the group via Feishu Desktop.');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
