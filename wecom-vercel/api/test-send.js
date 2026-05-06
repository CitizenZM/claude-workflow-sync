// Test endpoint: try sending a message via WeCom API from Vercel
const axios = require('axios');

module.exports = async function handler(req, res) {
  try {
    const CORP_ID = process.env.WECOM_CORP_ID;
    const APP_SECRET = process.env.WECOM_APP_SECRET;
    const AGENT_ID = process.env.WECOM_AGENT_ID;

    // Get token
    const tokRes = await axios.get(
      `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${CORP_ID}&corpsecret=${APP_SECRET}`
    );
    const token = tokRes.data.access_token;

    // Try sending to @all
    const sendRes = await axios.post(
      `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`,
      {
        touser: '@all',
        msgtype: 'text',
        agentid: Number(AGENT_ID),
        text: { content: '🤖 Clawdbot WeCom 连接成功！部署在 Vercel 云端。' },
        safe: 0
      }
    );

    res.json({
      status: sendRes.data.errcode === 0 ? 'sent' : 'failed',
      errcode: sendRes.data.errcode,
      errmsg: sendRes.data.errmsg,
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
};
