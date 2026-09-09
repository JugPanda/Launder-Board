import { describe, expect, it } from "vitest";

import { getNonqualifyingReason, isQualifyingActivity } from "@/lib/activities/qualification";
import type { ActivityRecord } from "@/lib/activities/model";

const activity: ActivityRecord = {
  id: "activity-1",
  profileId: "profile-1",
  source: "manual",
  sourceRecordIdHash: null,
  dedupeFingerprint: "fingerprint",
  occurredAt: "2026-09-08T14:00:00.000Z",
  machineKind: "washer",
  cycleStatus: "reported",
  evidenceLevel: "self_reported",
  providerLocationRefHash: null,
  providerMachineRefHash: null,
  rawImportId: null,
  syntheticDemo: false,
  retractedAt: null,
  retractionReason: null,
  createdAt: "2026-09-08T14:01:00.000Z",
  updatedAt: "2026-09-08T14:01:00.000Z",
};

describe("activity qualification", () => {
  it("accepts reported or completed washer sessions", () => {
    expect(isQualifyingActivity(activity)).toBe(true);
    expect(isQualifyingActivity({ ...activity, cycleStatus: "completed" })).toBe(true);
  });

  it.each([
    [{ machineKind: "dryer" as const }, "dryer_only"],
    [{ cycleStatus: "failed" as const }, "failed"],
    [{ cycleStatus: "refunded" as const }, "refunded"],
    [{ cycleStatus: "started" as const }, "not_completed"],
    [{ retractedAt: "2026-09-08T15:00:00.000Z" }, "retracted"],
  ])("rejects nonqualifying activity %j", (change, reason) => {
    const candidate = { ...activity, ...change };
    expect(isQualifyingActivity(candidate)).toBe(false);
    expect(getNonqualifyingReason(candidate)).toBe(reason);
  });
});
