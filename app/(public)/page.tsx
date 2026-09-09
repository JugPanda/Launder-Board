import Link from "next/link";
import { ArrowRight, ShieldCheck, Trophy, WashingMachine } from "lucide-react";

const rules = [
  {
    title: "One fair weekly credit",
    description:
      "A qualifying washer session helps once. Extra cycles, spending, and load size add no advantage.",
    icon: Trophy,
  },
  {
    title: "Voluntary by default",
    description:
      "Profiles begin private. Discovery, reminders, imports, and public stats each require separate consent.",
    icon: ShieldCheck,
  },
  {
    title: "Recorded activity, honestly labeled",
    description:
      "Every entry shows whether it is self-reported, user-supplied, simulated, or provider-confirmed.",
    icon: WashingMachine,
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 lg:px-12">
      <nav className="flex min-h-11 items-center justify-between" aria-label="Primary navigation">
        <span className="text-xl font-black tracking-[-0.04em] text-accent">Launder Board</span>
        <a
          className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-5 text-sm font-bold transition-colors hover:border-accent hover:text-accent motion-reduce:transition-none"
          href="#how-it-works"
        >
          How it works
        </a>
      </nav>

      <section className="flex flex-1 flex-col justify-center py-20 sm:py-28">
        <div className="max-w-4xl">
          <p className="mb-5 font-mono text-sm font-bold uppercase tracking-[0.18em] text-accent">
            Purdue-focused student hackathon project
          </p>
          <h1 className="text-balance text-5xl font-black leading-[0.98] tracking-[-0.055em] sm:text-7xl lg:text-8xl">
            {"Win your hall's weekly laundry challenge—without wasting loads."}
          </h1>
          <p className="mt-7 max-w-2xl text-pretty text-lg leading-8 text-muted sm:text-xl">
            Join voluntarily, record a qualifying wash, and earn one participation credit per week.
            Paying more never buys more points.
          </p>
          <p className="mt-4 max-w-2xl leading-7 text-muted">
            Designed for voluntary participation at Purdue University West Lafayette.
            Maple, River, and Oak are fictional demo halls; their standings are not Purdue data.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-7 font-bold text-white shadow-[0_10px_30px_rgb(91_75_255_/_25%)] transition-colors hover:bg-accent-strong motion-reduce:transition-none"
              href="/dashboard"
            >
              View synthetic demo <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <a
              className="inline-flex min-h-12 items-center justify-center rounded-full border border-line bg-surface px-7 font-bold text-slate-800 transition-colors hover:border-accent hover:text-accent motion-reduce:transition-none"
              href="#how-it-works"
            >
              See the weekly rules
            </a>
            <Link className="inline-flex min-h-11 items-center justify-center px-4 font-bold text-accent underline underline-offset-4" href="/purdue/halls">
              Explore Purdue residence halls
            </Link>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        aria-labelledby="rules-heading"
        className="border-t border-line py-16"
      >
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent">How it works</p>
          <h2 id="rules-heading" className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Compete on participation, not consumption.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {rules.map(({ title, description, icon: Icon }) => (
            <article key={title} className="rounded-3xl border border-line bg-surface p-6 shadow-sm">
              <Icon aria-hidden="true" className="mb-8 text-accent" size={28} strokeWidth={2.4} />
              <h3 className="text-lg font-black">{title}</h3>
              <p className="mt-2 leading-7 text-muted">{description}</p>
            </article>
          ))}
        </div>
      </section>
      <footer className="border-t border-line py-8 text-sm leading-6 text-muted">
        Launder Board is not affiliated with or endorsed by Purdue University, University Residences, CSC ServiceWorks, CSCPay, or Typesense.
        No university logos, student directory, or live laundry-provider data are used.
      </footer>
    </main>
  );
}
