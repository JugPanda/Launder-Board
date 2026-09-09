import "server-only";

import type {
  HallAuthorizationRepository,
  ParticipantAuthorizationRepository,
} from "@/lib/typesense/rehydrate";
import type {
  HallSearchIndex,
  ParticipantSearchIndex,
} from "@/lib/typesense/search";
import {
  HALL_RESULTS_ALIAS,
  PARTICIPANTS_ALIAS,
} from "@/lib/typesense/schemas";
import type {
  CurrentSearchProjection,
  SearchEntityType,
  SearchIndexWriter,
  SearchOperation,
  SearchOutboxJob,
  SearchOutboxRepository,
} from "@/lib/typesense/sync";
import type { SafeSearchParameters } from "@/lib/typesense/query-builders";

export interface SearchRpcClient {
  rpc(
    functionName: string,
    params?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
}

interface TypesenseDocuments {
  search(parameters: SafeSearchParameters): Promise<{ hits?: Array<{ document?: { id?: unknown } }> }>;
  upsert(document: Record<string, unknown>): Promise<unknown>;
}

interface TypesenseDocument {
  delete(): Promise<unknown>;
}

interface TypesenseCollection {
  documents(): TypesenseDocuments;
  documents(id: string): TypesenseDocument;
}

export interface TypesenseAdapterClient {
  collections(name: string): TypesenseCollection;
}

function storageError(): Error {
  return Object.assign(new Error("Search storage unavailable"), {
    code: "SEARCH_STORAGE_UNAVAILABLE",
  });
}

async function rpc(
  client: SearchRpcClient,
  functionName: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(functionName, params);
  if (error) throw storageError();
  return data;
}

function rows(data: unknown): Array<Record<string, unknown>> {
  if (
    !Array.isArray(data) ||
    data.some((row) => !row || typeof row !== "object" || Array.isArray(row))
  ) {
    throw storageError();
  }
  return data as Array<Record<string, unknown>>;
}

function authorizedIds(data: unknown): string[] {
  return rows(data).map((row) => {
    if (typeof row.entity_id !== "string" || row.entity_id.length === 0) {
      throw storageError();
    }
    return row.entity_id;
  });
}

function requireCaller(expected: string, supplied: string): void {
  if (expected !== supplied) throw storageError();
}

export function createSupabaseParticipantAuthorizationRepository(
  client: SearchRpcClient,
  currentProfileId: string,
): ParticipantAuthorizationRepository {
  return {
    async findAuthorizedIds(callerId, input) {
      requireCaller(currentProfileId, callerId);
      return authorizedIds(
        await rpc(client, "search_authorized_participant_ids", {
          p_preset: input.preset,
        }),
      );
    },
    async findAuthorizedParticipants(callerId, ids, input) {
      requireCaller(currentProfileId, callerId);
      if (ids.length === 0) return [];
      return rows(
        await rpc(client, "search_rehydrate_participants", {
          p_ids: [...ids],
          p_preset: input.preset,
        }),
      );
    },
  };
}

export function createSupabaseHallAuthorizationRepository(
  client: SearchRpcClient,
  currentProfileId: string,
): HallAuthorizationRepository {
  return {
    async findAuthorizedIds(callerId, input) {
      requireCaller(currentProfileId, callerId);
      return authorizedIds(
        await rpc(client, "search_authorized_hall_result_ids", {
          p_competition_id: input.competition_id,
          p_week_start_day: input.week_start_day,
        }),
      );
    },
    async findAuthorizedHallResults(callerId, ids, input) {
      requireCaller(currentProfileId, callerId);
      if (ids.length === 0) return [];
      return rows(
        await rpc(client, "search_rehydrate_hall_results", {
          p_ids: [...ids],
          p_competition_id: input.competition_id,
          p_week_start_day: input.week_start_day,
        }),
      );
    },
  };
}

function createSearchIndex(
  client: TypesenseAdapterClient,
  collection: string,
): ParticipantSearchIndex | HallSearchIndex {
  return {
    search(parameters) {
      return client.collections(collection).documents().search(parameters);
    },
  };
}

export function createTypesenseParticipantSearchIndex(
  client: TypesenseAdapterClient,
): ParticipantSearchIndex {
  return createSearchIndex(client, PARTICIPANTS_ALIAS);
}

export function createTypesenseHallSearchIndex(
  client: TypesenseAdapterClient,
): HallSearchIndex {
  return createSearchIndex(client, HALL_RESULTS_ALIAS);
}

function bigint(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return BigInt(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  throw storageError();
}

function entityType(value: unknown): SearchEntityType {
  if (value === "participant" || value === "hall_result") return value;
  throw storageError();
}

function operation(value: unknown): SearchOperation {
  if (value === "upsert" || value === "delete") return value;
  throw storageError();
}

function job(row: Record<string, unknown>): SearchOutboxJob {
  if (typeof row.entity_id !== "string" || row.entity_id.length === 0) {
    throw storageError();
  }
  return {
    entity_type: entityType(row.entity_type),
    entity_id: row.entity_id,
    operation: operation(row.operation),
    projection_version: bigint(row.projection_version),
  };
}

function currentProjection(data: unknown): CurrentSearchProjection | null {
  if (data === null) return null;
  if (!data || typeof data !== "object" || Array.isArray(data)) throw storageError();
  const value = data as Record<string, unknown>;
  const projectionVersion = bigint(value.projection_version);
  if (value.operation === "delete") {
    return { operation: "delete", projection_version: projectionVersion };
  }
  if (
    value.operation !== "upsert" ||
    !value.document ||
    typeof value.document !== "object" ||
    Array.isArray(value.document)
  ) {
    throw storageError();
  }
  const document = { ...(value.document as Record<string, unknown>) };
  const version = bigint(document.projection_version);
  if (version > BigInt(Number.MAX_SAFE_INTEGER)) throw storageError();
  document.projection_version = Number(version);
  return { operation: "upsert", projection_version: projectionVersion, document };
}

function jobParams(value: SearchOutboxJob): Record<string, unknown> {
  return {
    p_entity_type: value.entity_type,
    p_entity_id: value.entity_id,
    p_projection_version: value.projection_version.toString(),
  };
}

export function createSupabaseSearchOutboxRepository(
  serviceRoleClient: SearchRpcClient,
): SearchOutboxRepository {
  return {
    async claim(limit) {
      return rows(
        await rpc(serviceRoleClient, "claim_search_outbox", { p_limit: limit }),
      ).map(job);
    },
    async loadCurrentProjection(value) {
      return currentProjection(
        await rpc(serviceRoleClient, "load_search_projection", {
          p_entity_type: value.entity_type,
          p_entity_id: value.entity_id,
        }),
      );
    },
    async markCompleted(value) {
      await rpc(serviceRoleClient, "complete_search_outbox", jobParams(value));
    },
    async markFailed(value, error) {
      await rpc(serviceRoleClient, "fail_search_outbox", {
        ...jobParams(value),
        p_error: error.message.slice(0, 500),
      });
    },
  };
}

export function createTypesenseSearchIndexWriter(
  client: TypesenseAdapterClient,
): SearchIndexWriter {
  const alias = (type: SearchEntityType) =>
    type === "participant" ? PARTICIPANTS_ALIAS : HALL_RESULTS_ALIAS;
  return {
    async upsert(type, document) {
      await client.collections(alias(type)).documents().upsert(document);
    },
    async delete(type, id) {
      try {
        await client.collections(alias(type)).documents(id).delete();
      } catch (error) {
        const status =
          error && typeof error === "object" && "httpStatus" in error
            ? error.httpStatus
            : undefined;
        if (status !== 404) throw error;
      }
    },
  };
}
