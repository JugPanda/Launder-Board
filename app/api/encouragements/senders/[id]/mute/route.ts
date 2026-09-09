import { z } from "zod";

import { requireUser } from "@/lib/auth/require-user";
import { EncouragementService } from "@/lib/social/encouragements";
import { socialResourceIdSchema } from "@/lib/social/schemas";
import { createSupabaseEncouragementRepository } from "@/lib/social/supabase-repositories.server";

type Context = { params: Promise<{ id: string }> };
const bodySchema = z.object({ muted: z.boolean() }).strict();
const headers = { "Cache-Control": "private, no-store" };

export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    const { profile, supabase } = await requireUser();
    const id = (await context.params).id;
    let body: unknown;
    try { body = await request.json(); } catch { body = null; }
    const parsedBody = bodySchema.safeParse(body);
    if (!socialResourceIdSchema.safeParse(id).success || !parsedBody.success) return Response.json({ error: { code: "INVALID_REQUEST" } }, { status: 400, headers });
    const service = new EncouragementService(createSupabaseEncouragementRepository(supabase, profile.id));
    await service.setMuted(profile.id, id, parsedBody.data.muted);
    return new Response(null, { status: 204, headers });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error && typeof error.code === "string" ? error.code : null;
    if (code) return Response.json({ error: { code } }, { status: code === "ENCOURAGEMENT_NOT_FOUND" ? 404 : 403, headers });
    const status = typeof error === "object" && error && "status" in error && error.status === 403 ? 403 : 401;
    return Response.json({ error: { code: status === 403 ? "ACTIVE_PROFILE_REQUIRED" : "AUTHENTICATION_REQUIRED" } }, { status, headers });
  }
}
