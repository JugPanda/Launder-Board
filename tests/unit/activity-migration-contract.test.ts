import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0003_activity.sql"),
  "utf8",
);

describe("B3 activity migration contract", () => {
  it.each([
    "laundry_connections",
    "activity_imports",
    "activity_import_rows",
    "laundry_activities",
    "activity_audit_events",
  ])("creates and protects %s with RLS", (table) => {
    expect(migration).toMatch(new RegExp(`create table public\\.${table}\\b`, "i"));
    expect(migration).toMatch(
      new RegExp(`alter table public\\.${table} enable row level security`, "i"),
    );
  });

  it("enforces private upload cleanup and idempotent fingerprints", () => {
    expect(migration).toMatch(/storage_visibility[^,]+default 'private'/i);
    expect(migration).toMatch(/cleanup_due_at/i);
    expect(migration).toMatch(/interval '24 hours'/i);
    expect(migration).toMatch(/unique index[^;]+dedupe_fingerprint/is);
  });

  it("uses correction/retraction functions and does not grant direct deletes", () => {
    expect(migration).toMatch(/function public\.correct_laundry_activity/i);
    expect(migration).toMatch(/function public\.retract_laundry_activity/i);
    expect(migration).not.toMatch(/create policy[^;]+laundry_activities[^;]+for delete/is);
  });

  it("creates deterministic score-ready sessions associated to accepted activities", () => {
    expect(migration).toMatch(/create table public\.laundry_sessions\b/i);
    expect(migration).toMatch(/owner_profile_id uuid not null references public\.profiles/i);
    expect(migration).toMatch(/started_at timestamptz not null/i);
    expect(migration).toMatch(/ended_at timestamptz not null/i);
    expect(migration).toMatch(/qualifying_washer boolean not null/i);
    expect(migration).toMatch(/score_eligible boolean not null/i);
    expect(migration).toMatch(/review_state text not null/i);
    expect(migration).toMatch(/duplicate_of_session_id uuid references public\.laundry_sessions/i);
    expect(migration).toMatch(/add column session_id uuid references public\.laundry_sessions/i);
    expect(migration).toMatch(/function public\.rebuild_laundry_sessions/i);
    expect(migration).toMatch(/interval '120 minutes'/i);
    expect(migration).toMatch(/execute function public\.rebuild_laundry_sessions_for_activity/i);
  });

  it("allows honest manual reported washers and completed imports to qualify", () => {
    expect(migration).toMatch(
      /v_activity\.cycle_status\s+in\s*\(\s*'reported'\s*,\s*'completed'\s*\)/i,
    );
    expect(migration).not.toMatch(/v_qualifying\s+and\s+not\s+v_activity\.synthetic_demo/i);
  });

  it("limits accepted sharing to one co-loader and protects owner/member access", () => {
    expect(migration).toMatch(/create table public\.shared_session_members\b/i);
    expect(migration).toMatch(/member_profile_id uuid not null references public\.profiles/i);
    expect(migration).toMatch(/status text not null[^;]+invited[^;]+accepted[^;]+declined[^;]+retracted/is);
    expect(migration).toMatch(
      /create unique index[^;]+shared_session_members[^;]+session_id[^;]+where status = 'accepted'/is,
    );
    expect(migration).toMatch(/alter table public\.laundry_sessions enable row level security/i);
    expect(migration).toMatch(/alter table public\.shared_session_members enable row level security/i);
    expect(migration).toMatch(/owner_profile_id = \(select public\.current_profile_id\(\)\)/i);
    expect(migration).toMatch(/member_profile_id = \(select public\.current_profile_id\(\)\)/i);
  });

  it("keeps audit events append-only and scopes import rows to their owning import", () => {
    expect(migration).toMatch(/prevent_activity_audit_event_mutation/i);
    expect(migration).toMatch(/before update or delete on public\.activity_audit_events/i);
    expect(migration).toMatch(/foreign key \(import_id, profile_id\)[^;]+activity_imports \(id, profile_id\)/is);
  });
});
