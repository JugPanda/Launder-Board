import { describe, expect, it, vi } from "vitest";

import { normalizeUploadedActivityCsv } from "@/lib/activities/upload";

describe("uploaded activity originals", () => {
  it("marks originals private, adds a 24-hour cleanup backstop, and deletes after normalization", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const startedAt = new Date("2026-09-08T12:00:00Z");
    const result = await normalizeUploadedActivityCsv(
      {
        csv: "source_record_id,occurred_at,machine_kind,cycle_status\nrow-1,2026-09-08T10:00:00Z,washer,completed",
        storageKey: "profile/import.csv",
        startedAt,
        syntheticDemo: false,
      },
      { remove },
    );

    expect(remove).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith("profile/import.csv");
    expect(result.originalStorageVisibility).toBe("private");
    expect(result.originalDeletedAt).toBeTruthy();
    expect(result.cleanupDueAt).toBe("2026-09-09T12:00:00.000Z");
  });

  it("does not delete a source that failed normalization", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    await expect(
      normalizeUploadedActivityCsv(
        {
          csv: "not,the,required,headers\n1,2,3,4",
          storageKey: "profile/bad.csv",
          startedAt: new Date("2026-09-08T12:00:00Z"),
          syntheticDemo: false,
        },
        { remove },
      ),
    ).rejects.toThrow();
    expect(remove).not.toHaveBeenCalled();
  });
});
