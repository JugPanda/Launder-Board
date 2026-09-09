"use client";

import { useState } from "react";
import { Check, Clock3, Search, ShieldCheck, UserPlus, Users } from "lucide-react";

import { EncourageButton } from "@/components/encouragement/encourage-button";
import { DemoShell } from "@/components/demo/DemoShell";

const NOAH_ID = "22222222-2222-4222-8222-222222222222";

export default function FriendsPage() {
  const [query, setQuery] = useState("");
  const [requestState, setRequestState] = useState<"idle" | "sent">("idle");
  const [pendingVisible, setPendingVisible] = useState(true);

  const showDiscoverableResult = query.trim().length > 0 && "avery chen".includes(query.trim().toLowerCase());

  return (
    <DemoShell active="friends">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.16em] text-accent">Social, by consent</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Friends & encouragement</h1>
            <p className="mt-3 max-w-2xl leading-7 text-slate-600">
              Find discoverable participants, manage requests, and encourage only eligible people with preset messages.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-800">
            <ShieldCheck aria-hidden="true" size={18} /> Private graph
          </div>
        </header>

        <section aria-labelledby="find-heading" className="mt-8 rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgb(15_23_42_/_6%)] sm:p-7">
          <div className="flex items-center gap-3">
            <UserPlus aria-hidden="true" className="text-accent" />
            <div>
              <h2 className="text-xl font-black" id="find-heading">Find a participant</h2>
              <p className="mt-1 text-sm text-slate-600">Only active people who opted into directory discovery can appear.</p>
            </div>
          </div>
          <label className="relative mt-5 block">
            <span className="sr-only">Search discoverable participants</span>
            <Search aria-hidden="true" className="absolute left-4 top-3.5 text-slate-400" size={20} />
            <input
              className="min-h-12 w-full rounded-xl border border-line bg-white pl-12 pr-4"
              onChange={(event) => {
                setQuery(event.target.value);
                setRequestState("idle");
              }}
              placeholder="Try “Avery Chen”"
              type="search"
              value={query}
            />
          </label>
          {showDiscoverableResult ? (
            <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-line bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-black">Avery Chen</p>
                <p className="mt-1 text-sm text-slate-600">Discoverable participant · no room or email shown</p>
              </div>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white disabled:bg-emerald-700"
                disabled={requestState === "sent"}
                onClick={() => setRequestState("sent")}
                type="button"
              >
                {requestState === "sent" ? <Check aria-hidden="true" size={17} /> : <UserPlus aria-hidden="true" size={17} />}
                {requestState === "sent" ? "Request sent" : "Send friend request"}
              </button>
            </div>
          ) : query ? (
            <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">No opted-in participant matches that name.</p>
          ) : null}
        </section>

        <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)] lg:items-start">
          <section aria-labelledby="due-heading" className="min-w-0 rounded-3xl border border-line bg-white p-5 shadow-[0_18px_60px_rgb(15_23_42_/_6%)] sm:p-7">
            <div className="flex items-center gap-3">
              <Clock3 aria-hidden="true" className="text-accent" />
              <div>
                <h2 className="text-xl font-black" id="due-heading">May want a reminder</h2>
                <p className="mt-1 text-sm text-slate-600">Rechecked against current consent, friendship, tracking, mute, and block state.</p>
              </div>
            </div>
            <article className="mt-5 min-w-0 rounded-2xl border border-line p-4 sm:p-5">
              <div className="mb-4">
                <p className="font-black">Noah R.</p>
                <p className="mt-1 text-sm font-bold text-slate-700">No recorded wash in the last 14 days.</p>
                <p className="mt-1 text-xs text-slate-500">Based on activity shared with LaundroStat. Accepted friend.</p>
              </div>
              <EncourageButton demoMode recipientId={NOAH_ID} recipientName="Noah R." />
            </article>
            <p className="mt-4 text-xs leading-5 text-slate-500">Unknown, partial, or stale tracking is never treated as due. This is not a claim about anyone’s real-world laundry.</p>
          </section>

          <div className="grid min-w-0 gap-6">
            <section aria-labelledby="requests-heading" className="rounded-3xl border border-line bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Users aria-hidden="true" className="text-accent" size={21} />
                <h2 className="text-lg font-black" id="requests-heading">Requests</h2>
              </div>
              {pendingVisible ? (
                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <p className="font-black">Jordan P.</p>
                  <p className="mt-1 text-sm text-slate-600">Incoming request</p>
                  <div className="mt-3 flex gap-2">
                    <button className="min-h-10 flex-1 rounded-lg bg-accent px-3 text-sm font-black text-white" onClick={() => setPendingVisible(false)} type="button">Accept</button>
                    <button className="min-h-10 flex-1 rounded-lg border border-line bg-white px-3 text-sm font-black" onClick={() => setPendingVisible(false)} type="button">Decline</button>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600" role="status">Request handled.</p>
              )}
            </section>

            <aside className="rounded-3xl border border-slate-800 bg-slate-950 p-5 text-white" aria-labelledby="safety-heading">
              <h2 className="font-black" id="safety-heading">Safety always wins</h2>
              <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-300">
                <li>Preset messages only—no free text.</li>
                <li>One pair send per 72 hours.</li>
                <li>Five sends maximum in rolling 24 hours.</li>
                <li>Mute, block, and fixed-category reporting are private.</li>
              </ul>
            </aside>
          </div>
        </div>
      </div>
    </DemoShell>
  );
}
