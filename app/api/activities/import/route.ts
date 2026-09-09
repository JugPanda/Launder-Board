import {
  confirmActivityPreview,
  previewActivityCsv,
  type ActivityImportPreview,
} from "@/lib/activities/import";
import {
  activityImportRequestSchema,
  type ActivityImportRequest,
} from "@/lib/activities/api-validation";
import { isSyntheticDemoModeEnabled } from "@/lib/activities/demo-mode.server";
import {
  ActiveProfileRequiredError,
  AuthenticationRequiredError,
  requireUser,
} from "@/lib/auth/require-user";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: PRIVATE_HEADERS });
}

function errorResponse(error: unknown): Response {
  if (error instanceof AuthenticationRequiredError) {
    return json({ error: "authentication_required" }, 401);
  }
  if (error instanceof ActiveProfileRequiredError) {
    return json({ error: "active_profile_required" }, 403);
  }
  if (error instanceof Error && error.message === "demo_mode_not_authorized") {
    return json({ error: error.message }, 403);
  }
  if (error instanceof Error && error.name === "ActivityCsvError") {
    return json({ error: "invalid_csv", message: error.message }, 400);
  }
  return json({ error: "activity_import_failed" }, 500);
}

async function readRequest(request: Request): Promise<ActivityImportRequest | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const parsed = activityImportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      {
        error: "invalid_import_request",
        issues: parsed.error.issues.map((issue) => issue.message),
      },
      400,
    );
  }
  return parsed.data;
}

async function existingFingerprints(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  profileId: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("laundry_activities")
    .select("dedupe_fingerprint")
    .eq("profile_id", profileId);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.dedupe_fingerprint));
}

export async function POST(request: Request) {
  try {
    const { supabase, profile } = await requireUser();
    if (!profile.activity_import_opt_in) {
      return json({ error: "activity_import_opt_in_required" }, 403);
    }

    const body = await readRequest(request);
    if (body instanceof Response) return body;
    const syntheticDemo = body.syntheticDemo;
    const demoModeAuthorized = !syntheticDemo || isSyntheticDemoModeEnabled();
    const fingerprints = await existingFingerprints(supabase, profile.id);

    if (body.action === "preview") {
      const preview = await previewActivityCsv(body.csv, {
        syntheticDemo,
        demoModeAuthorized,
        existingFingerprints: fingerprints,
      });
      return json({ preview });
    }

    const { data: importRecord, error: importError } = await supabase
      .from("activity_imports")
      .insert({
        profile_id: profile.id,
        source: syntheticDemo ? "synthetic_demo" : "user_file",
        original_file_name: body.fileName ?? null,
        storage_visibility: "private",
        cleanup_due_at: new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString(),
        original_deleted_at: new Date().toISOString(),
        cleanup_required: false,
        status: "processing",
      })
      .select("id")
      .single();
    if (importError || !importRecord) throw importError ?? new Error("activity_import_not_created");

    const preview: ActivityImportPreview = await previewActivityCsv(body.csv, {
      syntheticDemo,
      demoModeAuthorized,
      rawImportId: importRecord.id,
      existingFingerprints: fingerprints,
    });
    const result = await confirmActivityPreview(preview, {
      insert: async (activity) => {
        const { error } = await supabase.from("laundry_activities").insert({
          profile_id: profile.id,
          source: activity.source,
          source_record_id_hash: activity.sourceRecordIdHash,
          dedupe_fingerprint: activity.dedupeFingerprint,
          occurred_at: activity.occurredAt,
          machine_kind: activity.machineKind,
          cycle_status: activity.cycleStatus,
          evidence_level: activity.evidenceLevel,
          provider_location_ref_hash: activity.providerLocationRefHash,
          provider_machine_ref_hash: activity.providerMachineRefHash,
          raw_import_id: importRecord.id,
          synthetic_demo: activity.syntheticDemo,
        });
        if (error?.code === "23505") return "duplicate";
        if (error) throw error;
        return "inserted";
      },
    });

    if (preview.rows.length > 0) {
      const { error: rowsError } = await supabase.from("activity_import_rows").insert(
        preview.rows.map((row) => ({
          import_id: importRecord.id,
          profile_id: profile.id,
          row_number: row.rowNumber,
          disposition: row.disposition,
          reason: row.reason,
          dedupe_fingerprint: row.fingerprint,
          issues: row.issues,
        })),
      );
      if (rowsError) throw rowsError;
    }

    const summary = { ...preview.summary, ...result };
    const { error: updateError } = await supabase
      .from("activity_imports")
      .update({ status: "completed", summary, completed_at: new Date().toISOString() })
      .eq("id", importRecord.id)
      .eq("profile_id", profile.id);
    if (updateError) throw updateError;

    return json({ importId: importRecord.id, preview, result }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
