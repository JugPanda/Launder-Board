import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { SyntheticDemoBanner } from "@/components/demo/SyntheticDemoBanner";

export function PublicDemoShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <SyntheticDemoBanner />
      <header className="border-b border-line bg-white/85 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link className="text-xl font-black tracking-[-0.05em] text-accent" href="/">pay2win</Link>
          <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-700 hover:bg-slate-100" href="/dashboard">
            <ArrowLeft aria-hidden="true" size={18} /> Back to demo
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 pb-16 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}
