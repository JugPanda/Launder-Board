import { describe, expect, it, vi } from "vitest";

import {
  buildHallResultProjection,
  buildParticipantProjection,
  coalesceNewestJobs,
  processSearchOutbox,
  toDayEpoch,
  type SearchIndexWriter,
  type SearchOutboxRepository,
} from "@/lib/typesense/sync";

describe("Typesense projection and outbox sync", () => {
  it("coarsens timestamps to UTC day epochs and strips private source fields", () => {
    expect(toDayEpoch("2026-09-08T22:41:19.000Z")).toBe(1_788_825_600);

    const document = buildParticipantProjection({
      id: "profile-1",
      display_name: "Maya",
      tracking_state: "current",
      activity_anchor_at: "2026-09-08T22:41:19.000Z",
      reminder_due_at: "2026-09-15T08:12:00.000Z",
      data_fresh_through_at: "2026-09-09T04:00:00.000Z",
      projection_version: 12n,
      email: "never@index.test",
      room: "404",
      exact_machine_location: "basement",
    });

    expect(document).toEqual({
      id: "profile-1",
      display_name: "Maya",
      tracking_state: "current",
      activity_anchor_day: 1_788_825_600,
      reminder_due_day: 1_789_430_400,
      data_fresh_through_day: 1_788_912_000,
      projection_version: 12,
    });
    expect(JSON.stringify(document)).not.toMatch(/email|room|machine|location/i);
  });

  it("builds only allowlisted hall aggregate fields", () => {
    expect(
      buildHallResultProjection({
        id: "result-1",
        competition_id: "competition-1",
        week_start: "2026-09-07T04:00:00.000Z",
        hall_id: "hall-1",
        hall_name: "Maple Hall",
        eligible_count: 6,
        credited_count: 4,
        participation_rate: 66.67,
        rank: 1,
        minimum_met: true,
        is_public: true,
        projection_version: 15n,
        internal_notes: "private",
      }),
    ).toEqual({
      id: "result-1",
      competition_id: "competition-1",
      week_start_day: 1_788_739_200,
      hall_id: "hall-1",
      hall_name: "Maple Hall",
      eligible_count: 6,
      credited_count: 4,
      participation_rate: 66.67,
      rank: 1,
      minimum_met: true,
      is_public: true,
      projection_version: 15,
    });
  });

  it("coalesces out-of-order jobs to the newest version with delete winning ties", () => {
    expect(
      coalesceNewestJobs([
        { entity_type: "participant", entity_id: "p1", operation: "upsert", projection_version: 2n },
        { entity_type: "participant", entity_id: "p1", operation: "upsert", projection_version: 1n },
        { entity_type: "participant", entity_id: "p1", operation: "delete", projection_version: 3n },
        { entity_type: "hall_result", entity_id: "h1", operation: "upsert", projection_version: 8n },
        { entity_type: "hall_result", entity_id: "h1", operation: "delete", projection_version: 8n },
      ]),
    ).toEqual([
      { entity_type: "participant", entity_id: "p1", operation: "delete", projection_version: 3n },
      { entity_type: "hall_result", entity_id: "h1", operation: "delete", projection_version: 8n },
    ]);
  });

  it("turns a stale upsert into only a delete when PostgreSQL says withdrawn", async () => {
    const jobs = [
      { entity_type: "participant" as const, entity_id: "p1", operation: "upsert" as const, projection_version: 1n },
      { entity_type: "participant" as const, entity_id: "p1", operation: "delete" as const, projection_version: 3n },
      { entity_type: "participant" as const, entity_id: "p1", operation: "upsert" as const, projection_version: 2n },
    ];
    const repository: SearchOutboxRepository = {
      claim: vi.fn().mockResolvedValue(jobs),
      loadCurrentProjection: vi.fn().mockResolvedValue({
        operation: "delete",
        projection_version: 3n,
      }),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
    };
    const writer: SearchIndexWriter = {
      upsert: vi.fn(),
      delete: vi.fn(),
    };

    await expect(processSearchOutbox(repository, writer, 10)).resolves.toEqual({
      processed: 1,
      succeeded: 1,
      failed: 0,
    });
    expect(writer.delete).toHaveBeenCalledWith("participant", "p1");
    expect(writer.upsert).not.toHaveBeenCalled();
    expect(repository.markCompleted).toHaveBeenCalledWith(jobs[1]);
  });

  it("records an outage for retry and never substitutes database search", async () => {
    const job = {
      entity_type: "hall_result" as const,
      entity_id: "h1",
      operation: "upsert" as const,
      projection_version: 9n,
    };
    const repository: SearchOutboxRepository = {
      claim: vi.fn().mockResolvedValue([job]),
      loadCurrentProjection: vi.fn().mockResolvedValue({
        operation: "upsert",
        projection_version: 9n,
        document: { id: "h1", projection_version: 9 },
      }),
      markCompleted: vi.fn(),
      markFailed: vi.fn(),
    };
    const writer: SearchIndexWriter = {
      upsert: vi.fn().mockRejectedValue(new Error("Typesense unavailable")),
      delete: vi.fn(),
    };

    await expect(processSearchOutbox(repository, writer, 10)).resolves.toEqual({
      processed: 1,
      succeeded: 0,
      failed: 1,
    });
    expect(repository.markFailed).toHaveBeenCalledWith(job, expect.any(Error));
    expect(repository.markCompleted).not.toHaveBeenCalled();
  });
});
