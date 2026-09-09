import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  COMPETITION_TIME_ZONE,
  getCompetitionWeek,
  scoreCompetitionWeek,
} from "@/lib/competitions/weekly-score";

const migration = () => readFileSync(join(process.cwd(), "supabase/migrations/0008_purdue_timezone.sql"), "utf8");

describe("Purdue local competition time", () => {
  it("uses the local IANA identifier, including Indiana's pre-2006 history", () => {
    expect(COMPETITION_TIME_ZONE).toBe("America/Indiana/Indianapolis");
    expect(getCompetitionWeek("2005-07-06T12:00:00Z").startsAt).toBe("2005-07-04T05:00:00.000Z");
    expect(getCompetitionWeek("2005-07-06T12:00:00Z", "America/New_York").startsAt).toBe("2005-07-04T04:00:00.000Z");
  });

  it("rolls over at Monday local midnight, not UTC midnight", () => {
    expect(getCompetitionWeek("2026-09-14T03:59:59.999Z").startsOn).toBe("2026-09-07");
    expect(getCompetitionWeek("2026-09-14T04:00:00.000Z").startsOn).toBe("2026-09-14");
  });

  it.each([
    ["2026-03-08T07:30:00Z", "2026-03-02T05:00:00.000Z", "2026-03-09T04:00:00.000Z", 167],
    ["2026-11-01T06:30:00Z", "2026-10-26T04:00:00.000Z", "2026-11-02T05:00:00.000Z", 169],
  ])("keeps calendar-week boundaries through DST at %s", (instant, startsAt, endsAt, hours) => {
    const week = getCompetitionWeek(instant);
    expect(week).toMatchObject({ startsAt, endsAt });
    expect((Date.parse(week.endsAt) - Date.parse(week.startsAt)) / 3_600_000).toBe(hours);
  });

  it.each(["2026-03-08T07:30:00Z", "2026-11-01T06:30:00Z"])(
    "preserves inclusive 72-hour late cutoff, one credit, and small-hall privacy at %s",
    (instant) => {
      const week = getCompetitionWeek(instant);
      const cutoff = Date.parse(week.endsAt) + 72 * 3_600_000;
      const score = (importedAt: number, occurredAt = instant) => scoreCompetitionWeek({
        competitionId: "purdue", weekStartsOn: week.startsOn, minimumRoster: 5, paused: false,
        enrollments: [{ competitionId: "purdue", weekStartsOn: week.startsOn, participantId: "p1", hallId: "hall", eligible: true, paused: false }],
        sessions: ["wash1", "wash2"].map((id) => ({ id, ownerParticipantId: "p1", occurredAt, importedAt: new Date(importedAt).toISOString(), machineKind: "washer", status: "accepted", duplicateOfSessionId: null, sharedMembers: [] })),
      });
      expect(score(cutoff).credits).toHaveLength(1);
      expect(score(cutoff).credits[0].late).toBe(true);
      expect(score(cutoff).publicHalls).toEqual([]);
      expect(score(cutoff + 1).credits).toEqual([]);
      expect(score(cutoff, week.endsAt).credits).toEqual([]);
      expect(score(cutoff, week.startsAt).credits).toHaveLength(1);
    },
  );
});

