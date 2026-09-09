import { z } from "zod";

const limitSchema = z.number().int().min(1).max(50).default(20);
const daySchema = z
  .number()
  .int()
  .nonnegative()
  .max(8_640_000_000)
  .refine((value) => value % 86_400 === 0, "Timestamp must be a UTC day epoch");
const identifierSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const querySchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Query contains control characters");

const displayNameSearchSchema = z
  .object({
    preset: z.literal("display_name"),
    query: querySchema,
    limit: limitSchema,
  })
  .strict();

const acceptedFriendCutoffSchema = z
  .object({
    preset: z.literal("accepted_friend_cutoff"),
    cutoff_day: daySchema,
    freshness_floor_day: daySchema,
    limit: limitSchema,
  })
  .strict();

const chosenReminderSchema = z
  .object({
    preset: z.literal("chosen_reminder"),
    due_day: daySchema,
    freshness_floor_day: daySchema,
    limit: limitSchema,
  })
  .strict();

const participantSearchSchema = z.discriminatedUnion("preset", [
  displayNameSearchSchema,
  acceptedFriendCutoffSchema,
  chosenReminderSchema,
]);

const hallParticipationSchema = z
  .object({
    preset: z.literal("hall_participation"),
    competition_id: identifierSchema,
    week_start_day: daySchema,
    query: z
      .string()
      .trim()
      .max(80)
      .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "Query contains control characters")
      .default("*"),
    limit: limitSchema,
  })
  .strict();

export type ParticipantSearchInput = z.output<typeof participantSearchSchema>;
export type HallSearchInput = z.output<typeof hallParticipationSchema>;

export interface SafeSearchParameters {
  q: string;
  query_by: string;
  filter_by: string;
  sort_by: string;
  include_fields: "id";
  per_page: number;
  page: 1;
  enable_analytics: false;
  prefix?: boolean;
}

export function parseParticipantSearchInput(input: unknown): ParticipantSearchInput {
  return participantSearchSchema.parse(input);
}

export function parseHallSearchInput(input: unknown): HallSearchInput {
  return hallParticipationSchema.parse(input);
}

/** Quote a Typesense filter literal and escape its two quoting metacharacters. */
export function escapeFilterValue(value: string): string {
  return `\`${value.replaceAll("\\", "\\\\").replaceAll("`", "\\`")}\``;
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter((id) => id.length > 0))];
}

export function buildIdFilter(ids: readonly string[]): string {
  return `id:=[${uniqueIds(ids).map(escapeFilterValue).join(",")}]`;
}

export function buildParticipantSearchParameters(
  input: ParticipantSearchInput,
  authorizedIds: readonly string[],
): SafeSearchParameters | null {
  const ids = uniqueIds(authorizedIds);
  if (ids.length === 0) return null;

  const base = {
    query_by: "display_name",
    include_fields: "id" as const,
    per_page: input.limit,
    page: 1 as const,
    enable_analytics: false as const,
  };
  const idFilter = buildIdFilter(ids);

  switch (input.preset) {
    case "display_name":
      return {
        ...base,
        q: input.query,
        filter_by: idFilter,
        sort_by: "_text_match:desc,display_name:asc",
        prefix: true,
      };
    case "accepted_friend_cutoff":
      return {
        ...base,
        q: "*",
        filter_by:
          `${idFilter} && tracking_state:=${escapeFilterValue("current")}` +
          ` && activity_anchor_day:<${input.cutoff_day}` +
          ` && data_fresh_through_day:>=${input.freshness_floor_day}`,
        sort_by: "activity_anchor_day:asc,display_name:asc",
      };
    case "chosen_reminder":
      return {
        ...base,
        q: "*",
        filter_by:
          `${idFilter} && tracking_state:=${escapeFilterValue("current")}` +
          ` && reminder_due_day:<=${input.due_day}` +
          ` && data_fresh_through_day:>=${input.freshness_floor_day}`,
        sort_by: "reminder_due_day:asc,display_name:asc",
      };
  }
}

export function buildHallSearchParameters(
  input: HallSearchInput,
  authorizedIds: readonly string[],
): SafeSearchParameters | null {
  const ids = uniqueIds(authorizedIds);
  if (ids.length === 0) return null;

  return {
    q: input.query || "*",
    query_by: "hall_name",
    filter_by:
      `${buildIdFilter(ids)}` +
      ` && competition_id:=${escapeFilterValue(input.competition_id)}` +
      ` && week_start_day:=${input.week_start_day}` +
      " && minimum_met:=true && is_public:=true",
    sort_by: "participation_rate:desc,hall_name:asc",
    include_fields: "id",
    per_page: input.limit,
    page: 1,
    enable_analytics: false,
    prefix: true,
  };
}
