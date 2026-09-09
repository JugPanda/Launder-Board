import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationPath = join(
  root,
  "supabase/migrations/0007_account_and_enrollment.sql",
);

function migration(): string {
  return readFileSync(migrationPath, "utf8");
}

describe("B7 production route contract", () => {
  it.each([
    "app/api/competitions/[id]/enroll/route.ts",
    "app/api/competitions/[id]/leaderboard/route.ts",
    "app/api/public/profiles/[slug]/route.ts",
    "app/api/public/leaderboards/[id]/route.ts",
    "app/api/settings/privacy/route.ts",
    "app/api/account/route.ts",
    "lib/b7/service.server.ts",
  ])("provides %s", (path) => {
    expect(existsSync(join(root, path))).toBe(true);
  });
});

describe("B7 account and enrollment migration contract", () => {
  it("enrolls the authenticated active profile in the next open week", () => {
    const sql = migration();
    expect(sql).toMatch(/function public\.enroll_in_competition\s*\(\s*p_competition_id uuid\s*\)/i);
    expect(sql).toMatch(/v_auth_user_id uuid := auth\.uid\(\)/i);
    expect(sql).toMatch(
      /from public\.profiles(?:\s+as)?\s+p[\s\S]+p\.auth_user_id = v_auth_user_id[\s\S]+p\.active[\s\S]+p\.deleted_at is null[\s\S]+for update/i,
    );
    expect(sql).toMatch(
      /from public\.competition_weeks(?:\s+as)?\s+w[\s\S]+w\.competition_id = p_competition_id[\s\S]+w\.starts_at >= now\(\)[\s\S]+order by w\.starts_at[\s\S]+limit 1/i,
    );
    expect(sql).toMatch(
      /public\.snapshot_competition_enrollment\(\s*p_competition_id,\s*v_week\.week_starts_on,\s*v_profile\.id\s*\)/i,
    );
    expect(sql).toMatch(
      /select\s+\*\s+into\s+v_enrollment\s+from\s+public\.snapshot_competition_enrollment/i,
    );
    expect(sql).toMatch(/return v_enrollment/i);
    expect(sql).toMatch(
      /revoke all on function public\.enroll_in_competition\(uuid\) from public, anon/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.enroll_in_competition\(uuid\) to authenticated/i,
    );
  });

  it("atomically soft-deletes the current profile and queues cleanup", () => {
    const sql = migration();
    expect(sql).toMatch(/create table public\.account_cleanup_outbox/i);
    expect(sql).toMatch(/alter table public\.account_cleanup_outbox enable row level security/i);
    expect(sql).toMatch(
      /revoke all on table public\.account_cleanup_outbox from anon, authenticated/i,
    );
    expect(sql).toMatch(/function public\.delete_current_account\s*\(/i);
    expect(sql).toMatch(
      /from public\.profiles(?:\s+as)?\s+p[\s\S]+p\.auth_user_id = v_auth_user_id[\s\S]+for update/i,
    );
    expect(sql).toMatch(/set active = false[\s\S]+deleted_at = coalesce\(deleted_at, now\(\)\)/i);
    expect(sql).toMatch(/directory_opt_in = false[\s\S]+activity_import_opt_in = false[\s\S]+public_stats_opt_in = false[\s\S]+public_hall_opt_in = false/i);
    expect(sql).toMatch(/encouragement_scope = 'off'[\s\S]+reminder_enabled = false/i);
    expect(sql).toMatch(/update public\.laundry_connections[\s\S]+status = 'disconnected'[\s\S]+provider_account_ref_hash = null/i);
    expect(sql).toMatch(/insert into public\.account_cleanup_outbox/i);
    expect(sql).toMatch(
      /revoke all on function public\.delete_current_account\(\) from public, anon/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.delete_current_account\(\) to authenticated/i,
    );
  });

  it("keeps enrollment and cleanup storage inaccessible directly", () => {
    const sql = migration();
    expect(sql).toMatch(
      /revoke all on table public\.competition_enrollments from anon, authenticated/i,
    );
    expect(sql).toMatch(
      /grant select, update, delete on table public\.account_cleanup_outbox to service_role/i,
    );
  });
});
