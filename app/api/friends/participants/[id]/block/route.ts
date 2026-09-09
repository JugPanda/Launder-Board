import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { FriendService } from "@/lib/social/friends";
import { socialResourceIdSchema } from "@/lib/social/schemas";
import { createSupabaseFriendRepository } from "@/lib/social/supabase-repositories.server";

type Context = { params: Promise<{ id: string }> };
const bodySchema = z.object({ blocked: z.boolean() }).strict();
const headers = { "Cache-Control": "private, no-store" };

export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    const { profile, supabase } = await requireUser();
    const id = (await context.params).id;
    const parsedId = socialResourceIdSchema.safeParse(id);
    let body: unknown;
    try { body = await request.json(); } catch { body = null; }
    const parsedBody = bodySchema.safeParse(body);
    if (!parsedId.success || !parsedBody.success) return Response.json({ error: { code: "INVALID_REQUEST" } }, { status: 400, headers });
    const service = new FriendService(createSupabaseFriendRepository(supabase, profile.id));
    await service.setBlocked(profile.id, id, parsedBody.data.blocked);
    return new Response(null, { status: 204, headers });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error && error.status === 403 ? 403 : 401;
    if (typeof error === "object" && error && "code" in error && typeof error.code === "string") {
      const code = error.code;
      return Response.json({ error: { code } }, { status: code === "SELF_REQUEST" ? 400 : code === "TARGET_UNAVAILABLE" ? 404 : 409, headers });
    }
    return Response.json({ error: { code: status === 403 ? "ACTIVE_PROFILE_REQUIRED" : "AUTHENTICATION_REQUIRED" } }, { status, headers });
  }
}
