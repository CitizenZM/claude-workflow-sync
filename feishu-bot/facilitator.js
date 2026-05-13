// ─────────────────────────────────────────────────────────────────────────────
// facilitator.js — Clawdbot Group Facilitation Engine v1
//
// 6 Core Requirements:
//   1. Accountability: force owner + deadline on every task
//   2. Real-time sync: 5-min refresh cycle, trigger reminders on changes
//   3. Smart intervention: only speak when scheduled, @mentioned, or critical
//   4. Hourly chase: urgent todo summary + DM responsible persons
//   5. File/Bitable integration: sync external data into brain
//   6. Per-group isolation: separate memory, tasks, context per group
// ─────────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'facilitator_state.json');

// ── Per-group isolated state ─────────────────────────────────────────────────
function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return { groups: {}, globalTasks: [], lastSync: 0 }; }
}
function saveState(s) { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); }

function getGroup(state, groupKey) {
  if (!state.groups[groupKey]) {
    state.groups[groupKey] = {
      key: groupKey,
      chatId: null,
      name: '',
      tasks: [],            // group-specific task queue
      mentions: [],          // pending @mention follow-ups
      hourlyDigest: [],      // messages captured this hour for digest
      dailyCompleted: [],    // tasks completed today
      dailyCreated: [],      // tasks created today
      lastMorningBrief: 0,
      lastEveningBrief: 0,
      lastHourlyChase: 0,
      messageCount24h: 0,
      context: '',           // rolling group context (last key discussions)
    };
  }
  return state.groups[groupKey];
}

// ── Requirement 1: Accountability — Task with mandatory owner + deadline ─────
// Returns { valid, missing, task } or prompts for missing fields
function validateTask(taskObj) {
  const missing = [];
  if (!taskObj.owner || taskObj.owner === 'unknown' || taskObj.owner === 'null') missing.push('责任人');
  if (!taskObj.deadline) missing.push('截止时间');
  return {
    valid: missing.length === 0,
    missing,
    task: taskObj
  };
}

function formatMissingPrompt(tasks) {
  const incomplete = tasks.filter(t => {
    const v = validateTask(t);
    return !v.valid;
  });
  if (!incomplete.length) return null;

  const lines = incomplete.map((t, i) => {
    const v = validateTask(t);
    return `${i + 1}. 「${t.title}」— 缺少${v.missing.join('和')}`;
  });

  return `📋 以下任务需要明确${lines.length > 1 ? '信息' : ''}：\n\n${lines.join('\n')}\n\n请补充，格式：「任务名 @责任人 截止日期」`;
}

function createTask(groupKey, { title, owner, deadline, source, urgency }) {
  const state = loadState();
  const group = getGroup(state, groupKey);

  const task = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    owner: owner || null,
    deadline: deadline || null,      // ISO date string
    source: source || 'chat',        // 'chat' | 'bitable' | 'file' | 'manual'
    urgency: urgency || 'normal',    // 'normal' | 'urgent' | 'critical'
    status: 'open',                  // 'open' | 'in_progress' | 'done' | 'deferred'
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reminders: [],                   // timestamps of sent reminders
    deferReason: null,
    completedAt: null,
    groupKey,
  };

  group.tasks.push(task);
  group.dailyCreated.push(task.id);
  saveState(state);

  return { task, validation: validateTask(task) };
}

function completeTask(groupKey, taskIdOrFragment) {
  const state = loadState();
  const group = getGroup(state, groupKey);
  const frag = taskIdOrFragment.toLowerCase();

  const task = group.tasks.find(t =>
    t.status !== 'done' &&
    (t.id.endsWith(frag) || t.title.toLowerCase().includes(frag))
  );

  if (!task) return null;
  task.status = 'done';
  task.completedAt = new Date().toISOString();
  task.updatedAt = new Date().toISOString();
  group.dailyCompleted.push(task.id);
  saveState(state);
  return task;
}

function deferTask(groupKey, taskIdOrFragment, reason) {
  const state = loadState();
  const group = getGroup(state, groupKey);
  const frag = taskIdOrFragment.toLowerCase();

  const task = group.tasks.find(t =>
    t.status !== 'done' &&
    (t.id.endsWith(frag) || t.title.toLowerCase().includes(frag))
  );

  if (!task) return null;
  task.status = 'deferred';
  task.deferReason = reason;
  task.updatedAt = new Date().toISOString();
  saveState(state);
  return task;
}

// ── Requirement 2: @Mention tracker with 30-min escalation ───────────────────
function recordMention(groupKey, { mentionedUser, mentionerName, messageText, timestamp }) {
  const state = loadState();
  const group = getGroup(state, groupKey);

  // Dedup: don't track same person mentioned for same message
  const existing = group.mentions.find(m =>
    m.mentionedUser === mentionedUser &&
    m.messageText === messageText
  );
  if (existing) return;

  group.mentions.push({
    id: `m-${Date.now()}`,
    mentionedUser,
    mentionerName,
    messageText: messageText.slice(0, 200),
    timestamp: timestamp || Date.now(),
    responded: false,
    respondedAt: null,
    remindersSent: 0,       // 0=none, 1=30min group, 2=2h DM, 3=4h escalate
    deferred: false,         // user replied "稍后"
    deferredUntil: null,
  });
  saveState(state);
}

function markMentionResponded(groupKey, userId) {
  const state = loadState();
  const group = getGroup(state, groupKey);
  let cleared = 0;

  group.mentions.forEach(m => {
    if (m.mentionedUser === userId && !m.responded) {
      m.responded = true;
      m.respondedAt = Date.now();
      cleared++;
    }
  });

  if (cleared > 0) saveState(state);
  return cleared;
}

function deferMention(groupKey, userId) {
  const state = loadState();
  const group = getGroup(state, groupKey);

  group.mentions.forEach(m => {
    if (m.mentionedUser === userId && !m.responded) {
      m.deferred = true;
      m.deferredUntil = Date.now() + 2 * 3600 * 1000; // 2 hours later
    }
  });
  saveState(state);
}

function getPendingMentions(groupKey) {
  const state = loadState();
  const group = getGroup(state, groupKey);
  const now = Date.now();

  return group.mentions.filter(m => {
    if (m.responded) return false;
    if (m.deferred && m.deferredUntil > now) return false;
    return true;
  });
}

function getMentionsNeedingReminder(groupKey) {
  const state = loadState();
  const group = getGroup(state, groupKey);
  const now = Date.now();

  return group.mentions.filter(m => {
    if (m.responded) return false;
    if (m.deferred && m.deferredUntil > now) return false;

    const elapsed = now - m.timestamp;
    const THIRTY_MIN = 30 * 60 * 1000;
    const TWO_HOURS = 2 * 3600 * 1000;
    const FOUR_HOURS = 4 * 3600 * 1000;

    if (m.remindersSent === 0 && elapsed >= THIRTY_MIN) return true;
    if (m.remindersSent === 1 && elapsed >= TWO_HOURS) return true;
    if (m.remindersSent === 2 && elapsed >= FOUR_HOURS) return true;
    return false;
  });
}

function bumpMentionReminder(groupKey, mentionId) {
  const state = loadState();
  const group = getGroup(state, groupKey);
  const m = group.mentions.find(x => x.id === mentionId);
  if (m) {
    m.remindersSent++;
    saveState(state);
  }
}

// ── Requirement 3: Smart intervention rules ──────────────────────────────────
// Returns whether bot should intervene in a group message
function shouldIntervene(context) {
  const {
    isMentioned,           // bot was @mentioned
    isScheduledTime,       // cron trigger (morning/evening/hourly)
    isDeadlineDay,         // a task in this group is due today
    isPreMeeting,          // a meeting is within 30 min
    mentionEscalation,     // someone hasn't replied to @mention for 30min+
    isMultipleChaseNoReply, // 3+ messages chasing same person with no reply
    isUrgentKeyword,       // message contains 紧急/urgent/ASAP/马上
  } = context;

  // Rule: NEVER respond to casual chat or random questions
  // Only intervene on these triggers:
  if (isMentioned) return { intervene: true, reason: 'at_mentioned' };
  if (isScheduledTime) return { intervene: true, reason: 'scheduled' };
  if (isDeadlineDay) return { intervene: true, reason: 'deadline_today' };
  if (isPreMeeting) return { intervene: true, reason: 'pre_meeting' };
  if (mentionEscalation) return { intervene: true, reason: 'mention_escalation' };
  if (isMultipleChaseNoReply) return { intervene: true, reason: 'chase_escalation' };
  if (isUrgentKeyword) return { intervene: true, reason: 'urgent_keyword' };

  return { intervene: false, reason: 'none' };
}

// Detect urgency signals in message text
function detectUrgency(text) {
  const urgentPatterns = [
    /紧急/i, /urgent/i, /asap/i, /马上/i, /立即/i, /立刻/i,
    /赶紧/i, /尽快/i, /deadline/i, /overdue/i, /逾期/i, /催/i,
    /等你回复/i, /还没回/i, /怎么还没/i, /请尽快/i,
  ];
  return urgentPatterns.some(p => p.test(text));
}

// Detect if text is chasing/following up on someone
function detectChase(text) {
  const chasePatterns = [
    /[@＠]\S+.*[?？]/, /还没.*[回复完成做好]/,
    /催.*一下/, /跟进/, /进展.*[？?]/, /什么时候能/,
    /有消息吗/, /回复.*一下/, /确认.*一下/,
  ];
  return chasePatterns.some(p => p.test(text));
}

