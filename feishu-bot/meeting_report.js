// ─────────────────────────────────────────────────────────────────────────────
// meeting_report.js — Feishu Meeting Report Generator
//
// Strategy: Bot CANNOT join meetings, but CAN:
//   1. Detect meetings via vc.meeting.meeting_ended_v1 event
//   2. Fetch meeting details (duration, participants)
//   3. Fetch 妙记 (minutes/transcript) post-meeting
//   4. Generate structured report → vault + DM Barron
//
// Scopes needed: vc:meeting:readonly, minutes:minutes:readonly
// ─────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const VAULT = process.env.OBSIDIAN_VAULT || path.join(require('os').homedir(), 'ObsidianVault/Clawdbot');
const MEETINGS_DIR = path.join(VAULT, '07-Meetings');

if (!fs.existsSync(MEETINGS_DIR)) fs.mkdirSync(MEETINGS_DIR, { recursive: true });

const openai = new OpenAI({ apiKey: OPENAI_KEY });
const NAME_MAP_FILE = path.join(__dirname, 'id_name_map.json');

let _nameMap = null;
function getNameMap() {
  if (_nameMap) return _nameMap;
  try { _nameMap = JSON.parse(fs.readFileSync(NAME_MAP_FILE, 'utf8')); }
  catch { _nameMap = {}; }
  return _nameMap;
}
function resolveName(id) {
  const map = getNameMap();
  if (map[id]) return map[id];
  const short = (id || '').slice(-6);
  return map[short] || id;
}

// ── Feishu API helpers ───────────────────────────────────────────────────────
let _tok = '', _tokExp = 0;
async function getTenantToken() {
  if (_tok && Date.now() < _tokExp) return _tok;
  const body = JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET });
  const res = await new Promise((res, rej) => {
    const r = https.request({ hostname: 'open.feishu.cn', path: '/open-apis/auth/v3/tenant_access_token/internal',
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } },
      resp => { let d = ''; resp.on('data', c => d += c); resp.on('end', () => res(JSON.parse(d))); });
    r.on('error', rej); r.write(body); r.end();
  });
  _tok = res.tenant_access_token;
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
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({ raw: d }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Get meeting details ──────────────────────────────────────────────────────
async function getMeetingDetails(meetingId) {
  const r = await feishuApi('GET', `/vc/v1/meetings/${meetingId}`);
  return r.data?.meeting || null;
}

// ── Get meeting participants ─────────────────────────────────────────────────
async function getMeetingParticipants(meetingId) {
  // Export participant list
  const r = await feishuApi('POST', '/vc/v1/exports/participant_list', {
    meeting_start_time: '0', meeting_end_time: String(Math.floor(Date.now() / 1000)),
    meeting_no: meetingId, user_id_type: 'open_id'
  });
  return r.data || null;
}

// ── Get daily meeting report ─────────────────────────────────────────────────
async function getDailyReport(daysBack = 1) {
  const now = Math.floor(Date.now() / 1000);
  const start = now - daysBack * 86400;
  const r = await feishuApi('GET', `/vc/v1/reports/get_daily?start_time=${start}&end_time=${now}`);
  return r.data?.meeting_report?.daily_report || [];
}

// ── Get top meeting users ────────────────────────────────────────────────────
async function getTopUsers(daysBack = 7) {
  const now = Math.floor(Date.now() / 1000);
  const start = now - daysBack * 86400;
  const r = await feishuApi('GET', `/vc/v1/reports/get_top_user?start_time=${start}&end_time=${now}&limit=20&order_by=1`);
  return (r.data?.top_user_report || []).map(u => ({
    id: u.id,
    name: resolveName(u.id) || u.name,
    meetingCount: parseInt(u.meeting_count || 0),
    meetingMinutes: Math.round(parseInt(u.meeting_duration || 0) / 60),
  }));
}

// ── Export meeting list ──────────────────────────────────────────────────────
async function exportMeetingList(daysBack = 7) {
  const now = Math.floor(Date.now() / 1000);
  const start = now - daysBack * 86400;
  const r = await feishuApi('POST', '/vc/v1/exports/meeting_list', {
    start_time: String(start), end_time: String(now), meeting_status: 2  // ended
  });
  if (r.data?.task_id) {
    // Wait for export
    await new Promise(r => setTimeout(r, 3000));
    const r2 = await feishuApi('GET', `/vc/v1/exports/${r.data.task_id}`);
    return r2.data || null;
  }
  return null;
}

// ── Fetch 妙记 transcript (requires meeting_no or minute_token) ──────────────
async function getMinutesTranscript(minuteToken) {
  const r = await feishuApi('GET', `/minutes/v1/minutes/${minuteToken}/transcript`);
  if (r.code === 0 && r.data?.transcript) {
    return r.data.transcript;
  }
  return null;
}

async function getMinutesDetail(minuteToken) {
  const r = await feishuApi('GET', `/minutes/v1/minutes/${minuteToken}`);
  return r.data?.minute || null;
}

// ── Generate meeting report via GPT ──────────────────────────────────────────
async function generateReport(meetingData) {
  const { topic, participants, duration, transcript, date } = meetingData;

  const participantNames = (participants || []).map(p => resolveName(p.id || p) || p.name || p).join(', ');
  const durationMin = Math.round((duration || 0) / 60);

  let content = `Meeting: ${topic || 'Untitled'}\nDate: ${date}\nDuration: ${durationMin} minutes\nParticipants: ${participantNames}\n`;
  if (transcript) {
    content += `\nTranscript:\n${transcript.slice(0, 6000)}`;
  }

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 800,
    messages: [
      {
        role: 'system',
        content: `你是会议纪要分析师。根据会议信息生成结构化报告。格式：

## 会议概要
一句话总结

## 关键决策
- 决策1 — 责任人
- 决策2 — 责任人

## 待办事项
- [ ] 任务1 — @责任人（截止日期）
- [ ] 任务2 — @责任人（截止日期）

## 讨论要点
- 要点1
- 要点2

## 下次跟进
- 下次会议或跟进事项

语言跟会议内容一致（中文或英文）。如果没有转录内容，根据标题和参会人做合理推断。`
      },
      { role: 'user', content }
    ]
  });

  return res.choices[0].message.content.trim();
}

