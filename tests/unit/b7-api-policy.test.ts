import { describe, expect, it, vi } from "vitest";

import {
  ApiPolicyError,
  createAccountHandler,
  createCompetitionHandlers,
  createPrivacyHandler,
  createPublicHandlers,
  type B7Service,
  type ParticipantIdentity,
} from "@/lib/b7/http";

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const AUTH_USER_ID = "22222222-2222-4222-8222-222222222222";
const HALL_ID = "33333333-3333-4333-8333-333333333333";
const COMPETITION_ID = "44444444-4444-4444-8444-444444444444";

const participant: ParticipantIdentity = {
  authUserId: AUTH_USER_ID,
  profileId: PROFILE_ID,
  hallId: HALL_ID,
};

function service(overrides: Partial<B7Service> = {}): B7Service {
  return {
    enroll: vi.fn(),
    getParticipantLeaderboard: vi.fn(),
    getPublicProfile: vi.fn(),
    getPublicLeaderboard: vi.fn(),
    updatePrivacy: vi.fn(),
    deleteAccount: vi.fn(),
    ...overrides,
  };
}

const participantContext = { params: Promise.resolve({ id: COMPETITION_ID }) };

const privacyInput = {
  visibility: "public" as const,
  directoryOptIn: true,
  activityImportOptIn: true,
  publicStatsOptIn: true,
  publicHallOptIn: false,
  encouragementScope: "friends" as const,
  reminderEnabled: true,
  reminderDays: 14 as const,
};

