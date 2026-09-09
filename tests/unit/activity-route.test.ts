import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserMock } = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => {
  class AuthenticationRequiredError extends Error {}
  class ActiveProfileRequiredError extends Error {}
  return {
    AuthenticationRequiredError,
    ActiveProfileRequiredError,
    requireUser: requireUserMock,
  };
});

import { DELETE, GET, PATCH } from "@/app/api/activities/[id]/route";

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const ACTIVITY_ID = "22222222-2222-4222-8222-222222222222";

const activityRow = {
  id: ACTIVITY_ID,
  profile_id: PROFILE_ID,
  source: "manual",
  source_record_id_hash: null,
  dedupe_fingerprint: "fingerprint",
  occurred_at: "2026-09-08T14:00:00.000Z",
  machine_kind: "washer",
  cycle_status: "reported",
  evidence_level: "self_reported",
  provider_location_ref_hash: null,
  provider_machine_ref_hash: null,
  raw_import_id: null,
  synthetic_demo: false,
  retracted_at: null,
  retraction_reason: null,
  created_at: "2026-09-08T14:01:00.000Z",
  updated_at: "2026-09-08T14:01:00.000Z",
};

function createSupabase(row: typeof activityRow | null = activityRow) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle,
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  const rpc = vi.fn().mockResolvedValue({ data: activityRow, error: null });
  const from = vi.fn().mockReturnValue(query);
  return { client: { from, rpc }, from, query, rpc };
}

function context(id = ACTIVITY_ID) {
  return { params: Promise.resolve({ id }) };
}

function expectResponse(value: Response | undefined): asserts value is Response {
  expect(value).toBeInstanceOf(Response);
  if (!(value instanceof Response)) {
    throw new Error("Expected route handler to return a Response");
  }
}

beforeEach(() => {
  requireUserMock.mockReset();
});

describe("activity item route", () => {
  it("uses an owner predicate and private no-store responses", async () => {
    const supabase = createSupabase();
    requireUserMock.mockResolvedValue({ supabase: supabase.client, profile: { id: PROFILE_ID } });

    const response = await GET(new Request(`http://local/api/activities/${ACTIVITY_ID}`), context());

    expectResponse(response);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(supabase.query.eq).toHaveBeenNthCalledWith(1, "id", ACTIVITY_ID);
    expect(supabase.query.eq).toHaveBeenNthCalledWith(2, "profile_id", PROFILE_ID);
  });

  it("strictly rejects malformed PATCH input before lookup or mutation", async () => {
    const supabase = createSupabase();
    requireUserMock.mockResolvedValue({ supabase: supabase.client, profile: { id: PROFILE_ID } });

    const response = await PATCH(
      new Request(`http://local/api/activities/${ACTIVITY_ID}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "correct",
          reason: "Wrong machine selected",
          machineKind: "dishwasher",
          unexpected: true,
        }),
      }),
      context(),
    );

    expectResponse(response);
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("normalizes validated correction input before the owner-scoped RPC", async () => {
    const supabase = createSupabase();
    requireUserMock.mockResolvedValue({ supabase: supabase.client, profile: { id: PROFILE_ID } });

    const response = await PATCH(
      new Request(`http://local/api/activities/${ACTIVITY_ID}`, {
        method: "PATCH",
        body: JSON.stringify({
          action: "correct",
          reason: " Wrong timestamp entered ",
          occurredAt: "2026-09-08T10:30:00-04:00",
        }),
      }),
      context(),
    );

    expectResponse(response);
    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith("correct_laundry_activity", {
      p_activity_id: ACTIVITY_ID,
      p_reason: "Wrong timestamp entered",
      p_occurred_at: "2026-09-08T14:30:00.000Z",
      p_machine_kind: null,
      p_cycle_status: null,
    });
  });

  it("implements DELETE as an owner-scoped audited retraction", async () => {
    const supabase = createSupabase();
    requireUserMock.mockResolvedValue({ supabase: supabase.client, profile: { id: PROFILE_ID } });

    const response = await DELETE(
      new Request(`http://local/api/activities/${ACTIVITY_ID}`, {
        method: "DELETE",
        body: JSON.stringify({ reason: " Imported wrong record " }),
      }),
      context(),
    );

    expectResponse(response);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(supabase.query.eq).toHaveBeenNthCalledWith(2, "profile_id", PROFILE_ID);
    expect(supabase.rpc).toHaveBeenCalledWith("retract_laundry_activity", {
      p_activity_id: ACTIVITY_ID,
      p_reason: "Imported wrong record",
    });
  });

  it("rejects unknown DELETE fields without looking up or mutating an activity", async () => {
    const supabase = createSupabase();
    requireUserMock.mockResolvedValue({ supabase: supabase.client, profile: { id: PROFILE_ID } });

    const response = await DELETE(
      new Request(`http://local/api/activities/${ACTIVITY_ID}`, {
        method: "DELETE",
        body: JSON.stringify({ reason: "Imported wrong record", hardDelete: true }),
      }),
      context(),
    );

    expectResponse(response);
    expect(response.status).toBe(400);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("returns 404 without RPC mutation when the owner-scoped record is absent", async () => {
    const supabase = createSupabase(null);
    requireUserMock.mockResolvedValue({ supabase: supabase.client, profile: { id: PROFILE_ID } });

    const response = await DELETE(
      new Request(`http://local/api/activities/${ACTIVITY_ID}`, {
        method: "DELETE",
        body: JSON.stringify({ reason: "Imported wrong record" }),
      }),
      context(),
    );

    expectResponse(response);
    expect(response.status).toBe(404);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});
