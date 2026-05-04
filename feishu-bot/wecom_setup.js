// ─────────────────────────────────────────────────────────────────────────────
// wecom_setup.js — Validate WeCom credentials and print setup status
// Run: node wecom_setup.js
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const axios = require('axios');

const CORP_ID    = process.env.WECOM_CORP_ID;
const AGENT_ID   = process.env.WECOM_AGENT_ID;
const APP_SECRET = process.env.WECOM_APP_SECRET;
const TOKEN      = process.env.WECOM_TOKEN;
const AES_KEY    = process.env.WECOM_ENCODING_AES_KEY;
const BARRON_ID  = process.env.WECOM_BARRON_USERID; // optional: your WeCom user ID

async function main() {
  console.log('\n🔍 WeCom Setup Validator\n');
  console.log('━'.repeat(50));

  // 1. Check env vars
  const checks = { WECOM_CORP_ID: CORP_ID, WECOM_AGENT_ID: AGENT_ID, WECOM_APP_SECRET: APP_SECRET };
  let allPresent = true;
  for (const [k, v] of Object.entries(checks)) {
    const ok = !!v;
    console.log(`${ok ? '✅' : '❌'} ${k}: ${ok ? v.slice(0, 8) + '...' : 'MISSING'}`);
    if (!ok) allPresent = false;
  }
  console.log(`${TOKEN ? '✅' : '⚠️ '} WECOM_TOKEN: ${TOKEN ? 'set' : 'not set (needed for callback)'}`);
  console.log(`${AES_KEY ? '✅' : '⚠️ '} WECOM_ENCODING_AES_KEY: ${AES_KEY ? 'set' : 'not set (safe mode, no encryption)'}`);

  if (!allPresent) {
    console.log('\n❌ Add missing values to .env and re-run');
    process.exit(1);
  }

  // 2. Fetch access token
  console.log('\n━'.repeat(50));
  console.log('🔑 Testing access token...');
  let token;
  try {
    const r = await axios.get(`https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${CORP_ID}&corpsecret=${APP_SECRET}`);
    if (r.data.errcode && r.data.errcode !== 0) throw new Error(`errcode ${r.data.errcode}: ${r.data.errmsg}`);
    token = r.data.access_token;
    console.log(`✅ Token obtained: ${token.slice(0, 20)}... (expires in ${r.data.expires_in}s)`);
  } catch(e) {
    console.error('❌ Token failed:', e.message);
    console.log('   → Check WECOM_APP_SECRET matches the app in WeCom console');
    process.exit(1);
  }

  // 3. Get app info
  console.log('\n━'.repeat(50));
  console.log('📱 Fetching app info...');
  try {
    const r = await axios.get(`https://qyapi.weixin.qq.com/cgi-bin/agent/get?access_token=${token}&agentid=${AGENT_ID}`);
    if (r.data.errcode !== 0) throw new Error(`errcode ${r.data.errcode}: ${r.data.errmsg}`);
    console.log(`✅ App: ${r.data.name}`);
    console.log(`   Agent ID: ${r.data.agentid}`);
    console.log(`   Square logo: ${r.data.square_logo_url ? 'set' : 'not set'}`);
    console.log(`   Allow userinfos: ${r.data.allow_userinfos?.user?.length || 0} users`);
  } catch(e) {
    console.error('❌ App fetch failed:', e.message);
    console.log('   → Check WECOM_AGENT_ID is correct');
  }

  // 4. Send test DM (only if WECOM_BARRON_USERID is set)
  if (BARRON_ID) {
    console.log('\n━'.repeat(50));
    console.log(`📨 Sending test message to ${BARRON_ID}...`);
    try {
      const r = await axios.post(
        `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`,
        { touser: BARRON_ID, msgtype: 'text', agentid: Number(AGENT_ID),
          text: { content: '🤖 Clawdbot WeCom setup validated! Bot is ready.' }, safe: 0 }
      );
      if (r.data.errcode !== 0) throw new Error(`errcode ${r.data.errcode}: ${r.data.errmsg}`);
      console.log('✅ Test message sent — check your WeCom app!');
    } catch(e) {
      console.error('❌ Message send failed:', e.message);
    }
  } else {
    console.log('\n💡 Tip: Add WECOM_BARRON_USERID=your_userid to .env to test message sending');
  }

  // 5. Summary
  console.log('\n' + '━'.repeat(50));
  console.log('📋 Next steps:');
  console.log('   1. node wecom_bot.js                     # start bot locally');
  console.log('   2. ngrok http 3001                        # expose to internet');
  console.log('   3. Paste ngrok URL into WeCom callback    # 接收消息 > URL');
  console.log('   4. WeCom will GET /wecom/callback         # to verify');
  console.log('   5. Send a message in WeCom app → bot replies!');
  console.log('\n✅ Setup complete. Bot is ready to start.\n');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
