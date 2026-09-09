create table public.laundry_connections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('cscpay', 'csc_go')),
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error')),
  provider_account_ref_hash text,
  connected_at timestamptz,
  disconnected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, provider)
);

create table public.activity_imports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('user_file', 'synthetic_demo')),
  original_file_name text,
  storage_key text,
  storage_visibility text not null default 'private' check (storage_visibility = 'private'),
  cleanup_due_at timestamptz not null default (now() + interval '24 hours'),
  original_deleted_at timestamptz,
  cleanup_required boolean not null default false,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint activity_imports_id_profile_key unique (id, profile_id)
);

create table public.laundry_activities (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('manual', 'user_file', 'synthetic_demo', 'cscpay', 'csc_go')),
  source_record_id_hash text,
  dedupe_fingerprint text not null,
  occurred_at timestamptz not null,
  machine_kind text not null check (machine_kind in ('washer', 'dryer', 'unknown')),
  cycle_status text not null check (cycle_status in ('reported', 'started', 'completed', 'failed', 'refunded', 'unknown')),
  evidence_level text not null check (evidence_level in ('self_reported', 'user_supplied', 'provider_confirmed')),
  provider_location_ref_hash text,
  provider_machine_ref_hash text,
  raw_import_id uuid references public.activity_imports(id) on delete set null,
  synthetic_demo boolean not null default false,
  retracted_at timestamptz,
  retraction_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((retracted_at is null and retraction_reason is null) or (retracted_at is not null and retraction_reason is not null))
);

create unique index laundry_activities_profile_dedupe_fingerprint_key
  on public.laundry_activities (profile_id, dedupe_fingerprint);
create index laundry_activities_profile_occurred_at_idx
  on public.laundry_activities (profile_id, occurred_at desc);

create table public.laundry_sessions (
  id uuid primary key default gen_random_uuid(),
  canonical_activity_id uuid not null unique references public.laundry_activities(id) on delete cascade,
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  qualifying_washer boolean not null,
  score_eligible boolean not null,
  review_state text not null default 'accepted' check (review_state in ('pending', 'accepted', 'rejected')),
  duplicate_of_session_id uuid references public.laundry_sessions(id) on delete restrict,
  retracted_at timestamptz,
  retraction_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint laundry_sessions_time_order check (
    ended_at >= started_at and ended_at <= started_at + interval '120 minutes'
  ),
  constraint laundry_sessions_retraction_state check (
    (retracted_at is null and retraction_reason is null)
    or (retracted_at is not null and retraction_reason is not null)
  ),
  constraint laundry_sessions_not_own_duplicate check (duplicate_of_session_id is distinct from id),
  constraint laundry_sessions_score_state check (
    not score_eligible
    or (
      qualifying_washer
      and review_state = 'accepted'
      and retracted_at is null
      and duplicate_of_session_id is null
    )
  )
);

alter table public.laundry_activities
  add column session_id uuid references public.laundry_sessions(id) on delete set null;

create index laundry_sessions_owner_started_at_idx
  on public.laundry_sessions (owner_profile_id, started_at desc);

create table public.activity_import_rows (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  row_number integer not null check (row_number > 1),
  disposition text not null check (disposition in ('ready', 'duplicate', 'nonqualifying', 'invalid')),
  reason text,
  dedupe_fingerprint text,
  issues jsonb not null default '[]'::jsonb,
  activity_id uuid references public.laundry_activities(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (import_id, row_number),
  constraint activity_import_rows_import_owner_fk
    foreign key (import_id, profile_id)
    references public.activity_imports (id, profile_id) on delete cascade
);

create table public.shared_session_members (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.laundry_sessions(id) on delete cascade,
  member_profile_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'invited'
    check (status in ('pending', 'invited', 'accepted', 'declined', 'retracted')),
  invited_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shared_session_members_unique_member unique (session_id, member_profile_id),
  constraint shared_session_members_response_state check (
    (status in ('pending', 'invited') and responded_at is null)
    or (status in ('accepted', 'declined', 'retracted') and responded_at is not null)
  )
);

-- At most one accepted co-loader plus the session owner can receive credit.
create unique index shared_session_members_one_accepted_per_session
  on public.shared_session_members (session_id)
  where status = 'accepted';

create table public.activity_audit_events (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.laundry_activities(id) on delete cascade,
  actor_profile_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('corrected', 'retracted')),
  reason text not null check (char_length(reason) between 3 and 250),
  before_state jsonb not null,
  after_state jsonb not null,
  created_at timestamptz not null default now()
);