// ── Requirement 4: Hourly digest for urgent groups ───────────────────────────
function recordHourlyMessage(groupKey, { sender, text, timestamp, hasChase, hasUrgent }) {
  const state = loadState();
  const group = getGroup(state, groupKey);

  group.hourlyDigest.push({
    sender,
    text: text.slice(0, 300),
    timestamp: timestamp || Date.now(),
    hasChase: hasChase || false,
    hasUrgent: hasUrgent || false,
  });

  // Keep only last 2 hours of messages
  const twoHoursAgo = Date.now() - 2 * 3600 * 1000;
  group.hourlyDigest = group.hourlyDigest.filter(m => m.timestamp > twoHoursAgo);
  saveState(state);
}

function getHourlyUrgentItems(groupKey) {
  const state = loadState();
  const group = getGroup(state, groupKey);
  const oneHourAgo = Date.now() - 3600 * 1000;

  const recent = group.hourlyDigest.filter(m => m.timestamp > oneHourAgo);
  const urgent = recent.filter(m => m.hasChase || m.hasUrgent);
  const chaseTargets = {};

  // Count how many times each person is being chased
  recent.forEach(m => {
    if (m.hasChase) {
      const atMatch = m.text.match(/[@＠](\S+)/);
      if (atMatch) {
        const target = atMatch[1];
        chaseTargets[target] = (chaseTargets[target] || 0) + 1;
      }
    }
  });

  return {
    totalMessages: recent.length,
    urgentCount: urgent.length,
    chaseTargets,   // { "小金": 3, "欢欢": 1 }
    urgentMessages: urgent,
  };
}

// ── Requirement 5: Sync external data sources ────────────────────────────────
function recordBitableSync(tasks) {
  const state = loadState();
  state.lastBitableSync = Date.now();
  state.bitableTasks = tasks.map(t => ({
    recordId: t.recordId,
    task: t.task,
    owner: t.owner,
    status: t.status,
    due: t.due,
    module: t.module,
    priority: t.priority,
    lastSynced: Date.now(),
  }));
  saveState(state);
  return state.bitableTasks;
}

function getBitableChanges(oldTasks, newTasks) {
  const changes = { completed: [], newTasks: [], statusChanged: [], overdueNew: [] };
  const oldMap = {};
  (oldTasks || []).forEach(t => { oldMap[t.recordId] = t; });

  const now = new Date();
  newTasks.forEach(t => {
    const old = oldMap[t.recordId];
    if (!old) {
      changes.newTasks.push(t);
    } else {
      if (old.status !== t.status) {
        if (['已完成', 'Done', 'Completed'].includes(t.status)) {
          changes.completed.push(t);
        } else {
          changes.statusChanged.push({ from: old.status, to: t.status, task: t });
        }
      }
    }
    if (t.due && new Date(t.due) < now && !['已完成', 'Done', 'Completed'].includes(t.status)) {
      if (!old || !oldMap[t.recordId]?._wasOverdue) {
        changes.overdueNew.push(t);
      }
    }
  });

  return changes;
}

// ── Requirement 6: Per-group context & task isolation ────────────────────────
function getGroupTasks(groupKey, statusFilter) {
  const state = loadState();
  const group = getGroup(state, groupKey);

  let tasks = group.tasks;
  if (statusFilter) {
    tasks = tasks.filter(t => t.status === statusFilter);
  }
  return tasks;
}

function getGroupContext(groupKey) {
  const state = loadState();
  const group = getGroup(state, groupKey);
  return {
    tasks: group.tasks.filter(t => t.status !== 'done'),
    mentions: getPendingMentions(groupKey),
    recentMessages: group.hourlyDigest.slice(-20),
    name: group.name,
    chatId: group.chatId,
  };
}

function updateGroupContext(groupKey, context) {
  const state = loadState();
  const group = getGroup(state, groupKey);
  group.context = context;
  group.lastContextUpdate = Date.now();
  saveState(state);
}

function registerGroup(groupKey, chatId, name) {
  const state = loadState();
  const group = getGroup(state, groupKey);
  group.chatId = chatId;
  group.name = name || groupKey;
  saveState(state);
}

// ── Morning brief generator (per-group data) ────────────────────────────────
function buildMorningBriefData(groupKey) {
  const state = loadState();
  const group = getGroup(state, groupKey);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const openTasks = group.tasks.filter(t => t.status !== 'done');
  const dueToday = openTasks.filter(t => t.deadline === today);
  const overdue = openTasks.filter(t => t.deadline && t.deadline < today);
  const noOwner = openTasks.filter(t => !t.owner);
  const noDeadline = openTasks.filter(t => !t.deadline);

  return {
    groupName: group.name || groupKey,
    totalOpen: openTasks.length,
    dueToday,
    overdue,
    noOwner,
    noDeadline,
    openTasks,
  };
}

// ── Evening review generator ─────────────────────────────────────────────────
function buildEveningReviewData(groupKey) {
  const state = loadState();
  const group = getGroup(state, groupKey);

  const completed = group.dailyCompleted.map(id =>
    group.tasks.find(t => t.id === id)
  ).filter(Boolean);

  const stillOpen = group.tasks.filter(t =>
    t.status !== 'done' && group.dailyCreated.includes(t.id)
  );

  const carriedOver = group.tasks.filter(t =>
    t.status !== 'done' && !group.dailyCreated.includes(t.id)
  );

  return {
    groupName: group.name || groupKey,
    completed,
    stillOpen,
    carriedOver,
    messageCount: group.messageCount24h,
  };
}

// ── Daily reset (call at end of day) ─────────────────────────────────────────
function resetDaily() {
  const state = loadState();
  for (const key of Object.keys(state.groups)) {
    const g = state.groups[key];
    g.dailyCompleted = [];
    g.dailyCreated = [];
    g.messageCount24h = 0;
    // Clean up old resolved mentions (>24h and responded)
    g.mentions = g.mentions.filter(m =>
      !m.responded || (Date.now() - m.respondedAt) < 24 * 3600 * 1000
    );
    // Clean up done tasks older than 7 days
    g.tasks = g.tasks.filter(t =>
      t.status !== 'done' ||
      (Date.now() - new Date(t.completedAt).getTime()) < 7 * 24 * 3600 * 1000
    );
  }
  saveState(state);
}

// ── Task extraction prompt (forces owner + deadline) ─────────────────────────
const TASK_EXTRACT_PROMPT = `Extract concrete tasks from the message below.
For EACH task, you MUST identify:
- title: what needs to be done
- owner: who is responsible (extract from @mentions, names, or context). Use the actual name, not "unknown"
- deadline: when it's due (extract dates, "今天", "明天", "本周", "下周一" etc → convert to YYYY-MM-DD). If no date mentioned, use null
- urgency: "normal", "urgent" (紧急/asap/马上), or "critical" (逾期/overdue/blocking)

Return JSON array: [{"title":"...","owner":"name or null","deadline":"YYYY-MM-DD or null","urgency":"normal"}]
If NO tasks found, return [].
Return ONLY valid JSON, no markdown.`;

// ── Intervention check prompt ────────────────────────────────────────────────
const HOURLY_CHASE_PROMPT = `You are a project coordinator analyzing the last hour of group chat.
Identify:
1. Tasks people are being chased about (催促/follow-up/追问)
2. Questions that remain unanswered
3. Urgent items (紧急/ASAP/blocking/逾期)
4. People who have been asked multiple times with no response

For each item output:
- what: the task or question
- who: responsible person
- urgency: normal/urgent/critical
- action: what the coordinator should do (remind in group / DM / escalate)

Return JSON array. If nothing urgent, return [].
Return ONLY valid JSON.`;

// ─────────────────────────────────────────────────────────────────────────────
// v7 — Project Clusters, Client SLA, Gap Detection, Workload, Timeline
// ─────────────────────────────────────────────────────────────────────────────

// ── Default project cluster definitions ─────────────────────────────────────
const DEFAULT_PROJECT_CLUSTERS = {
  TCL: {
    groups: ['TCL独立站技术协同群__N2M_', 'N2M', 'TCL独立站增长与运营组', 'TCL_客服群', 'TCL_M2AI共创'],
    keyFiles: [],
    milestones: [
      { name: '母亲节促销', date: '2026-05-11', owner: '刘兴竺' },
      { name: 'Memorial Day SOP', date: '2026-05-16', owner: '刘兴竺' },
      { name: 'Memorial Day促销', date: '2026-05-26', owner: '刘兴竺' },
      { name: 'AI客服话术确认', date: '2026-05-11', owner: '金叙呈' },
    ],
    stakeholders: ['冯昭祥', '金叙呈', '刘兴竺', 'Mingyi', 'James Hou', 'XiaAlba'],
  },
  CELL: {
    groups: ['CELL_付费广告', 'CELL_EDM', 'CELL_联盟运营', 'CELL_百万美金财务群', 'CELL_x_N2M_美工需求', 'N2M_项目广告优化组'],
    keyFiles: [],
    milestones: [],
    stakeholders: ['欢欢', '帆帆', 'Xinyue Zhang', '金叙呈', 'Mingyi'],
  },
  OhBeauty: {
    groups: ['Oh_Beauty_Shopify_运营', 'Oh_Beauty_Shopify'],
    keyFiles: [],
    milestones: [
      { name: 'OB GWP促销结束', date: '2026-05-13', owner: '帆帆' },
    ],
    stakeholders: ['冯昭祥', 'James Hou', '帆帆', 'Xinyue Zhang', '金叙呈'],
  },
  Affiliate: {
    groups: ['Affiliate_Publisher_Development', 'Levoit_Affiliate_Ops', 'Ottocast_亚马逊联盟服务群', 'Rockbro_独立站联盟运营'],
    keyFiles: [],
    milestones: [],
    stakeholders: ['帆帆', 'Mingyi'],
  },
};

