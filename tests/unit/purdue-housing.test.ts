import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { PURDUE_HALLS, hallBySlug, parseHousingFilters, LAUNDRY_SOURCE_URL } from "@/lib/purdue/catalog";
import { searchPurdueHalls, housingSearchParameters } from "@/lib/purdue/search.server";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("Purdue canonical housing", () => {
  it("has exactly 18 distinct official halls, not fictional standings", () => {
    expect(PURDUE_HALLS).toHaveLength(18);
    expect(new Set(PURDUE_HALLS.map(h => h.slug)).size).toBe(18);
    expect(PURDUE_HALLS.map(h => h.officialName)).toEqual(["Cary Quadrangle", "Earhart Hall", "First Street Towers", "Winifred Parker Hall", "Frieda Parker Hall", "Harrison Hall", "Hawkins Hall", "Hillenbrand Hall", "Honors College and Residences", "McCutcheon Hall", "Meredith Hall", "Meredith South", "Owen Hall", "Shreve Hall", "South Hall", "Tarkington Hall", "Wiley Hall", "Windsor Halls"]);
    expect(JSON.stringify(PURDUE_HALLS)).not.toMatch(/Maple|River|Oak|population|score|invite|participant/i);
  });
  it("keeps aliases and ambiguous names distinct", () => {
    expect(hallBySlug("cary-quadrangle")?.aliases).toContain("Cary Quad");
    expect(hallBySlug("first-street-towers")?.aliases).toContain("FST");
    expect(hallBySlug("tarkington-hall")?.aliases).toContain("Tark");
    expect(hallBySlug("mccutcheon-hall")?.aliases).toContain("McCutchen");
    expect(hallBySlug("meredith-hall")).not.toEqual(hallBySlug("meredith-south"));
    expect(hallBySlug("winifred-parker-hall")?.sourceUrl).toContain("parker-south.html");
    expect(hallBySlug("frieda-parker-hall")?.sourceUrl).toContain("parker-north.html");
  });
  it("preserves verified sources and unknown payment categories", () => {
    for (const hall of PURDUE_HALLS) {
      expect(hall).toMatchObject({ campus: "west-lafayette", housingType: "residence_hall", active: true, term: "fall-2026", verifiedAt: "2026-09-09" });
      expect(hall.sourceUrl).toMatch(/^https:\/\/www\.housing\.purdue\.edu\/my-housing\/options\/residence-halls\//);
      expect(hall.laundryPaymentCategory).toBe(hall.slug === "first-street-towers" ? "included_in_rate" : null);
    }
    expect(LAUNDRY_SOURCE_URL).toContain("amenities-accommodations/laundry.html");
  });
  it("rejects unknown, repeated, overlong, and injected filters", () => {
    for (const query of ["term=spring-2027", "payment=free", "housingType=apartment", "q=x&q=y", "q=" + "a".repeat(101), "term=fall-2026%20%7C%7C%20active%3Afalse", "foo=bar"]) {
      expect(() => parseHousingFilters(new URLSearchParams(query))).toThrow();
    }
    expect(parseHousingFilters(new URLSearchParams())).toMatchObject({ term: "fall-2026", housingType: "residence_hall", payment: "all" });
  });
  it("uses a minimized independent Typesense search with aliases and typos", () => {
    const p = housingSearchParameters(parseHousingFilters(new URLSearchParams("q=FST&payment=included_in_rate")));
    expect(p.get("query_by")).toBe("officialName,aliases");
    expect(p.get("num_typos")).toBe("2,1");
    expect(p.get("filter_by")).toContain("laundryPaymentCategory:=included_in_rate");
    expect(p.get("include_fields")).toBe("slug");
  });
  it("reports unavailability, never substitutes local search", async () => {
    vi.stubEnv("TYPESENSE_HOST", "");
    expect(await searchPurdueHalls(parseHousingFilters(new URLSearchParams("q=FST")))).toEqual({ status: "unavailable", halls: [] });
  });
  it("hydrates only canonical IDs from real search hits", async () => {
    vi.stubEnv("TYPESENSE_HOST", "localhost"); vi.stubEnv("TYPESENSE_SEARCH_API_KEY", "test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ hits: [{ document: { slug: "first-street-towers", score: 99 } }, { document: { slug: "maple" } }] }) }));
    const result = await searchPurdueHalls(parseHousingFilters(new URLSearchParams("q=FST")));
    expect(result.status).toBe("available"); expect(result.halls).toEqual([hallBySlug("first-street-towers")]);
    expect(result.explanations?.["first-street-towers"]).toBe("Alias match: FST → First Street Towers.");
  });
  it("creates metadata only with public read RLS and no participant writes", () => {
    const sql = readFileSync("supabase/migrations/0009_purdue_housing.sql", "utf8");
    expect(sql).toContain("create table public.purdue_housing_catalog");
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("for select to anon, authenticated using (true)");
    expect(sql).toContain("revoke all on public.purdue_housing_catalog from anon, authenticated");
    expect(sql).not.toMatch(/insert into public\.residence_halls|references public\.profiles|create policy.*(?:insert|update|delete)/i);
  });
});
