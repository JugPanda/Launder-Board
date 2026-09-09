import { describe, expect, it } from "vitest";

import {
  activityIdSchema,
  activityImportRequestSchema,
  activityUpdateRequestSchema,
  activityRetractionRequestSchema,
} from "@/lib/activities/api-validation";

describe("activity API validation", () => {
  it("accepts only UUID activity identifiers", () => {
    expect(activityIdSchema.safeParse("4f5ca021-0d8a-45df-a270-3f6440ae45c9").success).toBe(true);
    expect(activityIdSchema.safeParse("activity-1").success).toBe(false);
  });

  it("strictly validates import requests", () => {
    expect(
      activityImportRequestSchema.parse({
        action: "preview",
        csv: "occurred_at,machine_kind,cycle_status",
        fileName: "activity.csv",
        syntheticDemo: false,
      }),
    ).toMatchObject({ action: "preview", syntheticDemo: false });
    expect(
      activityImportRequestSchema.safeParse({
        action: "preview",
        csv: "x",
        unexpected: true,
      }).success,
    ).toBe(false);
    expect(activityImportRequestSchema.safeParse({ action: "confirm", csv: "" }).success).toBe(false);
  });

  it("requires a real correction and rejects unknown fields", () => {
    expect(
      activityUpdateRequestSchema.safeParse({
        action: "correct",
        reason: "Wrong machine selected",
        machineKind: "dryer",
      }).success,
    ).toBe(true);
    expect(
      activityUpdateRequestSchema.safeParse({
        action: "correct",
        reason: "Wrong machine selected",
      }).success,
    ).toBe(false);
    expect(
      activityUpdateRequestSchema.safeParse({
        action: "retract",
        reason: "Imported wrong record",
        machineKind: "washer",
      }).success,
    ).toBe(false);
  });

  it("uses a strict reason-only payload for DELETE retraction", () => {
    expect(activityRetractionRequestSchema.safeParse({ reason: "Imported wrong record" }).success).toBe(true);
    expect(
      activityRetractionRequestSchema.safeParse({
        reason: "Imported wrong record",
        hardDelete: true,
      }).success,
    ).toBe(false);
  });
});
