# Launder Board MVP product rules

This document is normative for the hackathon MVP.

## Demo boundary

- All bundled halls, profiles, invites, relationships, and activities are synthetic.
- Every demo screen retains a visible **Synthetic demo** label.
- Simulated data is never presented as CSC- or university-confirmed.
- `CscLaundryProvider` remains disabled and returns `provider_not_configured` until an approved integration contract exists.
- The product processes no laundry payments and sells no score advantage.

## Competition

- Timezone: `America/New_York`.
- Week: Monday 00:00 inclusive through the following Monday 00:00 exclusive.
- A participant earns at most one active weekly credit from an accepted qualifying washer session.
- Dryer-only, failed, refunded, retracted, and duplicate activities do not qualify.
- Additional cycles, price, duration, or self-reported size never increase score.
- Hall score: `100 × unique credited participants / locked eligible participants`.
- Rank ties remain shared; no consumption-based tie-breaker.
- A hall needs at least five locked eligible participants to appear publicly.
- Competition enrollment snapshots hall and eligibility before the weekly boundary.
- Paused participants set before lock are excluded from the denominator.
- Imports up to 72 hours after week close may recompute that week's result and are labeled as late updates.
- Shared sessions require invite acceptance, allow at most two credited participants, and consume each participant's own weekly cap.

## Participation and consent

Defaults are private/off. These choices are separate and independently revocable:

1. account and competition participation;
2. activity import;
3. directory discovery;
4. reminders/encouragement audience;
5. public participant statistics;
6. public hall affiliation.

Public visibility is not consent to reminders. Nonparticipants never appear in search, due calculations, or scores.

## Visibility

- **Private:** owner only.
- **Friends-only:** accepted friends may discover selected coarse fields; reminder state requires reminder opt-in and current tracking.
- **Public:** only specifically selected public fields are anonymous-viewable; due/reminder state is never public.

Allowed public participant fields: chosen display name, optional hall, weekly points, badges, and coarse active-week summaries.

Never public: email, room, account/provider identifiers, receipts, prices, exact machine/location, exact activity timestamps, friend graph, reports, evidence records, or reminder/due state.

Withdrawal updates PostgreSQL first. All server responses immediately deny the old view even if a Typesense deletion is delayed.

## Activity provenance

Every activity displays one of:

- **Self-reported** — entered manually.
- **User-supplied record** — normalized from a participant's file; authenticity is not guaranteed.
- **Simulated CSC-format demo** — synthetic and unmistakably demo-only.
- **Provider-confirmed** — reserved for a future approved provider response.

Uploaded files are private, deleted synchronously after successful normalization when practical, and have a cleanup backstop no later than 24 hours. Normalized fields follow the participant's consent.

## Tracking language

Use:

- “No recorded wash in the last 14 days.”
- “Based on activity shared with Launder Board.”
- “Tracking is incomplete; reminder status unavailable.”
- “Simulated CSC-format demo record.”

Never claim a person has not washed, use hygiene insults, publicly shame inactivity, or infer load size from payment, scans, cycle length, capacity, or photos.

Unknown, partial, or stale tracking never makes a participant due and never creates a penalty.

## Friends and encouragement

- Friend requests target only currently discoverable participating profiles.
- Due-reminder search includes only accepted friends, or explicit same-hall encouragement opt-ins.
- Block state wins over search and delivery in both directions.
- Messages use an approved preset; free text is not accepted.
- Per sender/recipient pair: one message per 72 hours.
- Per sender: five messages per rolling day.
- No bulk sends.
- Recipients can mute, block, and report.
- Reports and moderation signals remain private.

Approved examples:

- “Laundry quest this week? You've got this.”
- “Want to team up for a shared load?”
- “Our hall could use one more participation point—no pressure.”

## Search and authorization

PostgreSQL is authoritative. Typesense is a minimized search projection, never the security boundary.

For private participant search:

1. authenticate the caller;
2. derive currently authorized IDs from PostgreSQL;
3. include those IDs in the Typesense filter before searching;
4. rehydrate hits through the same current PostgreSQL policy;
5. preserve Typesense order while dropping stale/unauthorized hits;
6. return allowlisted DTOs and `returned_count` only.

Do not return raw Typesense documents, `out_of`, collection totals, private facets, request parameters, or global query analytics. Index only coarse day-boundary timestamps required for filtering and a monotonic projection version. A withdrawn/deleted entity resolves only to deletion and cannot be resurrected by an older outbox job.

## Low-stakes limitation

A participant can fabricate one weekly self-report. The MVP accepts this bounded limitation because eliminating it requires approved provider telemetry or hardware. Do not attach cash, housing privileges, discipline, or other material consequences to these standings.
