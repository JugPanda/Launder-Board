import "server-only";
import { hallBySlug, type HousingFilters, type PurdueHall } from "./catalog";

export const PURDUE_COLLECTION = "purdue_housing_catalog_v1";
export function housingSearchParameters(filters: HousingFilters): URLSearchParams {
  const clauses = ["campus:=west-lafayette", "housingType:=residence_hall", "active:=true", "term:=fall-2026"];
  if (filters.payment !== "all") clauses.push(`laundryPaymentCategory:=${filters.payment}`);
  return new URLSearchParams({ q: filters.q || "*", query_by: "officialName,aliases", query_by_weights: "4,2", num_typos: "2,1", prefix: "true", filter_by: clauses.join(" && "), per_page: "18", include_fields: "slug", prioritize_exact_match: "true" });
}
export type HousingSearchResult = { status: "available" | "unavailable"; halls: PurdueHall[]; explanations?: Record<string, string> };
export async function searchPurdueHalls(filters: HousingFilters): Promise<HousingSearchResult> {
  const host = process.env.TYPESENSE_HOST;
  const key = process.env.TYPESENSE_SEARCH_API_KEY;
  if (!host || !key) return { status: "unavailable", halls: [] };
  try {
    const protocol = process.env.TYPESENSE_PROTOCOL || "https";
    const port = process.env.TYPESENSE_PORT || (protocol === "https" ? "443" : "8108");
    const response = await fetch(`${protocol}://${host}:${port}/collections/${PURDUE_COLLECTION}/documents/search?${housingSearchParameters(filters)}`, { headers: { "X-TYPESENSE-API-KEY": key }, cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error("Search unavailable");
    const payload = await response.json() as { hits?: { document?: { slug?: string } }[] };
    if (!Array.isArray(payload.hits)) throw new Error("Invalid search response");
    const seen = new Set<string>();
    const halls = payload.hits.flatMap(hit => {
      const hall = hallBySlug(hit.document?.slug || "");
      if (!hall || seen.has(hall.slug) || !hall.active || hall.term !== filters.term || (filters.payment !== "all" && (hall.laundryPaymentCategory ?? "unknown") !== filters.payment)) return [];
      seen.add(hall.slug);
      return [hall];
    });
    const query = filters.q.toLowerCase();
    const explanations = Object.fromEntries(halls.map(hall => {
      const alias = query && hall.aliases.find(value => value.toLowerCase() === query);
      const reason = !query ? "Matches the selected catalog filters." : alias ? `Alias match: ${alias} → ${hall.officialName}.` : hall.officialName.toLowerCase().includes(query) ? "Official hall name match." : "Typesense name or alias match with typo tolerance; confirm the official name.";
      return [hall.slug, reason];
    }));
    return { status: "available", halls, explanations };
  } catch { return { status: "unavailable", halls: [] }; }
}
