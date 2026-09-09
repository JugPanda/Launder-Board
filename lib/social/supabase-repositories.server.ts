import "server-only";

import {
  PAIR_COOLDOWN_MS,
  SENDER_DAILY_LIMIT,
  SENDER_WINDOW_MS,
  type DueEncouragementCandidate,
  type EncouragementMuteRepositoryResult,
  type EncouragementRecord,
  type EncouragementReportRepositoryResult,
  type EncouragementRepository,
  type EncouragementSendRepositoryResult,
} from "@/lib/social/encouragements";
import type {
  BlockRepositoryResult,
  FriendRemovalRepositoryResult,
  FriendRepository,
  FriendRequestRepositoryResult,
  FriendshipRecord,
  FriendTransitionRepositoryResult,
} from "@/lib/social/friends";
import { ENCOURAGEMENT_PRESET_KEYS } from "@/lib/social/schemas";

export interface SocialRpcClient {
  rpc(
    functionName: string,
    params?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
}

function storageError(message: string): Error {
  return Object.assign(new Error(message), { code: "SOCIAL_STORAGE_UNAVAILABLE" });
}

async function callRpc(
  client: SocialRpcClient,
  functionName: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(functionName, params);
  if (error) throw storageError("Social storage unavailable");
  return data;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw storageError("Invalid social storage response");
  }
  return value as Record<string, unknown>;
}

function string(value: unknown): string {
  if (typeof value !== "string") throw storageError("Invalid social storage response");
  return value;
}

function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw storageError("Invalid social storage response");
  return value;
}

function oneOf<const T extends readonly unknown[]>(value: unknown, values: T): T[number] {
  if (!values.includes(value)) throw storageError("Invalid social storage response");
  return value as T[number];
}

function friendship(value: unknown): FriendshipRecord {
  const row = object(value);
  const counterparty = object(row.counterparty);
  return {
    id: string(row.id),
    requesterId: string(row.requesterId),
    addresseeId: string(row.addresseeId),
    status: oneOf(row.status, ["pending", "accepted", "declined", "removed"] as const),
    createdAt: string(row.createdAt),
    updatedAt: string(row.updatedAt),
    counterparty: {
      id: string(counterparty.id),
      displayName: string(counterparty.displayName),
    },
  };
}

function encouragement(value: unknown): EncouragementRecord {
  const row = object(value);
  const sender = row.sender === undefined || row.sender === null ? undefined : object(row.sender);
  return {
    id: string(row.id),
    senderId: string(row.senderId),
    recipientId: string(row.recipientId),
    presetKey: oneOf(row.presetKey, ENCOURAGEMENT_PRESET_KEYS),
    createdAt: string(row.createdAt),
    ...(sender
      ? { sender: { id: string(sender.id), displayName: string(sender.displayName) } }
      : {}),
  };
}

function dueCandidate(value: unknown): DueEncouragementCandidate {
  const row = object(value);
  return {
    participantId: string(row.participantId),
    displayName: string(row.displayName),
    acceptedFriend: boolean(row.acceptedFriend),
    sameHall: boolean(row.sameHall),
    encouragementScope: oneOf(row.encouragementScope, ["off", "friends", "hall"] as const),
    reminderEnabled: boolean(row.reminderEnabled),
    reminderDays: oneOf(row.reminderDays, [7, 14, 21] as const),
    trackingState: oneOf(row.trackingState, ["unknown", "partial", "stale", "current"] as const),
    dueAt: row.dueAt === null ? null : string(row.dueAt),
    blockedEitherDirection: boolean(row.blockedEitherDirection),
    mutedSender: boolean(row.mutedSender),
  };
}

async function list<T>(
  client: SocialRpcClient,
  functionName: string,
  parse: (value: unknown) => T,
): Promise<T[]> {
  const data = await callRpc(client, functionName);
  if (!Array.isArray(data)) throw storageError("Invalid social storage response");
  return data.map(parse);
}

async function mutation(
  client: SocialRpcClient,
  functionName: string,
  params?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = object(await callRpc(client, functionName, params));
  string(result.kind);
  return result;
}

function kindOnly<T extends string>(row: Record<string, unknown>, allowed: readonly T[]): { kind: T } {
  return { kind: oneOf(row.kind, allowed) };
}

function requireActor(expectedProfileId: string, suppliedProfileId: string): void {
  if (expectedProfileId !== suppliedProfileId) throw storageError("Social actor mismatch");
}

