import type { z } from "zod";

import {
  activityIdSchema,
  activityRetractionRequestSchema,
  activityUpdateRequestSchema,
} from "@/lib/activities/api-validation";
import type { ActivityRecord } from "@/lib/activities/model";
import { correctActivity, retractActivity } from "@/lib/activities/corrections";
import {
  ActiveProfileRequiredError,
  AuthenticationRequiredError,
  requireUser,
} from "@/lib/auth/require-user";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: PRIVATE_HEADERS });
}

function toActivityRecord(row: Record<string, unknown>): ActivityRecord {
  return {
    id: row.id as string,
    profileId: row.profile_id as string,
    source: row.source as ActivityRecord["source"],
    sourceRecordIdHash: (row.source_record_id_hash as string | null) ?? null,
    dedupeFingerprint: row.dedupe_fingerprint as string,
    occurredAt: row.occurred_at as string,
    machineKind: row.machine_kind as ActivityRecord["machineKind"],
    cycleStatus: row.cycle_status as ActivityRecord["cycleStatus"],
    evidenceLevel: row.evidence_level as ActivityRecord["evidenceLevel"],
    providerLocationRefHash: (row.provider_location_ref_hash as string | null) ?? null,
    providerMachineRefHash: (row.provider_machine_ref_hash as string | null) ?? null,
    rawImportId: (row.raw_import_id as string | null) ?? null,
    syntheticDemo: row.synthetic_demo === true,
    retractedAt: (row.retracted_at as string | null) ?? null,
    retractionReason: (row.retraction_reason as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function errorResponse(error: unknown): Response {
  if (error instanceof AuthenticationRequiredError) {
    return json({ error: "authentication_required" }, 401);
  }
  if (error instanceof ActiveProfileRequiredError) {
    return json({ error: "active_profile_required" }, 403);
  }
  if (error instanceof Error) {
    const clientErrors = new Set([
      "activity_not_owned",
      "activity_retracted",
      "activity_already_retracted",
      "invalid_timestamp",
    ]);
    if (clientErrors.has(error.message) || error.name === "ZodError") {
      return json({ error: error.message }, 400);
    }
  }
  return json({ error: "activity_update_failed" }, 500);
}

async function readJson<T extends z.ZodType>(
  request: Request,
  schema: T,
  errorCode: string,
): Promise<z.output<T> | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: errorCode, issues: parsed.error.issues.map((issue) => issue.message) },
      400,
    );
  }
  return parsed.data;
}

async function ownedActivity(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  profileId: string,
  id: string,
): Promise<ActivityRecord | null> {
  const { data, error } = await supabase
    .from("laundry_activities")
    .select("*")
    .eq("id", id)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) throw error;
  return data ? toActivityRecord(data as Record<string, unknown>) : null;
}

type ActivityRouteContext = { params: Promise<{ id: string }> };
type AuthenticatedActivityId =
  | { response: Response }
  | (Awaited<ReturnType<typeof requireUser>> & { id: string });

async function authenticatedActivityId(
  context: ActivityRouteContext,
): Promise<AuthenticatedActivityId> {
  const authenticated = await requireUser();
  const parsedId = activityIdSchema.safeParse((await context.params).id);
  if (!parsedId.success) {
    return { response: json({ error: "invalid_activity_id" }, 400) } as const;
  }
  return { ...authenticated, id: parsedId.data };
}

export async function GET(_request: Request, context: ActivityRouteContext): Promise<Response> {
  try {
    const authenticated = await authenticatedActivityId(context);
    if ("response" in authenticated) return authenticated.response;
    const activity = await ownedActivity(
      authenticated.supabase,
      authenticated.profile.id,
      authenticated.id,
    );
    if (!activity) return json({ error: "activity_not_found" }, 404);
    return json({ activity });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: ActivityRouteContext): Promise<Response> {
  try {
    const authenticated = await authenticatedActivityId(context);
    if ("response" in authenticated) return authenticated.response;
    const input = await readJson(request, activityUpdateRequestSchema, "invalid_activity_update");
    if (input instanceof Response) return input;

    const activity = await ownedActivity(
      authenticated.supabase,
      authenticated.profile.id,
      authenticated.id,
    );
    if (!activity) return json({ error: "activity_not_found" }, 404);

    if (input.action === "retract") {
      retractActivity(activity, {
        actorProfileId: authenticated.profile.id,
        reason: input.reason,
      });
      const { data, error } = await authenticated.supabase.rpc("retract_laundry_activity", {
        p_activity_id: authenticated.id,
        p_reason: input.reason,
      });
      if (error) throw error;
      return json({ activity: data });
    }

    const correction = {
      ...(input.occurredAt !== undefined ? { occurredAt: input.occurredAt } : {}),
      ...(input.machineKind !== undefined ? { machineKind: input.machineKind } : {}),
      ...(input.cycleStatus !== undefined ? { cycleStatus: input.cycleStatus } : {}),
    };
    const validated = correctActivity(activity, correction, {
      actorProfileId: authenticated.profile.id,
      reason: input.reason,
    });
    const { data, error } = await authenticated.supabase.rpc("correct_laundry_activity", {
      p_activity_id: authenticated.id,
      p_reason: input.reason,
      p_occurred_at: correction.occurredAt ?? null,
      p_machine_kind:
        validated.activity.machineKind === activity.machineKind
          ? null
          : validated.activity.machineKind,
      p_cycle_status:
        validated.activity.cycleStatus === activity.cycleStatus
          ? null
          : validated.activity.cycleStatus,
    });
    if (error) throw error;
    return json({ activity: data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: ActivityRouteContext): Promise<Response> {
  try {
    const authenticated = await authenticatedActivityId(context);
    if ("response" in authenticated) return authenticated.response;
    const input = await readJson(
      request,
      activityRetractionRequestSchema,
      "invalid_activity_retraction",
    );
    if (input instanceof Response) return input;

    const activity = await ownedActivity(
      authenticated.supabase,
      authenticated.profile.id,
      authenticated.id,
    );
    if (!activity) return json({ error: "activity_not_found" }, 404);
    retractActivity(activity, {
      actorProfileId: authenticated.profile.id,
      reason: input.reason,
    });

    const { data, error } = await authenticated.supabase.rpc("retract_laundry_activity", {
      p_activity_id: authenticated.id,
      p_reason: input.reason,
    });
    if (error) throw error;
    return json({ activity: data });
  } catch (error) {
    return errorResponse(error);
  }
}
