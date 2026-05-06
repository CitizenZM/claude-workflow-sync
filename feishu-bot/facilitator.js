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
    groups: ['TCL独立站技术协同群__N2M_', 'N2M', 'TCL独立站增长与运营组', 'TCL_客服群'],
    keyFiles: [],
    milestones: [],
    stakeholders: ['冯昭祥', '金叙呈', '刘兴竺', 'Mingyi', 'James Hou'],
  },
  CELL: {
    groups: ['CELL_付费广告', 'CELL_EDM', 'CELL_联盟运营'],
    keyFiles: [],
    milestones: [],
    stakeholders: ['欢欢', '帆帆'],
  },
  OhBeauty: {
    groups: ['Oh_Beauty_Shopify_运营'],
    keyFiles: [],
    milestones: [],
    stakeholders: ['冯昭祥'],
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
  // Prompts
  TASK_EXTRACT_PROMPT, HOURLY_CHASE_PROMPT,
  GAP_DETECT_PROMPT, CROSS_GROUP_PROMPT,
};
