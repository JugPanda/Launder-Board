import { beforeEach, describe, expect, it, vi } from "vitest";

const MAYA_ID = "11111111-1111-4111-8111-111111111111";
const NOAH_ID = "22222222-2222-4222-8222-222222222222";
const FRIENDSHIP_ID = "33333333-3333-4333-8333-333333333333";
const ENCOURAGEMENT_ID = "44444444-4444-4444-8444-444444444444";
const NOW = "2026-09-08T12:00:00.000Z";

const { requireUserMock } = vi.hoisted(() => ({ requireUserMock: vi.fn() }));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: requireUserMock,
}));

function rpcResult(name: string) {
  if (name === "social_request_friend") {
    return {
      kind: "created",
      friendship: {
        id: FRIENDSHIP_ID,
        requesterId: MAYA_ID,
        addresseeId: NOAH_ID,
        status: "pending",
        createdAt: NOW,
        updatedAt: NOW,
        counterparty: { id: NOAH_ID, displayName: "Noah R." },
      },
    };
  }
  if (name === "social_send_encouragement") {
    return {
      kind: "sent",
      encouragement: {
        id: ENCOURAGEMENT_ID,
        senderId: MAYA_ID,
        recipientId: NOAH_ID,
        presetKey: "laundry_quest",
        createdAt: NOW,
      },
    };
  }
  if (name === "social_report_encouragement") return { kind: "reported" };
  return { kind: "updated" };
}

const rpc = vi.fn(async (name: string) => ({ data: rpcResult(name), error: null }));

beforeEach(() => {
  rpc.mockClear();
  requireUserMock.mockReset();
  requireUserMock.mockResolvedValue({
    profile: { id: MAYA_ID },
    supabase: { rpc },
  });
});

describe("actual B6 route wiring", () => {
  it("uses requireUser's current profile and persists friend requests through RPC", async () => {
    const { POST } = await import("@/app/api/friends/route");
    const response = await POST(
      new Request("http://local/api/friends", {
        method: "POST",
        body: JSON.stringify({ targetId: NOAH_ID }),
      }),
    );

    expect(response.status).toBe(201);
    expect(requireUserMock).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledWith("social_request_friend", { p_addressee_id: NOAH_ID });
    await expect(response.json()).resolves.toEqual({
      friendship: {
        id: FRIENDSHIP_ID,
        direction: "outgoing",
        participant: { id: NOAH_ID, displayName: "Noah R." },
        status: "pending",
      },
    });
  });

  it("persists preset-only encouragements and returns an allowlisted DTO", async () => {
    const { POST } = await import("@/app/api/encouragements/route");
    const response = await POST(
      new Request("http://local/api/encouragements", {
        method: "POST",
        body: JSON.stringify({ recipientId: NOAH_ID, presetKey: "laundry_quest" }),
      }),
    );

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("social_send_encouragement", {
      p_recipient_id: NOAH_ID,
      p_preset_key: "laundry_quest",
    });
    const payload = await response.json();
    expect(payload.encouragement).toMatchObject({
      id: ENCOURAGEMENT_ID,
      recipientId: NOAH_ID,
      presetKey: "laundry_quest",
    });
    expect(JSON.stringify(payload)).not.toContain("senderId");
  });

  it("wires strict recipient mute, block, and fixed-category report routes", async () => {
    const [{ PATCH: block }, { PATCH: mute }, { POST: report }] = await Promise.all([
      import("@/app/api/friends/participants/[id]/block/route"),
      import("@/app/api/encouragements/senders/[id]/mute/route"),
      import("@/app/api/encouragements/[id]/report/route"),
    ]);

    const blockResponse = await block(
      new Request(`http://local/api/friends/participants/${NOAH_ID}/block`, {
        method: "PATCH",
        body: JSON.stringify({ blocked: true }),
      }),
      { params: Promise.resolve({ id: NOAH_ID }) },
    );
    const muteResponse = await mute(
      new Request(`http://local/api/encouragements/senders/${NOAH_ID}/mute`, {
        method: "PATCH",
        body: JSON.stringify({ muted: true }),
      }),
      { params: Promise.resolve({ id: NOAH_ID }) },
    );
    const reportResponse = await report(
      new Request(`http://local/api/encouragements/${ENCOURAGEMENT_ID}/report`, {
        method: "POST",
        body: JSON.stringify({ category: "unwanted" }),
      }),
      { params: Promise.resolve({ id: ENCOURAGEMENT_ID }) },
    );

    expect(blockResponse.status).toBe(204);
    expect(muteResponse.status).toBe(204);
    expect(reportResponse.status).toBe(204);
    expect(rpc).toHaveBeenCalledWith("social_set_block", {
      p_blocked_id: NOAH_ID,
      p_blocked: true,
    });
    expect(rpc).toHaveBeenCalledWith("social_set_encouragement_mute", {
      p_sender_id: NOAH_ID,
      p_muted: true,
    });
    expect(rpc).toHaveBeenCalledWith("social_report_encouragement", {
      p_encouragement_id: ENCOURAGEMENT_ID,
      p_category: "unwanted",
    });
  });

  it("rejects extra safety fields before RPC and preserves active-profile denial", async () => {
    const { PATCH: block } = await import("@/app/api/friends/participants/[id]/block/route");
    const invalid = await block(
      new Request(`http://local/api/friends/participants/${NOAH_ID}/block`, {
        method: "PATCH",
        body: JSON.stringify({ blocked: true, reason: "private text" }),
      }),
      { params: Promise.resolve({ id: NOAH_ID }) },
    );
    expect(invalid.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();

    requireUserMock.mockRejectedValueOnce(Object.assign(new Error("inactive"), { status: 403 }));
    const denied = await block(
      new Request(`http://local/api/friends/participants/${NOAH_ID}/block`, {
        method: "PATCH",
        body: JSON.stringify({ blocked: true }),
      }),
      { params: Promise.resolve({ id: NOAH_ID }) },
    );
    expect(denied.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
});
