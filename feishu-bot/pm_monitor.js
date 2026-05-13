// pm_monitor.js — 5-hour TCL group monitoring drill
// Sends all coordination messages to Barron DM only (演习模式)
require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');
const fac = require('./facilitator');

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;

const BARRON_ID = 'ou_cb0a6c0b87900ddaa9d2b37cad2c59ca';
const TCL_GROUPS = {
  tech: { chatId: 'oc_86d82f40cae15a4db8782f9b99a73e6b', name: 'TCL独立站技术协同群', facKey: 'TCL独立站技术协同群__N2M_' },
  ops:  { chatId: 'oc_231d03989be38743b75ee192a969d3b9', name: 'TCL独立站增长与运营组', facKey: 'TCL独立站增长与运营组' },
  cs:   { chatId: 'oc_361251ce5a4c923c0e744ecd76babbf3', name: 'TCL客服群', facKey: 'TCL_客服群' },
};

const ID_NAME = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'id_name_map.json'), 'utf8')); }
  catch { return {}; }
})();

let _tok = '', _tokExp = 0;
async function getTenantToken() {
  if (_tok && Date.now() < _tokExp) return _tok;
  const body = JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET });
  const res = await new Promise((resolve, reject) => {
    const r = https.request({ hostname: 'open.feishu.cn', path: '/open-apis/auth/v3/tenant_access_token/internal',
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      resp => { let d = ''; resp.on('data', c => d += c); resp.on('end', () => resolve(JSON.parse(d))); });
    r.on('error', reject); r.write(body); r.end();
  });
  _tok = res.tenant_access_token || '';
  _tokExp = Date.now() + (res.expire - 60) * 1000;
  return _tok;
}

async function feishuApi(method, apiPath, body) {
  const tok = await getTenantToken();
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const opts = { hostname: 'open.feishu.cn', path: `/open-apis${apiPath}`, method,
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}) } };
    const req = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function sendPostToDM(title, paragraphs) {
  const tok = await getTenantToken();
  const clean = paragraphs.map(p => p.map(el => {
    const { style, ...rest } = el;
    return rest;
  }));
  const bodyStr = JSON.stringify({
    receive_id: BARRON_ID,
    msg_type: 'post',
    content: JSON.stringify({ zh_cn: { title, content: clean } })
  });
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'open.feishu.cn', path: '/open-apis/im/v1/messages?receive_id_type=open_id',
      method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr) } };
    const req = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        const r = JSON.parse(d);
        if (r.code !== 0) reject(new Error(`Feishu ${r.code}: ${r.msg}`));
        else resolve(r);
      });
    });
    req.on('error', reject);
    req.write(bodyStr); req.end();
  });
}

async function sendTextToDM(text) {
  const tok = await getTenantToken();
  const bodyStr = JSON.stringify({
    receive_id: BARRON_ID,
    msg_type: 'text',
    content: JSON.stringify({ text })
  });
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'open.feishu.cn', path: '/open-apis/im/v1/messages?receive_id_type=open_id',
      method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr) } };
    const req = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        const r = JSON.parse(d);
        if (r.code !== 0) reject(new Error(`Feishu ${r.code}: ${r.msg}`));
        else resolve(r);
      });
    });
    req.on('error', reject);
    req.write(bodyStr); req.end();
  });
}

// Fetch last N minutes of messages from a group
async function fetchRecentMessages(chatId, minutes = 5) {
  const startTime = Math.floor((Date.now() - minutes * 60000) / 1000).toString();
  try {
    const res = await feishuApi('GET', `/im/v1/messages?container_id_type=chat&container_id=${chatId}&start_time=${startTime}&page_size=50`);
    if (!res.data?.items) return [];
    return res.data.items.map(m => {
      let text = '';
      try {
        const c = JSON.parse(m.body?.content || '{}');
        text = c.text || c.content || '';
      } catch { text = m.body?.content || ''; }
      return {
        id: m.message_id,
        sender: ID_NAME[m.sender?.id] || m.sender?.id || 'unknown',
        senderId: m.sender?.id,
        text,
        ts: parseInt(m.create_time) * 1000,
        msgType: m.msg_type,
        mentions: (m.mentions || []).map(me => ({ name: me.name, id: me.id?.open_id })),
      };
    });
  } catch (e) {
    console.error(`[FETCH ERR] ${chatId}: ${e.message}`);
    return [];
  }
}

