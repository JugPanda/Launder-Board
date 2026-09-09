import { activityFingerprint, opaqueReferenceHash } from "@/lib/activities/deduplicate";
import {
  ActiveProfileRequiredError,
  AuthenticationRequiredError,
  requireUser,
} from "@/lib/auth/require-user";
import { ManualLaundryProvider } from "@/lib/integrations/laundry/manual-provider";

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
  return json({ error: "activity_request_failed" }, 500);
}

export async function GET() {
  try {
    const { supabase, profile } = await requireUser();
    const { data, error } = await supabase
      .from("laundry_activities")
      .select("*")
      .eq("profile_id", profile.id)
      .order("occurred_at", { ascending: false });
    if (error) throw error;
    return json({ activities: data ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { supabase, profile } = await requireUser();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    const normalized = await new ManualLaundryProvider().normalize(body);
    if (!normalized.ok) {
      return json(
        { error: normalized.error, issues: normalized.issues ?? [] },
        400,
      );
    }

    const activity = normalized.value;
    const dedupeFingerprint = activityFingerprint(activity);
    const { data, error } = await supabase
      .from("laundry_activities")
      .insert({
        profile_id: profile.id,
        source: activity.source,
        source_record_id_hash: opaqueReferenceHash(activity.sourceRecordId),
        dedupe_fingerprint: dedupeFingerprint,
        occurred_at: activity.occurredAt,
        machine_kind: activity.machineKind,
        cycle_status: activity.cycleStatus,
        evidence_level: activity.evidenceLevel,
        provider_location_ref_hash: opaqueReferenceHash(activity.providerLocationRef),
        provider_machine_ref_hash: opaqueReferenceHash(activity.providerMachineRef),
        raw_import_id: activity.rawImportId,
        synthetic_demo: activity.syntheticDemo,
      })
      .select("*")
      .single();

    if (error?.code === "23505") {
      return json({ error: "duplicate_activity", dedupeFingerprint }, 409);
    }
    if (error) throw error;
    return json({ activity: data }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
