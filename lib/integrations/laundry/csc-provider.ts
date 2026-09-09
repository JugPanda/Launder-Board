import type {
  LaundryActivityPage,
  LaundryActivityQuery,
  LaundryProvider,
} from "@/lib/integrations/laundry/provider";
import type {
  CscLaundrySource,
  NormalizedLaundryActivity,
  ProviderResult,
} from "@/lib/integrations/laundry/types";

const NOT_CONFIGURED = {
  ok: false,
  error: "provider_not_configured",
} as const;

/**
 * Deliberately disabled. Enabling this requires an approved CSC contract,
 * documented auth/data semantics, and separate implementation review.
 */
export class CscLaundryProvider implements LaundryProvider<unknown> {
  readonly id: CscLaundrySource;

  constructor(id: CscLaundrySource = "cscpay") {
    this.id = id;
  }

  async validateConnection(): Promise<ProviderResult<null>> {
    return NOT_CONFIGURED;
  }

  async listActivities(
    query: LaundryActivityQuery,
  ): Promise<ProviderResult<LaundryActivityPage<unknown>>> {
    void query;
    return NOT_CONFIGURED;
  }

  async normalize(raw: unknown): Promise<ProviderResult<NormalizedLaundryActivity>> {
    void raw;
    return NOT_CONFIGURED;
  }

  async disconnect(): Promise<ProviderResult<null>> {
    return NOT_CONFIGURED;
  }
}
