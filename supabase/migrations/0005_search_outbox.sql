-- B5 private Typesense projection outbox and authorization-safe search RPCs.
-- PostgreSQL remains authoritative; this table is service-role only.

create sequence public.search_projection_version_seq as bigint;

create table public.search_outbox (
  entity_type text not null check (entity_type in ('participant', 'hall_result')),
  entity_id text not null,
  operation text not null check (operation in ('upsert', 'delete')),
  projection_version bigint not null,
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id)
);

create index search_outbox_claim_idx
  on public.search_outbox (available_at, projection_version)
  where locked_at is null;

alter table public.search_outbox enable row level security;
revoke all on public.search_outbox from anon, authenticated;
revoke all on sequence public.search_projection_version_seq from anon, authenticated;

alter table public.profiles
  add column search_projection_version bigint not null
  default nextval('public.search_projection_version_seq'::regclass);

alter table public.hall_week_results
  add column search_projection_version bigint not null
  default nextval('public.search_projection_version_seq'::regclass);

create or replace function public.put_search_outbox(
  p_entity_type text,
  p_entity_id text,
  p_operation text,
  p_projection_version bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_entity_type not in ('participant', 'hall_result')
    or p_operation not in ('upsert', 'delete')
    or p_entity_id is null
    or p_projection_version is null
  then
    raise exception 'invalid search outbox event' using errcode = '22023';
  end if;

  insert into public.search_outbox (
    entity_type,
    entity_id,
    operation,
    projection_version
  ) values (
    p_entity_type,
    p_entity_id,
    p_operation,
    p_projection_version
  )
  on conflict (entity_type, entity_id) do update
  set operation = excluded.operation,
      projection_version = excluded.projection_version,
      attempts = 0,
      available_at = now(),
      locked_at = null,
      last_error = null,
      updated_at = now()
  where excluded.projection_version > search_outbox.projection_version
     or (
       excluded.projection_version = search_outbox.projection_version
       and excluded.operation = 'delete'
       and search_outbox.operation <> 'delete'
     );
end;
$$;

create or replace function public.bump_profile_search_projection_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.search_projection_version = old.search_projection_version then
    new.search_projection_version := nextval('public.search_projection_version_seq'::regclass);
  end if;
  return new;
end;
$$;

create trigger profiles_bump_search_projection_version
before update of
  display_name,
  active,
  visibility,
  directory_opt_in,
  activity_import_opt_in,
  encouragement_scope,
  reminder_enabled,
  reminder_days,
  tracking_started_at,
  paused_until,
  deleted_at,
  search_projection_version
on public.profiles
for each row execute function public.bump_profile_search_projection_version();

create or replace function public.enqueue_profile_search_projection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_operation text;
  v_version bigint;
begin
  if tg_op = 'DELETE' then
    v_profile := old;
    v_operation := 'delete';
    v_version := nextval('public.search_projection_version_seq'::regclass);
  else
    v_profile := new;
    v_version := new.search_projection_version;
    v_operation := case
      when new.active
       and new.deleted_at is null
       and new.directory_opt_in
      then 'upsert'
      else 'delete'
    end;
  end if;

  perform public.put_search_outbox(
    'participant',
    v_profile.id::text,
    v_operation,
    v_version
  );
  return coalesce(new, old);
end;
$$;

create trigger profiles_enqueue_search_projection
after insert or delete or update of
  display_name,
  active,
  visibility,
  directory_opt_in,
  activity_import_opt_in,
  encouragement_scope,
  reminder_enabled,
  reminder_days,
  tracking_started_at,
  paused_until,
  deleted_at,
  search_projection_version
on public.profiles
for each row execute function public.enqueue_profile_search_projection();

-- Activity mutations change only the participant's coarse search projection.
create or replace function public.bump_activity_owner_search_projection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile_id uuid := case when tg_op = 'DELETE' then old.profile_id else new.profile_id end;
begin
  update public.profiles
  set search_projection_version = nextval('public.search_projection_version_seq'::regclass)
  where id = v_profile_id;
  return coalesce(new, old);
end;
$$;

create trigger laundry_activities_bump_search_projection
after insert or update or delete on public.laundry_activities
for each row execute function public.bump_activity_owner_search_projection();

create or replace function public.bump_hall_result_search_projection_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.search_projection_version = old.search_projection_version then
    new.search_projection_version := nextval('public.search_projection_version_seq'::regclass);
  end if;
  return new;
end;
$$;

create trigger hall_results_bump_search_projection_version
before update on public.hall_week_results
for each row execute function public.bump_hall_result_search_projection_version();

create or replace function public.enqueue_hall_result_search_projection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result public.hall_week_results%rowtype;
  v_entity_id text;
  v_operation text;
  v_version bigint;
begin
  if tg_op = 'DELETE' then
    v_result := old;
    v_operation := 'delete';
    v_version := nextval('public.search_projection_version_seq'::regclass);
  else
    v_result := new;
    v_operation := case
      when new.publishable and new.rank is not null then 'upsert'
      else 'delete'
    end;
    v_version := new.search_projection_version;
  end if;

  v_entity_id := v_result.competition_id::text
    || ':' || v_result.week_starts_on::text
    || ':' || v_result.hall_id::text;

  perform public.put_search_outbox(
    'hall_result',
    v_entity_id,
    v_operation,
    v_version
  );
  return coalesce(new, old);
end;
$$;

create trigger hall_results_enqueue_search_projection
after insert or update or delete on public.hall_week_results
for each row execute function public.enqueue_hall_result_search_projection();

-- Seed pre-migration rows through the same privacy predicates used by triggers.
insert into public.search_outbox (
  entity_type,
  entity_id,
  operation,
  projection_version
)
select
  'participant',
  p.id::text,
  case
    when p.active and p.deleted_at is null and p.directory_opt_in then 'upsert'
    else 'delete'
  end,
  p.search_projection_version
from public.profiles p
on conflict (entity_type, entity_id) do nothing;

insert into public.search_outbox (
  entity_type,
  entity_id,
  operation,
  projection_version
)
select
  'hall_result',
  r.competition_id::text || ':' || r.week_starts_on::text || ':' || r.hall_id::text,
  case when r.publishable and r.rank is not null then 'upsert' else 'delete' end,
  r.search_projection_version
from public.hall_week_results r
on conflict (entity_type, entity_id) do nothing;

-- Atomically claim jobs. A crashed worker's lease expires after five minutes.
create or replace function public.claim_search_outbox(p_limit integer default 100)
returns table (
  entity_type text,
  entity_id text,
  operation text,
  projection_version bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit not between 1 and 1000 then
    raise exception 'invalid search outbox claim limit' using errcode = '22023';
  end if;

  return query
  with claimed as (
    select o.entity_type, o.entity_id
    from public.search_outbox o
    where o.available_at <= now()
      and (o.locked_at is null or o.locked_at < now() - interval '5 minutes')
    order by o.projection_version, o.entity_type, o.entity_id
    for update skip locked
    limit p_limit
  )
  update public.search_outbox o
  set locked_at = now(),
      attempts = o.attempts + 1,
      updated_at = now()
  from claimed c
  where o.entity_type = c.entity_type
    and o.entity_id = c.entity_id
  returning o.entity_type, o.entity_id, o.operation, o.projection_version;
end;
$$;

create or replace function public.complete_search_outbox(
  p_entity_type text,
  p_entity_id text,
  p_projection_version bigint
)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.search_outbox o
  where o.entity_type = p_entity_type
    and o.entity_id = p_entity_id
    and o.projection_version = p_projection_version
$$;

create or replace function public.fail_search_outbox(
  p_entity_type text,
  p_entity_id text,
  p_projection_version bigint,
  p_error text
)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.search_outbox o
  set locked_at = null,
      available_at = now() + make_interval(secs => least(300, greatest(2, power(2, least(o.attempts, 8))::integer))),
      last_error = left(coalesce(p_error, 'unknown indexing error'), 500),
      updated_at = now()
  where o.entity_type = p_entity_type
    and o.entity_id = p_entity_id
    and o.projection_version = p_projection_version
$$;

-- Load only a current, minimized document. Missing or withdrawn rows return NULL,
-- which the worker must interpret as a delete and never as a stale upsert.
create or replace function public.load_search_projection(
  p_entity_type text,
  p_entity_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_projection jsonb;
begin
  if p_entity_type = 'participant' then
    select case
      when not (p.active and p.deleted_at is null and p.directory_opt_in) then
        jsonb_build_object(
          'operation', 'delete',
          'projection_version', p.search_projection_version
        )
      else
        jsonb_build_object(
          'operation', 'upsert',
          'projection_version', p.search_projection_version,
          'document', jsonb_strip_nulls(jsonb_build_object(
            'id', p.id::text,
            'display_name', p.display_name,
            'tracking_state', case
              when p.activity_import_opt_in
               and p.tracking_started_at is not null
               and (p.paused_until is null or p.paused_until <= now())
              then 'current'
              else 'unknown'
            end,
            'activity_anchor_day', case when activity.anchor_at is null then null
              else floor(extract(epoch from activity.anchor_at) / 86400)::bigint * 86400 end,
            'reminder_due_day', case when activity.anchor_at is null or not p.reminder_enabled then null
              else floor(extract(epoch from activity.anchor_at + make_interval(days => p.reminder_days)) / 86400)::bigint * 86400 end,
            'data_fresh_through_day', case when activity.fresh_at is null then null
              else floor(extract(epoch from activity.fresh_at) / 86400)::bigint * 86400 end,
            'projection_version', p.search_projection_version
          ))
        )
      end
    into v_projection
    from public.profiles p
    left join lateral (
      select
        greatest(
          p.tracking_started_at,
          max(a.occurred_at) filter (
            where a.machine_kind = 'washer'
              and a.cycle_status in ('reported', 'completed')
              and a.retracted_at is null
          )
        ) as anchor_at,
        max(a.updated_at) as fresh_at
      from public.laundry_activities a
      where a.profile_id = p.id
    ) activity on true
    where p.id::text = p_entity_id;
  elsif p_entity_type = 'hall_result' then
    select case
      when not (r.publishable and r.rank is not null) then
        jsonb_build_object(
          'operation', 'delete',
          'projection_version', r.search_projection_version
        )
      else
        jsonb_build_object(
          'operation', 'upsert',
          'projection_version', r.search_projection_version,
          'document', jsonb_build_object(
            'id', r.competition_id::text || ':' || r.week_starts_on::text || ':' || r.hall_id::text,
            'competition_id', r.competition_id::text,
            'week_start_day', extract(epoch from (r.week_starts_on::timestamp at time zone 'UTC'))::bigint,
            'hall_id', r.hall_id::text,
            'hall_name', h.name,
            'eligible_count', r.eligible_count,
            'credited_count', r.credited_count,
            'participation_rate', r.score::double precision,
            'rank', r.rank,
            'minimum_met', r.publishable,
            'is_public', r.publishable,
            'projection_version', r.search_projection_version
          )
        )
      end
    into v_projection
    from public.hall_week_results r
    join public.residence_halls h on h.id = r.hall_id and h.active
    where r.competition_id::text || ':' || r.week_starts_on::text || ':' || r.hall_id::text = p_entity_id;
  else
    raise exception 'invalid search entity type' using errcode = '22023';
  end if;

  return v_projection;
end;
$$;

-- Current authorization is evaluated once before Typesense and again during
-- rehydration. Blocks in either direction always win.
create or replace function public.search_authorized_participant_ids(p_preset text)
returns table (entity_id text)
language sql
stable
security definer
set search_path = ''
as $$
  with viewer as (
    select p.id, p.hall_id
    from public.profiles p
    where p.id = public.current_profile_id()
  )
  select target.id::text
  from viewer v
  join public.profiles target
    on target.active and target.deleted_at is null
  where p_preset in ('display_name', 'accepted_friend_cutoff', 'chosen_reminder')
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = v.id and b.blocked_id = target.id)
         or (b.blocker_id = target.id and b.blocked_id = v.id)
    )
    and (
      (
        p_preset = 'display_name'
        and target.directory_opt_in
        and (
          target.id = v.id
          or (target.visibility = 'public' and target.public_stats_opt_in)
          or (
            target.visibility = 'friends'
            and exists (
              select 1 from public.friendships f
              where f.status = 'accepted'
                and ((f.requester_id = v.id and f.addressee_id = target.id)
                  or (f.addressee_id = v.id and f.requester_id = target.id))
            )
          )
        )
      )
      or (
        p_preset = 'accepted_friend_cutoff'
        and target.id <> v.id
        and target.directory_opt_in
        and target.reminder_enabled
        and target.encouragement_scope = 'friends'
        and target.activity_import_opt_in
        and target.tracking_started_at is not null
        and (target.paused_until is null or target.paused_until <= now())
        and exists (
          select 1 from public.friendships f
          where f.status = 'accepted'
            and ((f.requester_id = v.id and f.addressee_id = target.id)
              or (f.addressee_id = v.id and f.requester_id = target.id))
        )
      )
      or (
        p_preset = 'chosen_reminder'
        and target.id <> v.id
        and target.hall_id = v.hall_id
        and target.directory_opt_in
        and target.reminder_enabled
        and target.encouragement_scope = 'hall'
        and target.activity_import_opt_in
        and target.tracking_started_at is not null
        and (target.paused_until is null or target.paused_until <= now())
      )
    )
$$;

create or replace function public.search_rehydrate_participants(
  p_ids text[],
  p_preset text
)
returns table (
  id text,
  display_name text,
  projection_version bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id::text, p.display_name, p.search_projection_version
  from public.profiles p
  where p.id::text = any(p_ids)
    and p.id::text in (
      select authorized.entity_id
      from public.search_authorized_participant_ids(p_preset) authorized
    )
$$;

create or replace function public.search_authorized_hall_result_ids(
  p_competition_id text,
  p_week_start_day bigint
)
returns table (entity_id text)
language sql
stable
security definer
set search_path = ''
as $$
  select r.competition_id::text || ':' || r.week_starts_on::text || ':' || r.hall_id::text
  from public.hall_week_results r
  join public.residence_halls h on h.id = r.hall_id and h.active
  where r.competition_id::text = p_competition_id
    and extract(epoch from (r.week_starts_on::timestamp at time zone 'UTC'))::bigint = p_week_start_day
    and r.publishable
    and r.rank is not null
$$;

create or replace function public.search_rehydrate_hall_results(
  p_ids text[],
  p_competition_id text,
  p_week_start_day bigint
)
returns table (
  id text,
  competition_id text,
  week_start_day bigint,
  hall_id text,
  hall_name text,
  eligible_count integer,
  credited_count integer,
  participation_rate double precision,
  rank integer,
  minimum_met boolean,
  is_public boolean,
  projection_version bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    r.competition_id::text || ':' || r.week_starts_on::text || ':' || r.hall_id::text,
    r.competition_id::text,
    extract(epoch from (r.week_starts_on::timestamp at time zone 'UTC'))::bigint,
    r.hall_id::text,
    h.name,
    r.eligible_count,
    r.credited_count,
    r.score::double precision,
    r.rank,
    true,
    true,
    r.search_projection_version
  from public.hall_week_results r
  join public.residence_halls h on h.id = r.hall_id and h.active
  where r.competition_id::text || ':' || r.week_starts_on::text || ':' || r.hall_id::text = any(p_ids)
    and r.competition_id::text = p_competition_id
    and extract(epoch from (r.week_starts_on::timestamp at time zone 'UTC'))::bigint = p_week_start_day
    and r.publishable
    and r.rank is not null
$$;

revoke all on function public.put_search_outbox(text, text, text, bigint) from public, anon, authenticated;
revoke all on function public.bump_profile_search_projection_version() from public, anon, authenticated;
revoke all on function public.enqueue_profile_search_projection() from public, anon, authenticated;
revoke all on function public.bump_activity_owner_search_projection() from public, anon, authenticated;
revoke all on function public.bump_hall_result_search_projection_version() from public, anon, authenticated;
revoke all on function public.enqueue_hall_result_search_projection() from public, anon, authenticated;
revoke all on function public.claim_search_outbox(integer) from public, anon, authenticated;
revoke all on function public.complete_search_outbox(text, text, bigint) from public, anon, authenticated;
revoke all on function public.fail_search_outbox(text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.load_search_projection(text, text) from public, anon, authenticated;

grant execute on function public.claim_search_outbox(integer) to service_role;
grant execute on function public.complete_search_outbox(text, text, bigint) to service_role;
grant execute on function public.fail_search_outbox(text, text, bigint, text) to service_role;
grant execute on function public.load_search_projection(text, text) to service_role;

revoke all on function public.search_authorized_participant_ids(text) from public, anon;
revoke all on function public.search_rehydrate_participants(text[], text) from public, anon;
revoke all on function public.search_authorized_hall_result_ids(text, bigint) from public, anon;
revoke all on function public.search_rehydrate_hall_results(text[], text, bigint) from public, anon;
grant execute on function public.search_authorized_participant_ids(text) to authenticated;
grant execute on function public.search_rehydrate_participants(text[], text) to authenticated;
grant execute on function public.search_authorized_hall_result_ids(text, bigint) to authenticated;
grant execute on function public.search_rehydrate_hall_results(text[], text, bigint) to authenticated;
