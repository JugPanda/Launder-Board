import { z } from "zod";

const publicSupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().refine((value) => /^https?:\/\//.test(value)),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).refine((value) => value.trim().length > 0),
});

export type PublicSupabaseEnv = z.infer<typeof publicSupabaseEnvSchema>;

// Explicit property access lets Next inline browser-safe values at build time.
function publicEnvironment() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

/** Configuration presence only, not a provider health check or authentication. */
export function isSupabaseAuthConfigured(
  source: Record<string, string | undefined> = publicEnvironment(),
): boolean {
  return publicSupabaseEnvSchema.safeParse(source).success;
}

/** URL + anon key only. Safe for browser and cookie-bound user clients. */
export function getPublicSupabaseEnv(
  source: Record<string, string | undefined> = publicEnvironment(),
): PublicSupabaseEnv {
  const result = publicSupabaseEnvSchema.safeParse(source);
  if (!result.success) throw new Error("Supabase authentication is not configured");
  return result.data;
}
