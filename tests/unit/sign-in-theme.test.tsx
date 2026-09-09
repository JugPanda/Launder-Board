import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import SignInPage from "@/app/(auth)/sign-in/page";

vi.mock("@/lib/supabase/env", () => ({
  isSupabaseAuthConfigured: () => true,
}));

afterEach(cleanup);

it("uses the warm LaundroStat identity and keeps the sign-in task obvious", async () => {
  vi.stubEnv("LAUNDER_BOARD_DEMO_MODE", "enabled");
  render(await SignInPage({ searchParams: Promise.resolve({}) }));

  expect(screen.getByRole("link", { name: /LaundroStat.*laundry, together/i })).toHaveAttribute("href", "/");
  expect(screen.getByRole("heading", { name: "Demo account sign in" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Your laundry routine, in one place." })).toBeVisible();
  expect(screen.getByLabelText("Email")).toHaveAttribute("autocomplete", "email");
  expect(screen.getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
  expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
  expect(screen.getByRole("link", { name: /Explore the public demo/i })).toHaveAttribute("href", "/demo");
});

it("preserves the presentation disclaimer next to the form", async () => {
  vi.stubEnv("LAUNDER_BOARD_DEMO_MODE", "enabled");
  render(await SignInPage({ searchParams: Promise.resolve({}) }));

  expect(screen.getByText(/synthetic demo, not a university account/i)).toBeVisible();
  expect(screen.getAllByText(/No real students are contacted/i).length).toBeGreaterThanOrEqual(1);
  vi.unstubAllEnvs();
});
