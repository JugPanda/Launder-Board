import type {
  EncouragementPresetKey,
  ReportCategory,
} from "@/lib/social/schemas";

export const ENCOURAGEMENT_PRESETS: Readonly<Record<EncouragementPresetKey, string>> =
  Object.freeze({
    laundry_quest: "Laundry quest this week? You've got this.",
    shared_load: "Want to team up for a shared load?",
    hall_point: "Our hall could use one more participation point—no pressure.",
  });

export const PAIR_COOLDOWN_MS = 72 * 60 * 60 * 1000;
export const SENDER_WINDOW_MS = 24 * 60 * 60 * 1000;
export const SENDER_DAILY_LIMIT = 5;

export interface DueEncouragementCandidate {
  participantId: string;
  displayName: string;
  acceptedFriend: boolean;
  sameHall: boolean;
  encouragementScope: "off" | "friends" | "hall";
  reminderEnabled: boolean;
  reminderDays: 7 | 14 | 21;
  trackingState: "unknown" | "partial" | "stale" | "current";
  dueAt: string | null;
  blockedEitherDirection: boolean;
  mutedSender: boolean;
  [privateField: string]: unknown;
}

export interface EncouragementRecord {
  id: string;
  senderId: string;
  recipientId: string;
  presetKey: EncouragementPresetKey;
  createdAt: string;
  sender?: { id: string; displayName: string; [privateField: string]: unknown };
  [privateField: string]: unknown;
}

export type EncouragementSendRepositoryResult =
  | { kind: "sent"; encouragement: EncouragementRecord }
  | { kind: "blocked" }
  | { kind: "not_allowed" }
  | { kind: "recipient_muted" }
  | { kind: "pair_cooldown"; availableAt: string }
  | { kind: "sender_daily_limit"; availableAt?: string };

export type EncouragementMuteRepositoryResult =
  | { kind: "updated" }
  | { kind: "not_found" }
  | { kind: "not_allowed" };

export type EncouragementReportRepositoryResult =
  | { kind: "reported" }
  | { kind: "not_found" }
  | { kind: "not_allowed" }
  | { kind: "already_reported" };

type EncouragementMutationRepositoryResult = {
  kind: string;
  encouragement?: unknown;
  availableAt?: string;
};

/** All mutation methods must authorize and write inside one database transaction. */
export interface EncouragementRepository {
  listReceived(userId: string): Promise<Array<EncouragementRecord | Record<string, unknown>>>;
  listDueCandidates(userId: string): Promise<
    Array<DueEncouragementCandidate | Record<string, unknown>>
  >;
  sendAtomically(input: {
    senderId: string;
    recipientId: string;
    presetKey: EncouragementPresetKey;
    now: Date;
    pairCooldownMs: number;
    senderWindowMs: number;
    senderLimit: number;
  }): Promise<EncouragementMutationRepositoryResult>;
  setMutedAtomically(input: {
    recipientId: string;
    senderId: string;
    muted: boolean;
  }): Promise<EncouragementMutationRepositoryResult>;
  reportAtomically(input: {
    reporterId: string;
    encouragementId: string;
    category: ReportCategory;
  }): Promise<EncouragementMutationRepositoryResult>;
}

export interface EncouragementSendEvaluation {
  blockedEitherDirection: boolean;
  allowedAudience: boolean;
  recipientMuted: boolean;
  lastPairSentAt: string | null;
  senderSentAt: string[];
  now: Date;
}

export type EncouragementSendDecision =
  | { kind: "allowed" }
  | { kind: "blocked" }
  | { kind: "not_allowed" }
  | { kind: "recipient_muted" }
  | { kind: "pair_cooldown"; availableAt: string }
  | { kind: "sender_daily_limit" };

function validTime(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isPresetKey(value: unknown): value is EncouragementPresetKey {
  return typeof value === "string" && Object.hasOwn(ENCOURAGEMENT_PRESETS, value);
}

function isEncouragementRecord(value: unknown): value is EncouragementRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const sender = record.sender;
  return (
    typeof record.id === "string" &&
    typeof record.senderId === "string" &&
    typeof record.recipientId === "string" &&
    isPresetKey(record.presetKey) &&
    typeof record.createdAt === "string" &&
    (sender === undefined ||
      (!!sender &&
        typeof sender === "object" &&
        typeof (sender as Record<string, unknown>).id === "string" &&
        typeof (sender as Record<string, unknown>).displayName === "string"))
  );
}

