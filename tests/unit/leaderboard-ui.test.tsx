import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NormalizedLeaderboard } from "@/components/competition/NormalizedLeaderboard";
import { DEMO_COMPETITION } from "@/lib/demo/fixtures";

describe("normalized leaderboard", () => {
  it("shows Maple, River, and Oak with numerator and locked denominator", () => {
    render(<NormalizedLeaderboard competition={DEMO_COMPETITION} />);

    const table = screen.getByRole("table", { name: /normalized synthetic leaderboard/i });
    expect(within(table).getByText("Maple Hall")).toBeVisible();
    expect(within(table).getByText("12 / 16")).toBeVisible();
    expect(within(table).getByText("12 / 20")).toBeVisible();
    expect(within(table).getByText("9 / 18")).toBeVisible();
    expect(within(table).getByText("75%")) .toBeVisible();
  });
});
