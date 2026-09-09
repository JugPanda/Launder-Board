import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import { getPublicSupabaseEnv } from "@/lib/supabase/env";

const NO_STORE = "private, no-store";
const PUBLIC_PATHS = new Set([
  "/",
  "/sign-in",
  "/sign-in/actions",
  "/api/internal/search-index",
  "/purdue/halls",
]);
const PUBLIC_PREFIXES = ["/leaderboards/", "/p/", "/api/public/"];
const DEMO_PREFIXES = [
  "/dashboard",
  "/competitions/",
  "/settings/privacy",
  "/activity",
  "/friends",
  "/search",
];

function applyNoStore(response: NextResponse) {
  response.headers.set("Cache-Control", NO_STORE);
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

function redirectWithCookies(request: NextRequest, source: NextResponse, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
  source.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return applyNoStore(response);
}

function unauthorizedApi() {
  return NextResponse.json(
    { error: "Authentication required" },
    { status: 401, headers: { "Cache-Control": NO_STORE } },
  );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  // Guest demo contains only synthetic fixtures and never initializes authentication.
  if (pathname === "/demo") return applyNoStore(response);
  // These guest handlers enforce their own session/origin or admin-key checks.
  const hostedDemoPaths = ["/api/demo/session", "/api/demo/bootstrap", "/api/demo/search", "/api/demo/nudges", "/api/demo/posts", "/api/demo/reset", "/api/demo/index"];
  if (hostedDemoPaths.includes(pathname)) return applyNoStore(response);
  const guestRelease = process.env.LAUNDER_BOARD_DEMO_MODE === "enabled";
  const archivedDemo = DEMO_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : prefix + "/"));
  if (guestRelease && request.method === "GET" && (pathname === "/sign-in" || pathname === "/onboarding" || archivedDemo || pathname.startsWith("/leaderboards/") || pathname.startsWith("/p/"))) {
    return redirectWithCookies(request, response, "/demo");
  }
  const isPublic =
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isDemo =
    process.env.LAUNDER_BOARD_DEMO_MODE === "enabled" &&
    DEMO_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
  const isApi = pathname.startsWith("/api/");

  let publicEnv;
  try {
    publicEnv = getPublicSupabaseEnv();
  } catch {
    if (isPublic || isDemo) return applyNoStore(response);
    if (isApi) {
      return NextResponse.json(
        { error: "Authentication service unavailable" },
        { status: 503, headers: { "Cache-Control": NO_STORE } },
      );
    }
    return redirectWithCookies(request, response, "/sign-in");
  }
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = publicEnv;

  const supabase = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([name, value]) => {
            response.headers.set(name, value);
          });
        },
      },
    },
  );

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const authUserId = claimsData?.claims.sub;
  if (claimsError || !authUserId) {
    if (isPublic || isDemo) return applyNoStore(response);
    if (isApi) return unauthorizedApi();
    return redirectWithCookies(request, response, "/sign-in");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", authUserId)
    .eq("active", true)
    .is("deleted_at", null)
    .not("onboarding_completed_at", "is", null)
    .maybeSingle();

  if (pathname === "/sign-in" || pathname === "/sign-in/actions") {
    return redirectWithCookies(
      request,
      response,
      profile ? "/dashboard" : "/onboarding",
    );
  }

  if (pathname === "/onboarding" || pathname === "/onboarding/actions") {
    return profile
      ? redirectWithCookies(request, response, "/dashboard")
      : applyNoStore(response);
  }

  if (!isPublic && !isDemo && !profile) {
    if (isApi) {
      return NextResponse.json(
        { error: "An active participant profile is required" },
        { status: 403, headers: { "Cache-Control": NO_STORE } },
      );
    }
    return redirectWithCookies(request, response, "/onboarding");
  }

  return applyNoStore(response);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