function isDueCandidateRecord(value: unknown): value is DueEncouragementCandidate {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.participantId === "string" &&
    typeof record.displayName === "string" &&
    typeof record.acceptedFriend === "boolean" &&
    typeof record.sameHall === "boolean" &&
    ["off", "friends", "hall"].includes(String(record.encouragementScope)) &&
    typeof record.reminderEnabled === "boolean" &&
    [7, 14, 21].includes(Number(record.reminderDays)) &&
    ["unknown", "partial", "stale", "current"].includes(String(record.trackingState)) &&
    (record.dueAt === null || typeof record.dueAt === "string") &&
    typeof record.blockedEitherDirection === "boolean" &&
    typeof record.mutedSender === "boolean"
  );
}

export function evaluateEncouragementSend(
  input: EncouragementSendEvaluation,
): EncouragementSendDecision {
  // A block is intentionally evaluated first so it wins over every stale or
  // conflicting policy projection. The repository must use the same ordering.
  if (input.blockedEitherDirection) return { kind: "blocked" };
  if (!input.allowedAudience) return { kind: "not_allowed" };
  if (input.recipientMuted) return { kind: "recipient_muted" };

  const nowMs = input.now.getTime();
  const pairSentMs = validTime(input.lastPairSentAt);
  if (pairSentMs !== null && pairSentMs > nowMs - PAIR_COOLDOWN_MS) {
    return {
      kind: "pair_cooldown",
      availableAt: new Date(pairSentMs + PAIR_COOLDOWN_MS).toISOString(),
    };
  }

  const senderWindowStart = nowMs - SENDER_WINDOW_MS;
  const recentSendCount = input.senderSentAt.reduce((count, sentAt) => {
    const sentMs = validTime(sentAt);
    return sentMs !== null && sentMs > senderWindowStart ? count + 1 : count;
  }, 0);
  if (recentSendCount >= SENDER_DAILY_LIMIT) return { kind: "sender_daily_limit" };

  return { kind: "allowed" };
}

export function isDueEncouragementCandidate(
  candidate: DueEncouragementCandidate,
  now: Date,
): boolean {
  if (
    candidate.blockedEitherDirection ||
    candidate.mutedSender ||
    !candidate.reminderEnabled ||
    candidate.trackingState !== "current"
  ) {
    return false;
  }

  const audienceAllowed =
    candidate.encouragementScope !== "off" &&
    (candidate.acceptedFriend ||
      (candidate.encouragementScope === "hall" && candidate.sameHall));
  if (!audienceAllowed) return false;

  const dueAt = validTime(candidate.dueAt);
  return dueAt !== null && dueAt <= now.getTime();
}

export interface DueEncouragementDto {
  participantId: string;
  displayName: string;
  reason: "accepted_friend" | "same_hall";
  reminderText: string;
  context: "Based on activity shared with pay2win.";
}

export interface SentEncouragementDto {
  id: string;
  recipientId: string;
  presetKey: EncouragementPresetKey;
  message: string;
  sentAt: string;
  availableAgainAt: string;
}

export interface ReceivedEncouragementDto {
  id: string;
  sender: { id: string; displayName: string } | null;
  presetKey: EncouragementPresetKey;
  message: string;
  receivedAt: string;
}

export type EncouragementErrorCode =
  | "SELF_ENCOURAGEMENT"
  | "TARGET_UNAVAILABLE"
  | "PAIR_COOLDOWN"
  | "SENDER_DAILY_LIMIT"
  | "ENCOURAGEMENT_NOT_FOUND"
  | "ACTION_NOT_ALLOWED"
  | "ALREADY_REPORTED";

export class EncouragementServiceError extends Error {
  constructor(
    readonly code: EncouragementErrorCode,
    readonly availableAt?: string,
  ) {
    super(code);
    this.name = "EncouragementServiceError";
  }
}

