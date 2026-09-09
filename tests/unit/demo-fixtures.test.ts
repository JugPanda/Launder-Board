import { describe, expect, it } from "vitest";

import { DEMO_COMPETITION, DEMO_PROFILE } from "@/lib/demo/fixtures";

describe("synthetic demo fixtures", () => {
  it("normalizes hall scores by locked eligible participants", () => {
    expect(DEMO_COMPETITION.halls.map(({ name, creditedParticipants, eligibleParticipants, score }) => ({
      name,
      fraction: `${creditedParticipants}/${eligibleParticipants}`,
      score,
    }))).toEqual([
      { name: "Maple Hall", fraction: "12/16", score: 75 },
      { name: "River Hall", fraction: "12/20", score: 60 },
      { name: "Oak Hall", fraction: "9/18", score: 50 },
    ]);
  });

  it("caps Maya's weekly credit at one", () => {
    expect(DEMO_PROFILE.weeklyCredit).toEqual({ earned: 1, cap: 1 });
  });
});
