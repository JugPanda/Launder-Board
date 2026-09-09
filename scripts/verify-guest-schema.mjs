#!/usr/bin/env node
/** Read-only hosted verification; --local rehearses twice inside ROLLBACK. */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';

const migration = new URL('../supabase/guest-migrations/0001_hosted_guest.sql', import.meta.url);
function psql(sql) {
  const result = spawnSync('docker', ['exec', '-i', 'supabase_db_launder-board', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], { input: sql, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'psql failed');
  return result.stdout.trim();
}
function local() {
  const sql = readFileSync(migration, 'utf8');
  assert.match(sql, /\nBEGIN;/);
  assert.match(sql, /COMMIT;\s*$/);
  const body = sql.replace(/^BEGIN;\s*$/m, '').replace(/^COMMIT;\s*$/m, '').replace(/^NOTIFY pgrst, 'reload schema';\s*$/m, '');
  const token = randomBytes(32).toString('hex');
  const other = randomBytes(32).toString('hex');
  // Catalog definitions, ACLs and guest data fingerprints prove rollback cleanup.
  const fingerprint = `SELECT md5(coalesce(string_agg(x,'|' ORDER BY x),'')) FROM (
    SELECT c.oid::text || c.relname || c.relrowsecurity::text || coalesce(c.relacl::text,'') AS x
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    UNION ALL SELECT p.oid::text || pg_get_functiondef(p.oid) || coalesce(p.proacl::text,'')
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f'
    UNION ALL SELECT a.attrelid::text || a.attname || a.atttypid::text FROM pg_attribute a
    JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
  ) s;`;
  const before = psql(fingerprint);
  const check = (expression, label) => `DO $test$ BEGIN IF (${expression}) IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: ${label}'; END IF; END $test$; SELECT 'PASS: ${label}';`;
  const invoke = (recipient, preset = 'fresh_start') => `public.demo_save_nudge('${token}','${recipient}','${preset}')`;
  const statements = [
    'BEGIN; SET LOCAL statement_timeout = \'30s\';', body,
    check(`(public.demo_schema_status()->>'ok')::boolean`, 'schema health and nine canonical synthetic fixtures'),
    `SET LOCAL ROLE anon; SELECT public.demo_schema_status(); RESET ROLE;`,
    check(`NOT has_function_privilege('anon','public.demo_save_nudge(text,text,text)','EXECUTE') AND NOT has_function_privilege('authenticated','public.demo_save_post(text,text)','EXECUTE')`, 'anonymous and authenticated mutation RPC denial'),
    check(`has_function_privilege('service_role','public.demo_save_nudge(text,text,text)','EXECUTE')`, 'explicit service role execution grant'),
    `SET LOCAL ROLE service_role; SELECT public.demo_open_session('${token}'); SELECT public.demo_open_session('${other}'); RESET ROLE;`,
    check(`(SELECT count(*)=1 FROM public.demo_sessions WHERE token_hash='${token}' AND expires_at-created_at=interval '7 days')`, 'seven day session lifetime'),
    check(`public.demo_open_session('${token}')=(SELECT id FROM public.demo_sessions WHERE token_hash='${token}')`, 'session open is idempotent'),
    check(`public.demo_save_nudge('missing','U003','fresh_start')->>'code'='invalid_session'`, 'invalid session denial'),
    check(`${invoke('U003', 'bad')}->>'code'='invalid_preset'`, 'invalid nudge preset denial'),
    // Fixture edits are confined to this transaction, never reset legacy tables.
    `UPDATE public.demo_participants SET days_since_wash=17, tracking_state='current', last_full_cycle_date='2026-08-22', visibility='public', reminder_consent=true WHERE id IN ('U003','U005','U008');`,
    `UPDATE public.demo_participants SET display_name='Rollback verification edit', reminder_consent=false WHERE id='U001';`,
    check(`${invoke('U001')}->>'code'='ineligible' AND ${invoke('U006')}->>'code'='ineligible' AND ${invoke('U009')}->>'code'='ineligible'`, 'consent unknown and private eligibility denial'),
    `SET LOCAL ROLE service_role;`,
    check(`(${invoke('U003')}->>'ok')::boolean`, 'service role eligible nudge saved'),
    check(`${invoke('U003')}->>'code'='cooldown'`, '72 hour recipient cooldown'),
    check(`(public.demo_save_post('${token}','fresh_start')->>'ok')::boolean`, 'service role post saved'),
    check(`public.demo_save_post('${token}','fresh_start')->>'code'='already_saved'`, 'duplicate post rejected'),
    check(`public.demo_save_post('${token}',NULL)->>'code'='invalid_preset'`, 'null post preset rejected'),
    'RESET ROLE;', body,
    check(`(SELECT display_name='Rollback verification edit' AND NOT reminder_consent FROM public.demo_participants WHERE id='U001')`, 'replay preserves fixture edits'),
    check(`(SELECT count(*)=1 FROM public.demo_nudges WHERE session_id=(SELECT id FROM public.demo_sessions WHERE token_hash='${token}')) AND (SELECT count(*)=1 FROM public.demo_posts WHERE session_id=(SELECT id FROM public.demo_sessions WHERE token_hash='${token}'))`, 'replay preserves session events'),
    `INSERT INTO public.demo_nudges(session_id,recipient_id,preset) SELECT id,'U003','fresh_start' FROM public.demo_sessions CROSS JOIN generate_series(1,4) WHERE token_hash='${token}';`,
    check(`${invoke('U005')}->>'code'='daily_limit'`, 'five nudges per rolling day limit'),
    `UPDATE public.demo_nudges SET created_at=clock_timestamp()-interval '73 hours' WHERE session_id=(SELECT id FROM public.demo_sessions WHERE token_hash='${token}');`,
    check(`(${invoke('U003')}->>'ok')::boolean`, 'cooldown expires after 72 hours'),
    `UPDATE public.demo_participants SET reminder_consent=false WHERE id='U008';`,
    check(`${invoke('U008')}->>'code'='ineligible'`, 'current consent edit is enforced'),
    `UPDATE public.demo_sessions SET created_at=now()-interval '8 days',expires_at=now()-interval '1 day' WHERE token_hash='${other}';`,
    check(`public.demo_save_nudge('${other}','U005','fresh_start')->>'code'='invalid_session' AND public.demo_save_post('${other}','fresh_start')->>'code'='invalid_session'`, 'expired session rejection'),
    `CREATE TEMP TABLE verify_session_id AS SELECT id FROM public.demo_sessions WHERE token_hash='${token}'; SELECT public.demo_reset_session('${token}');`,
    check(`NOT EXISTS (SELECT 1 FROM public.demo_sessions WHERE token_hash='${token}') AND NOT EXISTS (SELECT 1 FROM public.demo_nudges WHERE session_id IN (SELECT id FROM verify_session_id)) AND NOT EXISTS (SELECT 1 FROM public.demo_posts WHERE session_id IN (SELECT id FROM verify_session_id)) AND EXISTS (SELECT 1 FROM public.demo_sessions WHERE token_hash='${other}')`, 'reset cascades own events only'),
    `SELECT public.demo_open_session('${token}');`,
    check(`NOT EXISTS (SELECT 1 FROM public.demo_sessions WHERE token_hash='${other}')`, 'open session cleans expired sessions'),
    `INSERT INTO public.demo_sessions(token_hash) SELECT md5('${other}' || g::text) || md5(g::text || '${other}') FROM generate_series(1, greatest(0,1000-(SELECT count(*)::integer FROM public.demo_sessions))) g;`,
    check(`public.demo_open_session('${token}') IS NOT NULL`, 'existing session reusable at capacity'),
    `DO $test$ BEGIN
      BEGIN
        PERFORM public.demo_open_session('${other}');
        RAISE EXCEPTION 'FAIL: expected capacity rejection';
      EXCEPTION WHEN SQLSTATE 'P0001' THEN
        IF SQLERRM <> 'guest capacity unavailable' THEN RAISE; END IF;
      END;
    END $test$; SELECT 'PASS: active session capacity enforced';`,
    `SET LOCAL ROLE anon; DO $test$ BEGIN
      BEGIN PERFORM 1 FROM public.demo_participants; RAISE EXCEPTION 'FAIL: anon table access';
      EXCEPTION WHEN insufficient_privilege THEN NULL; END;
      BEGIN PERFORM public.demo_save_post('${token}','fresh_start'); RAISE EXCEPTION 'FAIL: anon RPC access';
      EXCEPTION WHEN insufficient_privilege THEN NULL; END;
    END $test$; RESET ROLE; SELECT 'PASS: real anonymous table and write RPC calls denied';`,
    `ALTER TABLE public.demo_participants RENAME COLUMN updated_at TO verify_missing_column;`,
    check(`NOT (public.demo_schema_status()->>'ok')::boolean`, 'health fails closed on column drift'),
    'ROLLBACK;'
  ];
  try { console.log(psql(statements.join('\n'))); }
  finally { assert.equal(psql(fingerprint), before, 'public schema fingerprint must be unchanged after rollback'); }
  console.log('PASS: rehearsal rolled back; public schema/ACL/function fingerprint unchanged');
}

async function hosted() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY (or NEXT_PUBLIC equivalents), or pass --local for rollback-only local rehearsal.');
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/demo_schema_status`, {
    method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Guest schema status returned HTTP ${response.status}. Apply supabase/guest-migrations/0001_hosted_guest.sql in SQL Editor first.`);
  const status = await response.json();
  assert.equal(status.schema_version, 1);
  assert.equal(status.tables_healthy, true);
  assert.equal(status.canonical_synthetic_count, 9);
  assert.equal(status.ok, true);
  console.log(JSON.stringify(status));
}
try {
  if (process.argv.includes('--local')) local(); else await hosted();
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Guest schema verification failed');
  process.exitCode = 1;
}
