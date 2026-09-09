import type {
  HallSearchInput,
  ParticipantSearchInput,
} from "@/lib/typesense/query-builders";

export interface ParticipantAuthorizationRepository {
  findAuthorizedIds(callerId: string, input: ParticipantSearchInput): Promise<string[]>;
  findAuthorizedParticipants(
    callerId: string,
    ids: readonly string[],
    input: ParticipantSearchInput,
  ): Promise<readonly Record<string, unknown>[]>;
}

export interface HallAuthorizationRepository {
  findAuthorizedIds(callerId: string, input: HallSearchInput): Promise<string[]>;
  findAuthorizedHallResults(
    callerId: string,
    ids: readonly string[],
    input: HallSearchInput,
  ): Promise<readonly Record<string, unknown>[]>;
}

export interface ParticipantResult {
  id: string;
  display_name: string;
}

export interface HallResult {
  id: string;
  competition_id: string;
  week_start_day: number;
  hall_id: string;
  hall_name: string;
  eligible_count: number;
  credited_count: number;
  participation_rate: number;
  rank: number;
  minimum_met: boolean;
  is_public: boolean;
}

function versionOf(row: Record<string, unknown>): bigint {
  const value = row.projection_version;
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return BigInt(-1);
}

/** Keep one authoritative row per ID, preferring its newest bigint projection. */
export function newestRowsById(
  rows: readonly Record<string, unknown>[],
): Map<string, Record<string, unknown>> {
  const newest = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    if (typeof row.id !== "string") continue;
    const current = newest.get(row.id);
    if (!current || versionOf(row) > versionOf(current)) newest.set(row.id, row);
  }
  return newest;
}

export function rehydrateParticipantResults(
  orderedIds: readonly string[],
  rows: readonly Record<string, unknown>[],
): ParticipantResult[] {
  const byId = newestRowsById(rows);
  const results: ParticipantResult[] = [];
  const emitted = new Set<string>();

  for (const id of orderedIds) {
    if (emitted.has(id)) continue;
    const row = byId.get(id);
    if (!row || typeof row.display_name !== "string") continue;
    emitted.add(id);
    results.push({ id, display_name: row.display_name });
  }
  return results;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function rehydrateHallResults(
  orderedIds: readonly string[],
  rows: readonly Record<string, unknown>[],
): HallResult[] {
  const byId = newestRowsById(rows);
  const results: HallResult[] = [];
  const emitted = new Set<string>();

  for (const id of orderedIds) {
    if (emitted.has(id)) continue;
    const row = byId.get(id);
    if (
      !row ||
      typeof row.competition_id !== "string" ||
      !finiteNumber(row.week_start_day) ||
      typeof row.hall_id !== "string" ||
      typeof row.hall_name !== "string" ||
      !finiteNumber(row.eligible_count) ||
      !finiteNumber(row.credited_count) ||
      !finiteNumber(row.participation_rate) ||
      !finiteNumber(row.rank) ||
      row.minimum_met !== true ||
      row.is_public !== true
    ) {
      continue;
    }
    emitted.add(id);
    results.push({
      id,
      competition_id: row.competition_id,
      week_start_day: row.week_start_day,
      hall_id: row.hall_id,
      hall_name: row.hall_name,
      eligible_count: row.eligible_count,
      credited_count: row.credited_count,
      participation_rate: row.participation_rate,
      rank: row.rank,
      minimum_met: true,
      is_public: true,
    });
  }
  return results;
}

export function createParticipantAuthorizationStore(
  repository: ParticipantAuthorizationRepository,
) {
  return {
    getAuthorizedIds: (callerId: string, input: ParticipantSearchInput) =>
      repository.findAuthorizedIds(callerId, input),
    rehydrateAuthorized: (
      callerId: string,
      ids: readonly string[],
      input: ParticipantSearchInput,
    ) => repository.findAuthorizedParticipants(callerId, ids, input),
  };
}

export function createHallAuthorizationStore(repository: HallAuthorizationRepository) {
  return {
    getAuthorizedIds: (callerId: string, input: HallSearchInput) =>
      repository.findAuthorizedIds(callerId, input),
    rehydrateAuthorized: (
      callerId: string,
      ids: readonly string[],
      input: HallSearchInput,
    ) => repository.findAuthorizedHallResults(callerId, ids, input),
  };
}
