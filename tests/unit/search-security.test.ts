import { describe, expect, it, vi } from "vitest";

import {
  SearchUnavailableError,
  executeParticipantSearch,
  type ParticipantAuthorizationStore,
  type ParticipantSearchIndex,
} from "@/lib/typesense/search";
import {
  buildIdFilter,
  buildParticipantSearchParameters,
  escapeFilterValue,
  parseParticipantSearchInput,
} from "@/lib/typesense/query-builders";

const callerId = "viewer-1";
const ids = ["profile-1", "profile-2"];

function input() {
  return parseParticipantSearchInput({
    preset: "display_name",
    query: "Maya",
    limit: 10,
  });
}

describe("secure participant search boundary", () => {
  it("rejects client filter, sort, collection, and projection overrides", () => {
    for (const maliciousField of [
      { filter_by: "visibility:=public" },
      { sort_by: "email:asc" },
      { collection: "profiles" },
      { include_fields: "email" },
    ]) {
      expect(() =>
        parseParticipantSearchInput({
          preset: "display_name",
          query: "Maya",
          ...maliciousField,
        }),
      ).toThrow();
    }
  });

  it("escapes filter values and builds an allowlisted ID filter", () => {
    expect(escapeFilterValue("a`b\\c,]"))
      .toBe("`a\\`b\\\\c,]`");
    expect(buildIdFilter(["safe", "a`b"])).toBe(
      "id:=[`safe`,`a\\`b`]",
    );
  });

  it("never builds or runs a query for an empty authorized ID set", async () => {
    expect(buildParticipantSearchParameters(input(), [])).toBeNull();

    const index: ParticipantSearchIndex = { search: vi.fn() };
    const authorization: ParticipantAuthorizationStore = {
      getAuthorizedIds: vi.fn().mockResolvedValue([]),
      rehydrateAuthorized: vi.fn(),
    };

    await expect(
      executeParticipantSearch({ callerId, input: input(), authorization, index }),
    ).resolves.toEqual({ hits: [], returned_count: 0 });
    expect(index.search).not.toHaveBeenCalled();
    expect(authorization.rehydrateAuthorized).not.toHaveBeenCalled();
  });

  it("puts PostgreSQL-authorized IDs in the filter before querying", async () => {
    const search = vi.fn().mockResolvedValue({
      hits: ids.map((id) => ({ document: { id } })),
      found: 2,
      out_of: 500,
      facet_counts: [{ field_name: "tracking_state", counts: [] }],
      request_params: { q: "Maya" },
    });
    const authorization: ParticipantAuthorizationStore = {
      getAuthorizedIds: vi.fn().mockResolvedValue(ids),
      rehydrateAuthorized: vi.fn().mockResolvedValue([
        { id: "profile-1", display_name: "Maya A", email: "private@example.test" },
        { id: "profile-2", display_name: "Maya B", report_count: 4 },
      ]),
    };

    const result = await executeParticipantSearch({
      callerId,
      input: input(),
      authorization,
      index: { search },
    });

    expect(search).toHaveBeenCalledOnce();
    expect(search.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        filter_by: "id:=[`profile-1`,`profile-2`]",
        sort_by: "_text_match:desc,display_name:asc",
        include_fields: "id",
        enable_analytics: false,
      }),
    );
    expect(result).toEqual({
      hits: [
        { id: "profile-1", display_name: "Maya A" },
        { id: "profile-2", display_name: "Maya B" },
      ],
      returned_count: 2,
    });
    expect(result).not.toHaveProperty("found");
    expect(result).not.toHaveProperty("out_of");
    expect(JSON.stringify(result)).not.toMatch(/email|report|facet|highlight|request_params/i);
  });

  it("drops a stale privacy document during current PostgreSQL rehydration", async () => {
    const authorization: ParticipantAuthorizationStore = {
      getAuthorizedIds: vi.fn().mockResolvedValue(ids),
      rehydrateAuthorized: vi.fn().mockResolvedValue([
        { id: "profile-2", display_name: "Still allowed" },
      ]),
    };
    const index: ParticipantSearchIndex = {
      search: vi.fn().mockResolvedValue({
        hits: ids.map((id) => ({ document: { id } })),
      }),
    };

    await expect(
      executeParticipantSearch({ callerId, input: input(), authorization, index }),
    ).resolves.toEqual({
      hits: [{ id: "profile-2", display_name: "Still allowed" }],
      returned_count: 1,
    });
    expect(authorization.rehydrateAuthorized).toHaveBeenCalledWith(
      callerId,
      ids,
      input(),
    );
  });

  it("drops a friend removed or blocked after the pre-search authorization read", async () => {
    const authorization: ParticipantAuthorizationStore = {
      getAuthorizedIds: vi.fn().mockResolvedValue(["friend-1"]),
      rehydrateAuthorized: vi.fn().mockResolvedValue([]),
    };
    const index: ParticipantSearchIndex = {
      search: vi.fn().mockResolvedValue({
        hits: [{ document: { id: "friend-1" } }],
      }),
    };

    const dueInput = parseParticipantSearchInput({
      preset: "accepted_friend_cutoff",
      cutoff_day: 1_788_825_600,
      freshness_floor_day: 1_788_825_600,
    });

    await expect(
      executeParticipantSearch({ callerId, input: dueInput, authorization, index }),
    ).resolves.toEqual({ hits: [], returned_count: 0 });
  });

  it("fails closed when the search index is unavailable", async () => {
    const authorization: ParticipantAuthorizationStore = {
      getAuthorizedIds: vi.fn().mockResolvedValue(["profile-1"]),
      rehydrateAuthorized: vi.fn(),
    };
    const index: ParticipantSearchIndex = {
      search: vi.fn().mockRejectedValue(new Error("connection refused")),
    };

    await expect(
      executeParticipantSearch({ callerId, input: input(), authorization, index }),
    ).rejects.toBeInstanceOf(SearchUnavailableError);
    expect(authorization.rehydrateAuthorized).not.toHaveBeenCalled();
  });
});
