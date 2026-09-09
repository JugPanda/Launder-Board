import Link from "next/link";
import { ArrowUpRight, CalendarDays, CircleCheck, Info, LockKeyhole, Trophy } from "lucide-react";
import { notFound } from "next/navigation";

import { DemoHallSearch } from "@/components/competition/DemoHallSearch";
import { NormalizedLeaderboard } from "@/components/competition/NormalizedLeaderboard";
import { DemoShell } from "@/components/demo/DemoShell";
import { DEMO_COMPETITION, DEMO_PROFILE } from "@/lib/demo/fixtures";

type CompetitionPageProps = {
  params: Promise<{ competitionId: string }>;
};

export default async function CompetitionPage({ params }: CompetitionPageProps) {
  const { competitionId } = await params;
  if (competitionId !== DEMO_COMPETITION.id) notFound();

  return (
    <DemoShell active="compete">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-[0_24px_80px_rgb(15_23_42_/_18%)] sm:p-9">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.17em] text-cyan-300">Synthetic weekly competition</p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.045em] sm:text-5xl">{DEMO_COMPETITION.name}</h1>
              <p className="mt-4 max-w-2xl leading-7 text-slate-300">A fair participation quest: one person can contribute no more than one qualifying washer credit during the active week.</p>
            </div>
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-amber-400 text-slate-950">
              <Trophy aria-hidden="true" size={29} strokeWidth={2.5} />
            </span>
          </div>
          <dl className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
              <dt className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.13em] text-slate-400"><CalendarDays aria-hidden="true" size={15} /> Active week</dt>
              <dd className="mt-2 font-black">{DEMO_COMPETITION.weekLabel}</dd>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
              <dt className="text-xs font-black uppercase tracking-[0.13em] text-slate-400">Deadline</dt>
              <dd className="mt-2 font-black">{DEMO_COMPETITION.closesLabel}</dd>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
              <dt className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.13em] text-slate-400"><LockKeyhole aria-hidden="true" size={15} /> Denominator</dt>
              <dd className="mt-2 font-black">Locked for the week</dd>
            </div>
          </dl>
        </header>

        <section className="mt-6 grid gap-4 sm:grid-cols-3" aria-label="Competition rules">
          <article className="rounded-2xl border border-line bg-white p-5">
            <p className="font-mono text-xs font-black text-accent">01</p>
            <h2 className="mt-3 font-black text-slate-950">One credit per person</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Only the first qualifying washer session can add weekly credit.</p>
          </article>
          <article className="rounded-2xl border border-line bg-white p-5">
            <p className="font-mono text-xs font-black text-accent">02</p>
            <h2 className="mt-3 font-black text-slate-950">Participation is normalized</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Credited participants are divided by eligible participants locked at the start.</p>
          </article>
          <article className="rounded-2xl border border-line bg-white p-5">
            <p className="font-mono text-xs font-black text-accent">03</p>
            <h2 className="mt-3 font-black text-slate-950">Spending cannot help</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Extra loads, dryer cycles, price, and machine choice do not increase the score.</p>
          </article>
        </section>

        <div className="mt-6">
          <NormalizedLeaderboard competition={DEMO_COMPETITION} />
        </div>

        <section className="mt-6 flex flex-col gap-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7" aria-labelledby="your-credit-heading">
          <div className="flex gap-4">
            <CircleCheck aria-hidden="true" className="mt-0.5 shrink-0 text-emerald-700" size={26} />
            <div>
              <h2 id="your-credit-heading" className="text-lg font-black text-slate-950">{DEMO_PROFILE.displayName} has contributed</h2>
              <p className="mt-1 text-sm leading-6 text-slate-700">1 of 1 weekly credits earned for {DEMO_PROFILE.hall}. Later synthetic records remain visible but add no score.</p>
            </div>
          </div>
          <Link className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-700 px-4 text-sm font-black text-emerald-800 hover:bg-emerald-100" href={`/leaderboards/${DEMO_COMPETITION.id}`}>
            Public standings <ArrowUpRight aria-hidden="true" size={17} />
          </Link>
        </section>

        <div className="mt-6">
          <DemoHallSearch />
        </div>

        <aside className="mt-6 flex gap-3 rounded-2xl border border-line bg-white p-5 text-sm leading-6 text-slate-600">
          <Info aria-hidden="true" className="mt-0.5 shrink-0 text-accent" size={18} />
          <p><strong className="text-slate-950">Demo boundary:</strong> every hall, person, activity record, count, and rank on this page is fictional. The search is local and does not fall back to an unlabeled live or generated result.</p>
        </aside>
      </div>
    </DemoShell>
  );
}
