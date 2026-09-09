import type {
  HallSearchInput,
  ParticipantSearchInput,
} from "@/lib/typesense/query-builders";
import {
  parseHallSearchInput,
  parseParticipantSearchInput,
} from "@/lib/typesense/query-builders";
import type { HallResult, ParticipantResult } from "@/lib/typesense/rehydrate";

export interface SearchRequestIdentity<TContext> {
  callerId: string;
  context: TContext;
}

interface SearchHandlerDependencies<TContext, TInput, TResult> {
  authenticate(): Promise<SearchRequestIdentity<TContext> | null>;
  execute(identity: SearchRequestIdentity<TContext>, input: TInput): Promise<TResult>;
}

interface SearchIndexResult {
  processed: number;
  succeeded: number;
  failed: number;
}

const privateHeaders = { "cache-control": "no-store" };

function json(body: unknown, status = 200, headers?: HeadersInit) {
  return Response.json(body, {
    status,
    headers: { ...privateHeaders, ...headers },
  });
}

function authenticationStatus(error: unknown): 401 | 403 | null {
  if (typeof error !== "object" || error === null || !("status" in error)) return null;
  const status = error.status;
  return status === 401 || status === 403 ? status : null;
}

function authenticationError(status: 401 | 403) {
  return json(
    { error: status === 401 ? "authentication_required" : "active_profile_required" },
    status,
  );
}

async function parseJson(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const bytes = Number(contentLength);
    if (!Number.isFinite(bytes) || bytes < 0 || bytes > 8_192) {
      throw new TypeError("Invalid search request size");
    }
  }
  return request.json();
}

function createSearchHandler<TContext, TInput, TResult>({
  authenticate,
  execute,
  parse,
}: SearchHandlerDependencies<TContext, TInput, TResult> & {
  parse(input: unknown): TInput;
}) {
  return async function POST(request: Request): Promise<Response> {
    let identity: SearchRequestIdentity<TContext> | null;
    try {
      identity = await authenticate();
    } catch (error) {
      const status = authenticationStatus(error);
      if (status) return authenticationError(status);
      return json({ error: "search_unavailable" }, 503);
    }

    if (!identity) return authenticationError(401);

    let input: TInput;
    try {
      input = parse(await parseJson(request));
    } catch {
      return json({ error: "invalid_search_request" }, 400);
    }

    try {
      return json(await execute(identity, input));
    } catch {
      // Authorization and index failures both fail closed without exposing internals.
      return json({ error: "search_unavailable" }, 503);
    }
  };
}

export function createParticipantSearchHandler<TContext>(
  dependencies: SearchHandlerDependencies<
    TContext,
    ParticipantSearchInput,
    { hits: ParticipantResult[]; returned_count: number }
  >,
) {
  return createSearchHandler({
    ...dependencies,
    parse: parseParticipantSearchInput,
  });
}

export function createHallSearchHandler<TContext>(
  dependencies: SearchHandlerDependencies<
    TContext,
    HallSearchInput,
    { hits: HallResult[]; returned_count: number }
  >,
) {
  return createSearchHandler({
    ...dependencies,
    parse: parseHallSearchInput,
  });
}

export function createSearchIndexHandler({
  secret,
  execute,
}: {
  secret: string | undefined;
  execute(): Promise<SearchIndexResult>;
}) {
  return async function POST(request: Request): Promise<Response> {
    const supplied = request.headers.get("authorization");
    if (!secret || supplied !== `Bearer ${secret}`) {
      return json({ error: "authentication_required" }, 401, {
        "www-authenticate": "Bearer",
      });
    }

    try {
      return json(await execute());
    } catch {
      return json({ error: "search_index_unavailable" }, 503);
    }
  };
}
