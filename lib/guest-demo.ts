/** Standalone, bounded LaundroStat guest simulation. No APIs or persistence. */
export const GUEST_DATA_AS_OF = '2026-09-08';
export const GUEST_DEMO_ASSUMPTIONS = Object.freeze([
  'All nine participants are synthetic brief examples, as of September 8, 2026. No actual student activity or CSC connection is used.',
  'PRIMARY Clean-O-Meter is an explicitly synthetic model: clamp(100 - 4 * daysSinceWash + 2 * clamp(scrubStreak, 0, 6), 0, 100), rounded to two decimals; unknown tracking has no score. It measures recency and consistency, never load volume.',
  'Streak, source credibility labels, and usual schedules are generated scenario fields, not verified facts. CSC-format means simulated format only, not an actual connection or verified completion.',
  'Weighted load scores in scoreBasis are a nonprimary proposed-rules lab only, NOT the Clean-O-Meter or leaderboard ranking.',
  'Public participants and the two Friends participants are assumed to consent to reminders in this demo scenario only. This is not real friendship or authorization.',
  'Bonuses are additive percentages of base load points; delay penalties subtract percentages of the same base, floored at zero. Scrub then multiplies the result.',
  'Log means log10. loadOrdinal3Days and loads24Hours include the current completed load; loads after the third in 24 hours earn zero.',
  'lintBonus means a qualifying clean-lint photo within 15 minutes; foldBonus means a qualifying folded-clothes photo within 60 minutes. These flags are simulated, not verified evidence.',
  'scrubScore is an already-earned integer level, clamped to 0–6. Earning eligibility (within 8 days, at most once per 6 days) is not inferred without activity history.',
  'Inactivity applies to the entire simulated profile total at day 16 and every 3 additional days, compounded. Unknown tracking is not treated as inactivity.',
  'Reminder search returns only consent-assumed, current, non-private profiles and coarse days-since-wash, never exact activity times or load history.',
]);

export interface LoadScoreInput {
  weightLbs: number;
  lintBonus?: boolean;
  foldBonus?: boolean;
  washerDelayMinutes?: number;
  dryerDelayMinutes?: number;
  loadOrdinal3Days?: number;
  /** Number of loads in the rolling 24 hours INCLUDING this load. */
  loads24Hours?: number;
  scrubScore?: number;
}

function nonnegative(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and nonnegative`);
  return value;
}
function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${name} must be a positive integer`);
  return value;
}
function roundScore(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('Score exceeds the finite numeric range');
  const bounded = Math.max(0, value);
  return Number(bounded.toFixed(2));
}

/** Proposed rules only; assumes a completed load and qualified bonus flags. */
export function calculateLoadScore(input: LoadScoreInput): number {
  const weight = nonnegative(input.weightLbs, 'weightLbs');
  const washerDelay = nonnegative(input.washerDelayMinutes ?? 0, 'washerDelayMinutes');
  const dryerDelay = nonnegative(input.dryerDelayMinutes ?? 0, 'dryerDelayMinutes');
  const ordinal = positiveInteger(input.loadOrdinal3Days ?? 1, 'loadOrdinal3Days');
  const loads24Hours = positiveInteger(input.loads24Hours ?? 1, 'loads24Hours');
  const scrub = input.scrubScore ?? 0;
  if (!Number.isSafeInteger(scrub)) throw new RangeError('scrubScore must be a finite integer');
  for (const bonus of [input.lintBonus, input.foldBonus]) {
    if (bonus !== undefined && typeof bonus !== 'boolean') throw new TypeError('Bonus flags must be boolean');
  }
  if (loads24Hours > 3) return 0;
  const base = 0.6 * weight + 0.4 * weight;
  const bonus = (input.lintBonus ? 0.1 : 0) + (input.foldBonus ? 0.3 : 0);
  const penalty = Math.floor(washerDelay / 30) * 0.1 + Math.floor(dryerDelay / 30) * 0.05;
  const frequencyMultiplier = Math.max(0, 1 - Math.log10(ordinal));
  const scrubMultiplier = 1 + Math.max(0, Math.min(6, scrub)) * 0.05;
  return roundScore(base * Math.max(0, 1 + bonus - penalty) * frequencyMultiplier * scrubMultiplier);
}

