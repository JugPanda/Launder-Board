"use client";

import { FormEvent, useState } from "react";
import { Search } from "lucide-react";

import { DemoShell } from "@/components/demo/DemoShell";

interface ParticipantHit {
  id: string;
  display_name: string;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ParticipantHit[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "empty" | "error">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    setStatus("loading");
    try {
      const response = await fetch("/api/search/participants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ preset: "display_name", query: value, limit: 20 }),
      });
      if (!response.ok) throw new Error("Search unavailable");
      const result = (await response.json()) as { hits: ParticipantHit[] };
      setHits(result.hits);
      setStatus(result.hits.length ? "idle" : "empty");
    } catch {
      setHits([]);
      setStatus("error");
    }
  }

  return (
    <DemoShell active="friends">
      <main className="mx-auto max-w-3xl">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-accent">Consent-aware directory</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">Participant search</h1>
        <p className="mt-3 leading-7 text-slate-600">
          Results are limited to active participants currently visible to you. Private profile details are never returned.
        </p>
        <form className="mt-8 flex gap-3" onSubmit={submit}>
          <label className="relative flex-1">
            <span className="sr-only">Participant name</span>
            <Search aria-hidden="true" className="absolute left-4 top-3.5 text-slate-400" size={20} />
            <input
              className="min-h-12 w-full rounded-xl border border-line bg-white pl-12 pr-4"
              maxLength={80}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by display name"
              required
              type="search"
              value={query}
            />
          </label>
          <button className="min-h-12 rounded-xl bg-slate-950 px-5 font-black text-white disabled:opacity-60" disabled={status === "loading"} type="submit">
            {status === "loading" ? "Searching…" : "Search"}
          </button>
        </form>
        <div aria-live="polite" className="mt-6 grid gap-3">
          {status === "empty" && <p className="rounded-2xl bg-slate-50 p-4">No visible participants matched.</p>}
          {status === "error" && <p className="rounded-2xl bg-rose-50 p-4 text-rose-900">Search is temporarily unavailable. Try again later.</p>}
          {hits.map((hit) => (
            <article className="rounded-2xl border border-line bg-white p-4" key={hit.id}>
              <h2 className="font-black">{hit.display_name}</h2>
              <p className="mt-1 text-sm text-slate-600">Discoverable participant</p>
            </article>
          ))}
        </div>
      </main>
    </DemoShell>
  );
}
