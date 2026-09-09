import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GUEST_PARTICIPANTS, GUEST_DATA_AS_OF, GUEST_DEMO_ASSUMPTIONS, searchGuestParticipants, cleanScore, matchWashMates } from '../../lib/guest-demo';

describe('current guest scoring surface', () => {
  it('contains no executable legacy load-weight or bonus scoring model', () => {
    const source = readFileSync('lib/guest-demo.ts', 'utf8');
    expect(source).not.toMatch(/calculateLoadScore|applyInactivityPenalty|scoreBasis|weightLbs|lintBonus|foldBonus|loadOrdinal3Days|loads24Hours/);
  });
});

describe('bounded synthetic roster and privacy-safe reminder search', () => {
  it('preserves the nine brief identities and states', () => {
    expect(GUEST_DATA_AS_OF).toBe('2026-09-08');
    expect(GUEST_PARTICIPANTS.map(p => [p.id, p.name, p.hall, p.daysSinceWash, p.tracking, p.visibility])).toEqual([
      ['U001', 'Avery', 'Earhart Hall', 1, 'current', 'public'],
      ['U002', 'Jordan', 'Earhart Hall', 5, 'current', 'friends'],
      ['U003', 'Riley', 'Earhart Hall', 17, 'current', 'public'],
      ['U004', 'Sam', 'Harrison Hall', 2, 'current', 'public'],
      ['U005', 'Casey', 'Harrison Hall', 14, 'current', 'friends'],
      ['U006', 'Morgan', 'Harrison Hall', null, 'unknown', 'private'],
      ['U007', 'Alex', 'Shreve Hall', 6, 'current', 'public'],
      ['U008', 'Taylor', 'Shreve Hall', 21, 'current', 'public'],
      ['U009', 'Jamie', 'Shreve Hall', 29, 'current', 'private'],
    ]);
  });
  it('exposes only the reproducible recency-and-consistency score', () => {
    expect(GUEST_DEMO_ASSUMPTIONS.join(' ')).toMatch(/synthetic/i);
    for (const participant of GUEST_PARTICIPANTS) {
      expect(participant.score).toBe(cleanScore(participant.daysSinceWash, participant.scrubStreak));
      expect(participant).not.toHaveProperty('scoreBasis');
    }
  });
  it('defaults to the two-week reminder cohort with assumed friend consent', () => {
    expect(searchGuestParticipants().map(p => p.name)).toEqual(['Riley', 'Casey', 'Taylor']);
    expect(searchGuestParticipants({ minDays: 0 })).toHaveLength(7);
    expect(searchGuestParticipants({ query: 'Jamie', minDays: 0 })).toEqual([]);
    expect(searchGuestParticipants({ query: 'Morgan', minDays: 0 })).toEqual([]);
    expect(searchGuestParticipants({ query: 'CASE', hall: 'Harrison Hall' }).map(p => p.name)).toEqual(['Casey']);
    expect(searchGuestParticipants({ hall: 'Earhart Hall' }).map(p => p.name)).toEqual(['Riley']);
    expect(searchGuestParticipants({ minDays: 22 })).toEqual([]);
    expect(() => searchGuestParticipants({ minDays: NaN })).toThrow();
  });
  it('returns no exact activity timestamps or score history in reminders', () => {
    for (const result of searchGuestParticipants({ minDays: 0 })) {
      expect(result).not.toHaveProperty('scoreBasis');
      expect(result).not.toHaveProperty('lastWashAt');
      expect(result).not.toHaveProperty('lastRecordedWash');
      expect(result).not.toHaveProperty('lastFullCycleDate');
    }
  });
});

describe('primary recency score and Wash Mates', () => {
  it('scores recency and consistency, never volume; unknown has no score', () => {
    expect(cleanScore(null, 0)).toBeNull();
    expect(cleanScore(0, 6)).toBe(100);
    expect(cleanScore(14, 0)).toBe(44);
    expect(cleanScore(14, 3)).toBe(50);
    expect(cleanScore(100, 6)).toBe(0);
    expect(cleanScore(14, 99)).toBe(56);
    expect(() => cleanScore(-1, 0)).toThrow();
    expect(() => cleanScore(1, 0.5)).toThrow();
    expect(() => cleanScore(Infinity, 0)).toThrow();
    expect(GUEST_PARTICIPANTS.find(p => p.name === 'Morgan')?.lastFullCycleDate).toBeNull();
    expect(GUEST_PARTICIPANTS[0].lastFullCycleDate).toBe('2026-09-07');
  });
  it('matches actual shared days and overlapping time windows only', () => {
    const matches = matchWashMates({ days: ['Tuesday'], timeWindow: '18:30-20:30' });
    expect(matches.map(p => p.name)).toEqual(['Avery', 'Jordan', 'Riley', 'Alex', 'Taylor']);
    expect(matches[0].sharedDays).toEqual(['Tuesday']);
    expect(matches[0].sharedTimeWindow).toBe('18:30–19:00');
    expect(matches[1].sharedTimeWindow).toBe('18:30–20:00');
    expect(matches.every(p => !('lastFullCycleDate' in p))).toBe(true);
    expect(matchWashMates({ days: ['Monday'], timeWindow: '18:30–20:30' })).toEqual([]);
    expect(matchWashMates({ days: ['Tuesday'], timeWindow: '20:00–21:00' })).toEqual([]);
    expect(matchWashMates({ days: [], timeWindow: '18:00–19:00' })).toEqual([]);
    expect(() => matchWashMates({ days: ['Tuesday'], timeWindow: '25:00–26:00' })).toThrow();
    expect(() => matchWashMates({ days: ['Tuesday'], timeWindow: '20:00–18:00' })).toThrow();
    expect(() => matchWashMates({ days: ['noday'], timeWindow: '18:00–19:00' })).toThrow();
  });
});
