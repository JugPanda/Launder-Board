import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import DashboardPage from "@/app/(app)/dashboard/page";
import PrivacyPage from "@/app/(app)/settings/privacy/page";
import HomePage from "@/app/(public)/page";
import { DemoHallSearch } from "@/components/competition/DemoHallSearch";

describe("synthetic demo experience", () => {
  it("offers one-click entry from the landing page", () => {
    render(<HomePage />);

    expect(screen.getByRole("link", { name: /view synthetic demo/i })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByText(/paying more never buys more points/i)).toBeVisible();
  });

  it("keeps the synthetic boundary and weekly cap visible on Maya's dashboard", () => {
    render(<DashboardPage />);

    expect(screen.getByText("Synthetic demo", { selector: "strong" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 1, name: /maya's quest/i })).toBeVisible();
    expect(screen.getByText(/1 of 1 weekly credits/i)).toBeVisible();
    expect(screen.getByText("Simulated CSC-format demo")).toBeVisible();
    expect(screen.getByText("Self-reported")).toBeVisible();
    expect(screen.getByText(/based on activity shared with pay2win/i)).toBeVisible();
  });

  it("demonstrates a clearly labeled typo-tolerant hall search", () => {
    render(<DemoHallSearch />);

    fireEvent.change(screen.getByRole("searchbox", { name: /search synthetic halls/i }), {
      target: { value: "Mapel" },
    });

    expect(screen.getByText("Maple Hall")).toBeVisible();
    expect(screen.getByText(/matched despite 1 typo/i)).toBeVisible();
    expect(screen.getByText(/local simulation of typesense-style typo tolerance/i)).toBeVisible();
  });

  it("defaults sharing controls off and withdraws a preview immediately", () => {
    render(<PrivacyPage />);

    const publicStats = screen.getByRole("switch", { name: /public participant statistics/i });
    const publicHall = screen.getByRole("switch", { name: /public hall affiliation/i });

    expect(publicStats).toHaveAttribute("aria-checked", "false");
    expect(publicHall).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText(/private for now/i)).toBeVisible();

    fireEvent.click(publicStats);
    expect(screen.getByText(/public preview is on/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /withdraw public view now/i })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /withdraw public view now/i }));
    expect(publicStats).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("status")).toHaveTextContent(/withdrawn immediately/i);
  });
});
