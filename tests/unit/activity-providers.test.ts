import { describe, expect, it } from "vitest";

import { CscLaundryProvider } from "@/lib/integrations/laundry/csc-provider";
import { FileLaundryProvider } from "@/lib/integrations/laundry/file-provider";
import { ManualLaundryProvider } from "@/lib/integrations/laundry/manual-provider";
import { getActivitySourceLabel } from "@/lib/integrations/laundry/types";

describe("laundry providers", () => {
  it("normalizes manual entries as self-reported", async () => {
    const provider = new ManualLaundryProvider();
    const result = await provider.normalize({
      occurredAt: "2026-09-08T14:00:00Z",
      machineKind: "washer",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        source: "manual",
        cycleStatus: "reported",
        evidenceLevel: "self_reported",
        syntheticDemo: false,
      },
    });
    if (result.ok) {
      expect(getActivitySourceLabel(result.value)).toBe("Self-reported");
    }
  });

  it("labels explicit simulated imports without claiming provider confirmation", async () => {
    const provider = new FileLaundryProvider({ syntheticDemo: true });
    const result = await provider.normalize({
      source_record_id: "sim-001",
      occurred_at: "2026-09-08T14:00:00Z",
      machine_kind: "washer",
      cycle_status: "completed",
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        source: "synthetic_demo",
        evidenceLevel: "user_supplied",
        syntheticDemo: true,
      },
    });
    if (result.ok) {
      expect(getActivitySourceLabel(result.value)).toBe("Simulated CSC-format demo");
    }
  });

  it("keeps CSC hard-disabled and never emits activities", async () => {
    const provider = new CscLaundryProvider("csc_go");

    await expect(provider.validateConnection()).resolves.toEqual({
      ok: false,
      error: "provider_not_configured",
    });
    await expect(provider.listActivities({})).resolves.toEqual({
      ok: false,
      error: "provider_not_configured",
    });
    await expect(provider.normalize({ anything: "including demo data" })).resolves.toEqual({
      ok: false,
      error: "provider_not_configured",
    });
  });
});
