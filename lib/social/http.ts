import type { EncouragementService } from "@/lib/social/encouragements";
import type { FriendService } from "@/lib/social/friends";
import {
  encouragementSendSchema,
  friendRequestSchema,
  friendTransitionSchema,
  reportEncouragementSchema,
  socialResourceIdSchema,
} from "@/lib/social/schemas";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  Expires: "0",
};

type Authentication = { userId: string } | null;
type Authenticate = (request: Request) => Promise<Authentication>;
type RouteContext = { params: Promise<{ id: string }> };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

function empty(status: number): Response {
  return new Response(null, { status, headers: NO_STORE_HEADERS });
}

async function parseJson(request: Request): Promise<unknown | typeof INVALID_JSON> {
  try {
    return await request.json();
  } catch {
    return INVALID_JSON;
  }
}

const INVALID_JSON = Symbol("invalid-json");

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

function availableAt(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("availableAt" in error)) return undefined;
  return typeof error.availableAt === "string" ? error.availableAt : undefined;
}

function serviceErrorResponse(error: unknown): Response {
  const code = errorCode(error);
  if (!code) return json({ error: { code: "INTERNAL_ERROR" } }, 500);

  if (code === "PAIR_COOLDOWN") {
    const retryAt = availableAt(error);
    return json(
      { error: retryAt ? { code, availableAt: retryAt } : { code } },
      429,
    );
  }
  if (code === "SENDER_DAILY_LIMIT") {
    const retryAt = availableAt(error);
    return json(
      { error: retryAt ? { code, availableAt: retryAt } : { code } },
      429,
    );
  }

  const statusByCode: Record<string, number> = {
    SELF_REQUEST: 400,
    SELF_ENCOURAGEMENT: 400,
    FRIENDSHIP_EXISTS: 409,
    FRIENDSHIP_NOT_FOUND: 404,
    ENCOURAGEMENT_NOT_FOUND: 404,
    TARGET_UNAVAILABLE: 404,
    TRANSITION_NOT_ALLOWED: 409,
    ACTION_NOT_ALLOWED: 403,
    ALREADY_REPORTED: 409,
  };
  return json({ error: { code } }, statusByCode[code] ?? 500);
}

async function authenticateRequest(
  authenticate: Authenticate,
  request: Request,
): Promise<Exclude<Authentication, null> | Response> {
  try {
    const authentication = await authenticate(request);
    return authentication ?? json({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401);
  } catch {
    return json({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401);
  }
}

export function createFriendCollectionHandlers(input: {
  authenticate: Authenticate;
  service: FriendService;
}) {
  return {
    GET: async (request: Request): Promise<Response> => {
      const authentication = await authenticateRequest(input.authenticate, request);
      if (authentication instanceof Response) return authentication;
      try {
        return json({ friends: await input.service.listFriends(authentication.userId) });
      } catch (error) {
        return serviceErrorResponse(error);
      }
    },

    POST: async (request: Request): Promise<Response> => {
      const authentication = await authenticateRequest(input.authenticate, request);
      if (authentication instanceof Response) return authentication;

      const body = await parseJson(request);
      if (body === INVALID_JSON) return json({ error: { code: "INVALID_REQUEST" } }, 400);
      const parsed = friendRequestSchema.safeParse(body);
      if (!parsed.success) return json({ error: { code: "INVALID_REQUEST" } }, 400);

      try {
        const friendship = await input.service.requestFriend(
          authentication.userId,
          parsed.data.targetId,
        );
        return json({ friendship }, 201);
      } catch (error) {
        return serviceErrorResponse(error);
      }
    },
  };
}

export function createFriendItemHandlers(input: {
  authenticate: Authenticate;
  service: FriendService;
}) {
  return {
    PATCH: async (request: Request, context: RouteContext): Promise<Response> => {
      const authentication = await authenticateRequest(input.authenticate, request);
      if (authentication instanceof Response) return authentication;

      const { id } = await context.params;
      if (!socialResourceIdSchema.safeParse(id).success) {
        return json({ error: { code: "INVALID_REQUEST" } }, 400);
      }
      const body = await parseJson(request);
      if (body === INVALID_JSON) return json({ error: { code: "INVALID_REQUEST" } }, 400);
      const parsed = friendTransitionSchema.safeParse(body);
      if (!parsed.success) return json({ error: { code: "INVALID_REQUEST" } }, 400);

      try {
        const friendship = await input.service.transitionFriend(
          authentication.userId,
          id,
          parsed.data.action,
        );
        return json({ friendship });
      } catch (error) {
        return serviceErrorResponse(error);
      }
    },

    DELETE: async (request: Request, context: RouteContext): Promise<Response> => {
      const authentication = await authenticateRequest(input.authenticate, request);
      if (authentication instanceof Response) return authentication;

      const { id } = await context.params;
      if (!socialResourceIdSchema.safeParse(id).success) {
        return json({ error: { code: "INVALID_REQUEST" } }, 400);
      }
      try {
        await input.service.removeFriend(authentication.userId, id);
        return empty(204);
      } catch (error) {
        return serviceErrorResponse(error);
      }
    },
  };
}

export function createEncouragementCollectionHandlers(input: {
  authenticate: Authenticate;
  service: EncouragementService;
}) {
  return {
    GET: async (request: Request): Promise<Response> => {
      const authentication = await authenticateRequest(input.authenticate, request);
      if (authentication instanceof Response) return authentication;
      try {
        const [received, due] = await Promise.all([
          input.service.listReceived(authentication.userId),
          input.service.listDue(authentication.userId),
        ]);
        return json({ encouragements: received, due });
      } catch (error) {
        return serviceErrorResponse(error);
      }
    },

    POST: async (request: Request): Promise<Response> => {
      const authentication = await authenticateRequest(input.authenticate, request);
      if (authentication instanceof Response) return authentication;

      const body = await parseJson(request);
      if (body === INVALID_JSON) return json({ error: { code: "INVALID_REQUEST" } }, 400);
      const parsed = encouragementSendSchema.safeParse(body);
      if (!parsed.success) return json({ error: { code: "INVALID_REQUEST" } }, 400);

      try {
        const encouragement = await input.service.send(authentication.userId, parsed.data);
        return json({ encouragement }, 201);
      } catch (error) {
        return serviceErrorResponse(error);
      }
    },
  };
}

export function createEncouragementReportHandler(input: {
  authenticate: Authenticate;
  service: EncouragementService;
}) {
  return async (request: Request, context: RouteContext): Promise<Response> => {
    const authentication = await authenticateRequest(input.authenticate, request);
    if (authentication instanceof Response) return authentication;

    const { id } = await context.params;
    if (!socialResourceIdSchema.safeParse(id).success) {
      return json({ error: { code: "INVALID_REQUEST" } }, 400);
    }
    const body = await parseJson(request);
    if (body === INVALID_JSON) return json({ error: { code: "INVALID_REQUEST" } }, 400);
    const parsed = reportEncouragementSchema.safeParse(body);
    if (!parsed.success) return json({ error: { code: "INVALID_REQUEST" } }, 400);

    try {
      await input.service.report(authentication.userId, id, parsed.data.category);
      return empty(204);
    } catch (error) {
      return serviceErrorResponse(error);
    }
  };
}