// ── Save meeting report to vault ─────────────────────────────────────────────
function saveToVault(meetingData, report) {
  const date = meetingData.date || new Date().toISOString().slice(0, 10);
  const topic = (meetingData.topic || 'meeting').replace(/[/\\:*?"<>|]/g, '_').slice(0, 40);
  const filename = `${date}-${topic}.md`;
  const filepath = path.join(MEETINGS_DIR, filename);

  const durationMin = Math.round((meetingData.duration || 0) / 60);
  const participants = (meetingData.participants || []).map(p => resolveName(p.id || p) || p.name || p);

  const content = `---
date: ${date}
topic: ${meetingData.topic || 'Untitled'}
duration: ${durationMin}min
participants: [${participants.join(', ')}]
type: meeting-report
tags: [meeting]
---

# ${meetingData.topic || 'Meeting'} — ${date}

- Duration: ${durationMin} minutes
- Participants: ${participants.join(', ')}

${report}
`;

  fs.writeFileSync(filepath, content);
  console.log(`📝 Saved: ${filepath}`);
  return filepath;
}

// ── Handle meeting_ended event ───────────────────────────────────────────────
async function handleMeetingEnded(event) {
  const meeting = event.meeting || event;
  const meetingId = meeting.id || meeting.meeting_id;
  const topic = meeting.topic || meeting.subject || 'Untitled Meeting';
  const startTime = meeting.start_time ? parseInt(meeting.start_time) * 1000 : Date.now();
  const endTime = meeting.end_time ? parseInt(meeting.end_time) * 1000 : Date.now();
  const duration = Math.round((endTime - startTime) / 1000);
  const date = new Date(startTime).toISOString().slice(0, 10);

  console.log(`📹 Meeting ended: "${topic}" (${Math.round(duration / 60)}min)`);

  // Get participants
  let participants = meeting.participants || [];

  // Try to get transcript (妙记) — may take a few minutes to generate
  let transcript = null;
  if (meeting.minute_token) {
    transcript = await getMinutesTranscript(meeting.minute_token);
  }

  const meetingData = { topic, participants, duration, transcript, date, meetingId };
  const report = await generateReport(meetingData);
  const savedPath = saveToVault(meetingData, report);

  return { report, savedPath, meetingData };
}

// ── Scan recent meetings and generate reports ────────────────────────────────
async function scanAndReport(daysBack = 1) {
  console.log(`\n📹 Scanning meetings from last ${daysBack} day(s)...`);

  const dailyReport = await getDailyReport(daysBack);
  const topUsers = await getTopUsers(daysBack);

  let summary = `📹 会议概览 | 过去${daysBack}天\n\n`;

  if (dailyReport.length) {
    summary += `📊 统计:\n`;
    for (const day of dailyReport) {
      const date = new Date(parseInt(day.date) * 1000).toISOString().slice(0, 10);
      const durMin = Math.round(parseInt(day.meeting_duration || 0) / 60);
      summary += `• ${date}: ${day.meeting_count}场会, ${durMin}分钟, ${day.participant_count}人\n`;
    }
  }

  if (topUsers.length) {
    summary += `\n👥 参会排名:\n`;
    topUsers.forEach((u, i) => {
      summary += `${i + 1}. ${u.name}: ${u.meetingCount}场, ${u.meetingMinutes}分钟\n`;
    });
  }

  return summary;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const days = parseInt(process.argv[2]) || 7;
  scanAndReport(days).then(s => console.log(s)).catch(e => console.error(e.message));
}

module.exports = {
  getMeetingDetails, getMeetingParticipants, getDailyReport, getTopUsers,
  exportMeetingList, getMinutesTranscript, getMinutesDetail,
  generateReport, saveToVault, handleMeetingEnded, scanAndReport,
};
