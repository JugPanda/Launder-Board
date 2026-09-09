import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const core = readFileSync(join(root, "supabase/migrations/0001_core.sql"), "utf8");
const social = readFileSync(join(root, "supabase/migrations/0002_social.sql"), "utf8");

describe("B2 migration contracts", () => {
  it.each([
    "profiles",
    "residence_halls",
    "hall_invites",
    "consent_events",
  ])("creates and enables RLS on core table %s", (table) => {
    expect(core).toMatch(new RegExp(`create table public\\.${table}\\b`, "i"));
    expect(core).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
  });

  it.each(["friendships", "blocks", "reports", "encouragements"])(
    "creates and enables RLS on social table %s",
    (table) => {
      expect(social).toMatch(new RegExp(`create table public\\.${table}\\b`, "i"));
      expect(social).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    },
  );

  it("keeps profile and consent defaults private/off", () => {
    expect(core).toMatch(/visibility[^,]+default 'private'/i);
    expect(core).toMatch(/directory_opt_in[^,]+default false/i);
    expect(core).toMatch(/activity_import_opt_in[^,]+default false/i);
    expect(core).toMatch(/public_stats_opt_in[^,]+default false/i);
    expect(core).toMatch(/public_hall_opt_in[^,]+default false/i);
    expect(core).toMatch(/reminder_enabled[^,]+default false/i);
    expect(core).toMatch(/encouragement_scope[^,]+default 'off'/i);
  });

  it("validates hall invites inside a server-side database function", () => {
    expect(core).toMatch(/create or replace function public\.complete_onboarding/i);
    expect(core).toMatch(/for update/i);
    expect(core).toMatch(/digest\(/i);
    expect(core).toMatch(/expires_at/i);
    expect(core).toMatch(/use_limit/i);
  });

  it("does not grant participant reads on invite hashes or reports", () => {
    expect(core.replaceAll("\n", " ")).not.toMatch(
      /create policy[^;]+on public\.hall_invites[^;]+for select/i,
    );
    expect(social.replaceAll("\n", " ")).not.toMatch(
      /create policy[^;]+on public\.reports[^;]+for select/i,
    );
  });
});
