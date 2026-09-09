import Link from "next/link";
import { DIRECTORY_SOURCE_URL, LAUNDRY_SOURCE_URL, PURDUE_HALLS, hallBySlug, parseHousingFilters, type HousingFilters, type PurdueHall } from "@/lib/purdue/catalog";
import { searchPurdueHalls } from "@/lib/purdue/search.server";

export const metadata = { title: "Purdue residence hall directory | Launder Board", description: "Source-linked West Lafayette residence hall metadata for fall 2026. Independent directory, not enrollment or competition standings." };
const control = "min-h-11 w-full rounded-xl border border-line bg-surface px-3 py-2";
function HallList({ halls, filters, explanations }: { halls: readonly PurdueHall[]; filters?: HousingFilters; explanations?: Record<string, string> }) {
  return <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{halls.map(hall => {
    const query = new URLSearchParams();
    if (filters) { query.set("q", filters.q); query.set("term", filters.term); query.set("housingType", filters.housingType); query.set("payment", filters.payment); }
    query.set("hall", hall.slug);
    return <li key={hall.slug} className="rounded-2xl border border-line bg-surface p-5">
      <Link prefetch={false} className="inline-flex min-h-11 items-center font-bold text-accent underline underline-offset-4" href={`/purdue/halls?${query}#hall-details`}>{hall.officialName}</Link>
      <p className="text-sm text-muted">West Lafayette · Residence hall</p>
      {explanations?.[hall.slug] && <p className="mt-2 text-sm text-muted">{explanations[hall.slug]}</p>}
      <p className="mt-2 text-sm">{hall.laundryPaymentCategory ? "Laundry included in housing rate" : "Laundry payment category not verified"}</p>
    </li>;
  })}</ul>;
}
export default async function PurdueHallsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) if (value !== undefined) for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
  let filters: HousingFilters | undefined;
  try { filters = parseHousingFilters(params); } catch { /* Show explicit invalid state, not a silently changed query. */ }
  const requested = !!filters && (!!filters.q || filters.payment !== "all" || params.has("term") || params.has("housingType"));
  const result = requested && filters ? await searchPurdueHalls(filters) : undefined;
  const selected = filters?.hall ? hallBySlug(filters.hall) : undefined;
  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 sm:px-8">
    <nav aria-label="Directory navigation"><Link href="/" className="inline-flex min-h-11 items-center font-bold text-accent">← Launder Board</Link></nav>
    <header className="max-w-3xl py-8">
      <p className="font-mono text-sm font-bold uppercase tracking-widest text-accent">Purdue context · Fall 2026</p>
      <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Find your residence hall.</h1>
      <p className="mt-5 text-lg text-muted">18 source-linked West Lafayette residence halls. This independent directory is not operated by Purdue and does not enroll you, establish residence, or show competition standings.</p>
      <p className="mt-3 text-sm text-muted">Names and source destinations checked September 9, 2026. Housing availability and your assignment must be confirmed with Purdue.</p>
    </header>
    <section aria-labelledby="search-heading" className="rounded-2xl border border-line bg-surface p-5">
      <h2 id="search-heading" className="text-xl font-bold">Search the hall catalog</h2>
      <p id="search-help" className="mt-2 text-sm text-muted">Typesense searches official names and aliases with typo tolerance. Try Cary Quad, FST, Tark, or McCutchen. Meredith Hall and Meredith South are separate; choose Frieda or Winifred for a specific Parker hall.</p>
      <form method="get" action="/purdue/halls" className="mt-4 space-y-4">
        <label className="block font-semibold">Hall name or alias<input name="q" type="search" maxLength={100} defaultValue={filters?.q ?? ""} aria-describedby="search-help" className={`${control} mt-2`} placeholder="e.g. Cary Quad" /></label>
        <details><summary className="min-h-11 cursor-pointer py-3 font-semibold">Term, housing type, and verified payment filters</summary>
          <div className="grid gap-4 py-3 sm:grid-cols-3">
            <label className="text-sm font-semibold">Term<select name="term" defaultValue={filters?.term ?? "fall-2026"} className={`${control} mt-2`}><option value="fall-2026">Fall 2026</option></select></label>
            <label className="text-sm font-semibold">Housing type<select name="housingType" defaultValue={filters?.housingType ?? "residence_hall"} className={`${control} mt-2`}><option value="residence_hall">Residence halls</option></select></label>
            <label className="text-sm font-semibold">Verified laundry payment<select name="payment" defaultValue={filters?.payment ?? "all"} className={`${control} mt-2`}><option value="all">All payment categories</option><option value="included_in_rate">Verified: included in rate</option><option value="unknown">Payment category not verified</option></select></label>
          </div>
        </details>
        <div className="flex flex-wrap gap-4"><button type="submit" className="min-h-11 rounded-xl bg-accent px-5 font-bold text-white">Search halls</button><Link href="/purdue/halls" className="inline-flex min-h-11 items-center text-accent underline">Clear search and filters</Link></div>
      </form>
    </section>
    {!filters && <p role="alert" className="my-5 rounded-xl border border-line p-4">Invalid search or filters. Use the supported options above, or clear search and filters.</p>}
    {result && <section aria-labelledby="results-heading" className="my-8"><h2 id="results-heading" className="mb-4 text-2xl font-bold">Search results</h2>
      {result.status === "unavailable" ? <p role="status">Search is unavailable right now. No search results have been substituted. Browse the full canonical directory below, independent of your search and filters.</p> : <><p role="status" className="mb-4 text-muted">{result.halls.length} matching {result.halls.length === 1 ? "hall" : "halls"} from Typesense.{result.halls.length === 0 && " Try an official name, remove the payment filter, or clear your search."}</p><HallList halls={result.halls} filters={filters} explanations={result.explanations} /></>}
    </section>}
    {selected && <section id="hall-details" aria-labelledby="hall-heading" className="my-8 scroll-mt-5 rounded-2xl border-2 border-accent bg-surface p-6">
      <p className="text-sm font-bold text-accent">Selected hall · Canonical metadata only</p><h2 id="hall-heading" className="mt-2 text-3xl font-black">{selected.officialName}</h2>
      <p className="mt-3">West Lafayette · Residence hall · Fall 2026</p><p className="mt-2 text-sm text-muted">Search aliases: {selected.aliases.join(", ")}</p>
      <p className="mt-4">{selected.laundryPaymentCategory ? "Purdue states that laundry at First Street Towers is included in the housing rate." : "This hall’s laundry payment category has not been verified. Do not infer a price or payment method from this directory."}</p>
      <p className="mt-3 text-sm text-muted">Verified September 9, 2026. Competition eligibility is unverified. No active competition is verified for this hall. No occupancy, residence assignment, or participation claim is made.</p>
      <div className="mt-4 flex flex-wrap gap-5"><a className="inline-flex min-h-11 items-center font-semibold text-accent underline" href={selected.sourceUrl}>Official {selected.officialName} page ↗</a><a className="inline-flex min-h-11 items-center font-semibold text-accent underline" href={LAUNDRY_SOURCE_URL}>Purdue laundry guidance ↗</a></div>
    </section>}
    <section aria-labelledby="directory-heading" className="my-10"><h2 id="directory-heading" className="text-2xl font-bold">Full canonical directory · 18 halls</h2><p className="mb-5 mt-2 text-muted">Always shows all 18 catalog entries, independent of search and filters. Select a hall for details and its official source.</p><HallList halls={PURDUE_HALLS} /></section>
    <footer className="border-t border-line py-6 text-sm text-muted"><p>Purdue’s laundry guidance describes CSCPay and the First Street Towers inclusion. Other per-hall payment categories remain unverified here; consult the official guidance for current arrangements rather than relying on stored prices.</p><div className="mt-3 flex flex-wrap gap-5"><a className="inline-flex min-h-11 items-center text-accent underline" href={DIRECTORY_SOURCE_URL}>Official Purdue residence hall directory ↗</a><a className="inline-flex min-h-11 items-center text-accent underline" href={LAUNDRY_SOURCE_URL}>Official laundry guidance ↗</a></div></footer>
  </main>;
}
