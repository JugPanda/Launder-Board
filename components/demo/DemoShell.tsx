import type { ReactNode } from "react";

import { SyntheticDemoBanner } from "@/components/demo/SyntheticDemoBanner";
import { AppNavigation, type AppDestination } from "@/components/navigation/AppNavigation";

export function DemoShell({ children, active }: { children: ReactNode; active: AppDestination }) {
  return (
    <div className="min-h-screen">
      <SyntheticDemoBanner />
      <div className="mx-auto w-full max-w-[1440px] lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
        <AppNavigation active={active} />
        <main className="min-w-0 px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:px-10 lg:pb-12 xl:px-14">
          {children}
        </main>
      </div>
    </div>
  );
}
