import { describe, expect, it, vi } from "vitest";

import {
  createSupabaseEncouragementRepository,
  createSupabaseFriendRepository,
} from "@/lib/social/supabase-repositories.server";

const MAYA_ID = "11111111-1111-4111-8111-111111111111";
const NOAH_ID = "22222222-2222-4222-8222-222222222222";
const FRIENDSHIP_ID = "33333333-3333-4333-8333-333333333333";
const ENCOURAGEMENT_ID = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-09-08T12:00:00.000Z");

function client(result: unknown = { kind: "updated" }) {
  return {
    rpc: vi.fn(async () => ({ data: result, error: null })),
  };
}

describe("Supabase social repositories", () => {
  it("uses current-user RPCs and never sends a caller-controlled actor id", async () => {
    const supabase = client({
      kind: "created",
      friendship: {
        id: FRIENDSHIP_ID,
        requesterId: MAYA_ID,
        addresseeId: NOAH_ID,
        status: "pending",
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
        counterparty: { id: NOAH_ID, displayName: "Noah R." },
      },
    });
    const repository = createSupabaseFriendRepository(supabase, MAYA_ID);

    await expect(
      repository.requestFriendAtomically({ requesterId: MAYA_ID, addresseeId: NOAH_ID }),
    ).resolves.toMatchObject({ kind: "created" });
    expect(supabase.rpc).toHaveBeenCalledWith("social_request_friend", {
      p_addressee_id: NOAH_ID,
    });
    expect(JSON.stringify(supabase.rpc.mock.calls)).not.toContain(MAYA_ID);
  });

  it("rejects an actor mismatch before any RPC", async () => {
    const supabase = client();
    const repository = createSupabaseFriendRepository(supabase, MAYA_ID);

    await expect(
      repository.removeFriendAtomically({ actorId: NOAH_ID, friendshipId: FRIENDSHIP_ID }),
    ).rejects.toThrow("Social actor mismatch");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("calls the atomic encouragement RPC without caller-controlled policy limits", async () => {
    const supabase = client({
      kind: "sent",
      encouragement: {
        id: ENCOURAGEMENT_ID,
        senderId: MAYA_ID,
        recipientId: NOAH_ID,
        presetKey: "laundry_quest",
        createdAt: NOW.toISOString(),
      },
    });
    const repository = createSupabaseEncouragementRepository(supabase, MAYA_ID);

    await repository.sendAtomically({
      senderId: MAYA_ID,
      recipientId: NOAH_ID,
      presetKey: "laundry_quest",
      now: NOW,
      pairCooldownMs: 72 * 60 * 60 * 1000,
      senderWindowMs: 24 * 60 * 60 * 1000,
      senderLimit: 5,
    });

    expect(supabase.rpc).toHaveBeenCalledWith("social_send_encouragement", {
      p_recipient_id: NOAH_ID,
      p_preset_key: "laundry_quest",
    });
  });

  it("fails closed on RPC errors and malformed list envelopes", async () => {
    const broken = {
      rpc: vi.fn(async () => ({ data: null, error: { message: "database unavailable" } })),
    };
    await expect(
      createSupabaseFriendRepository(broken, MAYA_ID).listForUser(MAYA_ID),
    ).rejects.toThrow("Social storage unavailable");

    const malformed = client({ private: "not a list" });
    await expect(
      createSupabaseEncouragementRepository(malformed, MAYA_ID).listReceived(MAYA_ID),
    ).rejects.toThrow("Invalid social storage response");
  });
});
