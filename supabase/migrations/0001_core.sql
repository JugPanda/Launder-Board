-- B2 core identity, profile, hall enrollment, and consent schema.
-- Participant writes are intentionally routed through narrow RPCs so consent
-- audit events and invite accounting cannot be bypassed by direct Data API calls.

create extension if not exists pgcrypto with schema extensions;

create type public.profile_visibility as enum ('private', 'friends', 'public');
create type public.encouragement_scope as enum ('off', 'friends', 'hall');
create type public.consent_type as enum (
  'account_participation',
  'activity_import',
  'directory_discovery',
  'reminders',
  'public_stats',
  'public_hall'
);
create type public.consent_action as enum ('granted', 'withdrawn');

create table public.residence_halls (
  id uuid primary key default gen_random_uuid(),
  campus_id text not null,
  name text not null,
  slug text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint residence_halls_campus_name_unique unique (campus_id, name),
  constraint residence_halls_campus_slug_unique unique (campus_id, slug),
  constraint residence_halls_name_valid check (
    name = btrim(name) and char_length(name) between 2 and 80
  ),
  constraint residence_halls_slug_valid check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table public.hall_invites (
  id uuid primary key default gen_random_uuid(),
  hall_id uuid not null references public.residence_halls(id) on delete cascade,
  code_hash bytea not null unique,
  label text,
  expires_at timestamptz,
  use_limit integer not null default 1,
  uses_count integer not null default 0,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hall_invites_use_limit_positive check (use_limit > 0),
  constraint hall_invites_uses_valid check (uses_count between 0 and use_limit),
  constraint hall_invites_label_valid check (
    label is null or (label = btrim(label) and char_length(label) between 1 and 80)
  )
);

create index hall_invites_available_idx
  on public.hall_invites (hall_id, expires_at)
  where active and uses_count < use_limit;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  public_slug text unique,
  hall_id uuid not null references public.residence_halls(id) on delete restrict,
  active boolean not null default true,
  visibility public.profile_visibility not null default 'private',
  directory_opt_in boolean not null default false,
  activity_import_opt_in boolean not null default false,
  public_stats_opt_in boolean not null default false,
  public_hall_opt_in boolean not null default false,
  encouragement_scope public.encouragement_scope not null default 'off',
  reminder_enabled boolean not null default false,
  reminder_days smallint not null default 14,
  tracking_started_at timestamptz,
  paused_until timestamptz,
  onboarding_completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint profiles_display_name_valid check (
    display_name = btrim(display_name)
    and char_length(display_name) between 2 and 40
    and display_name !~ '[<>[:cntrl:]]'
  ),
  constraint profiles_public_slug_valid check (
    public_slug is null or public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint profiles_reminder_days_valid check (reminder_days in (7, 14, 21)),
  constraint profiles_deleted_inactive check (deleted_at is null or not active)
);

create index profiles_hall_active_idx
  on public.profiles (hall_id, id)
  where active and deleted_at is null;
create index profiles_directory_idx
  on public.profiles (visibility, id)
  where active and deleted_at is null and directory_opt_in;
create unique index profiles_public_slug_active_unique
  on public.profiles (public_slug)
  where public_slug is not null and deleted_at is null;

create table public.consent_events (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  consent_type public.consent_type not null,
  action public.consent_action not null,
  policy_version text not null,
  occurred_at timestamptz not null default now(),
  actor_auth_user_id uuid references auth.users(id) on delete set null,
  constraint consent_events_policy_version_valid check (
    policy_version = btrim(policy_version) and char_length(policy_version) between 1 and 40
  )
);

create index consent_events_profile_timeline_idx
  on public.consent_events (profile_id, occurred_at desc, id desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger residence_halls_set_updated_at
before update on public.residence_halls
for each row execute function public.set_updated_at();

create trigger hall_invites_set_updated_at
before update on public.hall_invites
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.profiles as p
  where p.auth_user_id = (select auth.uid())
    and p.active
    and p.deleted_at is null
    and p.onboarding_completed_at is not null
$$;

create or replace function public.complete_onboarding(
  p_display_name text,
  p_hall_invite_code text,
  p_visibility public.profile_visibility default 'private',
  p_directory_opt_in boolean default false,
  p_activity_import_opt_in boolean default false,
  p_public_stats_opt_in boolean default false,
  p_public_hall_opt_in boolean default false,
  p_encouragement_scope public.encouragement_scope default 'off',
  p_reminder_enabled boolean default false,
  p_reminder_days smallint default 14,
  p_policy_version text default '2026-09-08'
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_invite public.hall_invites%rowtype;
  v_profile public.profiles%rowtype;
  v_normalized_code text := upper(btrim(p_hall_invite_code));
begin
  if v_auth_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if exists (
    select 1 from public.profiles where auth_user_id = v_auth_user_id
  ) then
    raise exception using errcode = '23505', message = 'Profile already exists';
  end if;

  if p_display_name is null
    or p_display_name <> btrim(p_display_name)
    or char_length(p_display_name) not between 2 and 40
    or p_display_name ~ '[<>[:cntrl:]]'
  then
    raise exception using errcode = '22023', message = 'Invalid display name';
  end if;

  if v_normalized_code !~ '^[A-Z0-9][A-Z0-9-]{5,31}$' then
    raise exception using errcode = '22023', message = 'Invalid or unavailable hall invite';
  end if;

  if p_reminder_days not in (7, 14, 21) then
    raise exception using errcode = '22023', message = 'Invalid reminder interval';
  end if;

  select hi.*
  into v_invite
  from public.hall_invites as hi
  join public.residence_halls as rh on rh.id = hi.hall_id
  where hi.code_hash = extensions.digest(convert_to(v_normalized_code, 'UTF8'), 'sha256')
    and hi.active
    and rh.active
    and hi.uses_count < hi.use_limit
    and (hi.expires_at is null or hi.expires_at > now())
  for update of hi;

  if not found then
    raise exception using errcode = '22023', message = 'Invalid or unavailable hall invite';
  end if;

  update public.hall_invites
  set uses_count = uses_count + 1,
      active = case when uses_count + 1 >= use_limit then false else active end
  where id = v_invite.id;

  insert into public.profiles (
    auth_user_id,
    display_name,
    hall_id,
    visibility,
    directory_opt_in,
    activity_import_opt_in,
    public_stats_opt_in,
    public_hall_opt_in,
    encouragement_scope,
    reminder_enabled,
    reminder_days
  )
  values (
    v_auth_user_id,
    p_display_name,
    v_invite.hall_id,
    p_visibility,
    p_directory_opt_in,
    p_activity_import_opt_in,
    p_public_stats_opt_in,
    p_public_hall_opt_in,
    p_encouragement_scope,
    p_reminder_enabled,
    p_reminder_days
  )
  returning * into v_profile;

  insert into public.consent_events (
    profile_id,
    consent_type,
    action,
    policy_version,
    actor_auth_user_id
  )
  select
    v_profile.id,
    event.consent_type,
    event.action,
    p_policy_version,
    v_auth_user_id
  from (
    values
      ('account_participation'::public.consent_type, 'granted'::public.consent_action),
      ('activity_import'::public.consent_type, case when p_activity_import_opt_in then 'granted' else 'withdrawn' end::public.consent_action),
      ('directory_discovery'::public.consent_type, case when p_directory_opt_in then 'granted' else 'withdrawn' end::public.consent_action),
      ('reminders'::public.consent_type, case when p_reminder_enabled then 'granted' else 'withdrawn' end::public.consent_action),
      ('public_stats'::public.consent_type, case when p_public_stats_opt_in then 'granted' else 'withdrawn' end::public.consent_action),
      ('public_hall'::public.consent_type, case when p_public_hall_opt_in then 'granted' else 'withdrawn' end::public.consent_action)
  ) as event(consent_type, action);

  return v_profile;
end;
$$;

create or replace function public.update_profile_consent(
  p_visibility public.profile_visibility,
  p_directory_opt_in boolean,
  p_activity_import_opt_in boolean,
  p_public_stats_opt_in boolean,
  p_public_hall_opt_in boolean,
  p_encouragement_scope public.encouragement_scope,
  p_reminder_enabled boolean,
  p_reminder_days smallint,
  p_policy_version text default '2026-09-08'
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_auth_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if p_reminder_days not in (7, 14, 21) then
    raise exception using errcode = '22023', message = 'Invalid reminder interval';
  end if;

  update public.profiles
  set visibility = p_visibility,
      directory_opt_in = p_directory_opt_in,
      activity_import_opt_in = p_activity_import_opt_in,
      public_stats_opt_in = p_public_stats_opt_in,
      public_hall_opt_in = p_public_hall_opt_in,
      encouragement_scope = p_encouragement_scope,
      reminder_enabled = p_reminder_enabled,
      reminder_days = p_reminder_days
  where auth_user_id = v_auth_user_id
    and active
    and deleted_at is null
  returning * into v_profile;

  if not found then
    raise exception using errcode = 'P0002', message = 'Active profile not found';
  end if;

  insert into public.consent_events (
    profile_id,
    consent_type,
    action,
    policy_version,
    actor_auth_user_id
  )
  select
    v_profile.id,
    event.consent_type,
    event.action,
    p_policy_version,
    v_auth_user_id
  from (
    values
      ('activity_import'::public.consent_type, case when p_activity_import_opt_in then 'granted' else 'withdrawn' end::public.consent_action),
      ('directory_discovery'::public.consent_type, case when p_directory_opt_in then 'granted' else 'withdrawn' end::public.consent_action),
      ('reminders'::public.consent_type, case when p_reminder_enabled then 'granted' else 'withdrawn' end::public.consent_action),
      ('public_stats'::public.consent_type, case when p_public_stats_opt_in then 'granted' else 'withdrawn' end::public.consent_action),
      ('public_hall'::public.consent_type, case when p_public_hall_opt_in then 'granted' else 'withdrawn' end::public.consent_action)
  ) as event(consent_type, action);

  return v_profile;
end;
$$;

alter table public.residence_halls enable row level security;
alter table public.hall_invites enable row level security;
alter table public.profiles enable row level security;
alter table public.consent_events enable row level security;

create policy "active halls are visible to authenticated users"
on public.residence_halls
for select
to authenticated
using (active);

create policy "participants read only their own full profile"
on public.profiles
for select
to authenticated
using (auth_user_id = (select auth.uid()));

create policy "participants read only their own consent history"
on public.consent_events
for select
to authenticated
using (profile_id = (select public.current_profile_id()));

revoke all on table public.residence_halls from anon, authenticated;
revoke all on table public.hall_invites from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.consent_events from anon, authenticated;
grant select on table public.residence_halls to authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.consent_events to authenticated;

grant usage on type public.profile_visibility to authenticated;
grant usage on type public.encouragement_scope to authenticated;
grant usage on type public.consent_type to authenticated;
grant usage on type public.consent_action to authenticated;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.current_profile_id() from public, anon;
grant execute on function public.current_profile_id() to authenticated;
revoke all on function public.complete_onboarding(text, text, public.profile_visibility, boolean, boolean, boolean, boolean, public.encouragement_scope, boolean, smallint, text) from public, anon;
grant execute on function public.complete_onboarding(text, text, public.profile_visibility, boolean, boolean, boolean, boolean, public.encouragement_scope, boolean, smallint, text) to authenticated;
revoke all on function public.update_profile_consent(public.profile_visibility, boolean, boolean, boolean, boolean, public.encouragement_scope, boolean, smallint, text) from public, anon;
grant execute on function public.update_profile_consent(public.profile_visibility, boolean, boolean, boolean, boolean, public.encouragement_scope, boolean, smallint, text) to authenticated;
