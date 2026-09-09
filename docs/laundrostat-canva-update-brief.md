# LaundroStat Canva update brief

**Canva:** https://canva.link/rzrtnq7iygkdhqg  
**Reviewed export:** `LaundroStat.pdf`, 14 slides, exported September 9, 2026  
**Current demo:** https://laundrostat.vercel.app/demo  
**Repository:** https://github.com/JugPanda/Launder-Board

## Product truth the deck must preserve

- LaundroStat is a student-built, hosted **synthetic demonstration**. Every participant, score, schedule, relationship, and hall standing shown is fictional.
- The current Clean-O-Meter rewards **recorded recency and consistency**, not load count, money spent, or claimed laundry weight.
- The public demo is backed by **Supabase** for its synthetic participant/session data and **Typesense Cloud** for search. Search results are revalidated against current consent, visibility, and tracking rules.
- Anonymous demo nudges and preset feed updates are saved to an isolated browser session. The presentation account can save the same synthetic actions to its account for up to seven days.
- No real person is contacted. No user-written public posts are published.
- No live CSC/CSCPay integration, QR machine binding, vibration sensor, weight measurement, cycle verification, removal timer, or photo verification exists.
- The app is not affiliated with or endorsed by Purdue, University Residences, CSC ServiceWorks, CSCPay, or Typesense.

## Claims to remove everywhere

Remove or replace all references to:

- pounds or load-size scoring;
- `0.6 × lbs` / `0.4 × lbs` calculations;
- Lint Catcher, Fast Folder, Damp Delay, and Wrinkle in Time bonuses or penalties;
- point laundering, logarithmic diminishing returns, three-load caps, or farming prevention;
- QR scans, vibration sensors, verified cycles, and photographed home loads;
- public chat, public comments, or sharing another person’s statistics;
- top 25 “cleanest” and bottom 100 “stinkiest” students;
- claims that someone “hasn’t washed” rather than “has no recorded wash”;
- “shame” as the product’s call to action;
- job-search score verification or expansion into unrelated personal habits.

## Slide-by-slide replacement copy

### Slide 1 — Title

**Keep:** LaundroStat, “Powered by Typesense,” and the MERP team names.

**Replace the tagline with:**

> **Clean clothes. Friendly competition.**

**Team line:**

> MERP — Marcus Withers, Eddie Wuerthele, Rupika Chakka, Pritham Singh

### Slide 2 — Problem

**Replace the current “that one guy” framing.** It claims knowledge of someone’s private behavior and makes shame the hook.

**Title:**

> **Laundry is easy to put off.**

**Body:**

> Dorm laundry is repetitive, inconvenient, and usually done alone. When the routine slips, friends have no respectful way to coordinate a laundry day or offer a little encouragement.

**Closing line:**

> What if laundry felt more social—and a little more fun?

### Slide 3 — The idea

**Title:**

> **Turn laundry into a social routine.**

**Hero copy:**

> Check your Clean-O-Meter. Find a Wash Mate. Give a consenting friend a friendly nudge. Bring your hall into Dorm Wars.

**Small disclosure:**

> Current showcase uses fictional participants and synthetic activity scenarios.

### Slide 4 — Features

**Title:**

> **One routine. Five ways to play.**

**Feature labels:**

- **Clean-O-Meter** — a disclosed recency-and-consistency score.
- **Friendly nudges** — search consenting friends by recorded activity period.
- **Wash Mates** — match overlapping usual laundry days and time windows.
- **Squeaky Squad / Stinky Squad** — playful top and bottom eligible user groups.
- **Dorm Wars** — normalized synthetic hall averages.
- **Hosted demo** — isolated actions saved by browser session or presentation account.

### Slide 5 — Clean-O-Meter

**Replace the entire weight-based scoring slide.**

**Title:**

> **Meet the Clean-O-Meter.**

**Formula:**

> **100 − (4 × days since recorded wash) + (2 × scrub streak)**

**Rules:**

- Scrub streak is capped at 6.
- Final score is bounded from 0 to 100.
- Unknown or incomplete tracking receives no score.
- More loads, more money, and claimed load weight never buy points.

**Disclosure:**

> Illustrative demonstration model—not an official policy, provider measurement, or judgment of hygiene.

### Slide 6 — Fair by design

**Replace “Point Laundering Prevention.”** There are no load-count points to farm.

**Title:**

> **Fair by design.**

**Copy:**

- Recency and consistency—not purchase volume.
- Private, nonconsenting, and unknown profiles stay out of rankings.
- Matching scores share ranks; Squeaky and Stinky groups never overlap.
- Dorm Wars divides total score by the eligible synthetic roster, not residence-hall capacity.
- Every score keeps its source context visible.

