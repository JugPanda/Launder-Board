import { z } from "zod";
import data from "./halls.json";

export const DIRECTORY_SOURCE_URL = "https://www.housing.purdue.edu/my-housing/options/residence-halls/index.html";
export const LAUNDRY_SOURCE_URL = "https://www.housing.purdue.edu/my-housing/info/amenities-accommodations/laundry.html";
export const hallSchema = z.object({
  officialName: z.string().min(1), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  aliases: z.array(z.string()), campus: z.literal("west-lafayette"),
  housingType: z.literal("residence_hall"), active: z.boolean(), term: z.literal("fall-2026"),
  laundryPaymentCategory: z.literal("included_in_rate").nullable(),
  verifiedAt: z.literal("2026-09-09"), sourceUrl: z.url().startsWith("https://www.housing.purdue.edu/"),
}).strict();
export type PurdueHall = z.infer<typeof hallSchema>;
export const PURDUE_HALLS: readonly PurdueHall[] = z.array(hallSchema).length(18).parse(data);
export function hallBySlug(slug: string) { return PURDUE_HALLS.find(h => h.slug === slug); }
const filtersSchema = z.object({
  q: z.string().trim().max(100).default(""),
  term: z.literal("fall-2026").default("fall-2026"),
  housingType: z.literal("residence_hall").default("residence_hall"),
  payment: z.enum(["all", "included_in_rate", "unknown"]).default("all"),
  hall: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
}).strict();
export type HousingFilters = z.infer<typeof filtersSchema>;
export function parseHousingFilters(params: URLSearchParams): HousingFilters {
  const record: Record<string, string> = {};
  for (const [key, value] of params) {
    if (Object.hasOwn(record, key)) throw new Error("Repeated filter");
    record[key] = value;
  }
  const parsed = filtersSchema.parse(record);
  if (parsed.hall && !hallBySlug(parsed.hall)) throw new Error("Unknown hall");
  return parsed;
}
