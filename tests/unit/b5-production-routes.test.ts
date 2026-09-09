import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("B5 production search wiring", () => {
  it.each([
    "lib/typesense/supabase-adapters.server.ts",
    "app/api/search/participants/route.ts",
    "app/api/search/halls/route.ts",
    "app/api/internal/search-index/route.ts",
    "app/(app)/search/page.tsx",
  ])("provides %s", (path) => {
    expect(existsSync(join(root, path))).toBe(true);
  });

  it("uses participant-scoped Supabase RPC authorization and rehydration", () => {
    const adapters = source("lib/typesense/supabase-adapters.server.ts");
    expect(adapters).toMatch(/search_authorized_participant_ids/);
    expect(adapters).toMatch(/search_rehydrate_participants/);
    expect(adapters).toMatch(/search_authorized_hall_result_ids/);
    expect(adapters).toMatch(/search_rehydrate_hall_results/);
  });

  it("uses service-role outbox RPCs and both Typesense aliases", () => {
    const adapters = source("lib/typesense/supabase-adapters.server.ts");
    expect(adapters).toMatch(/claim_search_outbox/);
    expect(adapters).toMatch(/load_search_projection/);
    expect(adapters).toMatch(/complete_search_outbox/);
    expect(adapters).toMatch(/fail_search_outbox/);
    expect(adapters).toMatch(/PARTICIPANTS_ALIAS/);
    expect(adapters).toMatch(/HALL_RESULTS_ALIAS/);
  });

  it("authenticates public search routes and exactly guards the worker route", () => {
    expect(source("app/api/search/participants/route.ts")).toMatch(/requireUser/);
    expect(source("app/api/search/halls/route.ts")).toMatch(/requireUser/);
    const worker = source("app/api/internal/search-index/route.ts");
    expect(worker).toMatch(/process\.env\.CRON_SECRET/);
    expect(worker).toMatch(/ensureTypesenseCollections/);
    expect(worker).toMatch(/await ensureTypesenseCollections[\s\S]+processSearchOutbox/);
    expect(worker).toMatch(/processSearchOutbox/);
  });
});
