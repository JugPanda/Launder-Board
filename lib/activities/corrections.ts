import { z } from "zod";

import type { ActivityAuditEvent, ActivityRecord } from "@/lib/activities/model";
import { CYCLE_STATUSES, MACHINE_KINDS } from "@/lib/integrations/laundry/types";

const correctionSchema = z
  .object({
    occurredAt: z.string().optional(),
    machineKind: z.enum(MACHINE_KINDS).optional(),
    cycleStatus: z.enum(CYCLE_STATUSES).optional(),
  })
  .strict()
  .refine((value) => Object.values(value).some((field) => field !== undefined), "No correction supplied");

interface AuditContext {
  actorProfileId: string;
  reason: string;
  now?: string;
}

function timestamp(value = new Date().toISOString()): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("invalid_timestamp");
  return parsed.toISOString();
}

function assertOwner(activity: ActivityRecord, actorProfileId: string) {
  if (activity.profileId !== actorProfileId) throw new Error("activity_not_owned");
}

function reason(value: string): string {
  const parsed = z.string().trim().min(3).max(250).parse(value);
  return parsed;
}

export function correctActivity(
  activity: ActivityRecord,
  correction: z.input<typeof correctionSchema>,
  context: AuditContext,
): { activity: ActivityRecord; auditEvent: ActivityAuditEvent } {
  assertOwner(activity, context.actorProfileId);
  if (activity.retractedAt) throw new Error("activity_retracted");
  const parsed = correctionSchema.parse(correction);
  const now = timestamp(context.now);
  const updated: ActivityRecord = {
    ...activity,
    ...(parsed.occurredAt ? { occurredAt: timestamp(parsed.occurredAt) } : {}),
    ...(parsed.machineKind ? { machineKind: parsed.machineKind } : {}),
    ...(parsed.cycleStatus ? { cycleStatus: parsed.cycleStatus } : {}),
    updatedAt: now,
  };
  return {
    activity: updated,
    auditEvent: {
      activityId: activity.id,
      actorProfileId: context.actorProfileId,
      action: "corrected",
      reason: reason(context.reason),
      before: activity,
      after: updated,
      createdAt: now,
    },
  };
}

export function retractActivity(
  activity: ActivityRecord,
  context: AuditContext,
): { activity: ActivityRecord; auditEvent: ActivityAuditEvent } {
  assertOwner(activity, context.actorProfileId);
  if (activity.retractedAt) throw new Error("activity_already_retracted");
  const now = timestamp(context.now);
  const why = reason(context.reason);
  const updated = { ...activity, retractedAt: now, retractionReason: why, updatedAt: now };
  return {
    activity: updated,
    auditEvent: {
      activityId: activity.id,
      actorProfileId: context.actorProfileId,
      action: "retracted",
      reason: why,
      before: activity,
      after: updated,
      createdAt: now,
    },
  };
}
