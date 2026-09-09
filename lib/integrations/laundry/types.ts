export const LAUNDRY_SOURCES = [
  "manual",
  "user_file",
  "synthetic_demo",
  "cscpay",
  "csc_go",
] as const;
export const MACHINE_KINDS = ["washer", "dryer", "unknown"] as const;
export const CYCLE_STATUSES = [
  "reported",
  "started",
  "completed",
  "failed",
  "refunded",
  "unknown",
] as const;
export const EVIDENCE_LEVELS = [
  "self_reported",
  "user_supplied",
  "provider_confirmed",
] as const;

export type LaundrySource = (typeof LAUNDRY_SOURCES)[number];
export type MachineKind = (typeof MACHINE_KINDS)[number];
export type CycleStatus = (typeof CYCLE_STATUSES)[number];
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];
export type CscLaundrySource = Extract<LaundrySource, "cscpay" | "csc_go">;

export interface NormalizedLaundryActivity {
  source: LaundrySource;
  sourceRecordId: string | null;
  occurredAt: string;
  machineKind: MachineKind;
  cycleStatus: CycleStatus;
  providerLocationRef: string | null;
  providerMachineRef: string | null;
  evidenceLevel: EvidenceLevel;
  rawImportId: string | null;
  syntheticDemo: boolean;
}

export type ProviderErrorCode =
  | "provider_not_configured"
  | "invalid_activity"
  | "connection_failed";

export type ProviderResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ProviderErrorCode; issues?: string[] };

export const ACTIVITY_SOURCE_LABELS: Readonly<Record<LaundrySource, string>> = {
  manual: "Self-reported",
  user_file: "User-supplied record",
  synthetic_demo: "Simulated CSC-format demo",
  cscpay: "Provider-confirmed",
  csc_go: "Provider-confirmed",
};

export const EVIDENCE_LABELS: Readonly<Record<EvidenceLevel, string>> = {
  self_reported: "Self-reported",
  user_supplied: "User-supplied",
  provider_confirmed: "Provider-confirmed",
};

export function getActivitySourceLabel(
  activity: LaundrySource | Pick<NormalizedLaundryActivity, "source">,
): string {
  const source = typeof activity === "string" ? activity : activity.source;
  return ACTIVITY_SOURCE_LABELS[source];
}

export function getEvidenceLabel(level: EvidenceLevel): string {
  return EVIDENCE_LABELS[level];
}
