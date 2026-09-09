# LaundroStat

A sign-in-free, synthetic laundry social demo for Purdue University West Lafayette: **Clean-O-Meter, consenting-friend search, Wash Mate matching, Stinky Squad, and Dorm Wars**.

**Live:** https://launderboard.vercel.app · **Demo:** https://launderboard.vercel.app/demo

> Every participant, activity, score, schedule, relationship, and hall standing is synthetic. Real hall names do not make the standings Purdue data. No live CSC/payment, machine-code, weight, removal-time, photo-proof, or refund/error verification exists.

## Current product

- Clean-O-Meter measures a disclosed demonstration model of recorded wash recency and consistency—not hygiene, load volume, or one weekly credit.
- Search consenting synthetic friends with no recorded completed wash in a selected period.
- Match usual laundry days and time windows to find a Wash Mate.
- Explore recency/consistency user scores and normalized synthetic hall averages.
- Try browser-only community/proof concepts. Nothing is sent to another person or laundry provider.
- No login or hosted credentials are needed for the guest experience.

The team's current correction supersedes the old weekly-credit implementation and the earlier weight-based scoring draft. See [current product rules](docs/product-rules.md) and [demo script](docs/demo-script.md).

## Source and scope

- [Team brief](https://docs.google.com/document/d/17KNrH98GEM0szQTWxbTPI2htfALo0jcbCF9AYqk9_Tg/edit)
- [Presentation](https://canva.link/rzrtnq7iygkdhqg)
- [Purdue metadata and sources](docs/purdue-context.md)
- `/purdue/halls` has sourced housing metadata, not enrollment or standings.

Not affiliated with or endorsed by Purdue, University Residences, CSC ServiceWorks, CSCPay, or Typesense. No official logos or live university integration.

## Run the guest demo

```bash
npm ci
LAUNDER_BOARD_DEMO_MODE=enabled npm run dev
```

Open `/demo`. The deployment flag redirects earlier demo/sign-in entry points to the current guest experience. `/demo` itself works without provider configuration. Do not put real participant data in the guest interface.

## Verification

```bash
npm run lint
npm run typecheck
npm test -- --maxWorkers=1
npm run build
npm run test:e2e
```

## Backend status

Next.js 16, React 19, TypeScript, Tailwind, Vitest, and Playwright power the current guest demo. Supabase/PostgreSQL/RLS and Typesense integrations exist in the legacy backend, but the guest simulation does not claim to use live provider data. The legacy weekly scoring schema is not the current user-facing game. No database migration is needed for this guest release.

[Supabase setup](docs/supabase-setup.md) is retained for later real-user work, not a requirement for tonight's demo. Do not seed or reset a hosted production database. Real-user wiring for the current model must be implemented and tested before launch to residents.

## Delivery

Use focused, verified commits directly on `main`; do not create branches or PRs unless explicitly requested. Preserve teammates' commits and never force-push. See [CONTRIBUTING.md](CONTRIBUTING.md).
