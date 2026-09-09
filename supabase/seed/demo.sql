-- Synthetic LaundroStat demo seed. No row represents a real student, hall, or provider record.
-- Local-only password for all fixtures: demo-pass-2026

begin;

insert into public.residence_halls (id, campus_id, name, slug)
values
  ('00000000-0000-4000-8000-00000000a001', 'synthetic-campus', 'Maple Hall', 'maple-hall'),
  ('00000000-0000-4000-8000-00000000a002', 'synthetic-campus', 'River Hall', 'river-hall'),
  ('00000000-0000-4000-8000-00000000a003', 'synthetic-campus', 'Oak Hall', 'oak-hall')
on conflict (id) do update set name = excluded.name, slug = excluded.slug, active = true;

with synthetic_users(id, email, display_name, slug, hall_id, visibility, directory_opt_in, reminders, encouragement_scope, public_stats, public_hall, tracking_started_at) as (
  values
    ('00000000-0000-4000-8000-000000000101'::uuid, 'maya.quest@demo.invalid', 'Maya Quest', 'maya-quest', '00000000-0000-4000-8000-00000000a001'::uuid, 'public'::public.profile_visibility, true, true, 'friends'::public.encouragement_scope, true, true, '2026-08-01T00:00:00Z'::timestamptz),
    ('00000000-0000-4000-8000-000000000102', 'leo.loop@demo.invalid', 'Leo Loop', 'leo-loop', '00000000-0000-4000-8000-00000000a001', 'friends', true, true, 'friends', false, false, '2026-08-01T00:00:00Z'),
    ('00000000-0000-4000-8000-000000000103', 'nora.node@demo.invalid', 'Nora Node', 'nora-node', '00000000-0000-4000-8000-00000000a001', 'private', false, false, 'off', false, false, null),
    ('00000000-0000-4000-8000-000000000104', 'eli.echo@demo.invalid', 'Eli Echo', 'eli-echo', '00000000-0000-4000-8000-00000000a001', 'private', false, false, 'off', false, false, null),
    ('00000000-0000-4000-8000-000000000105', 'zoe.zero@demo.invalid', 'Zoe Zero', 'zoe-zero', '00000000-0000-4000-8000-00000000a001', 'friends', true, true, 'friends', false, false, '2026-07-01T00:00:00Z'),
    ('00000000-0000-4000-8000-000000000106', 'ari.array@demo.invalid', 'Ari Array', 'ari-array', '00000000-0000-4000-8000-00000000a001', 'friends', true, true, 'hall', false, false, '2026-08-01T00:00:00Z'),
    ('00000000-0000-4000-8000-000000000107', 'river.rune@demo.invalid', 'River Rune', 'river-rune', '00000000-0000-4000-8000-00000000a002', 'public', true, true, 'hall', true, true, '2026-08-01T00:00:00Z'),
    ('00000000-0000-4000-8000-000000000108', 'quinn.query@demo.invalid', 'Quinn Query', 'quinn-query', '00000000-0000-4000-8000-00000000a002', 'friends', true, true, 'friends', false, false, '2026-08-01T00:00:00Z'),
    ('00000000-0000-4000-8000-000000000109', 'sam.stack@demo.invalid', 'Sam Stack', 'sam-stack', '00000000-0000-4000-8000-00000000a002', 'private', false, false, 'off', false, false, null),
    ('00000000-0000-4000-8000-000000000110', 'tess.token@demo.invalid', 'Tess Token', 'tess-token', '00000000-0000-4000-8000-00000000a002', 'friends', true, true, 'friends', false, false, '2026-08-01T00:00:00Z'),
    ('00000000-0000-4000-8000-000000000111', 'ivy.index@demo.invalid', 'Ivy Index', 'ivy-index', '00000000-0000-4000-8000-00000000a002', 'friends', true, true, 'friends', false, false, '2026-08-01T00:00:00Z'),
    ('00000000-0000-4000-8000-000000000112', 'uma.uplink@demo.invalid', 'Uma Uplink', 'uma-uplink', '00000000-0000-4000-8000-00000000a002', 'private', false, false, 'off', false, false, null),
    ('00000000-0000-4000-8000-000000000113', 'oak.orbit@demo.invalid', 'Oak Orbit', 'oak-orbit', '00000000-0000-4000-8000-00000000a003', 'public', true, true, 'hall', true, true, '2026-08-01T00:00:00Z'),
    ('00000000-0000-4000-8000-000000000114', 'bea.byte@demo.invalid', 'Bea Byte', 'bea-byte', '00000000-0000-4000-8000-00000000a003', 'friends', true, true, 'friends', false, false, '2026-08-01T00:00:00Z'),
    ('00000000-0000-4000-8000-000000000115', 'cam.cache@demo.invalid', 'Cam Cache', 'cam-cache', '00000000-0000-4000-8000-00000000a003', 'private', false, false, 'off', false, false, null),
    ('00000000-0000-4000-8000-000000000116', 'dev.delta@demo.invalid', 'Dev Delta', 'dev-delta', '00000000-0000-4000-8000-00000000a003', 'friends', true, true, 'hall', false, false, '2026-08-01T00:00:00Z'),
    ('00000000-0000-4000-8000-000000000117', 'finn.filter@demo.invalid', 'Finn Filter', 'finn-filter', '00000000-0000-4000-8000-00000000a003', 'friends', true, true, 'friends', false, false, '2026-08-01T00:00:00Z'),
    ('00000000-0000-4000-8000-000000000118', 'gale.guard@demo.invalid', 'Gale Guard', 'gale-guard', '00000000-0000-4000-8000-00000000a003', 'private', false, false, 'off', false, false, null)
), inserted_users as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
    extensions.crypt('demo-pass-2026', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"],"synthetic_demo":true}'::jsonb,
    jsonb_build_object('display_name', display_name, 'synthetic_demo', true),
    now(), now(), '', '', '', ''
  from synthetic_users
  on conflict (id) do update set
    email = excluded.email,
    encrypted_password = excluded.encrypted_password,
    email_confirmed_at = excluded.email_confirmed_at,
    raw_app_meta_data = excluded.raw_app_meta_data,
    raw_user_meta_data = excluded.raw_user_meta_data,
    updated_at = now()
  returning id
)
insert into public.profiles (
  id, auth_user_id, display_name, public_slug, hall_id, visibility,
  directory_opt_in, reminder_enabled, encouragement_scope,
  public_stats_opt_in, public_hall_opt_in, tracking_started_at
)
select
  ('00000000-0000-4000-8000-' || lpad((200 + row_number() over (order by id))::text, 12, '0'))::uuid,
  id, display_name, slug, hall_id, visibility, directory_opt_in, reminders,
  encouragement_scope, public_stats, public_hall, tracking_started_at
