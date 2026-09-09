import { describe, expect, it, vi } from "vitest";

import {
  ENCOURAGEMENT_PRESETS,
  EncouragementService,
  evaluateEncouragementSend,
  isDueEncouragementCandidate,
  type DueEncouragementCandidate,
  type EncouragementRepository,
} from "@/lib/social/encouragements";
import { encouragementSendSchema, reportEncouragementSchema } from "@/lib/social/schemas";

const MAYA_ID = "11111111-1111-4111-8111-111111111111";
const NOAH_ID = "22222222-2222-4222-8222-222222222222";
const ENCOURAGEMENT_ID = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-09-08T12:00:00.000Z");

const candidate: DueEncouragementCandidate = {
  participantId: NOAH_ID,
  displayName: "Noah R.",
  acceptedFriend: true,
  sameHall: false,
  encouragementScope: "friends",
  reminderEnabled: true,
  reminderDays: 14,
  trackingState: "current",
  dueAt: "2026-09-08T11:00:00.000Z",
  blockedEitherDirection: false,
  mutedSender: false,
};

function repository(overrides: Partial<EncouragementRepository> = {}): EncouragementRepository {
  return {
    listReceived: vi.fn(async () => []),
    listDueCandidates: vi.fn(async () => [candidate]),
    sendAtomically: vi.fn(async () => ({
      kind: "sent",
      encouragement: {
        id: ENCOURAGEMENT_ID,
        senderId: MAYA_ID,
        recipientId: NOAH_ID,
        presetKey: "laundry_quest",
        createdAt: NOW.toISOString(),
        deliveryState: "delivered",
        privateModerationState: "not_reported",
      },
    })),
    setMutedAtomically: vi.fn(async () => ({ kind: "updated" })),
    reportAtomically: vi.fn(async () => ({ kind: "reported" })),
    ...overrides,
  };
}

describe("controlled encouragement validation", () => {
  it("accepts approved preset keys and never accepts free text or bulk recipients", () => {
    expect(
      encouragementSendSchema.parse({ recipientId: NOAH_ID, presetKey: "laundry_quest" }),
    ).toEqual({ recipientId: NOAH_ID, presetKey: "laundry_quest" });
    expect(
      encouragementSendSchema.safeParse({
        recipientId: NOAH_ID,
        presetKey: "laundry_quest",
        message: "custom message",
      }).success,
    ).toBe(false);
    expect(
      encouragementSendSchema.safeParse({
        recipientIds: [NOAH_ID],
        presetKey: "laundry_quest",
      }).success,
    ).toBe(false);
    expect(
      encouragementSendSchema.safeParse({ recipientId: NOAH_ID, presetKey: "insult" }).success,
    ).toBe(false);
  });

  it("uses only approved, non-shaming copy", () => {
    expect(ENCOURAGEMENT_PRESETS).toEqual({
      laundry_quest: "Laundry quest this week? You've got this.",
      shared_load: "Want to team up for a shared load?",
      hall_point: "Our hall could use one more participation point—no pressure.",
    });
  });

  it("accepts report categories without free-form report content", () => {
    expect(reportEncouragementSchema.parse({ category: "unwanted" })).toEqual({
      category: "unwanted",
    });
    expect(
      reportEncouragementSchema.safeParse({ category: "unwanted", details: "private note" }).success,
    ).toBe(false);
  });
});

describe("due reminder policy", () => {
  it("allows opted-in accepted friends and explicit same-hall opt-ins", () => {
    expect(isDueEncouragementCandidate(candidate, NOW)).toBe(true);
    expect(
      isDueEncouragementCandidate(
        {
          ...candidate,
          acceptedFriend: false,
          sameHall: true,
          encouragementScope: "hall",
        },
        NOW,
      ),
    ).toBe(true);
  });

  it.each(["unknown", "partial", "stale"] as const)(
    "never treats %s tracking as due even if a stale projection has dueAt",
    (trackingState) => {
      expect(isDueEncouragementCandidate({ ...candidate, trackingState }, NOW)).toBe(false);
    },
  );

  it("denies nonfriends, cross-hall users, disabled reminders, future due dates, and blocks", () => {
    expect(
      isDueEncouragementCandidate(
        { ...candidate, acceptedFriend: false, encouragementScope: "friends" },
        NOW,
      ),
    ).toBe(false);
    expect(
      isDueEncouragementCandidate(
        { ...candidate, acceptedFriend: false, sameHall: false, encouragementScope: "hall" },
        NOW,
      ),
    ).toBe(false);
    expect(isDueEncouragementCandidate({ ...candidate, reminderEnabled: false }, NOW)).toBe(false);
    expect(
      isDueEncouragementCandidate({ ...candidate, dueAt: "2026-09-08T13:00:00.000Z" }, NOW),
    ).toBe(false);
    expect(
      isDueEncouragementCandidate({ ...candidate, blockedEitherDirection: true }, NOW),
    ).toBe(false);
  });
});