// Analyze messages for triggers
function analyzeMessages(msgs, groupInfo) {
  const triggers = [];
  const now = Date.now();

  for (const m of msgs) {
    const t = (typeof m.text === 'string' ? m.text : '').toLowerCase();

    // Trigger: Question unanswered
    if (t.includes('?') || t.includes('？') || t.includes('吗') || t.includes('是否') || t.includes('什么时候') || t.includes('谁来')) {
      triggers.push({
        type: 'question',
        severity: 'info',
        msg: m,
        reason: `${m.sender}提问，需确认是否有人回复`,
        text: m.text.slice(0, 60),
      });
    }

    // Trigger: Urgency keywords
    if (t.includes('紧急') || t.includes('urgent') || t.includes('asap') || t.includes('马上') || t.includes('立刻') || t.includes('blocking')) {
      triggers.push({
        type: 'urgent',
        severity: 'critical',
        msg: m,
        reason: '发现紧急关键词',
        text: m.text.slice(0, 60),
      });
    }

    // Trigger: Deadline/SOP mentions
    if (t.includes('截止') || t.includes('deadline') || t.includes('到期') || t.includes('来不及') || t.includes('延期')) {
      triggers.push({
        type: 'deadline_mention',
        severity: 'warning',
        msg: m,
        reason: '提到截止时间/延期相关',
        text: m.text.slice(0, 60),
      });
    }

    // Trigger: Task assignment / delegation
    if (t.includes('你来') || t.includes('负责') || t.includes('跟进') || t.includes('处理下') || t.includes('帮忙')) {
      triggers.push({
        type: 'task_assign',
        severity: 'info',
        msg: m,
        reason: '检测到任务分配/委派',
        text: m.text.slice(0, 60),
      });
    }

    // Trigger: Price/promo changes
    if (t.includes('价格') || t.includes('折扣') || t.includes('促销') || t.includes('上线') || t.includes('下架') || t.includes('改价')) {
      triggers.push({
        type: 'promo_change',
        severity: 'warning',
        msg: m,
        reason: '价格/促销变更 — 需跨群同步',
        text: m.text.slice(0, 60),
      });
    }

    // Trigger: Customer issues / refunds
    if (t.includes('退款') || t.includes('退货') || t.includes('投诉') || t.includes('客户') || t.includes('refund')) {
      triggers.push({
        type: 'customer_issue',
        severity: 'warning',
        msg: m,
        reason: '客户问题/退款',
        text: m.text.slice(0, 60),
      });
    }

    // Trigger: Blockers
    if (t.includes('没权限') || t.includes('打不开') || t.includes('blocked') || t.includes('卡住') || t.includes('等') || t.includes('还没')) {
      triggers.push({
        type: 'blocker',
        severity: 'warning',
        msg: m,
        reason: '发现阻塞/等待信号',
        text: m.text.slice(0, 60),
      });
    }

    // Trigger: @mentions of specific people
    if (m.mentions?.length) {
      for (const me of m.mentions) {
        triggers.push({
          type: 'mention',
          severity: 'info',
          msg: m,
          reason: `${m.sender} @了 ${me.name}`,
          text: m.text.slice(0, 60),
        });
      }
    }
  }

  return triggers;
}

