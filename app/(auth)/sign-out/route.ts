import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const headers = { "Cache-Control": "private, no-store", Pragma: "no-cache", Expires: "0" };

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

export async function POST(request: Request) {
  const origin = publicOrigin(request);
  if (!origin) {
    return NextResponse.json({ error: "Same-origin request required." }, { status: 403, headers });
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error("signout_unavailable");
    return NextResponse.redirect(new URL("/sign-in", origin), { status: 303, headers });
  } catch {
    return NextResponse.json({ error: "Sign out is temporarily unavailable. Please retry." }, { status: 503, headers });
  }
}
