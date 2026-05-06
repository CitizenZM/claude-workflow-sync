// Health check endpoint
const axios = require('axios');

module.exports = async function handler(req, res) {
  try {
    const CORP_ID = process.env.WECOM_CORP_ID;
    const APP_SECRET = process.env.WECOM_APP_SECRET;
    const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${CORP_ID}&corpsecret=${APP_SECRET}`;
    const r = await axios.get(url);

    res.json({
      status: 'ok',
      wecom: r.data.errcode === 0 ? 'connected' : 'error',
      errcode: r.data.errcode,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
};
