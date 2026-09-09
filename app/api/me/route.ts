import { NextResponse } from "next/server";

import {
  ActiveProfileRequiredError,
  AuthenticationRequiredError,
  requireUser,
  type CurrentProfile,
} from "@/lib/auth/require-user";
import { consentUpdateSchema } from "@/lib/validation/profile";

const RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  Expires: "0",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: RESPONSE_HEADERS });
}

function publicProfile(profile: CurrentProfile) {
  return {
    id: profile.id,
    displayName: profile.display_name,
    publicSlug: profile.public_slug,
    hallId: profile.hall_id,
    visibility: profile.visibility,
    directoryOptIn: profile.directory_opt_in,
    activityImportOptIn: profile.activity_import_opt_in,
    publicStatsOptIn: profile.public_stats_opt_in,
    publicHallOptIn: profile.public_hall_opt_in,
    encouragementScope: profile.encouragement_scope,
    reminderEnabled: profile.reminder_enabled,
    reminderDays: profile.reminder_days,
    onboardingCompletedAt: profile.onboarding_completed_at,
  };
}

function authError(error: unknown) {
  if (error instanceof AuthenticationRequiredError) return json({ error: error.message }, 401);
  if (error instanceof ActiveProfileRequiredError) return json({ error: error.message }, 403);
  return null;
}

export async function GET() {
  try {
    const { profile } = await requireUser();
    return json({ profile: publicProfile(profile) });
  } catch (error) {
    return authError(error) ?? json({ error: "Unable to load profile" }, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const { supabase } = await requireUser();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Request body must be valid JSON" }, 400);
    }

    const parsed = consentUpdateSchema.safeParse(body);
    if (!parsed.success) return json({ error: "Invalid profile settings" }, 400);

    const input = parsed.data;
    const { data: profile, error } = await supabase
      .rpc("update_profile_consent", {
        p_visibility: input.visibility,
        p_directory_opt_in: input.directoryOptIn,
        p_activity_import_opt_in: input.activityImportOptIn,
        p_public_stats_opt_in: input.publicStatsOptIn,
        p_public_hall_opt_in: input.publicHallOptIn,
        p_encouragement_scope: input.encouragementScope,
        p_reminder_enabled: input.reminderEnabled,
        p_reminder_days: input.reminderDays,
        p_policy_version: "2026-09-08",
      })
      .single();

    if (error || !profile) return json({ error: "Unable to update profile" }, 400);
    return json({ profile: publicProfile(profile as CurrentProfile) });
  } catch (error) {
    return authError(error) ?? json({ error: "Unable to update profile" }, 500);
  }
}
