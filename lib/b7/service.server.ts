import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  requireAuthenticatedUser,
  requireUser,
} from "@/lib/auth/require-user";
import {
  ApiPolicyError,
  type AuthenticateAccount,
  type AuthenticateParticipant,
  type B7Service,
  type HallLeaderboardRowSource,
  type LeaderboardSource,
  type ParticipantIdentity,
  type PrivacyInput,
  type PublicProfileSource,
} from "@/lib/b7/http";
import { createAdminClient } from "@/lib/supabase/admin.server";
import { createClient } from "@/lib/supabase/server";

const POLICY_VERSION = "2026-09-08";

type Client = SupabaseClient;
type ParticipantClientFactory = () => Promise<Client>;
type AdminClientFactory = () => Client;
type Row = Record<string, unknown>;

interface B7ServiceDependencies {
  createParticipantClient?: ParticipantClientFactory;
  createAdminClient?: AdminClientFactory;
}

function row(value: unknown): Row | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : null;
}

function requiredString(value: unknown): string {
  if (typeof value !== "string") throw new ApiPolicyError("INTERNAL_ERROR", 500);
  return value;
}

function requiredNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) throw new ApiPolicyError("INTERNAL_ERROR", 500);
  return parsed;
}

function requiredBoolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new ApiPolicyError("INTERNAL_ERROR", 500);
  return value;
}

function databaseFailure(code: string): ApiPolicyError {
  return new ApiPolicyError(code, 500);
}

function enrollmentFailure(error: { code?: string; message?: string }): ApiPolicyError {
  const message = error.message ?? "";
  if (error.code === "P0002" || /competition_(?:not_found|not_enrollable)/i.test(message)) {
    return new ApiPolicyError("COMPETITION_NOT_FOUND", 404);
  }
  if (error.code === "42501" || /active_profile_required/i.test(message)) {
    return new ApiPolicyError("ACTIVE_PROFILE_REQUIRED", 403);
  }
  if (/competition_(?:closed|paused)|enrollment_closed/i.test(message)) {
    return new ApiPolicyError("ENROLLMENT_CLOSED", 409);
  }
  return databaseFailure("ENROLLMENT_FAILED");
}

function privacyFromRow(value: unknown): PrivacyInput {
  const profile = row(value);
  if (!profile) throw databaseFailure("PRIVACY_UPDATE_FAILED");

  const reminderDays = requiredNumber(profile.reminder_days);
  if (reminderDays !== 7 && reminderDays !== 14 && reminderDays !== 21) {
    throw databaseFailure("PRIVACY_UPDATE_FAILED");
  }

  const visibility = requiredString(profile.visibility);
  if (visibility !== "private" && visibility !== "friends" && visibility !== "public") {
    throw databaseFailure("PRIVACY_UPDATE_FAILED");
  }

  const encouragementScope = requiredString(profile.encouragement_scope);
  if (
    encouragementScope !== "off" &&
    encouragementScope !== "friends" &&
    encouragementScope !== "hall"
  ) {
    throw databaseFailure("PRIVACY_UPDATE_FAILED");
  }

  return {
    visibility,
    directoryOptIn: requiredBoolean(profile.directory_opt_in),
    activityImportOptIn: requiredBoolean(profile.activity_import_opt_in),
    publicStatsOptIn: requiredBoolean(profile.public_stats_opt_in),
    publicHallOptIn: requiredBoolean(profile.public_hall_opt_in),
    encouragementScope,
    reminderEnabled: requiredBoolean(profile.reminder_enabled),
    reminderDays,
  };
}

async function currentProfileStillActive(admin: Client, profileId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .eq("active", true)
    .is("deleted_at", null)
    .not("onboarding_completed_at", "is", null)
    .maybeSingle();
  if (error) throw databaseFailure("PROFILE_LOOKUP_FAILED");
  return data !== null;
}

async function currentLeaderboardWeek(
  admin: Client,
  competitionId: string,
): Promise<string | null> {
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("competition_weeks")
    .select("week_starts_on")
    .eq("competition_id", competitionId)
    .lte("starts_at", now)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw databaseFailure("LEADERBOARD_LOOKUP_FAILED");
  const week = row(data);
  return week ? requiredString(week.week_starts_on) : null;
}

