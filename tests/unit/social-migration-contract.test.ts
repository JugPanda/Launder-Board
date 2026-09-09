import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0006_social_commands.sql"),
  "utf8",
);

describe("B6 transactional social migration", () => {
  it.each([
    "social_list_friends",
    "social_request_friend",
    "social_transition_friend",
    "social_remove_friend",
    "social_set_block",
    "social_list_received_encouragements",
    "social_list_due_candidates",
    "social_send_encouragement",
    "social_set_encouragement_mute",
    "social_report_encouragement",
  ])("defines and grants only the narrow authenticated RPC %s", (name) => {
    expect(migration).toMatch(new RegExp(`function public\\.${name}\\b`, "i"));
    expect(migration).toMatch(
      new RegExp(`revoke all on function public\\.${name}\\([^;]+from public, anon`, "i"),
    );
    expect(migration).toMatch(
      new RegExp(`grant execute on function public\\.${name}\\([^;]+to authenticated`, "i"),
    );
  });

  it("stores private per-recipient mutes behind RLS without participant table access", () => {
    expect(migration).toMatch(/create table public\.encouragement_mutes/i);
    expect(migration).toMatch(/alter table public\.encouragement_mutes enable row level security/i);
    expect(migration).toMatch(/revoke all on table public\.encouragement_mutes from anon, authenticated/i);
  });

  it("locks current participants and makes a bidirectional block win before delivery", () => {
    expect(migration).toMatch(/order by p\.id[\s\S]+for update/i);
    expect(migration).toMatch(
      /social_send_encouragement[\s\S]+if exists \([\s\S]+b\.blocker_id = v_sender_id and b\.blocked_id = p_recipient_id[\s\S]+b\.blocker_id = p_recipient_id and b\.blocked_id = v_sender_id[\s\S]+return jsonb_build_object\('kind', 'blocked'\)/i,
    );
  });

  it("enforces current tracking, accepted-or-opted-in hall audience, mute, 72h cooldown, and rolling cap five in SQL", () => {
    const send = migration.slice(migration.search(/function public\.social_send_encouragement/i));
    expect(send).toMatch(/activity_import_opt_in/i);
    expect(send).toMatch(/tracking_started_at is not null/i);
    expect(send).toMatch(/paused_until is null or[\s\S]+paused_until <= v_now/i);
    expect(send).toMatch(/f\.status = 'accepted'/i);
    expect(send).toMatch(/encouragement_scope = 'hall'[\s\S]+hall_id = v_sender_hall_id/i);
    expect(send).toMatch(/public\.encouragement_mutes/i);
    expect(send).toMatch(/interval '72 hours'/i);
    expect(send).toMatch(/interval '24 hours'/i);
    expect(send).toMatch(/>= 5/i);
  });

  it("keeps reports fixed-category and recipient-only with no free text", () => {
    expect(migration).toMatch(/alter type public\.report_category add value if not exists 'unwanted'/i);
    const report = migration.slice(migration.search(/function public\.social_report_encouragement/i));
    expect(report).toMatch(/recipient_id = v_reporter_id/i);
    expect(report).toMatch(/target_encouragement_id[\s\S]+p_category[\s\S]+null/i);
  });
});
