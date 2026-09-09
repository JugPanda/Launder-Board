-- Competition enrollment, immutable scoring events, and weekly projections.

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  time_zone text not null default 'America/New_York'
    check (time_zone = 'America/New_York'),
  minimum_roster integer not null default 5 check (minimum_roster > 0),
  starts_on date not null,
  ends_on date,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create table public.competition_weeks (
  competition_id uuid not null references public.competitions(id) on delete cascade,
  week_starts_on date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  score_closes_at timestamptz not null,
  paused boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (competition_id, week_starts_on),
  check (extract(isodow from week_starts_on) = 1),
  check (starts_at = week_starts_on::timestamp at time zone 'America/New_York'),
  check (ends_at = (week_starts_on + 7)::timestamp at time zone 'America/New_York'),
  check (score_closes_at = ends_at + interval '72 hours')
);

create table public.competition_enrollments (
  competition_id uuid not null,
  week_starts_on date not null,
  participant_id uuid not null references public.profiles(id) on delete restrict,
  hall_id uuid not null references public.residence_halls(id) on delete restrict,
  eligible boolean not null,
  paused boolean not null,
  snapshotted_at timestamptz not null default now(),
  primary key (competition_id, week_starts_on, participant_id),
  foreign key (competition_id, week_starts_on)
    references public.competition_weeks (competition_id, week_starts_on)
    on delete restrict,
  unique (competition_id, week_starts_on, participant_id, hall_id)
);

create index competition_enrollments_week_roster_idx
  on public.competition_enrollments (competition_id, week_starts_on, hall_id)
  where eligible and not paused;

create table public.score_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('award', 'reversal')),
  competition_id uuid not null,
  week_starts_on date not null,
  participant_id uuid not null references public.profiles(id) on delete restrict,
  hall_id uuid not null references public.residence_halls(id) on delete restrict,
  session_id uuid not null references public.laundry_sessions(id) on delete restrict,
  occurred_at timestamptz not null,
  is_late boolean not null default false,
  reverses_event_id uuid,
  reason text,
  recorded_at timestamptz not null default now(),
  foreign key (competition_id, week_starts_on)
    references public.competition_weeks (competition_id, week_starts_on)
    on delete restrict,
  foreign key (reverses_event_id)
    references public.score_events (id)
    on delete restrict,
  unique (reverses_event_id),
  check (
    (event_type = 'award' and reverses_event_id is null)
    or (event_type = 'reversal' and reverses_event_id is not null)
  )
);

-- A source can only award a participant once. A different source may award them
-- after the active award has been reversed.
create unique index score_events_award_source_key
  on public.score_events (
    competition_id,
    week_starts_on,
    participant_id,
    session_id
  )
  where event_type = 'award';

create index score_events_projection_idx
  on public.score_events (
    competition_id,
    week_starts_on,
    participant_id,
    recorded_at,
    id
  );

create table public.weekly_credits (
  competition_id uuid not null,
  week_starts_on date not null,
  participant_id uuid not null references public.profiles(id) on delete restrict,
  hall_id uuid not null references public.residence_halls(id) on delete restrict,
  session_id uuid not null references public.laundry_sessions(id) on delete restrict,
  award_event_id uuid not null unique references public.score_events(id) on delete restrict,
  occurred_at timestamptz not null,
  is_late boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (competition_id, week_starts_on, participant_id),
  foreign key (competition_id, week_starts_on)
    references public.competition_weeks (competition_id, week_starts_on)
    on delete cascade
);

create index weekly_credits_hall_idx
  on public.weekly_credits (competition_id, week_starts_on, hall_id);

