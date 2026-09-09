import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/(public)/page";

describe("landing page", () => {
  it("states the capped weekly challenge rule", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /win your hall's weekly laundry challenge/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/one participation credit per week/i)).toBeVisible();
  });
});