describe("send limits", () => {
  const allowed = {
    blockedEitherDirection: false,
    allowedAudience: true,
    recipientMuted: false,
    lastPairSentAt: null,
    senderSentAt: [] as string[],
    now: NOW,
  };

  it("enforces a 72-hour pair cooldown and allows at the boundary", () => {
    expect(
      evaluateEncouragementSend({ ...allowed, lastPairSentAt: "2026-09-05T12:00:01.000Z" }),
    ).toMatchObject({ kind: "pair_cooldown" });
    expect(
      evaluateEncouragementSend({ ...allowed, lastPairSentAt: "2026-09-05T12:00:00.000Z" }),
    ).toEqual({ kind: "allowed" });
  });

  it("enforces five sends in the prior rolling 24 hours", () => {
    expect(
      evaluateEncouragementSend({
        ...allowed,
        senderSentAt: [
          "2026-09-08T11:00:00.000Z",
          "2026-09-08T10:00:00.000Z",
          "2026-09-08T09:00:00.000Z",
          "2026-09-08T08:00:00.000Z",
          "2026-09-08T07:00:00.000Z",
        ],
      }),
    ).toMatchObject({ kind: "sender_daily_limit" });
  });

  it("makes a bidirectional block win over all other denial reasons", () => {
    expect(
      evaluateEncouragementSend({
        ...allowed,
        blockedEitherDirection: true,
        allowedAudience: false,
        recipientMuted: true,
        lastPairSentAt: "2026-09-08T11:00:00.000Z",
        senderSentAt: Array(5).fill("2026-09-08T11:00:00.000Z"),
      }),
    ).toEqual({ kind: "blocked" });
  });
});

describe("encouragement service", () => {
  it("uses the transactional repository contract and returns an allowlisted DTO", async () => {
    const repo = repository();
    const service = new EncouragementService(repo, () => NOW);

    const result = await service.send(MAYA_ID, {
      recipientId: NOAH_ID,
      presetKey: "laundry_quest",
    });

    expect(repo.sendAtomically).toHaveBeenCalledWith({
      senderId: MAYA_ID,
      recipientId: NOAH_ID,
      presetKey: "laundry_quest",
      now: NOW,
      pairCooldownMs: 72 * 60 * 60 * 1000,
      senderWindowMs: 24 * 60 * 60 * 1000,
      senderLimit: 5,
    });
    expect(result).toEqual({
      id: ENCOURAGEMENT_ID,
      recipientId: NOAH_ID,
      presetKey: "laundry_quest",
      message: ENCOURAGEMENT_PRESETS.laundry_quest,
      sentAt: NOW.toISOString(),
      availableAgainAt: "2026-09-11T12:00:00.000Z",
    });
    expect(JSON.stringify(result)).not.toContain("privateModerationState");
    expect(JSON.stringify(result)).not.toContain("deliveryState");
  });

  it("rechecks and drops unknown, stale, and blocked candidates returned by search", async () => {
    const repo = repository({
      listDueCandidates: vi.fn(async () => [
        candidate,
        { ...candidate, participantId: MAYA_ID, trackingState: "unknown" },
        { ...candidate, participantId: ENCOURAGEMENT_ID, blockedEitherDirection: true },
      ]),
    });
    const service = new EncouragementService(repo, () => NOW);

    await expect(service.listDue(MAYA_ID)).resolves.toEqual([
      {
        participantId: NOAH_ID,
        displayName: "Noah R.",
        reason: "accepted_friend",
        reminderText: "No recorded wash in the last 14 days.",
        context: "Based on activity shared with pay2win.",
      },
    ]);
  });
});
