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
  // Prompts
  TASK_EXTRACT_PROMPT, HOURLY_CHASE_PROMPT,
};
