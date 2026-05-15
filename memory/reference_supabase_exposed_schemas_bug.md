---
name: Supabase Data API "Exposed schemas" UI does NOT update PostgREST runtime config
description: On adstream-ai (and likely other projects), the dashboard's "Data API → Exposed schemas" Save button updates UI state but not the authenticator role's pgrst.db_schemas. Must ALTER ROLE authenticator SET pgrst.db_schemas directly.
type: reference
originSessionId: e1be07ac-94a3-4dde-ad73-f323ac784885
---
**Symptom:** Supabase dashboard → Integrations → Data API → Settings → "Exposed schemas" shows the desired schemas after Save (e.g. "3 of 5 schemas exposed"), but PostgREST returns:
```
HTTP 406 PGRST106
{"hint":"Only the following schemas are exposed: public, graphql_public, growth_os"}
```
even after project restart.

**Root cause:** PostgREST reads exposed schemas from `pgrst.db_schemas` set on the `authenticator` Postgres role. The dashboard's new "Data API integration" Save UI persists to a different state store and never writes to the role config. Project restart doesn't fix it because the role config never changed.

**Diagnostic SQL:**
```sql
SELECT rolname, rolconfig FROM pg_roles WHERE rolname='authenticator';
-- → rolconfig contains 'pgrst.db_schemas=public, graphql_public, growth_os'
```

**Fix (direct SQL, takes effect in seconds):**
```sql
ALTER ROLE authenticator SET pgrst.db_schemas TO 'public, graphql_public, <your_schema>';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';

-- Then grant access on the schema:
GRANT USAGE ON SCHEMA <your_schema> TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA <your_schema> TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA <your_schema> TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA <your_schema> GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA <your_schema> GRANT USAGE, SELECT ON SEQUENCES TO service_role;
NOTIFY pgrst, 'reload schema';
```

**Verify:**
```bash
curl -H "apikey: <key>" -H "Accept-Profile: <your_schema>" \
  "https://<project>.supabase.co/rest/v1/<your_table>?limit=1"
# → 200
```

**Don't bother with:** restart project, UI re-saves with intentional diff, browser hard reload, cache-busting headers. The UI Save is decoupled from the runtime config. Filed under "Supabase platform bug" as of 2026-05.

**Cost when hit:** ~30 min of UI thrashing if you don't know about it. Three fix attempts via UI all fail with the same error.
