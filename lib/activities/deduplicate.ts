import { createHash } from "node:crypto";

import type { NormalizedLaundryActivity } from "@/lib/integrations/laundry/types";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function opaqueReferenceHash(value: string | null | undefined): string | null {
  return value ? sha256(value) : null;
}

export function activityFingerprint(activity: NormalizedLaundryActivity): string {
  const identity = activity.sourceRecordId
    ? `source-id:${activity.sourceRecordId.trim()}`
    : [
        "normalized",
        new Date(activity.occurredAt).toISOString(),
        activity.machineKind,
        activity.cycleStatus,
        activity.providerLocationRef ?? "",
        activity.providerMachineRef ?? "",
      ].join("|");
  return sha256(`${activity.source}|${identity}`);
}

export function findDuplicateActivities(
  activities: readonly NormalizedLaundryActivity[],
  existing: ReadonlySet<string> = new Set(),
): boolean[] {
  const seen = new Set(existing);
  return activities.map((activity) => {
    const fingerprint = activityFingerprint(activity);
    if (seen.has(fingerprint)) return true;
    seen.add(fingerprint);
    return false;
  });
}
