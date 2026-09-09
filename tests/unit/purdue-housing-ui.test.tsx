import { cleanup, render, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import Page from "@/app/(public)/purdue/halls/page";
import { GET } from "@/app/api/public/housing/route";

afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("Purdue housing public directory", () => {
  it("offers independent canonical browsing and selected source-backed details without enrollment", async () => {
    render(await Page({ searchParams: Promise.resolve({ hall: "first-street-towers" }) }));
    expect(screen.getByRole("heading", { name: "Full canonical directory · 18 halls" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "First Street Towers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Official First Street Towers page ↗" })).toHaveAttribute("href", "https://www.housing.purdue.edu/my-housing/options/residence-halls/first-street.html");
    expect(screen.getByRole("searchbox")).toHaveAttribute("name", "q");
  });
  it("shows unavailable instead of fake results and retains all 18 directory entries", async () => {
    vi.stubEnv("TYPESENSE_HOST", "");
    render(await Page({ searchParams: Promise.resolve({ q: "FST" }) }));
    expect(screen.getByRole("status")).toHaveTextContent("Search is unavailable");
    expect(screen.getAllByRole("listitem")).toHaveLength(18);
  });
  it("returns explicit API validation and service errors", async () => {
    expect((await GET(new Request("https://example.test/api/public/housing?payment=free"))).status).toBe(400);
    vi.stubEnv("TYPESENSE_HOST", "");
    const response = await GET(new Request("https://example.test/api/public/housing?q=FST"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "unavailable", halls: [] });
  });
});
