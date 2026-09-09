import "server-only";

import { Client, SearchClient, type CollectionCreateSchema } from "typesense";

import { getTypesenseServerEnv, type TypesenseServerEnv } from "@/lib/env";
import {
  HALL_RESULTS_ALIAS,
  HALL_RESULTS_COLLECTION,
  PARTICIPANTS_ALIAS,
  PARTICIPANTS_COLLECTION,
  hallResultsSchema,
  participantsSchema,
} from "@/lib/typesense/schemas";

type EnvironmentSource = Record<string, string | undefined>;

function configuration(apiKey: string, env: TypesenseServerEnv) {
  return {
    apiKey,
    nodes: [
      {
        host: env.TYPESENSE_HOST,
        port: env.TYPESENSE_PORT,
        protocol: env.TYPESENSE_PROTOCOL,
      },
    ],
    connectionTimeoutSeconds: 2,
    numRetries: 1,
    retryIntervalSeconds: 0.1,
  };
}

/** Creates a privileged client lazily so importing a route never validates secrets. */
export function createTypesenseAdminClient(source: EnvironmentSource = process.env) {
  const env = getTypesenseServerEnv(source);
  return new Client(configuration(env.TYPESENSE_ADMIN_API_KEY, env));
}

/** Search-only server client. Its key is never exposed to the browser. */
export function createTypesenseSearchClient(source: EnvironmentSource = process.env) {
  const env = getTypesenseServerEnv(source);
  return new SearchClient(configuration(env.TYPESENSE_SEARCH_API_KEY, env));
}

async function ensureCollection(client: Client, schema: CollectionCreateSchema) {
  if (!(await client.collections(schema.name).exists())) {
    await client.collections().create(schema);
  }
}

/** Idempotently creates versioned collections and points their stable aliases at v1. */
export async function ensureTypesenseCollections(client = createTypesenseAdminClient()) {
  await ensureCollection(client, participantsSchema);
  await ensureCollection(client, hallResultsSchema);
  await client.aliases().upsert(PARTICIPANTS_ALIAS, {
    collection_name: PARTICIPANTS_COLLECTION,
  });
  await client.aliases().upsert(HALL_RESULTS_ALIAS, {
    collection_name: HALL_RESULTS_COLLECTION,
  });
}
