import { z } from "zod";

import {
  DEFAULT_PARTICIPANT_CONSENT,
  ENCOURAGEMENT_SCOPES,
  PROFILE_VISIBILITIES,
  REMINDER_DAY_OPTIONS,
} from "@/lib/permissions/participant-visibility";

const checkboxSchema = z.boolean();
const displayNameSchema = z
  .string()
  .trim()
  .min(2, "Choose a display name with at least 2 characters.")
  .max(40, "Display name must be 40 characters or fewer.")
  .regex(
    /^[\p{L}\p{N}][\p{L}\p{N} ._'’-]*$/u,
    "Display name contains unsupported characters.",
  );
const hallInviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{5,31}$/, "Enter a valid hall invite code.");

export const authCredentialsSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(8).max(128),
  })
  .strict();

export const consentUpdateSchema = z
  .object({
    visibility: z.enum(PROFILE_VISIBILITIES),
    directoryOptIn: checkboxSchema,
    activityImportOptIn: checkboxSchema,
    publicStatsOptIn: checkboxSchema,
    publicHallOptIn: checkboxSchema,
    encouragementScope: z.enum(ENCOURAGEMENT_SCOPES),
    reminderEnabled: checkboxSchema,
    reminderDays: z.union(
      REMINDER_DAY_OPTIONS.map((days) => z.literal(days)) as [
        z.ZodLiteral<7>,
        z.ZodLiteral<14>,
        z.ZodLiteral<21>,
      ],
    ),
  })
  .strict();

export const onboardingInputSchema = consentUpdateSchema
  .partial()
  .extend({
    displayName: displayNameSchema,
    hallInviteCode: hallInviteCodeSchema,
    visibility: z.enum(PROFILE_VISIBILITIES).default(DEFAULT_PARTICIPANT_CONSENT.visibility),
    directoryOptIn: z.boolean().default(DEFAULT_PARTICIPANT_CONSENT.directoryOptIn),
    activityImportOptIn: z.boolean().default(DEFAULT_PARTICIPANT_CONSENT.activityImportOptIn),
    publicStatsOptIn: z.boolean().default(DEFAULT_PARTICIPANT_CONSENT.publicStatsOptIn),
    publicHallOptIn: z.boolean().default(DEFAULT_PARTICIPANT_CONSENT.publicHallOptIn),
    encouragementScope: z
      .enum(ENCOURAGEMENT_SCOPES)
      .default(DEFAULT_PARTICIPANT_CONSENT.encouragementScope),
    reminderEnabled: z.boolean().default(DEFAULT_PARTICIPANT_CONSENT.reminderEnabled),
    reminderDays: z
      .union([z.literal(7), z.literal(14), z.literal(21)])
      .default(DEFAULT_PARTICIPANT_CONSENT.reminderDays),
  })
  .strict();

export type AuthCredentials = z.infer<typeof authCredentialsSchema>;
export type ConsentUpdateInput = z.infer<typeof consentUpdateSchema>;
export type OnboardingInput = z.infer<typeof onboardingInputSchema>;

function formString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" ? value : undefined;
}

function explicitCheckbox(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

function reminderDaysFromForm(formData: FormData): number {
  const raw = formString(formData, "reminderDays");
  return raw === undefined || raw === "" ? DEFAULT_PARTICIPANT_CONSENT.reminderDays : Number(raw);
}

export function parseAuthFormData(formData: FormData): AuthCredentials {
  return authCredentialsSchema.parse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });
}

export function parseOnboardingFormData(formData: FormData): OnboardingInput {
  return onboardingInputSchema.parse({
    displayName: formString(formData, "displayName"),
    hallInviteCode: formString(formData, "hallInviteCode"),
    visibility: formString(formData, "visibility") ?? DEFAULT_PARTICIPANT_CONSENT.visibility,
    directoryOptIn: explicitCheckbox(formData, "directoryOptIn"),
    activityImportOptIn: explicitCheckbox(formData, "activityImportOptIn"),
    publicStatsOptIn: explicitCheckbox(formData, "publicStatsOptIn"),
    publicHallOptIn: explicitCheckbox(formData, "publicHallOptIn"),
    encouragementScope:
      formString(formData, "encouragementScope") ??
      DEFAULT_PARTICIPANT_CONSENT.encouragementScope,
    reminderEnabled: explicitCheckbox(formData, "reminderEnabled"),
    reminderDays: reminderDaysFromForm(formData),
  });
}