/** Pass an unpenalized whole profile score; do not repeatedly penalize a stored result. */
export function applyInactivityPenalty(score: number, daysSinceWash: number): number {
  nonnegative(score, 'score');
  nonnegative(daysSinceWash, 'daysSinceWash');
  const penalties = daysSinceWash < 16 ? 0 : 1 + Math.floor((daysSinceWash - 16) / 3);
  return roundScore(score * Math.pow(0.9, penalties));
}

/** Synthetic recency/consistency model, independent of load volume and source claims. */
export function cleanScore(days: number | null, streak: number): number | null {
  nonnegative(streak, 'streak');
  if (!Number.isSafeInteger(streak)) throw new RangeError('streak must be an integer');
  if (days === null) return null;
  nonnegative(days, 'days');
  return roundScore(Math.min(100, Math.max(0, 100 - days * 4 + Math.min(6, streak) * 2)));
}

export type GuestHall = 'Earhart Hall' | 'Harrison Hall' | 'Shreve Hall';
export interface GuestParticipant {
  readonly id: string;
  readonly name: string;
  readonly hall: GuestHall;
  readonly daysSinceWash: number | null;
  readonly tracking: 'current' | 'unknown';
  readonly visibility: 'public' | 'friends' | 'private';
  readonly reminderConsent: 'demo-assumed' | 'none';
  readonly score: number | null;
  readonly scrubStreak: number;
  readonly lastFullCycleDate: string | null;
  readonly source: 'Simulated CSC-format demo' | 'Self-reported demo';
  readonly usualDays: readonly string[];
  readonly usualTimeWindow: string;
  readonly scenarioLabel: string;
  readonly scoreBasis: {
    readonly label: string;
    readonly loads: readonly Readonly<LoadScoreInput>[];
    readonly scoreBeforeInactivity: number;
  };
}

function participant(
  id: string, name: string, hall: GuestHall, daysSinceWash: number | null,
  visibility: GuestParticipant['visibility'], weightLbs: number,
  scrubScore = 0,
): GuestParticipant {
  const loads = Object.freeze(daysSinceWash === null ? [] : [Object.freeze({
    weightLbs, lintBonus: true, foldBonus: true, washerDelayMinutes: 0,
    dryerDelayMinutes: 0, loadOrdinal3Days: 1, loads24Hours: 1, scrubScore,
  })]);
  const scoreBeforeInactivity = roundScore(loads.reduce((sum, load) => sum + calculateLoadScore(load), 0));
  return Object.freeze({
    id, name, hall, daysSinceWash, visibility,
    tracking: daysSinceWash === null ? 'unknown' : 'current',
    reminderConsent: visibility !== 'private' && daysSinceWash !== null ? 'demo-assumed' : 'none',
    score: cleanScore(daysSinceWash, scrubScore),
    scrubStreak: scrubScore,
    lastFullCycleDate: daysSinceWash === null ? null : new Date(Date.UTC(2026, 8, 8 - daysSinceWash)).toISOString().slice(0, 10),
    source: visibility === 'friends' ? 'Self-reported demo' : 'Simulated CSC-format demo',
    usualDays: Object.freeze(hall === 'Earhart Hall' ? ['Tuesday', 'Saturday'] : hall === 'Harrison Hall' ? ['Wednesday', 'Saturday'] : ['Tuesday', 'Sunday']),
    usualTimeWindow: visibility === 'friends' ? '18:00–20:00' : '17:00–19:00',
    scenarioLabel: 'Synthetic scenario: generated streak, schedule and source label; no verified CSC data',
    scoreBasis: Object.freeze({ label: 'Simulated completed-load scenario; not source activity or a source score', loads, scoreBeforeInactivity }),
  });
}

export const GUEST_PARTICIPANTS: readonly GuestParticipant[] = Object.freeze([
  participant('U001', 'Avery', 'Earhart Hall', 1, 'public', 12, 3),
  participant('U002', 'Jordan', 'Earhart Hall', 5, 'friends', 10, 2),
  participant('U003', 'Riley', 'Earhart Hall', 17, 'public', 14),
  participant('U004', 'Sam', 'Harrison Hall', 2, 'public', 11, 4),
  participant('U005', 'Casey', 'Harrison Hall', 14, 'friends', 13),
  participant('U006', 'Morgan', 'Harrison Hall', null, 'private', 0),
  participant('U007', 'Alex', 'Shreve Hall', 6, 'public', 15, 1),
  participant('U008', 'Taylor', 'Shreve Hall', 21, 'public', 12),
  participant('U009', 'Jamie', 'Shreve Hall', 29, 'private', 10),
]);

