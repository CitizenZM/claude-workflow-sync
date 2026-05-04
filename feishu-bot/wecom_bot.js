// ─────────────────────────────────────────────────────────────────────────────
// wecom_bot.js — Clawdbot brain connected to 企业微信 (WeCom)
// Uses the same vault.js + embeddings.json as the Feishu bot
//
// Usage:
//   node wecom_bot.js           # start on port 3001
//   PORT=8080 node wecom_bot.js # custom port
//
// Required .env keys:
//   WECOM_CORP_ID        — from 企业信息 > CorpID
//   WECOM_AGENT_ID       — from 应用管理 > AgentId
//   WECOM_APP_SECRET     — from 应用管理 > Secret
//   WECOM_TOKEN          — set in 接收消息 callback config
//   WECOM_ENCODING_AES_KEY — set in 接收消息 callback config
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const express = require('express');
const xml2js  = require('xml2js');
const axios   = require('axios');
const crypto  = require('crypto');
const OpenAI  = require('openai');
const vault   = require('./vault');

// ── Config ────────────────────────────────────────────────────────────────────
const CORP_ID      = process.env.WECOM_CORP_ID;
const AGENT_ID     = process.env.WECOM_AGENT_ID;
const APP_SECRET   = process.env.WECOM_APP_SECRET;
const TOKEN        = process.env.WECOM_TOKEN;
const AES_KEY      = process.env.WECOM_ENCODING_AES_KEY;
const PORT         = process.env.WECOM_PORT || 3001;
const OPENAI_KEY   = process.env.OPENAI_API_KEY;

if (!CORP_ID || !AGENT_ID || !APP_SECRET) {
  console.error('❌ Missing WECOM_CORP_ID / WECOM_AGENT_ID / WECOM_APP_SECRET in .env');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_KEY });
const app    = express();

// Parse raw body for XML signature verification
app.use(express.raw({ type: ['application/xml', 'text/xml', '*/*'] }));

