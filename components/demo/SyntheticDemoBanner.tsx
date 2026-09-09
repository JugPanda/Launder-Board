import Link from "next/link";
import { FlaskConical } from "lucide-react";

export function SyntheticDemoBanner() {
  return (
    <aside className="sticky top-0 z-50 border-b border-pink-900/20 bg-pink-700 text-white" aria-label="Synthetic demo notice">
      <div className="mx-auto flex min-h-12 w-full max-w-[1440px] items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <FlaskConical aria-hidden="true" className="shrink-0" size={19} strokeWidth={2.5} />
        <p className="min-w-0 flex-1 text-xs leading-5 sm:text-sm">
          <strong className="mr-2 font-black">Synthetic demo</strong>
          <span className="text-pink-50">Fictional people, halls, and activity. Nothing here is provider-confirmed.</span>
        </p>
        <Link className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-2 text-xs font-bold underline decoration-pink-200 underline-offset-4 hover:bg-white/10" href="/">
          Exit
        </Link>
      </div>
    </aside>
  );
}
