import { z } from "zod";

const publicSupabaseEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type PublicSupabaseEnv = z.infer<typeof publicSupabaseEnvSchema>;

/** URL + anon key only. Safe for browser and cookie-bound user clients. */
export function getPublicSupabaseEnv(
  source: Record<string, string | undefined> = process.env,
): PublicSupabaseEnv {
  return publicSupabaseEnvSchema.parse(source);
}