function getProjectClusters() {
  const state = loadState();
  if (!state.projectClusters) {
    state.projectClusters = DEFAULT_PROJECT_CLUSTERS;
    saveState(state);
  }
  return state.projectClusters;
}

function findProjectForGroup(groupKey) {
  const clusters = getProjectClusters();
  for (const [project, cluster] of Object.entries(clusters)) {
    if (cluster.groups.some(g => groupKey.includes(g) || g.includes(groupKey))) {
      return { project, cluster };
    }
  }
  return null;
}

function getSiblingGroups(groupKey) {
  const match = findProjectForGroup(groupKey);
  if (!match) return [];
  return match.cluster.groups.filter(g => g !== groupKey);
}

// ── Client SLA tracking ─────────────────────────────────────────────────────
const CLIENT_INPUT_PATTERNS = [
  /等客户/, /需客户/, /客户确认/, /客户提供/, /waiting.*client/i,
  /等.*反馈/, /客户.*回复/, /客户.*素材/, /缺.*图片/,
  /客户那边/, /客户还没/, /需要客户/,
];

function detectClientDependency(text) {
  return CLIENT_INPUT_PATTERNS.some(p => p.test(text));
}

function recordClientDependency(groupKey, { item, requestedBy, details }) {
  const state = loadState();
  if (!state.clientSLA) state.clientSLA = [];

  // Dedup by item+group (fuzzy)
  const exists = state.clientSLA.find(c =>
    c.groupKey === groupKey && c.item.includes(item.slice(0, 15))
  );
  if (exists) return exists;

  const entry = {
    id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    groupKey,
    item,
    requestedBy: requestedBy || null,
    details: details || '',
    requestedAt: new Date().toISOString().slice(0, 10),
    resolved: false,
    resolvedAt: null,
    remindersSent: 0,
  };
  state.clientSLA.push(entry);
  saveState(state);
  return entry;
}

function resolveClientDependency(groupKey, itemFragment) {
  const state = loadState();
  if (!state.clientSLA) return null;
  const frag = itemFragment.toLowerCase();
  const entry = state.clientSLA.find(c =>
    !c.resolved && c.groupKey === groupKey && c.item.toLowerCase().includes(frag)
  );
  if (entry) {
    entry.resolved = true;
    entry.resolvedAt = new Date().toISOString().slice(0, 10);
    saveState(state);
  }
  return entry;
}

function getPendingClientSLA(groupKey) {
  const state = loadState();
  if (!state.clientSLA) return [];
  const now = new Date();
  return (groupKey
    ? state.clientSLA.filter(c => !c.resolved && c.groupKey === groupKey)
    : state.clientSLA.filter(c => !c.resolved)
  ).map(c => {
    const days = Math.floor((now - new Date(c.requestedAt)) / 86400000);
    return { ...c, waitingDays: days };
  });
}

// ── Gap Detection — Q&A pairing ─────────────────────────────────────────────
function recordQuestion(groupKey, { asker, question, timestamp }) {
  const state = loadState();
  const group = getGroup(state, groupKey);
  if (!group.pendingQuestions) group.pendingQuestions = [];

  // Dedup
  const exists = group.pendingQuestions.find(q =>
    q.question === question && q.asker === asker
  );
  if (exists) return;

  group.pendingQuestions.push({
    id: `q-${Date.now()}`,
    asker,
    question: question.slice(0, 200),
    timestamp: timestamp || Date.now(),
    answered: false,
    answeredAt: null,
    answeredBy: null,
  });

  // Keep only last 50 questions per group
  if (group.pendingQuestions.length > 50) {
    group.pendingQuestions = group.pendingQuestions.slice(-50);
  }
  saveState(state);
}

function markQuestionAnswered(groupKey, questionFragment, answeredBy) {
  const state = loadState();
  const group = getGroup(state, groupKey);
  if (!group.pendingQuestions) return 0;

  const frag = questionFragment.toLowerCase();
  let cleared = 0;
  group.pendingQuestions.forEach(q => {
    if (!q.answered && q.question.toLowerCase().includes(frag)) {
      q.answered = true;
      q.answeredAt = Date.now();
      q.answeredBy = answeredBy;
      cleared++;
    }
  });
  if (cleared) saveState(state);
  return cleared;
}

function getUnansweredQuestions(groupKey, maxAgeMinutes) {
  const state = loadState();
  const group = getGroup(state, groupKey);
  if (!group.pendingQuestions) return [];
  const cutoff = maxAgeMinutes ? Date.now() - maxAgeMinutes * 60000 : 0;
  return group.pendingQuestions.filter(q =>
    !q.answered && q.timestamp > cutoff
  ).map(q => ({
    ...q,
    minutesAgo: Math.floor((Date.now() - q.timestamp) / 60000),
  }));
}

// ── File registration per project ───────────────────────────────────────────
const FILE_PATTERNS = [
  /feishu\.cn\/(docx?|sheet|base|wiki|slides|mindnotes?|bitable)\//,
  /docs\.google\.com/,
  /\.xlsx?|\.docx?|\.pptx?|\.pdf/i,
  /feishu\.cn\/base\//,
];

function detectFileLink(text) {
  return FILE_PATTERNS.some(p => p.test(text));
}

function registerFile(projectName, { url, type, name, sharedBy, group }) {
  const state = loadState();
  if (!state.projectClusters) state.projectClusters = DEFAULT_PROJECT_CLUSTERS;
  const cluster = state.projectClusters[projectName];
  if (!cluster) return null;

  // Dedup by url
  if (cluster.keyFiles.some(f => f.url === url)) return null;

  const entry = {
    url,
    type: type || 'unknown',
    name: name || url.slice(-30),
    sharedBy: sharedBy || 'unknown',
    sharedAt: new Date().toISOString().slice(0, 10),
    group: group || '',
  };
  cluster.keyFiles.push(entry);
  saveState(state);
  return entry;
}

function getProjectFiles(projectName) {
  const clusters = getProjectClusters();
  return clusters[projectName]?.keyFiles || [];
}

// ── Workload analysis (Barron-only) ─────────────────────────────────────────
function analyzeWorkload() {
  const state = loadState();
  const loadMap = {};

  for (const gk of Object.keys(state.groups)) {
    const group = state.groups[gk];
    const open = (group.tasks || []).filter(t => t.status !== 'done' && t.status !== 'cancelled');
    open.forEach(t => {
      if (t.owner) {
        if (!loadMap[t.owner]) loadMap[t.owner] = { tasks: 0, groups: new Set(), items: [] };
        loadMap[t.owner].tasks++;
        loadMap[t.owner].groups.add(gk);
        loadMap[t.owner].items.push({ title: t.title, group: gk, deadline: t.deadline });
      }
    });
  }

  // Convert Sets to counts
  const result = {};
  const values = Object.values(loadMap).map(v => v.tasks);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  for (const [name, data] of Object.entries(loadMap)) {
    const level = data.tasks > avg * 1.5 ? 'overloaded'
      : data.tasks > avg ? 'busy'
      : 'normal';
    result[name] = {
      tasks: data.tasks,
      groups: data.groups.size,
      groupList: [...data.groups],
      level,
      items: data.items,
    };
  }

  return { loadMap: result, avg: Math.round(avg * 10) / 10 };
}

// ── Milestone management ────────────────────────────────────────────────────
function addMilestone(projectName, { title, date, tasks }) {
  const state = loadState();
  if (!state.projectClusters) state.projectClusters = DEFAULT_PROJECT_CLUSTERS;
  const cluster = state.projectClusters[projectName];
  if (!cluster) return null;

  const ms = {
    id: `ms-${Date.now()}`,
    title,
    date,   // YYYY-MM-DD
    tasks: tasks || [],
    status: 'active',  // active | completed
    createdAt: new Date().toISOString(),
  };
  cluster.milestones.push(ms);
  saveState(state);
  return ms;
}

function getUpcomingMilestones(daysAhead) {
  const clusters = getProjectClusters();
  const now = new Date();
  const cutoff = new Date(now.getTime() + (daysAhead || 14) * 86400000);
  const results = [];

  for (const [project, cluster] of Object.entries(clusters)) {
    for (const ms of (cluster.milestones || [])) {
      if (ms.status !== 'active') continue;
      const msDate = new Date(ms.date);
      if (msDate <= cutoff) {
        const daysLeft = Math.ceil((msDate - now) / 86400000);
        results.push({ project, ...ms, daysLeft });
      }
    }
  }
  return results.sort((a, b) => a.daysLeft - b.daysLeft);
}

// ── Cross-group sync detection ──────────────────────────────────────────────
function buildCrossGroupSync(groupKey, decisionText, involvedPeople) {
  const siblings = getSiblingGroups(groupKey);
  if (!siblings.length) return null;

  const state = loadState();
  const sourceGroup = getGroup(state, groupKey);

  return {
    sourceGroup: sourceGroup.name || groupKey,
    targetGroups: siblings,
    decision: decisionText,
    involvedPeople: involvedPeople || [],
    timestamp: Date.now(),
  };
}

