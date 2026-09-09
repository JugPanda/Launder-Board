import { describe, expect, it } from "vitest";

import {
  canDiscoverParticipant,
  canEncourageParticipant,
  canExposeHall,
  canViewParticipantProfile,
  canViewReminderStatus,
  DEFAULT_PARTICIPANT_CONSENT,
  type ParticipantVisibilityTarget,
  type ParticipantVisibilityViewer,
} from "@/lib/permissions/participant-visibility";

const target: ParticipantVisibilityTarget = {
  profileId: "target",
  hallId: "hall-a",
  visibility: "private",
  directoryOptIn: false,
  publicStatsOptIn: false,
  publicHallOptIn: false,
  encouragementScope: "off",
  reminderEnabled: false,
  deletedAt: null,
};

const stranger: ParticipantVisibilityViewer = {
  profileId: "stranger",
  hallId: "hall-b",
  acceptedFriend: false,
  blocked: false,
};

function withTarget(overrides: Partial<ParticipantVisibilityTarget>) {
  return { ...target, ...overrides };
}

function withViewer(overrides: Partial<ParticipantVisibilityViewer>) {
  return { ...stranger, ...overrides };
}

describe("participant visibility matrix", () => {
  it("keeps every consent private/off by default", () => {
    expect(DEFAULT_PARTICIPANT_CONSENT).toEqual({
      visibility: "private",
      directoryOptIn: false,
      activityImportOptIn: false,
      publicStatsOptIn: false,
      publicHallOptIn: false,
      encouragementScope: "off",
      reminderEnabled: false,
      reminderDays: 14,
    });
  });

  it.each([
    ["anonymous", { profileId: null }, false],
    ["stranger", {}, false],
    ["accepted friend", { acceptedFriend: true }, true],
    ["blocked friend", { acceptedFriend: true, blocked: true }, false],
  ])("applies friends-only profile visibility for %s", (_label, viewer, expected) => {
    expect(
      canViewParticipantProfile(
        withViewer(viewer as Partial<ParticipantVisibilityViewer>),
        withTarget({ visibility: "friends", directoryOptIn: true }),
      ),
    ).toBe(expected);
  });

  it("always lets an active owner view their profile", () => {
    expect(
      canViewParticipantProfile(
        withViewer({ profileId: "target", blocked: true }),
        target,
      ),
    ).toBe(true);
  });

  it("denies all access to deleted profiles, including the former owner", () => {
    expect(
      canViewParticipantProfile(
        withViewer({ profileId: "target" }),
        withTarget({ deletedAt: "2026-09-08T00:00:00Z" }),
      ),
    ).toBe(false);
  });

  it("requires both public visibility and public-stats consent for anonymous viewing", () => {
    const anonymous = withViewer({ profileId: null });
    expect(
      canViewParticipantProfile(
        anonymous,
        withTarget({ visibility: "public", publicStatsOptIn: false }),
      ),
    ).toBe(false);
    expect(
      canViewParticipantProfile(
        anonymous,
        withTarget({ visibility: "public", publicStatsOptIn: true }),
      ),
    ).toBe(true);
  });

  it("requires directory consent in addition to relationship visibility", () => {
    const friend = withViewer({ acceptedFriend: true });
    expect(
      canDiscoverParticipant(
        friend,
        withTarget({ visibility: "friends", directoryOptIn: false }),
      ),
    ).toBe(false);
    expect(
      canDiscoverParticipant(
        friend,
        withTarget({ visibility: "friends", directoryOptIn: true }),
      ),
    ).toBe(true);
  });

  it("never exposes reminder status publicly", () => {
    expect(
      canViewReminderStatus(
        withViewer({ profileId: null }),
        withTarget({
          visibility: "public",
          publicStatsOptIn: true,
          reminderEnabled: true,
        }),
      ),
    ).toBe(false);
  });

  it("allows reminder status only to the owner or an accepted unblocked friend", () => {
    const optedIn = withTarget({ reminderEnabled: true });
    expect(canViewReminderStatus(withViewer({ profileId: "target" }), optedIn)).toBe(true);
    expect(canViewReminderStatus(withViewer({ acceptedFriend: true }), optedIn)).toBe(true);
    expect(
      canViewReminderStatus(withViewer({ acceptedFriend: true, blocked: true }), optedIn),
    ).toBe(false);
    expect(canViewReminderStatus(stranger, optedIn)).toBe(false);
  });

  it("allows encouragement only for friends or explicit same-hall opt-in", () => {
    expect(
      canEncourageParticipant(
        withViewer({ acceptedFriend: true }),
        withTarget({ encouragementScope: "friends", reminderEnabled: true }),
      ),
    ).toBe(true);
    expect(
      canEncourageParticipant(
        withViewer({ hallId: "hall-a" }),
        withTarget({ encouragementScope: "hall", reminderEnabled: true }),
      ),
    ).toBe(true);
    expect(
      canEncourageParticipant(
        withViewer({ hallId: "hall-b" }),
        withTarget({ encouragementScope: "hall", reminderEnabled: true }),
      ),
    ).toBe(false);
  });

  it("requires separate hall-sharing consent", () => {
    const publicTarget = withTarget({ visibility: "public", publicStatsOptIn: true });
    expect(canExposeHall(stranger, publicTarget)).toBe(false);
    expect(canExposeHall(stranger, { ...publicTarget, publicHallOptIn: true })).toBe(true);
    expect(canExposeHall(withViewer({ profileId: "target" }), publicTarget)).toBe(true);
  });
});