// Check overdue tasks from facilitator state
function checkOverdueTasks() {
  const alerts = [];
  const now = Date.now();
  const state = fac.loadState();

  for (const [key, info] of Object.entries(TCL_GROUPS)) {
    const group = state.groups[info.facKey];
    if (!group) continue;
    for (const t of group.tasks || []) {
      if (t.status !== 'open') continue;
      if (t.deadline) {
        const dl = new Date(t.deadline).getTime();
        const hoursOverdue = (now - dl) / 3600000;
        if (hoursOverdue > 0) {
          alerts.push({
            group: info.name,
            task: t.title,
            owner: t.owner || '未分配',
            hoursOverdue: Math.round(hoursOverdue),
            severity: hoursOverdue > 48 ? 'critical' : hoursOverdue > 24 ? 'warning' : 'info',
          });
        }
      }
    }
  }
  return alerts;
}

// Check upcoming milestones
function checkMilestones() {
  const now = Date.now();
  const alerts = [];
  const cluster = fac.getProjectClusters().TCL;
  if (!cluster?.milestones) return alerts;

  for (const ms of cluster.milestones) {
    const msName = ms.name || ms.title || '未命名';
    const msOwner = ms.owner || '待定';
    const dl = new Date(ms.date).getTime();
    const daysLeft = (dl - now) / 86400000;
    if (daysLeft <= 7 && daysLeft > 0) {
      alerts.push({ name: msName, date: ms.date, owner: msOwner, daysLeft: Math.round(daysLeft) });
    } else if (daysLeft <= 0 && daysLeft > -3) {
      alerts.push({ name: msName, date: ms.date, owner: msOwner, daysLeft: Math.round(daysLeft), overdue: true });
    }
  }
  return alerts;
}

// State to track what we've already reported
const reported = new Set();
let cycleCount = 0;
const startTime = Date.now();
const FIVE_HOURS = 5 * 3600000;

function ts() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit' });
}

