import { requireUser } from "@/lib/auth/require-user";
import { FriendService } from "@/lib/social/friends";
import { createFriendItemHandlers } from "@/lib/social/http";
import { createSupabaseFriendRepository } from "@/lib/social/supabase-repositories.server";

type Context = { params: Promise<{ id: string }> };

function authFailure(error: unknown): Response {
  const status = typeof error === "object" && error && "status" in error && error.status === 403 ? 403 : 401;
  return Response.json({ error: { code: status === 403 ? "ACTIVE_PROFILE_REQUIRED" : "AUTHENTICATION_REQUIRED" } }, { status, headers: { "Cache-Control": "private, no-store" } });
}

async function currentHandlers() {
  const { profile, supabase } = await requireUser();
  return createFriendItemHandlers({
    authenticate: async () => ({ userId: profile.id }),
    service: new FriendService(createSupabaseFriendRepository(supabase, profile.id)),
  });
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    return (await currentHandlers()).PATCH(request, context);
  } catch (error) {
    return authFailure(error);
  }
}

export async function DELETE(request: Request, context: Context): Promise<Response> {
  try {
    return (await currentHandlers()).DELETE(request, context);
  } catch (error) {
    return authFailure(error);
  }
}
