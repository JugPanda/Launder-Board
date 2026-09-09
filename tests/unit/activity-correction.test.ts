import { describe, expect, it } from "vitest";

import { correctActivity, retractActivity } from "@/lib/activities/corrections";
import type { ActivityRecord } from "@/lib/activities/model";

const original: ActivityRecord = {
  id: "activity-1",
  profileId: "profile-1",
  source: "user_file",
  sourceRecordIdHash: "source-hash",
  dedupeFingerprint: "dedupe-hash",
  occurredAt: "2026-09-08T14:00:00.000Z",
  machineKind: "washer",
  cycleStatus: "completed",
  evidenceLevel: "user_supplied",
  providerLocationRefHash: null,
  providerMachineRefHash: null,
  rawImportId: "import-1",
  syntheticDemo: false,
  retractedAt: null,
  retractionReason: null,
  createdAt: "2026-09-08T14:01:00.000Z",
  updatedAt: "2026-09-08T14:01:00.000Z",
};

describe("activity correction and retraction audit semantics", () => {
  it("records before/after state without changing provenance or identity", () => {
    const result = correctActivity(
      original,
      { occurredAt: "2026-09-08T14:30:00Z", machineKind: "dryer" },
      { actorProfileId: "profile-1", reason: "Wrong machine selected", now: "2026-09-08T15:00:00Z" },
    );

    expect(result.activity).toMatchObject({
      occurredAt: "2026-09-08T14:30:00.000Z",
      machineKind: "dryer",
      source: original.source,
      evidenceLevel: original.evidenceLevel,
      dedupeFingerprint: original.dedupeFingerprint,
    });
    expect(result.auditEvent).toMatchObject({
      action: "corrected",
      actorProfileId: "profile-1",
      before: { machineKind: "washer" },
      after: { machineKind: "dryer" },
    });
  });

  it("retracts rather than deletes and preserves the prior record in its audit event", () => {
    const result = retractActivity(original, {
      actorProfileId: "profile-1",
      reason: "Imported wrong record",
      now: "2026-09-08T15:00:00Z",
    });

    expect(result.activity.retractedAt).toBe("2026-09-08T15:00:00.000Z");
    expect(result.auditEvent.action).toBe("retracted");
    expect(result.auditEvent.before).toEqual(original);
  });
});