export class EncouragementService {
  constructor(
    private readonly repository: EncouragementRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async listDue(userId: string): Promise<DueEncouragementDto[]> {
    const now = this.now();
    const candidates = await this.repository.listDueCandidates(userId);
    return candidates
      .filter(isDueCandidateRecord)
      .filter((candidate) => isDueEncouragementCandidate(candidate, now))
      .map((candidate) => ({
        participantId: candidate.participantId,
        displayName: candidate.displayName,
        reason: candidate.acceptedFriend ? "accepted_friend" : "same_hall",
        reminderText: `No recorded wash in the last ${candidate.reminderDays} days.`,
        context: "Based on activity shared with pay2win.",
      }));
  }

  async listReceived(userId: string): Promise<ReceivedEncouragementDto[]> {
    const records = await this.repository.listReceived(userId);
    return records
      .filter(isEncouragementRecord)
      .filter((record) => record.recipientId === userId && record.presetKey in ENCOURAGEMENT_PRESETS)
      .map((record) => ({
        id: record.id,
        sender: record.sender
          ? { id: record.sender.id, displayName: record.sender.displayName }
          : null,
        presetKey: record.presetKey,
        message: ENCOURAGEMENT_PRESETS[record.presetKey],
        receivedAt: record.createdAt,
      }));
  }

  async send(
    senderId: string,
    input: { recipientId: string; presetKey: EncouragementPresetKey },
  ): Promise<SentEncouragementDto> {
    if (senderId === input.recipientId) {
      throw new EncouragementServiceError("SELF_ENCOURAGEMENT");
    }

    const now = this.now();
    const result = await this.repository.sendAtomically({
      senderId,
      recipientId: input.recipientId,
      presetKey: input.presetKey,
      now,
      pairCooldownMs: PAIR_COOLDOWN_MS,
      senderWindowMs: SENDER_WINDOW_MS,
      senderLimit: SENDER_DAILY_LIMIT,
    });

    if (
      result.kind === "blocked" ||
      result.kind === "not_allowed" ||
      result.kind === "recipient_muted"
    ) {
      throw new EncouragementServiceError("TARGET_UNAVAILABLE");
    }
    if (result.kind === "pair_cooldown") {
      throw new EncouragementServiceError("PAIR_COOLDOWN", result.availableAt);
    }
    if (result.kind === "sender_daily_limit") {
      throw new EncouragementServiceError("SENDER_DAILY_LIMIT", result.availableAt);
    }

    if (result.kind !== "sent" || !isEncouragementRecord(result.encouragement)) {
      throw new EncouragementServiceError("TARGET_UNAVAILABLE");
    }
    const sentAt = result.encouragement.createdAt;
    const sentAtMs = validTime(sentAt);
    if (
      result.encouragement.senderId !== senderId ||
      result.encouragement.recipientId !== input.recipientId ||
      result.encouragement.presetKey !== input.presetKey ||
      sentAtMs === null
    ) {
      throw new EncouragementServiceError("TARGET_UNAVAILABLE");
    }

    return {
      id: result.encouragement.id,
      recipientId: result.encouragement.recipientId,
      presetKey: result.encouragement.presetKey,
      message: ENCOURAGEMENT_PRESETS[result.encouragement.presetKey],
      sentAt,
      availableAgainAt: new Date(sentAtMs + PAIR_COOLDOWN_MS).toISOString(),
    };
  }

  async setMuted(recipientId: string, senderId: string, muted: boolean): Promise<void> {
    if (recipientId === senderId) throw new EncouragementServiceError("ACTION_NOT_ALLOWED");
    const result = await this.repository.setMutedAtomically({ recipientId, senderId, muted });
    if (result.kind === "not_found") {
      throw new EncouragementServiceError("ENCOURAGEMENT_NOT_FOUND");
    }
    if (result.kind === "not_allowed") {
      throw new EncouragementServiceError("ACTION_NOT_ALLOWED");
    }
  }

  async report(
    reporterId: string,
    encouragementId: string,
    category: ReportCategory,
  ): Promise<void> {
    const result = await this.repository.reportAtomically({
      reporterId,
      encouragementId,
      category,
    });
    if (result.kind === "not_found") {
      throw new EncouragementServiceError("ENCOURAGEMENT_NOT_FOUND");
    }
    if (result.kind === "not_allowed") {
      throw new EncouragementServiceError("ACTION_NOT_ALLOWED");
    }
    if (result.kind === "already_reported") {
      throw new EncouragementServiceError("ALREADY_REPORTED");
    }
  }
}
