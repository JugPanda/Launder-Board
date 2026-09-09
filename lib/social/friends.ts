export type FriendshipStatus = "pending" | "accepted" | "declined" | "removed";
export type FriendTransitionAction = "accept" | "decline" | "remove";

export interface FriendshipParticipantRecord {
  id: string;
  displayName: string;
  [privateField: string]: unknown;
}

export interface FriendshipRecord {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: string;
  updatedAt: string;
  counterparty: FriendshipParticipantRecord;
  [privateField: string]: unknown;
}

export interface FriendDto {
  id: string;
  direction: "incoming" | "outgoing";
  participant: {
    id: string;
    displayName: string;
  };
  status: "pending" | "accepted";
}

export type FriendRequestRepositoryResult =
  | { kind: "created"; friendship: FriendshipRecord }
  | { kind: "already_exists" }
  | { kind: "blocked" }
  | { kind: "unavailable" };

type FriendMutationRepositoryResult = {
  kind: string;
  friendship?: unknown;
};

export type FriendTransitionRepositoryResult =
  | { kind: "updated"; friendship: FriendshipRecord }
  | { kind: "not_found" }
  | { kind: "not_allowed" };

export type FriendRemovalRepositoryResult =
  | { kind: "removed" }
  | { kind: "not_found" }
  | { kind: "not_allowed" };

export type BlockRepositoryResult =
  | { kind: "updated" }
  | { kind: "not_found" }
  | { kind: "not_allowed" };

/**
 * Every mutation method is one transactional repository operation. Implementors
 * must re-check participation, consent, relationship state, and both block
 * directions in the same transaction as their write.
 */
export interface FriendRepository {
  listForUser(userId: string): Promise<FriendshipRecord[]>;
  requestFriendAtomically(input: {
    requesterId: string;
    addresseeId: string;
  }): Promise<FriendMutationRepositoryResult>;
  transitionFriendAtomically(input: {
    actorId: string;
    friendshipId: string;
    action: "accept" | "decline";
  }): Promise<FriendMutationRepositoryResult>;
  removeFriendAtomically(input: {
    actorId: string;
    friendshipId: string;
  }): Promise<FriendMutationRepositoryResult>;
  setBlockAtomically(input: {
    blockerId: string;
    blockedId: string;
    blocked: boolean;
  }): Promise<FriendMutationRepositoryResult>;
}

export type FriendErrorCode =
  | "SELF_REQUEST"
  | "TARGET_UNAVAILABLE"
  | "FRIENDSHIP_EXISTS"
  | "FRIENDSHIP_NOT_FOUND"
  | "TRANSITION_NOT_ALLOWED";

export class FriendServiceError extends Error {
  constructor(readonly code: FriendErrorCode) {
    super(code);
    this.name = "FriendServiceError";
  }
}

export function isFriendTransitionAllowed(
  friendship: Pick<FriendshipRecord, "requesterId" | "addresseeId" | "status">,
  actorId: string,
  action: FriendTransitionAction,
): boolean {
  if (action === "remove") {
    return (
      friendship.status === "accepted" &&
      (friendship.requesterId === actorId || friendship.addresseeId === actorId)
    );
  }

  return friendship.status === "pending" && friendship.addresseeId === actorId;
}

function isFriendshipRecord(value: unknown): value is FriendshipRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const counterparty = record.counterparty;
  return (
    typeof record.id === "string" &&
    typeof record.requesterId === "string" &&
    typeof record.addresseeId === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.updatedAt === "string" &&
    ["pending", "accepted", "declined", "removed"].includes(String(record.status)) &&
    !!counterparty &&
    typeof counterparty === "object" &&
    typeof (counterparty as Record<string, unknown>).id === "string" &&
    typeof (counterparty as Record<string, unknown>).displayName === "string"
  );
}

function toFriendDto(friendship: unknown, actorId: string): FriendDto | null {
  if (!isFriendshipRecord(friendship)) return null;
  if (friendship.status !== "pending" && friendship.status !== "accepted") return null;

  const direction =
    friendship.requesterId === actorId
      ? "outgoing"
      : friendship.addresseeId === actorId
        ? "incoming"
        : null;
  if (!direction) return null;

  const expectedCounterpartyId =
    direction === "outgoing" ? friendship.addresseeId : friendship.requesterId;
  if (friendship.counterparty.id !== expectedCounterpartyId) return null;

  return {
    id: friendship.id,
    direction,
    participant: {
      id: friendship.counterparty.id,
      displayName: friendship.counterparty.displayName,
    },
    status: friendship.status,
  };
}

export class FriendService {
  constructor(private readonly repository: FriendRepository) {}

  async listFriends(userId: string): Promise<FriendDto[]> {
    const friendships = await this.repository.listForUser(userId);
    return friendships.flatMap((friendship) => {
      const dto = toFriendDto(friendship, userId);
      return dto ? [dto] : [];
    });
  }

  async requestFriend(requesterId: string, addresseeId: string): Promise<FriendDto> {
    if (requesterId === addresseeId) throw new FriendServiceError("SELF_REQUEST");

    const result = await this.repository.requestFriendAtomically({ requesterId, addresseeId });
    if (result.kind === "blocked" || result.kind === "unavailable") {
      // Deliberately do not reveal participation, discoverability, or block state.
      throw new FriendServiceError("TARGET_UNAVAILABLE");
    }
    if (result.kind === "already_exists") {
      throw new FriendServiceError("FRIENDSHIP_EXISTS");
    }

    if (result.kind !== "created") throw new FriendServiceError("TARGET_UNAVAILABLE");
    const friendship = toFriendDto(result.friendship, requesterId);
    if (!friendship) throw new FriendServiceError("TARGET_UNAVAILABLE");
    return friendship;
  }

  async transitionFriend(
    actorId: string,
    friendshipId: string,
    action: "accept" | "decline",
  ): Promise<FriendDto | null> {
    const result = await this.repository.transitionFriendAtomically({
      actorId,
      friendshipId,
      action,
    });
    if (result.kind === "not_found") throw new FriendServiceError("FRIENDSHIP_NOT_FOUND");
    if (result.kind === "not_allowed") throw new FriendServiceError("TRANSITION_NOT_ALLOWED");

    if (result.kind !== "updated") throw new FriendServiceError("TRANSITION_NOT_ALLOWED");
    if (action === "decline") return null;
    const friendship = toFriendDto(result.friendship, actorId);
    if (!friendship) throw new FriendServiceError("TRANSITION_NOT_ALLOWED");
    return friendship;
  }

  async removeFriend(actorId: string, friendshipId: string): Promise<void> {
    const result = await this.repository.removeFriendAtomically({ actorId, friendshipId });
    if (result.kind === "not_found") throw new FriendServiceError("FRIENDSHIP_NOT_FOUND");
    if (result.kind === "not_allowed") throw new FriendServiceError("TRANSITION_NOT_ALLOWED");
  }

  async setBlocked(actorId: string, targetId: string, blocked: boolean): Promise<void> {
    if (actorId === targetId) throw new FriendServiceError("SELF_REQUEST");
    const result = await this.repository.setBlockAtomically({
      blockerId: actorId,
      blockedId: targetId,
      blocked,
    });
    if (result.kind === "not_found") throw new FriendServiceError("TARGET_UNAVAILABLE");
    if (result.kind === "not_allowed") throw new FriendServiceError("TRANSITION_NOT_ALLOWED");
  }
}
