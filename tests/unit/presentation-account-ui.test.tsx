import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import GuestDemo from "@/components/guest-demo/GuestDemo";
import { GUEST_PARTICIPANTS } from "@/lib/guest-demo";
const mocks = vi.hoisted(() => ({ getPresentationAccount: vi.fn(), createClient: vi.fn() }));
vi.mock("@/lib/hosted-guest/account.server", () => ({ getPresentationAccount: mocks.getPresentationAccount }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
beforeEach(() => {
  mocks.getPresentationAccount.mockReset(); mocks.createClient.mockReset();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ participants: GUEST_PARTICIPANTS, nudgedIds: [], posts: [], providers: { database: "supabase", search: "typesense" }, asOf: "2026-09-08" }) }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("signs out through a normalized internal URL using the public Host", async () => {
  vi.stubEnv("VERCEL", "1");
  mocks.createClient.mockResolvedValue({ auth: { signOut: vi.fn().mockResolvedValue({ error: null }) } });
  const { POST } = await import("@/app/(auth)/sign-out/route");
  const response = await POST(new Request("http://localhost:3000/sign-out", { method: "POST", headers: { Host: "public.example.test", Origin: "https://public.example.test", "x-forwarded-proto": "https" } }));
  expect(response.status).toBe(303); expect(response.headers.get("location")).toBe("https://public.example.test/sign-in");
});
it("renders verified identity, synthetic disclaimer and POST signout", async () => {
  mocks.getPresentationAccount.mockResolvedValue({ id: "user", name: "Presenter", email: "presenter@example.test" });
  const { default: Account } = await import("@/app/(app)/account/page");
  render(await Account());
  expect(screen.getByText("presenter@example.test")).toBeVisible();
  expect(screen.getByRole("heading", { name: /Presenter/ })).toBeVisible();
  expect(screen.getByText(/not a university account/i)).toBeVisible();
  expect(screen.getByRole("button", { name: "Sign out" }).closest("form")).toHaveAttribute("method", "post");
  await screen.findByRole("heading", { name: /meet your clean-o-meter/i });
});
it("redirects without a verified presentation account", async () => {
  mocks.getPresentationAccount.mockResolvedValue(null);
  const { default: Account } = await import("@/app/(app)/account/page");
  await expect(Account()).rejects.toThrow("redirect:/sign-in");
});
it("uses account-bound copy and links without changing fixture identity", async () => {
  render(<GuestDemo accountName="Presenter" />);
  await screen.findByRole("heading", { name: /meet your clean-o-meter/i });
  expect(screen.queryByText(/Zero sign-in/)).toBeNull();
  expect(screen.getByRole("link", { name: "Public demo" })).toHaveAttribute("href", "/demo");
  fireEvent.click(screen.getByRole("tab", { name: "Community" }));
  expect(screen.getByText(/saved updates for your presentation account/i)).toBeVisible();
  expect(screen.getByRole("button", { name: "Reset demo" })).toHaveAttribute("title", "Clear only your account’s demo events");
});
it.each([undefined, "https://evil.test"])("rejects signout from %s", async (origin) => {
  const { POST } = await import("@/app/(auth)/sign-out/route");
  const response = await POST(new Request("https://example.test/sign-out", { method: "POST", headers: origin ? { Origin: origin } : {} }));
  expect(response.status).toBe(403); expect(mocks.createClient).not.toHaveBeenCalled();
});
it("signs out and redirects with no-store", async () => {
  const signOut = vi.fn().mockResolvedValue({ error: null }); mocks.createClient.mockResolvedValue({ auth: { signOut } });
  const { POST } = await import("@/app/(auth)/sign-out/route");
  const response = await POST(new Request("https://example.test/sign-out", { method: "POST", headers: { Origin: "https://example.test" } }));
  expect(signOut).toHaveBeenCalled(); expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe("https://example.test/sign-in");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
