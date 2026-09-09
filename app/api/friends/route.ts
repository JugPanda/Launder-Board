import { requireUser } from "@/lib/auth/require-user";
import { FriendService } from "@/lib/social/friends";
import { createFriendCollectionHandlers } from "@/lib/social/http";
import { createSupabaseFriendRepository } from "@/lib/social/supabase-repositories.server";

function authFailure(error: unknown): Response {
  const status = typeof error === "object" && error && "status" in error && error.status === 403 ? 403 : 401;
  return Response.json(
    { error: { code: status === 403 ? "ACTIVE_PROFILE_REQUIRED" : "AUTHENTICATION_REQUIRED" } },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

async function currentHandlers() {
  const { profile, supabase } = await requireUser();
  return createFriendCollectionHandlers({
    authenticate: async () => ({ userId: profile.id }),
    service: new FriendService(createSupabaseFriendRepository(supabase, profile.id)),
  });
}

export async function GET(request: Request): Promise<Response> {
  try {
    return (await currentHandlers()).GET(request);
  } catch (error) {
    return authFailure(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    return (await currentHandlers()).POST(request);
  } catch (error) {
    return authFailure(error);
  }
}
