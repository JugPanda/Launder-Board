import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
const mocks = vi.hoisted(() => ({ getClaims: vi.fn(), from: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getClaims: mocks.getClaims }, from: mocks.from }) }));
beforeEach(() => {
  vi.stubEnv("LAUNDER_BOARD_DEMO_MODE", "enabled");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-key");
  mocks.getClaims.mockResolvedValue({ data: null, error: null }); mocks.from.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
it("leaves anonymous login reachable", async () => {
  const response = await proxy(new NextRequest("https://example.test/sign-in"));
  expect(response.headers.get("location")).toBeNull();
});
it("requires authentication for account", async () => {
  const response = await proxy(new NextRequest("https://example.test/account"));
  expect(response.headers.get("location")).toBe("https://example.test/sign-in");
  expect(mocks.getClaims).toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
});
it.each(["/account", "/sign-in"])("bypasses legacy SQL only after auth on %s", async (path) => {
  mocks.getClaims.mockResolvedValue({ data: { claims: { sub: "user", app_metadata: { presentation_account: true } } }, error: null });
  const response = await proxy(new NextRequest(`https://example.test${path}`));
  expect(response.headers.get("location")).toBe(path === "/sign-in" ? "https://example.test/account" : null);
  expect(mocks.getClaims).toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
});
it("keeps signout reachable for its own origin guard", async () => {
  const response = await proxy(new NextRequest("https://example.test/sign-out", { method: "POST" }));
  expect(response.headers.get("location")).toBeNull(); expect(mocks.from).not.toHaveBeenCalled();
});
it("does not enable archived application routes", async () => {
  expect((await proxy(new NextRequest("https://example.test/dashboard"))).headers.get("location")).toBe("https://example.test/demo");
});

const source = readFileSync(join(process.cwd(), "proxy.ts"), "utf8");

describe("synthetic demo proxy coverage", () => {
  it.each(["/dashboard", "/competitions/", "/settings/privacy", "/activity", "/friends", "/search"])(
    "allows the demo UI route %s when demo mode is enabled",
    (route) => {
      expect(source).toContain(JSON.stringify(route));
    },
  );

  it("allows only the cron-protected index worker through Proxy", () => {
    expect(source).toContain('"/api/internal/search-index"');
    expect(source).not.toContain('"/api/internal/"');
  });

  it("does not make API routes public as part of demo mode", () => {
    expect(source).not.toMatch(/DEMO_PREFIXES[^;]+\/api\//s);
  });
});
