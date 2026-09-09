import { requireUser } from "@/lib/auth/require-user";
import { createTypesenseSearchClient } from "@/lib/typesense/client.server";
import { createHallSearchHandler } from "@/lib/typesense/http";
import { createHallAuthorizationStore } from "@/lib/typesense/rehydrate";
import { executeHallSearch } from "@/lib/typesense/search";
import {
  createSupabaseHallAuthorizationRepository,
  createTypesenseHallSearchIndex,
  type SearchRpcClient,
  type TypesenseAdapterClient,
} from "@/lib/typesense/supabase-adapters.server";

const handler = createHallSearchHandler<{ supabase: SearchRpcClient }>({
  async authenticate() {
    const { profile, supabase } = await requireUser();
    return { callerId: profile.id, context: { supabase } };
  },
  async execute(identity, input) {
    const authorization = createHallAuthorizationStore(
      createSupabaseHallAuthorizationRepository(
        identity.context.supabase,
        identity.callerId,
      ),
    );
    const index = createTypesenseHallSearchIndex(
      createTypesenseSearchClient() as unknown as TypesenseAdapterClient,
    );
    return executeHallSearch({
      callerId: identity.callerId,
      input,
      authorization,
      index,
    });
  },
});

export const POST = handler;
