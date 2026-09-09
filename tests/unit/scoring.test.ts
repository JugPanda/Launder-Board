import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  getCompetitionWeek,
  projectWeeklyCredits,
  scoreCompetitionWeek,
  type CompetitionEnrollment,
  type LaundrySession,
  type ScoreEvent,
} from "@/lib/competitions/weekly-score";

const competitionId = "competition-1";
const weekStartsOn = "2026-03-02";
function enrollment(
  participantId: string,
  hallId: string,
  overrides: Partial<CompetitionEnrollment> = {},
): CompetitionEnrollment {
  return {
    competitionId,
    weekStartsOn,
    participantId,
    hallId,
    eligible: true,
    paused: false,
    ...overrides,
  };
}

function session(
  id: string,
  ownerParticipantId: string,
  overrides: Partial<LaundrySession> = {},
): LaundrySession {
  return {
    id,
    ownerParticipantId,
    occurredAt: "2026-03-04T17:00:00.000Z",
    importedAt: "2026-03-04T17:01:00.000Z",
    machineKind: "washer",
    status: "accepted",
    duplicateOfSessionId: null,
    sharedMembers: [],
    ...overrides,
  };
}

function roster(hallId: string, size: number): CompetitionEnrollment[] {
  return Array.from({ length: size }, (_, index) =>
    enrollment(`${hallId}-${index + 1}`, hallId),
  );
}

function score(
  enrollments: CompetitionEnrollment[],
  sessions: LaundrySession[],
  overrides: Partial<Parameters<typeof scoreCompetitionWeek>[0]> = {},
) {
  return scoreCompetitionWeek({
    competitionId,
    weekStartsOn,
    timeZone: "America/New_York",
    minimumRoster: 5,
    paused: false,
    enrollments,
    sessions,
    ...overrides,
  });
}

describe("America/New_York competition weeks", () => {
  it("uses Monday local midnight boundaries", () => {
    expect(getCompetitionWeek("2026-03-04T17:00:00.000Z")).toEqual({
      startsOn: "2026-03-02",
      startsAt: "2026-03-02T05:00:00.000Z",
      endsAt: "2026-03-09T04:00:00.000Z",
    });
  });

  it("handles both DST transitions without assuming a 168-hour UTC week", () => {
    const spring = getCompetitionWeek("2026-03-08T07:30:00.000Z");
    const fall = getCompetitionWeek("2026-11-01T06:30:00.000Z");

    expect(spring).toEqual({
      startsOn: "2026-03-02",
      startsAt: "2026-03-02T05:00:00.000Z",
      endsAt: "2026-03-09T04:00:00.000Z",
    });
    expect(
      (Date.parse(spring.endsAt) - Date.parse(spring.startsAt)) / 3_600_000,
    ).toBe(167);

    expect(fall).toEqual({
      startsOn: "2026-10-26",
      startsAt: "2026-10-26T04:00:00.000Z",
      endsAt: "2026-11-02T05:00:00.000Z",
    });
    expect((Date.parse(fall.endsAt) - Date.parse(fall.startsAt)) / 3_600_000).toBe(
      169,
    );
  });

  it("puts exact boundaries in the correct adjacent week", () => {
    expect(getCompetitionWeek("2026-03-09T03:59:59.999Z").startsOn).toBe(
      "2026-03-02",
    );
    expect(getCompetitionWeek("2026-03-09T04:00:00.000Z").startsOn).toBe(
      "2026-03-09",
    );
  });
});

