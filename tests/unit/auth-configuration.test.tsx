import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SignInPage from "@/app/(auth)/sign-in/page";
import { POST } from "@/app/(auth)/sign-in/actions/route";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => mocks);
const credentials = { email: "person@example.com", password: "never-log-this-password", intent: "sign-in" };
function request(intent = "sign-in") {
  return new Request("https://launderboard.vercel.app/sign-in/actions", {
    method: "POST", body: new URLSearchParams({ ...credentials, intent }),
  });
}
function configured() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
}
function provider(profile: object | null = null) {
  const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), not: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }) };
  for (const method of [query.select, query.eq, query.is, query.not]) method.mockReturnValue(query);
  return { auth: { signUp: vi.fn().mockResolvedValue({ error: null }), signInWithPassword: vi.fn().mockResolvedValue({ error: null }), getClaims: vi.fn().mockResolvedValue({ data: { claims: { sub: "user-id" } }, error: null }) }, from: vi.fn().mockReturnValue(query) };
}
beforeEach(() => { vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ""); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ""); vi.stubEnv("LAUNDER_BOARD_DEMO_MODE", "enabled"); mocks.createClient.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });

describe("auth configuration boundary", () => {
  it("renders setup pending without collecting credentials", async () => {
    const { container } = render(await SignInPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("heading", { name: /account setup pending/i })).toBeVisible();
    expect(container.querySelector("form")).toBeNull();
    expect(screen.getByRole("link", { name: /view synthetic demo/i })).toHaveAttribute("href", "/dashboard");
  });
  it("uses a public demo when private demo routes are disabled", async () => {
    vi.stubEnv("LAUNDER_BOARD_DEMO_MODE", "disabled");
    render(await SignInPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("link", { name: /view synthetic demo/i })).toHaveAttribute("href", "/leaderboards/fall-weekly-quest");
  });
  it.each(["sign-in", "sign-up"])("blocks unconfigured %s before provider initialization", async (intent) => {
    const response = await POST(request(intent));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("setup");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("rejects whitespace keys without leaking configuration values", () => {
    expect(() => getPublicSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "   " })).toThrow("Supabase authentication is not configured");
  });
  it("renders the configured form without requiring a service-role key", async () => {
    configured(); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    render(await SignInPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Create account" })).toBeVisible();
  });
  it.each([null, { id: "profile-id" }])("preserves configured routing for profile %j", async (profile) => {
    configured(); const client = provider(profile); mocks.createClient.mockResolvedValue(client);
    const response = await POST(request());
    expect(response.headers.get("location")).toBe(`https://launderboard.vercel.app/${profile ? "dashboard" : "onboarding"}`);
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: credentials.email, password: credentials.password });
  });
  it.each(["init", "signInWithPassword", "getClaims", "profile"])("sanitizes a network failure at %s", async (stage) => {
    configured(); const client = provider(); const error = new Error(credentials.password);
    mocks.createClient.mockResolvedValue(client);
    if (stage === "init") mocks.createClient.mockRejectedValue(error);
    else if (stage === "profile") client.from().maybeSingle.mockRejectedValue(error);
    else client.auth[stage as "signInWithPassword" | "getClaims"].mockRejectedValue(error);
    const response = await POST(request());
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("temporarily");
    expect(response.headers.get("location")).not.toContain(credentials.password);
  });
  it("keeps email confirmation pending rather than faking a session", async () => {
    configured(); const client = provider(); client.auth.getClaims.mockResolvedValue({ data: null, error: null }); mocks.createClient.mockResolvedValue(client);
    const response = await POST(request("sign-up"));
    expect(response.headers.get("location")).toContain("confirm");
    expect(client.from).not.toHaveBeenCalled();
  });
  it("does not mislabel a returned claims outage as email confirmation", async () => {
    configured(); const client = provider();
    client.auth.getClaims.mockResolvedValue({ data: null, error: { name: "AuthRetryableFetchError", status: 503, message: credentials.password } });
    mocks.createClient.mockResolvedValue(client);
    const response = await POST(request());
    expect(response.headers.get("location")).toContain("temporarily");
    expect(response.headers.get("location")).not.toContain(credentials.password);
    expect(client.from).not.toHaveBeenCalled();
  });
});