create or replace function public.rebuild_laundry_sessions(p_activity_id uuid)
returns public.laundry_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activity public.laundry_activities%rowtype;
  v_session public.laundry_sessions%rowtype;
  v_qualifying boolean;
begin
  select * into v_activity
  from public.laundry_activities
  where id = p_activity_id;

  if not found then
    raise exception 'activity_not_found' using errcode = 'P0002';
  end if;

  v_qualifying := v_activity.machine_kind = 'washer'
    and v_activity.cycle_status in ('reported', 'completed')
    and v_activity.retracted_at is null;

  insert into public.laundry_sessions (
    canonical_activity_id,
    owner_profile_id,
    started_at,
    ended_at,
    qualifying_washer,
    score_eligible,
    review_state,
    retracted_at,
    retraction_reason
  ) values (
    v_activity.id,
    v_activity.profile_id,
    v_activity.occurred_at,
    v_activity.occurred_at,
    v_qualifying,
    v_qualifying,
    'accepted',
    v_activity.retracted_at,
    v_activity.retraction_reason
  )
  on conflict (canonical_activity_id) do update
  set owner_profile_id = excluded.owner_profile_id,
      started_at = excluded.started_at,
      ended_at = excluded.ended_at,
      qualifying_washer = excluded.qualifying_washer,
      score_eligible = excluded.score_eligible
        and public.laundry_sessions.review_state = 'accepted'
        and public.laundry_sessions.duplicate_of_session_id is null,
      retracted_at = excluded.retracted_at,
      retraction_reason = excluded.retraction_reason,
      updated_at = now()
  returning * into v_session;

  update public.laundry_activities
  set session_id = v_session.id
  where id = v_activity.id and session_id is distinct from v_session.id;

  return v_session;
end;
$$;

create or replace function public.rebuild_laundry_sessions_for_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.rebuild_laundry_sessions(new.id);
  return new;
end;
$$;

create trigger laundry_activities_rebuild_session
after insert or update of profile_id, occurred_at, machine_kind, cycle_status,
  synthetic_demo, retracted_at, retraction_reason
on public.laundry_activities
for each row
when (pg_trigger_depth() = 0)
execute function public.rebuild_laundry_sessions_for_activity();

create or replace function public.validate_shared_session_member()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner_profile_id uuid;
begin
  select owner_profile_id into v_owner_profile_id
  from public.laundry_sessions
  where id = new.session_id;

  if new.member_profile_id = v_owner_profile_id then
    raise exception 'session_owner_cannot_be_member' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
    and (new.session_id is distinct from old.session_id
      or new.member_profile_id is distinct from old.member_profile_id)
  then
    raise exception 'shared_session_member_identity_immutable' using errcode = '23514';
  end if;

  if new.status in ('accepted', 'declined', 'retracted')
    and (tg_op = 'INSERT' or new.status is distinct from old.status)
  then
    new.responded_at := now();
  elsif new.status in ('pending', 'invited') then
    new.responded_at := null;
  end if;

  return new;
end;
$$;

create trigger shared_session_members_validate
before insert or update on public.shared_session_members
for each row execute function public.validate_shared_session_member();

create or replace function public.prevent_activity_audit_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'activity_audit_events_are_append_only' using errcode = '42501';
end;
$$;

create trigger prevent_activity_audit_event_mutation
before update or delete on public.activity_audit_events
for each row execute function public.prevent_activity_audit_event_mutation();

create or replace function public.is_laundry_session_owner(p_session_id uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.laundry_sessions
    where id = p_session_id and owner_profile_id = p_profile_id
  )
$$;

create or replace function public.is_laundry_session_member(p_session_id uuid, p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shared_session_members
    where session_id = p_session_id and member_profile_id = p_profile_id
  )
$$;