describe("weekly participation scoring", () => {
  it("awards only the first accepted qualifying washer credit per person", () => {
    const enrollments = roster("maple", 5);
    const result = score(enrollments, [
      session("later", "maple-1", { occurredAt: "2026-03-05T17:00:00.000Z" }),
      session("first", "maple-1", { occurredAt: "2026-03-03T17:00:00.000Z" }),
    ]);

    expect(result.credits).toEqual([
      expect.objectContaining({ participantId: "maple-1", sessionId: "first" }),
    ]);
    expect(result.halls).toEqual([
      expect.objectContaining({
        hallId: "maple",
        eligibleCount: 5,
        creditedCount: 1,
        score: 20,
      }),
    ]);
  });

  it.each([
    ["dryer-only", { machineKind: "dryer" }],
    ["failed", { status: "failed" }],
    ["refunded", { status: "refunded" }],
    ["retracted", { status: "retracted" }],
    ["pending review", { status: "reported" }],
    ["duplicate", { duplicateOfSessionId: "original" }],
  ] satisfies Array<[string, Partial<LaundrySession>]>) (
    "excludes %s sessions",
    (_label, overrides) => {
      const result = score(roster("maple", 5), [session("candidate", "maple-1", overrides)]);
      expect(result.credits).toHaveLength(0);
      expect(result.halls[0]).toMatchObject({ creditedCount: 0, score: 0 });
    },
  );

  it("uses only the immutable roster snapshot for the exact competition week", () => {
    const enrollments = [
      enrollment("eligible", "maple"),
      enrollment("ineligible", "maple", { eligible: false }),
      enrollment("paused", "maple", { paused: true }),
      enrollment("other-week", "river", { weekStartsOn: "2026-03-09" }),
      enrollment("other-competition", "oak", { competitionId: "competition-2" }),
    ];

    const result = score(enrollments, [
      session("one", "eligible"),
      session("two", "ineligible"),
      session("three", "paused"),
      session("four", "other-week"),
      session("five", "other-competition"),
    ]);

    expect(result.halls).toEqual([
      expect.objectContaining({ hallId: "maple", eligibleCount: 1, creditedCount: 1 }),
    ]);
    expect(result.credits.map((credit) => credit.participantId)).toEqual(["eligible"]);
  });

  it("keeps an earlier week's hall roster unchanged when a later snapshot moves a participant", () => {
    const snapshots = [
      enrollment("mover", "maple"),
      enrollment("mover", "river", { weekStartsOn: "2026-03-09" }),
      ...roster("maple", 4),
    ];

    const result = score(snapshots, [session("wash", "mover")]);

    expect(result.credits).toEqual([
      expect.objectContaining({ participantId: "mover", hallId: "maple" }),
    ]);
    expect(result.halls).toEqual([
      expect.objectContaining({ hallId: "maple", eligibleCount: 5, creditedCount: 1 }),
    ]);
  });

  it("credits an accepted co-loader, rejects unaccepted members, and caps malformed sharing at two people", () => {
    const enrollments = roster("maple", 5);
    const result = score(enrollments, [
      session("shared", "maple-1", {
        sharedMembers: [
          { participantId: "maple-4", status: "declined" },
          { participantId: "maple-3", status: "accepted" },
          { participantId: "maple-2", status: "accepted" },
        ],
      }),
    ]);

    expect(result.credits.map((credit) => credit.participantId)).toEqual([
      "maple-1",
      "maple-2",
    ]);
    expect(result.halls[0]).toMatchObject({ eligibleCount: 5, creditedCount: 2, score: 40 });
  });

  it("accepts imports through the inclusive 72-hour close window and labels late updates", () => {
    const enrollments = roster("maple", 5);
    const result = score(enrollments, [
      session("at-close", "maple-1", {
        occurredAt: "2026-03-08T12:00:00.000Z",
        importedAt: "2026-03-12T04:00:00.000Z",
      }),
      session("too-late", "maple-2", {
        occurredAt: "2026-03-08T12:00:00.000Z",
        importedAt: "2026-03-12T04:00:00.001Z",
      }),
    ]);

    expect(result.credits.map((credit) => credit.participantId)).toEqual(["maple-1"]);
    expect(result.halls[0]).toMatchObject({ creditedCount: 1, lateUpdated: true });
  });

  it("excludes activity outside the local competition week", () => {
    const result = score(roster("maple", 5), [
      session("before", "maple-1", { occurredAt: "2026-03-02T04:59:59.999Z" }),
      session("after", "maple-2", { occurredAt: "2026-03-09T04:00:00.000Z" }),
    ]);

    expect(result.credits).toHaveLength(0);
  });

  it("normalizes halls, shares ties, and withholds halls below the minimum roster", () => {
    const enrollments = [
      ...roster("maple", 5),
      ...roster("river", 10),
      ...roster("oak", 4),
    ];
    const sessions = [
      session("m1", "maple-1"),
      session("m2", "maple-2"),
      session("r1", "river-1"),
      session("r2", "river-2"),
      session("r3", "river-3"),
      session("r4", "river-4"),
      session("o1", "oak-1"),
      session("o2", "oak-2"),
      session("o3", "oak-3"),
      session("o4", "oak-4"),
    ];

    const result = score(enrollments, sessions);
    expect(result.halls).toEqual([
      expect.objectContaining({ hallId: "maple", score: 40, rank: 1, publishable: true }),
      expect.objectContaining({ hallId: "river", score: 40, rank: 1, publishable: true }),
      expect.objectContaining({ hallId: "oak", score: 100, rank: null, publishable: false }),
    ]);
    expect(result.publicHalls.map((hall) => hall.hallId)).toEqual(["maple", "river"]);
  });

  it("emits no score for a paused competition week", () => {
    const result = score(roster("maple", 5), [session("wash", "maple-1")], {
      paused: true,
    });
    expect(result).toMatchObject({ credits: [], halls: [], publicHalls: [] });
  });
});

