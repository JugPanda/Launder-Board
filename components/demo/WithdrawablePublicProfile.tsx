"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, EyeOff, ShieldCheck } from "lucide-react";

import { DEMO_PROFILE } from "@/lib/demo/fixtures";

export function WithdrawablePublicProfile() {
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return (
      <section className="mx-auto max-w-2xl rounded-3xl border border-emerald-200 bg-emerald-50 p-7 text-center sm:p-10" aria-live="polite">
        <EyeOff aria-hidden="true" className="mx-auto text-emerald-700" size={36} />
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">Public view withdrawn</h1>
        <p className="mx-auto mt-3 max-w-lg leading-7 text-slate-700">The synthetic profile disappeared immediately. This interaction is local only and demonstrates the deny-first public response.</p>
        <button className="mt-6 min-h-12 rounded-xl border border-emerald-700 px-5 font-black text-emerald-800 hover:bg-emerald-100" onClick={() => setVisible(true)} type="button">Reset synthetic preview</button>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-accent ring-1 ring-inset ring-indigo-200"><ShieldCheck aria-hidden="true" size={15} /> Intentionally opted-in fixture</p>
        <Link className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-black text-accent hover:bg-indigo-50" href="/leaderboards/fall-weekly-quest">View hall standings</Link>
      </div>
      <article className="overflow-hidden rounded-[2rem] border border-line bg-white shadow-[0_24px_80px_rgb(15_23_42_/_10%)]">
        <div className="bg-slate-950 p-6 text-white sm:p-9">
          <p className="text-xs font-black uppercase tracking-[0.17em] text-cyan-300">Synthetic public profile</p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">{DEMO_PROFILE.displayName}</h1>
          <p className="mt-2 font-bold text-slate-300">{DEMO_PROFILE.hall}</p>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-9">
          <div className="rounded-2xl border border-line bg-slate-50 p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Weekly points</p>
            <p className="mt-3 font-mono text-4xl font-black tabular-nums text-slate-950">1 / 1</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">One qualifying participation credit. Extra cycles do not add points.</p>
          </div>
          <div className="rounded-2xl border border-line bg-slate-50 p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Badges</p>
            <ul className="mt-3 space-y-2">
              {DEMO_PROFILE.badges.map((badge) => <li className="flex items-center gap-2 font-bold text-slate-800" key={badge}><BadgeCheck aria-hidden="true" className="text-accent" size={19} /> {badge}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl border border-line bg-slate-50 p-5 sm:col-span-2">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Coarse active-week summary</p>
            <p className="mt-2 font-bold text-slate-800">{DEMO_PROFILE.activeWeekSummary}</p>
            <p className="mt-3 text-xs leading-5 text-slate-500">No exact timestamp, machine, location, receipt, price, friend graph, or reminder state is public.</p>
          </div>
        </div>
      </article>
      <section className="mt-6 rounded-2xl border border-pink-200 bg-pink-50 p-5" aria-labelledby="withdraw-demo-heading">
        <h2 id="withdraw-demo-heading" className="font-black text-slate-950">Instant withdrawal demonstration</h2>
        <p className="mt-1 text-sm leading-6 text-slate-700">This owner control hides the local synthetic view immediately. It does not contact a server.</p>
        <button className="mt-4 min-h-12 rounded-xl bg-slate-950 px-5 text-sm font-black text-white hover:bg-slate-800" onClick={() => setVisible(false)} type="button">Demo: withdraw public sharing</button>
      </section>
    </div>
  );
}
