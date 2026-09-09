import Link from "next/link";
import { CirclePlus, History, Upload } from "lucide-react";

import { ActivityCard } from "@/components/competition/ActivityCard";
import { DemoShell } from "@/components/demo/DemoShell";
import { TrackingState } from "@/components/activity/tracking-state";
import { DEMO_ACTIVITIES } from "@/lib/demo/fixtures";

export default function ActivityPage() {
  return (
    <DemoShell active="activity">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.17em] text-accent">
              Synthetic owner view
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.045em] text-slate-950 sm:text-5xl">
              Activity history
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Review every activity shared with LaundroStat and see which records counted toward this week.
            </p>
          </div>
          <div className="flex flex-col gap-2 min-[360px]:flex-row sm:justify-end">
            <Link
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-black text-slate-800 hover:border-indigo-300 hover:text-accent"
              href="/activity/import"
            >
              <Upload aria-hidden="true" size={18} /> Import activity
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800"
              href="/activity/new"
            >
              <CirclePlus aria-hidden="true" size={18} /> Add activity
            </Link>
          </div>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(280px,.65fr)]" aria-label="Activity tracking summary">
          <article className="rounded-3xl border border-line bg-white p-6 shadow-[0_18px_60px_rgb(15_23_42_/_6%)] sm:p-7">
            <div className="flex items-start gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-indigo-50 text-accent">
                <History aria-hidden="true" size={22} />
              </span>
              <div>
                <h2 className="text-lg font-black text-slate-950">3 shared records</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Sources stay attached to each record. These fixtures are simulated or self-reported; none is verified by a laundry provider.
                </p>
              </div>
            </div>
          </article>
          <TrackingState
            className="rounded-3xl p-6 sm:p-7"
            detail="A qualifying washer session is recorded for the current weekly window."
            state="current"
          />
        </section>

        <section className="mt-10" aria-labelledby="all-activity-heading">
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">Synthetic activity history</p>
            <h2 id="all-activity-heading" className="mt-1 text-2xl font-black tracking-tight text-slate-950">
              All activity
            </h2>
          </div>
          <div className="grid gap-4">
            {DEMO_ACTIVITIES.map((activity) => <ActivityCard activity={activity} key={activity.id} />)}
          </div>
        </section>
      </div>
    </DemoShell>
  );
}