from synthetic_users
on conflict (auth_user_id) do update set
  display_name = excluded.display_name,
  public_slug = excluded.public_slug,
  hall_id = excluded.hall_id,
  visibility = excluded.visibility,
  directory_opt_in = excluded.directory_opt_in,
  reminder_enabled = excluded.reminder_enabled,
  encouragement_scope = excluded.encouragement_scope,
  public_stats_opt_in = excluded.public_stats_opt_in,
  public_hall_opt_in = excluded.public_hall_opt_in,
  tracking_started_at = excluded.tracking_started_at,
  active = true,
  deleted_at = null;

insert into public.hall_invites (id, hall_id, code_hash, label, use_limit)
values
  ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a001', extensions.digest(convert_to('MAPLE-DEMO', 'UTF8'), 'sha256'), 'Synthetic Maple demo invite', 100),
  ('00000000-0000-4000-8000-00000000b002', '00000000-0000-4000-8000-00000000a002', extensions.digest(convert_to('RIVER-DEMO', 'UTF8'), 'sha256'), 'Synthetic River demo invite', 100),
  ('00000000-0000-4000-8000-00000000b003', '00000000-0000-4000-8000-00000000a003', extensions.digest(convert_to('OAK-DEMO', 'UTF8'), 'sha256'), 'Synthetic Oak demo invite', 100)
on conflict (id) do update set active = true, use_limit = 100, label = excluded.label;

