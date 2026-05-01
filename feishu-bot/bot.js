require('dotenv').config();
const lark = require('@larksuiteoapi/node-sdk');

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;

if (!APP_ID || !APP_SECRET) {
  console.error('Missing FEISHU_APP_ID or FEISHU_APP_SECRET in .env');
  process.exit(1);
}

const client = new lark.Client({ appId: APP_ID, appSecret: APP_SECRET });

const wsClient = new lark.WSClient({
  appId: APP_ID,
  appSecret: APP_SECRET,
  loggerLevel: lark.LoggerLevel.info,
});

wsClient.start({
  eventDispatcher: new lark.EventDispatcher({}).register({
    'im.message.receive_v1': async (data) => {
      const { message } = data;

      // Ignore non-text messages and bot's own messages
      if (message.message_type !== 'text') return;

      let text;
      try {
        text = JSON.parse(message.content).text || '';
      } catch {
        text = message.content;
      }

      const receiveIdType = message.chat_type === 'p2p' ? 'open_id' : 'chat_id';
      const receiveId = message.chat_type === 'p2p' ? data.sender.sender_id.open_id : message.chat_id;

      console.log(`[${new Date().toISOString()}] Received (${message.chat_type}): ${text}`);

      await client.im.message.create({
        params: { receive_id_type: receiveIdType },
        data: {
          receive_id: receiveId,
          content: JSON.stringify({ text: `Echo: ${text}` }),
          msg_type: 'text',
        },
      });
    },
  }),
});

console.log(`Feishu bot started (app: ${APP_ID}). Waiting for messages via long connection...`);
