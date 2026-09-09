"use client";

import { useState } from "react";
import { HeartHandshake, ShieldAlert, VolumeX } from "lucide-react";

import {
  ENCOURAGEMENT_PRESETS,
  type SentEncouragementDto,
} from "@/lib/social/encouragements";
import type { EncouragementPresetKey, ReportCategory } from "@/lib/social/schemas";

const presetEntries = Object.entries(ENCOURAGEMENT_PRESETS) as Array<
  [EncouragementPresetKey, string]
>;

type EncourageButtonProps = {
  recipientId: string;
  recipientName: string;
  initialAvailableAgainAt?: string | null;
  demoMode?: boolean;
};

type SendState = "idle" | "sending" | "sent" | "muted" | "blocked" | "error";

export function EncourageButton({
  recipientId,
  recipientName,
  initialAvailableAgainAt = null,
  demoMode = false,
}: EncourageButtonProps) {
  const [presetKey, setPresetKey] = useState<EncouragementPresetKey>("laundry_quest");
  const [state, setState] = useState<SendState>(initialAvailableAgainAt ? "sent" : "idle");
  const [availableAgainAt, setAvailableAgainAt] = useState<string | null>(
    initialAvailableAgainAt,
  );
  const [notice, setNotice] = useState("");

  async function send() {
    setState("sending");
    setNotice("");

    if (demoMode) {
      setAvailableAgainAt(new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString());
      setState("sent");
      setNotice(`Preset encouragement sent to ${recipientName}. Demo only—nothing was saved.`);
      return;
    }

    try {
      const response = await fetch("/api/encouragements", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipientId, presetKey }),
      });
      const payload = (await response.json()) as {
        encouragement?: SentEncouragementDto;
        error?: { code?: string; availableAt?: string };
      };

      if (!response.ok) {
        if (payload.error?.code === "PAIR_COOLDOWN") {
          setAvailableAgainAt(payload.error.availableAt ?? null);
          setState("sent");
          setNotice("This pair is already in its 72-hour cooldown.");
          return;
        }
        setState("error");
        setNotice(
          payload.error?.code === "SENDER_DAILY_LIMIT"
            ? "Daily limit reached. You can send up to five encouragements in 24 hours."
            : "Encouragement is unavailable. Privacy and safety settings may have changed.",
        );
        return;
      }

      setAvailableAgainAt(payload.encouragement?.availableAgainAt ?? null);
      setState("sent");
      setNotice(`Preset encouragement sent to ${recipientName}.`);
    } catch {
      setState("error");
      setNotice("Could not send the encouragement. Try again later.");
    }
  }

  async function moderate(action: "mute" | "block" | "report", category?: ReportCategory) {
    if (!demoMode) {
      setNotice("Safety controls are available from received encouragements.");
      return;
    }
    if (action === "mute") {
      setState("muted");
      setNotice(`${recipientName} muted in this browser-only demo.`);
    } else if (action === "block") {
      setState("blocked");
      setNotice(`${recipientName} blocked. Blocking overrides friendship and encouragement access.`);
    } else {
      setNotice(`Report submitted as ${category ?? "unwanted"}. No private report details are displayed.`);
    }
  }

  const unavailable = state === "sending" || state === "sent" || state === "muted" || state === "blocked";

  return (
    <div className="min-w-0 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
      <label className="grid min-w-0 gap-2 text-sm font-black text-slate-900">
        Encouragement preset
        <select
          aria-label={`Encouragement for ${recipientName}`}
          className="min-h-11 w-full min-w-0 max-w-full rounded-xl border border-line bg-white px-3 font-normal"
          disabled={unavailable}
          onChange={(event) => setPresetKey(event.target.value as EncouragementPresetKey)}
          value={presetKey}
        >
          {presetEntries.map(([key, message]) => (
            <option key={key} value={key}>
              {message}
            </option>
          ))}
        </select>
      </label>
      <button
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        disabled={unavailable}
        onClick={send}
        type="button"
      >
        <HeartHandshake aria-hidden="true" size={18} />
        {state === "sending"
          ? "Sending…"
          : state === "sent"
            ? "72-hour cooldown active"
            : state === "muted"
              ? "Muted"
              : state === "blocked"
                ? "Blocked"
                : "Send preset encouragement"}
      </button>
      {availableAgainAt ? (
        <p className="mt-2 text-xs font-bold text-slate-600">
          Available again after {new Date(availableAgainAt).toLocaleString()}.
        </p>
      ) : null}
      <p aria-live="polite" className="mt-2 min-h-5 text-xs font-bold text-slate-700" role="status">
        {notice}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-indigo-100 pt-3">
        <button className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-bold text-slate-600 hover:bg-white" onClick={() => moderate("mute")} type="button">
          <VolumeX aria-hidden="true" size={15} /> Mute
        </button>
        <button className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-bold text-red-700 hover:bg-white" onClick={() => moderate("block")} type="button">
          <ShieldAlert aria-hidden="true" size={15} /> Block
        </button>
        <button className="min-h-10 rounded-lg px-2 text-xs font-bold text-slate-600 hover:bg-white" onClick={() => moderate("report", "unwanted")} type="button">
          Report unwanted
        </button>
      </div>
    </div>
  );
}
