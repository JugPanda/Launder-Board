import { describe, expect, it } from "vitest";

import {
  authCredentialsSchema,
  consentUpdateSchema,
  onboardingInputSchema,
  parseOnboardingFormData,
} from "@/lib/validation/profile";

const validOnboarding = {
  displayName: "Maya P.",
  hallInviteCode: "MAPLE-2026",
};

describe("profile request validation", () => {
  it("normalizes an email address and rejects weak credentials", () => {
    expect(
      authCredentialsSchema.parse({ email: "  MAYA@EXAMPLE.COM ", password: "long-enough" }),
    ).toEqual({ email: "maya@example.com", password: "long-enough" });
    expect(authCredentialsSchema.safeParse({ email: "nope", password: "short" }).success).toBe(
      false,
    );
  });

  it("applies private/off onboarding defaults", () => {
    expect(onboardingInputSchema.parse(validOnboarding)).toEqual({
      ...validOnboarding,
      visibility: "private",
      directoryOptIn: false,
      activityImportOptIn: false,
      publicStatsOptIn: false,
      publicHallOptIn: false,
      encouragementScope: "off",
      reminderEnabled: false,
      reminderDays: 14,
    });
  });

  it("trims display names and canonicalizes invite codes", () => {
    expect(
      onboardingInputSchema.parse({
        displayName: "  Maya P.  ",
        hallInviteCode: " maple-2026 ",
      }),
    ).toMatchObject({ displayName: "Maya P.", hallInviteCode: "MAPLE-2026" });
  });

  it.each([
    [{ ...validOnboarding, displayName: "M" }, "short display name"],
    [{ ...validOnboarding, displayName: "Maya<script>" }, "unsafe display name"],
    [{ ...validOnboarding, hallInviteCode: "abc" }, "short invite code"],
    [{ ...validOnboarding, hallInviteCode: "MAPLE 2026" }, "malformed invite code"],
    [{ ...validOnboarding, reminderDays: 10 }, "unsupported reminder interval"],
    [{ ...validOnboarding, admin: true }, "unknown key"],
  ])("rejects %s (%s)", (input, caseName) => {
    expect(onboardingInputSchema.safeParse(input).success, caseName).toBe(false);
  });

  it("parses only explicit HTML checkbox values as consent", () => {
    const form = new FormData();
    form.set("displayName", "Maya P.");
    form.set("hallInviteCode", "maple-2026");
    form.set("directoryOptIn", "on");
    form.set("publicStatsOptIn", "true");
    form.set("reminderDays", "21");

    expect(parseOnboardingFormData(form)).toMatchObject({
      directoryOptIn: true,
      publicStatsOptIn: false,
      activityImportOptIn: false,
      reminderDays: 21,
    });
  });

  it("rejects bundled or unknown consent properties", () => {
    expect(
      consentUpdateSchema.safeParse({
        directoryOptIn: true,
        publicStatsOptIn: true,
        acceptEverything: true,
      }).success,
    ).toBe(false);
  });
});
