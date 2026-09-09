import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SquadRankings, LaundryStatus } from "@/components/guest-demo/SquadRankings";
afterEach(cleanup);
it("renders two opposite rankings and the matching supplied sock artwork", () => {
  render(<SquadRankings />);
  const squeaky = screen.getByRole("list", { name: "Squeaky Squad rankings" });
  const stinky = screen.getByRole("list", { name: "Stinky Squad rankings" });
  expect(within(squeaky).getAllByRole("heading").map(x => x.textContent)).toEqual(["Avery", "Sam", "Jordan"]);
  expect(within(stinky).getAllByRole("heading").map(x => x.textContent)).toEqual(["Taylor", "Riley", "Casey"]);
  expect(within(stinky).getByRole("img", { name: "Level 5: Extra stinky sock" })).toBeVisible();
  expect(within(squeaky).getAllByRole("img", { name: "Level 1: Squeaky clean sock" })).toHaveLength(3);
  expect(screen.queryByText("Jamie")).toBeNull();
});
it("does not attach a status image to unknown tracking", () => {
  render(<LaundryStatus score={null} />);
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getByText(/tracking unknown/i)).toBeVisible();
});
