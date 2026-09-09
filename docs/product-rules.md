# LaundroStat — current guest-demo rules

## Release decision

The current product is a **recency/consistency-based laundry social demo**, per the team's latest correction. It is **not** the earlier one-credit weekly challenge and does not reward number of loads. The Google Doc's earlier weight-based points draft is not the current scoring authority either.

Current source brief: https://docs.google.com/document/d/17KNrH98GEM0szQTWxbTPI2htfALo0jcbCF9AYqk9_Tg/edit

## Guest experience

- `/demo` is accessible without sign-in. The deployed synthetic experience uses Supabase and Typesense and shows an explicit unavailable state rather than fabricated fallback data if either service fails.
- Show Clean-O-Meter, last recorded completed cycle, days since wash, scrub streak, and source credibility.
- Search a consenting synthetic friend group by name, residence hall, and days without a recorded completed wash.
- Match Wash Mates by overlapping usual laundry days and time windows. These are synthetic coarse schedules, not observed location data.
- Show the playful Squeaky Squad / Stinky Squad user board and Dorm Wars hall averages using recency/consistency, never load count or weekly credits.
- Preset community updates and nudges are synthetic simulations saved to an isolated Supabase-backed browser session or presentation account. They are not globally published and no real person receives a message. Selected proof images remain local previews and are not uploaded.
- The exact Clean-O-Meter formula and invented streak/schedule examples must be labeled as demonstration assumptions, not clinically meaningful hygiene measurements.
- Unknown or incomplete tracking is not ranked or treated as due.
- Hall denominators represent the disclosed synthetic participating sample, never official building population. Real Purdue names plus synthetic scores retain persistent disclosure.

## Consent and truthfulness

Every person, score, schedule, friendship, and activity is synthetic. Public display does not imply reminder consent. The fictional viewer's friend/reminder consent is an explicit scenario assumption. Private fixtures remain absent from search and user leaderboards. Use “No recorded wash,” not a claim that someone has not washed. The requested Squeaky Squad / Stinky Squad label is playful game branding, not a factual judgment about a person.

CSC/payment, machine-code, weight, removal-time, photo-proof, and refund/error checks are **simulated**. No live CSC/CSCPay access, measured weight, actual cycle completion, real photo verification, or university verification is claimed. Do not request provider passwords or import real student data. Do not attach money, housing privileges, or discipline to standings.

The public Purdue housing directory is separately sourced metadata. It is not an enrollment list or official university partnership.

## Security boundary and legacy code

The hosted guest API uses a standalone synthetic schema with server-only Supabase access, RLS/privilege restrictions, opaque hashed session capabilities, and Typesense search followed by Supabase consent revalidation. The optional presentation account binds its synthetic events to a verified Auth identity. Existing real-user APIs remain protected; no auth bypass is added to private APIs. The earlier weekly scoring backend is retained as legacy code only; **it is not the current demo product**.

General real-user onboarding, approved CSC integration, and production-ready photo validation are deferred. The presentation account is a restricted showcase identity, not resident onboarding. Do not put real students or real laundry activity into this synthetic demonstration.