// Main monitoring cycle
async function runCycle() {
  cycleCount++;
  const elapsed = Date.now() - startTime;
  const elapsedMin = Math.round(elapsed / 60000);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[${ts()}] 🔄 Cycle #${cycleCount} | 已运行 ${elapsedMin}min | 剩余 ${Math.round((FIVE_HOURS - elapsed) / 60000)}min`);
  console.log(`${'═'.repeat(60)}`);

  const allTriggers = [];
  const allMsgs = {};

  // Fetch messages from all 3 groups
  for (const [key, info] of Object.entries(TCL_GROUPS)) {
    const msgs = await fetchRecentMessages(info.chatId, 5);
    allMsgs[key] = msgs;
    console.log(`  [${info.name}] ${msgs.length} new messages`);

    if (msgs.length > 0) {
      const triggers = analyzeMessages(msgs, info);
      for (const tr of triggers) {
        const trigKey = `${tr.type}:${tr.msg.id}`;
        if (!reported.has(trigKey)) {
          reported.add(trigKey);
          tr.group = info.name;
          tr.groupKey = key;
          allTriggers.push(tr);
        }
      }
    }
  }

  // Check overdue tasks
  const overdue = checkOverdueTasks();
  const milestones = checkMilestones();

  // Build consolidated alert if anything found
  const hasTriggers = allTriggers.length > 0;
  const hasOverdue = overdue.length > 0;
  const hasMilestones = milestones.length > 0;
  const totalMsgs = Object.values(allMsgs).reduce((s, m) => s + m.length, 0);

  if (hasTriggers || (hasOverdue && cycleCount % 6 === 1) || (hasMilestones && cycleCount % 12 === 1)) {
    const paragraphs = [];

    // Header
    paragraphs.push([{ tag: 'text', text: `🕐 ${ts()} | Cycle #${cycleCount} | 已运行${elapsedMin}min | ${totalMsgs}条新消息` }]);
    paragraphs.push([{ tag: 'text', text: '─────────────────────────────' }]);

    // Triggers by severity
    const critical = allTriggers.filter(t => t.severity === 'critical');
    const warnings = allTriggers.filter(t => t.severity === 'warning');
    const infos = allTriggers.filter(t => t.severity === 'info');

    if (critical.length) {
      paragraphs.push([{ tag: 'text', text: '🔴 紧急触发', style: { bold: true } }]);
      for (const tr of critical) {
        paragraphs.push([{ tag: 'text', text: `  [${tr.group}] ${tr.reason}` }]);
        paragraphs.push([{ tag: 'text', text: `  └ ${tr.msg.sender}: "${tr.text}"` }]);
      }
      paragraphs.push([{ tag: 'text', text: '' }]);
    }

    if (warnings.length) {
      paragraphs.push([{ tag: 'text', text: '🟡 关注项', style: { bold: true } }]);
      for (const tr of warnings) {
        paragraphs.push([{ tag: 'text', text: `  [${tr.group}] ${tr.reason}` }]);
        paragraphs.push([{ tag: 'text', text: `  └ ${tr.msg.sender}: "${tr.text}"` }]);
      }
      paragraphs.push([{ tag: 'text', text: '' }]);
    }

    if (infos.length) {
      paragraphs.push([{ tag: 'text', text: '📝 信息', style: { bold: true } }]);
      for (const tr of infos.slice(0, 8)) {
        paragraphs.push([{ tag: 'text', text: `  [${tr.group}] ${tr.reason}: "${tr.text}"` }]);
      }
      if (infos.length > 8) paragraphs.push([{ tag: 'text', text: `  …另有 ${infos.length - 8} 条信息级触发` }]);
      paragraphs.push([{ tag: 'text', text: '' }]);
    }

    // Overdue (every 30 min)
    if (hasOverdue && cycleCount % 6 === 1) {
      paragraphs.push([{ tag: 'text', text: '⏰ 逾期任务', style: { bold: true } }]);
      for (const a of overdue) {
        const icon = a.severity === 'critical' ? '🔴' : a.severity === 'warning' ? '🟡' : '⚪';
        paragraphs.push([{ tag: 'text', text: `  ${icon} [${a.group}] ${a.task} → ${a.owner} (逾期${a.hoursOverdue}h)` }]);
      }
      paragraphs.push([{ tag: 'text', text: '' }]);
    }

    // Milestones (every hour)
    if (hasMilestones && cycleCount % 12 === 1) {
      paragraphs.push([{ tag: 'text', text: '🎯 里程碑提醒', style: { bold: true } }]);
      for (const ms of milestones) {
        const icon = ms.overdue ? '🔴' : ms.daysLeft <= 3 ? '🟡' : '📌';
        paragraphs.push([{ tag: 'text', text: `  ${icon} ${ms.name} (${ms.date}) → ${ms.owner} ${ms.overdue ? '已过期' : `${ms.daysLeft}天后`}` }]);
      }
      paragraphs.push([{ tag: 'text', text: '' }]);
    }

    // PM coordination suggestion
    if (critical.length || warnings.length) {
      paragraphs.push([{ tag: 'text', text: '💡 建议操作', style: { bold: true } }]);
      const seen = new Set();
      for (const tr of [...critical, ...warnings]) {
        let suggestion = '';
        if (tr.type === 'urgent') suggestion = `→ 立即确认${tr.msg.sender}的紧急事项并指定责任人`;
        else if (tr.type === 'promo_change') suggestion = `→ 同步价格/促销变更到广告群(CELL_付费广告)`;
        else if (tr.type === 'customer_issue') suggestion = `→ 确认金叙呈已跟进，超24h升级给Mingyi`;
        else if (tr.type === 'blocker') suggestion = `→ 检查阻塞原因，@对应责任人限时回复`;
        else if (tr.type === 'deadline_mention') suggestion = `→ 更新Bitable任务截止时间，检查是否需要调整资源`;
        if (suggestion && !seen.has(suggestion)) {
          seen.add(suggestion);
          paragraphs.push([{ tag: 'text', text: `  ${suggestion}` }]);
        }
      }
    }

    const title = `🔍 TCL群监控 #${cycleCount}`;

    // Send to Barron DM
    try {
      await sendPostToDM(title, paragraphs);
      console.log(`  ✅ Sent alert to Barron (${allTriggers.length} triggers)`);
    } catch (e) {
      console.error(`  ❌ Send failed: ${e.message}`);
    }

    // Also print to console
    console.log(`\n  📨 ${title}`);
    for (const p of paragraphs) {
      console.log(`  ${p.map(e => e.text).join('')}`);
    }
  } else {
    console.log(`  ⏸️ No new triggers. Total msgs: ${totalMsgs}`);

    // Every 30 min, send a heartbeat even if no triggers
    if (cycleCount % 6 === 0) {
      const text = `💓 Clawdbot监控心跳 | ${ts()} | Cycle #${cycleCount} | 已运行${elapsedMin}min\n三群过去30min无异常动态。持续监听中。\n\n逾期: ${overdue.length} | 里程碑: ${milestones.length}`;
      try {
        await sendTextToDM(text);
        console.log(`  💓 Sent heartbeat to Barron`);
      } catch (e) {
        console.error(`  ❌ Heartbeat failed: ${e.message}`);
      }
    }
  }
}