describe("additive Purdue migration", () => {
  it("replaces only timezone metadata and boundary checks without rewriting historical data", () => {
    const sql = migration().replace(/--[^\n]*/g, "");
    expect(sql).toMatch(/alter column time_zone set default 'America\/Indiana\/Indianapolis'/i);
    expect(sql).toMatch(/drop constraint competitions_time_zone_check/i);
    expect(sql).toMatch(/check \(time_zone = 'America\/Indiana\/Indianapolis'\)/i);
    expect(sql).toMatch(/where time_zone = 'America\/New_York'/i);
    expect(sql).toMatch(/drop constraint competition_weeks_check\b/i);
    expect(sql).toMatch(/drop constraint competition_weeks_check1\b/i);
    expect(sql.match(/not valid/gi)).toHaveLength(2);
    expect(sql).not.toMatch(/\b(delete|truncate|grant|revoke)\b|disable\s+(trigger|row level security)/i);
    expect(sql.match(/\bupdate\s+public\.\w+/gi)).toEqual(["update public.competitions"]);
    expect(sql).not.toMatch(/\b(drop table|create policy|alter policy)\b/i);
  });

  // Opt in explicitly: local container only, no network URL or persistent writes.
  it.skipIf(process.env.RUN_PURDUE_DB_TEST !== "1")("executes against local PostgreSQL and rolls back all changes", () => {
    const constraintState = () => execFileSync("docker", ["exec", "supabase_db_launder-board", "psql", "-X", "-U", "postgres", "-d", "postgres", "-Atc", "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname IN ('competitions_time_zone_check','competition_weeks_check','competition_weeks_check1') ORDER BY conname;"], { encoding: "utf8" });
    const originalConstraints = constraintState();
    const sql = `
      BEGIN;
      SET LOCAL lock_timeout = '5s';
      SET LOCAL statement_timeout = '20s';
      -- Reconstruct the legacy boundary inside this rollback-only transaction.
      -- The local database may already have applied migration 0008.
      ALTER TABLE public.competitions DROP CONSTRAINT competitions_time_zone_check;
      UPDATE public.competitions SET time_zone = 'America/New_York';
      ALTER TABLE public.competitions
        ALTER COLUMN time_zone SET DEFAULT 'America/New_York',
        ADD CONSTRAINT competitions_time_zone_check CHECK (time_zone = 'America/New_York');
      ALTER TABLE public.competition_weeks
        DROP CONSTRAINT competition_weeks_check,
        DROP CONSTRAINT competition_weeks_check1,
        ADD CONSTRAINT competition_weeks_check CHECK (starts_at = week_starts_on::timestamp AT TIME ZONE 'America/New_York') NOT VALID,
        ADD CONSTRAINT competition_weeks_check1 CHECK (ends_at = (week_starts_on + 7)::timestamp AT TIME ZONE 'America/New_York') NOT VALID;
      INSERT INTO public.competitions(id, name, starts_on)
        VALUES ('00000000-0000-4000-8000-000000000008', 'Timezone regression', '2005-07-04');
      INSERT INTO public.competition_weeks(competition_id, week_starts_on, starts_at, ends_at, score_closes_at)
        VALUES ('00000000-0000-4000-8000-000000000008', '2005-07-04', '2005-07-04T04:00:00Z', '2005-07-11T04:00:00Z', '2005-07-14T04:00:00Z');
      CREATE TEMP TABLE before_rows AS
        SELECT 'competitions' AS name, jsonb_agg(to_jsonb(t) - 'time_zone' ORDER BY id) AS rows FROM public.competitions t
        UNION ALL SELECT 'competition_weeks', jsonb_agg(to_jsonb(t) ORDER BY competition_id, week_starts_on) FROM public.competition_weeks t
        UNION ALL SELECT 'competition_enrollments', jsonb_agg(to_jsonb(t) ORDER BY competition_id, week_starts_on, participant_id) FROM public.competition_enrollments t
        UNION ALL SELECT 'score_events', jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.score_events t
        UNION ALL SELECT 'weekly_credits', jsonb_agg(to_jsonb(t) ORDER BY competition_id, week_starts_on, participant_id) FROM public.weekly_credits t
        UNION ALL SELECT 'hall_week_results', jsonb_agg(to_jsonb(t) ORDER BY competition_id, week_starts_on, hall_id) FROM public.hall_week_results t;
      ${migration()}
      ${migration()}
      DO $test$
      DECLARE saved record; actual jsonb; ordering text; new_zone text;
      BEGIN
        FOR saved IN SELECT * FROM before_rows LOOP
          ordering := CASE saved.name WHEN 'competitions' THEN 'id' WHEN 'score_events' THEN 'id'
            WHEN 'competition_weeks' THEN 'competition_id, week_starts_on'
            WHEN 'hall_week_results' THEN 'competition_id, week_starts_on, hall_id'
            ELSE 'competition_id, week_starts_on, participant_id' END;
          EXECUTE format('SELECT jsonb_agg(%s ORDER BY %s) FROM public.%I t',
            CASE WHEN saved.name = 'competitions' THEN 'to_jsonb(t) - ''time_zone''' ELSE 'to_jsonb(t)' END,
            ordering, saved.name) INTO actual;
          IF actual IS DISTINCT FROM saved.rows THEN RAISE EXCEPTION 'Rows changed: %', saved.name; END IF;
        END LOOP;
        IF (SELECT count(*) FROM pg_constraint
          WHERE conrelid = 'public.competition_weeks'::regclass
            AND conname IN ('competition_weeks_check', 'competition_weeks_check1')
            AND NOT convalidated
            AND pg_get_constraintdef(oid) LIKE '%America/Indiana/Indianapolis%') <> 2 THEN
          RAISE EXCEPTION 'Missing preserving Indianapolis boundary checks';
        END IF;
        INSERT INTO public.competition_weeks(competition_id, week_starts_on, starts_at, ends_at, score_closes_at)
          VALUES
            ('00000000-0000-4000-8000-000000000008', '2026-03-02', '2026-03-02T05:00:00Z', '2026-03-09T04:00:00Z', '2026-03-12T04:00:00Z'),
            ('00000000-0000-4000-8000-000000000008', '2026-10-26', '2026-10-26T04:00:00Z', '2026-11-02T05:00:00Z', '2026-11-05T05:00:00Z');
        BEGIN
          UPDATE public.competition_weeks SET score_closes_at = score_closes_at + interval '1 second'
            WHERE competition_id = '00000000-0000-4000-8000-000000000008' AND week_starts_on = '2026-03-02';
          RAISE EXCEPTION 'Incorrect late cutoff accepted';
        EXCEPTION WHEN check_violation THEN NULL; END;
        IF EXISTS (SELECT FROM public.competitions WHERE time_zone <> 'America/Indiana/Indianapolis') THEN
          RAISE EXCEPTION 'Timezone backfill failed';
        END IF;
        INSERT INTO public.competitions(name, starts_on) VALUES ('Default check', '2026-03-02') RETURNING time_zone INTO new_zone;
        IF new_zone <> 'America/Indiana/Indianapolis' THEN RAISE EXCEPTION 'Wrong default'; END IF;
        BEGIN
          INSERT INTO public.competitions(name, starts_on, time_zone) VALUES ('Bad zone', '2026-03-02', 'America/New_York');
          RAISE EXCEPTION 'Old zone accepted';
        EXCEPTION WHEN check_violation THEN NULL; END;
        INSERT INTO public.competition_weeks(competition_id, week_starts_on, starts_at, ends_at, score_closes_at)
          VALUES ('00000000-0000-4000-8000-000000000008', '2005-07-11', '2005-07-11T05:00:00Z', '2005-07-18T05:00:00Z', '2005-07-21T05:00:00Z');
        BEGIN
          INSERT INTO public.competition_weeks(competition_id, week_starts_on, starts_at, ends_at, score_closes_at)
            VALUES ('00000000-0000-4000-8000-000000000008', '2005-07-18', '2005-07-18T04:00:00Z', '2005-07-25T04:00:00Z', '2005-07-28T04:00:00Z');
          RAISE EXCEPTION 'Old boundaries accepted';
        EXCEPTION WHEN check_violation THEN NULL; END;
      END $test$;
      SELECT 'PURDUE_MIGRATION_VERIFIED';
      ROLLBACK;
    `;
    const result = execFileSync("docker", ["exec", "-i", "supabase_db_launder-board", "psql", "-X", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1"], { input: sql, encoding: "utf8", timeout: 45_000 });
    expect(result).toContain("PURDUE_MIGRATION_VERIFIED");
    expect(result).toContain("ROLLBACK");
    const after = execFileSync("docker", ["exec", "supabase_db_launder-board", "psql", "-X", "-U", "postgres", "-d", "postgres", "-Atc", "SELECT count(*) FROM public.competitions WHERE id = '00000000-0000-4000-8000-000000000008'; SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'competitions_time_zone_check';"], { encoding: "utf8" });
    expect(after).toMatch(/^0\n/);
    expect(constraintState()).toBe(originalConstraints);
  }, 60_000);
});
