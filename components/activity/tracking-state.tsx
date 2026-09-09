export type TrackingStateValue =
  | "current"
  | "partial"
  | "unknown"
  | "stale";

const COPY: Record<TrackingStateValue, { label: string; detail: string; tone: string }> = {
  current: {
    label: "Current",
    detail: "A qualifying wash is recorded for your current tracking window.",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  partial: {
    label: "Partial",
    detail: "Some activity is recorded, but tracking coverage is incomplete.",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
  },
  unknown: {
    label: "Unknown",
    detail: "Tracking is incomplete; reminder status unavailable.",
    tone: "border-slate-200 bg-slate-50 text-slate-800",
  },
  stale: {
    label: "Connection stale",
    detail: "Tracking coverage is out of date; reminder status unavailable.",
    tone: "border-rose-200 bg-rose-50 text-rose-900",
  },
};

export interface TrackingStateProps {
  state: TrackingStateValue;
  detail?: string;
  className?: string;
}

export function TrackingState({ state, detail, className = "" }: TrackingStateProps) {
  const copy = COPY[state];
  return (
    <div
      className={`rounded-xl border p-4 ${copy.tone} ${className}`.trim()}
      role="status"
      data-tracking-state={state}
    >
      <p className="font-semibold">{copy.label}</p>
      <p className="mt-1 text-sm">{detail ?? copy.detail}</p>
      <p className="mt-2 text-xs opacity-80">Based on activity shared with pay2win.</p>
    </div>
  );
}

export default TrackingState;
