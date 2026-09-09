-- B7 authenticated enrollment and atomic account cleanup commands.
-- Enrollment delegates immutable roster creation to the B4 snapshot function;
-- account deletion leaves durable cleanup work for the service-role worker.

create table public.account_cleanup_outbox (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  auth_user_id uuid not null unique,
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index account_cleanup_outbox_claim_idx
  on public.account_cleanup_outbox (available_at, created_at)
  where locked_at is null;

alter table public.account_cleanup_outbox enable row level security;

create or replace function public.enroll_in_competition(
  p_competition_id uuid
)
returns public.competition_enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_week public.competition_weeks%rowtype;
  v_enrollment public.competition_enrollments%rowtype;
begin
  if v_auth_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select p.*
    into v_profile
    from public.profiles as p
   where p.auth_user_id = v_auth_user_id
     and p.active
     and p.deleted_at is null
     and p.onboarding_completed_at is not null
   for update;

  if not found then
    raise exception 'active_profile_required' using errcode = '42501';
  end if;

  select w.*
    into v_week
    from public.competition_weeks as w
    join public.competitions as c on c.id = w.competition_id
   where w.competition_id = p_competition_id
     and not w.paused
     and not c.paused
     and w.starts_at >= now()
     and w.week_starts_on >= c.starts_on
     and (c.ends_on is null or w.week_starts_on <= c.ends_on)
   order by w.starts_at
   limit 1
   for share of w;

  if not found then
    raise exception 'competition_not_enrollable' using errcode = 'P0002';
  end if;

  select *
    into v_enrollment
    from public.snapshot_competition_enrollment(
      p_competition_id,
      v_week.week_starts_on,
      v_profile.id
    );

  return v_enrollment;
end;
$$;

create or replace function public.delete_current_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_auth_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select p.*
    into v_profile
    from public.profiles as p
   where p.auth_user_id = v_auth_user_id
   for update;

  if not found then
    raise exception 'profile_not_found' using errcode = 'P0002';
  end if;

  update public.profiles
     set active = false,
         deleted_at = coalesce(deleted_at, now()),
         visibility = 'private',
         directory_opt_in = false,
         activity_import_opt_in = false,
         public_stats_opt_in = false,
         public_hall_opt_in = false,
         encouragement_scope = 'off',
         reminder_enabled = false,
         tracking_started_at = null,
         paused_until = null
   where id = v_profile.id;

  -- Updating the profile above invokes the B5 search projection trigger, which
  -- atomically queues a participant delete instead of exposing stale consent.
  update public.laundry_connections
     set status = 'disconnected',
         provider_account_ref_hash = null,
         connected_at = null,
         disconnected_at = coalesce(disconnected_at, now())
   where profile_id = v_profile.id;

  insert into public.account_cleanup_outbox (
    profile_id,
    auth_user_id
  ) values (
    v_profile.id,
    v_auth_user_id
  )
  on conflict (profile_id) do update
     set auth_user_id = excluded.auth_user_id,
         attempts = 0,
         available_at = now(),
         locked_at = null,
         last_error = null,
         updated_at = now();
end;
$$;

-- No participant can bypass either command by writing its backing storage or
-- by calling the lower-level snapshot primitive directly.
revoke all on table public.competition_enrollments from anon, authenticated;
revoke all on table public.account_cleanup_outbox from anon, authenticated;
revoke all on table public.competition_enrollments from public;
revoke all on table public.account_cleanup_outbox from public;
grant select, update, delete on table public.account_cleanup_outbox to service_role;

revoke all on function public.snapshot_competition_enrollment(uuid, date, uuid) from public, anon, authenticated;
revoke all on function public.enroll_in_competition(uuid) from public, anon, authenticated;
grant execute on function public.enroll_in_competition(uuid) to authenticated;

revoke all on function public.delete_current_account() from public, anon, authenticated;
grant execute on function public.delete_current_account() to authenticated;
