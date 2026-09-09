import { z } from "zod";

import {
  CONNECTED_RESULT,
  emptyActivityPage,
  type LaundryActivityPage,
  type LaundryActivityQuery,
  type LaundryProvider,
} from "@/lib/integrations/laundry/provider";
import {
  CYCLE_STATUSES,
  MACHINE_KINDS,
  type NormalizedLaundryActivity,
  type ProviderResult,
} from "@/lib/integrations/laundry/types";

const optionalOpaqueRef = z
  .string()
  .trim()
  .max(256)
  .optional()
  .transform((value) => (value ? value : null));

const isoDateTime = z
  .string()
  .trim()
  .refine((value) => /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && Number.isFinite(Date.parse(value)), {
    message: "occurred_at must be an ISO timestamp with a timezone",
  })
  .transform((value) => new Date(value).toISOString());

export const fileActivityRowSchema = z.object({
  source_record_id: optionalOpaqueRef,
  occurred_at: isoDateTime,
  machine_kind: z.enum(MACHINE_KINDS),
  cycle_status: z.enum(CYCLE_STATUSES),
  provider_location_ref: optionalOpaqueRef,
  provider_machine_ref: optionalOpaqueRef,
});

export type FileActivityRow = z.input<typeof fileActivityRowSchema>;

export interface FileLaundryProviderOptions {
  syntheticDemo?: boolean;
  rawImportId?: string | null;
}

export class FileLaundryProvider implements LaundryProvider<unknown> {
  readonly id: "user_file" | "synthetic_demo";
  private readonly rawImportId: string | null;
  private readonly syntheticDemo: boolean;

  constructor(options: FileLaundryProviderOptions = {}) {
    this.syntheticDemo = options.syntheticDemo === true;
    this.id = this.syntheticDemo ? "synthetic_demo" : "user_file";
    this.rawImportId = options.rawImportId ?? null;
  }

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
    const parsed = fileActivityRowSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        ok: false,
        error: "invalid_activity",
        issues: parsed.error.issues.map((issue) => {
          const path = issue.path.join(".");
          return path ? `${path}: ${issue.message}` : issue.message;
        }),
      };
    }

    return {
      ok: true,
      value: {
        source: this.id,
        sourceRecordId: parsed.data.source_record_id,
        occurredAt: parsed.data.occurred_at,
        machineKind: parsed.data.machine_kind,
        cycleStatus: parsed.data.cycle_status,
        providerLocationRef: parsed.data.provider_location_ref,
        providerMachineRef: parsed.data.provider_machine_ref,
        evidenceLevel: "user_supplied",
        rawImportId: this.rawImportId,
        syntheticDemo: this.syntheticDemo,
      },
    };
  }

  async disconnect() {
    return CONNECTED_RESULT;
  }
}
