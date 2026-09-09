import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  WashingMachine,
} from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "Your Clean-O-Meter",
    text: "See your last recorded full cycle, days since wash, scrub streak, and the source behind every update.",
  },
  {
    icon: Search,
    title: "Friendly nudges",
    text: "Search consent-assumed synthetic friends by recorded activity period and save a preset fresh-start nudge in your private demo session.",
  },
  {
    icon: Users,
    title: "Find your Wash Mate",
    text: "Match usual laundry days and time windows so friends can turn a solo chore into a shared routine.",
  },
  {
    icon: ShieldCheck,
    title: "Squeaky Squad / Stinky Squad",
    text: "See the highest and lowest eligible demo scores while private and unknown records stay out of the rankings.",
  },
  {
    icon: Trophy,
    title: "Bring on Dorm Wars",
    text: "Compare normalized synthetic hall averages using recency and consistency—not spending or extra loads.",
  },
];

const principles = [
  {
    title: "Opt in before showing up",
    text: "Real participation must start with consent. Discovery, reminders, schedule matching, and rankings should never be automatic.",
  },
  {
    title: "Encourage—don’t expose",
    text: "LaundroStat says “no recorded wash,” uses preset nudges, and avoids publishing exact activity or live location.",
  },
  {
    title: "Compete without buying points",
    text: "The Clean-O-Meter rewards a recent, consistent routine. More loads, more money, and claimed weight do not increase it.",
  },
];

