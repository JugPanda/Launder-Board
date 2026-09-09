import { describe, expect, it, vi } from "vitest";

import {
  FriendService,
  isFriendTransitionAllowed,
  type FriendRepository,
  type FriendshipRecord,
} from "@/lib/social/friends";
import { friendRequestSchema, friendTransitionSchema } from "@/lib/social/schemas";

const MAYA_ID = "11111111-1111-4111-8111-111111111111";
const NOAH_ID = "22222222-2222-4222-8222-222222222222";
const FRIENDSHIP_ID = "33333333-3333-4333-8333-333333333333";

const pending: FriendshipRecord = {
  id: FRIENDSHIP_ID,
  requesterId: MAYA_ID,
  addresseeId: NOAH_ID,
  status: "pending",
  createdAt: "2026-09-08T10:00:00.000Z",
  updatedAt: "2026-09-08T10:00:00.000Z",
  counterparty: {
    id: NOAH_ID,
    displayName: "Noah R.",
    email: "private@example.edu",
    room: "Private room",
  },
};

function repository(overrides: Partial<FriendRepository> = {}): FriendRepository {
  return {
    listForUser: vi.fn(async () => [pending]),
    requestFriendAtomically: vi.fn(async () => ({ kind: "created", friendship: pending })),
    transitionFriendAtomically: vi.fn(async () => ({ kind: "updated", friendship: pending })),
    removeFriendAtomically: vi.fn(async () => ({ kind: "removed" })),
    setBlockAtomically: vi.fn(async () => ({ kind: "updated" })),
    ...overrides,
  };
}

describe("friend input and transition policy", () => {
  it("accepts only a single strict target id", () => {
    expect(friendRequestSchema.parse({ targetId: NOAH_ID })).toEqual({ targetId: NOAH_ID });
    expect(friendRequestSchema.safeParse({ targetId: NOAH_ID, targetIds: [NOAH_ID] }).success).toBe(
      false,
    );
    expect(friendRequestSchema.safeParse({ targetId: "not-an-id" }).success).toBe(false);
  });

  it("accepts only explicit accept or decline transition actions", () => {
    expect(friendTransitionSchema.parse({ action: "accept" })).toEqual({ action: "accept" });
    expect(friendTransitionSchema.parse({ action: "decline" })).toEqual({ action: "decline" });
    expect(friendTransitionSchema.safeParse({ action: "remove" }).success).toBe(false);
    expect(friendTransitionSchema.safeParse({ action: "accept", status: "accepted" }).success).toBe(
      false,
    );
  });

  it("permits only the addressee to accept or decline a pending request", () => {
    expect(isFriendTransitionAllowed(pending, NOAH_ID, "accept")).toBe(true);
    expect(isFriendTransitionAllowed(pending, NOAH_ID, "decline")).toBe(true);
    expect(isFriendTransitionAllowed(pending, MAYA_ID, "accept")).toBe(false);
    expect(
      isFriendTransitionAllowed({ ...pending, status: "accepted" }, NOAH_ID, "decline"),
    ).toBe(false);
  });

  it("permits removal only for either member of an accepted friendship", () => {
    const accepted = { ...pending, status: "accepted" as const };
    expect(isFriendTransitionAllowed(accepted, MAYA_ID, "remove")).toBe(true);
    expect(isFriendTransitionAllowed(accepted, NOAH_ID, "remove")).toBe(true);
    expect(isFriendTransitionAllowed(pending, MAYA_ID, "remove")).toBe(false);
    expect(isFriendTransitionAllowed(accepted, FRIENDSHIP_ID, "remove")).toBe(false);
  });
});

describe("friend service", () => {
  it("delegates discoverability, participation, uniqueness, and block checks to one atomic request", async () => {
    const repo = repository();
    const service = new FriendService(repo);

    await expect(service.requestFriend(MAYA_ID, NOAH_ID)).resolves.toMatchObject({
      id: FRIENDSHIP_ID,
      direction: "outgoing",
      participant: { id: NOAH_ID, displayName: "Noah R." },
      status: "pending",
    });
    expect(repo.requestFriendAtomically).toHaveBeenCalledWith({
      requesterId: MAYA_ID,
      addresseeId: NOAH_ID,
    });
  });

  it("does not expose repository-only private participant fields", async () => {
    const service = new FriendService(repository());
    const result = await service.listFriends(MAYA_ID);

    expect(result).toEqual([
      {
        id: FRIENDSHIP_ID,
        direction: "outgoing",
        participant: { id: NOAH_ID, displayName: "Noah R." },
        status: "pending",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("private@example.edu");
    expect(JSON.stringify(result)).not.toContain("Private room");
  });

  it("fails closed without revealing whether an unavailable target blocked the requester", async () => {
    const unavailable = repository({
      requestFriendAtomically: vi.fn(async () => ({ kind: "blocked" as const })),
    });
    const service = new FriendService(unavailable);

    await expect(service.requestFriend(MAYA_ID, NOAH_ID)).rejects.toMatchObject({
      code: "TARGET_UNAVAILABLE",
    });
  });

  it("rejects self requests before repository mutation", async () => {
    const repo = repository();
    const service = new FriendService(repo);

    await expect(service.requestFriend(MAYA_ID, MAYA_ID)).rejects.toMatchObject({
      code: "SELF_REQUEST",
    });
    expect(repo.requestFriendAtomically).not.toHaveBeenCalled();
  });
});