async function loadPublishableLeaderboard(
  admin: Client,
  competitionId: string,
): Promise<LeaderboardSource | null> {
  const { data: competitionData, error: competitionError } = await admin
    .from("competitions")
    .select("id, name")
    .eq("id", competitionId)
    .maybeSingle();
  if (competitionError) throw databaseFailure("LEADERBOARD_LOOKUP_FAILED");
  const competition = row(competitionData);
  if (!competition) return null;

  const weekStartsOn = await currentLeaderboardWeek(admin, competitionId);
  if (weekStartsOn === null) {
    return {
      competitionName: requiredString(competition.name),
      weekStartsOn: null,
      rows: [],
    };
  }

  const { data: resultData, error: resultError } = await admin
    .from("hall_week_results")
    .select("hall_id, eligible_count, credited_count, score, rank, publishable")
    .eq("competition_id", competitionId)
    .eq("week_starts_on", weekStartsOn)
    .eq("publishable", true)
    .not("rank", "is", null)
    .order("rank", { ascending: true });
  if (resultError) throw databaseFailure("LEADERBOARD_LOOKUP_FAILED");

  const resultRows = (resultData ?? []).map((value) => {
    const result = row(value);
    if (!result) throw databaseFailure("LEADERBOARD_LOOKUP_FAILED");
    return result;
  });
  const hallIds = [...new Set(resultRows.map((result) => requiredString(result.hall_id)))];

  const hallNames = new Map<string, string>();
  if (hallIds.length > 0) {
    const { data: hallData, error: hallError } = await admin
      .from("residence_halls")
      .select("id, name")
      .in("id", hallIds)
      .eq("active", true);
    if (hallError) throw databaseFailure("LEADERBOARD_LOOKUP_FAILED");
    for (const value of hallData ?? []) {
      const hall = row(value);
      if (hall) hallNames.set(requiredString(hall.id), requiredString(hall.name));
    }
  }

  const rows: HallLeaderboardRowSource[] = resultRows.flatMap((result) => {
    const hallName = hallNames.get(requiredString(result.hall_id));
    if (!hallName) return [];
    const publishable = requiredBoolean(result.publishable);
    return [
      {
        hallName,
        eligibleCount: requiredNumber(result.eligible_count),
        creditedCount: requiredNumber(result.credited_count),
        participationRate: requiredNumber(result.score),
        rank: requiredNumber(result.rank),
        minimumMet: publishable,
        isPublic: publishable,
      },
    ];
  });

  return {
    competitionName: requiredString(competition.name),
    weekStartsOn,
    rows,
  };
}

async function hasCurrentEnrollment(
  admin: Client,
  profileId: string,
  competitionId: string,
): Promise<boolean> {
  if (!(await currentProfileStillActive(admin, profileId))) return false;

  const weekStartsOn = await currentLeaderboardWeek(admin, competitionId);
  if (weekStartsOn === null) return false;

  const { data, error } = await admin
    .from("competition_enrollments")
    .select("week_starts_on")
    .eq("competition_id", competitionId)
    .eq("week_starts_on", weekStartsOn)
    .eq("participant_id", profileId)
    .eq("eligible", true)
    .eq("paused", false)
    .maybeSingle();
  if (error) throw databaseFailure("LEADERBOARD_LOOKUP_FAILED");
  return data !== null;
}

export class SupabaseB7Service implements B7Service {
  private readonly participantClient: ParticipantClientFactory;
  private readonly adminClient: AdminClientFactory;

  constructor(dependencies: B7ServiceDependencies = {}) {
    this.participantClient = dependencies.createParticipantClient ?? createClient;
    this.adminClient = dependencies.createAdminClient ?? createAdminClient;
  }

  async enroll(identity: ParticipantIdentity, competitionId: string) {
    const supabase = await this.participantClient();
    const { data, error } = await supabase
      .rpc("enroll_in_competition", { p_competition_id: competitionId })
      .single();
    if (error) throw enrollmentFailure(error);

    const enrollment = row(data);
    if (!enrollment || requiredString(enrollment.participant_id) !== identity.profileId) {
      throw databaseFailure("ENROLLMENT_FAILED");
    }

    return {
      competitionId: requiredString(enrollment.competition_id),
      hallId: requiredString(enrollment.hall_id),
      eligible: requiredBoolean(enrollment.eligible),
    };
  }

  async getParticipantLeaderboard(profileId: string, competitionId: string) {
    const admin = this.adminClient();
    if (!(await hasCurrentEnrollment(admin, profileId, competitionId))) {
      throw new ApiPolicyError("NOT_ENROLLED", 403);
    }

    const leaderboard = await loadPublishableLeaderboard(admin, competitionId);
    if (!leaderboard) throw new ApiPolicyError("COMPETITION_NOT_FOUND", 404);
    return leaderboard;
  }

