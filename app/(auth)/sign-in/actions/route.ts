import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { isSupabaseAuthConfigured } from "@/lib/supabase/env";
import { authCredentialsSchema } from "@/lib/validation/profile";

const signInActionSchema = authCredentialsSchema
  .extend({ intent: z.enum(["sign-in", "sign-up"]) })
  .strict();
const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  Expires: "0",
};

function publicOrigin(request: Request): string | null {
  const internal = new URL(request.url);
  const host = request.headers.get("host") || internal.host;
  const forwarded = process.env.VERCEL === "1" ? request.headers.get("x-forwarded-proto") : null;
  const protocol = forwarded === "https" || forwarded === "http" ? `${forwarded}:` : internal.protocol;
  const expected = `${protocol}//${host}`;
  try {
    if (new URL(expected).origin !== expected || request.headers.get("origin") !== expected || request.headers.get("sec-fetch-site") === "cross-site") return null;
    return expected;
  } catch { return null; }
}

function redirectTo(request: Request, path: string, key?: "error" | "message", value?: string) {
  const destination = new URL(path, publicOrigin(request)!);
  if (key && value) destination.searchParams.set(key, value);
  return NextResponse.redirect(destination, { status: 303, headers: NO_STORE_HEADERS });
}

export async function POST(request: Request) {
  if (!publicOrigin(request)) {
    return NextResponse.json({ error: "Same-origin request required." }, { status: 403, headers: NO_STORE_HEADERS });
  }
  if (!isSupabaseAuthConfigured()) {
    return redirectTo(request, "/sign-in", "error", "Account setup pending. Explore the synthetic demo without an account.");
  }
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

  const guestRelease = process.env.LAUNDER_BOARD_DEMO_MODE === "enabled";
  if (guestRelease && parsed.data.intent === "sign-up") {
    return NextResponse.json({ error: "Demo account creation is unavailable." }, { status: 403, headers: NO_STORE_HEADERS });
  }
  try {
    const supabase = await createClient();
    const { email, password, intent } = parsed.data;
    const result = intent === "sign-up"
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      if (result.error.name === "AuthRetryableFetchError" || (result.error.status ?? 0) >= 500) {
        return redirectTo(request, "/sign-in", "error", "Authentication is temporarily unavailable. Please try again later.");
      }
      return redirectTo(
        request,
        "/sign-in",
        "error",
        intent === "sign-up" ? "Unable to create that account." : "Email or password was not accepted.",
      );
    }

    if (guestRelease) {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user || data.user.app_metadata?.presentation_account !== true) {
        await supabase.auth.signOut();
        return redirectTo(request, "/sign-in", "error", "Presentation account access is unavailable. Please use the provided demo account.");
      }
      return redirectTo(request, "/account");
    }

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError && (claimsError.name === "AuthRetryableFetchError" || (claimsError.status ?? 0) >= 500)) {
      return redirectTo(request, "/sign-in", "error", "Authentication is temporarily unavailable. Please try again later.");
    }
    const authUserId = claimsData?.claims.sub;
    if (claimsError || !authUserId) {
      return redirectTo(
        request,
        "/sign-in",
        "message",
        "Check your email to confirm your account, then sign in.",
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", authUserId)
      .eq("active", true)
      .is("deleted_at", null)
      .not("onboarding_completed_at", "is", null)
      .maybeSingle();

    if (profileError) {
      return redirectTo(request, "/sign-in", "error", "Authentication is temporarily unavailable. Please try again later.");
    }

    return redirectTo(request, profile ? "/dashboard" : "/onboarding");
  } catch {
    // Provider failures may contain credentials or upstream URLs. Never echo or log them.
    return redirectTo(request, "/sign-in", "error", "Authentication is temporarily unavailable. Please try again later.");
  }
}