describe("append-only event projection", () => {
  const award: ScoreEvent = {
    id: "award-1",
    type: "award",
    competitionId,
    weekStartsOn,
    participantId: "maple-1",
    hallId: "maple",
    sessionId: "wash-1",
    recordedAt: "2026-03-04T17:00:00.000Z",
  };

  it("applies a reversal once even when duplicate replay is attempted", () => {
    const reversal: ScoreEvent = {
      id: "reverse-1",
      type: "reversal",
      competitionId,
      weekStartsOn,
      participantId: "maple-1",
      hallId: "maple",
      sessionId: "wash-1",
      reversesEventId: "award-1",
      recordedAt: "2026-03-05T17:00:00.000Z",
    };

    expect(projectWeeklyCredits([award, reversal, reversal])).toEqual([]);
  });

  it("promotes an already-recorded later award when the first is reversed", () => {
    const earlierReplacement: ScoreEvent = {
      ...award,
      id: "award-2",
      sessionId: "wash-2",
      recordedAt: "2026-03-05T17:00:00.000Z",
    };
    const laterReversal: ScoreEvent = {
      ...award,
      id: "reverse-1",
      type: "reversal",
      reversesEventId: "award-1",
      recordedAt: "2026-03-06T17:00:00.000Z",
    };

    expect(projectWeeklyCredits([laterReversal, earlierReplacement, award])).toEqual([
      expect.objectContaining({ participantId: "maple-1", eventId: "award-2" }),
    ]);
  });

  it("allows a later qualifying award after the active credit is reversed", () => {
    const reversal: ScoreEvent = {
      ...award,
      id: "reverse-1",
      type: "reversal",
      reversesEventId: "award-1",
      recordedAt: "2026-03-05T17:00:00.000Z",
    };
    const replacement: ScoreEvent = {
      ...award,
      id: "award-2",
      sessionId: "wash-2",
      recordedAt: "2026-03-06T17:00:00.000Z",
    };

    expect(projectWeeklyCredits([replacement, reversal, award])).toEqual([
      expect.objectContaining({ participantId: "maple-1", eventId: "award-2" }),
    ]);
  });
});

describe("competition migration contract", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations/0004_competitions.sql"),
    "utf8",
  );

  it.each([
    "competitions",
    "competition_weeks",
    "competition_enrollments",
    "weekly_credits",
    "score_events",
    "hall_week_results",
  ])("creates normalized table %s with RLS", (table) => {
    expect(migration).toMatch(new RegExp(`create table public\\.${table}\\b`, "i"));
    expect(migration).toMatch(
      new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    );
  });

  it("provides concurrency-safe award and idempotent reversal functions", () => {
    expect(migration).toMatch(/create or replace function public\.award_weekly_credit/i);
    expect(migration).toMatch(/on conflict[^;]+do nothing/is);
    expect(migration).toMatch(/create or replace function public\.reverse_weekly_credit/i);
    expect(migration).toMatch(/unique[^;]+reverses_event_id/is);
    expect(migration).toMatch(/pg_advisory_xact_lock|for update/i);
  });

  it("stores immutable participant rosters per competition week", () => {
    expect(migration).toMatch(
      /competition_enrollments[\s\S]+week_starts_on date not null[\s\S]+primary key \(competition_id, week_starts_on, participant_id\)/i,
    );
    expect(migration).toMatch(
      /foreign key \(competition_id, week_starts_on\)[\s\S]+references public\.competition_weeks/i,
    );
    expect(migration).toMatch(/participant_id uuid not null references public\.profiles\(id\)/i);
    expect(migration).toMatch(/hall_id uuid not null references public\.residence_halls\(id\)/i);
    expect(migration).toMatch(/prevent_competition_enrollment_mutation/i);
    expect(migration).toMatch(/function public\.snapshot_competition_enrollment/i);
    expect(migration).toMatch(
      /from public\.competition_enrollments e[\s\S]+e\.competition_id = p_competition_id[\s\S]+e\.week_starts_on = p_week_starts_on/i,
    );
  });

  it("derives awards from canonical accepted sessions and accepted sharing", () => {
    expect(migration).toMatch(/from public\.laundry_sessions/i);
    expect(migration).toMatch(/public\.shared_session_members/i);
    expect(migration).toMatch(/qualifying_washer/i);
    expect(migration).toMatch(/score_eligible/i);
    expect(migration).toMatch(/review_state\s*<>\s*'accepted'/i);
    expect(migration).toMatch(/retracted_at\s+is\s+not\s+null/i);
    expect(migration).toMatch(/duplicate_of_session_id\s+is\s+not\s+null/i);
    expect(migration).toMatch(/shared[\s\S]+status\s*=\s*'accepted'/i);
    expect(migration).toMatch(/count\(\*\)[\s\S]+>\s*2/i);
    expect(migration).not.toMatch(
      /function public\.award_weekly_credit\([\s\S]*?p_hall_id uuid[\s\S]*?\)\s*returns/i,
    );
    expect(migration).not.toMatch(
      /function public\.award_weekly_credit\([\s\S]*?p_occurred_at timestamptz[\s\S]*?\)\s*returns/i,
    );
  });

  it("keeps score events append-only and computes shared ranks without a tie-breaker", () => {
    expect(migration).toMatch(/prevent_score_event_mutation/i);
    expect(migration).toMatch(/dense_rank\(\) over/i);
    expect(migration).toMatch(/credited_count::numeric\s*\/\s*eligible_count/i);
  });
});
