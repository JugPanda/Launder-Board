import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const seed = readFileSync(join(process.cwd(), "supabase/seed/demo.sql"), "utf8");

describe("deterministic synthetic demo seed contract", () => {
  it("defines exactly 18 synthetic profiles across three halls", () => {
    expect(seed.match(/@demo\.invalid/g)).toHaveLength(18);
    expect(seed.match(/'synthetic-campus', '(?:Maple|River|Oak) Hall'/g)).toHaveLength(3);
  });

  it("labels every required synthetic activity edge case", () => {
    for (const label of [
      "current", "due", "stale", "unknown", "dryer", "failed", "refunded",
      "duplicate-attempt-record", "shared", "late",
    ]) {
      expect(seed).toContain(`case: ${label}`);
    }
    expect(seed).not.toMatch(/provider_confirmed/i);
  });

  it("seeds one active competition, two fixed New York weeks, and 18 locked current enrollments", () => {
    expect(seed).toContain("Synthetic Laundry League");
    expect(seed).toContain("America/Indiana/Indianapolis");
    expect(seed).toContain("'2026-09-07'::date");
    expect(seed).toContain("'2026-09-14'::date");
    expect(seed).toContain("generate_series(201, 218)");
    expect(seed).toContain("case: immutable-current-week-enrollments count=18");
  });

  it("awards normalized current-week results of Maple 4/6, River 3/6, and Oak 2/6", () => {
    expect(seed.match(/award_weekly_credit\(/g)).toHaveLength(9);
    expect(seed).toContain("expected-result: Maple Hall 4/6");
    expect(seed).toContain("expected-result: River Hall 3/6");
    expect(seed).toContain("expected-result: Oak Hall 2/6");
  });
});
