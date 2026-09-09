export const COMPETITION_TIME_ZONE = "America/New_York";
export const LATE_IMPORT_WINDOW_HOURS = 72;
export const MAX_CREDITED_SESSION_PARTICIPANTS = 2;

export type MachineKind = "washer" | "dryer";
export type LaundrySessionStatus =
  | "reported"
  | "accepted"
  | "failed"
  | "refunded"
  | "retracted";
export type SharedMemberStatus = "invited" | "accepted" | "declined" | "retracted";

export interface SharedSessionMember {
  participantId: string;
  status: SharedMemberStatus;
}

export interface LaundrySession {
  id: string;
  ownerParticipantId: string;
  occurredAt: string;
  importedAt: string;
  machineKind: MachineKind;
  status: LaundrySessionStatus;
  duplicateOfSessionId: string | null;
  sharedMembers: readonly SharedSessionMember[];
}

export interface CompetitionEnrollment {
  competitionId: string;
  weekStartsOn: string;
  participantId: string;
  hallId: string;
  eligible: boolean;
  paused: boolean;
}

export interface CompetitionWeekWindow {
  startsOn: string;
  startsAt: string;
  endsAt: string;
}

export interface WeeklyCredit {
  competitionId: string;
  weekStartsOn: string;
  participantId: string;
  hallId: string;
  sessionId: string;
  occurredAt: string;
  late: boolean;
}

export interface HallWeekResult {
  competitionId: string;
  weekStartsOn: string;
  hallId: string;
  eligibleCount: number;
  creditedCount: number;
  score: number;
  rank: number | null;
  publishable: boolean;
  lateUpdated: boolean;
}

export interface ScoreCompetitionWeekInput {
  competitionId: string;
  weekStartsOn: string;
  timeZone?: string;
  minimumRoster: number;
  paused: boolean;
  enrollments: readonly CompetitionEnrollment[];
  sessions: readonly LaundrySession[];
}

export interface CompetitionWeekScore {
  week: CompetitionWeekWindow;
  credits: WeeklyCredit[];
  halls: HallWeekResult[];
  publicHalls: HallWeekResult[];
}

interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
  weekday: string;
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-US-u-ca-iso8601", {
    timeZone,
    hourCycle: "h23",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  // Force validation now rather than on the first scoring call.
  formatter.format(new Date(0));
  formatters.set(timeZone, formatter);
  return formatter;
}

function zonedParts(date: Date, timeZone: string): ZonedDateParts {
  const values: Record<string, string> = {};
  for (const part of formatterFor(timeZone).formatToParts(date)) {
    if (part.type !== "literal") values[part.type] = part.value;
  }

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    weekday: values.weekday,
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function parseInstant(value: string, field: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new RangeError(`${field} must be a valid ISO date-time`);
  }
  return timestamp;
}

function parseLocalDate(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError("weekStartsOn must use YYYY-MM-DD");

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError("weekStartsOn must be a real calendar date");
  }
  return { year, month, day };
}

function formatLocalDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addLocalDays(value: string, days: number): string {
  const { year, month, day } = parseLocalDate(value);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return formatLocalDate(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
}

/** Converts a local calendar midnight to UTC, including DST offset changes. */
function localMidnightToUtc(value: string, timeZone: string): number {
  const { year, month, day } = parseLocalDate(value);
  const desiredAsUtc = Date.UTC(year, month - 1, day);
  let candidate = desiredAsUtc;

  // Offset iteration avoids hard-coding EST/EDT and converges for midnight in this zone.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const local = zonedParts(new Date(candidate), timeZone);
    const representedAsUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    const correction = desiredAsUtc - representedAsUtc;
    candidate += correction;
    if (correction === 0) return candidate;
  }

  const local = zonedParts(new Date(candidate), timeZone);
  if (
    local.year !== year ||
    local.month !== month ||
    local.day !== day ||
    local.hour !== 0 ||
    local.minute !== 0 ||
    local.second !== 0
  ) {
    throw new RangeError(`Could not resolve local midnight in ${timeZone}`);
  }
  return candidate;
}

function weekWindowFromStartsOn(
  startsOn: string,
  timeZone: string,
): CompetitionWeekWindow {
  const { year, month, day } = parseLocalDate(startsOn);
  if (new Date(Date.UTC(year, month - 1, day)).getUTCDay() !== 1) {
    throw new RangeError("weekStartsOn must be a Monday");
  }

  const startsAt = localMidnightToUtc(startsOn, timeZone);
  const endsAt = localMidnightToUtc(addLocalDays(startsOn, 7), timeZone);
  return {
    startsOn,
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(endsAt).toISOString(),
  };
}

