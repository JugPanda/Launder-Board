import Link from "next/link";
import { Activity, CirclePlus, House, ShieldCheck, Trophy, Users } from "lucide-react";

export type AppDestination = "home" | "activity" | "add" | "compete" | "friends" | "privacy";

const destinations = [
  { id: "home", label: "Home", href: "/dashboard", icon: House },
  { id: "activity", label: "Activity", href: "/activity", icon: Activity },
  { id: "add", label: "Add", href: "/activity/new", icon: CirclePlus },
  { id: "compete", label: "Compete", href: "/competitions/fall-weekly-quest", icon: Trophy },
  { id: "friends", label: "Friends", href: "/friends", icon: Users },
] as const;

function NavItem({ item, active, compact = false }: { item: (typeof destinations)[number]; active: AppDestination; compact?: boolean }) {
  const Icon = item.icon;
  const isActive = active === item.id;

  return (
    <Link
      aria-current={isActive ? "page" : undefined}
      className={`group flex min-h-12 items-center rounded-xl font-bold transition-colors motion-reduce:transition-none ${
        compact ? "min-w-0 flex-col justify-center gap-0.5 px-0.5 py-1 text-[10px] min-[360px]:px-1 min-[360px]:text-[11px]" : "gap-3 px-4 text-sm"
      } ${isActive ? "bg-indigo-50 text-accent" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}
      href={item.href}
    >
      <Icon aria-hidden="true" fill={isActive ? "currentColor" : "none"} size={compact ? 20 : 21} strokeWidth={isActive ? 2.5 : 2} />
      <span>{item.label}</span>
    </Link>
  );
}

export function AppNavigation({ active }: { active: AppDestination }) {
  return (
    <>
      <aside className="hidden border-r border-line bg-white/85 px-4 py-7 lg:sticky lg:top-12 lg:flex lg:h-[calc(100vh-3rem)] lg:flex-col" aria-label="App navigation">
        <Link className="mb-9 inline-flex min-h-11 items-center px-3 text-xl font-black tracking-[-0.05em] text-accent" href="/dashboard">
          pay2win
        </Link>
        <nav className="space-y-1" aria-label="Primary">
          {destinations.map((item) => <NavItem key={item.id} active={active} item={item} />)}
        </nav>
        <div className="mt-auto border-t border-line pt-4">
          <Link
            aria-current={active === "privacy" ? "page" : undefined}
            className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-bold ${active === "privacy" ? "bg-indigo-50 text-accent" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"}`}
            href="/settings/privacy"
          >
            <ShieldCheck aria-hidden="true" size={21} /> Privacy
          </Link>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-8px_30px_rgb(15_23_42_/_8%)] backdrop-blur lg:hidden" aria-label="Mobile navigation">
        <div className="mx-auto grid w-full max-w-xl grid-cols-5 items-stretch">
          {destinations.map((item) => <NavItem key={item.id} active={active} compact item={item} />)}
        </div>
      </nav>
    </>
  );
}
