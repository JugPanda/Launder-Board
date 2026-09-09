import type { ActivityRecord } from "@/lib/activities/model";
import type { NormalizedLaundryActivity } from "@/lib/integrations/laundry/types";

export type NonqualifyingReason =
  | "dryer_only"
  | "unknown_machine"
  | "failed"
  | "refunded"
  | "not_completed"
  | "retracted";

type QualifiableActivity = Pick<
  NormalizedLaundryActivity,
  "machineKind" | "cycleStatus"
> & { retractedAt?: ActivityRecord["retractedAt"] };

export function getNonqualifyingReason(
  activity: QualifiableActivity,
): NonqualifyingReason | null {
  if (activity.retractedAt) return "retracted";
  if (activity.machineKind === "dryer") return "dryer_only";
  if (activity.machineKind !== "washer") return "unknown_machine";
  if (activity.cycleStatus === "failed") return "failed";
  if (activity.cycleStatus === "refunded") return "refunded";
  if (!(["reported", "completed"] as const).includes(activity.cycleStatus as "reported" | "completed")) {
    return "not_completed";
  }
  return null;
}

export function isQualifyingActivity(activity: QualifiableActivity): boolean {
  return getNonqualifyingReason(activity) === null;
}