alter table public.laundry_connections enable row level security;
alter table public.activity_imports enable row level security;
alter table public.activity_import_rows enable row level security;
alter table public.laundry_activities enable row level security;
alter table public.activity_audit_events enable row level security;
alter table public.laundry_sessions enable row level security;
alter table public.shared_session_members enable row level security;

create policy "participants read own laundry connections"
  on public.laundry_connections for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.auth_user_id = auth.uid() and p.active and p.deleted_at is null));
create policy "participants manage own laundry connections"
  on public.laundry_connections for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.auth_user_id = auth.uid() and p.active and p.deleted_at is null))
  with check (exists (select 1 from public.profiles p where p.id = profile_id and p.auth_user_id = auth.uid() and p.active and p.deleted_at is null));

create policy "participants read own activity imports"
  on public.activity_imports for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.auth_user_id = auth.uid() and p.active and p.deleted_at is null));
create policy "participants create own activity imports"
  on public.activity_imports for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = profile_id and p.auth_user_id = auth.uid() and p.active and p.deleted_at is null));
create policy "participants update own activity imports"
  on public.activity_imports for update to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.auth_user_id = auth.uid() and p.active and p.deleted_at is null))
  with check (exists (select 1 from public.profiles p where p.id = profile_id and p.auth_user_id = auth.uid() and p.active and p.deleted_at is null));

create policy "participants read own activity import rows"
  on public.activity_import_rows for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.auth_user_id = auth.uid() and p.active and p.deleted_at is null));
create policy "participants create own activity import rows"
  on public.activity_import_rows for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = profile_id and p.auth_user_id = auth.uid() and p.active and p.deleted_at is null));

create policy "participants read own laundry activities"
  on public.laundry_activities for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = profile_id and p.auth_user_id = auth.uid() and p.active and p.deleted_at is null));
create policy "participants create own laundry activities"
  on public.laundry_activities for insert to authenticated
  with check (exists (select 1 from public.profiles p where p.id = profile_id and p.auth_user_id = auth.uid() and p.active and p.deleted_at is null));

create policy "owners and members read laundry sessions"
  on public.laundry_sessions for select to authenticated
  using (
    owner_profile_id = (select public.current_profile_id())
    or public.is_laundry_session_member(id, (select public.current_profile_id()))
  );
create policy "owners create laundry sessions"
  on public.laundry_sessions for insert to authenticated
  with check (owner_profile_id = (select public.current_profile_id()));
create policy "owners update laundry sessions"
  on public.laundry_sessions for update to authenticated
  using (owner_profile_id = (select public.current_profile_id()))
  with check (owner_profile_id = (select public.current_profile_id()));

create policy "owners and members read shared session membership"
  on public.shared_session_members for select to authenticated
  using (
    member_profile_id = (select public.current_profile_id())
    or public.is_laundry_session_owner(session_id, (select public.current_profile_id()))
  );
create policy "owners invite shared session members"
  on public.shared_session_members for insert to authenticated
  with check (public.is_laundry_session_owner(session_id, (select public.current_profile_id())));
create policy "owners and members update shared session membership"
  on public.shared_session_members for update to authenticated
  using (
    member_profile_id = (select public.current_profile_id())
    or public.is_laundry_session_owner(session_id, (select public.current_profile_id()))
  )
  with check (
    member_profile_id = (select public.current_profile_id())
    or public.is_laundry_session_owner(session_id, (select public.current_profile_id()))
  );
create policy "owners remove shared session members"
  on public.shared_session_members for delete to authenticated
  using (public.is_laundry_session_owner(session_id, (select public.current_profile_id())));

create policy "participants read own activity audit events"
  on public.activity_audit_events for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = actor_profile_id and p.auth_user_id = auth.uid() and p.active and p.deleted_at is null));

create or replace function public.correct_laundry_activity(
  p_activity_id uuid,
  p_reason text,
  p_occurred_at timestamptz default null,
  p_machine_kind text default null,
  p_cycle_status text default null
) returns public.laundry_activities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.laundry_activities;
  v_after public.laundry_activities;
  v_actor_profile_id uuid;