export function createSupabaseFriendRepository(
  client: SocialRpcClient,
  currentProfileId: string,
): FriendRepository {
  return {
    async listForUser(userId) {
      requireActor(currentProfileId, userId);
      return list(client, "social_list_friends", friendship);
    },

    async requestFriendAtomically({ requesterId, addresseeId }) {
      requireActor(currentProfileId, requesterId);
      const row = await mutation(client, "social_request_friend", { p_addressee_id: addresseeId });
      if (row.kind === "created") {
        return { kind: "created", friendship: friendship(row.friendship) } satisfies FriendRequestRepositoryResult;
      }
      return kindOnly(row, ["already_exists", "blocked", "unavailable"] as const) satisfies FriendRequestRepositoryResult;
    },

    async transitionFriendAtomically({ actorId, friendshipId, action }) {
      requireActor(currentProfileId, actorId);
      const row = await mutation(client, "social_transition_friend", {
        p_friendship_id: friendshipId,
        p_action: action,
      });
      if (row.kind === "updated") {
        return { kind: "updated", friendship: friendship(row.friendship) } satisfies FriendTransitionRepositoryResult;
      }
      return kindOnly(row, ["not_found", "not_allowed"] as const) satisfies FriendTransitionRepositoryResult;
    },

    async removeFriendAtomically({ actorId, friendshipId }) {
      requireActor(currentProfileId, actorId);
      const row = await mutation(client, "social_remove_friend", { p_friendship_id: friendshipId });
      return kindOnly(row, ["removed", "not_found", "not_allowed"] as const) satisfies FriendRemovalRepositoryResult;
    },

    async setBlockAtomically({ blockerId, blockedId, blocked }) {
      requireActor(currentProfileId, blockerId);
      const row = await mutation(client, "social_set_block", {
        p_blocked_id: blockedId,
        p_blocked: blocked,
      });
      return kindOnly(row, ["updated", "not_found", "not_allowed"] as const) satisfies BlockRepositoryResult;
    },
  };
}

export function createSupabaseEncouragementRepository(
  client: SocialRpcClient,
  currentProfileId: string,
): EncouragementRepository {
  return {
    async listReceived(userId) {
      requireActor(currentProfileId, userId);
      return list(client, "social_list_received_encouragements", encouragement);
    },

    async listDueCandidates(userId) {
      requireActor(currentProfileId, userId);
      return list(client, "social_list_due_candidates", dueCandidate);
    },

    async sendAtomically(input) {
      requireActor(currentProfileId, input.senderId);
      if (
        input.pairCooldownMs !== PAIR_COOLDOWN_MS ||
        input.senderWindowMs !== SENDER_WINDOW_MS ||
        input.senderLimit !== SENDER_DAILY_LIMIT
      ) {
        throw storageError("Invalid social policy configuration");
      }
      const row = await mutation(client, "social_send_encouragement", {
        p_recipient_id: input.recipientId,
        p_preset_key: input.presetKey,
      });
      if (row.kind === "sent") {
        return { kind: "sent", encouragement: encouragement(row.encouragement) } satisfies EncouragementSendRepositoryResult;
      }
      if (row.kind === "pair_cooldown") {
        return { kind: "pair_cooldown", availableAt: string(row.availableAt) } satisfies EncouragementSendRepositoryResult;
      }
      if (row.kind === "sender_daily_limit") {
        return {
          kind: "sender_daily_limit",
          ...(row.availableAt === undefined ? {} : { availableAt: string(row.availableAt) }),
        } satisfies EncouragementSendRepositoryResult;
      }
      return kindOnly(row, ["blocked", "not_allowed", "recipient_muted"] as const) satisfies EncouragementSendRepositoryResult;
    },

    async setMutedAtomically({ recipientId, senderId, muted }) {
      requireActor(currentProfileId, recipientId);
      const row = await mutation(client, "social_set_encouragement_mute", {
        p_sender_id: senderId,
        p_muted: muted,
      });
      return kindOnly(row, ["updated", "not_found", "not_allowed"] as const) satisfies EncouragementMuteRepositoryResult;
    },

    async reportAtomically({ reporterId, encouragementId, category }) {
      requireActor(currentProfileId, reporterId);
      const row = await mutation(client, "social_report_encouragement", {
        p_encouragement_id: encouragementId,
        p_category: category,
      });
      return kindOnly(row, ["reported", "not_found", "not_allowed", "already_reported"] as const) satisfies EncouragementReportRepositoryResult;
    },
  };
}
