import { describe, expect, it } from "vitest";

import {
  HALL_RESULTS_ALIAS,
  HALL_RESULTS_COLLECTION,
  PARTICIPANTS_ALIAS,
  PARTICIPANTS_COLLECTION,
  hallResultsSchema,
  participantsSchema,
} from "@/lib/typesense/schemas";

describe("Typesense minimized schemas", () => {
  it("uses versioned collections behind stable aliases", () => {
    expect(PARTICIPANTS_COLLECTION).toBe("participants_v1");
    expect(PARTICIPANTS_ALIAS).toBe("participants");
    expect(HALL_RESULTS_COLLECTION).toBe("hall_results_v1");
    expect(HALL_RESULTS_ALIAS).toBe("hall_results");
  });

  it("stores only allowlisted participant search fields", () => {
    expect(participantsSchema.fields.map((field) => field.name)).toEqual([
      "id",
      "display_name",
      "tracking_state",
      "activity_anchor_day",
      "reminder_due_day",
      "data_fresh_through_day",
      "projection_version",
    ]);
    expect(participantsSchema.fields).toContainEqual(
      expect.objectContaining({ name: "projection_version", type: "int64" }),
    );
    expect(JSON.stringify(participantsSchema)).not.toMatch(
      /email|room|price|receipt|machine|location|report|friend/i,
    );
  });

  it("stores only publishable hall aggregates and a bigint version", () => {
    expect(hallResultsSchema.fields.map((field) => field.name)).toEqual([
      "id",
      "competition_id",
      "week_start_day",
      "hall_id",
      "hall_name",
      "eligible_count",
      "credited_count",
      "participation_rate",
      "rank",
      "minimum_met",
      "is_public",
      "projection_version",
    ]);
    expect(hallResultsSchema.fields).toContainEqual(
      expect.objectContaining({ name: "projection_version", type: "int64" }),
    );
  });
});