const roadmap = [
  {
    label: "LIVE NOW",
    title: "Hosted concept walkthrough",
    text: "A Supabase-backed walkthrough of five synthetic concepts, with friend search powered by Typesense. Nudges, matches, and posts do not reach real people.",
  },
  {
    label: "BEFORE ANY PILOT",
    title: "Interview, then add controls",
    text: "Interview students, implement private-by-default onboarding and independent consent controls, then test them before any supervised residence-hall pilot.",
  },
  {
    label: "FUTURE INTEGRATION",
    title: "Verify through approved data",
    text: "Connect machine events only through an approved data source with written provider and university authorization.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#faf8f2] text-[#191a17]">
      <div className="bg-[#191a17] px-5 py-3 text-center text-xs font-semibold tracking-wide text-[#eee4cc]">
        SYNTHETIC DEMO · No real student records or live CSC connection
      </div>

      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <nav
          aria-label="Primary navigation"
          className="motion-rise flex items-center justify-between gap-3 border-b border-[#ddd8c8] py-5"
        >
          <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tight">
            <WashingMachine size={27} aria-hidden="true" />
            LaundroStat
            <span className="hidden text-xs font-medium text-[#6d6657] sm:inline">/ laundry, together</span>
          </Link>
          <Link
            href="/demo"
            className="motion-lift inline-flex min-h-11 items-center gap-2 rounded-full bg-[#191a17] px-5 text-sm font-bold text-white"
          >
            Open demo <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </nav>

        <section className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          <div className="motion-rise motion-delay-1">
            <p className="mb-5 flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-[#76602c]">
              <span className="size-2 rounded-full bg-[#b39348]" />
              Fun. Fresh. Fierce.
            </p>
            <h1 className="max-w-3xl text-5xl font-black leading-[1.02] tracking-[-.06em] sm:text-7xl">
              Laundry. With a competitive streak.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#59584e]">
              Check your Clean-O-Meter. Find your Wash Mate. Give a friend a friendly nudge—and bring your hall into Dorm Wars.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/demo"
                className="motion-lift inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-[#e6bd56] px-7 font-black text-[#191a17] shadow-sm hover:bg-[#f1ca69]"
              >
                View synthetic demo <ArrowRight aria-hidden="true" size={20} />
              </Link>
              <span className="text-sm font-semibold text-[#666252]">No account needed. Jump right in.</span>
            </div>
            <p className="mt-6 max-w-xl text-sm leading-6 text-[#6b665b]">
              An independent student concept centered on Purdue University West Lafayette. All participant profiles, scores, schedules, and hall standings in this demo are fictional scenarios—not Purdue data.
            </p>
          </div>

          <div className="motion-rise motion-delay-2 motion-lift relative rounded-[2rem] border border-[#ded6c4] bg-white p-6 shadow-[0_24px_70px_-30px_#938369] sm:p-8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#766c56]">Meet your Clean-O-Meter</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight">A fresh perspective.</h2>
              </div>
              <span className="rounded-full bg-[#f4ecd9] px-3 py-1.5 text-xs font-bold">Demo preview</span>
            </div>
            <div className="mx-auto my-8 grid aspect-square w-56 place-items-center rounded-full border-[15px] border-[#e6bd56] bg-[#faf8f2] p-6 shadow-[inset_0_0_0_6px_white] sm:w-64">
              <div className="text-center">
                <WashingMachine className="mx-auto mb-3" size={48} strokeWidth={1.5} aria-hidden="true" />
                <p className="text-2xl font-black">Fresh start</p>
                <p className="mt-2 text-xs font-semibold text-[#6d6657]">RECENCY + CONSISTENCY</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#f5f3eb] p-4">
                <CalendarDays size={19} aria-hidden="true" />
                <p className="mt-3 font-bold">Last full cycle</p>
                <p className="mt-1 text-sm text-[#625e52]">Recorded, not assumed</p>
              </div>
              <div className="rounded-2xl bg-[#f5f3eb] p-4">
                <ShieldCheck size={19} aria-hidden="true" />
                <p className="mt-3 font-bold">Source included</p>
                <p className="mt-1 text-sm text-[#625e52]">Simulation stays labeled</p>
              </div>
            </div>
            <p className="mt-5 text-center text-xs leading-5 text-[#766c56]">
              No points for buying more washes. No guesses about anyone’s hygiene.
            </p>
          </div>
        </section>

        <section aria-labelledby="problem-heading" className="motion-rise border-t border-[#ddd8c8] py-14 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:gap-14">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#76602c]">The problem</p>
              <h2 id="problem-heading" className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Laundry is easy to put off.
              </h2>
            </div>
            <p className="max-w-3xl text-lg leading-8 text-[#59584e]">
              Dorm laundry is repetitive, inconvenient, and usually done alone. LaundroStat turns that routine into a social game: track consistency, coordinate a laundry day, encourage friends, and rally your residence hall.
            </p>
          </div>
        </section>

        <section aria-labelledby="features-heading" className="motion-rise border-t border-[#ddd8c8] py-14">
          <div className="mb-8">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#76602c]">The laundry social club</p>
              <h2 id="features-heading" className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                One routine. Five ways to play.
              </h2>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {features.map(({ icon: Icon, title, text }, index) => (
              <article
                key={title}
                className={`motion-rise motion-delay-${index + 1} motion-lift rounded-2xl border border-[#ddd8c8] bg-white p-6`}
              >
                <Icon aria-hidden="true" className="mb-6" size={25} />
                <h3 className="text-lg font-black">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-[#625e52]">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          id="creators"
          aria-labelledby="creators-heading"
          className="motion-rise grid items-center gap-8 border-t border-[#ddd8c8] py-14 lg:grid-cols-[1.25fr_1fr] lg:gap-12"
        >
          <figure className="motion-lift overflow-hidden rounded-3xl border border-[#ded6c4] bg-white shadow-sm">
            <Image
              src="/images/laundrostat-creators.webp"
              alt="The four LaundroStat creators together in a laundry room"
              width={1280}
              height={960}
              sizes="(min-width: 1280px) 632px, (min-width: 1024px) 55vw, 100vw"
              className="h-auto w-full"
            />
            <figcaption className="px-5 py-4 text-sm leading-6 text-[#625e52]">
              The real team behind LaundroStat. The people in our app’s demo are fictional.
            </figcaption>
          </figure>
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-[#76602c]">Laundry, together</p>
            <h2 id="creators-heading" className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              Meet the creators.
            </h2>
            <p className="mt-5 text-lg leading-8 text-[#59584e]">
              Marcus Withers, Eddie Wuerthele, Rupika Chakka, and Pritham Singh built LaundroStat to turn a shared laundry routine into a little friendly competition.
            </p>
            <p className="mt-4 text-base leading-7 text-[#625e52]">
              Clean-O-Meter, Wash Mates, and Dorm Wars bring the idea to life: stay consistent, encourage each other, and make laundry a little more social.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <a
                aria-label="View the LaundroStat code on GitHub"
                href="https://github.com/JugPanda/Launder-Board"
                className="inline-flex min-h-11 items-center gap-2 font-bold underline underline-offset-4"
              >
                View code on GitHub <ArrowRight size={18} aria-hidden="true" />
              </a>
              <Link href="/sign-in" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#625e52] underline underline-offset-4">
                Presentation account sign in <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#6b665b]">Presentation access requires provided credentials; everyone can use the public demo.</p>
          </div>
        </section>

        <section aria-labelledby="fair-heading" className="motion-rise border-t border-[#ddd8c8] py-14 sm:py-16">
          <div className="grid gap-8 lg:grid-cols-[.72fr_1.28fr] lg:gap-14">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#76602c]">Privacy & consent</p>
              <h2 id="fair-heading" className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Fair by design.
              </h2>
              <p className="mt-4 max-w-md leading-7 text-[#625e52]">
                These are requirements for any real pilot. The hosted walkthrough uses clearly labeled, consent-assumed synthetic fixtures.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {principles.map(({ title, text }) => (
                <article key={title} className="rounded-2xl bg-[#191a17] p-6 text-[#f8f3e7]">
                  <ShieldCheck className="mb-5 text-[#e6bd56]" size={24} aria-hidden="true" />
                  <h3 className="font-black">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#d7cfbc]">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="roadmap-heading" className="motion-rise border-t border-[#ddd8c8] py-14 sm:py-16">
          <div className="mb-8 max-w-3xl">
            <p className="text-xs font-black uppercase tracking-widest text-[#76602c]">How the idea grows</p>
            <h2 id="roadmap-heading" className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              From demo to responsible pilot.
            </h2>
            <p className="mt-4 text-lg leading-8 text-[#59584e]">
              The hosted walkthrough shows the five concepts today. Before any real-student pilot, LaundroStat needs interviews, private-by-default onboarding, independent consent controls, and tested withdrawal.
            </p>
          </div>
          <ol className="grid gap-4 lg:grid-cols-3">
            {roadmap.map(({ label, title, text }, index) => (
              <li key={title} className="rounded-3xl border border-[#ddd8c8] bg-white p-6 sm:p-7">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-black tracking-[.14em] text-[#76602c]">{label}</span>
                  <span className="grid size-9 place-items-center rounded-full bg-[#f4ecd9] text-sm font-black">{index + 1}</span>
                </div>
                <h3 className="mt-8 text-xl font-black">{title}</h3>
                <p className="mt-3 leading-7 text-[#625e52]">{text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link
              href="/demo"
              className="motion-lift inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#e6bd56] px-6 font-black text-[#191a17] hover:bg-[#f1ca69]"
            >
              Explore the hosted demo <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link href="/purdue/halls" className="inline-flex min-h-11 items-center gap-2 font-bold underline underline-offset-4">
              Explore Purdue residence halls <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>

        <footer className="border-t border-[#ddd8c8] py-8 text-xs leading-6 text-[#6b665b]">
          <p>LaundroStat is not affiliated with or endorsed by Purdue University, University Residences, CSC ServiceWorks, CSCPay, or Typesense.</p>
          <p>No live CSC/payment connection, machine-code check-in, measured weight, removal timer, verified photo, refund, or provider-error check is implemented in this demo.</p>
        </footer>
      </div>
    </main>
  );
}
