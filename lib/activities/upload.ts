import { previewActivityCsv, type ActivityImportPreview } from "@/lib/activities/import";

const DAY_MS = 24 * 60 * 60 * 1_000;

export interface PrivateUploadStorage {
  remove(storageKey: string): Promise<void>;
}

export interface UploadedActivityCsv {
  csv: string;
  storageKey: string;
  startedAt?: Date;
  syntheticDemo: boolean;
  demoModeAuthorized?: boolean;
  rawImportId?: string | null;
}

export interface NormalizedUpload {
  preview: ActivityImportPreview;
  originalStorageVisibility: "private";
  cleanupDueAt: string;
  originalDeletedAt: string | null;
  cleanupRequired: boolean;
}

export async function normalizeUploadedActivityCsv(
  upload: UploadedActivityCsv,
  storage: PrivateUploadStorage,
): Promise<NormalizedUpload> {
  const startedAt = upload.startedAt ?? new Date();
  const preview = await previewActivityCsv(upload.csv, upload);
  const cleanupDueAt = new Date(startedAt.getTime() + DAY_MS).toISOString();
  try {
    await storage.remove(upload.storageKey);
    return {
      preview,
      originalStorageVisibility: "private",
      cleanupDueAt,
      originalDeletedAt: new Date().toISOString(),
      cleanupRequired: false,
    };
  } catch {
    return {
      preview,
      originalStorageVisibility: "private",
      cleanupDueAt,
      originalDeletedAt: null,
      cleanupRequired: true,
    };
  }
}
