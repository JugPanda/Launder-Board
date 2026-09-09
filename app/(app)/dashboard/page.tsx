import Link from "next/link";
import {
  ArrowRight,
  CircleCheck,
  Eye,
  Info,
  ShieldCheck,
  Trophy,
} from "lucide-react";

import { ActivityCard } from "@/components/competition/ActivityCard";
import { DemoShell } from "@/components/demo/DemoShell";
import {
  DEMO_ACTIVITIES,
  DEMO_COMPETITION,
  DEMO_PROFILE,
} from "@/lib/demo/fixtures";

export default function DashboardPage() {
  const { earned, cap } = DEMO_PROFILE.weeklyCredit;

  return (
    <DemoShell active="home">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.17em] text-accent">
              {DEMO_COMPETITION.weekLabel} · synthetic participant
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.045em] text-slate-950 sm:text-5xl">
              {DEMO_PROFILE.firstName}&apos;s quest
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              One qualifying washer session is enough. Extra loads and spending never increase your score.
            </p>
          </div>
          <Link
            className="inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-xl bg-slate-950 px-5 text-sm font-black text-white hover:bg-slate-800 sm:self-auto"
            href={`/competitions/${DEMO_COMPETITION.id}`}
          >
            View competition <ArrowRight aria-hidden="true" size={18} />
          </Link>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-3" aria-label="Weekly quest summary">
          <article className="relative overflow-hidden rounded-3xl bg-accent p-6 text-white shadow-[0_20px_60px_rgb(91_75_255_/_25%)] md:col-span-2 sm:p-7">
            <div className="absolute -right-8 -top-10 size-40 rounded-full bg-cyan-300/20" />
            <div className="relative flex h-full flex-col justify-between gap-8 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-100">Weekly credit</p>
                <p className="mt-3 font-mono text-5xl font-black tabular-nums sm:text-6xl">{earned} of {cap} weekly credits</p>
                <p className="mt-2 font-black">One qualifying washer session counted.</p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-sm font-black ring-1 ring-inset ring-white/25">
                <CircleCheck aria-hidden="true" size={18} /> Cap reached
              </span>
            </div>
          </article>

          <article className="rounded-3xl border border-line bg-white p-6 shadow-[0_18px_60px_rgb(15_23_42_/_6%)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Tracking</p>
                <p className="mt-2 text-2xl font-black text-slate-950">{DEMO_PROFILE.tracking.state}</p>
              </div>
              <span className="grid size-11 place-items-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <CircleCheck aria-hidden="true" size={22} />
              </span>
            </div>
            <p className="mt-5 text-sm font-bold leading-6 text-slate-700">{DEMO_PROFILE.tracking.detail}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{DEMO_PROFILE.tracking.disclosure}</p>
          </article>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
          <article className="rounded-3xl border border-line bg-white p-6 shadow-[0_18px_60px_rgb(15_23_42_/_6%)] sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">Active competition</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">{DEMO_COMPETITION.shortName}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{DEMO_COMPETITION.name}</p>
              </div>
              <Trophy aria-hidden="true" className="text-amber-500" size={30} />
            </div>
            <dl className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs font-black uppercase tracking-[0.13em] text-slate-500">Your hall</dt>
                <dd className="mt-2 font-black text-slate-950">{DEMO_PROFILE.hall} · 1st</dd>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <dt className="text-xs font-black uppercase tracking-[0.13em] text-slate-500">Closes</dt>
                <dd className="mt-2 font-black text-slate-950">{DEMO_COMPETITION.closesLabel}</dd>
              </div>
            </dl>
            <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-950">
              <p className="flex gap-2 font-bold"><Info aria-hidden="true" className="mt-0.5 shrink-0" size={17} /> Hall scores use credited participants divided by locked eligible participants—not total loads.</p>
            </div>
          </article>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <Link className="group rounded-3xl border border-line bg-white p-6 shadow-[0_18px_60px_rgb(15_23_42_/_5%)] hover:border-indigo-300" href="/settings/privacy">
              <ShieldCheck aria-hidden="true" className="text-accent" size={26} />
              <h2 className="mt-6 text-lg font-black text-slate-950">Privacy choices</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Preview six independent controls, all off by default.</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-black text-accent">Review controls <ArrowRight aria-hidden="true" className="transition-transform group-hover:translate-x-1 motion-reduce:transition-none" size={16} /></span>
            </Link>
            <Link className="group rounded-3xl border border-line bg-white p-6 shadow-[0_18px_60px_rgb(15_23_42_/_5%)] hover:border-indigo-300" href={`/p/${DEMO_PROFILE.slug}`}>
              <Eye aria-hidden="true" className="text-accent" size={26} />
              <h2 className="mt-6 text-lg font-black text-slate-950">Public-view demo</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">See the deliberately limited profile and withdraw it instantly.</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-black text-accent">Open public view <ArrowRight aria-hidden="true" className="transition-transform group-hover:translate-x-1 motion-reduce:transition-none" size={16} /></span>
            </Link>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="recent-activity-heading">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">Synthetic activity history</p>
              <h2 id="recent-activity-heading" className="mt-1 text-2xl font-black tracking-tight text-slate-950">Recent activity</h2>
            </div>
            <p className="max-w-lg text-sm leading-6 text-slate-600">Every record keeps its source visible. There is no provider-confirmed activity in this fixture.</p>
          </div>
          <div className="grid gap-4">
            {DEMO_ACTIVITIES.slice(0, 2).map((activity) => <ActivityCard activity={activity} key={activity.id} />)}
          </div>
        </section>
      </div>
    </DemoShell>
  );
}
