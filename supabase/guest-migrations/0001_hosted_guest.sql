-- Standalone hosted guest demo. Paste this entire file into Supabase SQL Editor.
-- Do NOT run the legacy weekly-scoring migrations. Only synthetic guest data.
-- Replay preserves fixture edits, sessions, and events. All changes are atomic.
BEGIN;
SELECT pg_advisory_xact_lock(736209080001);

CREATE TABLE IF NOT EXISTS public.demo_participants (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  hall text NOT NULL,
  days_since_wash integer CHECK (days_since_wash >= 0),
  tracking_state text NOT NULL CHECK (tracking_state IN ('current', 'unknown')),
  visibility text NOT NULL CHECK (visibility IN ('public', 'friends', 'private')),
  reminder_consent boolean NOT NULL DEFAULT false,
  scrub_streak integer NOT NULL DEFAULT 0 CHECK (scrub_streak BETWEEN 0 AND 6),
  last_full_cycle_date date,
  source_label text NOT NULL,
  usual_days text[] NOT NULL DEFAULT '{}',
  usual_time_window text NOT NULL,
  as_of date NOT NULL,
  synthetic boolean NOT NULL DEFAULT true CHECK (synthetic = true),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((tracking_state = 'unknown' AND days_since_wash IS NULL AND last_full_cycle_date IS NULL)
    OR (tracking_state = 'current' AND days_since_wash IS NOT NULL AND last_full_cycle_date IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS public.demo_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  CHECK (expires_at > created_at)
);
CREATE TABLE IF NOT EXISTS public.demo_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.demo_sessions(id) ON DELETE CASCADE,
  recipient_id text NOT NULL REFERENCES public.demo_participants(id),
  preset text NOT NULL CHECK (preset = 'fresh_start'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS demo_nudges_session_time ON public.demo_nudges(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS demo_nudges_recipient_time ON public.demo_nudges(recipient_id, created_at DESC);
CREATE TABLE IF NOT EXISTS public.demo_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.demo_sessions(id) ON DELETE CASCADE,
  preset text NOT NULL CHECK (preset = 'fresh_start'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, preset)
);
ALTER TABLE public.demo_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demo_posts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.demo_participants, public.demo_sessions, public.demo_nudges, public.demo_posts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.demo_participants, public.demo_sessions, public.demo_nudges, public.demo_posts TO service_role;

INSERT INTO public.demo_participants
  (id, display_name, hall, days_since_wash, tracking_state, visibility, reminder_consent,
   scrub_streak, last_full_cycle_date, source_label, usual_days, usual_time_window, as_of, synthetic)
SELECT id, name, hall, days, CASE WHEN days IS NULL THEN 'unknown' ELSE 'current' END,
  visibility, visibility <> 'private' AND days IS NOT NULL, streak,
  DATE '2026-09-08' - days,
  CASE WHEN visibility = 'friends' THEN 'Self-reported demo' ELSE 'Simulated CSC-format demo' END,
  CASE hall WHEN 'Earhart Hall' THEN ARRAY['Tuesday','Saturday'] WHEN 'Harrison Hall' THEN ARRAY['Wednesday','Saturday'] ELSE ARRAY['Tuesday','Sunday'] END,
  CASE WHEN visibility = 'friends' THEN '18:00–20:00' ELSE '17:00–19:00' END,
  DATE '2026-09-08', true
FROM (VALUES
  ('U001','Avery','Earhart Hall',1,'public',3),
  ('U002','Jordan','Earhart Hall',5,'friends',2),
  ('U003','Riley','Earhart Hall',17,'public',0),
  ('U004','Sam','Harrison Hall',2,'public',4),
  ('U005','Casey','Harrison Hall',14,'friends',0),
  ('U006','Morgan','Harrison Hall',NULL,'private',0),
  ('U007','Alex','Shreve Hall',6,'public',1),
  ('U008','Taylor','Shreve Hall',21,'public',0),
  ('U009','Jamie','Shreve Hall',29,'private',0)
) AS fixture(id,name,hall,days,visibility,streak)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.demo_open_session(p_token_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid token hash' USING ERRCODE = '22023';
  END IF;
  -- Bounded guest storage: serialize creation, expire abandoned data, cap active sessions.
  PERFORM pg_advisory_xact_lock(736209080002);
  DELETE FROM public.demo_sessions WHERE expires_at <= clock_timestamp();
  SELECT id INTO v_id FROM public.demo_sessions
    WHERE token_hash = p_token_hash FOR UPDATE;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  IF (SELECT count(*) FROM public.demo_sessions) >= 1000 THEN
    RAISE EXCEPTION 'guest capacity unavailable' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.demo_sessions(token_hash) VALUES (p_token_hash) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.demo_save_nudge(p_token_hash text, p_recipient_id text, p_preset text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_session uuid; v_participant public.demo_participants%ROWTYPE; v_now timestamptz;
BEGIN
  -- Serialize every mutation for this session before inspecting quota or cooldown.
  SELECT id INTO v_session FROM public.demo_sessions WHERE token_hash = p_token_hash FOR UPDATE;
  v_now := clock_timestamp();
  IF v_session IS NULL OR NOT EXISTS (SELECT 1 FROM public.demo_sessions WHERE id = v_session AND expires_at > v_now) THEN
    RETURN jsonb_build_object('ok',false,'code','invalid_session');
  END IF;
  IF p_preset IS DISTINCT FROM 'fresh_start' THEN
    RETURN jsonb_build_object('ok',false,'code','invalid_preset');
  END IF;
  -- Lock current participant state through the insert, including consent/privacy edits.
  SELECT * INTO v_participant FROM public.demo_participants WHERE id = p_recipient_id FOR UPDATE;
  IF NOT FOUND OR NOT v_participant.synthetic OR v_participant.tracking_state <> 'current'
    OR v_participant.visibility = 'private' OR NOT v_participant.reminder_consent
    OR v_participant.days_since_wash IS NULL OR v_participant.days_since_wash < 14 THEN
    RETURN jsonb_build_object('ok',false,'code','ineligible');
  END IF;
  IF EXISTS (SELECT 1 FROM public.demo_nudges WHERE session_id = v_session AND recipient_id = p_recipient_id
    AND created_at > v_now - interval '72 hours') THEN
    RETURN jsonb_build_object('ok',false,'code','cooldown');
  END IF;
  -- Rolling 24-hour day; no midnight reset loophole.
  IF (SELECT count(*) FROM public.demo_nudges WHERE session_id = v_session AND created_at > v_now - interval '24 hours') >= 5 THEN
    RETURN jsonb_build_object('ok',false,'code','daily_limit');
  END IF;
  INSERT INTO public.demo_nudges(session_id,recipient_id,preset,created_at) VALUES (v_session,p_recipient_id,p_preset,v_now);
  RETURN jsonb_build_object('ok',true,'code','saved');
END;
$$;

CREATE OR REPLACE FUNCTION public.demo_save_post(p_token_hash text, p_preset text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_session uuid;
BEGIN
  SELECT id INTO v_session FROM public.demo_sessions WHERE token_hash = p_token_hash FOR UPDATE;
  IF v_session IS NULL OR NOT EXISTS (SELECT 1 FROM public.demo_sessions WHERE id = v_session AND expires_at > clock_timestamp()) THEN
    RETURN jsonb_build_object('ok',false,'code','invalid_session');
  END IF;
  IF p_preset IS DISTINCT FROM 'fresh_start' THEN
    RETURN jsonb_build_object('ok',false,'code','invalid_preset');
  END IF;
  INSERT INTO public.demo_posts(session_id,preset) VALUES (v_session,p_preset) ON CONFLICT (session_id,preset) DO NOTHING;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','already_saved'); END IF;
  RETURN jsonb_build_object('ok',true,'code','saved');
END;
$$;

CREATE OR REPLACE FUNCTION public.demo_reset_session(p_token_hash text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  DELETE FROM public.demo_sessions WHERE token_hash = p_token_hash;
$$;
REVOKE ALL ON FUNCTION public.demo_open_session(text), public.demo_save_nudge(text,text,text), public.demo_save_post(text,text), public.demo_reset_session(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_open_session(text), public.demo_save_nudge(text,text,text), public.demo_save_post(text,text), public.demo_reset_session(text) TO service_role;

-- Deliberately contains no event counts, session identifiers, or participant details.
CREATE OR REPLACE FUNCTION public.demo_schema_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_healthy boolean; v_count integer := 0;
BEGIN
  SELECT count(*) = 4 AND coalesce(bool_and(c.relrowsecurity
    AND NOT has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    AND NOT has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    AND has_table_privilege('service_role',c.oid,'SELECT')
    AND has_table_privilege('service_role',c.oid,'INSERT')
    AND has_table_privilege('service_role',c.oid,'UPDATE')
    AND has_table_privilege('service_role',c.oid,'DELETE')),false)
  INTO v_healthy FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN ('demo_participants','demo_sessions','demo_nudges','demo_posts');
  -- Fail closed on required-column drift, not just table-name presence.
  v_healthy := v_healthy AND NOT EXISTS (
    SELECT 1 FROM (VALUES
      ('demo_participants', ARRAY['id','display_name','hall','days_since_wash','tracking_state','visibility','reminder_consent','scrub_streak','last_full_cycle_date','source_label','usual_days','usual_time_window','as_of','synthetic','updated_at']),
      ('demo_sessions', ARRAY['id','token_hash','created_at','expires_at']),
      ('demo_nudges', ARRAY['id','session_id','recipient_id','preset','created_at']),
      ('demo_posts', ARRAY['id','session_id','preset','created_at'])
    ) expected(table_name, columns)
    CROSS JOIN LATERAL unnest(expected.columns) required(column_name)
    WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns actual
      WHERE actual.table_schema='public' AND actual.table_name=expected.table_name AND actual.column_name=required.column_name)
  );
  IF to_regclass('public.demo_participants') IS NOT NULL THEN
    SELECT count(*) INTO v_count FROM public.demo_participants
    WHERE synthetic AND id IN ('U001','U002','U003','U004','U005','U006','U007','U008','U009');
  END IF;
  RETURN jsonb_build_object('schema_version',1,'tables_healthy',v_healthy,'canonical_synthetic_count',v_count,'ok',v_healthy AND v_count=9);
END;
$$;
REVOKE ALL ON FUNCTION public.demo_schema_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_schema_status() TO anon, authenticated, service_role;

-- Canonical public metadata only; never enrollment or competition identity.
-- Source: Purdue University Residences directory, verified 2026-09-09.
create table if not exists public.purdue_housing_catalog (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  official_name text not null,
  aliases text[] not null default '{}',
  campus text not null check (campus = 'west-lafayette'),
  housing_type text not null check (housing_type = 'residence_hall'),
  active boolean not null,
  term text not null check (term = 'fall-2026'),
  laundry_payment_category text check (laundry_payment_category = 'included_in_rate'),
  verified_at date not null,
  source_url text not null check (source_url like 'https://www.housing.purdue.edu/%')
);
alter table public.purdue_housing_catalog enable row level security;
revoke all on public.purdue_housing_catalog from anon, authenticated;
grant select on public.purdue_housing_catalog to anon, authenticated;
drop policy if exists purdue_housing_public_read on public.purdue_housing_catalog;
create policy purdue_housing_public_read on public.purdue_housing_catalog
  for select to anon, authenticated using (true);

insert into public.purdue_housing_catalog
  (slug, official_name, aliases, campus, housing_type, active, term, laundry_payment_category, verified_at, source_url)
values
  ('cary-quadrangle', 'Cary Quadrangle', array['Cary Quad', 'Cary'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/cary-quad.html'),
  ('earhart-hall', 'Earhart Hall', array['Earhart'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/earhart.html'),
  ('first-street-towers', 'First Street Towers', array['FST', 'First Street'], 'west-lafayette', 'residence_hall', true, 'fall-2026', 'included_in_rate', '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/first-street.html'),
  ('winifred-parker-hall', 'Winifred Parker Hall', array['Winifred Parker', 'Parker South'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/parker-south.html'),
  ('frieda-parker-hall', 'Frieda Parker Hall', array['Frieda Parker', 'Parker North'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/parker-north.html'),
  ('harrison-hall', 'Harrison Hall', array['Harrison'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/harrison.html'),
  ('hawkins-hall', 'Hawkins Hall', array['Hawkins'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/hawkins.html'),
  ('hillenbrand-hall', 'Hillenbrand Hall', array['Hillenbrand'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/hillenbrand.html'),
  ('honors-college-and-residences', 'Honors College and Residences', array['Honors College', 'Honors Residences'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/honors-college.html'),
  ('mccutcheon-hall', 'McCutcheon Hall', array['McCutcheon', 'McCutchen'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/mccutcheon.html'),
  ('meredith-hall', 'Meredith Hall', array['Meredith'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/meredith.html'),
  ('meredith-south', 'Meredith South', array['Meredith South'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/meredith-south.html'),
  ('owen-hall', 'Owen Hall', array['Owen'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/owen.html'),
  ('shreve-hall', 'Shreve Hall', array['Shreve'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/shreve.html'),
  ('south-hall', 'South Hall', array['South'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/south-hall.html'),
  ('tarkington-hall', 'Tarkington Hall', array['Tark', 'Tarkington'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/tarkington.html'),
  ('wiley-hall', 'Wiley Hall', array['Wiley'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/wiley.html'),
  ('windsor-halls', 'Windsor Halls', array['Windsor'], 'west-lafayette', 'residence_hall', true, 'fall-2026', null, '2026-09-09', 'https://www.housing.purdue.edu/my-housing/options/residence-halls/windsor.html')
ON CONFLICT (slug) DO NOTHING;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purdue_housing_catalog TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
