import { describe, expect, it, vi } from "vitest";

import type { EncouragementService } from "@/lib/social/encouragements";
import type { FriendService } from "@/lib/social/friends";
import {
  createEncouragementCollectionHandlers,
  createEncouragementReportHandler,
  createFriendCollectionHandlers,
  createFriendItemHandlers,
} from "@/lib/social/http";

const MAYA_ID = "11111111-1111-4111-8111-111111111111";
const NOAH_ID = "22222222-2222-4222-8222-222222222222";
const ITEM_ID = "33333333-3333-4333-8333-333333333333";

const authenticate = vi.fn(async () => ({ userId: MAYA_ID }));
const params = Promise.resolve({ id: ITEM_ID });

describe("friend route handlers", () => {
  it("rejects unauthenticated requests before touching the service", async () => {
    const service = { listFriends: vi.fn() } as unknown as FriendService;
    const handlers = createFriendCollectionHandlers({
      authenticate: vi.fn(async () => null),
      service,
    });

    const response = await handlers.GET(new Request("http://local/api/friends"));
    expect(response.status).toBe(401);
    expect(service.listFriends).not.toHaveBeenCalled();
  });

  it("strictly rejects extra or malformed request fields atomically", async () => {
    const service = { requestFriend: vi.fn() } as unknown as FriendService;
    const handlers = createFriendCollectionHandlers({ authenticate, service });
    const response = await handlers.POST(
      new Request("http://local/api/friends", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetId: NOAH_ID, admin: true }),
      }),
    );

    expect(response.status).toBe(400);
    expect(service.requestFriend).not.toHaveBeenCalled();
  });

  it("exposes only exact transition operations on PATCH and accepted removal on DELETE", async () => {
    const service = {
      transitionFriend: vi.fn(async () => ({ id: ITEM_ID, status: "accepted" })),
      removeFriend: vi.fn(async () => undefined),
    } as unknown as FriendService;
    const handlers = createFriendItemHandlers({ authenticate, service });

    const patch = await handlers.PATCH(
      new Request(`http://local/api/friends/${ITEM_ID}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "accept" }),
      }),
      { params },
    );
    const remove = await handlers.DELETE(
      new Request(`http://local/api/friends/${ITEM_ID}`, { method: "DELETE" }),
      { params },
    );

    expect(patch.status).toBe(200);
    expect(remove.status).toBe(204);
    expect(service.transitionFriend).toHaveBeenCalledWith(MAYA_ID, ITEM_ID, "accept");
    expect(service.removeFriend).toHaveBeenCalledWith(MAYA_ID, ITEM_ID);
  });
});

describe("encouragement route handlers", () => {
  it("rejects free text and bulk sends before any write", async () => {
    const service = { send: vi.fn() } as unknown as EncouragementService;
    const handlers = createEncouragementCollectionHandlers({ authenticate, service });
    const response = await handlers.POST(
      new Request("http://local/api/encouragements", {
        method: "POST",
        body: JSON.stringify({
          recipientIds: [NOAH_ID],
          presetKey: "laundry_quest",
          message: "You need to wash",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(service.send).not.toHaveBeenCalled();
  });

  it("maps a pair cooldown to 429 without leaking repository records", async () => {
    const error = Object.assign(new Error("cooldown"), {
      code: "PAIR_COOLDOWN",
      availableAt: "2026-09-11T12:00:00.000Z",
    });
    const service = { send: vi.fn(async () => Promise.reject(error)) } as unknown as EncouragementService;
    const handlers = createEncouragementCollectionHandlers({ authenticate, service });
    const response = await handlers.POST(
      new Request("http://local/api/encouragements", {
        method: "POST",
        body: JSON.stringify({ recipientId: NOAH_ID, presetKey: "laundry_quest" }),
      }),
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: { code: "PAIR_COOLDOWN", availableAt: "2026-09-11T12:00:00.000Z" },
    });
  });

  it("reports by fixed category and returns no report or moderation fields", async () => {
    const service = { report: vi.fn(async () => undefined) } as unknown as EncouragementService;
    const handler = createEncouragementReportHandler({ authenticate, service });
    const response = await handler(
      new Request(`http://local/api/encouragements/${ITEM_ID}/report`, {
        method: "POST",
        body: JSON.stringify({ category: "unwanted" }),
      }),
      { params },
    );

    expect(response.status).toBe(204);
    expect(service.report).toHaveBeenCalledWith(MAYA_ID, ITEM_ID, "unwanted");
    expect(await response.text()).toBe("");
  });
});
