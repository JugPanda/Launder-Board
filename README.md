# LaundroStat

Purdue University West Lafayette-focused student hackathon project. Not affiliated with or endorsed by Purdue or University Residences.

- [Purdue housing scope and source review](docs/purdue-context.md)
- [Hosted Supabase setup and sign-in troubleshooting](docs/supabase-setup.md)
- `/purdue/halls` contains real housing metadata only; demo standings remain fictional.

A privacy-first, mobile-friendly residence-hall laundry challenge built for a short hackathon. Participants voluntarily record laundry activity, encourage consenting friends, and help their hall through one normalized weekly participation credit.

> **Demo data:** Every included person, competition hall, invite, and activity record is synthetic. The separate Purdue housing catalog contains source-linked public metadata, not standings. The MVP does not claim a live CSC integration or university partnership.

## Product promise

**Win your hall's weekly laundry challenge—without wasting loads.**

- One qualifying washer session earns one weekly credit.
- Additional loads, spending, duration, and load size earn no extra points.
- Hall standings use credited participants divided by the locked eligible roster.
- Profiles, directory discovery, reminders, imports, and public sharing are private/off by default and independently revocable.
- Search results describe only activity shared with LaundroStat: “No recorded wash in the last 14 days,” never a claim about a person's hygiene.

## Locked MVP

- One fictional campus with Maple, River, and Oak halls.
- Eighteen synthetic participants, six per hall.
- Monday-to-Monday competition weeks in `America/Indiana/Indianapolis`.
- Minimum five-person eligible roster for public ranking.
- Seventy-two-hour late-import window.
- At most two credited participants on an accepted shared session.
- Manual, user-file, and visibly simulated activity adapters.
- Disabled CSC adapter until written authorization and official credentials exist.
- Typesense-powered, server-mediated participant and hall search.
- In-app preset encouragement only; no free-text, SMS, email, or push.

See [docs/product-rules.md](docs/product-rules.md) for the normative product and privacy rules.

## Stack

- Next.js 16 App Router, React 19, TypeScript, Tailwind CSS
- Supabase Auth, PostgreSQL, Storage, and RLS
- Typesense 30.2
- Zod, Vitest, Playwright
- Vercel

## Local setup

```bash
npm install
cp .env.example .env.local
npx supabase start
docker run --rm -p 8108:8108 typesense/typesense:30.2 \
  --data-dir /tmp/typesense-data \
  --api-key=launder-board-local-dev-key \
  --enable-cors=false
npm run dev
```

Copy the local Supabase values printed by `supabase start` into `.env.local`. Use the Typesense local key only for local development.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Demo path

1. Open the synthetic demo as Maya Quest.
2. Show the one-credit weekly rule and source labels.
3. Search consenting accepted friends with no recorded wash in 14 days.
4. Send one preset encouragement and show the 72-hour cooldown.
5. Import the synthetic CSV; preview a new washer row, duplicate, and refunded row.
6. Show that a second washer session adds no extra weekly credit.
7. Confirm Maple's normalized result updates.
8. Disable public sharing and verify the public profile disappears immediately.

## Explicitly deferred

Live CSCPay/CSC GO sync, university SSO/directory imports, native mobile apps, external notifications, free-text messaging, photo or load-size estimation, spending/load-count leaderboards, material prizes, and conversational RAG.

## Repository workflow

Development uses verified, focused commits pushed directly to `main`. Never commit credentials, real student records, private account statements, or unlabeled synthetic fallbacks. Read [CONTRIBUTING.md](CONTRIBUTING.md) before contributing.
