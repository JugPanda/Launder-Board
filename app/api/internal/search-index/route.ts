import { createAdminClient } from "@/lib/supabase/admin.server";
import {
  createTypesenseAdminClient,
  ensureTypesenseCollections,
} from "@/lib/typesense/client.server";
import { createSearchIndexHandler } from "@/lib/typesense/http";
import {
  createSupabaseSearchOutboxRepository,
  createTypesenseSearchIndexWriter,
  type SearchRpcClient,
  type TypesenseAdapterClient,
} from "@/lib/typesense/supabase-adapters.server";
import { processSearchOutbox } from "@/lib/typesense/sync";

const handler = createSearchIndexHandler({
  secret: process.env.CRON_SECRET,
  async execute() {
    const typesense = createTypesenseAdminClient();
    await ensureTypesenseCollections(typesense);
    const repository = createSupabaseSearchOutboxRepository(
      createAdminClient() as SearchRpcClient,
    );
    const writer = createTypesenseSearchIndexWriter(
      typesense as unknown as TypesenseAdapterClient,
    );
    return processSearchOutbox(repository, writer, 100);
  },
});

export const POST = handler;
