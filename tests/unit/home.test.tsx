import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/(public)/page";
describe("landing page", () => {
  it("introduces the recency-based guest experience", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { level: 1, name: /laundry. with a competitive streak/i })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Your Clean-O-Meter" })).toBeVisible();
    expect(screen.queryByText(/one participation credit per week/i)).toBeNull();
    expect(screen.getByRole("link", { name: /view synthetic demo/i })).toHaveAttribute("href", "/demo");
  });
});
