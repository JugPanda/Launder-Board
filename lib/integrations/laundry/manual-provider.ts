import { z } from "zod";

import {
  CONNECTED_RESULT,
  emptyActivityPage,
  type LaundryActivityPage,
  type LaundryActivityQuery,
  type LaundryProvider,
} from "@/lib/integrations/laundry/provider";
import {
  MACHINE_KINDS,
  type NormalizedLaundryActivity,
  type ProviderResult,
} from "@/lib/integrations/laundry/types";

const isoDateTime = z
  .string()
  .trim()
  .refine((value) => /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && Number.isFinite(Date.parse(value)), {
    message: "occurredAt must be an ISO timestamp with a timezone",
  })
  .transform((value) => new Date(value).toISOString());

export const manualActivityInputSchema = z
  .object({
    occurredAt: isoDateTime,
    machineKind: z.enum(MACHINE_KINDS).default("washer"),
  })
  .strict();

export type ManualActivityInput = z.input<typeof manualActivityInputSchema>;

export class ManualLaundryProvider implements LaundryProvider<unknown> {
  readonly id = "manual";

  async validateConnection() {
    return CONNECTED_RESULT;
  }

  async listActivities(
    query: LaundryActivityQuery,
  ): Promise<ProviderResult<LaundryActivityPage<unknown>>> {
    void query;
    return emptyActivityPage<unknown>();
  }

  async normalize(
    raw: unknown,
  ): Promise<ProviderResult<NormalizedLaundryActivity>> {
    const parsed = manualActivityInputSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "invalid_activity",
        issues: parsed.error.issues.map((issue) => issue.message),
      };
    }

    return {
      ok: true,
      value: {
        source: "manual",
        sourceRecordId: null,
        occurredAt: parsed.data.occurredAt,
        machineKind: parsed.data.machineKind,
        cycleStatus: "reported",
        providerLocationRef: null,
        providerMachineRef: null,
        evidenceLevel: "self_reported",
        rawImportId: null,
        syntheticDemo: false,
      },
    };
  }

  async disconnect() {
    return CONNECTED_RESULT;
  }
}
