import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ActivityPage from "@/app/(app)/activity/page";
import { SyntheticDemoBanner } from "@/components/demo/SyntheticDemoBanner";
import { AppNavigation } from "@/components/navigation/AppNavigation";

afterEach(cleanup);

describe("activity history", () => {
  it("renders the complete synthetic history with honest source and tracking labels", () => {
    render(<ActivityPage />);

    expect(screen.getByRole("heading", { level: 1, name: /activity history/i })).toBeVisible();
    expect(screen.getAllByText("Simulated CSC-format demo")).toHaveLength(1);
    expect(screen.getAllByText("Self-reported")).toHaveLength(2);
    expect(screen.getByText(/based on activity shared with Launder Board/i)).toBeVisible();
    expect(screen.getByText(/provider-confirmed/i)).toBeVisible();
    expect(screen.getByRole("link", { name: /add activity/i })).toHaveAttribute("href", "/activity/new");
    expect(screen.getByRole("link", { name: /import activity/i })).toHaveAttribute("href", "/activity/import");
    for (const link of screen.getAllByRole("link", { name: "Activity" })) {
      expect(link).toHaveAttribute("aria-current", "page");
    }
  });

  it("keeps mobile navigation and the demo exit control touch-safe", () => {
    render(
      <>
        <SyntheticDemoBanner />
        <AppNavigation active="activity" />
      </>,
    );

    expect(screen.getByRole("link", { name: "Exit" })).toHaveClass("min-h-11", "min-w-11");
    const mobileNav = screen.getByRole("navigation", { name: "Mobile navigation" });
    expect(mobileNav.firstElementChild).toHaveClass("grid", "grid-cols-5", "w-full");
    for (const link of Array.from(mobileNav.querySelectorAll("a"))) {
      expect(link).toHaveClass("min-h-12", "min-w-0");
    }
  });
});
