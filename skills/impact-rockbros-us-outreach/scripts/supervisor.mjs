/**
 * Rockbros Supervisor — Progress-based, not time-based
 *
 * Logic:
 * - Check ledger every 60s
 * - If ledger grew since last check: HEALTHY, do nothing
 * - If ledger flat AND step log shows activity in last 5 min: runner trying, give it time
 * - If ledger flat AND step log silent 5+ min: runner stuck, restart ONCE
 * - If 3 consecutive restarts all yield 0 new ledger rows: ERROR, stop, alert
 * - Single instance via /tmp/rockbros-supervisor.pid
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const LEDGER    = path.join(os.homedir(), 'Documents/Obsidian/01-Projects/Impact-Rockbros-US-Outreach-Ledger.md');
const STEP_LOG  = '/tmp/rockbros-step.log';
const RUN_LOG   = '/tmp/rockbros-runner.log';
const SUP_LOG   = '/tmp/rockbros-supervisor.log';
const RUNNER_LOCK = '/tmp/rockbros-runner.pid';
const SUP_LOCK  = '/tmp/rockbros-supervisor.pid';
const RUNNER    = '/tmp/patchright-bypass/rockbros-runner.mjs';
const TARGET    = parseInt(process.env.OUTREACH_COUNT || '5000');
const CHECK_INTERVAL = 60 * 1000; // 60s
const STALL_THRESHOLD = 5 * 60 * 1000; // 5min silence = stuck

let lastLedgerCount = 0;
let lastStepActivity = Date.now();
let consecutiveZeroRestarts = 0;
let restartLedgerCount = 0;

// ── SINGLE INSTANCE ───────────────────────────────────────────────────────────
try {
  const pid = parseInt(fs.readFileSync(SUP_LOCK, 'utf8').trim());
  if (pid && pid !== process.pid) {
    try { process.kill(pid, 0); console.log(`Supervisor already running (${pid}). Exit.`); process.exit(0); } catch {}
  }
} catch {}
fs.writeFileSync(SUP_LOCK, String(process.pid));
process.on('exit', () => { try { fs.unlinkSync(SUP_LOCK); } catch {} });

// ── UTILS ─────────────────────────────────────────────────────────────────────
function slog(msg) {
  const line = `[${new Date().toISOString().slice(11,19)}] [SUP] ${msg}`;
  console.log(line);
  fs.appendFileSync(SUP_LOG, line + '\n');
}

function getLedgerCount() {
  try { return fs.readFileSync(LEDGER, 'utf8').split('\n').filter(l => l.includes('impact-50132')).length; } catch { return 0; }
}

function getRunnerPid() {
  try {
    const pid = parseInt(fs.readFileSync(RUNNER_LOCK, 'utf8').trim());
    if (!pid) return null;
    try { process.kill(pid, 0); return pid; } catch { return null; }
  } catch { return null; }
}

function getStepLogAge() {
  try { return Date.now() - fs.statSync(STEP_LOG).mtimeMs; } catch { return Infinity; }
}

function getErrorHistogram() {
  // Read last 200 lines of step log and count error types
  try {
    const lines = fs.readFileSync(STEP_LOG, 'utf8').split('\n').slice(-200);
    const counts = {};
    for (const line of lines) {
      const m = line.match(/\| ([a-z_]+) \| err:([^\n]+)/);
      if (m) { const key = `${m[1]}:${m[2].slice(0,30)}`; counts[key] = (counts[key]||0)+1; }
    }
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>`${k}(${v})`).join(', ');
  } catch { return 'no-data'; }
}

function killRunner() {
  const pid = getRunnerPid();
  if (pid) {
    try { process.kill(pid, 'SIGTERM'); slog(`Killed runner PID ${pid}`); } catch {}
  }
  try { fs.unlinkSync(RUNNER_LOCK); } catch {}
}

function startRunner() {
  const ledgerBefore = getLedgerCount();
  restartLedgerCount = ledgerBefore;
  const child = spawn('node', [RUNNER], {
    detached: true, stdio: 'ignore',
    env: { ...process.env, OUTREACH_COUNT: String(TARGET) }
  });
  child.unref();
  slog(`Started runner PID ${child.pid} (ledger=${ledgerBefore})`);
}

// ── MAIN LOOP ─────────────────────────────────────────────────────────────────
slog(`Supervisor started | target=${TARGET} | check every ${CHECK_INTERVAL/1000}s`);
fs.appendFileSync(SUP_LOG, `=== SUPERVISOR START ${new Date().toISOString()} ===\n`);

lastLedgerCount = getLedgerCount();
slog(`Initial ledger count: ${lastLedgerCount}`);

// Start runner immediately if not running
if (!getRunnerPid()) {
  slog('No runner found — starting');
  startRunner();
}

const loop = setInterval(async () => {
  const now = getLedgerCount();
  const runnerPid = getRunnerPid();
  const stepAge = getStepLogAge();

  slog(`CHECK: ledger=${now} runner=${runnerPid||"dead"} step_age=${Math.round(stepAge/1000)}s`);

  // Immediately restart dead runner
  if(!runnerPid){
    slog("Runner dead — restarting immediately");
    startRunner();
    lastLedgerCount=now;
    return;
  }

  // ── TARGET REACHED ────────────────────────────────────────────────────────
  if (now >= TARGET) {
    slog(`🎯 TARGET REACHED: ${now}/${TARGET}. Stopping supervisor.`);
    if (runnerPid) killRunner();
    clearInterval(loop);
    process.exit(0);
  }

  // ── LEDGER GREW: healthy ───────────────────────────────────────────────────
  if (now > lastLedgerCount) {
    const delta = now - lastLedgerCount;
    slog(`✅ PROGRESS: +${delta} new rows (${lastLedgerCount} → ${now})`);
    lastLedgerCount = now;
    consecutiveZeroRestarts = 0;
    lastStepActivity = Date.now();
    return;
  }

  // ── LEDGER FLAT ───────────────────────────────────────────────────────────
  if (stepAge < STALL_THRESHOLD) {
    slog(`⏳ WAITING: runner active (step ${Math.round(stepAge/1000)}s ago), ledger flat`);
    return;
  }

  // ── STALL DETECTED ────────────────────────────────────────────────────────
  slog(`⚠️  STALL: ledger flat AND step log silent ${Math.round(stepAge/60000)}min`);
  const histogram = getErrorHistogram();
  slog(`   Error histogram: ${histogram}`);

  if (runnerPid) {
    slog(`   Killing stalled runner PID ${runnerPid}`);
    killRunner();
    await new Promise(r => setTimeout(r, 2000));
  }

  // Check if last restart made progress
  const progressSinceRestart = now - restartLedgerCount;
  if (consecutiveZeroRestarts > 0 && progressSinceRestart === 0) {
    consecutiveZeroRestarts++;
    slog(`   Zero-progress restart #${consecutiveZeroRestarts}`);
  } else {
    consecutiveZeroRestarts = 1;
  }

  // ── MAX RETRIES EXCEEDED ──────────────────────────────────────────────────
  if (consecutiveZeroRestarts >= 3) {
    // Pool exhausted — stay in watch mode, keep restarting every 10 min for new registrations
    slog(`⏳ Pool exhausted (${consecutiveZeroRestarts} zero restarts). Watch mode — retrying in 10 min for new registrations...`);
    consecutiveZeroRestarts = 0; // reset to keep cycling indefinitely
    // Wait 10 minutes before next restart to avoid hammering the site
    await new Promise(r => setTimeout(r, 10 * 60 * 1000));
  }

  // ── RESTART RUNNER ────────────────────────────────────────────────────────
  slog(`🔄 RESTARTING runner (attempt ${consecutiveZeroRestarts})`);
  startRunner();
  lastLedgerCount = now;

}, CHECK_INTERVAL);

// Keep alive
process.on('SIGTERM', () => { slog('SIGTERM received'); clearInterval(loop); process.exit(0); });
process.on('SIGINT', () => { slog('SIGINT received'); clearInterval(loop); process.exit(0); });
