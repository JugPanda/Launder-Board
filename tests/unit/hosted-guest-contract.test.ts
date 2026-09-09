import { expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { searchGuestParticipants, matchWashMates } from "@/lib/guest-demo";
afterEach(() => vi.unstubAllEnvs());
it("never falls back to bundled people when a supplied provider dataset is empty", () => {
  expect(searchGuestParticipants({minDays:0}, [])).toEqual([]);
  expect(matchWashMates({days:["Tuesday"],timeWindow:"17:00–19:00"}, [])).toEqual([]);
});
it("lets only explicit hosted-demo endpoints reach their own security checks", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
  for (const path of ["session","bootstrap","search","nudges","posts","reset","index"]) {
    const result = await proxy(new NextRequest(`https://example.com/api/demo/${path}`));
    expect(result.status).toBe(200);
    expect(result.headers.get("x-middleware-next")).toBe("1");
  }
  expect((await proxy(new NextRequest("https://example.com/api/me"))).status).toBe(503);
  expect((await proxy(new NextRequest("https://example.com/api/demo/unrecognized"))).status).toBe(503);
});
