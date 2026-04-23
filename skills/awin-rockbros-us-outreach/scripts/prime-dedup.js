// Awin prime-dedup script v1.0 — run ONCE at session start via browser_evaluate
// Caller replaces %%NAMES%% with JSON array of already-invited publisher names.
// Sets window.__awinDedup (Set, lowercase) that bulk-invite.js reads directly.
// After a navigation/crash, re-run this script to restore the dedup set.
() => {
  const NAMES = %%NAMES%%;
  window.__awinDedup = new Set(NAMES.map(n => n.toLowerCase()));
  return JSON.stringify({ primed: window.__awinDedup.size });
}
