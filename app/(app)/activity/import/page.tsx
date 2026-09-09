"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type FormEvent } from "react";

import type { ActivityImportPreview } from "@/lib/activities/import";

export default function ImportActivityPage() {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [syntheticDemo, setSyntheticDemo] = useState(false);
  const [preview, setPreview] = useState<ActivityImportPreview | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreview(null);
    setStatus(null);
    if (!file) {
      setCsv("");
      setFileName("");
      return;
    }
    if (file.size > 256 * 1024) {
      setStatus("CSV exceeds the 256 KB import limit.");
      event.target.value = "";
      return;
    }
    setFileName(file.name);
    setCsv(await file.text());
  }

  async function requestImport(action: "preview" | "confirm") {
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/activities/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, csv, fileName, syntheticDemo }),
      });
      const result = (await response.json()) as {
        error?: string;
        message?: string;
        preview?: ActivityImportPreview;
        result?: { inserted: number; duplicates: number; skippedInvalid: number };
      };
      if (!response.ok) throw new Error(result.message ?? result.error ?? "Import failed");
      if (result.preview) setPreview(result.preview);
      if (action === "confirm" && result.result) {
        setStatus(
          `Imported ${result.result.inserted} activities; ${result.result.duplicates} duplicates skipped.`,
        );
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  async function previewFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await requestImport("preview");
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <Link href="/dashboard" className="text-sm font-medium text-slate-600 hover:text-slate-900">
        ← Back to dashboard
      </Link>
      <h1 className="mt-6 text-3xl font-bold text-slate-950">Import laundry activity</h1>
      <p className="mt-2 max-w-3xl text-slate-600">
        Upload a CSV with occurred_at, machine_kind, and cycle_status columns. Files are normalized privately,
        and provider references are stored only as opaque hashes.
      </p>

      <form onSubmit={previewFile} className="mt-8 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="activity-csv" className="block text-sm font-semibold text-slate-900">CSV file</label>
          <input
            id="activity-csv"
            type="file"
            accept=".csv,text/csv"
            required
            onChange={chooseFile}
            className="mt-2 block w-full text-sm text-slate-700"
          />
          <p className="mt-2 text-xs text-slate-500">Maximum 256 KB and 1,000 data rows.</p>
        </div>
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={syntheticDemo}
            onChange={(event) => {
              setSyntheticDemo(event.target.checked);
              setPreview(null);
            }}
            className="mt-1"
          />
          <span>
            This is synthetic demo data. Demo imports work only when the server-side demo flag is enabled and are
            always labeled “Simulated CSC-format demo.”
          </span>
        </label>
        <button
          type="submit"
          disabled={busy || !csv}
          className="rounded-lg bg-slate-950 px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Checking…" : "Preview import"}
        </button>
      </form>

      {status ? <p role="status" className="mt-5 rounded-lg bg-slate-100 p-3 text-sm text-slate-800">{status}</p> : null}

      {preview ? (
        <section className="mt-8" aria-labelledby="preview-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="preview-heading" className="text-xl font-bold text-slate-950">Import preview</h2>
              <p className="mt-1 text-sm text-slate-600">
                {preview.summary.qualifyingRows} qualifying, {preview.summary.nonqualifyingRows} nonqualifying, {preview.summary.duplicateRows} duplicate, {preview.summary.invalidRows} invalid.
              </p>
            </div>
            <button
              type="button"
              disabled={busy || preview.summary.validRows === 0}
              onClick={() => requestImport("confirm")}
              className="rounded-lg bg-emerald-700 px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Importing…" : "Confirm import"}
            </button>
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Occurred</th><th className="px-3 py-2">Machine</th><th className="px-3 py-2">Details</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {preview.rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td className="px-3 py-2">{row.rowNumber}</td>
                    <td className="px-3 py-2 font-medium capitalize">{row.disposition}</td>
                    <td className="px-3 py-2">{row.activity?.occurredAt ?? "—"}</td>
                    <td className="px-3 py-2 capitalize">{row.activity?.machineKind ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{row.reason ?? (row.issues.join("; ") || "Ready")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
