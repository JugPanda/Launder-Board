import {
  activityFingerprint,
  opaqueReferenceHash,
} from "@/lib/activities/deduplicate";
import type { ActivityInsert } from "@/lib/activities/model";
import { getNonqualifyingReason } from "@/lib/activities/qualification";
import { parseActivityCsv } from "@/lib/activities/csv";
import { FileLaundryProvider } from "@/lib/integrations/laundry/file-provider";

export type ImportDisposition = "ready" | "duplicate" | "nonqualifying" | "invalid";
export interface ActivityImportPreviewRow {
  rowNumber: number;
  disposition: ImportDisposition;
  reason: string | null;
  fingerprint: string | null;
  activity: ActivityInsert | null;
  issues: string[];
}
export interface ActivityImportPreview {
  source: "user_file" | "synthetic_demo";
  syntheticDemo: boolean;
  rows: ActivityImportPreviewRow[];
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
    qualifyingRows: number;
    nonqualifyingRows: number;
  };
}
export interface PreviewOptions {
  syntheticDemo: boolean;
  demoModeAuthorized?: boolean;
  rawImportId?: string | null;
  existingFingerprints?: ReadonlySet<string>;
}

export async function previewActivityCsv(
  csv: string,
  options: PreviewOptions,
): Promise<ActivityImportPreview> {
  if (options.syntheticDemo && options.demoModeAuthorized !== true) {
    throw new Error("demo_mode_not_authorized");
  }
  const provider = new FileLaundryProvider(options);
  const rawRows = parseActivityCsv(csv);
  const seen = new Set(options.existingFingerprints ?? []);
  const rows: ActivityImportPreviewRow[] = [];
  for (const [index, raw] of rawRows.entries()) {
    const normalized = await provider.normalize(raw);
    if (!normalized.ok) {
      rows.push({
        rowNumber: index + 2,
        disposition: "invalid",
        reason: "invalid",
        fingerprint: null,
        activity: null,
        issues: normalized.issues ?? ["Invalid activity"],
      });
      continue;
    }
    const fingerprint = activityFingerprint(normalized.value);
    const activity: ActivityInsert = {
      ...normalized.value,
      dedupeFingerprint: fingerprint,
      sourceRecordIdHash: opaqueReferenceHash(normalized.value.sourceRecordId),
      providerLocationRefHash: opaqueReferenceHash(normalized.value.providerLocationRef),
      providerMachineRefHash: opaqueReferenceHash(normalized.value.providerMachineRef),
    };
    const duplicate = seen.has(fingerprint);
    seen.add(fingerprint);
    const nonqualifying = getNonqualifyingReason(normalized.value);
    rows.push({
      rowNumber: index + 2,
      disposition: duplicate ? "duplicate" : nonqualifying ? "nonqualifying" : "ready",
      reason: duplicate ? "duplicate" : nonqualifying,
      fingerprint,
      activity,
      issues: [],
    });
  }
  return {
    source: options.syntheticDemo ? "synthetic_demo" : "user_file",
    syntheticDemo: options.syntheticDemo,
    rows,
    summary: {
      totalRows: rows.length,
      validRows: rows.filter((row) => row.activity !== null).length,
      invalidRows: rows.filter((row) => row.disposition === "invalid").length,
      duplicateRows: rows.filter((row) => row.disposition === "duplicate").length,
      qualifyingRows: rows.filter((row) => row.disposition === "ready").length,
      nonqualifyingRows: rows.filter((row) => row.disposition === "nonqualifying").length,
    },
  };
}

export interface ActivityInsertTarget {
  insert(activity: ActivityInsert): Promise<"inserted" | "duplicate">;
}

export async function confirmActivityPreview(
  preview: ActivityImportPreview,
  target: ActivityInsertTarget,
): Promise<{ inserted: number; duplicates: number; skippedInvalid: number }> {
  let inserted = 0;
  let duplicates = 0;
  let skippedInvalid = 0;
  for (const row of preview.rows) {
    if (!row.activity) {
      skippedInvalid += 1;
      continue;
    }
    if (row.disposition === "duplicate") {
      duplicates += 1;
      continue;
    }
    const result = await target.insert(row.activity);
    if (result === "inserted") inserted += 1;
    else duplicates += 1;
  }
  return { inserted, duplicates, skippedInvalid };
}
