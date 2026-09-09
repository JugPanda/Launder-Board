import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/0005_search_outbox.sql"),
  "utf8",
);

describe("search outbox migration", () => {
  it("creates a private coalescing outbox with monotonic bigint versions", () => {
    expect(migration).toMatch(/create sequence public\.search_projection_version_seq/i);
    expect(migration).toMatch(/projection_version bigint not null/i);
    expect(migration).toMatch(/unique \(entity_type, entity_id\)/i);
    expect(migration).toMatch(/excluded\.projection_version > search_outbox\.projection_version/i);
    expect(migration).toMatch(/enable row level security/i);
    expect(migration).toMatch(/revoke all on public\.search_outbox from anon, authenticated/i);
  });

  it("enqueues profile withdrawals and deleted hall publications as deletes", () => {
    expect(migration).toMatch(/enqueue_profile_search_projection/i);
    expect(migration).toMatch(/directory_opt_in/i);
    expect(migration).toMatch(/deleted_at/i);
    expect(migration).toMatch(/enqueue_hall_result_search_projection/i);
    expect(migration).toMatch(/minimum_met/i);
    expect(migration).toMatch(/is_public/i);
  });
});