// ── Barron Dashboard builder ────────────────────────────────────────────────
function buildBarronDashboard() {
  const state = loadState();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Aggregate across all groups
  let totalOpen = 0, totalOverdue = 0, totalNoDeadline = 0, totalNoOwner = 0;
  let totalPendingMentions = 0;
  const groupSummaries = [];

  for (const gk of Object.keys(state.groups)) {
    const group = state.groups[gk];
    if (!group.chatId) continue;
    const open = (group.tasks || []).filter(t => t.status !== 'done' && t.status !== 'cancelled');
    const overdue = open.filter(t => t.deadline && t.deadline < today);
    const noOwner = open.filter(t => !t.owner);
    const noDeadline = open.filter(t => !t.deadline);
    const mentions = (group.mentions || []).filter(m => !m.responded);

    totalOpen += open.length;
    totalOverdue += overdue.length;
    totalNoDeadline += noDeadline.length;
    totalNoOwner += noOwner.length;
    totalPendingMentions += mentions.length;

    if (open.length > 0 || mentions.length > 0) {
      groupSummaries.push({
        name: group.name || gk,
        open: open.length,
        overdue: overdue.length,
        mentions: mentions.length,
        dueToday: open.filter(t => t.deadline === today).length,
      });
    }
  }

  // Workload
  const workload = analyzeWorkload();
  const overloaded = Object.entries(workload.loadMap)
    .filter(([_, v]) => v.level === 'overloaded')
    .map(([name, v]) => ({ name, tasks: v.tasks, groups: v.groups, groupList: v.groupList }));

  // Client SLA
  const clientSLA = getPendingClientSLA();
  const criticalSLA = clientSLA.filter(c => c.waitingDays >= 3);

  // Milestones
  const milestones = getUpcomingMilestones(7);

  return {
    date: today,
    totalOpen,
    totalOverdue,
    totalNoDeadline,
    totalNoOwner,
    totalPendingMentions,
    groupSummaries,
    overloaded,
    clientSLA: criticalSLA,
    milestones,
  };
}

function formatBarronDashboard(dashboard, calendarEvents) {
  const d = dashboard;
  let msg = `🎯 Barron 今日仪表盘 | ${d.date}\n\n`;

  // Calendar
  if (calendarEvents && calendarEvents.length) {
    msg += `📅 今日日程:\n`;
    calendarEvents.forEach(ev => {
      msg += `• ${ev.time} ${ev.title}\n`;
    });
    msg += '\n';
  }

  // Needs intervention
  const interventions = [];
  if (d.overloaded.length) {
    d.overloaded.forEach(p => {
      interventions.push(`${p.name} 任务过载 (${p.tasks}项/${p.groups}群) — 建议重新分配`);
    });
  }
  if (d.clientSLA.length) {
    d.clientSLA.forEach(c => {
      const action = c.waitingDays >= 5 ? '建议直接call' : '建议催促';
      interventions.push(`${c.item} 等客户确认 — 已${c.waitingDays}天，${action}`);
    });
  }

  if (interventions.length) {
    msg += `🔴 需要你介入 (${interventions.length}):\n`;
    interventions.forEach(i => msg += `• ${i}\n`);
    msg += '\n';
  }

  // Milestones
  if (d.milestones.length) {
    msg += `🏗️ 近期里程碑:\n`;
    d.milestones.forEach(ms => {
      const flag = ms.daysLeft <= 0 ? '🔴' : ms.daysLeft <= 3 ? '🟡' : '🟢';
      msg += `${flag} ${ms.title} — ${ms.daysLeft <= 0 ? '已过期' : `T-${ms.daysLeft}天`} (${ms.project})\n`;
    });
    msg += '\n';
  }

  // Workload (Barron-only)
  if (d.overloaded.length) {
    msg += `👥 人员负荷:\n`;
    const wl = analyzeWorkload();
    Object.entries(wl.loadMap)
      .sort((a, b) => b[1].tasks - a[1].tasks)
      .slice(0, 8)
      .forEach(([name, data]) => {
        const icon = data.level === 'overloaded' ? '🔴' : data.level === 'busy' ? '🟡' : '🟢';
        msg += `${icon} ${name}: ${data.tasks}项 (${data.groupList.join(', ')})\n`;
      });
    msg += '\n';
  }

  // Global stats
  msg += `📊 全局:\n`;
  msg += `• 待办: ${d.totalOpen}项`;
  if (d.totalOverdue) msg += ` (${d.totalOverdue}逾期)`;
  if (d.totalNoOwner) msg += ` (${d.totalNoOwner}缺责任人)`;
  msg += '\n';
  if (d.totalPendingMentions) msg += `• 未回复@: ${d.totalPendingMentions}人\n`;
  if (d.clientSLA.length) msg += `• 客户侧阻塞: ${d.clientSLA.length}项\n`;

  // Per-group snapshot
  if (d.groupSummaries.length) {
    msg += '\n📌 各群:\n';
    d.groupSummaries.forEach(g => {
      let line = `• ${g.name}: ${g.open}待办`;
      if (g.overdue) line += ` 🔴${g.overdue}逾期`;
      if (g.dueToday) line += ` 🟡${g.dueToday}今日到期`;
      if (g.mentions) line += ` ⏰${g.mentions}未回复`;
      msg += line + '\n';
    });
  }

  return msg;
}

// ─────────────────────────────────────────────────────────────────────────────
// Owner Suggestion Engine
// Infers the most likely responsible person for a task when owner is missing,
// using: task title keywords, group role map, historical task patterns,
// project cluster stakeholders, and workload balance.
// ─────────────────────────────────────────────────────────────────────────────

// Role keyword map: task title patterns → likely role/person
const ROLE_KEYWORD_MAP = [
  { keywords: ['设计', 'banner', '素材', '图片', '视觉', '美工', 'UI', '排版', 'GWP图', '创意图', 'mockup', '切图'], role: 'design' },
  { keywords: ['广告', 'ROAS', 'CPC', 'CPA', 'PMax', 'PLA', 'TikTok投放', '预算', '竞价', '关键词', 'GMC', 'Shopping Ads', 'campaign'], role: 'paid_ads' },
  { keywords: ['Shopify', '独立站', '前端', 'PDP', 'Landing', '页面', 'homepage', '上线', '代码', 'dev', '产品页', '导航', 'collection', 'theme'], role: 'frontend' },
  { keywords: ['客服', '退款', '订单', '物流', '追踪', 'tracking', 'refund', 'CS', '售后', 'LTL', '发货', '签收', 'B2B'], role: 'cs' },
  { keywords: ['联盟', 'Affiliate', 'Publisher', 'Impact', 'Awin', 'Levanta', '达人', '合作', 'commission', 'KOL', '网红', 'creator'], role: 'affiliate' },
  { keywords: ['EDM', '邮件', 'Klaviyo', '模板', '邮件营销', 'flow', 'campaign邮件'], role: 'edm' },
  { keywords: ['财务', '发票', '付款', '打款', 'invoice', 'wire', '结算', '佣金', 'ACC', '对账'], role: 'finance' },
  { keywords: ['法务', '合同', '协议', '版权', 'legal', '审核', '合约'], role: 'legal' },
  { keywords: ['内容', 'blog', 'SEO', '文案', 'copy', '产品描述', 'listing', '卖点', 'selling point'], role: 'content' },
  { keywords: ['SOP', '流程', '培训', '文档', 'onboarding', '手册', '促销SOP', 'Memorial Day', '母亲节'], role: 'ops' },
  { keywords: ['Amazon', '亚马逊', 'ASIN', 'A+', 'Levanta'], role: 'amazon' },
  { keywords: ['库存', 'inventory', '备货', '到货', '补货', '价格', '定价', 'pricing'], role: 'supply' },
  { keywords: ['促销', 'promotion', 'sale', '折扣', 'discount', 'GWP', '满减', 'coupon', 'promo'], role: 'promo' },
  { keywords: ['TikTok', 'TTS', '达人带货', 'GMV', 'TikTok Shop', '样品'], role: 'tiktok' },
];