create table public.hall_week_results (
  competition_id uuid not null,
  week_starts_on date not null,
  hall_id uuid not null,
  eligible_count integer not null check (eligible_count >= 0),
  credited_count integer not null check (
    credited_count >= 0 and credited_count <= eligible_count
  ),
  score numeric(9, 6) not null check (score >= 0 and score <= 100),
  rank integer check (rank is null or rank > 0),
  publishable boolean not null,
  late_updated boolean not null default false,
  computed_at timestamptz not null default now(),
  primary key (competition_id, week_starts_on, hall_id),
  foreign key (competition_id, week_starts_on)
    references public.competition_weeks (competition_id, week_starts_on)
    on delete cascade
);

create or replace function public.prevent_competition_enrollment_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'competition enrollment snapshots are immutable; % is not allowed', tg_op
    using errcode = '55000';
end;
$$;

create trigger prevent_competition_enrollment_mutation
before update or delete on public.competition_enrollments
for each row execute function public.prevent_competition_enrollment_mutation();

-- B7 calls this once per participant/week before the weekly boundary. The hall,
-- eligibility, and scheduled-pause values are derived while the profile is
-- locked, then ON CONFLICT returns the immutable existing snapshot on retries.
create or replace function public.snapshot_competition_enrollment(
  p_competition_id uuid,
  p_week_starts_on date,
  p_participant_id uuid
)
returns public.competition_enrollments
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_week public.competition_weeks%rowtype;
  v_profile public.profiles%rowtype;
  v_snapshot public.competition_enrollments%rowtype;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(
      'roster:' || p_competition_id::text || ':' || p_week_starts_on::text || ':' || p_participant_id::text,
      0
    )
  );

  select w.*
    into v_week
    from public.competition_weeks w
    join public.competitions c on c.id = w.competition_id
   where w.competition_id = p_competition_id
     and w.week_starts_on = p_week_starts_on
     and p_week_starts_on >= c.starts_on
     and (c.ends_on is null or p_week_starts_on <= c.ends_on)
   for share of w;

  if not found then
    raise exception 'competition week does not exist or is outside the competition'
      using errcode = 'P0002';
  end if;

  select p.*
    into v_profile
    from public.profiles p
   where p.id = p_participant_id
     and p.active
     and p.deleted_at is null
   for share;

  if not found then
    raise exception 'active participant does not exist'
      using errcode = 'P0002';
  end if;

  if now() > v_week.starts_at then
    raise exception 'competition enrollment snapshot is already locked'
      using errcode = '22007';
  end if;

  insert into public.competition_enrollments (
    competition_id,
    week_starts_on,
    participant_id,
    hall_id,
    eligible,
    paused,
    snapshotted_at
  ) values (
    p_competition_id,
    p_week_starts_on,
    p_participant_id,
    v_profile.hall_id,
    true,
    v_profile.paused_until is not null and v_profile.paused_until >= v_week.starts_at,
    now()
  )
  on conflict (competition_id, week_starts_on, participant_id) do nothing;

  select e.*
    into strict v_snapshot
    from public.competition_enrollments e
   where e.competition_id = p_competition_id
     and e.week_starts_on = p_week_starts_on
     and e.participant_id = p_participant_id;

  return v_snapshot;
end;
$$;

create or replace function public.prevent_score_event_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'score_events are append-only; % is not allowed', tg_op
    using errcode = '55000';
end;
$$;

create trigger prevent_score_event_mutation
before update or delete on public.score_events
for each row execute function public.prevent_score_event_mutation();