describe("B7 participant policy", () => {
  it("rejects anonymous enrollment before any service call", async () => {
    const api = service();
    const handlers = createCompetitionHandlers({
      authenticate: vi.fn(async () => null),
      service: api,
    });

    const response = await handlers.POST(
      new Request(`http://local/api/competitions/${COMPETITION_ID}/enroll`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
      participantContext,
    );

    expect(response.status).toBe(401);
    expect(api.enroll).not.toHaveBeenCalled();
  });

  it("enrolls only the current profile and rejects client-owned enrollment fields", async () => {
    const enrollment = {
      competitionId: COMPETITION_ID,
      hallId: HALL_ID,
      eligible: true,
    };
    const api = service({ enroll: vi.fn(async () => enrollment) });
    const handlers = createCompetitionHandlers({
      authenticate: vi.fn(async () => participant),
      service: api,
    });

    const accepted = await handlers.POST(
      new Request(`http://local/api/competitions/${COMPETITION_ID}/enroll`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
      participantContext,
    );
    expect(accepted.status).toBe(201);
    expect(api.enroll).toHaveBeenCalledWith(participant, COMPETITION_ID);

    const rejected = await handlers.POST(
      new Request(`http://local/api/competitions/${COMPETITION_ID}/enroll`, {
        method: "POST",
        body: JSON.stringify({ hallId: "attacker-selected", eligible: true }),
      }),
      participantContext,
    );
    expect(rejected.status).toBe(400);
    expect(api.enroll).toHaveBeenCalledTimes(1);
  });

  it("requires current participant ownership for the private leaderboard", async () => {
    const api = service({
      getParticipantLeaderboard: vi.fn(async () => {
        throw new ApiPolicyError("NOT_ENROLLED", 403);
      }),
    });
    const handlers = createCompetitionHandlers({
      authenticate: vi.fn(async () => participant),
      service: api,
    });

    const response = await handlers.GET(
      new Request(`http://local/api/competitions/${COMPETITION_ID}/leaderboard`),
      participantContext,
    );

    expect(response.status).toBe(403);
    expect(api.getParticipantLeaderboard).toHaveBeenCalledWith(
      participant.profileId,
      COMPETITION_ID,
    );
  });
});

describe("B7 public policy", () => {
  it("returns 404 immediately when current PostgreSQL consent is withdrawn", async () => {
    const api = service({ getPublicProfile: vi.fn(async () => null) });
    const handlers = createPublicHandlers({ service: api });

    const response = await handlers.profile.GET(
      new Request("http://local/api/public/profiles/maya-quest"),
      { params: Promise.resolve({ slug: "maya-quest" }) },
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("allowlists only public profile fields and makes hall independently optional", async () => {
    const api = service({
      getPublicProfile: vi.fn(async () => ({
        displayName: "Maya Quest",
        hallName: null,
        weeklyPoints: 1,
        badges: [],
        activeWeekSummary: "3 active weeks",
        email: "never@public.test",
        provider: "cscpay",
        machineLocation: "basement-4",
        exactTimestamp: "2026-09-08T12:00:00.000Z",
        friendIds: [PROFILE_ID],
        reminderDueAt: "2026-09-09T12:00:00.000Z",
        evidence: { receipt: true },
      })),
    });
    const handlers = createPublicHandlers({ service: api });

    const response = await handlers.profile.GET(
      new Request("http://local/api/public/profiles/maya-quest"),
      { params: Promise.resolve({ slug: "maya-quest" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      profile: {
        displayName: "Maya Quest",
        weeklyPoints: 1,
        badges: [],
        activeWeekSummary: "3 active weeks",
      },
    });
  });

  it("defensively excludes hall aggregates unless minimum_met and is_public are true", async () => {
    const api = service({
      getPublicLeaderboard: vi.fn(async () => ({
        competitionName: "Weekly Quest",
        weekStartsOn: "2026-09-07",
        rows: [
          {
            hallName: "Maple Hall",
            eligibleCount: 6,
            creditedCount: 4,
            participationRate: 66.666667,
            rank: 1,
            minimumMet: true,
            isPublic: true,
          },
          {
            hallName: "Tiny Hall",
            eligibleCount: 2,
            creditedCount: 2,
            participationRate: 100,
            rank: null,
            minimumMet: false,
            isPublic: true,
          },
          {
            hallName: "Private Hall",
            eligibleCount: 8,
            creditedCount: 8,
            participationRate: 100,
            rank: 1,
            minimumMet: true,
            isPublic: false,
          },
        ],
      })),
    });
    const handlers = createPublicHandlers({ service: api });

    const response = await handlers.leaderboard.GET(
      new Request(`http://local/api/public/leaderboards/${COMPETITION_ID}`),
      participantContext,
    );
    const body = await response.json();

    expect(body.leaderboard.rows).toHaveLength(1);
    expect(body.leaderboard.rows[0].hallName).toBe("Maple Hall");
  });
});

describe("B7 privacy and deletion policy", () => {
  it("requires a participant and strictly rejects mixed or unknown privacy fields", async () => {
    const api = service();
    const anonymous = createPrivacyHandler({
      authenticate: vi.fn(async () => null),
      service: api,
    });
    expect(
      (
        await anonymous(
          new Request("http://local/api/settings/privacy", {
            method: "PUT",
            body: JSON.stringify(privacyInput),
          }),
        )
      ).status,
    ).toBe(401);

    const authenticated = createPrivacyHandler({
      authenticate: vi.fn(async () => participant),
      service: api,
    });
    const rejected = await authenticated(
      new Request("http://local/api/settings/privacy", {
        method: "PUT",
        body: JSON.stringify({ ...privacyInput, email: "change-owner@example.test" }),
      }),
    );
    expect(rejected.status).toBe(400);
    expect(api.updatePrivacy).not.toHaveBeenCalled();
  });

  it("updates independent consent fields only for the current participant", async () => {
    const updatePrivacy = vi.fn(async () => privacyInput);
    const handler = createPrivacyHandler({
      authenticate: vi.fn(async () => participant),
      service: service({ updatePrivacy }),
    });

    const response = await handler(
      new Request("http://local/api/settings/privacy", {
        method: "PUT",
        body: JSON.stringify(privacyInput),
      }),
    );

    expect(response.status).toBe(200);
    expect(updatePrivacy).toHaveBeenCalledWith(participant, privacyInput);
  });

  it("never permits anonymous account deletion and targets only the authenticated account", async () => {
    const deleteAccount = vi.fn(async () => undefined);
    const api = service({ deleteAccount });
    const anonymous = createAccountHandler({
      authenticate: vi.fn(async () => null),
      service: api,
    });
    const denied = await anonymous(
      new Request("http://local/api/account", { method: "DELETE" }),
    );
    expect(denied.status).toBe(401);
    expect(deleteAccount).not.toHaveBeenCalled();

    const owner = createAccountHandler({
      authenticate: vi.fn(async () => ({ authUserId: AUTH_USER_ID, profileId: PROFILE_ID })),
      service: api,
    });
    const accepted = await owner(
      new Request("http://local/api/account", { method: "DELETE" }),
    );
    expect(accepted.status).toBe(204);
    expect(deleteAccount).toHaveBeenCalledWith({
      authUserId: AUTH_USER_ID,
      profileId: PROFILE_ID,
    });
  });
});
