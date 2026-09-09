import { describe, expect, it } from "vitest";

import { activityFingerprint, findDuplicateActivities } from "@/lib/activities/deduplicate";
import type { NormalizedLaundryActivity } from "@/lib/integrations/laundry/types";

const base: NormalizedLaundryActivity = {
  source: "user_file",
  sourceRecordId: "source-42",
  occurredAt: "2026-09-08T14:00:00.000Z",
  machineKind: "washer",
  cycleStatus: "completed",
  evidenceLevel: "user_supplied",
  providerLocationRef: null,
  providerMachineRef: null,
  rawImportId: null,
  syntheticDemo: false,
};

describe("activity deduplication", () => {
  it("uses a stable opaque source ID identity when supplied", () => {
    const fingerprint = activityFingerprint(base);

    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(activityFingerprint({ ...base })).toBe(fingerprint);
    expect(activityFingerprint({ ...base, occurredAt: "2026-09-09T14:00:00.000Z" })).toBe(
      fingerprint,
    );
    expect(activityFingerprint({ ...base, source: "synthetic_demo" })).not.toBe(fingerprint);
  });

  it("falls back to stable normalized fields when no source ID exists", () => {
    const withoutId = { ...base, sourceRecordId: null };
    expect(activityFingerprint(withoutId)).toBe(activityFingerprint({ ...withoutId }));
    expect(activityFingerprint({ ...withoutId, machineKind: "dryer" })).not.toBe(
      activityFingerprint(withoutId),
    );
  });

  it("flags duplicates within the same import", () => {
    expect(findDuplicateActivities([base, { ...base }])).toEqual([false, true]);
  });
});