-- Rebuild the mutable projection from immutable events and refresh normalized
-- hall scores. The week-scoped advisory lock prevents two refreshes from
-- interleaving while awards for different participants arrive concurrently.
create or replace function public.recompute_competition_week(
  p_competition_id uuid,
  p_week_starts_on date
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_week public.competition_weeks%rowtype;
  v_minimum_roster integer;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(p_competition_id::text || ':' || p_week_starts_on::text, 0)
  );

  select w.*
    into v_week
    from public.competition_weeks w
   where w.competition_id = p_competition_id
     and w.week_starts_on = p_week_starts_on
   for update;

  if not found then
    raise exception 'competition week does not exist'
      using errcode = 'P0002';
  end if;

  select c.minimum_roster
    into v_minimum_roster
    from public.competitions c
   where c.id = p_competition_id;

  delete from public.weekly_credits wc
   where wc.competition_id = p_competition_id
     and wc.week_starts_on = p_week_starts_on;

  delete from public.hall_week_results hr
   where hr.competition_id = p_competition_id
     and hr.week_starts_on = p_week_starts_on;

  if v_week.paused then
    return;
  end if;

  with active_awards as (
    select
      e.*,
      row_number() over (
        partition by e.competition_id, e.week_starts_on, e.participant_id
        order by e.recorded_at, e.id
      ) as participant_award_number
    from public.score_events e
    join public.competition_enrollments enrollment
      on enrollment.competition_id = e.competition_id
     and enrollment.week_starts_on = e.week_starts_on
     and enrollment.participant_id = e.participant_id
     and enrollment.hall_id = e.hall_id
     and enrollment.eligible
     and not enrollment.paused
    where e.competition_id = p_competition_id
      and e.week_starts_on = p_week_starts_on
      and e.event_type = 'award'
      and not exists (
        select 1
        from public.score_events reversal
        where reversal.event_type = 'reversal'
          and reversal.reverses_event_id = e.id
      )
  )
  insert into public.weekly_credits (
    competition_id,
    week_starts_on,
    participant_id,
    hall_id,
    session_id,
    award_event_id,
    occurred_at,
    is_late
  )
  select
    a.competition_id,
    a.week_starts_on,
    a.participant_id,
    a.hall_id,
    a.session_id,
    a.id,
    a.occurred_at,
    a.is_late
  from active_awards a
  where a.participant_award_number = 1
  on conflict (competition_id, week_starts_on, participant_id) do nothing;

  with eligible_enrollments as (
    select e.participant_id, e.hall_id
    from public.competition_enrollments e
    where e.competition_id = p_competition_id
      and e.week_starts_on = p_week_starts_on
      and e.eligible
      and not e.paused
  ),
  counts as (
    select
      roster.hall_id,
      count(*)::integer as eligible_count,
      count(credit.participant_id)::integer as credited_count,
      coalesce(bool_or(credit.is_late), false) as late_updated
    from eligible_enrollments roster
    left join public.weekly_credits credit
      on credit.competition_id = p_competition_id
     and credit.week_starts_on = p_week_starts_on
     and credit.participant_id = roster.participant_id
     and credit.hall_id = roster.hall_id
    group by roster.hall_id
  ),
  ranked as (
    select
      counts.hall_id,
      dense_rank() over (
        order by credited_count::numeric / eligible_count desc
      )::integer as shared_rank
    from counts
    where counts.eligible_count >= v_minimum_roster
  )
  insert into public.hall_week_results (
    competition_id,
    week_starts_on,
    hall_id,
    eligible_count,
    credited_count,
    score,
    rank,
    publishable,
    late_updated,
    computed_at
  )
  select
    p_competition_id,
    p_week_starts_on,
    counts.hall_id,
    counts.eligible_count,
    counts.credited_count,
    100 * counts.credited_count::numeric / counts.eligible_count,
    ranked.shared_rank,
    counts.eligible_count >= v_minimum_roster,
    counts.late_updated,
    now()
  from counts
  left join ranked on ranked.hall_id = counts.hall_id;
end;
$$;

