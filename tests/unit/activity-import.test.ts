import { describe, expect, it } from "vitest";

import { confirmActivityPreview, previewActivityCsv } from "@/lib/activities/import";

const csv = [
  "source_record_id,occurred_at,machine_kind,cycle_status",
  "new-1,2026-09-08T14:00:00Z,washer,completed",
  "duplicate-1,2026-09-08T15:00:00Z,washer,completed",
  "refund-1,2026-09-08T16:00:00Z,washer,refunded",
  "dryer-1,2026-09-08T17:00:00Z,dryer,completed",
  "broken,,washer,completed",
].join("\n");

describe("CSV activity import", () => {
  it("normalizes a preview and explains duplicate/nonqualifying/invalid rows", async () => {
    const first = await previewActivityCsv(csv, { syntheticDemo: false });
    const duplicate = first.rows[1]?.fingerprint;
    expect(duplicate).toBeTruthy();

    const preview = await previewActivityCsv(csv, {
      syntheticDemo: false,
      existingFingerprints: new Set([duplicate!]),
    });

    expect(preview.summary).toEqual({
      totalRows: 5,
      validRows: 4,
      invalidRows: 1,
      duplicateRows: 1,
      qualifyingRows: 1,
      nonqualifyingRows: 2,
    });
    expect(preview.rows.map((row) => row.disposition)).toEqual([
      "ready",
      "duplicate",
      "nonqualifying",
      "nonqualifying",
      "invalid",
    ]);
    expect(preview.rows[2]?.reason).toBe("refunded");
    expect(preview.rows[3]?.reason).toBe("dryer_only");
  });

  it("confirms only valid nonduplicate records and is idempotent", async () => {
    const preview = await previewActivityCsv(csv, { syntheticDemo: false });
    const stored = new Set<string>();
    const first = await confirmActivityPreview(preview, {
      insert: async (activity) => {
        if (stored.has(activity.dedupeFingerprint)) return "duplicate";
        stored.add(activity.dedupeFingerprint);
        return "inserted";
      },
    });
    const second = await confirmActivityPreview(preview, {
      insert: async (activity) => {
        if (stored.has(activity.dedupeFingerprint)) return "duplicate";
        stored.add(activity.dedupeFingerprint);
        return "inserted";
      },
    });

    expect(first).toEqual({ inserted: 4, duplicates: 0, skippedInvalid: 1 });
    expect(second).toEqual({ inserted: 0, duplicates: 4, skippedInvalid: 1 });
    expect(stored.size).toBe(4);
  });

  it("requires an explicit server-authorized switch for synthetic mode", async () => {
    await expect(
      previewActivityCsv(csv, {
        syntheticDemo: true,
        demoModeAuthorized: false,
      }),
    ).rejects.toThrow("demo_mode_not_authorized");
  });
});
