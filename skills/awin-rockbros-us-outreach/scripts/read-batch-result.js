// Awin read-batch-result script v1.0 — call immediately after bulk-invite.js completes
// bulk-invite.js writes its full result to localStorage.__awin_last_batch to keep
// the browser_evaluate return value short (avoids embedding publisher arrays in snapshots).
// If the evaluate already returned the full JSON directly, this script is a no-op fallback.
() => {
  const r = localStorage.getItem('__awin_last_batch');
  if (r) { localStorage.removeItem('__awin_last_batch'); return r; }
  return '{"error":"no_result_in_storage"}';
}
