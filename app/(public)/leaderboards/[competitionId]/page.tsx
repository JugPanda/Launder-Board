import Link from "next/link";
import { ArrowUpRight, CalendarDays, Info, Trophy } from "lucide-react";
import { notFound } from "next/navigation";

import { NormalizedLeaderboard } from "@/components/competition/NormalizedLeaderboard";
import { PublicDemoShell } from "@/components/demo/PublicDemoShell";
import { DEMO_COMPETITION } from "@/lib/demo/fixtures";

type PublicLeaderboardPageProps = {
  params: Promise<{ competitionId: string }>;
};

export default async function PublicLeaderboardPage({ params }: PublicLeaderboardPageProps) {
  const { competitionId } = await params;
  if (competitionId !== DEMO_COMPETITION.id) notFound();

  return (
    <PublicDemoShell>
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.17em] text-accent">Public synthetic standings</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] text-slate-950 sm:text-5xl">{DEMO_COMPETITION.shortName}</h1>
            <p className="mt-4 max-w-2xl leading-7 text-slate-600">Hall rank reflects the share of locked eligible participants who earned one weekly credit—not cycles, spending, or total consumption.</p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-line bg-white p-4">
            <CalendarDays aria-hidden="true" className="text-accent" size={22} />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Active week</p>
              <p className="mt-0.5 font-black text-slate-950">{DEMO_COMPETITION.weekLabel}</p>
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-3 sm:grid-cols-3" aria-label="Competition snapshot">
          <div className="rounded-2xl bg-slate-950 p-5 text-white">
            <Trophy aria-hidden="true" className="text-amber-400" size={22} />
            <p className="mt-5 font-mono text-3xl font-black tabular-nums">75%</p>
            <p className="mt-1 text-sm font-bold text-slate-300">Leading normalized score</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Visible halls</p>
            <p className="mt-5 font-mono text-3xl font-black tabular-nums text-slate-950">3</p>
            <p className="mt-1 text-sm font-bold text-slate-600">All pass the five-person floor</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Weekly cap</p>
            <p className="mt-5 font-mono text-3xl font-black tabular-nums text-slate-950">1</p>
            <p className="mt-1 text-sm font-bold text-slate-600">Credit per participant</p>
          </div>
        </section>

        <div className="mt-6">
          <NormalizedLeaderboard competition={DEMO_COMPETITION} />
        </div>

        <aside className="mt-6 flex gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-5 text-sm leading-6 text-cyan-950">
          <Info aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
          <p>Eligible counts are locked before the week begins so people cannot be added or removed to manipulate rank. Ties are shared and extra loads never break them.</p>
        </aside>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-line bg-white p-5 sm:p-7">
          <div>
            <h2 className="text-lg font-black text-slate-950">See the synthetic participant view</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">Its public fields are deliberately coarse and can be withdrawn in one click.</p>
          </div>
          <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-black text-white hover:bg-accent-strong" href="/p/maya-quest">
            Open Maya&apos;s public demo <ArrowUpRight aria-hidden="true" size={17} />
          </Link>
        </div>
      </div>
    </PublicDemoShell>
  );
}
