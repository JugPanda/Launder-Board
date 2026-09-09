import "server-only";

import { z } from "zod";

type EnvironmentSource = Record<string, string | undefined>;

const supabaseServerEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const typesenseServerEnvSchema = z.object({
  TYPESENSE_HOST: z.string().min(1),
  TYPESENSE_PORT: z.coerce.number().int().min(1).max(65_535),
  TYPESENSE_PROTOCOL: z.enum(["http", "https"]),
  TYPESENSE_ADMIN_API_KEY: z.string().min(1),
  TYPESENSE_SEARCH_API_KEY: z.string().min(1),
});

const serverEnvSchema = supabaseServerEnvSchema.merge(typesenseServerEnvSchema);

export type SupabaseServerEnv = z.infer<typeof supabaseServerEnvSchema>;
export type TypesenseServerEnv = z.infer<typeof typesenseServerEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export class EnvironmentConfigurationError extends Error {
  constructor(integration: string, issues: z.core.$ZodIssue[]) {
    const details = issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");

    super(`Invalid ${integration} environment: ${details}`);
    this.name = "EnvironmentConfigurationError";
  }
}

function parseEnvironment<TSchema extends z.ZodType>(
  integration: string,
  schema: TSchema,
  source: EnvironmentSource,
): z.output<TSchema> {
  const result = schema.safeParse(source);

  if (!result.success) {
    throw new EnvironmentConfigurationError(integration, result.error.issues);
  }

  return result.data;
}

/** Validate lazily when a server-side Supabase client is initialized. */
export function getSupabaseServerEnv(
  source: EnvironmentSource = process.env,
): SupabaseServerEnv {
  return parseEnvironment("Supabase server", supabaseServerEnvSchema, source);
}

/** Validate lazily when a server-side Typesense client is initialized. */
export function getTypesenseServerEnv(
  source: EnvironmentSource = process.env,
): TypesenseServerEnv {
  return parseEnvironment("Typesense server", typesenseServerEnvSchema, source);
}

/** Validate every integration credential for workers that initialize both clients. */
export function getServerEnv(
  source: EnvironmentSource = process.env,
): ServerEnv {
  return parseEnvironment("server", serverEnvSchema, source);
}
