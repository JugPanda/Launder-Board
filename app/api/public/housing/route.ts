import { parseHousingFilters } from "@/lib/purdue/catalog";
import { searchPurdueHalls } from "@/lib/purdue/search.server";

export async function GET(request: Request) {
  let filters;
  try { filters = parseHousingFilters(new URL(request.url).searchParams); }
  catch { return Response.json({ error: "Invalid housing filters" }, { status: 400 }); }
  const result = await searchPurdueHalls(filters);
  return Response.json(result, { status: result.status === "available" ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
