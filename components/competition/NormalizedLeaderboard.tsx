import { Info } from "lucide-react";

import type { DEMO_COMPETITION } from "@/lib/demo/fixtures";

type Competition = typeof DEMO_COMPETITION;

const barColors = {
  cyan: "bg-cyan-400",
  indigo: "bg-indigo-500",
  lime: "bg-lime-400",
} as const;

export function NormalizedLeaderboard({ competition }: { competition: Competition }) {
  return (
    <section aria-labelledby="leaderboard-heading" className="overflow-hidden rounded-3xl border border-line bg-white shadow-[0_18px_60px_rgb(15_23_42_/_7%)]">
      <div className="border-b border-line px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">Normalized participation</p>
            <h2 id="leaderboard-heading" className="mt-1 text-2xl font-black tracking-tight text-slate-950">Hall leaderboard</h2>
          </div>
          <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-black text-pink-800 ring-1 ring-inset ring-pink-200">Synthetic standings</span>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Score = credited participants ÷ locked eligible participants. Every person can add at most one credit this week.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[570px] border-collapse text-left" aria-label="Normalized synthetic leaderboard">
          <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-5 py-3 font-black sm:px-7" scope="col">Rank</th>
              <th className="px-4 py-3 font-black" scope="col">Hall</th>
              <th className="px-4 py-3 font-black" scope="col">Credited / eligible</th>
              <th className="px-5 py-3 text-right font-black sm:px-7" scope="col">Score</th>
            </tr>
          </thead>
          <tbody>
            {competition.halls.map((hall) => (
              <tr className="border-t border-line first:border-t-0" key={hall.slug}>
                <td className="px-5 py-5 sm:px-7"><span className="inline-grid size-9 place-items-center rounded-full bg-slate-950 font-mono text-sm font-black text-white">{hall.rank}</span></td>
                <th className="px-4 py-5" scope="row">
                  <span className="block font-black text-slate-950">{hall.name}</span>
                  <span className="mt-2 block h-2.5 w-full max-w-48 overflow-hidden rounded-full bg-slate-100">
                    <span className={`block h-full rounded-full ${barColors[hall.color]}`} style={{ width: `${hall.score}%` }} />
                  </span>
                </th>
                <td className="px-4 py-5 font-mono text-sm font-bold tabular-nums text-slate-700">{hall.creditedParticipants} / {hall.eligibleParticipants}</td>
                <td className="px-5 py-5 text-right font-mono text-xl font-black tabular-nums text-slate-950 sm:px-7">{hall.score}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 border-t border-line bg-slate-50 px-5 py-4 text-xs leading-5 text-slate-600 sm:px-7">
        <Info aria-hidden="true" className="mt-0.5 shrink-0 text-accent" size={16} />
        <p>Only halls with at least five locked eligible participants appear. Rank ties are shared; spending and extra cycles never break a tie.</p>
      </div>
    </section>
  );
}
