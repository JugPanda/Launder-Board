import { Info, ShieldCheck } from "lucide-react";

import { DemoShell } from "@/components/demo/DemoShell";
import { PrivacyControls } from "@/components/demo/PrivacyControls";

export default function PrivacyPage() {
  return (
    <DemoShell active="privacy">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-accent ring-1 ring-inset ring-indigo-200">
            <ShieldCheck aria-hidden="true" size={16} /> Browser-only privacy demo
          </div>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] text-slate-950 sm:text-5xl">Choose what leaves your private account.</h1>
          <p className="mt-4 text-base leading-7 text-slate-600 sm:text-lg">Participation, imports, discovery, reminders, public statistics, and hall affiliation are separate decisions. None are bundled and every control starts off.</p>
        </header>

        <aside className="mt-7 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950" aria-label="Demo privacy notice">
          <Info aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
          <p><strong>This preview does not save.</strong> Toggle the controls to inspect the public result, then refresh to return everything to off. No server, provider, or account receives these choices.</p>
        </aside>

        <div className="mt-6">
          <PrivacyControls />
        </div>

        <section className="mt-6 rounded-3xl border border-line bg-white p-5 sm:p-7" aria-labelledby="never-public-heading">
          <h2 id="never-public-heading" className="text-xl font-black tracking-tight text-slate-950">Never included in the public fixture</h2>
          <ul className="mt-4 grid gap-3 text-sm font-bold text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
            <li className="rounded-xl bg-slate-50 p-4">Room or email</li>
            <li className="rounded-xl bg-slate-50 p-4">Receipts or price</li>
            <li className="rounded-xl bg-slate-50 p-4">Exact machine or timestamp</li>
            <li className="rounded-xl bg-slate-50 p-4">Friends or reminder status</li>
          </ul>
        </section>
      </div>
    </DemoShell>
  );
}
