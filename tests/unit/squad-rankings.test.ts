import { describe, expect, it } from "vitest";
import { GUEST_PARTICIPANTS } from "@/lib/guest-demo";
import { getSquadRankings, getLaundryStatus, rankHallStandings } from "@/lib/squad-rankings";
describe("two distinct user squads", () => {
  it("shows highest and lowest scores separately and preserves score ties", () => {
    const { squeaky, stinky } = getSquadRankings(GUEST_PARTICIPANTS);
    expect(squeaky.map(p => p.name)).toEqual(["Avery", "Sam", "Jordan"]);
    expect(stinky.map(p => p.name)).toEqual(["Taylor", "Riley", "Casey"]);
    expect(squeaky.map(p => p.rank)).toEqual([1, 1, 3]);
    expect(squeaky.some(p => stinky.some(other => other.id === p.id))).toBe(false);
  });
  it("does not rank private, unknown, or nonconsenting profiles", () => {
    const { squeaky, stinky } = getSquadRankings(GUEST_PARTICIPANTS);
    expect([...squeaky, ...stinky].map(p => p.name)).not.toContain("Jamie");
    expect([...squeaky, ...stinky].map(p => p.name)).not.toContain("Morgan");
    expect(getSquadRankings(GUEST_PARTICIPANTS.map(p => ({ ...p, reminderConsent: "none" })))).toEqual({ squeaky: [], stinky: [] });
  });
  it("handles a small cohort without duplicated users", () => {
    const result = getSquadRankings(GUEST_PARTICIPANTS.slice(0,2));
    expect(result.squeaky).toHaveLength(1);
    expect(result.stinky).toHaveLength(1);
    expect(result.squeaky[0].id).not.toBe(result.stinky[0].id);
  });
});
describe("supplied status artwork", () => {
  it.each([[100,1],[80,1],[79,2],[60,2],[59,3],[40,3],[39,4],[20,4],[19,5],[0,5]])("maps score %s to level %s", (score, level) => {
    expect(getLaundryStatus(score)?.level).toBe(level);
    expect(getLaundryStatus(score)?.image).toBe(`/images/laundry-status/level-${level}.webp`);
  });
  it("never assigns a dirty status to unknown or invalid tracking", () => {
    for (const score of [null, NaN, -1, 101]) expect(getLaundryStatus(score)).toBeNull();
  });
});

describe("Dorm Wars ranking", () => {
  it("assigns the same competition rank to equal hall averages", () => {
    expect(rankHallStandings([
      { name: "Earhart Hall", count: 2, sum: 180, average: 90 },
      { name: "Harrison Hall", count: 2, sum: 180, average: 90 },
      { name: "Shreve Hall", count: 2, sum: 120, average: 60 },
    ]).map(({ name, rank }) => [name, rank])).toEqual([
      ["Earhart Hall", 1],
      ["Harrison Hall", 1],
      ["Shreve Hall", 3],
    ]);
  });
});
