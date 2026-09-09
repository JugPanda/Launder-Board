import { z } from "zod";

import { CYCLE_STATUSES, MACHINE_KINDS } from "@/lib/integrations/laundry/types";

const zonedIsoDateTime = z
  .string()
  .trim()
  .refine(
    (value) => /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) && Number.isFinite(Date.parse(value)),
    "Timestamp must be ISO 8601 and include a timezone",
  )
  .transform((value) => new Date(value).toISOString());

const reasonSchema = z.string().trim().min(3).max(250);

export const activityIdSchema = z.string().uuid();

export const activityImportRequestSchema = z
  .object({
    action: z.enum(["preview", "confirm"]).default("preview"),
    csv: z.string().min(1).max(256 * 1024),
    fileName: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "File name contains control characters")
      .optional(),
    syntheticDemo: z.boolean().default(false),
  })
  .strict();

const correctionRequestSchema = z
  .object({
    action: z.literal("correct"),
    reason: reasonSchema,
    occurredAt: zonedIsoDateTime.optional(),
    machineKind: z.enum(MACHINE_KINDS).optional(),
    cycleStatus: z.enum(CYCLE_STATUSES).optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.occurredAt !== undefined ||
      value.machineKind !== undefined ||
      value.cycleStatus !== undefined,
    "No correction supplied",
  );

const retractRequestSchema = z
  .object({
    action: z.literal("retract"),
    reason: reasonSchema,
  })
  .strict();

export const activityUpdateRequestSchema = z.union([
  correctionRequestSchema,
  retractRequestSchema,
]);

export const activityRetractionRequestSchema = z
  .object({ reason: reasonSchema })
  .strict();

export type ActivityImportRequest = z.output<typeof activityImportRequestSchema>;
export type ActivityUpdateRequest = z.output<typeof activityUpdateRequestSchema>;