-- The session id is the authoritative award boundary. Participant identity,
-- hall, occurrence, and recording time are derived rather than caller supplied.
create or replace function public.award_weekly_credit(
  p_competition_id uuid,
  p_week_starts_on date,
  p_participant_id uuid,
  p_session_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_week public.competition_weeks%rowtype;
  v_session public.laundry_sessions%rowtype;
  v_hall_id uuid;
  v_event_id uuid;
  v_recorded_at timestamptz := now();
  v_late boolean;
begin
  -- All scoring mutations take the week lock before participant/session locks.
  perform pg_advisory_xact_lock(
    hashtextextended(p_competition_id::text || ':' || p_week_starts_on::text, 0)
  );

  select w.*
    into v_week
    from public.competition_weeks w
    join public.competitions c on c.id = w.competition_id
   where w.competition_id = p_competition_id
     and w.week_starts_on = p_week_starts_on
     and not w.paused
     and not c.paused
   for update of w;

  if not found then
    raise exception 'competition week does not exist or is paused'
      using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_competition_id::text || ':' || p_week_starts_on::text || ':' || p_participant_id::text,
      0
    )
  );

  select s.*
    into v_session
    from public.laundry_sessions s
   where s.id = p_session_id
   for update;

  if not found then
    raise exception 'laundry session does not exist'
      using errcode = 'P0002';
  end if;

  if not v_session.score_eligible
    or not v_session.qualifying_washer
    or v_session.review_state <> 'accepted'
    or v_session.retracted_at is not null
    or v_session.duplicate_of_session_id is not null
  then
    raise exception 'laundry session is not eligible for weekly credit'
      using errcode = '23514';
  end if;

  if p_participant_id <> v_session.owner_profile_id
    and not exists (
      select 1
      from public.shared_session_members shared
      where shared.session_id = v_session.id
        and shared.member_profile_id = p_participant_id
        and shared.status = 'accepted'
    )
  then
    raise exception 'participant is not an accepted session participant'
      using errcode = '23514';
  end if;

  -- Defensive guard for malformed pre-migration data; 0003 also enforces this.
  if (
    select count(*)
    from (
      select v_session.owner_profile_id
      union
      select shared.member_profile_id
      from public.shared_session_members shared
      where shared.session_id = v_session.id
        and shared.status = 'accepted'
    ) participants
  ) > 2 then
    raise exception 'laundry session has too many credited participants'
      using errcode = '23514';
  end if;

  if v_session.started_at < v_week.starts_at
    or v_session.started_at >= v_week.ends_at
  then
    raise exception 'session did not occur within the competition week'
      using errcode = '22007';
  end if;

  if v_recorded_at > v_week.score_closes_at then
    raise exception 'weekly credit arrived after the 72-hour close window'
      using errcode = '22007';
  end if;

  select e.hall_id
    into v_hall_id
    from public.competition_enrollments e
   where e.competition_id = p_competition_id
     and e.week_starts_on = p_week_starts_on
     and e.participant_id = p_participant_id
     and e.eligible
     and not e.paused
   for share;

  if not found then
    raise exception 'participant is not eligible for this hall and week'
      using errcode = '23514';
  end if;

  select wc.award_event_id
    into v_event_id
    from public.weekly_credits wc
   where wc.competition_id = p_competition_id
     and wc.week_starts_on = p_week_starts_on
     and wc.participant_id = p_participant_id;

  if found then
    return v_event_id;
  end if;

  v_late := v_recorded_at > v_week.ends_at;
  v_event_id := gen_random_uuid();

  insert into public.score_events (
    id, event_type, competition_id, week_starts_on, participant_id, hall_id,
    session_id, occurred_at, is_late, recorded_at
  ) values (
    v_event_id, 'award', p_competition_id, p_week_starts_on,
    p_participant_id, v_hall_id, p_session_id, v_session.started_at,
    v_late, v_recorded_at
  )
  on conflict (
    competition_id, week_starts_on, participant_id, session_id
  ) where event_type = 'award'
  do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select e.id
      into v_event_id
      from public.score_events e
     where e.event_type = 'award'
       and e.competition_id = p_competition_id
       and e.week_starts_on = p_week_starts_on
       and e.participant_id = p_participant_id
       and e.session_id = p_session_id;

    if exists (
      select 1
      from public.score_events reversal
      where reversal.event_type = 'reversal'
        and reversal.reverses_event_id = v_event_id
    ) then
      return null;
    end if;
  end if;

  insert into public.weekly_credits (
    competition_id, week_starts_on, participant_id, hall_id, session_id,
    award_event_id, occurred_at, is_late
  ) values (
    p_competition_id, p_week_starts_on, p_participant_id, v_hall_id,
    p_session_id, v_event_id, v_session.started_at, v_late
  )
  on conflict (competition_id, week_starts_on, participant_id) do nothing;

  perform public.recompute_competition_week(p_competition_id, p_week_starts_on);

  select wc.award_event_id
    into v_event_id
    from public.weekly_credits wc
   where wc.competition_id = p_competition_id
     and wc.week_starts_on = p_week_starts_on
     and wc.participant_id = p_participant_id;

  return v_event_id;