export interface GuestSearchFilters { query?: string; hall?: string; minDays?: number }
export type GuestSearchResult = Pick<GuestParticipant, 'id' | 'name' | 'hall' | 'reminderConsent' | 'score' | 'scrubStreak' | 'source' | 'scenarioLabel'> & {
  readonly daysSinceWash: number;
  readonly tracking: 'current';
  readonly visibility: 'public' | 'friends';
};

/** Default: two-week reminder cohort. All filters operate only on this fixed synthetic roster. */
export function searchGuestParticipants({ query = '', hall = '', minDays = 14 }: GuestSearchFilters = {}, participants: readonly GuestParticipant[] = GUEST_PARTICIPANTS): GuestSearchResult[] {
  nonnegative(minDays, 'minDays');
  const needle = query.trim().toLowerCase();
  const hallFilter = hall.trim().toLowerCase();
  return participants.flatMap((p): GuestSearchResult[] => {
    if (p.visibility === 'private' || p.tracking !== 'current' || p.daysSinceWash === null || p.reminderConsent !== 'demo-assumed') return [];
    if (p.daysSinceWash < minDays) return [];
    if (hallFilter && hallFilter !== 'all' && p.hall.toLowerCase() !== hallFilter) return [];
    if (needle && !`${p.name} ${p.hall}`.toLowerCase().includes(needle)) return [];
    return [{ id: p.id, name: p.name, hall: p.hall, daysSinceWash: p.daysSinceWash,
      tracking: 'current', visibility: p.visibility, reminderConsent: p.reminderConsent, score: p.score,
      scrubStreak: p.scrubStreak, source: p.source, scenarioLabel: p.scenarioLabel }];
  });
}

export interface WashMateFilters { days: readonly string[]; timeWindow: string }
export type WashMateResult = GuestSearchResult & {
  readonly usualDays: readonly string[];
  readonly usualTimeWindow: string;
  readonly sharedDays: readonly string[];
  readonly sharedTimeWindow: string;
};

function timeRange(window: string): [number, number] {
  const match = /^(\d{2}):(\d{2})\s*[-–]\s*(\d{2}):(\d{2})$/.exec(window.trim());
  if (!match) throw new RangeError('timeWindow must be HH:mm–HH:mm');
  const [, h1, m1, h2, m2] = match.map(Number);
  if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) throw new RangeError('Invalid clock time');
  const start = h1 * 60 + m1, end = h2 * 60 + m2;
  if (end <= start) throw new RangeError('Time window must end after it starts on the same day');
  return [start, end];
}
function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/** Actual day/time overlap on generated consenting fixtures; no messages or persistence. */
export function matchWashMates({ days, timeWindow }: WashMateFilters, participants: readonly GuestParticipant[] = GUEST_PARTICIPANTS): WashMateResult[] {
  const [start, end] = timeRange(timeWindow);
  const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const requested = new Set(days.map(day => day.trim().toLowerCase()));
  if ([...requested].some(day => !weekdays.includes(day))) throw new RangeError('Use full weekday names');
  return searchGuestParticipants({ minDays: 0 }, participants).flatMap(p => {
    const fixture = participants.find(candidate => candidate.id === p.id)!;
    const sharedDays = fixture.usualDays.filter(day => requested.has(day.toLowerCase()));
    const [otherStart, otherEnd] = timeRange(fixture.usualTimeWindow);
    const overlapStart = Math.max(start, otherStart), overlapEnd = Math.min(end, otherEnd);
    if (!sharedDays.length || overlapEnd <= overlapStart) return [];
    return [{ ...p, usualDays: fixture.usualDays, usualTimeWindow: fixture.usualTimeWindow,
      sharedDays, sharedTimeWindow: `${clock(overlapStart)}–${clock(overlapEnd)}` }];
  });
}
