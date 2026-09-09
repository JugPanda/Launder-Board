import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HomePage from "@/app/(public)/page";

afterEach(cleanup);

describe("landing page", () => {
  it("introduces the recency-based guest experience", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1, name: /laundry. with a competitive streak/i })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Your Clean-O-Meter" })).toBeVisible();
    expect(screen.queryByText(/one participation credit per week/i)).toBeNull();
    expect(screen.getByRole("link", { name: /view synthetic demo/i })).toHaveAttribute("href", "/demo");
  });

  it("carries the marketed social loop and responsible pilot path into the site", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "Laundry is easy to put off." })).toBeVisible();
    expect(screen.getByRole("heading", { name: "One routine. Five ways to play." })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Squeaky Squad / Stinky Squad" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Fair by design." })).toBeVisible();
    expect(screen.getByText(/real participation must start with consent/i)).toBeVisible();
    expect(screen.getByText(/consent-assumed synthetic friends/i)).toBeVisible();
    expect(screen.getByRole("heading", { name: "From demo to responsible pilot." })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Interview, then add controls" })).toBeVisible();
    expect(screen.getByText(/implement private-by-default onboarding.*then test them before any supervised residence-hall pilot/i)).toBeVisible();
    expect(screen.getByText(/approved data source/i)).toBeVisible();
    expect(screen.queryByText(/complete social loop|the social routine is here now/i)).toBeNull();
  });
});
