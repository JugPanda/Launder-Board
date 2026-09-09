import { requireUser } from "@/lib/auth/require-user";
import { EncouragementService } from "@/lib/social/encouragements";
import { createEncouragementReportHandler } from "@/lib/social/http";
import { createSupabaseEncouragementRepository } from "@/lib/social/supabase-repositories.server";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const { profile, supabase } = await requireUser();
    const handler = createEncouragementReportHandler({
      authenticate: async () => ({ userId: profile.id }),
      service: new EncouragementService(createSupabaseEncouragementRepository(supabase, profile.id)),
    });
    return handler(request, context);
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error && error.status === 403 ? 403 : 401;
    return Response.json({ error: { code: status === 403 ? "ACTIVE_PROFILE_REQUIRED" : "AUTHENTICATION_REQUIRED" } }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}