begin
  select p.id into v_actor_profile_id
  from public.profiles p
  where p.auth_user_id = auth.uid() and p.active and p.deleted_at is null;
  if v_actor_profile_id is null then raise exception 'active_profile_required' using errcode = '42501'; end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 or char_length(trim(p_reason)) > 250 then raise exception 'invalid_reason' using errcode = '22023'; end if;
  if p_occurred_at is null and p_machine_kind is null and p_cycle_status is null then raise exception 'no_correction_supplied' using errcode = '22023'; end if;
  if p_machine_kind is not null and p_machine_kind not in ('washer', 'dryer', 'unknown') then raise exception 'invalid_machine_kind' using errcode = '22023'; end if;
  if p_cycle_status is not null and p_cycle_status not in ('reported', 'started', 'completed', 'failed', 'refunded', 'unknown') then raise exception 'invalid_cycle_status' using errcode = '22023'; end if;

  select * into v_before from public.laundry_activities
  where id = p_activity_id and profile_id = v_actor_profile_id
  for update;
  if not found then raise exception 'activity_not_found' using errcode = 'P0002'; end if;
  if v_before.retracted_at is not null then raise exception 'activity_retracted' using errcode = '22023'; end if;

  update public.laundry_activities
  set occurred_at = coalesce(p_occurred_at, occurred_at),
      machine_kind = coalesce(p_machine_kind, machine_kind),
      cycle_status = coalesce(p_cycle_status, cycle_status),
      updated_at = now()
  where id = p_activity_id
  returning * into v_after;

  insert into public.activity_audit_events(activity_id, actor_profile_id, action, reason, before_state, after_state)
  values (p_activity_id, v_actor_profile_id, 'corrected', trim(p_reason), to_jsonb(v_before), to_jsonb(v_after));
  return v_after;
end;
$$;

create or replace function public.retract_laundry_activity(
  p_activity_id uuid,
  p_reason text
) returns public.laundry_activities
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_before public.laundry_activities;
  v_after public.laundry_activities;
  v_actor_profile_id uuid;
begin
  select p.id into v_actor_profile_id
  from public.profiles p
  where p.auth_user_id = auth.uid() and p.active and p.deleted_at is null;
  if v_actor_profile_id is null then raise exception 'active_profile_required' using errcode = '42501'; end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 or char_length(trim(p_reason)) > 250 then raise exception 'invalid_reason' using errcode = '22023'; end if;

  select * into v_before from public.laundry_activities
  where id = p_activity_id and profile_id = v_actor_profile_id
  for update;
  if not found then raise exception 'activity_not_found' using errcode = 'P0002'; end if;
  if v_before.retracted_at is not null then raise exception 'activity_already_retracted' using errcode = '22023'; end if;

  update public.laundry_activities
  set retracted_at = now(), retraction_reason = trim(p_reason), updated_at = now()
  where id = p_activity_id
  returning * into v_after;

  insert into public.activity_audit_events(activity_id, actor_profile_id, action, reason, before_state, after_state)
  values (p_activity_id, v_actor_profile_id, 'retracted', trim(p_reason), to_jsonb(v_before), to_jsonb(v_after));
  return v_after;
end;
$$;

revoke all on function public.correct_laundry_activity(uuid, text, timestamptz, text, text) from public;
revoke all on function public.retract_laundry_activity(uuid, text) from public;
revoke all on function public.rebuild_laundry_sessions(uuid) from public, anon, authenticated;
revoke all on function public.rebuild_laundry_sessions_for_activity() from public, anon, authenticated;
revoke all on function public.validate_shared_session_member() from public, anon, authenticated;
revoke all on function public.prevent_activity_audit_event_mutation() from public, anon, authenticated;
revoke all on function public.is_laundry_session_owner(uuid, uuid) from public, anon;
revoke all on function public.is_laundry_session_member(uuid, uuid) from public, anon;
grant execute on function public.correct_laundry_activity(uuid, text, timestamptz, text, text) to authenticated;
grant execute on function public.retract_laundry_activity(uuid, text) to authenticated;
grant execute on function public.is_laundry_session_owner(uuid, uuid) to authenticated;
grant execute on function public.is_laundry_session_member(uuid, uuid) to authenticated;
revoke update, delete on public.laundry_activities from authenticated;
