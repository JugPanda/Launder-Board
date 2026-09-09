import { requireUser } from "@/lib/auth/require-user";
import { createTypesenseSearchClient } from "@/lib/typesense/client.server";
import { createParticipantSearchHandler } from "@/lib/typesense/http";
import { createParticipantAuthorizationStore } from "@/lib/typesense/rehydrate";
import { executeParticipantSearch } from "@/lib/typesense/search";
import {
  createSupabaseParticipantAuthorizationRepository,
  createTypesenseParticipantSearchIndex,
  type SearchRpcClient,
  type TypesenseAdapterClient,
} from "@/lib/typesense/supabase-adapters.server";

const handler = createParticipantSearchHandler<{ supabase: SearchRpcClient }>({
  async authenticate() {
    const { profile, supabase } = await requireUser();
    return { callerId: profile.id, context: { supabase } };
  },
  async execute(identity, input) {
    const authorization = createParticipantAuthorizationStore(
      createSupabaseParticipantAuthorizationRepository(
        identity.context.supabase,
        identity.callerId,
      ),
    );
    const index = createTypesenseParticipantSearchIndex(
      createTypesenseSearchClient() as unknown as TypesenseAdapterClient,
    );
    return executeParticipantSearch({
      callerId: identity.callerId,
      input,
      authorization,
      index,
    });
  },
});

export const POST = handler;
