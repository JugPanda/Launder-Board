"use client";

import { useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";

import { DEMO_PROFILE, PRIVACY_CHOICES } from "@/lib/demo/fixtures";

type ChoiceId = (typeof PRIVACY_CHOICES)[number]["id"];
type ChoiceState = Record<ChoiceId, boolean>;

const initialChoices: ChoiceState = {
  participation: false,
  activityImport: false,
  directory: false,
  reminders: false,
  publicStats: false,
  publicHall: false,
};

export function PrivacyControls() {
  const [choices, setChoices] = useState<ChoiceState>(initialChoices);
  const [notice, setNotice] = useState("");

  function toggle(id: ChoiceId) {
    setNotice("");
    setChoices((current) => ({ ...current, [id]: !current[id] }));
  }

  function withdrawPublicView() {
    setChoices((current) => ({ ...current, publicStats: false, publicHall: false }));
    setNotice("Public preview withdrawn immediately in this browser-only demo. Nothing was sent or saved.");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)] xl:items-start">
      <section aria-labelledby="privacy-controls-heading" className="overflow-hidden rounded-3xl border border-line bg-white shadow-[0_18px_60px_rgb(15_23_42_/_6%)]">
        <div className="border-b border-line px-5 py-5 sm:px-7">
          <h2 id="privacy-controls-heading" className="text-xl font-black tracking-tight">Separate choices, all off by default</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Each setting can be changed independently. This demo keeps state only until you leave or refresh.</p>
        </div>
        <div className="divide-y divide-line">
          {PRIVACY_CHOICES.map((choice) => {
            const enabled = choices[choice.id];
            return (
              <div className="flex min-h-20 items-center justify-between gap-5 px-5 py-4 sm:px-7" key={choice.id}>
                <div className="min-w-0">
                  <p className="font-black text-slate-950" id={`${choice.id}-label`}>{choice.label}</p>
                  <p className="mt-1 max-w-xl text-sm leading-5 text-slate-600">{choice.description}</p>
                </div>
                <button
                  aria-checked={enabled}
                  aria-labelledby={`${choice.id}-label`}
                  className={`relative h-7 w-12 shrink-0 rounded-full border-2 transition-colors motion-reduce:transition-none ${enabled ? "border-accent bg-accent" : "border-slate-400 bg-slate-200"}`}
                  onClick={() => toggle(choice.id)}
                  role="switch"
                  type="button"
                >
                  <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none ${enabled ? "translate-x-[1.25rem]" : "translate-x-0.5"}`} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <aside className="rounded-3xl border border-line bg-slate-950 p-5 text-white shadow-[0_18px_60px_rgb(15_23_42_/_15%)] sm:p-7" aria-labelledby="public-preview-heading">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-cyan-300">Anonymous visitor view</p>
            <h2 id="public-preview-heading" className="mt-1 text-xl font-black">Public preview</h2>
          </div>
          {choices.publicStats ? <Eye aria-hidden="true" className="text-cyan-300" /> : <EyeOff aria-hidden="true" className="text-slate-400" />}
        </div>

        {choices.publicStats ? (
          <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-900 p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-300">Public preview is on</p>
            <p className="mt-3 text-2xl font-black">{DEMO_PROFILE.displayName}</p>
            <p className="mt-1 text-sm text-slate-300">{choices.publicHall ? DEMO_PROFILE.hall : "Hall hidden"}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/5 p-3"><p className="font-mono text-xl font-black">1 / 1</p><p className="mt-1 text-xs text-slate-400">weekly points</p></div>
              <div className="rounded-xl bg-white/5 p-3"><p className="font-mono text-xl font-black">2</p><p className="mt-1 text-xs text-slate-400">badges</p></div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">{DEMO_PROFILE.activeWeekSummary}</p>
            <p className="mt-4 border-t border-slate-700 pt-4 text-xs leading-5 text-slate-400">Never shown: room, email, receipts, price, exact machine, exact timestamps, friends, or reminder status.</p>
          </div>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-slate-600 bg-slate-900/60 p-6 text-center">
            <ShieldCheck aria-hidden="true" className="mx-auto text-slate-400" size={28} />
            <p className="mt-3 font-black">Private for now</p>
            <p className="mt-1 text-sm leading-6 text-slate-400">Anonymous visitors would see no participant profile.</p>
          </div>
        )}

        {choices.publicStats && (
          <button className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-4 text-sm font-black text-slate-950 hover:bg-slate-100" onClick={withdrawPublicView} type="button">
            Withdraw public view now
          </button>
        )}
        <p className="mt-4 min-h-10 text-sm font-bold leading-5 text-emerald-300" role="status">{notice}</p>
      </aside>
    </div>
  );
}
