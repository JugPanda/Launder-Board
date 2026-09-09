-- Purdue West Lafayette uses this local IANA zone, not a New York alias.
-- Keep migration history and stored instants, rosters, events, credits, results,
-- privacy policies and the 72-hour cutoff unchanged. These zones agree in 2026
-- but differ historically (Indiana did not observe DST before 2006).
-- A single DO statement makes constraint replacement/backfill atomic even when
-- invoked through psql without an outer migration-runner transaction.
do $purdue_timezone$
begin
  alter table public.competitions
    drop constraint competitions_time_zone_check,
    alter column time_zone set default 'America/Indiana/Indianapolis';

  update public.competitions
    set time_zone = 'America/Indiana/Indianapolis'
    where time_zone = 'America/New_York';

  alter table public.competitions
    add constraint competitions_time_zone_check
      check (time_zone = 'America/Indiana/Indianapolis');

  -- NOT VALID deliberately preserves previously stored historical boundaries.
  -- New inserts/updates must satisfy Indianapolis boundaries; do not validate
  -- these checks or recompute legacy instants as part of this metadata change.
  -- Updating a legacy week with incompatible boundaries will be rejected too.
  alter table public.competition_weeks
    drop constraint competition_weeks_check,
    drop constraint competition_weeks_check1,
    add constraint competition_weeks_check
      check (starts_at = week_starts_on::timestamp at time zone 'America/Indiana/Indianapolis') not valid,
    add constraint competition_weeks_check1
      check (ends_at = (week_starts_on + 7)::timestamp at time zone 'America/Indiana/Indianapolis') not valid;
end;
$purdue_timezone$;
