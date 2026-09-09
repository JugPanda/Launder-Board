export const PROFILE_VISIBILITIES = ["private", "friends", "public"] as const;
export const ENCOURAGEMENT_SCOPES = ["off", "friends", "hall"] as const;
export const REMINDER_DAY_OPTIONS = [7, 14, 21] as const;

export type ProfileVisibility = (typeof PROFILE_VISIBILITIES)[number];
export type EncouragementScope = (typeof ENCOURAGEMENT_SCOPES)[number];
export type ReminderDays = (typeof REMINDER_DAY_OPTIONS)[number];

export const DEFAULT_PARTICIPANT_CONSENT = Object.freeze({
  visibility: "private" as const,
  directoryOptIn: false,
  activityImportOptIn: false,
  publicStatsOptIn: false,
  publicHallOptIn: false,
  encouragementScope: "off" as const,
  reminderEnabled: false,
  reminderDays: 14 as const,
});

export interface ParticipantVisibilityTarget {
  profileId: string;
  hallId: string | null;
  visibility: ProfileVisibility;
  directoryOptIn: boolean;
  publicStatsOptIn: boolean;
  publicHallOptIn: boolean;
  encouragementScope: EncouragementScope;
  reminderEnabled: boolean;
  deletedAt: string | null;
}

export interface ParticipantVisibilityViewer {
  profileId: string | null;
  hallId: string | null;
  acceptedFriend: boolean;
  blocked: boolean;
}

function isOwner(
  viewer: ParticipantVisibilityViewer,
  target: ParticipantVisibilityTarget,
): boolean {
  return viewer.profileId !== null && viewer.profileId === target.profileId;
}

function isActive(target: ParticipantVisibilityTarget): boolean {
  return target.deletedAt === null;
}

export function canViewParticipantProfile(
  viewer: ParticipantVisibilityViewer,
  target: ParticipantVisibilityTarget,
): boolean {
  if (!isActive(target)) return false;
  if (isOwner(viewer, target)) return true;
  if (viewer.blocked) return false;

  if (target.visibility === "public") {
    return target.publicStatsOptIn;
  }

  return target.visibility === "friends" && viewer.acceptedFriend;
}

export function canDiscoverParticipant(
  viewer: ParticipantVisibilityViewer,
  target: ParticipantVisibilityTarget,
): boolean {
  if (isOwner(viewer, target)) return isActive(target);
  return target.directoryOptIn && canViewParticipantProfile(viewer, target);
}

export function canViewReminderStatus(
  viewer: ParticipantVisibilityViewer,
  target: ParticipantVisibilityTarget,
): boolean {
  if (!isActive(target) || !target.reminderEnabled) return false;
  if (isOwner(viewer, target)) return true;
  return viewer.profileId !== null && viewer.acceptedFriend && !viewer.blocked;
}

export function canEncourageParticipant(
  viewer: ParticipantVisibilityViewer,
  target: ParticipantVisibilityTarget,
): boolean {
  if (!isActive(target) || !target.reminderEnabled || viewer.blocked) return false;
  if (isOwner(viewer, target) || viewer.profileId === null) return false;

  if (target.encouragementScope === "friends") {
    return viewer.acceptedFriend;
  }

  return (
    target.encouragementScope === "hall" &&
    viewer.hallId !== null &&
    target.hallId !== null &&
    viewer.hallId === target.hallId
  );
}

export function canExposeHall(
  viewer: ParticipantVisibilityViewer,
  target: ParticipantVisibilityTarget,
): boolean {
  if (!isActive(target)) return false;
  if (isOwner(viewer, target)) return true;
  return target.publicHallOptIn && canViewParticipantProfile(viewer, target);
}