### Slide 7 — Encouragement, not exposure

**Replace the old escalating “streaking” penalties.**

**Title:**

> **Encouragement, not exposure.**

**Copy:**

- Search for a consenting friend with no **recorded** wash in a selected period.
- Send one preset “fresh start” nudge—never an unrestricted public message.
- A 72-hour recipient cooldown prevents repeated nudging.
- The demo saves the action to an isolated browser session or presentation account.
- No real person is notified.

### Slide 8 — How the hosted demo works

**Replace the QR/sensor/weight/photo process diagram.**

**Title:**

> **How the hosted demo works**

**Diagram labels:**

> **Browser** → **Next.js app** → **Supabase synthetic data**  
> **Friend search** → **Typesense Cloud** → **Supabase consent recheck**  
> **Nudge or preset update** → **Private session/account event**

**Footer:**

> No live CSC connection, machine sensor, weight reading, cycle verification, or uploaded proof.

### Slide 9 — Wash Mates

**Rename “Washr / Foldmate” to the shipped feature name.**

**Title:**

> **Find your Wash Mate.**

**Copy:**

- Choose your usual laundry day and time window.
- Find consenting synthetic friends with overlapping availability.
- See why each schedule matches.
- Coordinate a routine—not a live location.

**Disclosure:**

> Demo schedules are coarse, fictional preferences—not observed student movement.

### Slide 10 — Live demo

**Title:**

> **Let’s see LaundroStat in action.**

**On-slide URL:**

> **laundrostat.vercel.app/demo**

**Presenter flow:**

> Clean-O-Meter → Friend Search → Wash Mates → Squeaky/Stinky Squads + Dorm Wars → Community

**Small note:**

> Public demo needs no account. The optional presentation account saves synthetic demo actions across sign-ins.

### Slide 11 — Tech stack

**Title:**

> **Built as a real hosted product demo.**

**Stack:**

- Next.js 16, React 19, TypeScript, Tailwind CSS 4
- Vercel deployment
- Supabase / PostgreSQL with server-only access controls and RLS
- Typesense Cloud search with Supabase consent revalidation
- Vitest and Playwright verification

**Footer:**

> Real infrastructure. Synthetic participant data. No live CSC integration.

### Slide 12 — What’s next

**Replace unrelated habit tracking and job-search scoring.**

**Title:**

> **From showcase to responsible pilot.**

**Next steps:**

- Validate the idea with real student interviews.
- Add opt-in participant onboarding and privacy controls.
- Pursue written authorization from housing and laundry providers.
- Integrate verified machine events only through an approved data source.
- Pilot with a small residence-hall group before considering campus expansion.

### Slide 13 — Thank you

**Keep:** the real creator photo.

**Replace “A Little Shame For a Lifetime of Fame!” with:**

> **Fresh habits. Friendly competition.**

**Add:**

> **Try it:** launderstat.vercel.app/demo  
> **Code:** github.com/JugPanda/Launder-Board

### Slide 14 — QR / call to action

Regenerate the QR code so it resolves directly to:

> **https://laundrostat.vercel.app/demo**

Print the URL below the code so the slide still works if scanning fails. Use a black-on-white code with a complete quiet zone, keep it at least 1.5 inches wide on the projected slide, and test it from a physical phone before presenting.

## Two-minute demo narration

1. **Overview:** “The Clean-O-Meter combines recorded recency and consistency. It does not reward extra spending or extra loads.”
2. **Search:** “Typesense finds consenting synthetic friends with no recorded wash in the selected period; Supabase rechecks every result before it is shown.”
3. **Nudge:** “This preset action is saved privately to this demo session or presentation account. No real student receives a message.”
4. **Wash Mates:** “We match overlapping usual days and time windows—not live location.”
5. **Leaderboards:** “Squeaky and Stinky Squads show eligible user rankings, while Dorm Wars compares normalized synthetic hall averages.”
6. **Close:** “LaundroStat makes laundry a social routine: find your Wash Mate, encourage a friend, and bring your hall along.”

## Final deck QA

- Keep one main idea per slide and body type at least 28 pt where possible.
- Use the app’s warm off-white, charcoal, and gold visual identity rather than the older cyan-only deck.
- Keep “Powered by Typesense” visible on the title or architecture slide.
- Keep the synthetic-data disclosure visible on scoring, architecture, demo, and ranking slides.
- Test the deck on a projector, verify the slide-14 QR from a phone, and rehearse the live-demo fallback using screenshots.
