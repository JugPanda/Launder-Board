import "server-only";

export type SearchEntityType = "participant" | "hall_result";
export type SearchOperation = "upsert" | "delete";

export interface SearchOutboxJob {
  entity_type: SearchEntityType;
  entity_id: string;
  operation: SearchOperation;
  projection_version: bigint;
}

export type CurrentSearchProjection =
  | { operation: "delete"; projection_version: bigint }
  | {
      operation: "upsert";
      projection_version: bigint;
      document: Record<string, unknown>;
    };

export interface SearchOutboxRepository {
  claim(limit: number): Promise<SearchOutboxJob[]>;
  loadCurrentProjection(job: SearchOutboxJob): Promise<CurrentSearchProjection | null>;
  markCompleted(job: SearchOutboxJob): Promise<void>;
  markFailed(job: SearchOutboxJob, error: Error): Promise<void>;
}

export interface SearchIndexWriter {
  upsert(entityType: SearchEntityType, document: Record<string, unknown>): Promise<void>;
  delete(entityType: SearchEntityType, entityId: string): Promise<void>;
}

export interface ParticipantProjectionSource extends Record<string, unknown> {
  id: string;
  display_name: string;
  tracking_state: string;
  activity_anchor_at?: string | Date | null;
  reminder_due_at?: string | Date | null;
  data_fresh_through_at?: string | Date | null;
  projection_version: bigint | number;
}

export interface ParticipantProjection {
  id: string;
  display_name: string;
  tracking_state: string;
  activity_anchor_day?: number;
  reminder_due_day?: number;
  data_fresh_through_day?: number;
  projection_version: number;
}

export interface HallResultProjectionSource extends Record<string, unknown> {
  id: string;
  competition_id: string;
  week_start: string | Date;
  hall_id: string;
  hall_name: string;
  eligible_count: number;
  credited_count: number;
  participation_rate: number;
  rank: number;
  minimum_met: boolean;
  is_public: boolean;
  projection_version: bigint | number;
}

export interface HallResultProjection {
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
  projection_version: number;
}

export function toDayEpoch(value: string | Date): number {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid projection timestamp");
  return Math.floor(date.getTime() / 86_400_000) * 86_400;
}

function projectionVersion(value: bigint | number): number {
  const result = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isSafeInteger(result) || result < 0) {
    throw new RangeError("projection_version must be a non-negative safe integer");
  }
  return result;
}

export function buildParticipantProjection(
  source: ParticipantProjectionSource,
): ParticipantProjection {
  const document: ParticipantProjection = {
    id: source.id,
    display_name: source.display_name,
    tracking_state: source.tracking_state,
    projection_version: projectionVersion(source.projection_version),
  };
  if (source.activity_anchor_at != null) {
    document.activity_anchor_day = toDayEpoch(source.activity_anchor_at);
  }
  if (source.reminder_due_at != null) {
    document.reminder_due_day = toDayEpoch(source.reminder_due_at);
  }
  if (source.data_fresh_through_at != null) {
    document.data_fresh_through_day = toDayEpoch(source.data_fresh_through_at);
  }
  return document;
}

export function buildHallResultProjection(
  source: HallResultProjectionSource,
): HallResultProjection {
  return {
    id: source.id,
    competition_id: source.competition_id,
    week_start_day: toDayEpoch(source.week_start),
    hall_id: source.hall_id,
    hall_name: source.hall_name,
    eligible_count: source.eligible_count,
    credited_count: source.credited_count,
    participation_rate: source.participation_rate,
    rank: source.rank,
    minimum_met: source.minimum_met,
    is_public: source.is_public,
    projection_version: projectionVersion(source.projection_version),
  };
}

export function coalesceNewestJobs(jobs: readonly SearchOutboxJob[]): SearchOutboxJob[] {
  const newest = new Map<string, SearchOutboxJob>();
  for (const job of jobs) {
    const key = `${job.entity_type}:${job.entity_id}`;
    const current = newest.get(key);
    if (
      !current ||
      job.projection_version > current.projection_version ||
      (job.projection_version === current.projection_version &&
        job.operation === "delete" &&
        current.operation !== "delete")
    ) {
      newest.set(key, job);
    }
  }
  return [...newest.values()];
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error("Unknown search indexing failure");
}

export async function processSearchOutbox(
  repository: SearchOutboxRepository,
  writer: SearchIndexWriter,
  limit = 100,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
    throw new RangeError("Outbox claim limit must be between 1 and 1000");
  }

  const jobs = coalesceNewestJobs(await repository.claim(limit));
  let succeeded = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const current = await repository.loadCurrentProjection(job);
      if (!current || current.operation === "delete") {
        if (current && current.projection_version < job.projection_version) {
          throw new Error("Current delete projection is older than its outbox job");
        }
        await writer.delete(job.entity_type, job.entity_id);
      } else {
        if (current.projection_version < job.projection_version) {
          throw new Error("Current search projection is older than its outbox job");
        }
        const documentId = current.document.id;
        if (documentId !== job.entity_id) {
          throw new Error("Projection document ID does not match its outbox job");
        }
        const documentVersion = current.document.projection_version;
        if (
          typeof documentVersion !== "number" ||
          !Number.isSafeInteger(documentVersion) ||
          BigInt(documentVersion) !== current.projection_version
        ) {
          throw new Error("Projection document does not contain its newest version");
        }
        await writer.upsert(job.entity_type, current.document);
      }
      await repository.markCompleted(job);
      succeeded += 1;
    } catch (error) {
      failed += 1;
      await repository.markFailed(job, asError(error));
    }
  }

  return { processed: jobs.length, succeeded, failed };
}
