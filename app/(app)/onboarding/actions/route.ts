import { NextResponse } from "next/server";

import {
  AuthenticationRequiredError,
  requireAuthenticatedUser,
} from "@/lib/auth/require-user";
import { parseOnboardingFormData } from "@/lib/validation/profile";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  Expires: "0",
};

function redirectTo(request: Request, path: string, error?: string) {
  const destination = new URL(path, request.url);
  if (error) destination.searchParams.set("error", error);
  return NextResponse.redirect(destination, { status: 303, headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  try {
    const authenticated = await requireAuthenticatedUser();
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return redirectTo(request, "/onboarding", "Invalid onboarding request.");
    }

    let input;
    try {
      input = parseOnboardingFormData(formData);
    } catch {
      return redirectTo(request, "/onboarding", "Review the highlighted profile settings.");
    }

    const { data: existingProfile } = await authenticated.supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", authenticated.authUserId)
      .eq("active", true)
      .is("deleted_at", null)
      .not("onboarding_completed_at", "is", null)
      .maybeSingle();
    if (existingProfile) return redirectTo(request, "/dashboard");

    const { error } = await authenticated.supabase.rpc("complete_onboarding", {
      p_display_name: input.displayName,
      p_hall_invite_code: input.hallInviteCode,
      p_visibility: input.visibility,
      p_directory_opt_in: input.directoryOptIn,
      p_activity_import_opt_in: input.activityImportOptIn,
      p_public_stats_opt_in: input.publicStatsOptIn,
      p_public_hall_opt_in: input.publicHallOptIn,
      p_encouragement_scope: input.encouragementScope,
      p_reminder_enabled: input.reminderEnabled,
      p_reminder_days: input.reminderDays,
      p_policy_version: "2026-09-08",
    });

    if (error) {
      return redirectTo(
        request,
        "/onboarding",
        "That hall invite is invalid, expired, or no longer available.",
      );
    }

    return redirectTo(request, "/dashboard");
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      return redirectTo(request, "/sign-in", "Please sign in to continue.");
    }
    return redirectTo(request, "/onboarding", "Unable to complete onboarding.");
  }
}
