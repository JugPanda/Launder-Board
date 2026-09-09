import { describe, expect, it, vi } from "vitest";

import {
  createHallSearchHandler,
  createParticipantSearchHandler,
  createSearchIndexHandler,
} from "@/lib/typesense/http";
import { SearchUnavailableError } from "@/lib/typesense/search";

const identity = { callerId: "viewer-1", context: { requestClient: true } };

function jsonRequest(path: string, body: unknown) {
  return new Request(`http://local${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("participant search route policy", () => {
  it("rejects anonymous callers before search", async () => {
    const execute = vi.fn();
    const handler = createParticipantSearchHandler({
      authenticate: vi.fn(async () => null),
      execute,
    });

    const response = await handler(
      jsonRequest("/api/search/participants", {
        preset: "display_name",
        query: "Maya",
      }),
    );

    expect(response.status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });

  it("strictly rejects client query-shape overrides", async () => {
    const execute = vi.fn();
    const handler = createParticipantSearchHandler({
      authenticate: vi.fn(async () => identity),
      execute,
    });

    const response = await handler(
      jsonRequest("/api/search/participants", {
        preset: "display_name",
        query: "Maya",
        filter_by: "visibility:=public",
      }),
    );

    expect(response.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it("returns only the allowlisted rehydrated envelope", async () => {
    const execute = vi.fn(async () => ({
      hits: [{ id: "profile-1", display_name: "Maya" }],
      returned_count: 1,
    }));
    const handler = createParticipantSearchHandler({
      authenticate: vi.fn(async () => identity),
      execute,
    });

    const response = await handler(
      jsonRequest("/api/search/participants", {
        preset: "display_name",
        query: "Maya",
        limit: 10,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      hits: [{ id: "profile-1", display_name: "Maya" }],
      returned_count: 1,
    });
    expect(execute).toHaveBeenCalledWith(identity, {
      preset: "display_name",
      query: "Maya",
      limit: 10,
    });
  });

  it("fails closed with a safe unavailable response", async () => {
    const handler = createParticipantSearchHandler({
      authenticate: vi.fn(async () => identity),
      execute: vi.fn(async () => {
        throw new SearchUnavailableError(new Error("private upstream detail"));
      }),
    });

    const response = await handler(
      jsonRequest("/api/search/participants", {
        preset: "display_name",
        query: "Maya",
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "search_unavailable" });
  });
});

describe("hall search route policy", () => {
  it("rejects raw Typesense controls and non-day epochs", async () => {
    const execute = vi.fn();
    const handler = createHallSearchHandler({
      authenticate: vi.fn(async () => identity),
      execute,
    });

    const overrideResponse = await handler(
      jsonRequest("/api/search/halls", {
        preset: "hall_participation",
        competition_id: "fall-weekly-quest",
        week_start_day: 1_788_739_200,
        sort_by: "eligible_count:desc",
      }),
    );
    const nonDayResponse = await handler(
      jsonRequest("/api/search/halls", {
        preset: "hall_participation",
        competition_id: "fall-weekly-quest",
        week_start_day: 1_788_739_201,
      }),
    );

    expect(overrideResponse.status).toBe(400);
    expect(nonDayResponse.status).toBe(400);
    expect(execute).not.toHaveBeenCalled();
  });

  it("maps current-profile denial without querying", async () => {
    const execute = vi.fn();
    const handler = createHallSearchHandler({
      authenticate: vi.fn(async () => {
        throw Object.assign(new Error("profile"), { status: 403 });
      }),
      execute,
    });

    const response = await handler(
      jsonRequest("/api/search/halls", {
        preset: "hall_participation",
        competition_id: "fall-weekly-quest",
        week_start_day: 1_788_739_200,
      }),
    );

    expect(response.status).toBe(403);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("internal search-index route policy", () => {
  it.each([
    undefined,
    "Bearer wrong",
    "Bearer  cron-secret",
    "cron-secret",
  ])("rejects a non-exact cron credential: %s", async (authorization) => {
    const execute = vi.fn();
    const handler = createSearchIndexHandler({ secret: "cron-secret", execute });
    const headers = authorization ? { authorization } : undefined;

    const response = await handler(
      new Request("http://local/api/internal/search-index", {
        method: "POST",
        headers,
      }),
    );

    expect(response.status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });

  it("runs the real worker seam only for the exact Bearer secret", async () => {
    const execute = vi.fn(async () => ({ processed: 3, succeeded: 2, failed: 1 }));
    const handler = createSearchIndexHandler({ secret: "cron-secret", execute });

    const response = await handler(
      new Request("http://local/api/internal/search-index", {
        method: "POST",
        headers: { authorization: "Bearer cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      processed: 3,
      succeeded: 2,
      failed: 1,
    });
    expect(execute).toHaveBeenCalledOnce();
  });

  it("never authorizes when the server secret is missing", async () => {
    const execute = vi.fn();
    const handler = createSearchIndexHandler({ secret: undefined, execute });

    const response = await handler(
      new Request("http://local/api/internal/search-index", {
        method: "POST",
        headers: { authorization: "Bearer undefined" },
      }),
    );

    expect(response.status).toBe(401);
    expect(execute).not.toHaveBeenCalled();
  });
});
