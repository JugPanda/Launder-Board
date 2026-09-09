/** Standalone, bounded LaundroStat guest simulation. No APIs or persistence. */
export const GUEST_DATA_AS_OF = '2026-09-08';
export const GUEST_DEMO_ASSUMPTIONS = Object.freeze([
  'All nine participants are synthetic brief examples, as of September 8, 2026. No actual student activity or CSC connection is used.',
  'PRIMARY Clean-O-Meter is an explicitly synthetic model: clamp(100 - 4 * daysSinceWash + 2 * clamp(scrubStreak, 0, 6), 0, 100), rounded to two decimals; unknown tracking has no score. It measures recency and consistency, never load volume.',
  'Streak, record-source labels, and usual schedules are generated scenario fields, not verified facts. CSC-format means simulated format only, not an actual connection or verified completion.',
  'Public participants and the two Friends participants are assumed to consent to reminders in this demo scenario only. This is not real friendship or authorization.',
  'Reminder search returns only consent-assumed, current, non-private profiles and coarse days-since-wash, never exact activity times or load history.',
]);

function nonnegative(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be finite and nonnegative`);
  return value;
}

function roundScore(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('Score exceeds the finite numeric range');
  const bounded = Math.max(0, value);
  return Number(bounded.toFixed(2));
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
}

function participant(
  id: string, name: string, hall: GuestHall, daysSinceWash: number | null,
  visibility: GuestParticipant['visibility'],
  scrubScore = 0,
): GuestParticipant {
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
  });
}

export const GUEST_PARTICIPANTS: readonly GuestParticipant[] = Object.freeze([
  participant('U001', 'Avery', 'Earhart Hall', 1, 'public', 3),
  participant('U002', 'Jordan', 'Earhart Hall', 5, 'friends', 2),
  participant('U003', 'Riley', 'Earhart Hall', 17, 'public'),
  participant('U004', 'Sam', 'Harrison Hall', 2, 'public', 4),
  participant('U005', 'Casey', 'Harrison Hall', 14, 'friends'),
  participant('U006', 'Morgan', 'Harrison Hall', null, 'private'),
  participant('U007', 'Alex', 'Shreve Hall', 6, 'public', 1),
  participant('U008', 'Taylor', 'Shreve Hall', 21, 'public'),
  participant('U009', 'Jamie', 'Shreve Hall', 29, 'private'),
]);

export interface GuestSearchFilters { query?: string; hall?: string; minDays?: number }
export type GuestSearchResult = Pick<GuestParticipant, 'id' | 'name' | 'hall' | 'reminderConsent'> & {
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
      tracking: 'current', visibility: p.visibility, reminderConsent: p.reminderConsent }];
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