export function getCompetitionWeek(
  instant: string | Date,
  timeZone = COMPETITION_TIME_ZONE,
): CompetitionWeekWindow {
  const date = instant instanceof Date ? new Date(instant.getTime()) : new Date(instant);
  if (!Number.isFinite(date.getTime())) throw new RangeError("instant must be a valid date-time");

  const local = zonedParts(date, timeZone);
  const weekdayIndex = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
    local.weekday,
  );
  if (weekdayIndex < 0) throw new RangeError(`Unsupported weekday ${local.weekday}`);

  const localDate = formatLocalDate(local.year, local.month, local.day);
  return weekWindowFromStartsOn(addLocalDays(localDate, -weekdayIndex), timeZone);
}

function eligibleEnrollments(
  enrollments: readonly CompetitionEnrollment[],
  competitionId: string,
  weekStartsOn: string,
): CompetitionEnrollment[] {
  const unique = new Map<string, CompetitionEnrollment>();

  for (const enrollment of enrollments) {
    if (
      enrollment.competitionId === competitionId &&
      enrollment.weekStartsOn === weekStartsOn &&
      enrollment.eligible &&
      !enrollment.paused &&
      !unique.has(enrollment.participantId)
    ) {
      unique.set(enrollment.participantId, enrollment);
    }
  }

  return [...unique.values()];
}

function creditedParticipants(session: LaundrySession): string[] {
  const acceptedShared = session.sharedMembers
    .filter((member) => member.status === "accepted")
    .map((member) => member.participantId)
    .filter((participantId) => participantId !== session.ownerParticipantId)
    .sort((left, right) => left.localeCompare(right));

  return [...new Set([session.ownerParticipantId, ...acceptedShared])].slice(
    0,
    MAX_CREDITED_SESSION_PARTICIPANTS,
  );
}

function compareRates(left: HallWeekResult, right: HallWeekResult): number {
  const leftCrossProduct = left.creditedCount * right.eligibleCount;
  const rightCrossProduct = right.creditedCount * left.eligibleCount;
  return rightCrossProduct - leftCrossProduct;
}

function assignSharedRanks(halls: HallWeekResult[]): HallWeekResult[] {
  const ranked = halls
    .filter((hall) => hall.publishable)
    .sort((left, right) => compareRates(left, right) || left.hallId.localeCompare(right.hallId));

  let rank = 0;
  let previous: HallWeekResult | undefined;
  for (const hall of ranked) {
    if (!previous || compareRates(previous, hall) !== 0) rank += 1;
    hall.rank = rank;
    previous = hall;
  }
  return ranked;
}

export function scoreCompetitionWeek(
  input: ScoreCompetitionWeekInput,
): CompetitionWeekScore {
  if (!Number.isInteger(input.minimumRoster) || input.minimumRoster < 1) {
    throw new RangeError("minimumRoster must be a positive integer");
  }

  const timeZone = input.timeZone ?? COMPETITION_TIME_ZONE;
  const week = weekWindowFromStartsOn(input.weekStartsOn, timeZone);
  if (input.paused) return { week, credits: [], halls: [], publicHalls: [] };

  const startsAt = Date.parse(week.startsAt);
  const endsAt = Date.parse(week.endsAt);
  const lateDeadline = endsAt + LATE_IMPORT_WINDOW_HOURS * 3_600_000;
  const enrollments = eligibleEnrollments(
    input.enrollments,
    input.competitionId,
    input.weekStartsOn,
  );
  const enrollmentByParticipant = new Map(
    enrollments.map((enrollment) => [enrollment.participantId, enrollment]),
  );
  const creditsByParticipant = new Map<string, WeeklyCredit>();

  const sessions = [...input.sessions].sort((left, right) => {
    const byOccurrence =
      parseInstant(left.occurredAt, "session.occurredAt") -
      parseInstant(right.occurredAt, "session.occurredAt");
    return byOccurrence || left.id.localeCompare(right.id);
  });

  for (const session of sessions) {
    const occurredAt = parseInstant(session.occurredAt, "session.occurredAt");
    const importedAt = parseInstant(session.importedAt, "session.importedAt");
    if (
      session.machineKind !== "washer" ||
      session.status !== "accepted" ||
      session.duplicateOfSessionId !== null ||
      occurredAt < startsAt ||
      occurredAt >= endsAt ||
      importedAt > lateDeadline
    ) {
      continue;
    }

    for (const participantId of creditedParticipants(session)) {
      const enrollment = enrollmentByParticipant.get(participantId);
      if (!enrollment || creditsByParticipant.has(participantId)) continue;

      creditsByParticipant.set(participantId, {
        competitionId: input.competitionId,
        weekStartsOn: input.weekStartsOn,
        participantId,
        hallId: enrollment.hallId,
        sessionId: session.id,
        occurredAt: session.occurredAt,
        late: importedAt > endsAt,
      });
    }
  }

  const credits = [...creditsByParticipant.values()].sort((left, right) =>
    left.participantId.localeCompare(right.participantId),
  );
  const hallEnrollments = new Map<string, CompetitionEnrollment[]>();
  for (const enrollment of enrollments) {
    const current = hallEnrollments.get(enrollment.hallId) ?? [];
    current.push(enrollment);
    hallEnrollments.set(enrollment.hallId, current);
  }

  const halls: HallWeekResult[] = [...hallEnrollments].map(([hallId, members]) => {
    const hallCredits = credits.filter((credit) => credit.hallId === hallId);
    const eligibleCount = members.length;
    const creditedCount = hallCredits.length;
    return {
      competitionId: input.competitionId,
      weekStartsOn: input.weekStartsOn,
      hallId,
      eligibleCount,
      creditedCount,
      score: (100 * creditedCount) / eligibleCount,
      rank: null,
      publishable: eligibleCount >= input.minimumRoster,
      lateUpdated: hallCredits.some((credit) => credit.late),
    };
  });
  const publicHalls = assignSharedRanks(halls);

  return { week, credits, halls, publicHalls };
}

