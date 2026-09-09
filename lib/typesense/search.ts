import type {
  HallSearchInput,
  ParticipantSearchInput,
  SafeSearchParameters,
} from "@/lib/typesense/query-builders";
import {
  buildHallSearchParameters,
  buildParticipantSearchParameters,
} from "@/lib/typesense/query-builders";
import {
  rehydrateHallResults,
  rehydrateParticipantResults,
  type HallResult,
  type ParticipantResult,
} from "@/lib/typesense/rehydrate";

interface SearchHit {
  document?: { id?: unknown };
}

interface MinimalSearchResponse {
  hits?: SearchHit[];
}

export interface ParticipantSearchIndex {
  search(parameters: SafeSearchParameters): Promise<MinimalSearchResponse>;
}

export interface ParticipantAuthorizationStore {
  getAuthorizedIds(callerId: string, input: ParticipantSearchInput): Promise<string[]>;
  rehydrateAuthorized(
    callerId: string,
    ids: readonly string[],
    input: ParticipantSearchInput,
  ): Promise<readonly Record<string, unknown>[]>;
}

export interface HallSearchIndex {
  search(parameters: SafeSearchParameters): Promise<MinimalSearchResponse>;
}

export interface HallAuthorizationStore {
  getAuthorizedIds(callerId: string, input: HallSearchInput): Promise<string[]>;
  rehydrateAuthorized(
    callerId: string,
    ids: readonly string[],
    input: HallSearchInput,
  ): Promise<readonly Record<string, unknown>[]>;
}

export class SearchUnavailableError extends Error {
  readonly code = "SEARCH_UNAVAILABLE";

  constructor(cause?: unknown) {
    super("Search is temporarily unavailable", { cause });
    this.name = "SearchUnavailableError";
  }
}

function uniqueNonemptyIds(ids: readonly string[]): string[] {
  return [...new Set(ids.filter((id) => id.length > 0))];
}

function hitIds(response: MinimalSearchResponse, authorizedIds: ReadonlySet<string>): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const hit of response.hits ?? []) {
    const id = hit.document?.id;
    if (typeof id === "string" && authorizedIds.has(id) && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export async function executeParticipantSearch({
  callerId,
  input,
  authorization,
  index,
}: {
  callerId: string;
  input: ParticipantSearchInput;
  authorization: ParticipantAuthorizationStore;
  index: ParticipantSearchIndex;
}): Promise<{ hits: ParticipantResult[]; returned_count: number }> {
  const authorizedIds = uniqueNonemptyIds(
    await authorization.getAuthorizedIds(callerId, input),
  );
  const parameters = buildParticipantSearchParameters(input, authorizedIds);
  if (!parameters) return { hits: [], returned_count: 0 };

  let response: MinimalSearchResponse;
  try {
    response = await index.search(parameters);
  } catch (error) {
    throw new SearchUnavailableError(error);
  }

  const ids = hitIds(response, new Set(authorizedIds));
  if (ids.length === 0) return { hits: [], returned_count: 0 };

  const rows = await authorization.rehydrateAuthorized(callerId, ids, input);
  const hits = rehydrateParticipantResults(ids, rows);
  return { hits, returned_count: hits.length };
}

export async function executeHallSearch({
  callerId,
  input,
  authorization,
  index,
}: {
  callerId: string;
  input: HallSearchInput;
  authorization: HallAuthorizationStore;
  index: HallSearchIndex;
}): Promise<{ hits: HallResult[]; returned_count: number }> {
  const authorizedIds = uniqueNonemptyIds(
    await authorization.getAuthorizedIds(callerId, input),
  );
  const parameters = buildHallSearchParameters(input, authorizedIds);
  if (!parameters) return { hits: [], returned_count: 0 };

  let response: MinimalSearchResponse;
  try {
    response = await index.search(parameters);
  } catch (error) {
    throw new SearchUnavailableError(error);
  }

  const ids = hitIds(response, new Set(authorizedIds));
  if (ids.length === 0) return { hits: [], returned_count: 0 };

  const rows = await authorization.rehydrateAuthorized(callerId, ids, input);
  const hits = rehydrateHallResults(ids, rows);
  return { hits, returned_count: hits.length };
}
