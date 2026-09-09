import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import HomePage from "@/app/(public)/page";
afterEach(cleanup);
it("separates West Lafayette metadata from fictional standings and disclaims affiliation", () => {
  render(<HomePage />);
  expect(screen.getByText(/Purdue University West Lafayette/)).toBeVisible();
  expect(screen.getByRole("link", { name: /explore Purdue residence halls/i })).toHaveAttribute("href", "/purdue/halls");
  expect(screen.getByText(/not affiliated with or endorsed by/)).toBeVisible();
  expect(screen.getByText(/all people, scores, schedules, and hall standings.*fictional/i)).toBeVisible();
});