// ── WeCom access token (cached, auto-refresh) ─────────────────────────────────
let _token = '', _tokenExp = 0;
async function getAccessToken() {
  if (_token && Date.now() < _tokenExp) return _token;
  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${CORP_ID}&corpsecret=${APP_SECRET}`;
  const r = await axios.get(url);
  if (r.data.errcode && r.data.errcode !== 0) {
    throw new Error(`WeCom token error ${r.data.errcode}: ${r.data.errmsg}`);
  }
  _token    = r.data.access_token;
  _tokenExp = Date.now() + (r.data.expires_in - 60) * 1000;
  console.log('🔑 WeCom token refreshed, expires in', r.data.expires_in, 's');
  return _token;
}

// ── Send text message ─────────────────────────────────────────────────────────
async function sendText(toUser, text) {
  const tok = await getAccessToken();
  const r = await axios.post(
    `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${tok}`,
    {
      touser:  toUser,
      msgtype: 'text',
      agentid: Number(AGENT_ID),
      text:    { content: text },
      safe:    0
    }
  );
  if (r.data.errcode !== 0) {
    console.error('❌ sendText error:', r.data.errcode, r.data.errmsg);
  }
  return r.data;
}

// ── WeCom message signature verification ─────────────────────────────────────
function verifySignature(token, timestamp, nonce, msgEncrypt) {
  // Sort + SHA1
  const arr = [token, timestamp, nonce, msgEncrypt].filter(Boolean).sort();
  const str = arr.join('');
  return crypto.createHash('sha1').update(str).digest('hex');
}

// ── AES decrypt WeCom message ─────────────────────────────────────────────────
function decryptMessage(encryptedMsg) {
  if (!AES_KEY) return null; // plaintext mode (no encryption configured)
  try {
    const key = Buffer.from(AES_KEY + '=', 'base64');
    const iv  = key.slice(0, 16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    decipher.setAutoPadding(false);
    let decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedMsg, 'base64')),
      decipher.final()
    ]);
    // Remove PKCS7 padding
    const pad = decrypted[decrypted.length - 1];
    decrypted = decrypted.slice(0, decrypted.length - pad);
    // Format: random(16) + msgLen(4) + msg + corpId
    const msgLen = decrypted.slice(16, 20).readUInt32BE(0);
    const msgContent = decrypted.slice(20, 20 + msgLen).toString('utf8');
    return msgContent;
  } catch(e) {
    console.error('AES decrypt error:', e.message);
    return null;
  }
}

// ── Core brain: vault retrieval + GPT reply ───────────────────────────────────
async function think(userText, fromUser) {
  let vaultCtx = '';
  if (vault.shouldRetrieve(userText)) {
    try {
      const r = await vault.retrieve(userText, { maxResults: 4, maxChars: 3000 });
      vaultCtx = r.context;
      if (r.files.length) console.log(`   📚 Vault: ${r.files.length} files (semantic: ${r.semanticUsed})`);
    } catch(e) { console.error('Vault error:', e.message); }
  }

  const res = await openai.chat.completions.create({
    model:      'gpt-4o',
    max_tokens: 600,
    messages: [
      {
        role:    'system',
        content: `You are Clawdbot, the intelligent ops assistant for Cell Digital Technology / Next2Market.
You have deep knowledge of all team conversations, decisions, tasks, people, and projects from the past 90 days.
Respond in the same language the user writes (Chinese or English).
Be concise — WeCom messages work best under 300 words. Use bullet points for lists.
${vaultCtx}`
      },
      { role: 'user', content: userText }
    ]
  });
  return res.choices[0].message.content.trim();
}

// ── Parse XML body ────────────────────────────────────────────────────────────
async function parseXML(body) {
  const str = Buffer.isBuffer(body) ? body.toString('utf8') : String(body);
  const result = await xml2js.parseStringPromise(str, { explicitArray: false });
  return result.xml || result;
}

// ── GET: callback URL verification ───────────────────────────────────────────
app.get('/wecom/callback', (req, res) => {
  const { msg_signature, timestamp, nonce, echostr } = req.query;

  if (!TOKEN) {
    // No token set — just echo back for now
    return res.send(echostr);
  }

  // Verify signature
  const computed = verifySignature(TOKEN, timestamp, nonce, '');
  // For echostr verification WeCom uses: SHA1(sort(token, timestamp, nonce))
  const arr = [TOKEN, timestamp, nonce].sort();
  const sig = crypto.createHash('sha1').update(arr.join('')).digest('hex');

  if (sig !== msg_signature) {
    console.warn('⚠️  Signature mismatch on GET verification');
    return res.status(403).send('Signature mismatch');
  }

  // Decrypt echostr if encrypted
  if (AES_KEY && echostr) {
    const plain = decryptMessage(echostr);
    return res.send(plain || echostr);
  }
  res.send(echostr);
});

// ── POST: receive messages ────────────────────────────────────────────────────
app.post('/wecom/callback', async (req, res) => {
  // ACK immediately — WeCom requires response within 5 seconds
  res.send('success');

  try {
    const xml = await parseXML(req.body);

    // Handle encrypted messages
    let msgXml = xml;
    if (xml.Encrypt && AES_KEY) {
      const decrypted = decryptMessage(xml.Encrypt);
      if (!decrypted) return;
      msgXml = await parseXML(decrypted);
    }

    const msgType  = msgXml.MsgType;
    const fromUser = msgXml.FromUserName;
    const text     = msgXml.Content?.trim();

    console.log(`\n📨 [${msgType}] from ${fromUser?.slice(-8)}: ${text?.slice(0, 60)}`);

    // Only handle text messages
    if (msgType !== 'text' || !text || !fromUser) return;

    // Think and reply
    const reply = await think(text, fromUser);
    console.log(`   💬 Reply: ${reply.slice(0, 80)}...`);
    await sendText(fromUser, reply);

  } catch(e) {
    console.error('❌ Message handler error:', e.message);
  }
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await getAccessToken();
    res.json({ status: 'ok', wecom: 'connected', vault: vault.VAULT, port: PORT });
  } catch(e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log('\n🟢 Clawdbot WeCom Bot');
  console.log(`   Port:     ${PORT}`);
  console.log(`   Callback: http://YOUR_SERVER:${PORT}/wecom/callback`);
  console.log(`   Health:   http://localhost:${PORT}/health`);
  console.log(`   Corp ID:  ${CORP_ID}`);
  console.log(`   Agent ID: ${AGENT_ID}`);
  console.log(`   Vault:    ${vault.VAULT}\n`);

  // Warm up vault index
  vault.buildIndex();

  // Verify token on startup
  try {
    await getAccessToken();
    console.log('✅ WeCom access token obtained');
  } catch(e) {
    console.error('⚠️  Token fetch failed (check WECOM_APP_SECRET):', e.message);
  }
});

module.exports = { app, think, sendText };