end;
$$;

create or replace function public.reverse_weekly_credit(
  p_award_event_id uuid,
  p_reason text default null,
  p_recorded_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_award public.score_events%rowtype;
  v_reversal_id uuid;
begin
  select e.*
    into v_award
    from public.score_events e
   where e.id = p_award_event_id
     and e.event_type = 'award';

  if not found then
    raise exception 'award event does not exist'
      using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_award.competition_id::text || ':' || v_award.week_starts_on::text, 0)
  );

  select e.*
    into v_award
    from public.score_events e
   where e.id = p_award_event_id
     and e.event_type = 'award'
   for update;

  if not found then
    raise exception 'award event does not exist'
      using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      v_award.competition_id::text || ':' || v_award.week_starts_on::text || ':' || v_award.participant_id::text,
      0
    )
  );

  if p_recorded_at < v_award.recorded_at then
    raise exception 'reversal cannot predate its award'
      using errcode = '22007';
  end if;

  v_reversal_id := gen_random_uuid();

  insert into public.score_events (
    id,
    event_type,
    competition_id,
    week_starts_on,
    participant_id,
    hall_id,
    session_id,
    occurred_at,
    is_late,
    reverses_event_id,
    reason,
    recorded_at
  ) values (
    v_reversal_id,
    'reversal',
    v_award.competition_id,
    v_award.week_starts_on,
    v_award.participant_id,
    v_award.hall_id,
    v_award.session_id,
    v_award.occurred_at,
    v_award.is_late,
    v_award.id,
    nullif(btrim(p_reason), ''),
    p_recorded_at
  )
  on conflict (reverses_event_id) do nothing
  returning id into v_reversal_id;

  if v_reversal_id is null then
    select e.id
      into v_reversal_id
      from public.score_events e
     where e.event_type = 'reversal'
       and e.reverses_event_id = p_award_event_id;
  end if;

  delete from public.weekly_credits wc
   where wc.award_event_id = p_award_event_id;

  perform public.recompute_competition_week(
    v_award.competition_id,
    v_award.week_starts_on
  );

  return v_reversal_id;
end;
$$;

alter table public.competitions enable row level security;
alter table public.competition_weeks enable row level security;
alter table public.competition_enrollments enable row level security;
alter table public.weekly_credits enable row level security;
alter table public.score_events enable row level security;
alter table public.hall_week_results enable row level security;

-- Competition metadata and publishable aggregate results contain no participant
-- activity. Participant-level enrollment, credits, and events remain private.
create policy "competition metadata is readable"
  on public.competitions for select
  using (true);

create policy "competition weeks are readable"
  on public.competition_weeks for select
  using (true);

create policy "publishable hall results are readable"
  on public.hall_week_results for select
  using (publishable);

revoke all on function public.recompute_competition_week(uuid, date) from public;
revoke all on function public.award_weekly_credit(
  uuid, date, uuid, uuid
) from public;
revoke all on function public.reverse_weekly_credit(uuid, text, timestamptz) from public;

grant execute on function public.recompute_competition_week(uuid, date) to service_role;
grant execute on function public.award_weekly_credit(
  uuid, date, uuid, uuid
) to service_role;
grant execute on function public.reverse_weekly_credit(uuid, text, timestamptz) to service_role;
