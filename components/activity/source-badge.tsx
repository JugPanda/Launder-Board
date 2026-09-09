import {
  getActivitySourceLabel,
  getEvidenceLabel,
  type EvidenceLevel,
  type LaundrySource,
} from "@/lib/integrations/laundry/types";

export interface SourceBadgeProps {
  source: LaundrySource;
  evidenceLevel?: EvidenceLevel;
  className?: string;
}

const SOURCE_TONES: Readonly<Record<LaundrySource, string>> = {
  manual: "border-slate-300 bg-slate-50 text-slate-700",
  user_file: "border-blue-200 bg-blue-50 text-blue-800",
  synthetic_demo:
    "border-amber-300 bg-[repeating-linear-gradient(135deg,#fffbeb,#fffbeb_6px,#fef3c7_6px,#fef3c7_12px)] text-amber-950",
  cscpay: "border-purple-200 bg-purple-50 text-purple-800",
  csc_go: "border-purple-200 bg-purple-50 text-purple-800",
};

export function SourceBadge({ source, evidenceLevel, className = "" }: SourceBadgeProps) {
  const sourceLabel = getActivitySourceLabel(source);
  const evidenceLabel = evidenceLevel ? getEvidenceLabel(evidenceLevel) : null;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${SOURCE_TONES[source]} ${className}`.trim()}
      title={`Activity source: ${sourceLabel}${evidenceLabel ? `. ${evidenceLabel} evidence.` : ""}`}
    >
      {sourceLabel}
    </span>
  );
}

export default SourceBadge;
