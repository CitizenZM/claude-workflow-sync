// Stub — Supabase ingest disabled for TCL; data persisted to local files only
export async function ingestBatch(...args) { return { ok: true, count: (args[0]||[]).length, skipped: 'supabase-disabled' }; }
