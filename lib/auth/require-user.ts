import "server-only";

import type { JwtPayload } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";

export interface CurrentProfile {
  id: string;
  auth_user_id: string;
  display_name: string;
  public_slug: string | null;
  hall_id: string;
  active: boolean;
  visibility: "private" | "friends" | "public";
  directory_opt_in: boolean;
  activity_import_opt_in: boolean;
  public_stats_opt_in: boolean;
  public_hall_opt_in: boolean;
  encouragement_scope: "off" | "friends" | "hall";
  reminder_enabled: boolean;
  reminder_days: 7 | 14 | 21;
  onboarding_completed_at: string;
  deleted_at: null;
}

export class AuthenticationRequiredError extends Error {
  readonly status = 401;

  constructor() {
    super("Authentication required");
    this.name = "AuthenticationRequiredError";
  }
}

export class ActiveProfileRequiredError extends Error {
  readonly status = 403;

  constructor() {
    super("An active participant profile is required");
    this.name = "ActiveProfileRequiredError";
  }
}

type ParticipantClient = Awaited<ReturnType<typeof createClient>>;

export async function requireAuthenticatedUser(client?: ParticipantClient): Promise<{
  supabase: ParticipantClient;
  authUserId: string;
  claims: JwtPayload;
}> {
  const supabase = client ?? (await createClient());
  const { data, error } = await supabase.auth.getClaims();
  const authUserId = data?.claims.sub;

  if (error || !authUserId) {
    throw new AuthenticationRequiredError();
  }

  return { supabase, authUserId, claims: data.claims };
}

/** Authenticate and re-read current mutable profile status on every protected request. */
export async function requireUser(client?: ParticipantClient): Promise<{
  supabase: ParticipantClient;
  authUserId: string;
  claims: JwtPayload;
  profile: CurrentProfile;
}> {
  const authenticated = await requireAuthenticatedUser(client);
  const { data: profile, error } = await authenticated.supabase
    .from("profiles")
    .select(
      "id, auth_user_id, display_name, public_slug, hall_id, active, visibility, directory_opt_in, activity_import_opt_in, public_stats_opt_in, public_hall_opt_in, encouragement_scope, reminder_enabled, reminder_days, onboarding_completed_at, deleted_at",
    )
    .eq("auth_user_id", authenticated.authUserId)
    .eq("active", true)
    .is("deleted_at", null)
    .not("onboarding_completed_at", "is", null)
    .maybeSingle();

  if (error || !profile) {
    throw new ActiveProfileRequiredError();
  }

  return { ...authenticated, profile: profile as CurrentProfile };
}
