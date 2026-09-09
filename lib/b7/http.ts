import { z } from "zod";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

const resourceIdSchema = z.string().uuid();
const publicSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80);
const emptyEnrollmentSchema = z.object({}).strict();
const privacySchema = z
  .object({
    visibility: z.enum(["private", "friends", "public"]),
    directoryOptIn: z.boolean(),
    activityImportOptIn: z.boolean(),
    publicStatsOptIn: z.boolean(),
    publicHallOptIn: z.boolean(),
    encouragementScope: z.enum(["off", "friends", "hall"]),
    reminderEnabled: z.boolean(),
    reminderDays: z.union([z.literal(7), z.literal(14), z.literal(21)]),
  })
  .strict();

export type PrivacyInput = z.infer<typeof privacySchema>;

export interface ParticipantIdentity {
  authUserId: string;
  profileId: string;
  hallId: string;
}

export interface AccountIdentity {
  authUserId: string;
  profileId: string | null;
}

export type AuthenticateParticipant = (
  request: Request,
) => Promise<ParticipantIdentity | null>;
export type AuthenticateAccount = (request: Request) => Promise<AccountIdentity | null>;

export interface PublicProfileSource extends Record<string, unknown> {
  displayName: string;
  hallName: string | null;
  weeklyPoints: number;
  badges: readonly string[];
  activeWeekSummary: string;
}

export interface HallLeaderboardRowSource extends Record<string, unknown> {
  hallName: string;
  eligibleCount: number;
  creditedCount: number;
  participationRate: number;
  rank: number | null;
  minimumMet: boolean;
  isPublic: boolean;
}

export interface LeaderboardSource {
  competitionName: string;
  weekStartsOn: string | null;
  rows: readonly HallLeaderboardRowSource[];
}

export interface EnrollmentResult {
  competitionId: string;
  hallId: string;
  eligible: boolean;
}

export interface B7Service {
  enroll(identity: ParticipantIdentity, competitionId: string): Promise<EnrollmentResult>;
  getParticipantLeaderboard(
    profileId: string,
    competitionId: string,
  ): Promise<LeaderboardSource>;
  getPublicProfile(slug: string): Promise<PublicProfileSource | null>;
  getPublicLeaderboard(competitionId: string): Promise<LeaderboardSource | null>;
  updatePrivacy(
    identity: ParticipantIdentity,
    privacy: PrivacyInput,
  ): Promise<PrivacyInput>;
  deleteAccount(identity: AccountIdentity): Promise<void>;
}

export class ApiPolicyError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = "ApiPolicyError";
  }
}

type IdContext = { params: Promise<{ id: string }> };
type SlugContext = { params: Promise<{ slug: string }> };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

function empty(status: number): Response {
  return new Response(null, { status, headers: NO_STORE_HEADERS });
}

function errorResponse(error: unknown): Response {
  if (error instanceof ApiPolicyError) {
    return json({ error: { code: error.code } }, error.status);
  }
  return json({ error: { code: "INTERNAL_ERROR" } }, 500);
}