export interface AwardScoreEvent {
  id: string;
  type: "award";
  competitionId: string;
  weekStartsOn: string;
  participantId: string;
  hallId: string;
  sessionId: string;
  recordedAt: string;
}

export interface ReversalScoreEvent {
  id: string;
  type: "reversal";
  competitionId: string;
  weekStartsOn: string;
  participantId: string;
  hallId: string;
  sessionId: string;
  reversesEventId: string;
  recordedAt: string;
}

export type ScoreEvent = AwardScoreEvent | ReversalScoreEvent;

export interface ProjectedWeeklyCredit {
  eventId: string;
  competitionId: string;
  weekStartsOn: string;
  participantId: string;
  hallId: string;
  sessionId: string;
}

/** Rebuilds mutable weekly-credit state from immutable award/reversal events. */
export function projectWeeklyCredits(
  scoreEvents: readonly ScoreEvent[],
): ProjectedWeeklyCredit[] {
  const events = [...scoreEvents].sort((left, right) => {
    const byRecordedAt =
      parseInstant(left.recordedAt, "scoreEvent.recordedAt") -
      parseInstant(right.recordedAt, "scoreEvent.recordedAt");
    return byRecordedAt || left.id.localeCompare(right.id);
  });
  const uniqueEvents = new Map<string, ScoreEvent>();
  for (const event of events) {
    if (!uniqueEvents.has(event.id)) uniqueEvents.set(event.id, event);
  }

  const awards = new Map<string, AwardScoreEvent>();
  for (const event of uniqueEvents.values()) {
    if (event.type === "award") awards.set(event.id, event);
  }

  const reversedAwardIds = new Set<string>();
  for (const event of uniqueEvents.values()) {
    if (event.type !== "reversal") continue;
    const award = awards.get(event.reversesEventId);
    if (
      award &&
      award.competitionId === event.competitionId &&
      award.weekStartsOn === event.weekStartsOn &&
      award.participantId === event.participantId
    ) {
      reversedAwardIds.add(award.id);
    }
  }

  const activeByParticipantWeek = new Map<string, AwardScoreEvent>();
  for (const event of events) {
    if (event.type !== "award" || reversedAwardIds.has(event.id)) continue;
    const key = `${event.competitionId}\u0000${event.weekStartsOn}\u0000${event.participantId}`;
    if (!activeByParticipantWeek.has(key)) activeByParticipantWeek.set(key, event);
  }

  return [...activeByParticipantWeek.values()]
    .map((event) => ({
      eventId: event.id,
      competitionId: event.competitionId,
      weekStartsOn: event.weekStartsOn,
      participantId: event.participantId,
      hallId: event.hallId,
      sessionId: event.sessionId,
    }))
    .sort(
      (left, right) =>
        left.competitionId.localeCompare(right.competitionId) ||
        left.weekStartsOn.localeCompare(right.weekStartsOn) ||
        left.participantId.localeCompare(right.participantId),
    );
}
