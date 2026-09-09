"use client";

import { useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";

import { DEMO_COMPETITION } from "@/lib/demo/fixtures";

function editDistance(left: string, right: string) {
  const distances = Array.from(
    { length: left.length + 1 },
    (_, leftIndex) => Array.from({ length: right.length + 1 }, (_, rightIndex) => (
      leftIndex === 0 ? rightIndex : leftIndex
    )),
  );

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      distances[leftIndex][rightIndex] = Math.min(
        distances[leftIndex - 1][rightIndex] + 1,
        distances[leftIndex][rightIndex - 1] + 1,
        distances[leftIndex - 1][rightIndex - 1] + substitutionCost,
      );

      const isAdjacentTransposition = leftIndex > 1
        && rightIndex > 1
        && left[leftIndex - 1] === right[rightIndex - 2]
        && left[leftIndex - 2] === right[rightIndex - 1];
      if (isAdjacentTransposition) {
        distances[leftIndex][rightIndex] = Math.min(
          distances[leftIndex][rightIndex],
          distances[leftIndex - 2][rightIndex - 2] + 1,
        );
      }
    }
  }

  return distances[left.length][right.length];
}

export function DemoHallSearch() {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!normalizedQuery) return [];

    return DEMO_COMPETITION.halls
      .map((hall) => {
        const firstWord = hall.name.split(" ")[0].toLowerCase();
        const distance = editDistance(normalizedQuery, firstWord);
        return { hall, distance };
      })
      .filter(({ hall, distance }) => hall.name.toLowerCase().includes(normalizedQuery) || distance <= 2)
      .sort((a, b) => a.distance - b.distance);
  }, [normalizedQuery]);

  return (
    <section aria-labelledby="search-demo-heading" className="rounded-3xl border border-slate-800 bg-slate-950 p-5 text-white shadow-[0_20px_60px_rgb(15_23_42_/_18%)] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Typesense search demonstration</p>
          <h2 id="search-demo-heading" className="mt-1 text-2xl font-black tracking-tight">Find a synthetic hall</h2>
        </div>
        <span className="rounded-full bg-pink-500/15 px-3 py-1 text-xs font-black text-pink-200 ring-1 ring-inset ring-pink-300/30">Local synthetic data</span>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
        This is a local simulation of Typesense-style typo tolerance—not a live search request or service fallback.
      </p>

      <label className="mt-5 block" htmlFor="demo-hall-search">
        <span className="sr-only">Search synthetic halls</span>
        <span className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-600 bg-white px-4 text-slate-950 focus-within:ring-3 focus-within:ring-cyan-300">
          <Search aria-hidden="true" className="shrink-0 text-slate-500" size={20} />
          <input
            className="min-h-11 min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-slate-500"
            id="demo-hall-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try “Mapel”"
            type="search"
            value={query}
          />
        </span>
      </label>

      <div aria-live="polite" className="mt-4 min-h-14">
        {!normalizedQuery ? (
          <p className="text-sm text-slate-400">Type a hall name. “Mapel” intentionally demonstrates a one-letter transposition.</p>
        ) : results.length > 0 ? (
          <ul className="space-y-2" aria-label="Synthetic search results">
            {results.map(({ hall, distance }) => (
              <li className="flex min-h-14 items-center justify-between gap-4 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3" key={hall.slug}>
                <div>
                  <p className="font-black">{hall.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">Synthetic competition hall</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-right text-xs font-bold text-cyan-300">
                  <Sparkles aria-hidden="true" size={15} />
                  {distance === 0 ? "Exact match" : `Matched despite ${distance} typo${distance === 1 ? "" : "s"}`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-300">No synthetic hall matched. Try Maple, River, or Oak.</p>
        )}
      </div>
    </section>
  );
}