async function authenticateParticipant(
  authenticate: AuthenticateParticipant,
  request: Request,
): Promise<ParticipantIdentity | Response> {
  try {
    const identity = await authenticate(request);
    return identity ?? json({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401);
  } catch {
    return json({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401);
  }
}

async function authenticateAccount(
  authenticate: AuthenticateAccount,
  request: Request,
): Promise<AccountIdentity | Response> {
  try {
    const identity = await authenticate(request);
    return identity ?? json({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401);
  } catch {
    return json({ error: { code: "AUTHENTICATION_REQUIRED" } }, 401);
  }
}

async function parseJsonOrEmpty(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.trim() === "") return {};
  return JSON.parse(text) as unknown;
}

function publicProfile(source: PublicProfileSource) {
  return {
    displayName: source.displayName,
    ...(source.hallName === null ? {} : { hall: source.hallName }),
    weeklyPoints: source.weeklyPoints,
    badges: [...source.badges],
    activeWeekSummary: source.activeWeekSummary,
  };
}

function publicLeaderboard(source: LeaderboardSource) {
  return {
    competitionName: source.competitionName,
    weekStartsOn: source.weekStartsOn,
    rows: source.rows
      .filter((row) => row.minimumMet === true && row.isPublic === true)
      .map((row) => ({
        hallName: row.hallName,
        eligibleCount: row.eligibleCount,
        creditedCount: row.creditedCount,
        participationRate: row.participationRate,
        rank: row.rank,
      })),
  };
}

export function createCompetitionHandlers(input: {
  authenticate: AuthenticateParticipant;
  service: B7Service;
}) {
  return {
    POST: async (request: Request, context: IdContext): Promise<Response> => {
      const identity = await authenticateParticipant(input.authenticate, request);
      if (identity instanceof Response) return identity;

      const { id } = await context.params;
      if (!resourceIdSchema.safeParse(id).success) {
        return json({ error: { code: "INVALID_REQUEST" } }, 400);
      }

      let body: unknown;
      try {
        body = await parseJsonOrEmpty(request);
      } catch {
        return json({ error: { code: "INVALID_REQUEST" } }, 400);
      }
      if (!emptyEnrollmentSchema.safeParse(body).success) {
        return json({ error: { code: "INVALID_REQUEST" } }, 400);
      }

      try {
        return json({ enrollment: await input.service.enroll(identity, id) }, 201);
      } catch (error) {
        return errorResponse(error);
      }
    },

    GET: async (request: Request, context: IdContext): Promise<Response> => {
      const identity = await authenticateParticipant(input.authenticate, request);
      if (identity instanceof Response) return identity;

      const { id } = await context.params;
      if (!resourceIdSchema.safeParse(id).success) {
        return json({ error: { code: "INVALID_REQUEST" } }, 400);
      }

      try {
        const leaderboard = await input.service.getParticipantLeaderboard(
          identity.profileId,
          id,
        );
        return json({ leaderboard });
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}

export function createPublicHandlers(input: { service: B7Service }) {
  return {
    profile: {
      GET: async (_request: Request, context: SlugContext): Promise<Response> => {
        const { slug } = await context.params;
        if (!publicSlugSchema.safeParse(slug).success) {
          return json({ error: { code: "NOT_FOUND" } }, 404);
        }

        try {
          const source = await input.service.getPublicProfile(slug);
          if (!source) return json({ error: { code: "NOT_FOUND" } }, 404);
          return json({ profile: publicProfile(source) });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
    leaderboard: {
      GET: async (_request: Request, context: IdContext): Promise<Response> => {
        const { id } = await context.params;
        if (!resourceIdSchema.safeParse(id).success) {
          return json({ error: { code: "NOT_FOUND" } }, 404);
        }

        try {
          const source = await input.service.getPublicLeaderboard(id);
          if (!source) return json({ error: { code: "NOT_FOUND" } }, 404);
          return json({ leaderboard: publicLeaderboard(source) });
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  };
}

export function createPrivacyHandler(input: {
  authenticate: AuthenticateParticipant;
  service: B7Service;
}) {
  return async (request: Request): Promise<Response> => {
    const identity = await authenticateParticipant(input.authenticate, request);
    if (identity instanceof Response) return identity;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: { code: "INVALID_REQUEST" } }, 400);
    }
    const parsed = privacySchema.safeParse(body);
    if (!parsed.success) return json({ error: { code: "INVALID_REQUEST" } }, 400);

    try {
      const privacy = await input.service.updatePrivacy(identity, parsed.data);
      return json({ privacy });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function createAccountHandler(input: {
  authenticate: AuthenticateAccount;
  service: B7Service;
}) {
  return async (request: Request): Promise<Response> => {
    const identity = await authenticateAccount(input.authenticate, request);
    if (identity instanceof Response) return identity;

    try {
      await input.service.deleteAccount(identity);
      return empty(204);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