// ── v9: Person Profile — full domain/capability matrix ────────────────────
const PERSON_PROFILE = {
  '冯昭祥': {
    roles: ['frontend', 'ops', 'content'],
    primary: 'frontend',
    groups: ['N2M', 'TCL独立站技术协同群__N2M_', 'TCL独立站增长与运营组', 'Oh_Beauty_Shopify_运营', 'Oh_Beauty_Shopify'],
    capabilities: ['Shopify开发', 'PDP页面', 'Homepage设计', '产品上架', '前端修改', '独立站运营'],
    maxConcurrent: 6,
    escalateTo: 'Barron',
  },
  'James Hou': {
    roles: ['frontend', 'content'],
    primary: 'frontend',
    groups: ['N2M', 'TCL独立站技术协同群__N2M_', 'Oh_Beauty_Shopify'],
    capabilities: ['技术文档', 'PDP优化', 'Blog内容', 'Shopify开发', 'wiki维护'],
    maxConcurrent: 4,
    escalateTo: '冯昭祥',
  },
  '帆帆': {
    roles: ['affiliate', 'paid_ads', 'ops', 'promo', 'finance'],
    primary: 'affiliate',
    groups: ['CELL_付费广告', 'CELL_联盟运营', 'TCL独立站增长与运营组', 'Affiliate_Publisher_Development', 'Oh_Beauty_Shopify_运营'],
    capabilities: ['联盟运营', '广告briefing', '促销策划', '发票对账', 'publisher管理', 'Impact/Awin操作'],
    maxConcurrent: 8,
    escalateTo: 'Barron',
  },
  '欢欢': {
    roles: ['paid_ads'],
    primary: 'paid_ads',
    groups: ['CELL_付费广告', 'N2M_项目广告优化组'],
    capabilities: ['Google Ads', 'PMax', 'PLA', 'Shopping Ads', 'TikTok Ads', '预算分配', 'ROAS优化'],
    maxConcurrent: 5,
    escalateTo: '帆帆',
  },
  '金叙呈': {
    roles: ['cs', 'edm'],
    primary: 'cs',
    groups: ['TCL_客服群', 'CELL_EDM', 'N2M'],
    capabilities: ['客服处理', '退款流程', '订单管理', 'Klaviyo邮件', 'AI客服话术', 'LTL物流'],
    maxConcurrent: 5,
    escalateTo: 'Mingyi',
  },
  '刘兴竺': {
    roles: ['ops', 'supply'],
    primary: 'ops',
    groups: ['TCL独立站增长与运营组', 'TCL独立站技术协同群__N2M_'],
    capabilities: ['价格管理', '库存监控', '促销SOP', 'Memorial Day/母亲节运营', '数据录入'],
    maxConcurrent: 4,
    escalateTo: 'Mingyi',
  },
  'Mingyi': {
    roles: ['finance', 'legal', 'ops'],
    primary: 'finance',
    groups: ['TCL独立站增长与运营组', 'TCL_客服群', 'CELL_EDM', 'CELL_百万美金财务群'],
    capabilities: ['财务打款', '法务协调', '合同审核', 'Shopify权限', '跨部门沟通', '客户对接'],
    maxConcurrent: 6,
    escalateTo: 'Barron',
  },
  'Xinyue Zhang': {
    roles: ['design', 'content'],
    primary: 'design',
    groups: ['CELL_x_N2M_美工需求', 'CELL_付费广告', 'CELL_EDM', 'Oh_Beauty_Shopify_运营'],
    capabilities: ['Banner设计', '广告素材', 'EDM模板', '产品图', '视觉设计'],
    maxConcurrent: 5,
    escalateTo: '帆帆',
  },
  'XiaAlba': {
    roles: ['ops', 'promo'],
    primary: 'ops',
    groups: ['TCL独立站增长与运营组'],
    capabilities: ['促销SOP', '活动执行', '流程文档'],
    maxConcurrent: 3,
    escalateTo: '帆帆',
  },
  'Fan Zhang': {
    roles: ['ops'],
    primary: 'ops',
    groups: [],
    capabilities: ['运营支持'],
    maxConcurrent: 3,
    escalateTo: 'Barron',
  },
  '刘依绵': {
    roles: ['ops'],
    primary: 'ops',
    groups: [],
    capabilities: ['运营支持'],
    maxConcurrent: 3,
    escalateTo: 'Barron',
  },
  '谢腾燕': {
    roles: ['ops'],
    primary: 'ops',
    groups: [],
    capabilities: ['运营支持'],
    maxConcurrent: 3,
    escalateTo: 'Barron',
  },
  '金金': {
    roles: ['ops'],
    primary: 'ops',
    groups: [],
    capabilities: ['运营支持'],
    maxConcurrent: 3,
    escalateTo: 'Barron',
  },
};

// ── v9: Per-group PM coordination strategy ────────────────────────────────
const GROUP_PM_STRATEGY = {
  'TCL独立站技术协同群__N2M_': {
    cluster: 'TCL',
    pmLead: '冯昭祥',
    members: ['冯昭祥', 'James Hou', 'Mingyi', '刘兴竺'],
    taskLines: ['Shopify前端开发', '产品上架/PDP', '价格管理', '权限/系统', '法务审核'],
    interventionRules: {
      morningBrief: true,
      hourlyChase: true,
      slaWatch: ['Shopify权限问题', '产品资料处理', 'PDP法务审核'],
      escalateAfterHours: 4,
      crossGroupSync: ['TCL独立站增长与运营组', 'TCL_客服群'],
    },
    coordination: '技术群以冯昭祥为主导，James协助文档/PDP。价格变更由刘兴竺执行，Mingyi负责权限和法务接口。Clawdbot重点追踪：①未处理的产品资料 ②PDP更新进度 ③系统权限异常',
  },
  'TCL独立站增长与运营组': {
    cluster: 'TCL',
    pmLead: '刘兴竺',
    members: ['刘兴竺', '冯昭祥', '帆帆', 'Mingyi', 'XiaAlba'],
    taskLines: ['促销活动SOP', '客户合约/法务', '联盟对接', 'Bitable任务管理', '价格策略'],
    interventionRules: {
      morningBrief: true,
      hourlyChase: false,
      slaWatch: ['客户合约签署', '促销SOP截止', 'Impact账号开通'],
      escalateAfterHours: 8,
      crossGroupSync: ['TCL独立站技术协同群__N2M_', 'CELL_付费广告'],
    },
    coordination: '运营组以刘兴竺为SOP/价格主导，帆帆负责联盟和促销briefing，Mingyi处理法务和财务。Clawdbot重点追踪：①Bitable P0/P1逾期任务 ②促销里程碑(母亲节5/11, Memorial Day 5/26) ③跨群信息同步(价格→技术群, brief→广告群)',
  },
  'TCL_客服群': {
    cluster: 'TCL',
    pmLead: '金叙呈',
    members: ['金叙呈', 'Mingyi'],
    taskLines: ['退款处理', '订单异常', 'LTL物流', 'AI客服话术', 'B2B询盘'],
    interventionRules: {
      morningBrief: true,
      hourlyChase: true,
      slaWatch: ['退款超24h未处理', '客户投诉', 'LTL缺追踪号'],
      escalateAfterHours: 2,
      crossGroupSync: ['TCL独立站技术协同群__N2M_'],
    },
    coordination: '客服群金叙呈全权负责，Mingyi协助权限和邮件发送。Clawdbot重点追踪：①退款超时(>24h自动升级) ②未填tracking号订单 ③AI客服话术确认进度(deadline 5/11)',
  },
  'CELL_付费广告': {
    cluster: 'CELL',
    pmLead: '欢欢',
    members: ['欢欢', '帆帆', 'Xinyue Zhang'],
    taskLines: ['TCL广告投放', 'OhBeauty广告', 'TikTok广告', 'campaign素材', 'ROAS优化'],
    interventionRules: {
      morningBrief: true,
      hourlyChase: false,
      slaWatch: ['促销brief未到', 'ROAS<1.0', '素材未交付'],
      escalateAfterHours: 12,
      crossGroupSync: ['TCL独立站增长与运营组', 'CELL_x_N2M_美工需求'],
    },
    coordination: '广告群欢欢为执行主导，帆帆提供brief和促销信息，Xinyue出素材。Clawdbot重点追踪：①brief交付是否及时(促销前3天) ②ROAS异常(<1.0自动预警) ③素材需求→美工群联动',
  },
  'CELL_EDM': {
    cluster: 'CELL',
    pmLead: '金叙呈',
    members: ['金叙呈', 'Mingyi', 'Xinyue Zhang'],
    taskLines: ['EDM模板设计', '邮件内容审核', '价格/折扣更新', 'Klaviyo配置'],
    interventionRules: {
      morningBrief: false,
      hourlyChase: false,
      slaWatch: ['EDM发送前素材未确认', '价格变更未同步'],
      escalateAfterHours: 24,
      crossGroupSync: ['CELL_付费广告'],
    },
    coordination: 'EDM群金叙呈执行，Mingyi配置和价格管理，Xinyue出模板设计。Clawdbot追踪：①模板审核进度 ②价格同步(from运营群)',
  },
  'CELL_联盟运营': {
    cluster: 'CELL',
    pmLead: '帆帆',
    members: ['帆帆'],
    taskLines: ['Publisher对接', 'Impact/Awin操作', '佣金对账', '发票处理', 'Ottocast联盟'],
    interventionRules: {
      morningBrief: false,
      hourlyChase: false,
      slaWatch: ['发票逾期', 'publisher回复超48h'],
      escalateAfterHours: 24,
      crossGroupSync: ['CELL_百万美金财务群'],
    },
    coordination: '联盟群帆帆独立负责。Clawdbot追踪：①Ottocast ACC发票进度 ②publisher开发pipeline ③佣金结算周期',
  },
  'Oh_Beauty_Shopify_运营': {
    cluster: 'OhBeauty',
    pmLead: '冯昭祥',
    members: ['冯昭祥', 'James Hou', '帆帆', 'Xinyue Zhang', '金叙呈'],
    taskLines: ['PDP/页面优化', 'GWP促销', 'Banner更新', '款项处理', '客户素材等待'],
    interventionRules: {
      morningBrief: true,
      hourlyChase: false,
      slaWatch: ['客户素材超48h', 'GWP到期未关闭', 'Banner未上线'],
      escalateAfterHours: 8,
      crossGroupSync: ['Oh_Beauty_Shopify', 'CELL_付费广告'],
    },
    coordination: 'OB运营群冯昭祥主导前端，帆帆管促销和GWP，Xinyue出设计。Clawdbot追踪：①客户SLA(素材/banner等待) ②GWP开关时间 ③促销页面排序问题',
  },
  'Affiliate_Publisher_Development': {
    cluster: 'CELL',
    pmLead: '帆帆',
    members: ['帆帆'],
    taskLines: ['Publisher开发', '合作谈判', 'Onboarding'],
    interventionRules: {
      morningBrief: false,
      hourlyChase: false,
      slaWatch: [],
      escalateAfterHours: 48,
      crossGroupSync: [],
    },
    coordination: '帆帆独立管理publisher开发pipeline。Clawdbot以周报频率汇总。',
  },
  'CELL_百万美金财务群': {
    cluster: 'CELL',
    pmLead: 'Mingyi',
    members: ['Mingyi', '帆帆'],
    taskLines: ['打款处理', '发票核对', '佣金结算'],
    interventionRules: {
      morningBrief: false,
      hourlyChase: false,
      slaWatch: ['打款退回', '发票逾期>7天'],
      escalateAfterHours: 24,
      crossGroupSync: ['CELL_联盟运营'],
    },
    coordination: 'Mingyi负责执行打款，帆帆提供发票清单。Clawdbot追踪：①打款异常(退回/失败) ②逾期发票',
  },
  'CELL_x_N2M_美工需求': {
    cluster: 'CELL',
    pmLead: 'Xinyue Zhang',
    members: ['Xinyue Zhang', '帆帆', '欢欢'],
    taskLines: ['广告素材', 'Banner设计', '促销图片', 'EDM模板'],
    interventionRules: {
      morningBrief: false,
      hourlyChase: false,
      slaWatch: ['素材需求超48h未交付'],
      escalateAfterHours: 24,
      crossGroupSync: ['CELL_付费广告', 'CELL_EDM'],
    },
    coordination: 'Xinyue接需求并执行，帆帆和欢欢提brief。Clawdbot追踪：①需求提交→交付时间 ②素材是否联动到广告群',
  },
};

