import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GUEST_PARTICIPANTS } from '../../lib/guest-demo';

const sql = readFileSync('supabase/guest-migrations/0001_hosted_guest.sql', 'utf8');

describe('standalone hosted guest schema source contracts (DB rehearsal is separate)', () => {
  it('is atomic and does not apply legacy scoring or destructive resets', () => {
    expect(sql).toMatch(/\nBEGIN;/);
    expect(sql.trim()).toMatch(/COMMIT;$/);
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).not.toMatch(/\b(?:TRUNCATE|DROP TABLE|DROP SCHEMA)\s+(?:public\.)/i);
    expect(sql).not.toMatch(/CREATE TABLE.*(?:weekly|scores|enrollments)/i);
  });
  it('seeds exactly the nine canonical people with their current source fields', () => {
    const rows = [...sql.matchAll(/\('(U\d{3})','([^']+)','([^']+)',(\d+|NULL),'(public|friends|private)',(\d+)\)/g)]
      .map(([, id, name, hall, days, visibility, streak]) => ({ id, name, hall, days: days === 'NULL' ? null : Number(days), visibility, streak: Number(streak) }));
    expect(rows).toEqual(GUEST_PARTICIPANTS.map(p => ({ id: p.id, name: p.name, hall: p.hall, days: p.daysSinceWash, visibility: p.visibility, streak: p.scrubStreak })));
    expect(sql).toContain("DATE '2026-09-08' - days");
    expect(sql).toContain("'Self-reported demo'");
    expect(sql).toContain("'Simulated CSC-format demo'");
    expect(sql).toContain('ON CONFLICT (id) DO NOTHING');
    expect(sql).toContain('ON CONFLICT (slug) DO NOTHING');
    expect(sql).not.toMatch(/ON CONFLICT[^;]*DO UPDATE/i);
  });
  it('denies direct guest table access and grants service role access explicitly', () => {
    for (const table of ['demo_participants', 'demo_sessions', 'demo_nudges', 'demo_posts']) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
    expect(sql).toContain('FROM PUBLIC, anon, authenticated');
    expect(sql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_participants, public.demo_sessions, public.demo_nudges, public.demo_posts TO service_role');
    expect(sql).toContain("CHECK (synthetic = true)");
  });
  it('serializes session quotas and locks mutable participant eligibility', () => {
    const nudge = sql.split('CREATE OR REPLACE FUNCTION public.demo_save_nudge')[1].split('CREATE OR REPLACE FUNCTION public.demo_save_post')[0];
    expect(nudge).toMatch(/demo_sessions WHERE token_hash = p_token_hash FOR UPDATE/);
    expect(nudge).toMatch(/demo_participants WHERE id = p_recipient_id FOR UPDATE/);
    expect(nudge.indexOf('FOR UPDATE')).toBeLessThan(nudge.indexOf('count(*)'));
    expect(nudge).toContain("interval '72 hours'");
    expect(nudge).toContain("interval '24 hours'");
    expect(nudge).toContain('>= 5');
    expect(nudge).toContain('v_participant.days_since_wash < 14');
    expect(nudge).toContain('NOT v_participant.reminder_consent');
    expect(nudge).toContain("v_participant.visibility = 'private'");
    expect(nudge).toContain("v_participant.tracking_state <> 'current'");
  });
  it('bounds active guest sessions while allowing existing-session reuse', () => {
    const open = sql.split('CREATE OR REPLACE FUNCTION public.demo_open_session')[1].split('CREATE OR REPLACE FUNCTION public.demo_save_nudge')[0];
    expect(open).toContain('pg_advisory_xact_lock(736209080002)');
    expect(open).toContain('DELETE FROM public.demo_sessions WHERE expires_at <= clock_timestamp()');
    expect(open).toContain('IF v_id IS NOT NULL THEN RETURN v_id');
    expect(open).toContain('>= 1000');
    expect(open).toContain('guest capacity unavailable');
    expect(open.indexOf('IF v_id IS NOT NULL')).toBeLessThan(open.indexOf('>= 1000'));
  });
  it('hardens every definer and exposes only bounded health metadata', () => {
    expect([...sql.matchAll(/SECURITY DEFINER/g)]).toHaveLength(5);
    expect([...sql.matchAll(/SECURITY DEFINER SET search_path = ''/g)]).toHaveLength(5);
    const status = sql.split('CREATE OR REPLACE FUNCTION public.demo_schema_status()')[1].split('REVOKE ALL ON FUNCTION public.demo_schema_status()')[0];
    expect(status).toContain('STABLE');
    expect(status).toContain("'schema_version',1");
    expect(status).toContain("'canonical_synthetic_count',v_count");
    expect(status).not.toMatch(/SELECT\s+\*/i);
    expect(status).toMatch(/RETURN jsonb_build_object\('schema_version',1,'tables_healthy',v_healthy,'canonical_synthetic_count',v_count,'ok',v_healthy AND v_count=9\);/);
    expect(status).not.toMatch(/FROM public\.demo_(sessions|nudges|posts)/i);
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.demo_schema_status() TO anon, authenticated, service_role');
  });
});
