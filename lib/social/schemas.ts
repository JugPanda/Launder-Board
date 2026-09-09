import { z } from "zod";

export const ENCOURAGEMENT_PRESET_KEYS = [
  "laundry_quest",
  "shared_load",
  "hall_point",
] as const;

export const REPORT_CATEGORIES = [
  "unwanted",
  "harassment",
  "spam",
  "privacy",
  "unsafe_content",
  "other",
] as const;

const uuid = z.string().uuid();

export const friendRequestSchema = z
  .object({
    targetId: uuid,
  })
  .strict();

export const friendTransitionSchema = z
  .object({
    action: z.enum(["accept", "decline"]),
  })
  .strict();

export const encouragementSendSchema = z
  .object({
    recipientId: uuid,
    presetKey: z.enum(ENCOURAGEMENT_PRESET_KEYS),
  })
  .strict();

export const reportEncouragementSchema = z
  .object({
    category: z.enum(REPORT_CATEGORIES),
  })
  .strict();

export const socialResourceIdSchema = uuid;

export type FriendRequestInput = z.infer<typeof friendRequestSchema>;
export type FriendTransitionInput = z.infer<typeof friendTransitionSchema>;
export type EncouragementSendInput = z.infer<typeof encouragementSendSchema>;
export type EncouragementPresetKey = EncouragementSendInput["presetKey"];
export type ReportCategory = z.infer<typeof reportEncouragementSchema>["category"];
