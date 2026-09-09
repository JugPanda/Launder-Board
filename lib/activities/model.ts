import type {
  CycleStatus,
  EvidenceLevel,
  LaundrySource,
  MachineKind,
  NormalizedLaundryActivity,
} from "@/lib/integrations/laundry/types";

export interface ActivityRecord {
  id: string;
  profileId: string;
  source: LaundrySource;
  sourceRecordIdHash: string | null;
  dedupeFingerprint: string;
  occurredAt: string;
  machineKind: MachineKind;
  cycleStatus: CycleStatus;
  evidenceLevel: EvidenceLevel;
  providerLocationRefHash: string | null;
  providerMachineRefHash: string | null;
  rawImportId: string | null;
  syntheticDemo: boolean;
  retractedAt: string | null;
  retractionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityInsert extends NormalizedLaundryActivity {
  dedupeFingerprint: string;
  sourceRecordIdHash: string | null;
  providerLocationRefHash: string | null;
  providerMachineRefHash: string | null;
}

export interface ActivityAuditEvent {
  activityId: string;
  actorProfileId: string;
  action: "corrected" | "retracted";
  reason: string;
  before: ActivityRecord;
  after: ActivityRecord;
  createdAt: string;
}
