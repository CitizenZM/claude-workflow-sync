import fs from "fs";
import path from "path";

// Try parent dir first (local dev), fall back to bundled public/data (Vercel)
function resolveBotFile(filename: string): string {
  const parent = path.join(process.cwd(), "..", filename);
  if (fs.existsSync(parent)) return parent;
  return path.join(process.cwd(), "public", "data", filename);
}

export interface Task {
  id: string;
  title: string;
  owner: string;
  deadline: string | null;
  source: string;
  urgency: string;
  status: "open" | "done" | "deferred";
  createdAt: string;
  updatedAt: string;
  groupKey: string;
}

export interface Group {
  key: string;
  chatId: string;
  name: string;
  tasks: Task[];
}

export interface FacilitatorState {
  groups: Record<string, Group>;
  tasks?: Task[];
}

export interface OpsData {
  tasks?: Task[];
  timeline?: unknown[];
  chats?: unknown;
  bitables?: unknown;
}

export function loadFacilitatorState(): FacilitatorState {
  try {
    const raw = fs.readFileSync(resolveBotFile("facilitator_state.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return { groups: {} };
  }
}

export function loadOpsData(): OpsData {
  try {
    const raw = fs.readFileSync(resolveBotFile("ops_data.json"), "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function loadDashboardMd(): string {
  try {
    return fs.readFileSync(resolveBotFile("dashboard_latest.md"), "utf-8");
  } catch {
    return "";
  }
}

export interface DashboardData {
  generatedAt: string;
  groupsScanned: string;
  activeThreads: string;
  criticalIssues: CriticalIssue[];
  slaAtRisk: SlaItem[];
  unansweredQuestions: UnansweredQ[];
  milestones: Milestone[];
  workload: WorkloadPerson[];
  stats: Record<string, string>;
  allTasks: Task[];
  openTasksByGroup: Record<string, Task[]>;
}

export interface CriticalIssue {
  num: number;
  group: string;
  issue: string;
  waitingSince: string;
  owner: string;
}

export interface SlaItem {
  group: string;
  blocked: string;
  daysWaiting: string;
  nextAction: string;
}

export interface UnansweredQ {
  group: string;
  question: string;
  askedBy: string;
  hoursWaiting: string;
}

export interface Milestone {
  project: string;
  milestone: string;
  dueDate: string;
  status: string;
}

export interface WorkloadPerson {
  person: string;
  groups: string;
  load: string;
  signal: string;
}

function parseTable(lines: string[]): string[][] {
  const tableLines = lines.filter((l) => l.startsWith("|") && !l.match(/^\|[-| ]+\|$/));
  // Skip the first row (header) and return data rows only
  return tableLines.slice(1).map((l) =>
    l
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim())
  );
}

export function parseDashboardMd(md: string): DashboardData {
  const lines = md.split("\n");

  const header = lines[1] || "";
  const generatedAt = header.match(/\*\*Generated\*\*: ([^*]+)/)?.[1]?.trim() ?? "";
  const groupsScanned = header.match(/\*\*Groups scanned\*\*: ([^*]+)/)?.[1]?.trim() ?? "";
  const activeThreads = header.match(/\*\*Active threads[^*]*\*\*: ([^*]+)/)?.[1]?.trim() ?? "";

  // Split into sections
  function extractSection(heading: string): string[] {
    const start = lines.findIndex((l) => l.startsWith(`## ${heading}`));
    if (start === -1) return [];
    const end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
    return lines.slice(start + 1, end === -1 ? undefined : end);
  }

  const criticalLines = extractSection("CRITICAL INTERVENTIONS NEEDED");
  const criticalIssues: CriticalIssue[] = parseTable(criticalLines).map((row) => ({
    num: parseInt(row[0]) || 0,
    group: row[1] ?? "",
    issue: row[2] ?? "",
    waitingSince: row[3] ?? "",
    owner: row[4] ?? "",
  }));

  const slaLines = extractSection("CLIENT SLA AT RISK");
  const slaAtRisk: SlaItem[] = parseTable(slaLines).map((row) => ({
    group: row[0] ?? "",
    blocked: row[1] ?? "",
    daysWaiting: row[2] ?? "",
    nextAction: row[3] ?? "",
  }));

  const uqLines = extractSection("UNANSWERED QUESTIONS");
  const unansweredQuestions: UnansweredQ[] = parseTable(uqLines).map((row) => ({
    group: row[0] ?? "",
    question: row[1] ?? "",
    askedBy: row[2] ?? "",
    hoursWaiting: row[3] ?? "",
  }));

  const msLines = extractSection("UPCOMING MILESTONES");
  const milestones: Milestone[] = parseTable(msLines).map((row) => ({
    project: row[0] ?? "",
    milestone: row[1] ?? "",
    dueDate: row[2] ?? "",
    status: row[3] ?? "",
  }));

  const wlLines = extractSection("WORKLOAD SIGNAL");
  const workload: WorkloadPerson[] = parseTable(wlLines).map((row) => ({
    person: row[0] ?? "",
    groups: row[1] ?? "",
    load: row[2] ?? "",
    signal: row[3] ?? "",
  }));

  const statsLines = extractSection("STATS");
  const stats: Record<string, string> = {};
  parseTable(statsLines).forEach((row) => {
    if (row[0] && row[1]) stats[row[0]] = row[1];
  });

  // Load live tasks from facilitator_state
  const state = loadFacilitatorState();
  const allTasks: Task[] = [];
  const openTasksByGroup: Record<string, Task[]> = {};
  for (const [key, group] of Object.entries(state.groups)) {
    const open = (group.tasks || []).filter((t) => t.status === "open");
    if (open.length) {
      openTasksByGroup[group.name || key] = open;
      allTasks.push(...open);
    }
  }

  return {
    generatedAt,
    groupsScanned,
    activeThreads,
    criticalIssues,
    slaAtRisk,
    unansweredQuestions,
    milestones,
    workload,
    stats,
    allTasks,
    openTasksByGroup,
  };
}