// Per-group role → person assignments (mirrors cluster stakeholders + group context)
const GROUP_ROLE_MAP = {
  'N2M': {
    frontend: ['冯昭祥', 'James Hou'],
    design: ['Xinyue Zhang'],
    ops: ['冯昭祥'],
    cs: ['金叙呈'],
    default: ['冯昭祥'],
  },
  'TCL独立站技术协同群__N2M_': {
    frontend: ['冯昭祥', 'James Hou'],
    design: ['Xinyue Zhang'],
    ops: ['刘兴竺'],
    cs: ['金叙呈'],
    supply: ['刘兴竺'],
    legal: ['Mingyi'],
    default: ['冯昭祥'],
  },
  'TCL独立站增长与运营组': {
    frontend: ['冯昭祥', 'James Hou'],
    ops: ['刘兴竺', 'XiaAlba'],
    content: ['冯昭祥'],
    legal: ['Mingyi'],
    finance: ['Mingyi'],
    affiliate: ['帆帆'],
    promo: ['刘兴竺', 'XiaAlba'],
    default: ['冯昭祥'],
  },
  'TCL_客服群': {
    cs: ['金叙呈'],
    finance: ['Mingyi'],
    supply: ['刘兴竺'],
    default: ['金叙呈'],
  },
  'CELL_付费广告': {
    paid_ads: ['欢欢'],
    design: ['Xinyue Zhang'],
    ops: ['帆帆'],
    promo: ['帆帆'],
    default: ['欢欢'],
  },
  'CELL_EDM': {
    edm: ['金叙呈', 'Mingyi'],
    design: ['Xinyue Zhang'],
    content: ['金叙呈'],
    default: ['金叙呈'],
  },
  'CELL_联盟运营': {
    affiliate: ['帆帆'],
    finance: ['帆帆'],
    amazon: ['帆帆'],
    tiktok: ['金叙呈'],
    default: ['帆帆'],
  },
  'Oh_Beauty_Shopify_运营': {
    frontend: ['冯昭祥', 'James Hou'],
    design: ['Xinyue Zhang'],
    cs: ['金叙呈'],
    promo: ['帆帆'],
    default: ['冯昭祥'],
  },
  'Oh_Beauty_Shopify': {
    frontend: ['冯昭祥', 'James Hou'],
    content: ['James Hou'],
    default: ['冯昭祥'],
  },
  'Affiliate_Publisher_Development': {
    affiliate: ['帆帆'],
    default: ['帆帆'],
  },
  'CELL_百万美金财务群': {
    finance: ['Mingyi'],
    affiliate: ['帆帆'],
    default: ['Mingyi'],
  },
  'CELL_x_N2M_美工需求': {
    design: ['Xinyue Zhang'],
    default: ['Xinyue Zhang'],
  },
  'Levoit_Affiliate_Ops': {
    affiliate: ['帆帆'],
    finance: ['Mingyi'],
    default: ['帆帆'],
  },
  'Ottocast_亚马逊联盟服务群': {
    affiliate: ['帆帆'],
    amazon: ['帆帆'],
    finance: ['Mingyi'],
    default: ['帆帆'],
  },
  'Rockbro_独立站联盟运营': {
    affiliate: ['帆帆'],
    default: ['帆帆'],
  },
  'N2M_项目广告优化组': {
    paid_ads: ['欢欢'],
    default: ['欢欢'],
  },
};

// Infer task role from title
function inferTaskRole(title) {
  const lower = title.toLowerCase();
  for (const { keywords, role } of ROLE_KEYWORD_MAP) {
    if (keywords.some(k => lower.includes(k.toLowerCase()))) return role;
  }
  return null;
}

// Look up who handled similar tasks historically in this group
function getHistoricalOwners(groupKey, taskTitle) {
  const state = loadState();
  const group = state.groups[groupKey];
  if (!group) return {};
  const role = inferTaskRole(taskTitle);
  const freq = {};
  for (const t of group.tasks) {
    if (!t.owner || t.owner === 'null') continue;
    if (t.status === 'done' || t.status === 'open') {
      // Weight by role match
      const tRole = inferTaskRole(t.title);
      if (tRole && tRole === role) {
        freq[t.owner] = (freq[t.owner] || 0) + 3; // strong signal
      }
      // Keyword overlap
      const tWords = t.title.split(/\s+|[，。：:]/);
      const qWords = taskTitle.split(/\s+|[，。：:]/);
      const overlap = tWords.filter(w => w.length > 1 && qWords.includes(w)).length;
      if (overlap > 0) {
        freq[t.owner] = (freq[t.owner] || 0) + overlap;
      }
    }
  }
  return freq;
}

// Get current workload per person in a group
function getGroupWorkload(groupKey) {
  const state = loadState();
  const group = state.groups[groupKey];
  if (!group) return {};
  const load = {};
  for (const t of group.tasks) {
    if (t.status === 'open' && t.owner && t.owner !== 'null') {
      load[t.owner] = (load[t.owner] || 0) + 1;
    }
  }
  return load;
}

// Main suggestion function — returns { suggested, confidence, reason }
function suggestOwner(groupKey, taskTitle) {
  const role = inferTaskRole(taskTitle);
  const roleMap = GROUP_ROLE_MAP[groupKey] || {};
  const histFreq = getHistoricalOwners(groupKey, taskTitle);
  const workload = getGroupWorkload(groupKey);

  // Collect candidates with scores
  const scores = {};

  // Signal 1: Role-based mapping (high weight)
  const roleCandidates = role ? (roleMap[role] || []) : [];
  roleCandidates.forEach(p => { scores[p] = (scores[p] || 0) + 10; });

  // Signal 2: Historical pattern (medium-high weight)
  for (const [person, freq] of Object.entries(histFreq)) {
    scores[person] = (scores[person] || 0) + freq * 2;
  }

  // Signal 3: Cluster stakeholders fallback
  const clusterInfo = findProjectForGroup(groupKey);
  if (clusterInfo) {
    clusterInfo.cluster.stakeholders.forEach(p => {
      if (!scores[p]) scores[p] = 1; // low baseline
    });
  }

  // Signal 4: Group default fallback
  const defaults = roleMap.default || [];
  defaults.forEach(p => { scores[p] = (scores[p] || 0) + 2; });

  if (Object.keys(scores).length === 0) {
    return { suggested: null, confidence: 'low', reason: '无足够上下文推断责任人', alternatives: [] };
  }

  // Penalize overloaded members (>5 open tasks in this group)
  for (const p of Object.keys(scores)) {
    if ((workload[p] || 0) > 5) scores[p] = Math.max(1, scores[p] - 3);
  }

  // Rank candidates
  const ranked = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .map(([name, score]) => ({ name, score, load: workload[name] || 0 }));

  const top = ranked[0];
  const total = ranked.reduce((s, r) => s + r.score, 0);
  const topShare = top.score / total;

  // Confidence: high if top candidate has >60% of score weight
  const confidence = topShare > 0.6 ? 'high' : topShare > 0.35 ? 'medium' : 'low';

  // Build reason string
  const reasons = [];
  if (roleCandidates.includes(top.name) && role) reasons.push(`负责${role}相关工作`);
  if (histFreq[top.name]) reasons.push(`历史上承接过 ${histFreq[top.name]} 个相似任务`);
  if (defaults.includes(top.name)) reasons.push(`群组默认负责人`);
  if ((workload[top.name] || 0) <= 2) reasons.push(`当前负荷低`);

  return {
    suggested: top.name,
    confidence,
    reason: reasons.join('；') || '角色匹配',
    alternatives: ranked.slice(1, 3).map(r => r.name),
  };
}

// Build owner suggestion report for a group — returns structured data
function buildOwnerSuggestions(groupKey) {
  const state = loadState();
  const group = state.groups[groupKey];
  if (!group) return [];

  const results = [];
  for (const t of group.tasks) {
    if (t.status !== 'open') continue;
    if (t.owner && t.owner !== 'null' && t.owner !== 'unknown') {
      // Already has owner — still include with confidence=confirmed
      results.push({
        taskId: t.id,
        title: t.title,
        currentOwner: t.owner,
        suggested: t.owner,
        confidence: 'confirmed',
        reason: '已指定',
        alternatives: [],
        deadline: t.deadline,
        urgency: t.urgency,
      });
    } else {
      const suggestion = suggestOwner(groupKey, t.title);
      results.push({
        taskId: t.id,
        title: t.title,
        currentOwner: null,
        suggested: suggestion.suggested,
        confidence: suggestion.confidence,
        reason: suggestion.reason,
        alternatives: suggestion.alternatives,
        deadline: t.deadline,
        urgency: t.urgency,
      });
    }
  }
  return results;
}

