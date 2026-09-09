import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { authCredentialsSchema } from "@/lib/validation/profile";

const signInActionSchema = authCredentialsSchema
  .extend({ intent: z.enum(["sign-in", "sign-up"]) })
  .strict();
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  Expires: "0",
};

function redirectTo(request: Request, path: string, key?: "error" | "message", value?: string) {
  const destination = new URL(path, request.url);
  if (key && value) destination.searchParams.set(key, value);
  return NextResponse.redirect(destination, { status: 303, headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return redirectTo(request, "/sign-in", "error", "Invalid sign-in request.");
  }

  const parsed = signInActionSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return redirectTo(request, "/sign-in", "error", "Enter a valid email and password.");
  }

  const supabase = await createClient();
  const { email, password, intent } = parsed.data;
  const result = intent === "sign-up"
    ? await supabase.auth.signUp({ email, password })
    : await supabase.auth.signInWithPassword({ email, password });

  if (result.error) {
    return redirectTo(
      request,
      "/sign-in",
      "error",
      intent === "sign-up" ? "Unable to create that account." : "Email or password was not accepted.",
    );
  }

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const authUserId = claimsData?.claims.sub;
  if (claimsError || !authUserId) {
    return redirectTo(
      request,
      "/sign-in",
      "message",
      "Check your email to confirm your account, then sign in.",
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("active", true)
    .is("deleted_at", null)
    .not("onboarding_completed_at", "is", null)
    .maybeSingle();

  return redirectTo(request, profile ? "/dashboard" : "/onboarding");
}
