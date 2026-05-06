// ─────────────────────────────────────────────────────────────────────────────
// Vercel Serverless: WeCom Webhook Message Sender
// Uses 消息推送 webhook — NO IP whitelist, NO ICP domain required
// POST /webhook-send with { text, groupKey } or env WECOM_WEBHOOK_KEY
// ─────────────────────────────────────────────────────────────────────────────

const axios = require('axios');

// Webhook key map — set via Vercel env vars
// WECOM_WEBHOOK_DEFAULT = main group webhook key
// WECOM_WEBHOOK_<NAME>  = named group webhook key
function getWebhookUrl(groupKey) {
  const key = groupKey
    ? process.env[`WECOM_WEBHOOK_${groupKey.toUpperCase()}`] || process.env.WECOM_WEBHOOK_DEFAULT
    : process.env.WECOM_WEBHOOK_DEFAULT;
  if (!key) throw new Error(`No webhook key found for group: ${groupKey || 'default'}`);
  return `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${key}`;
}

// Send text message via webhook
async function sendWebhookText(text, groupKey, mentions = []) {
  const url = getWebhookUrl(groupKey);
  const payload = {
    msgtype: 'text',
    text: {
      content: text,
      mentioned_list: mentions.length ? mentions : undefined
    }
  };
  const r = await axios.post(url, payload);
  return r.data;
}

// Send markdown message via webhook
async function sendWebhookMarkdown(content, groupKey) {
  const url = getWebhookUrl(groupKey);
  const r = await axios.post(url, {
    msgtype: 'markdown',
    markdown: { content }
  });
  return r.data;
}

// Send template card via webhook
async function sendWebhookCard({ title, desc, source, groupKey }) {
  const url = getWebhookUrl(groupKey);
  const r = await axios.post(url, {
    msgtype: 'template_card',
    template_card: {
      card_type: 'text_notice',
      source: { desc: source || 'Clawdbot' },
      main_title: { title, desc }
    }
  });
  return r.data;
}

// ── Main handler ─────────────────────────────────────────────────────────────
module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return res.json({
      status: 'ok',
      info: 'POST with { msgtype, text|markdown|card, groupKey } to send',
      webhooks_configured: Object.keys(process.env)
        .filter(k => k.startsWith('WECOM_WEBHOOK'))
        .map(k => k.replace('WECOM_WEBHOOK_', '').toLowerCase())
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { msgtype = 'text', text, markdown, card, groupKey, mentions } = req.body || {};

    let result;
    if (msgtype === 'markdown' && markdown) {
      result = await sendWebhookMarkdown(markdown, groupKey);
    } else if (msgtype === 'card' && card) {
      result = await sendWebhookCard({ ...card, groupKey });
    } else if (text) {
      result = await sendWebhookText(text, groupKey, mentions);
    } else {
      return res.status(400).json({ error: 'Provide text, markdown, or card' });
    }

    return res.json({
      status: result.errcode === 0 ? 'sent' : 'failed',
      errcode: result.errcode,
      errmsg: result.errmsg
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

// Export helpers for use in other functions
module.exports.sendWebhookText = sendWebhookText;
module.exports.sendWebhookMarkdown = sendWebhookMarkdown;
module.exports.sendWebhookCard = sendWebhookCard;
