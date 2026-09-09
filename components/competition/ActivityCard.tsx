import { CircleCheck, CircleMinus, Clock3, Shirt, WashingMachine } from "lucide-react";

import type { DemoActivity } from "@/lib/demo/fixtures";

export function ActivityCard({ activity }: { activity: DemoActivity }) {
  const Icon = activity.kind === "Washer" ? WashingMachine : Shirt;

  return (
    <article className="rounded-2xl border border-line bg-white p-5 shadow-[0_12px_40px_rgb(15_23_42_/_5%)]">
      <div className="flex items-start gap-4">
        <div className={`grid size-12 shrink-0 place-items-center rounded-full border-4 ${activity.kind === "Washer" ? "border-cyan-300 bg-cyan-50 text-cyan-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
          <Icon aria-hidden="true" size={21} strokeWidth={2.3} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{activity.kind}</p>
              <h3 className="mt-0.5 text-base font-black text-slate-950">{activity.title}</h3>
            </div>
            <span className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-black ${activity.source === "simulated" ? "bg-pink-50 text-pink-800 ring-1 ring-inset ring-pink-200" : "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200"}`}>
              {activity.sourceLabel}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5"><Clock3 aria-hidden="true" size={15} /> {activity.recordedAt}</span>
            <span>{activity.location}</span>
          </div>
          <p className={`mt-4 flex items-center gap-2 border-t border-line pt-3 text-sm font-bold ${activity.countsThisWeek ? "text-emerald-700" : "text-slate-600"}`}>
            {activity.countsThisWeek ? <CircleCheck aria-hidden="true" size={18} /> : <CircleMinus aria-hidden="true" size={18} />}
            {activity.outcome}
          </p>
        </div>
      </div>
    </article>
  );
}
