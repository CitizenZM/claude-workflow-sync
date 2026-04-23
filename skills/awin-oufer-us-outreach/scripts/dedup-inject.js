// Sets window.__DEDUP from ledger names — run once by Sonnet before spawning Haiku.
// Caller replaces DEDUP_ARRAY with actual JSON array literal before browser_evaluate.
() => {
  window.__DEDUP = DEDUP_ARRAY;
  return { ok: true, count: window.__DEDUP.length };
}
