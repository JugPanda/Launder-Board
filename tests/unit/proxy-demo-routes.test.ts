import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
