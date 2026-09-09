import type { GuestParticipant } from "./guest-demo";

export const LAUNDRY_STATUSES = [
  { level: 1, label: "Squeaky clean", minimum: 80, range: "80–100", image: "/images/laundry-status/level-1.webp" },
  { level: 2, label: "Fresh", minimum: 60, range: "60–79", image: "/images/laundry-status/level-2.webp" },
  { level: 3, label: "Laundry soon", minimum: 40, range: "40–59", image: "/images/laundry-status/level-3.webp" },
  { level: 4, label: "Stinky", minimum: 20, range: "20–39", image: "/images/laundry-status/level-4.webp" },
  { level: 5, label: "Extra stinky", minimum: 0, range: "0–19", image: "/images/laundry-status/level-5.webp" },
] as const;

export function getLaundryStatus(score: number | null) {
  if (score === null || !Number.isFinite(score) || score < 0 || score > 100) return null;
  return LAUNDRY_STATUSES.find(status => score >= status.minimum) ?? null;
}

export type SquadPlayer = GuestParticipant & { score: number; rank: number };

/** Two non-overlapping ends of the explicitly consenting synthetic cohort. */
export function getSquadRankings(participants: readonly GuestParticipant[]) {
  const eligible = participants.filter((p): p is GuestParticipant & { score: number } =>
    p.visibility !== "private" && p.tracking === "current" && p.reminderConsent === "demo-assumed"
    && p.daysSinceWash !== null && getLaundryStatus(p.score) !== null,
  );
  const highest = [...eligible].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const count = Math.min(3, Math.floor(highest.length / 2));
  const squeakyPeople = highest.slice(0, Math.max(count, highest.length === 1 ? 1 : 0));
  const chosen = new Set(squeakyPeople.map(p => p.id));
  const stinkyPeople = eligible.filter(p => !chosen.has(p.id)).sort((a, b) => a.score - b.score || a.name.localeCompare(b.name)).slice(0, count);
  function rank(people: (GuestParticipant & { score: number })[]): SquadPlayer[] {
    return people.map(person => ({ ...person, rank: people.findIndex(p => p.score === person.score) + 1 }));
  }
  return { squeaky: rank(squeakyPeople), stinky: rank(stinkyPeople) };
}