// Initial PM brief on start
async function sendInitialBrief() {
  console.log('🚀 Clawdbot PM监控演习启动');
  console.log(`   模式: 仅发送到Barron DM (不发群)`);
  console.log(`   监控群: ${Object.values(TCL_GROUPS).map(g => g.name).join(', ')}`);
  console.log(`   周期: 5分钟/次, 共5小时`);
  console.log(`   开始时间: ${new Date().toLocaleString('zh-CN')}`);
  console.log(`   结束时间: ${new Date(Date.now() + FIVE_HOURS).toLocaleString('zh-CN')}`);

  // Send initial PM brief
  const pmPost = fac.formatPMBriefPost();
  const detailTech = fac.formatGroupPMDetail('TCL独立站技术协同群__N2M_');
  const detailOps = fac.formatGroupPMDetail('TCL独立站增长与运营组');
  const detailCS = fac.formatGroupPMDetail('TCL_客服群');

  try {
    await sendTextToDM(`🚀 Clawdbot PM监控演习启动\n\n模式: 仅发送到Barron DM\n监控群: TCL技术群 | TCL运营群 | TCL客服群\n周期: 5min/次, 共5小时\n开始: ${new Date().toLocaleString('zh-CN')}\n结束: ${new Date(Date.now() + FIVE_HOURS).toLocaleString('zh-CN')}\n\n接下来将发送:\n1. PM协调总览\n2. 三群各自PM详情\n3. 开始5min周期监控`);
    await sendPostToDM(pmPost.title, pmPost.paragraphs);
    if (detailTech) await sendPostToDM(detailTech.title, detailTech.paragraphs);
    if (detailOps) await sendPostToDM(detailOps.title, detailOps.paragraphs);
    if (detailCS) await sendPostToDM(detailCS.title, detailCS.paragraphs);
    console.log('  ✅ Initial PM brief sent to Barron');
  } catch (e) {
    console.error('  ❌ Initial brief failed:', e.message);
  }
}

// Run loop
async function main() {
  await sendInitialBrief();

  // First cycle immediately
  await runCycle();

  // Then every 5 minutes
  const interval = setInterval(async () => {
    if (Date.now() - startTime >= FIVE_HOURS) {
      clearInterval(interval);
      console.log('\n' + '═'.repeat(60));
      console.log('🏁 5小时监控结束 — 开始复盘');
      console.log('═'.repeat(60));

      // Send final summary
      const summary = `🏁 Clawdbot 5小时监控复盘\n\n总Cycle数: ${cycleCount}\n触发事件: ${reported.size}\n监控时长: ${Math.round((Date.now() - startTime) / 60000)}min\n\n持续功能验证完成。请查看控制台输出进行详细复盘。`;
      try {
        await sendTextToDM(summary);
      } catch (e) {
        console.error('Final summary send failed:', e.message);
      }
      process.exit(0);
    }
    await runCycle();
  }, 5 * 60000);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
