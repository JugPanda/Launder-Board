"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function NewActivityPage() {
  const [occurredAt, setOccurredAt] = useState("");
  const [machineKind, setMachineKind] = useState<"washer" | "dryer">("washer");
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);
    try {
      const response = await fetch("/api/activities", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          occurredAt: new Date(occurredAt).toISOString(),
          machineKind,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to add activity");
      setStatus("Activity added.");
      setOccurredAt("");
      setMachineKind("washer");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to add activity");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-900">
        ← Back to dashboard
      </Link>
      <h1 className="mt-6 text-3xl font-bold text-slate-950">Add laundry activity</h1>
      <p className="mt-2 text-slate-600">
        Self-reported washes are labeled clearly and can be corrected or retracted later.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="occurred-at" className="block text-sm font-semibold text-slate-900">
            When did it happen?
          </label>
          <input
            id="occurred-at"
            name="occurredAt"
            type="datetime-local"
            required
            value={occurredAt}
            onChange={(event) => setOccurredAt(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950"
          />
        </div>
        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">Machine</legend>
          <div className="mt-2 flex gap-5">
            {(["washer", "dryer"] as const).map((kind) => (
              <label key={kind} className="flex items-center gap-2 text-sm capitalize text-slate-800">
                <input
                  type="radio"
                  name="machineKind"
                  value={kind}
                  checked={machineKind === kind}
                  onChange={() => setMachineKind(kind)}
                />
                {kind}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">Dryer-only entries are saved but do not qualify as a wash.</p>
        </fieldset>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-slate-950 px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Adding…" : "Add activity"}
        </button>
        {status ? <p role="status" className="text-sm text-slate-700">{status}</p> : null}
      </form>
    </main>
  );
}
