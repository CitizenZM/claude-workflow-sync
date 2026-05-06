// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless: WeCom callback handler
// Handles both GET (URL verification) and POST (message receive)
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');
const axios = require('axios');
const { parseString } = require('xml2js');

const CORP_ID = process.env.WECOM_CORP_ID;
const AGENT_ID = process.env.WECOM_AGENT_ID;
const APP_SECRET = process.env.WECOM_APP_SECRET;
const TOKEN = process.env.WECOM_TOKEN;
const AES_KEY = process.env.WECOM_ENCODING_AES_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// ── WeCom access token (cached in memory — short-lived in serverless) ────────
let _token = '', _tokenExp = 0;
async function getAccessToken() {
  if (_token && Date.now() < _tokenExp) return _token;
  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${CORP_ID}&corpsecret=${APP_SECRET}`;
  const r = await axios.get(url);
  if (r.data.errcode && r.data.errcode !== 0) {
    throw new Error(`WeCom token error ${r.data.errcode}: ${r.data.errmsg}`);
  }
  _token = r.data.access_token;
  _tokenExp = Date.now() + (r.data.expires_in - 60) * 1000;
  return _token;
}

// ── Send text message ────────────────────────────────────────────────────────
async function sendText(toUser, text) {
  const tok = await getAccessToken();
  const r = await axios.post(
    `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${tok}`,
    {
      touser: toUser,
      msgtype: 'text',
      agentid: Number(AGENT_ID),
      text: { content: text },
      safe: 0
    }
  );
  return r.data;
}

// ── AES decrypt WeCom message ────────────────────────────────────────────────
function decryptMessage(encryptedMsg) {
  if (!AES_KEY) return null;
  try {
    const key = Buffer.from(AES_KEY + '=', 'base64');
    const iv = key.slice(0, 16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    decipher.setAutoPadding(false);
    let decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedMsg, 'base64')),
      decipher.final()
    ]);
    const pad = decrypted[decrypted.length - 1];
    decrypted = decrypted.slice(0, decrypted.length - pad);
    const msgLen = decrypted.slice(16, 20).readUInt32BE(0);
    const msgContent = decrypted.slice(20, 20 + msgLen).toString('utf8');
    return msgContent;
  } catch (e) {
    console.error('AES decrypt error:', e.message);
    return null;
  }
}

// ── Parse XML ────────────────────────────────────────────────────────────────
function parseXML(str) {
  return new Promise((resolve, reject) => {
    parseString(str, { explicitArray: false }, (err, result) => {
      if (err) reject(err);
      else resolve(result.xml || result);
    });
  });
}

// ── GPT reply (lightweight — no vault in serverless) ─────────────────────────
async function think(userText, fromUser) {
  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({ apiKey: OPENAI_KEY });

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 400,
    messages: [
      {
        role: 'system',
        content: `You are Clawdbot, ops assistant for Cell Digital / Next2Market.
Respond in the same language (Chinese/English). Be concise — under 200 words.
You help with: project status, task reminders, team coordination.
Current date: ${new Date().toISOString().slice(0, 10)}`
      },
      { role: 'user', content: userText }
    ]
  });
  return res.choices[0].message.content.trim();
}

// ── Main handler ─────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  // GET: WeCom URL verification
  if (req.method === 'GET') {
    const { msg_signature, timestamp, nonce, echostr } = req.query;

    if (!TOKEN) return res.send(echostr);

    // Verify signature
    const arr = [TOKEN, timestamp, nonce].sort();
    const sig = crypto.createHash('sha1').update(arr.join('')).digest('hex');

    if (sig !== msg_signature) {
      return res.status(403).send('Signature mismatch');
    }

    // Decrypt echostr if encrypted
    if (AES_KEY && echostr) {
      const plain = decryptMessage(echostr);
      return res.send(plain || echostr);
    }
    return res.send(echostr);
  }

  // POST: Receive message
  if (req.method === 'POST') {
    // ACK immediately
    res.send('success');

    try {
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      let xml;

      // Try parsing as XML
      try {
        xml = await parseXML(body);
      } catch {
        // Maybe it's already parsed by Vercel
        xml = req.body;
      }

      // Handle encrypted messages
      let msgXml = xml;
      if (xml.Encrypt && AES_KEY) {
        const decrypted = decryptMessage(xml.Encrypt);
        if (!decrypted) return;
        msgXml = await parseXML(decrypted);
      }

      const msgType = msgXml.MsgType;
      const fromUser = msgXml.FromUserName;
      const text = (msgXml.Content || '').trim();

      console.log(`[WeCom] ${msgType} from ${fromUser}: ${text?.slice(0, 60)}`);

      if (msgType !== 'text' || !text || !fromUser) return;

      // Think and reply
      const reply = await think(text, fromUser);
      console.log(`[WeCom] Reply: ${reply.slice(0, 80)}`);
      await sendText(fromUser, reply);

    } catch (e) {
      console.error('WeCom handler error:', e.message);
    }
  }
};
