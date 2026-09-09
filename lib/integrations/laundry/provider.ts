import type {
  NormalizedLaundryActivity,
  ProviderResult,
} from "@/lib/integrations/laundry/types";

export interface LaundryActivityQuery {
  cursor?: string;
  since?: string;
}

export interface LaundryActivityPage<TRaw = unknown> {
  activities: TRaw[];
  cursor: string | null;
}

/** Provider-neutral boundary. Provider adapters may be pull-based or local/push-only. */
export interface LaundryProvider<TRaw = unknown> {
  readonly id: string;
  validateConnection(): Promise<ProviderResult<null>>;
  listActivities(
    query: LaundryActivityQuery,
  ): Promise<ProviderResult<LaundryActivityPage<TRaw>>>;
  normalize(raw: TRaw): Promise<ProviderResult<NormalizedLaundryActivity>>;
  disconnect(): Promise<ProviderResult<null>>;
}

export const CONNECTED_RESULT = { ok: true, value: null } as const;

export function emptyActivityPage<TRaw>(): ProviderResult<LaundryActivityPage<TRaw>> {
  return { ok: true, value: { activities: [], cursor: null } };
}