  async getPublicProfile(slug: string): Promise<PublicProfileSource | null> {
    const admin = this.adminClient();
    const { data: initialData, error: initialError } = await admin
      .from("profiles")
      .select("id")
      .eq("public_slug", slug)
      .eq("active", true)
      .is("deleted_at", null)
      .eq("visibility", "public")
      .eq("public_stats_opt_in", true)
      .maybeSingle();
    if (initialError) throw databaseFailure("PUBLIC_PROFILE_LOOKUP_FAILED");
    const initial = row(initialData);
    if (!initial) return null;
    const profileId = requiredString(initial.id);

    const now = new Date().toISOString();
    const [creditsResult, weeksResult] = await Promise.all([
      admin
        .from("weekly_credits")
        .select("competition_id, week_starts_on")
        .eq("participant_id", profileId),
      admin
        .from("competition_weeks")
        .select("competition_id, week_starts_on")
        .lte("starts_at", now)
        .gt("ends_at", now),
    ]);
    if (creditsResult.error || weeksResult.error) {
      throw databaseFailure("PUBLIC_PROFILE_LOOKUP_FAILED");
    }

    const currentWeeks = new Set(
      (weeksResult.data ?? []).map((value) => {
        const week = row(value);
        if (!week) throw databaseFailure("PUBLIC_PROFILE_LOOKUP_FAILED");
        return `${requiredString(week.competition_id)}:${requiredString(week.week_starts_on)}`;
      }),
    );
    const creditedWeeks = new Set<string>();
    let weeklyPoints = 0;
    for (const value of creditsResult.data ?? []) {
      const credit = row(value);
      if (!credit) throw databaseFailure("PUBLIC_PROFILE_LOOKUP_FAILED");
      const weekStartsOn = requiredString(credit.week_starts_on);
      const key = `${requiredString(credit.competition_id)}:${weekStartsOn}`;
      creditedWeeks.add(weekStartsOn);
      if (currentWeeks.has(key)) weeklyPoints += 1;
    }

    // Re-read the authoritative consent row after aggregate reads so stale search
    // or an in-flight withdrawal can never be the basis of this response.
    const { data: finalData, error: finalError } = await admin
      .from("profiles")
      .select("id, display_name, hall_id, public_hall_opt_in")
      .eq("id", profileId)
      .eq("public_slug", slug)
      .eq("active", true)
      .is("deleted_at", null)
      .eq("visibility", "public")
      .eq("public_stats_opt_in", true)
      .maybeSingle();
    if (finalError) throw databaseFailure("PUBLIC_PROFILE_LOOKUP_FAILED");
    const profile = row(finalData);
    if (!profile) return null;

    let hallName: string | null = null;
    if (requiredBoolean(profile.public_hall_opt_in)) {
      const { data: hallData, error: hallError } = await admin
        .from("residence_halls")
        .select("name")
        .eq("id", requiredString(profile.hall_id))
        .eq("active", true)
        .maybeSingle();
      if (hallError) throw databaseFailure("PUBLIC_PROFILE_LOOKUP_FAILED");
      const hall = row(hallData);
      hallName = hall ? requiredString(hall.name) : null;
    }

    const activeWeeks = creditedWeeks.size;
    return {
      displayName: requiredString(profile.display_name),
      hallName,
      weeklyPoints,
      badges: [],
      activeWeekSummary: `${activeWeeks} active ${activeWeeks === 1 ? "week" : "weeks"}`,
    };
  }

  async getPublicLeaderboard(competitionId: string) {
    return loadPublishableLeaderboard(this.adminClient(), competitionId);
  }

  async updatePrivacy(identity: ParticipantIdentity, privacy: PrivacyInput) {
    const supabase = await this.participantClient();
    const { data, error } = await supabase
      .rpc("update_profile_consent", {
        p_visibility: privacy.visibility,
        p_directory_opt_in: privacy.directoryOptIn,
        p_activity_import_opt_in: privacy.activityImportOptIn,
        p_public_stats_opt_in: privacy.publicStatsOptIn,
        p_public_hall_opt_in: privacy.publicHallOptIn,
        p_encouragement_scope: privacy.encouragementScope,
        p_reminder_enabled: privacy.reminderEnabled,
        p_reminder_days: privacy.reminderDays,
        p_policy_version: POLICY_VERSION,
      })
      .single();
    if (error) throw databaseFailure("PRIVACY_UPDATE_FAILED");

    const profile = row(data);
    if (!profile || requiredString(profile.id) !== identity.profileId) {
      throw databaseFailure("PRIVACY_UPDATE_FAILED");
    }
    return privacyFromRow(profile);
  }

  async deleteAccount(): Promise<void> {
    const supabase = await this.participantClient();
    const { error: deletionError } = await supabase.rpc("delete_current_account");
    if (deletionError) throw databaseFailure("ACCOUNT_DELETION_FAILED");

    const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
    if (signOutError) throw databaseFailure("SIGN_OUT_FAILED");
  }
}

export const authenticateB7Participant: AuthenticateParticipant = async () => {
  const { authUserId, profile } = await requireUser();
  return {
    authUserId,
    profileId: profile.id,
    hallId: profile.hall_id,
  };
};

export const authenticateB7Account: AuthenticateAccount = async () => {
  const { authUserId, supabase } = await requireAuthenticatedUser();
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw new ApiPolicyError("PROFILE_LOOKUP_FAILED", 500);
  const profile = row(data);
  return { authUserId, profileId: profile ? requiredString(profile.id) : null };
};

export const b7Service: B7Service = new SupabaseB7Service();