-- Maya's accepted opted-in friends exercise current, due, and stale-search cases.
insert into public.friendships (id, requester_id, addressee_id, status, responded_at)
values
  ('00000000-0000-4000-8000-00000000c001', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000202', 'accepted', now()),
  ('00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000205', 'accepted', now()),
  ('00000000-0000-4000-8000-00000000c003', '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000208', 'accepted', now())
on conflict (id) do nothing;

-- One active synthetic competition with a locked current week and an enrollable next week.
insert into public.competitions (
  id, name, time_zone, minimum_roster, starts_on, ends_on, paused
) values (
  '00000000-0000-4000-8000-00000000c100',
  'Synthetic Laundry League',
  'America/New_York',
  5,
  '2026-09-07'::date,
  '2026-09-20'::date,
  false
)
on conflict (id) do update set
  name = excluded.name,
  time_zone = excluded.time_zone,
  minimum_roster = excluded.minimum_roster,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  paused = false;

insert into public.competition_weeks (
  competition_id, week_starts_on, starts_at, ends_at, score_closes_at, paused
) values
  (
    '00000000-0000-4000-8000-00000000c100',
    '2026-09-07'::date,
    '2026-09-07'::timestamp at time zone 'America/New_York',
    '2026-09-14'::timestamp at time zone 'America/New_York',
    '2026-09-17'::timestamp at time zone 'America/New_York',
    false
  ),
  (
    '00000000-0000-4000-8000-00000000c100',
    '2026-09-14'::date,
    '2026-09-14'::timestamp at time zone 'America/New_York',
    '2026-09-21'::timestamp at time zone 'America/New_York',
    '2026-09-24'::timestamp at time zone 'America/New_York',
    false
  )
on conflict (competition_id, week_starts_on) do update set paused = false;

-- case: immutable-current-week-enrollments count=18
insert into public.competition_enrollments (
  competition_id, week_starts_on, participant_id, hall_id, eligible, paused,
  snapshotted_at
)
select
  '00000000-0000-4000-8000-00000000c100',
  '2026-09-07'::date,
  ('00000000-0000-4000-8000-' || lpad(profile_number::text, 12, '0'))::uuid,
  case
    when profile_number between 201 and 206 then '00000000-0000-4000-8000-00000000a001'::uuid
    when profile_number between 207 and 212 then '00000000-0000-4000-8000-00000000a002'::uuid
    else '00000000-0000-4000-8000-00000000a003'::uuid
  end,
  true,
  false,
  '2026-09-07T04:00:00Z'::timestamptz
from generate_series(201, 218) as profile_number
on conflict (competition_id, week_starts_on, participant_id) do nothing;

-- Every import is synthetic_demo; no original file or provider assertion exists.
insert into public.activity_imports (
  id, profile_id, source, original_file_name, storage_key, cleanup_due_at,
  original_deleted_at, cleanup_required, status, summary, created_at, completed_at
) values
  (
    '00000000-0000-4000-8000-00000000f001',
    '00000000-0000-4000-8000-000000000201',
    'synthetic_demo', null, null, '2026-09-09T12:00:00Z',
    '2026-09-08T12:01:00Z', false, 'completed',
    '{"synthetic":true,"accepted":1,"duplicates":1}'::jsonb,
    '2026-09-08T12:00:00Z', '2026-09-08T12:01:00Z'
  ),
  (
    '00000000-0000-4000-8000-00000000f002',
    '00000000-0000-4000-8000-000000000212',
    'synthetic_demo', null, null, '2026-09-10T12:00:00Z',
    null, false, 'failed',
    '{"synthetic":true,"error":"intentional demo parse failure"}'::jsonb,
    '2026-09-09T12:00:00Z', '2026-09-09T12:00:30Z'
  ),
  (
    '00000000-0000-4000-8000-00000000f003',
    '00000000-0000-4000-8000-000000000217',
    'synthetic_demo', null, null, '2026-09-15T05:00:00Z',
    '2026-09-14T05:01:00Z', false, 'completed',
    '{"synthetic":true,"late_arrival":true}'::jsonb,
    '2026-09-14T05:00:00Z', '2026-09-14T05:01:00Z'
  )
on conflict (id) do update set status = excluded.status, summary = excluded.summary;

-- case: current (the first eight canonical washer activities drive current-week scoring)
-- case: due
-- case: stale
-- case: unknown
-- case: dryer
-- case: failed
-- case: refunded
-- case: late (a synthetic import arriving after its represented activity)
insert into public.laundry_activities (
  id, profile_id, source, source_record_id_hash, dedupe_fingerprint,
  occurred_at, machine_kind, cycle_status, evidence_level, raw_import_id,
  synthetic_demo, created_at, updated_at
) values
  ('00000000-0000-4000-8000-00000000d001', '00000000-0000-4000-8000-000000000201', 'synthetic_demo', 'syn-rec-001', 'synthetic-demo-fingerprint-001', '2026-09-07T12:00:00Z', 'washer', 'completed', 'user_supplied', '00000000-0000-4000-8000-00000000f001', true, '2026-09-07T12:40:00Z', '2026-09-07T12:40:00Z'),
  ('00000000-0000-4000-8000-00000000d002', '00000000-0000-4000-8000-000000000203', 'synthetic_demo', 'syn-rec-002', 'synthetic-demo-fingerprint-002', '2026-09-07T13:00:00Z', 'washer', 'completed', 'self_reported', null, true, '2026-09-07T13:40:00Z', '2026-09-07T13:40:00Z'),
  ('00000000-0000-4000-8000-00000000d003', '00000000-0000-4000-8000-000000000204', 'synthetic_demo', 'syn-rec-003', 'synthetic-demo-fingerprint-003', '2026-09-08T14:00:00Z', 'washer', 'reported', 'self_reported', null, true, '2026-09-08T14:00:00Z', '2026-09-08T14:00:00Z'),
  ('00000000-0000-4000-8000-00000000d004', '00000000-0000-4000-8000-000000000207', 'synthetic_demo', 'syn-rec-004', 'synthetic-demo-fingerprint-004', '2026-09-07T15:00:00Z', 'washer', 'completed', 'user_supplied', null, true, '2026-09-07T15:40:00Z', '2026-09-07T15:40:00Z'),
  ('00000000-0000-4000-8000-00000000d005', '00000000-0000-4000-8000-000000000208', 'synthetic_demo', 'syn-rec-005', 'synthetic-demo-fingerprint-005', '2026-09-08T16:00:00Z', 'washer', 'completed', 'self_reported', null, true, '2026-09-08T16:40:00Z', '2026-09-08T16:40:00Z'),
  ('00000000-0000-4000-8000-00000000d006', '00000000-0000-4000-8000-000000000209', 'synthetic_demo', 'syn-rec-006', 'synthetic-demo-fingerprint-006', '2026-09-09T17:00:00Z', 'washer', 'completed', 'user_supplied', null, true, '2026-09-09T17:40:00Z', '2026-09-09T17:40:00Z'),
  ('00000000-0000-4000-8000-00000000d007', '00000000-0000-4000-8000-000000000213', 'synthetic_demo', 'syn-rec-007', 'synthetic-demo-fingerprint-007', '2026-09-10T18:00:00Z', 'washer', 'completed', 'self_reported', null, true, '2026-09-10T18:40:00Z', '2026-09-10T18:40:00Z'),
  ('00000000-0000-4000-8000-00000000d008', '00000000-0000-4000-8000-000000000214', 'synthetic_demo', 'syn-rec-008', 'synthetic-demo-fingerprint-008', '2026-09-11T19:00:00Z', 'washer', 'completed', 'user_supplied', null, true, '2026-09-11T19:40:00Z', '2026-09-11T19:40:00Z'),
  ('00000000-0000-4000-8000-00000000d009', '00000000-0000-4000-8000-000000000205', 'synthetic_demo', 'syn-rec-009', 'synthetic-demo-fingerprint-009', '2026-08-31T12:00:00Z', 'washer', 'completed', 'self_reported', null, true, '2026-08-31T12:40:00Z', '2026-08-31T12:40:00Z'),
  ('00000000-0000-4000-8000-00000000d010', '00000000-0000-4000-8000-000000000206', 'synthetic_demo', 'syn-rec-010', 'synthetic-demo-fingerprint-010', '2026-08-15T12:00:00Z', 'washer', 'completed', 'self_reported', null, true, '2026-08-15T12:40:00Z', '2026-08-15T12:40:00Z'),
  ('00000000-0000-4000-8000-00000000d011', '00000000-0000-4000-8000-000000000210', 'synthetic_demo', 'syn-rec-011', 'synthetic-demo-fingerprint-011', '2026-09-08T20:00:00Z', 'unknown', 'unknown', 'user_supplied', null, true, '2026-09-08T20:10:00Z', '2026-09-08T20:10:00Z'),
  ('00000000-0000-4000-8000-00000000d012', '00000000-0000-4000-8000-000000000211', 'synthetic_demo', 'syn-rec-012', 'synthetic-demo-fingerprint-012', '2026-09-08T21:00:00Z', 'dryer', 'completed', 'user_supplied', null, true, '2026-09-08T21:40:00Z', '2026-09-08T21:40:00Z'),
  ('00000000-0000-4000-8000-00000000d013', '00000000-0000-4000-8000-000000000212', 'synthetic_demo', 'syn-rec-013', 'synthetic-demo-fingerprint-013', '2026-09-08T22:00:00Z', 'washer', 'failed', 'user_supplied', '00000000-0000-4000-8000-00000000f002', true, '2026-09-08T22:10:00Z', '2026-09-08T22:10:00Z'),
  ('00000000-0000-4000-8000-00000000d014', '00000000-0000-4000-8000-000000000215', 'synthetic_demo', 'syn-rec-014', 'synthetic-demo-fingerprint-014', '2026-09-08T23:00:00Z', 'washer', 'refunded', 'user_supplied', null, true, '2026-09-08T23:10:00Z', '2026-09-08T23:10:00Z'),
  ('00000000-0000-4000-8000-00000000d015', '00000000-0000-4000-8000-000000000216', 'synthetic_demo', 'syn-rec-015', 'synthetic-demo-fingerprint-015', '2026-09-08T10:00:00Z', 'washer', 'started', 'self_reported', null, true, '2026-09-08T10:01:00Z', '2026-09-08T10:01:00Z'),
  ('00000000-0000-4000-8000-00000000d016', '00000000-0000-4000-8000-000000000217', 'synthetic_demo', 'syn-rec-016', 'synthetic-demo-fingerprint-016', '2026-09-06T23:30:00Z', 'washer', 'completed', 'user_supplied', '00000000-0000-4000-8000-00000000f003', true, '2026-09-14T05:01:00Z', '2026-09-14T05:01:00Z'),
  ('00000000-0000-4000-8000-00000000d017', '00000000-0000-4000-8000-000000000218', 'synthetic_demo', 'syn-rec-017', 'synthetic-demo-fingerprint-017', '2026-08-30T12:00:00Z', 'washer', 'completed', 'self_reported', null, true, '2026-08-30T12:40:00Z', '2026-08-30T12:40:00Z')
on conflict (id) do nothing;

-- Replace trigger-generated session UUIDs with stable demo UUIDs before linking/scoring.
update public.laundry_activities
set session_id = null
where id between '00000000-0000-4000-8000-00000000d001' and '00000000-0000-4000-8000-00000000d017';

with deterministic_sessions(activity_id, session_id) as (
  values
    ('00000000-0000-4000-8000-00000000d001'::uuid, '00000000-0000-4000-8000-00000000e001'::uuid),
    ('00000000-0000-4000-8000-00000000d002'::uuid, '00000000-0000-4000-8000-00000000e002'::uuid),
    ('00000000-0000-4000-8000-00000000d003'::uuid, '00000000-0000-4000-8000-00000000e003'::uuid),
    ('00000000-0000-4000-8000-00000000d004'::uuid, '00000000-0000-4000-8000-00000000e004'::uuid),
    ('00000000-0000-4000-8000-00000000d005'::uuid, '00000000-0000-4000-8000-00000000e005'::uuid),
    ('00000000-0000-4000-8000-00000000d006'::uuid, '00000000-0000-4000-8000-00000000e006'::uuid),
    ('00000000-0000-4000-8000-00000000d007'::uuid, '00000000-0000-4000-8000-00000000e007'::uuid),
    ('00000000-0000-4000-8000-00000000d008'::uuid, '00000000-0000-4000-8000-00000000e008'::uuid),
    ('00000000-0000-4000-8000-00000000d009'::uuid, '00000000-0000-4000-8000-00000000e009'::uuid),
    ('00000000-0000-4000-8000-00000000d010'::uuid, '00000000-0000-4000-8000-00000000e010'::uuid),
    ('00000000-0000-4000-8000-00000000d011'::uuid, '00000000-0000-4000-8000-00000000e011'::uuid),
    ('00000000-0000-4000-8000-00000000d012'::uuid, '00000000-0000-4000-8000-00000000e012'::uuid),
    ('00000000-0000-4000-8000-00000000d013'::uuid, '00000000-0000-4000-8000-00000000e013'::uuid),
    ('00000000-0000-4000-8000-00000000d014'::uuid, '00000000-0000-4000-8000-00000000e014'::uuid),
    ('00000000-0000-4000-8000-00000000d015'::uuid, '00000000-0000-4000-8000-00000000e015'::uuid),
    ('00000000-0000-4000-8000-00000000d016'::uuid, '00000000-0000-4000-8000-00000000e016'::uuid),
    ('00000000-0000-4000-8000-00000000d017'::uuid, '00000000-0000-4000-8000-00000000e017'::uuid)
)
update public.laundry_sessions as session
set id = stable.session_id
from deterministic_sessions as stable
where session.canonical_activity_id = stable.activity_id
  and session.id is distinct from stable.session_id;

update public.laundry_activities as activity
set session_id = session.id
from public.laundry_sessions as session
where session.canonical_activity_id = activity.id
  and activity.synthetic_demo
  and activity.session_id is distinct from session.id;

-- case: duplicate-attempt-record (the duplicate is retained as an import fact, not a second activity)
insert into public.activity_import_rows (
  id, import_id, profile_id, row_number, disposition, reason,
  dedupe_fingerprint, issues, activity_id
) values
  ('00000000-0000-4000-8000-00000000f101', '00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-000000000201', 2, 'ready', null, 'synthetic-demo-fingerprint-001', '[]'::jsonb, '00000000-0000-4000-8000-00000000d001'),
  ('00000000-0000-4000-8000-00000000f102', '00000000-0000-4000-8000-00000000f001', '00000000-0000-4000-8000-000000000201', 3, 'duplicate', 'duplicate synthetic attempt', 'synthetic-demo-fingerprint-001', '["duplicate"]'::jsonb, '00000000-0000-4000-8000-00000000d001'),
  ('00000000-0000-4000-8000-00000000f103', '00000000-0000-4000-8000-00000000f002', '00000000-0000-4000-8000-000000000212', 2, 'invalid', 'intentional synthetic failure', null, '["invalid_timestamp"]'::jsonb, null),
  ('00000000-0000-4000-8000-00000000f104', '00000000-0000-4000-8000-00000000f003', '00000000-0000-4000-8000-000000000217', 2, 'ready', 'late synthetic arrival', 'synthetic-demo-fingerprint-016', '["late_arrival"]'::jsonb, '00000000-0000-4000-8000-00000000d016')
on conflict (id) do nothing;

-- case: shared (exactly one accepted co-loader; owner plus member can receive credit)
insert into public.shared_session_members (
  id, session_id, member_profile_id, status, invited_at, responded_at
) values (
  '00000000-0000-4000-8000-00000000e101',
  '00000000-0000-4000-8000-00000000e001',
  '00000000-0000-4000-8000-000000000202',
  'accepted',
  '2026-09-07T11:45:00Z',
  '2026-09-07T11:50:00Z'
)
on conflict (id) do nothing;

-- Current-week award calls. The shared session supplies Maple's first two credits.
select public.award_weekly_credit('00000000-0000-4000-8000-00000000c100', '2026-09-07'::date, '00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-00000000e001');
select public.award_weekly_credit('00000000-0000-4000-8000-00000000c100', '2026-09-07'::date, '00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-00000000e001');
select public.award_weekly_credit('00000000-0000-4000-8000-00000000c100', '2026-09-07'::date, '00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-00000000e002');
select public.award_weekly_credit('00000000-0000-4000-8000-00000000c100', '2026-09-07'::date, '00000000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-00000000e003');
select public.award_weekly_credit('00000000-0000-4000-8000-00000000c100', '2026-09-07'::date, '00000000-0000-4000-8000-000000000207', '00000000-0000-4000-8000-00000000e004');
select public.award_weekly_credit('00000000-0000-4000-8000-00000000c100', '2026-09-07'::date, '00000000-0000-4000-8000-000000000208', '00000000-0000-4000-8000-00000000e005');
select public.award_weekly_credit('00000000-0000-4000-8000-00000000c100', '2026-09-07'::date, '00000000-0000-4000-8000-000000000209', '00000000-0000-4000-8000-00000000e006');
select public.award_weekly_credit('00000000-0000-4000-8000-00000000c100', '2026-09-07'::date, '00000000-0000-4000-8000-000000000213', '00000000-0000-4000-8000-00000000e007');
select public.award_weekly_credit('00000000-0000-4000-8000-00000000c100', '2026-09-07'::date, '00000000-0000-4000-8000-000000000214', '00000000-0000-4000-8000-00000000e008');

-- expected-result: Maple Hall 4/6
-- expected-result: River Hall 3/6
-- expected-result: Oak Hall 2/6

commit;