// Format as Feishu post paragraphs (rich text table-style)
function formatOwnerSuggestionPost(groupKey, groupName) {
  const suggestions = buildOwnerSuggestions(groupKey);
  if (!suggestions.length) return null;

  const unowned = suggestions.filter(s => s.confidence !== 'confirmed');
  const owned = suggestions.filter(s => s.confidence === 'confirmed');

  const urgencyIcon = u => u === 'critical' ? '🔴' : u === 'urgent' ? '🟡' : '⚪';
  const confIcon = c => c === 'high' ? '✅' : c === 'medium' ? '🔶' : '❓';

  const title = `🧠 责任人建议 · ${groupName}`;
  const paragraphs = [];

  // Summary
  paragraphs.push([{
    tag: 'text',
    text: `共 ${suggestions.length} 项任务　已指定 ${owned.length}　待推断 ${unowned.length}`,
  }]);
  paragraphs.push([{ tag: 'text', text: '─────────────────────────────' }]);

  if (unowned.length) {
    paragraphs.push([{ tag: 'text', text: '⚠️ 缺责任人（系统推断）', style: { bold: true } }]);
    // Column header
    paragraphs.push([{ tag: 'text', text: '任务　　　　　　　　推荐人　置信度　备选　　　推断依据' }]);

    for (const s of unowned) {
      const conf = confIcon(s.confidence);
      const alt = s.alternatives.length ? s.alternatives.join('/') : '—';
      const dl = s.deadline ? ` · ${s.deadline}` : '';
      const urg = urgencyIcon(s.urgency);
      const titleTrunc = s.title.length > 18 ? s.title.slice(0, 18) + '…' : s.title.padEnd(20);
      const ownerStr = (s.suggested || '待认领').padEnd(6);
      paragraphs.push([{
        tag: 'text',
        text: `${urg} ${titleTrunc}${dl}\n    → ${ownerStr}  ${conf}  备选: ${alt}\n    ${s.reason}`,
      }]);
    }
    paragraphs.push([{ tag: 'text', text: '' }]);
  }

  if (owned.length) {
    paragraphs.push([{ tag: 'text', text: '✅ 已指定责任人', style: { bold: true } }]);
    for (const s of owned) {
      const dl = s.deadline ? ` · 截止 ${s.deadline}` : '';
      const urg = urgencyIcon(s.urgency);
      paragraphs.push([{ tag: 'text', text: `${urg} ${s.title}${dl}　→ ${s.currentOwner}` }]);
    }
  }

  paragraphs.push([{ tag: 'text', text: '' }]);
  paragraphs.push([{ tag: 'text', text: '💡 如推断有误，请直接 @Clawdbot 指定：「任务名 由 XXX 负责」', style: { bold: true } }]);

  return { title, paragraphs };
}

// Cross-group: all groups with unowned tasks + suggestions
function buildGlobalOwnerReport() {
  const state = loadState();
  const report = [];
  for (const [gk, group] of Object.entries(state.groups)) {
    const unowned = (group.tasks || []).filter(
      t => t.status === 'open' && (!t.owner || t.owner === 'null' || t.owner === 'unknown')
    );
    if (!unowned.length) continue;
    for (const t of unowned) {
      const s = suggestOwner(gk, t.title);
      report.push({
        group: group.name || gk,
        groupKey: gk,
        taskId: t.id,
        title: t.title,
        suggested: s.suggested,
        confidence: s.confidence,
        reason: s.reason,
        alternatives: s.alternatives,
        deadline: t.deadline,
        urgency: t.urgency,
      });
    }
  }
  // Sort: critical first, then high confidence first
  return report.sort((a, b) => {
    const urgOrder = { critical: 0, urgent: 1, normal: 2 };
    const confOrder = { high: 0, medium: 1, low: 2 };
    return (urgOrder[a.urgency] - urgOrder[b.urgency]) || (confOrder[a.confidence] - confOrder[b.confidence]);
  });
}

// ── v9: Timeline-based task tracking ──────────────────────────────────────
function recordTaskTimeline(groupKey, taskId, event) {
  const state = loadState();
  if (!state.taskTimelines) state.taskTimelines = {};
  if (!state.taskTimelines[taskId]) state.taskTimelines[taskId] = [];
  state.taskTimelines[taskId].push({
    ts: Date.now(),
    event,
    groupKey,
  });
  saveState(state);
}

function getTaskTimeline(taskId) {
  const state = loadState();
  return (state.taskTimelines || {})[taskId] || [];
}

function getPersonWorkload(personName) {
  const state = loadState();
  const result = { open: [], overdue: [], groups: new Set(), totalOpen: 0 };
  const now = Date.now();
  for (const [gk, group] of Object.entries(state.groups)) {
    for (const t of group.tasks || []) {
      if (t.status !== 'open' || !t.owner || t.owner !== personName) continue;
      result.totalOpen++;
      result.groups.add(group.name || gk);
      const isOverdue = t.deadline && new Date(t.deadline).getTime() < now;
      if (isOverdue) result.overdue.push({ ...t, groupName: group.name || gk });
      else result.open.push({ ...t, groupName: group.name || gk });
    }
  }
  result.groups = [...result.groups];
  return result;
}

function getGlobalPersonMatrix() {
  const matrix = {};
  for (const [name, profile] of Object.entries(PERSON_PROFILE)) {
    const workload = getPersonWorkload(name);
    matrix[name] = {
      ...profile,
      currentLoad: workload.totalOpen,
      overdueCount: workload.overdue.length,
      activeGroups: workload.groups,
      overCapacity: workload.totalOpen > profile.maxConcurrent,
      tasks: { open: workload.open, overdue: workload.overdue },
    };
  }
  return matrix;
}

// Build PM coordination brief for a single group
function buildGroupPMBrief(groupKey) {
  const strategy = GROUP_PM_STRATEGY[groupKey];
  if (!strategy) return null;

  const state = loadState();
  const group = state.groups[groupKey];
  const tasks = (group?.tasks || []).filter(t => t.status === 'open');
  const now = Date.now();

  const overdue = tasks.filter(t => t.deadline && new Date(t.deadline).getTime() < now);
  const upcoming = tasks.filter(t => {
    if (!t.deadline) return false;
    const d = new Date(t.deadline).getTime();
    return d >= now && d <= now + 7 * 86400000;
  });
  const unowned = tasks.filter(t => !t.owner || t.owner === 'null');

  const memberLoads = {};
  for (const m of strategy.members) {
    const wl = getPersonWorkload(m);
    memberLoads[m] = { total: wl.totalOpen, overdue: wl.overdue.length, inGroup: tasks.filter(t => t.owner === m).length };
  }

  return {
    groupKey,
    cluster: strategy.cluster,
    pmLead: strategy.pmLead,
    members: strategy.members,
    taskLines: strategy.taskLines,
    coordination: strategy.coordination,
    interventionRules: strategy.interventionRules,
    stats: {
      totalOpen: tasks.length,
      overdue: overdue.length,
      upcoming7d: upcoming.length,
      unowned: unowned.length,
    },
    overdueTasks: overdue,
    upcomingTasks: upcoming,
    unownedTasks: unowned,
    memberLoads,
  };
}

// Build full PM brief for all managed groups — Barron's coordination view
function buildFullPMBrief() {
  const briefs = {};
  for (const groupKey of Object.keys(GROUP_PM_STRATEGY)) {
    const brief = buildGroupPMBrief(groupKey);
    if (brief) briefs[groupKey] = brief;
  }

  const personMatrix = getGlobalPersonMatrix();
  const overloaded = Object.entries(personMatrix)
    .filter(([, p]) => p.overCapacity)
    .map(([name, p]) => ({ name, load: p.currentLoad, max: p.maxConcurrent, overdue: p.overdueCount }));

  const crossGroupAlerts = [];
  for (const [gk, brief] of Object.entries(briefs)) {
    const rules = brief.interventionRules;
    if (brief.stats.overdue > 0) {
      crossGroupAlerts.push({ group: gk, type: 'overdue', count: brief.stats.overdue, escalateTo: brief.pmLead });
    }
    if (brief.stats.unowned > 0) {
      crossGroupAlerts.push({ group: gk, type: 'unowned', count: brief.stats.unowned, escalateTo: brief.pmLead });
    }
    for (const syncTarget of (rules.crossGroupSync || [])) {
      const targetBrief = briefs[syncTarget];
      if (targetBrief && targetBrief.stats.overdue > 0) {
        crossGroupAlerts.push({ group: gk, type: 'sibling_overdue', target: syncTarget, count: targetBrief.stats.overdue });
      }
    }
  }

  return { briefs, personMatrix, overloaded, crossGroupAlerts };
}

// Format PM brief as Feishu post paragraphs for Barron DM
function formatPMBriefPost() {
  const { briefs, personMatrix, overloaded, crossGroupAlerts } = buildFullPMBrief();
  const title = '📊 PM协调总览';
  const paragraphs = [];

  // Header stats
  const totalTasks = Object.values(briefs).reduce((s, b) => s + b.stats.totalOpen, 0);
  const totalOverdue = Object.values(briefs).reduce((s, b) => s + b.stats.overdue, 0);
  const totalUnowned = Object.values(briefs).reduce((s, b) => s + b.stats.unowned, 0);
  paragraphs.push([{ tag: 'text', text: `共 ${Object.keys(briefs).length} 群 | 任务 ${totalTasks} | 逾期 ${totalOverdue} | 待认领 ${totalUnowned}` }]);
  paragraphs.push([{ tag: 'text', text: '═══════════════════════════════' }]);

  // Overloaded people
  if (overloaded.length) {
    paragraphs.push([{ tag: 'text', text: '🔴 人员过载预警', style: { bold: true } }]);
    for (const p of overloaded) {
      paragraphs.push([{ tag: 'text', text: `  ${p.name}: ${p.load}/${p.max} 任务 (${p.overdue}逾期)` }]);
    }
    paragraphs.push([{ tag: 'text', text: '' }]);
  }

  // Per-cluster breakdown
  const clusters = {};
  for (const [gk, brief] of Object.entries(briefs)) {
    const c = brief.cluster;
    if (!clusters[c]) clusters[c] = [];
    clusters[c].push({ gk, brief });
  }

  for (const [cluster, groups] of Object.entries(clusters)) {
    paragraphs.push([{ tag: 'text', text: `── ${cluster} 集群 ──`, style: { bold: true } }]);
    for (const { gk, brief } of groups) {
      const name = brief.groupKey.replace(/_/g, ' ');
      const s = brief.stats;
      const status = s.overdue > 0 ? '🔴' : s.unowned > 0 ? '🟡' : '🟢';
      paragraphs.push([{ tag: 'text', text: `${status} ${name}` }]);
      paragraphs.push([{ tag: 'text', text: `   PM: ${brief.pmLead} | 任务${s.totalOpen} 逾期${s.overdue} 待领${s.unowned}` }]);

      if (brief.overdueTasks.length) {
        for (const t of brief.overdueTasks.slice(0, 3)) {
          paragraphs.push([{ tag: 'text', text: `   ⚠️ ${(t.title || '').slice(0, 30)} → ${t.owner || '无'}` }]);
        }
      }

      // Member load summary
      const loads = Object.entries(brief.memberLoads)
        .filter(([, l]) => l.inGroup > 0 || l.total > 0)
        .map(([n, l]) => `${n}(${l.inGroup}/${l.total})`)
        .join(' ');
      if (loads) paragraphs.push([{ tag: 'text', text: `   负荷: ${loads}` }]);
    }
    paragraphs.push([{ tag: 'text', text: '' }]);
  }

  // Cross-group alerts
  if (crossGroupAlerts.length) {
    paragraphs.push([{ tag: 'text', text: '⚡ 跨群联动提醒', style: { bold: true } }]);
    for (const a of crossGroupAlerts.slice(0, 5)) {
      if (a.type === 'sibling_overdue') {
        paragraphs.push([{ tag: 'text', text: `  ${a.group} ↔ ${a.target}: 关联群有${a.count}个逾期任务` }]);
      }
    }
  }

  paragraphs.push([{ tag: 'text', text: '' }]);
  paragraphs.push([{ tag: 'text', text: '💡 回复「策略 [群名]」查看单群PM详情', style: { bold: true } }]);

  return { title, paragraphs };
}

// Format single group PM detail for Barron
function formatGroupPMDetail(groupKey) {
  const brief = buildGroupPMBrief(groupKey);
  if (!brief) return null;

  const title = `📋 ${groupKey.replace(/_/g, ' ')} PM详情`;
  const paragraphs = [];

  paragraphs.push([{ tag: 'text', text: `集群: ${brief.cluster} | PM主导: ${brief.pmLead}` }]);
  paragraphs.push([{ tag: 'text', text: `成员: ${brief.members.join(', ')}` }]);
  paragraphs.push([{ tag: 'text', text: '' }]);

  paragraphs.push([{ tag: 'text', text: '📌 协调策略', style: { bold: true } }]);
  paragraphs.push([{ tag: 'text', text: brief.coordination }]);
  paragraphs.push([{ tag: 'text', text: '' }]);

  paragraphs.push([{ tag: 'text', text: '🔄 并行任务线', style: { bold: true } }]);
  for (const line of brief.taskLines) {
    paragraphs.push([{ tag: 'text', text: `  • ${line}` }]);
  }
  paragraphs.push([{ tag: 'text', text: '' }]);

  paragraphs.push([{ tag: 'text', text: '📊 任务状态', style: { bold: true } }]);
  paragraphs.push([{ tag: 'text', text: `  总计: ${brief.stats.totalOpen} | 逾期: ${brief.stats.overdue} | 7天内到期: ${brief.stats.upcoming7d} | 待认领: ${brief.stats.unowned}` }]);

  if (brief.overdueTasks.length) {
    paragraphs.push([{ tag: 'text', text: '' }]);
    paragraphs.push([{ tag: 'text', text: '⚠️ 逾期任务', style: { bold: true } }]);
    for (const t of brief.overdueTasks) {
      paragraphs.push([{ tag: 'text', text: `  • ${(t.title || '').slice(0, 35)} → ${t.owner || '无'} (截止${t.deadline})` }]);
    }
  }

  if (brief.unownedTasks.length) {
    paragraphs.push([{ tag: 'text', text: '' }]);
    paragraphs.push([{ tag: 'text', text: '❓ 待认领', style: { bold: true } }]);
    for (const t of brief.unownedTasks) {
      const s = suggestOwner(groupKey, t.title);
      paragraphs.push([{ tag: 'text', text: `  • ${(t.title || '').slice(0, 35)} → 建议: ${s.suggested || '无'}(${s.confidence})` }]);
    }
  }

  paragraphs.push([{ tag: 'text', text: '' }]);
  paragraphs.push([{ tag: 'text', text: '👥 成员负荷', style: { bold: true } }]);
  for (const [name, load] of Object.entries(brief.memberLoads)) {
    const profile = PERSON_PROFILE[name];
    const cap = profile ? profile.maxConcurrent : '?';
    const warn = profile && load.total > profile.maxConcurrent ? ' ⚠️过载' : '';
    paragraphs.push([{ tag: 'text', text: `  ${name}: 本群${load.inGroup} 全局${load.total}/${cap}${warn} (${load.overdue}逾期)` }]);
  }

  const rules = brief.interventionRules;
  paragraphs.push([{ tag: 'text', text: '' }]);
  paragraphs.push([{ tag: 'text', text: '⚙️ 干预规则', style: { bold: true } }]);
  paragraphs.push([{ tag: 'text', text: `  晨报: ${rules.morningBrief ? '✅' : '❌'} | 小时追踪: ${rules.hourlyChase ? '✅' : '❌'} | 升级阈值: ${rules.escalateAfterHours}h` }]);
  if (rules.slaWatch.length) {
    paragraphs.push([{ tag: 'text', text: `  SLA监控: ${rules.slaWatch.join(', ')}` }]);
  }
  if (rules.crossGroupSync.length) {
    paragraphs.push([{ tag: 'text', text: `  跨群同步: ${rules.crossGroupSync.join(', ')}` }]);
  }

  return { title, paragraphs };
}

// ── Gap detection prompt ────────────────────────────────────────────────────
const GAP_DETECT_PROMPT = `分析以下群聊消息，识别信息缺口。输出JSON:
{
  "unanswered": [{"question":"具体问题", "asker":"提问人", "minutesAgo": 数字}],
  "infoGaps": [{"needed":"需要什么信息", "for":"为了什么任务", "blocking":"阻塞了什么"}],
  "clientDeps": [{"item":"等客户什么", "requestedBy":"谁在等"}]
}
如果没有缺口，返回空数组。只返回JSON。`;

// ── Cross-group sync prompt ─────────────────────────────────────────────────
const CROSS_GROUP_PROMPT = `判断以下消息是否包含影响其他团队的决策或信息（例如价格变更、上线时间、素材要求等）。
如果有，输出JSON: {"isDecision": true, "summary": "一句话总结决策", "affects": ["可能受影响的方面"]}
如果没有，返回: {"isDecision": false}
只返回JSON。`;

module.exports = {
  // State management
  loadState, saveState, getGroup, registerGroup, resetDaily,
  // Req 1: Accountability
  validateTask, formatMissingPrompt, createTask, completeTask, deferTask,
  // Req 2: @Mention tracking
  recordMention, markMentionResponded, deferMention,
  getPendingMentions, getMentionsNeedingReminder, bumpMentionReminder,
  // Req 3: Smart intervention
  shouldIntervene, detectUrgency, detectChase,
  // Req 4: Hourly digest
  recordHourlyMessage, getHourlyUrgentItems,
  // Req 5: External sync
  recordBitableSync, getBitableChanges,
  // Req 6: Per-group isolation
  getGroupTasks, getGroupContext, updateGroupContext,
  // Briefing builders
  buildMorningBriefData, buildEveningReviewData,
  // v7: Project clusters
  getProjectClusters, findProjectForGroup, getSiblingGroups,
  // v7: Client SLA
  detectClientDependency, recordClientDependency, resolveClientDependency, getPendingClientSLA,
  // v7: Gap detection
  recordQuestion, markQuestionAnswered, getUnansweredQuestions,
  // v7: File registration
  detectFileLink, registerFile, getProjectFiles,
  // v7: Workload (Barron-only)
  analyzeWorkload,
  // v7: Milestones
  addMilestone, getUpcomingMilestones,
  // v7: Cross-group
  buildCrossGroupSync,
  // v7: Barron Dashboard
  buildBarronDashboard, formatBarronDashboard,
  // v8: Owner Suggestion Engine
  suggestOwner, buildOwnerSuggestions, formatOwnerSuggestionPost, buildGlobalOwnerReport,
  // v9: PM Coordination
  PERSON_PROFILE, GROUP_PM_STRATEGY,
  recordTaskTimeline, getTaskTimeline,
  getPersonWorkload, getGlobalPersonMatrix,
  buildGroupPMBrief, buildFullPMBrief, formatPMBriefPost, formatGroupPMDetail,
  // Prompts
  TASK_EXTRACT_PROMPT, HOURLY_CHASE_PROMPT,
  GAP_DETECT_PROMPT, CROSS_GROUP_PROMPT,
};
