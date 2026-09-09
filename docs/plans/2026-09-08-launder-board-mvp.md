# Launder Board MVP Implementation Plan

> **For Hermes:** Use subagent-driven-development to implement this plan task-by-task only after the team approves the pre-implementation decisions.

> **For implementers:** This is a short-hackathon product, not a production campus surveillance system. Preserve voluntary participation, honest source labels, server-enforced privacy, resource-conscious scoring, and a complete deterministic demo even when CSC access is unavailable.

**Goal:** Deliver a mobile-friendly web MVP in which participating students record laundry activity, find consenting friends who may want a reminder based on recorded data, send controlled encouragement, and compete through normalized residence-hall participation.

**Architecture:** Use Next.js as the authenticated web and server boundary, Supabase for authentication/Postgres/storage, and Typesense as the required participant and hall-result search engine. PostgreSQL remains authoritative; Typesense stores minimal search projections and never decides authorization. CSC support is an adapter seam, not a launch dependency.

**Tech stack:** Next.js 16 App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase Auth/Postgres/Storage with RLS, Typesense Cloud 30.x with `typesense` JS client, Zod, Vitest, Playwright, Vercel.

**Planning date:** 2026-09-08. External capabilities below were checked against current official/vendor-controlled sources on this date.

---

## 1. Concise MVP recommendation

Build **one weekly participation competition** with three complete loops:

1. **Record:** A participant manually logs a washer session or imports the Launder Board CSV template. Every activity displays `Self-reported`, `User-supplied record`, `Simulated CSC demo`, or future `Provider-confirmed` provenance. The demo imports clearly synthetic records through the same adapter contract intended for an approved CSC integration.
2. **Encourage:** A participant searches only accepted friends whose tracking is current, who opted into reminders, and whose recorded-wash anchor is older than the selected cutoff. Results say **“No recorded wash in 14 days”**, never “has not washed.” One tap sends a friendly preset message subject to cooldown, block, and recipient controls.
3. **Compete:** Each eligible participant contributes at most **one participation credit per seven-day competition week**, regardless of number, price, or size of loads. A hall’s score is the percentage of its locked eligible roster earning that credit. Extra loads cannot buy extra points.

Typesense is central to participant lookup, due-reminder search, autocomplete, filters, sorting, and hall-result discovery. It is not used as the primary database or security boundary.

**What the live demo can honestly prove:**

- mobile onboarding, voluntary visibility, and hall enrollment;
- manual and synthetic-file activity ingestion through a normalized adapter;
- duplicate rejection and source/evidence labels;
- Typesense search for accepted friends with no qualifying recorded wash in a chosen period;
- one controlled encouragement and visible cooldown;
- normalized hall leaderboard update after one qualifying session;
- no additional points from a second/tiny session;
- public profile opt-in and immediate withdrawal from public search;
- safe handling when the CSC adapter is unavailable.

**What the demo must not claim:** live CSCPay/CSC GO authorization, official CSC partnership, complete personal history, verified clothes or load size, proof that a student did not wash, or reliable cheating detection.

---

## 2. Assumptions

- Team: three developers with approximately 32 focused person-hours total.
- Event: short hackathon; optimize for one rehearsed two-minute path rather than production breadth.
- Platform: responsive web/PWA-style experience, not native iOS/Android.
- Scope: one campus and three preconfigured fictional residence halls for the judged demo.
- Demo dataset: 18 synthetic participants, six per hall, clearly marked `Synthetic demo data`.
- Participation: account holders join voluntarily; there is no CSC or university student-directory ingestion.
- Hall verification: demo invite codes; a real pilot would require university-approved SSO, housing verification, or controlled invitations.
- CSC: no approved partner credentials or documented integration contract are assumed available during the event.
- Typesense: the team has a Typesense Cloud cluster or sponsor-provided equivalent; local development can use a pinned Docker image.
- Natural-language search: optional enhancement, not required for the core demo. Preset searches and filter chips remain deterministic.
- Notifications: in-app only for MVP. Email, SMS, and push are deferred.
- Payments: Launder Board never processes laundry payments and never sells points.

---

## 3. CSC integration validation

### 3.1 Product distinction

CSCPay Mobile and CSC GO are separate CSC ServiceWorks consumer applications used by different participating laundry-room technologies. CSC’s help page calls CSC GO its “most modern and touchless” experience and directs users to separate support for each app [CSC-1]. Their official store listings also warn that the correct app depends on the participating location [CSC-2][CSC-3].

Do not treat the products, accounts, data formats, or integration paths as interchangeable.

### 3.2 Feasibility table

| Capability or field | Status | Evidence / limitation | Dependency | MVP fallback |
|---|---|---|---|---|
| CSCPay Mobile starts washer/dryer | Confirmed user-facing capability | Official listing says the app pays for cycles, uses Bluetooth, and starts washers/dryers after scanning a machine QR code [CSC-2] | Participating CSCPay room and user account | Manual washer-session entry |
| CSCPay Mobile transaction history | Confirmed in-app viewing | Official listing says a “full accounting” is available to see transaction purchase history [CSC-2] | User’s own app account | User transcribes an entry or imports Launder Board template |
| CSC GO starts washer/dryer | Confirmed user-facing capability | Official listing states QR/NFC machine start and wash/dry payment [CSC-3] | Participating CSC GO room and user account | Manual entry |
| CSC GO payment/transaction history | Confirmed in-app viewing | Official listing says users can view payment and transaction history [CSC-3]; help describes Wallet → Payment History [CSC-4] | User’s own app account | User-supplied record/template |
| Machine availability and completion alerts | Confirmed current user-facing feature | CSC advertises availability, load status, and cycle-complete notifications [CSC-3][CSC-5] | Participating room and functioning app | Demo activity status is imported/manual, not live telemetry |
| Public developer API | **Not confirmed** | No official public CSCPay/CSC GO developer documentation was found. Marketing “integration” material concerns property-management systems, not user-authorized laundry history [CSC-6] | Written CSC contract/documentation | Disabled CSC adapter |
| OAuth/user authorization flow | **Not confirmed** | No official OAuth scope, authorization URL, token lifecycle, or consent contract was found | CSC cooperation | Launder Board account consent applies only to Launder Board/manual files |
| Webhooks or incremental sync cursor | **Not confirmed** | No official webhook/event contract found | CSC cooperation | Idempotent file/manual adapters and an adapter interface |
| User-downloadable CSV/JSON export | **Not confirmed** | In-app history is confirmed, but no product export format was found | CSC product support or privacy request outcome | Launder Board CSV template; do not claim it came from CSC |
| Privacy data-access request | Confirmed as a possible legal/privacy right, not an API | CSC says users may request specific personal information and provides a privacy request channel [CSC-7]. This is not guaranteed real-time or machine-readable integration access | CSC identity verification and applicable law | Not used in the live demo |
| Transaction identifier | **Unknown** | Official user materials reviewed do not specify an exportable transaction ID | CSC schema/approved sample | Internal Launder Board UUID; optional provider external ID only when supplied |
| Transaction timestamp | Partially confirmed | Support asks for transaction date shown on an account statement [CSC-8], but exact time/precision in app history/export is unknown | Approved sample/export | Require user-entered `occurred_at`; label source |
| Machine identifier | Partially confirmed | CSC confirms physical machine IDs and optional machine number for refund requests [CSC-1][CSC-9]; presence in transaction history is unknown | Approved sample/export | Optional user-entered identifier, salted hash at rest if retained |
| Washer/dryer type | Current app action confirmed; history field unknown | Apps start a washer or dryer, but reviewed sources do not define exported history fields [CSC-2][CSC-3] | Approved sample/export | Required normalized `machine_kind` in manual/template input |
| Cycle status/history | Current notification confirmed; historical field unknown | Completion alerts/status exist, but no persisted event/webhook contract is published [CSC-5] | CSC contract | `reported`, `accepted`, `failed`, `refunded`, `retracted` Launder Board states |
| Laundry-room/location association | Current app capability confirmed; transaction field unknown | CSC GO can find/select a laundry room [CSC-3]; transaction-level location export is not documented | Approved sample/export and university mapping | User’s enrolled hall; do not retain exact room/machine location publicly |
| Actual load weight or volume | **Not confirmed** | Official materials describe payment, machine monitoring, status, usage, revenue, and service performance—not measured clothes weight/volume [CSC-10] | Specific machine hardware telemetry and CSC/university authorization | Scoring independent of load size |
| Property/university operational reporting | Confirmed for managers, not students | CSC says managers can access usage, revenue, and service performance and can receive customized reporting [CSC-10] | CSC + university/property contract and privacy review | Synthetic normalized feed |
| Existing property-management integrations | Confirmed but not useful for laundry history | CSC documents Yardi/RealPage integrations for resident onboarding/communications [CSC-6] | Property manager + CSC | Do not use for MVP |

### 3.3 Required cooperation for a real CSC connection

Before enabling `CscLaundryProvider`, obtain all of the following in writing:

1. Which product and tenant applies: CSCPay Mobile or CSC GO.
2. CSC authorization to integrate and applicable university approval.
3. Supported authorization grant; never collect a CSC password.
4. Official base URLs, scopes, rate limits, token expiry/rotation, and sandbox.
5. Data dictionary and a de-identified sample payload.
6. Stable identifiers, timestamp timezone/precision, status/refund semantics, and pagination/cursor behavior.
7. Data retention, deletion, revocation, webhook signature, and incident contacts.
8. Permission to use the CSC name/marks in the demo.

Do not reverse-engineer the mobile app. The CSCPay terms prohibit reverse engineering/decompilation [CSC-11]. Do not use app traffic, private endpoints, shared credentials, or a whole student directory.

### 3.4 Integration adapter contract

Create a provider-neutral boundary:

- `lib/integrations/laundry/types.ts`
- `lib/integrations/laundry/provider.ts`
- `lib/integrations/laundry/manual-provider.ts`
- `lib/integrations/laundry/file-provider.ts`
- `lib/integrations/laundry/csc-provider.ts` (disabled until approved)

Normalized activity fields:

- `source`: `manual | user_file | synthetic_demo | cscpay | csc_go`
- `source_record_id`: optional opaque provider identifier; hash if not needed for display
- `occurred_at`
- `machine_kind`: `washer | dryer | unknown`
- `cycle_status`: `reported | started | completed | failed | refunded | unknown`
- `provider_location_ref`: optional private opaque reference
- `provider_machine_ref`: optional private opaque reference
- `evidence_level`: `self_reported | user_supplied | provider_confirmed`
- `raw_import_id`: private reference to short-lived uploaded source

Adapter methods:

- `validateConnection()`
- `listActivities({ cursor, since })`
- `normalize(raw)`
- `disconnect()`

The disabled CSC adapter must return a deliberate `provider_not_configured` result, not synthetic data disguised as provider output.

---

## 4. Smallest complete MVP

### 4.1 Must-have

#### Accounts and profile

- Supabase email/password or magic-link account creation.
- Chosen display name; never expose legal name by default.
- One residence hall selected through a demo invite code.
- Defaults: profile private, public sharing off, reminders off.
- Independent controls for directory discovery, accepted-friend visibility, hall encouragement, public stats, and activity import consent.
- Configurable reminder interval from a fixed set: 7, 14, or 21 days.

#### Personal dashboard

- Last **recorded qualifying washer session**.
- Tracking state: `Current`, `Partial`, `Unknown`, or `Connection stale`.
- Activity history with source and evidence chips.
- Current competition week and whether the weekly credit has been earned.
- Reminder preference and pause/absence control.

#### Activity logging/import

- Manual washer-session form.
- Pay2win CSV-template upload with preview/confirm.
- Synthetic demo import behind a visible `Load simulated demo data` action available only in demo/admin mode.
- Duplicate detection and correction/retraction.
- Source labels on every entry.
- Original upload deleted within 24 hours after parse; normalized fields retained according to user consent.

#### Friends and encouragement

- Search discoverable participating profiles by display name.
- Send/accept/decline/remove friend requests.
- Search accepted friends who opted into reminders and have current-enough tracking.
- Preset encouragement only; no free-text messaging.
- Per-pair 72-hour cooldown, sender daily cap of five, recipient mute, blocking, and reporting.

#### Competition

- Join one active residence-hall competition.
- Enrollment snapshots hall and eligibility before the week starts.
- Hall leaderboard by normalized participation rate.
- Show numerator and denominator: “4 of 6 eligible participants.”
- One personal credit per competition week; extra cycles do not add points.
- Minimum eligible roster of five for public ranking; configurable to support demo fixtures.

#### Public sharing

- Explicit separate opt-in.
- Public participant fields: chosen display name, optional hall, weekly points, badges, and coarse summaries such as “3 active weeks.”
- Never public: email, room, receipts, prices, exact machine/location, exact activity timestamps, friend graph, reminder/due state, reports, or evidence.
- Public hall results only when minimum participation is met.
- Withdrawal immediately blocks server responses even if index deletion is delayed.

### 4.2 Explicit language rules

Use:

- “No recorded wash in the last 14 days.”
- “Based on activity shared with Launder Board.”
- “Tracking is incomplete; reminder status unavailable.”
- “Simulated CSC-format demo record.”
- “Provider-confirmed transaction” only after an approved integration provides that evidence.

Never use:

- “Has not washed clothes.”
- “Dirty,” “smelly,” “hygiene offender,” or public shaming copy.
- “Verified load size” from payment, QR scan, machine capacity, cycle duration, or a photo.

### 4.3 Deferred

- Live CSCPay Mobile or CSC GO authentication/sync.
- University SSO, student directory, automatic hall verification, or roster import.
- Native mobile app and push/SMS/email notifications.
- Free-text direct messaging.
- AI photo-based load estimation.
- Actual load weight/volume telemetry.
- Receipt OCR and arbitrary CSC screenshot parsing.
- Spending/cost leaderboards, number-of-load leaderboards, or paid boosts.
- Individual public inactivity rankings.
- Admin moderation dashboard; use seeded scripts/direct DB operations for the demo.
- Multiple campuses, inter-campus leagues, seasons, prizes, sponsorships, and rewards marketplace.
- Conversational RAG and Typesense JOINs; they do not improve the core MVP enough to justify risk.

---

## 5. Fair competition design

### 5.1 Recommended scoring: Weekly Participation Rate

A participant earns **one participation credit** when at least one qualifying washer session is accepted during a seven-day competition week. The participant cannot earn additional credit that week.

```text
hall_score = 100 × unique_credited_participants / locked_eligible_participants
```

Display as a percentage with the numerator/denominator. Rank by score. If tied, display a shared rank in MVP; do not add a tie-breaker that rewards extra washing.

Individual profile points equal credited weeks, not transactions. Badges reward consistency, for example `3-week streak`, but do not change hall score.

### 5.2 Why this is the least harmful MVP rule

- Extra loads, higher prices, longer cycles, and multiple machines provide no benefit.
- Halls of different sizes are compared by participation percentage.
- Students paying cash, sharing a load, or self-reporting are not automatically disadvantaged.
- It is easy to explain in a pitch and deterministic to test.

Tradeoffs:

- A five-person hall is more volatile than a fifty-person hall; minimum roster size reduces but does not eliminate this.
- One weekly activity is a participation signal, not proof of healthy or complete laundry habits.
- Self-reporting remains gameable. Evidence levels support moderation but should not create a pay-to-win hierarchy.

### 5.3 Eligibility and enrollment

- User must voluntarily join Launder Board and the competition.
- Hall must be selected through an organizer-controlled invite in MVP.
- Competition enrollment closes at the weekly boundary; hall/eligibility is snapshotted for that week.
- Hall changes apply next week after organizer review.
- Students paused before the weekly lock are excluded from that week’s denominator.
- A hall appears publicly only when it meets the minimum eligible-participant threshold.
- Nonparticipants never appear in individual search, scoring, or inactivity calculations.

### 5.4 Activity edge cases

- **Multiple machines in one session:** Cluster washer/dryer records within 120 minutes for presentation; still at most one weekly credit.
- **Washer plus dryer:** Washer can qualify; dryer adds no separate credit.
- **Dryer-only:** Recorded in history but does not qualify because it is not evidence of a wash in the competition period.
- **Shared loads:** Owner invites one participating co-loader. Co-loader must accept. Maximum two credited people per session, and each consumes their own weekly cap. This rewards resource-efficient sharing without allowing unlimited claims.
- **Failed cycle:** No credit.
- **Refunded cycle:** No credit until reviewed; if refund arrives after scoring, reverse the score event idempotently.
- **Duplicate record:** No second activity or score event. Prefer provider source ID; otherwise use a private fingerprint of user, source, coarse timestamp, machine kind, amount when present, and provider machine reference when present.
- **Late import:** Accept up to 72 hours after week close, recompute the affected hall result, and display `Updated after late import`. Later records enter history but do not alter closed competition results without organizer review.
- **Correction/retraction:** Append a correction record and reverse derived score; do not silently rewrite audit history.
- **Holiday:** Organizer can mark a week `paused`; no hall score or streak break.
- **Absence:** Participant schedules a pause before weekly lock; retroactive absence requires organizer review. Paused weeks do not break streaks.
- **Incomplete/stale data:** Does not make someone “due” and does not create negative points. A positive accepted washer session can still earn the weekly credit.

### 5.5 Evidence and moderation

All evidence levels earn the same capped weekly credit:

- `Self-reported`: user entered the session.
- `User-supplied record`: normalized from an uploaded file/receipt; authenticity not guaranteed.
- `Provider-confirmed`: future approved adapter confirmed a provider event.

Evidence strength affects moderation confidence, not point value. This avoids penalizing students who use cash, another laundromat, a shared machine, or unsupported payment methods.

Suspicious patterns enter review when, for example, there are repeated duplicate-like timestamps, impossible overlaps, repeated retractions, or many shared claims. Review may remove a credit; it must not publish accusations.

---

## 6. Load size and cheating

### 6.1 Evidence boundaries

| Evidence | What it supports | What it does not support |
|---|---|---|
| Payment/transaction | A payment event likely occurred | Machine completion, clothes present, load size |
| QR/NFC scan | A machine identifier was scanned | Payment success, cycle completion, clothes present |
| Machine start event | A cycle was instructed/started | Completion, useful load, weight/volume |
| Completion notification | The machine/controller reported a cycle completion state | Clothes present, owner identity at completion, load size |
| Machine capacity | Maximum designed capacity | Actual contents of a specific cycle |
| Price/cycle length | Selected product/cycle characteristics | Amount of clothing |
| User photo | Approximate visual evidence at one moment | Weight, hidden contents, machine event identity, fraud-proof verification |
| Actual load sensor telemetry | Potential measured machine state | Clothing ownership or appropriateness; availability is unconfirmed |

No reviewed official CSC source confirms user-accessible or partner-accessible actual clothes weight/volume. CSC describes remote machine health, usage, revenue, service, and status data [CSC-10], which must not be reframed as load measurement.

### 6.2 Approach comparison

#### Self-reported size

- Reliability: low.
- Effort: lowest.
- Privacy: best if limited to `small/medium/full` and optional.
- MVP use: optional informational field; never affects points.

#### Optional private photo

- Reliability: low-to-medium for visual plausibility only.
- Effort: moderate storage, retention, consent, moderation, and safety burden.
- Privacy: potentially high risk because rooms, people, labels, or belongings may appear.
- MVP decision: defer. If later piloted, strip metadata, warn users, retain briefly, keep private, and call any estimate `approximate`.

#### Authorized machine telemetry

- Reliability: potentially strong for machine/payment/cycle events, depending on documented semantics.
- Effort: high and blocked on CSC/university contract.
- Privacy: requires data minimization and institutional review.
- Limitation: still may not prove clothes or actual load size.

#### Added hardware/scale

- Reliability: potentially strongest for weight if calibrated.
- Effort: highest; hardware, safety, installation, calibration, maintenance, and university approval.
- MVP decision: later research only.

### 6.3 MVP anti-cheating safeguards

- One scoring opportunity per person per week.
- Washer-session requirement; dryer-only never scores.
- Duplicate/source-ID idempotency.
- Multi-machine session clustering.
- Failed/refunded/retracted record exclusion.
- Shared-load acceptance and two-person maximum.
- Late-import window and locked weekly roster.
- Suspicious-pattern flagging and nonpublic review.
- Source/evidence labels visible to the owner and moderators.
- No load count, spending, price, duration, or self-reported size multiplier.

Remaining limitation: a participant can fabricate one weekly self-report. The MVP deliberately accepts this limitation because eliminating it would require trustworthy provider access or hardware. The cap makes fraud low-value and keeps the demo honest.

Without approved operator telemetry or audited evidence, this model is appropriate only for a low-stakes social challenge. Do not attach cash, housing privileges, disciplinary consequences, or other material prizes to the MVP standings.

---

## 7. Architecture

### 7.1 Components

#### Frontend and server

- Next.js App Router deployed on Vercel.
- Server Components for authenticated data reads where practical.
- Route Handlers for writes, search, uploads, and callbacks.
- Tailwind/shadcn for rapid accessible mobile UI.
- Zod validation shared between forms and route handlers.

#### Authentication and primary database

- Supabase Auth.
- Supabase PostgreSQL as the authoritative source of users, consent, relationships, activity, scoring, and visibility.
- RLS on all user-owned tables; service-role key exists only server-side.
- No CSC credentials in the browser, source repository, logs, or Typesense documents.

#### Search

- Typesense Cloud 30.x.
- Search/admin keys server-side only for MVP.
- All client search goes through authenticated Next.js endpoints.
- Typesense results are rehydrated from PostgreSQL under current authorization before serialization.

#### Optional file storage

- Private Supabase Storage bucket for user-supplied records.
- Signed upload/read URLs, content-type/size limits, random keys, malware-aware handling.
- Original record retention: maximum 24 hours after successful normalization; shorter on cancellation/deletion.
- Do not store card data, CSC passwords, or full account statements.

### 7.2 Planned repository shape

```text
app/
  (public)/page.tsx
  (public)/leaderboards/[competitionId]/page.tsx
  (public)/p/[publicSlug]/page.tsx
  (auth)/sign-in/page.tsx
  (app)/onboarding/page.tsx
  (app)/dashboard/page.tsx
  (app)/activity/new/page.tsx
  (app)/activity/import/page.tsx
  (app)/friends/page.tsx
  (app)/search/page.tsx
  (app)/competitions/[competitionId]/page.tsx
  (app)/settings/privacy/page.tsx
  api/activities/route.ts
  api/activities/import/route.ts
  api/activities/[id]/route.ts
  api/friends/route.ts
  api/friends/[id]/route.ts
  api/encouragements/route.ts
  api/search/participants/route.ts
  api/search/halls/route.ts
  api/competitions/[id]/enroll/route.ts
  api/competitions/[id]/leaderboard/route.ts
  api/public/profiles/[slug]/route.ts
  api/public/leaderboards/[id]/route.ts
  api/settings/privacy/route.ts
  api/account/route.ts
  api/internal/search-index/route.ts
components/
  activity/source-badge.tsx
  activity/tracking-state.tsx
  competition/hall-leaderboard.tsx
  encouragement/encourage-button.tsx
  search/participant-search.tsx
lib/
  auth/require-user.ts
  permissions/participant-visibility.ts
  activities/deduplicate.ts
  activities/sessionize.ts
  competitions/weekly-score.ts
  integrations/laundry/types.ts
  integrations/laundry/provider.ts
  integrations/laundry/manual-provider.ts
  integrations/laundry/file-provider.ts
  integrations/laundry/csc-provider.ts
  typesense/client.server.ts
  typesense/schemas.ts
  typesense/query-builders.ts
  typesense/sync.ts
  typesense/rehydrate.ts
supabase/
  migrations/0001_core.sql
  migrations/0002_social.sql
  migrations/0003_activity.sql
  migrations/0004_competitions.sql
  migrations/0005_search_outbox.sql
  seed/demo.sql
tests/
  unit/scoring.test.ts
  unit/deduplication.test.ts
  unit/tracking-state.test.ts
  integration/permissions.test.ts
  integration/search-privacy.test.ts
  integration/index-sync.test.ts
  integration/consent-withdrawal.test.ts
  e2e/mobile-demo.spec.ts
```

### 7.3 Core data model

#### Identity and participation

- `profiles`: `id`, `auth_user_id`, `display_name`, `public_slug`, `hall_id`, `visibility`, `directory_opt_in`, `public_stats_opt_in`, `public_hall_opt_in`, `encouragement_scope`, `reminder_enabled`, `reminder_days`, `tracking_started_at`, `paused_until`, timestamps, `deleted_at`.
- `residence_halls`: `id`, `campus_id`, `name`, `slug`, `active`.
- `hall_invites`: hashed code, hall, expiry, use limit.
- `consent_events`: user, consent type, granted/withdrawn timestamp, policy version.

#### Social safety

- `friendships`: requester, addressee, status, timestamps; unique unordered pair.
- `blocks`: blocker, blocked, timestamp.
- `reports`: reporter, target user/encouragement, category, status; private.
- `encouragements`: sender, recipient, preset key, created time, delivery/read state.

#### Activity and integration

- `laundry_connections`: user, provider, consent state, connection status, external subject reference encrypted/opaque, last sync, coverage start/end, stale reason.
- `activity_imports`: user, provider, storage key, file hash, status, row counts, expiry, timestamps.
- `laundry_activities`: user, source, source-record hash, occurred time, machine kind, cycle status, evidence level, private location/machine hashes, import ID, correction/retraction fields.
- `laundry_sessions`: user, session window, qualifying washer flag, score eligibility, review state.
- `shared_session_members`: session, invited user, acceptance status; maximum two accepted members enforced server-side.

#### Competition and indexing

- `competitions`: name, start/end, timezone, week boundary, minimum hall roster, status.
- `competition_enrollments`: competition, user, snapshotted hall, eligibility, paused state, locked timestamp.
- `score_events`: immutable award/reversal event, competition week, user, session, reason; unique one active weekly credit per user.
- `hall_week_results`: competition/week/hall, eligible count, credited count, participation rate, rank, minimum met, generated time.
- `search_outbox`: entity type/id, operation, version, attempts, next attempt, completed time.

Use database constraints for pair uniqueness, weekly-credit uniqueness, shared-member limit where possible, and cascading deletion. Store all timestamps in UTC; calculate competition weeks in the competition’s configured timezone.

### 7.4 API surface and policy

#### Public

- `GET /api/public/leaderboards/:competitionId` — only publishable hall aggregates meeting minimum roster.
- `GET /api/public/profiles/:slug` — selected fields only and current public consent.

#### Authenticated participant

- `GET|PATCH /api/me`
- `POST /api/activities`
- `POST /api/activities/import`
- `PATCH|DELETE /api/activities/:id`
- `GET|POST /api/friends`
- `PATCH|DELETE /api/friends/:id`
- `POST /api/encouragements`
- `POST /api/search/participants`
- `POST /api/search/halls`
- `POST /api/competitions/:id/enroll`
- `GET /api/competitions/:id/leaderboard`
- `PUT /api/settings/privacy`
- `DELETE /api/account`

#### Internal

- `POST /api/internal/search-index` — cron-secret protected, processes outbox.
- No remote CSC management endpoint.
- No generic client-supplied Typesense proxy.

Every mutation checks the current authenticated user, current consent, relationship/ownership, block state, competition state, and allowed fields before SQL. Frontend visibility is not authorization.

### 7.5 Background work

- **Search outbox:** Process every minute and synchronously attempt privacy-critical deletes.
- **Import cleanup:** Delete source files older than 24 hours after normalization.
- **Competition reconciliation:** Recompute current/late-import-eligible weeks and compare against immutable score events.
- **Tracking freshness:** Derive status from connection coverage and last sync; do not manufacture overdue state.
- **Account deletion:** Immediately deny access/public output, revoke connections, delete Typesense docs, then cascade personal records.

For the demo, scoring and search upsert happen synchronously after the database commit, with outbox retry as resilience.

---

## 8. Typesense search design

### 8.1 Why Typesense is central

The core social action begins with a Typesense query: finding a consenting person by name or finding permitted friends whose recorded activity meets a date condition. The competition discovery experience also searches/sorts Typesense hall-result documents. PostgreSQL does not provide the user-facing search ranking/autocomplete path.

Typesense officially supports text querying, filters, sorting, faceting, typo tolerance, prefix/autocomplete, and pagination [TS-1]. Dates are stored as Unix timestamps in `int64` fields [TS-2].

### 8.2 What stays in PostgreSQL

- Emails/auth identities.
- Full profile/privacy/consent state.
- Exact friendship and block graph.
- Raw and normalized activity history.
- Receipts/uploads/payment details.
- Exact timestamps/machine/location references.
- Reports/moderation notes.
- Competition enrollment and score-event audit.

### 8.3 What is indexed

#### `participants` alias → `participants_v1`

Minimal server-only search projection:

- `id: string`
- `display_name: string`
- `hall_id: string` (facet)
- `visibility: string` (facet)
- `directory_opt_in: bool`
- `encouragement_scope: string` (facet)
- `tracking_state: string` (facet)
- `activity_anchor_at: int64` — max of tracking start and last qualifying recorded washer; omitted when tracking unknown
- `reminder_due_at: int64` — derived from anchor + chosen reminder period
- `data_fresh_through_at: int64`
- `evidence_level: string` (facet; private result display only)
- `public_points: int32`
- `public_badges: string[]`
- `updated_at: int64`

Do not index email, room number, receipts, price, exact machine/location, source transaction ID, reports, or free-form private content.

#### `hall_results` alias → `hall_results_v1`

- `id`, `competition_id`, `week_start`, `hall_id`, `hall_name`
- `eligible_count`, `credited_count`, `participation_rate`, `rank`
- `minimum_met`, `is_public`, `updated_at`

Use aliases so a new versioned collection can be built and atomically selected after verification [TS-3].

### 8.4 Authorization boundary

**Recommendation: server-mediated search, not browser Typesense keys.** Typesense supports scoped search keys with embedded filters [TS-4], but dynamic friendship, block, opt-in, and withdrawal rules make per-user scopes easy to stale. Typesense also warns not to expose a main search key client-side [TS-4].

Search procedure:

1. Authenticate caller in Next.js.
2. Query PostgreSQL for IDs the caller may currently discover or encourage, including current friendship, consent, hall scope, block state, and tracking eligibility.
3. If the authorized ID set is empty, return an empty result without querying Typesense.
4. Build `filter_by` on the server with the authorized IDs plus the requested status/cutoff; accept only whitelisted query/sort presets from the client.
5. Query Typesense.
6. Rehydrate returned IDs from PostgreSQL with the same current authorization predicate.
7. Preserve Typesense order but drop any stale/unauthorized IDs.
8. Return only a response DTO appropriate to the caller.

This prevents stale Typesense documents from appearing in hits. Because authorization is in the Typesense `filter_by` before execution, unauthorized records do not affect `found`, facets, autocomplete, or pagination. However, Typesense's raw `out_of` response field represents the collection-wide document total rather than the authorized match count. The backend must discard `out_of`, `request_params`, and other unneeded search metadata and return its own allowlisted response shape. Rehydration is a second safety check, not a replacement for filtered search.

Public search repeats the same pattern with current `visibility=public`, `directory_opt_in`, and selected-field consent from PostgreSQL. Never return raw Typesense documents directly.

### 8.5 Essential queries

#### Accepted friends with no recorded wash in 14 days

PostgreSQL first returns accepted, nonblocked friend IDs who opted into friend reminders and have `tracking_state=current`.

Typesense parameters conceptually:

```text
q=*
query_by=display_name
filter_by=id:[AUTHORIZED_IDS] && tracking_state:=current && activity_anchor_at:<CUTOFF && data_fresh_through_at:>=FRESHNESS_FLOOR
sort_by=activity_anchor_at:asc,display_name:asc
```

Label results “No recorded wash since [coarse date]” or “No recorded wash in 14 days.” Do not include users with missing anchors or stale coverage.

#### Participants in my hall due for their chosen reminder

Authorized IDs include only same-hall participants who explicitly set `encouragement_scope=hall`, are not blocked, and have current tracking.

```text
q=*
filter_by=id:[AUTHORIZED_IDS] && tracking_state:=current && reminder_due_at:<=NOW
sort_by=reminder_due_at:asc,display_name:asc
```

This is opt-in hall discovery, not a dorm-wide inactivity list.

#### Residence halls with highest participation this week

```text
q=*
filter_by=competition_id:=ID && week_start:=START && minimum_met:=true
sort_by=participation_rate:desc,hall_name:asc
facet_by=hall_id
```

Public endpoint adds `is_public:=true` and returns only aggregate fields.

#### Find consenting participant by display name

```text
q=maya
query_by=display_name
filter_by=id:[CURRENTLY_DISCOVERABLE_IDS]
prefix=true
sort_by=_text_match:desc,display_name:asc
```

Autocomplete uses this same authorized filter; it never queries a broader collection.

### 8.6 Optional natural-language search

Typesense 30.x documents built-in natural-language query translation. Explicit application filters are combined with generated filters using `AND` [TS-5]. The same documentation states that initial prompt generation runs facet queries over the collection schema/data. It does not establish that this prompt-generation step is partitioned by Launder Board's dynamic friend ACL. Therefore, do **not** enable built-in NLS on the private participant collection for the MVP.

The UI may still accept four demonstrated phrases:

- “friends with no recorded wash in 14 days”
- “friends due for their reminder”
- “people named Maya”
- “top halls this week”

For the first three participant phrases, use a narrow deterministic server intent parser that maps only recognized wording to the safe Typesense query presets above. Optionally use built-in Typesense NLS only for “top halls this week” against the minimized public `hall_results` collection.

Guardrails:

- Route through the server.
- Use only the minimized public hall-result schema; never the private participant collection.
- Always apply server-generated authorized-ID filters.
- Whitelist collections and output fields.
- Display the parsed filters in a “Why these results?” panel.
- Do not pass private activity text or evidence to the LLM provider.
- Keep filter-chip/preset behavior fully usable if NLS fails or is slow.

Do not use conversational RAG in the MVP; there is no knowledge-answering problem that justifies it.

### 8.7 Index synchronization and freshness

- Database transaction writes domain data and a monotonic outbox version.
- Worker upserts complete projection documents; Typesense supports create/update/upsert/import/delete [TS-6].
- Activity creation/correction updates `activity_anchor_at`, `reminder_due_at`, evidence, points, and hall result.
- Visibility/consent withdrawal triggers immediate Typesense delete or safe projection update, plus retry outbox.
- Friendship changes do not require index mutation because authorization IDs come from PostgreSQL.
- Account deletion removes participant document and any public/hall result affected by aggregation.
- Reconciliation job compares DB projection version to Typesense `updated_at`/version.
- UI shows index freshness; target lag under 60 seconds.
- Search endpoint refuses privacy-sensitive results if authorization lookup fails. It never broadens filters as a fallback.
- Set `enable_analytics=false` for private participant searches. Do not create global query-suggestion collections from reminder/name searches; aggregated query histories can reveal what participants searched [TS-8].

Typesense multi-search can fetch separate participant and hall result lanes in one request if a global search screen is added [TS-7]. Do not use JOINs for authorization; PostgreSQL owns relationships.

---

## 9. Consent, public sharing, and encouragement safety

### 9.1 Separate consent events

Require separate, revocable consent for:

1. Launder Board account and competition participation;
2. importing activity from a provider or uploaded record;
3. directory discovery;
4. reminders/encouragement and allowed audience;
5. public participant statistics;
6. optional public hall affiliation;
7. future private photo evidence.

No checkbox may bundle import and public sharing.

### 9.2 Visibility semantics

- **Private:** Visible only to the user. Not in participant search or public profile.
- **Friends-only:** Accepted friends can find the profile; reminder status only if reminders are enabled.
- **Public:** Chosen public fields are visible anonymously; reminder/due status is still never public.

Hall-scoped encouragement is a separate explicit setting because public profile visibility is not consent to receive reminders.

Withdrawal behavior:

- Set DB visibility/consent first.
- Immediately make server authorization deny the old view.
- Delete/update Typesense projection and enqueue retry.
- Remove public route response and cache.
- Stop future imports and revoke provider connection where supported.
- Offer account/activity deletion without requiring continued public participation.

### 9.3 Encouragement controls

Use a short approved message set, for example:

- “Laundry quest this week? You’ve got this.”
- “Want to team up for a shared load?”
- “Our hall could use one more participation point—no pressure.”

Controls:

- accepted friends only by default;
- optional same-hall encouragement opt-in;
- 72-hour sender-recipient cooldown;
- five sends per sender per day;
- no bulk send;
- recipient mute/disable;
- block takes effect before delivery and search;
- report action on every encouragement;
- no public feed of who was encouraged;
- no hygiene claims or cheating accusations.

---

## 10. Main screens and mobile flows

### 10.1 Visual direction

Playful competitive identity: the two-word title case `Launder Board`, arcade-inspired score accents, laundry-machine circular motifs, and concise quest language. Keep body typography conventional and readable. Use WCAG AA contrast, visible focus rings, 44px touch targets, semantic headings, reduced-motion support, and non-color status labels.

Use source badges consistently:

- Gray: Self-reported
- Blue: User-supplied record
- Purple/check: Provider-confirmed
- Amber/striped: Simulated demo

Never use the same styling for real and simulated activity.

### 10.2 Screens

#### Landing

- Promise: “Win your hall’s weekly laundry challenge—without wasting loads.”
- Explain voluntary participation and one-credit-per-week cap.
- Public aggregate leaderboard preview only.

#### Onboarding

1. Create account/display name.
2. Join hall with invite code.
3. Choose private/friends/public visibility.
4. Independently choose reminders/import/public sharing.

Defaults remain private/off.

#### Dashboard

- Weekly quest status: `Credit earned` or `Not recorded yet`.
- Last recorded qualifying wash.
- Tracking freshness and source.
- Recent history.
- Buttons: `Record activity`, `Import`, `Find friends`.

#### Record/import

- Manual: date/time, washer/dryer, optional shared participant, optional size label.
- Import: choose file → preview normalized rows/source labels → confirm.
- Duplicate/failed/refunded rows explain why they did not score.

#### Search and encourage

- Search input plus preset chips: `Friends`, `14 days`, `Due now`, `My hall`.
- Result card explains inclusion: accepted friend, reminders enabled, tracking current, no recorded wash in selected period.
- Encourage button changes to cooldown state after use.
- Unknown/stale users never appear in due results.

#### Competition

- Hall rank, percentage, credited/eligible counts, weekly rule.
- Hall cards searchable/sortable through Typesense.
- Clear states: `Live`, `Updating`, `Minimum not met`, `Paused week`, `Final`.

#### Profile/privacy

- Private self view with exact history.
- Friend view with selected coarse fields.
- Public preview showing exactly what anonymous visitors see.
- One-tap withdrawal and delete controls.

---

## 11. Ordered implementation backlog

Total estimate: approximately **32 person-hours**. With three developers, that is about 10.7 focused hours each, but integration and review overhead make a full hackathon day the realistic minimum.

### B0 — Lock scope and demo fixtures (1 hour)

**Dependencies:** Team decisions in Section 14.

**Files:** `README.md`, `docs/product-rules.md`, `supabase/seed/demo.sql`, `fixtures/demo-activities.csv`.

**Acceptance criteria:**

- Weekly scoring rule, visibility defaults, halls, competition timezone, cutoff, and minimum roster are written.
- All fixture names/halls/records are clearly synthetic.
- Demo contains recent, due, unknown, stale, duplicate, failed, refunded, shared, and late activity cases.

### B1 — Scaffold stack and CI (2 hours)

**Dependencies:** B0; Supabase and Typesense project credentials.

**Files:** `package.json`, `next.config.ts`, `app/layout.tsx`, `lib/env.ts`, `.env.example`, `.github/workflows/ci.yml`.

**Acceptance criteria:**

- App builds with strict TypeScript.
- Environment schema rejects missing server credentials.
- Typesense admin/search and Supabase service keys are server-only.
- CI runs lint, typecheck, unit, and build commands.

### B2 — Database, auth, profile, consent, and RLS (4 hours)

**Dependencies:** B1.

**Files:** `supabase/migrations/0001_core.sql`, `0002_social.sql`, `app/(auth)`, `app/(app)/onboarding`, `lib/auth`, `lib/permissions`.

**Acceptance criteria:**

- User can create an account, select a display name/hall, and finish onboarding.
- Default visibility/import/reminders/public sharing are off/private.
- A user cannot read or mutate another user’s private profile through UI or direct API.
- Hall invite is validated server-side.

### B3 — Activity model and provider adapters (4 hours)

**Dependencies:** B2.

**Files:** `supabase/migrations/0003_activity.sql`, `lib/integrations/laundry/*`, `lib/activities/*`, activity routes/screens, `fixtures/demo-activities.csv`.

**Acceptance criteria:**

- Manual washer session persists with `Self-reported` label.
- Synthetic/template import previews and confirms normalized records.
- CSC provider returns `provider_not_configured`; it never returns demo data.
- Duplicate import is idempotent.
- Failed/refunded/dryer-only entries do not qualify.
- Uploaded source is private and scheduled for deletion within 24 hours.

### B4 — Weekly scoring and hall normalization (3 hours)

**Dependencies:** B3 and competition schema.

**Files:** `supabase/migrations/0004_competitions.sql`, `lib/competitions/weekly-score.ts`, `tests/unit/scoring.test.ts`.

**Acceptance criteria:**

- First qualifying washer session awards one weekly credit.
- Further sessions award zero extra credit.
- Hall score equals unique credited/locked eligible participants.
- Shared, failed, refunded, duplicate, paused, and late cases match Section 5.
- Ties share rank.

### B5 — Typesense schemas, sync, and secure search (5 hours)

**Dependencies:** B2–B4; Typesense cluster.

**Files:** `lib/typesense/*`, `supabase/migrations/0005_search_outbox.sql`, internal indexing route, search routes, search tests.

**Acceptance criteria:**

- Participant/hall aliases and versioned schemas exist.
- Seed/outbox builds search projections without private fields.
- Display-name, accepted-friend cutoff, chosen-reminder, and hall participation queries work through Typesense.
- Unauthorized IDs are in the Typesense filter before search.
- Results are rehydrated from PostgreSQL under current policy.
- Hits, `found`, facets, pagination, and autocomplete contain no unauthorized contribution.
- Visibility withdrawal is denied immediately even with a deliberately stale index document.

### B6 — Friends and controlled encouragement (3 hours)

**Dependencies:** B2 and B5.

**Files:** friend/encouragement routes, `components/encouragement`, `app/(app)/friends`, permission tests.

**Acceptance criteria:**

- Only discoverable participants can receive friend requests.
- Only accepted friends or explicit same-hall opt-ins enter reminder search.
- Preset encouragement sends once, then shows cooldown.
- Blocking removes searchability/delivery immediately in both directions.
- Daily and pair limits are server-enforced.

### B7 — Competition and public sharing UI (3 hours)

**Dependencies:** B4–B6.

**Files:** competition/public routes and pages, leaderboard components, public profile serializer.

**Acceptance criteria:**

- Leaderboard shows normalized percentage and numerator/denominator.
- Minimum-roster halls are handled explicitly.
- Public profile exposes only selected fields.
- Exact timestamps, receipts, email, room, machine/location, friend graph, and due status never serialize publicly.

### B8 — Mobile polish and accessibility (3 hours)

**Dependencies:** Functional screens.

**Files:** shared components/styles and all primary screens.

**Acceptance criteria:**

- Complete flow works at 375px and desktop.
- Keyboard/focus order works; touch targets are at least 44px.
- Contrast meets AA for ordinary text and controls.
- Status is conveyed by text/icon, not color alone.
- Reduced motion is respected.
- Real versus simulated source is unmistakable.

### B9 — Security, failure, and demo verification (4 hours)

**Dependencies:** B1–B8.

**Files:** integration/e2e tests, `docs/demo-script.md`, `docs/verification.md`.

**Acceptance criteria:**

- Permission, stale-index, duplicate, scoring, cooldown, block, and consent-withdrawal suites pass.
- Production build passes.
- Mobile Playwright path completes from a clean seeded state.
- Typesense outage produces a safe unavailable state, not an unfiltered DB result.
- Demo is rehearsed twice under two minutes with NLS disabled, then optionally with NLS enabled.

---

## 12. Focused test plan

### 12.1 Permission leak matrix

Test anonymous, authenticated nonparticipant, private participant, accepted friend, blocked user, same-hall opt-in, public user, and internal index worker.

For each search mode assert:

- permitted hit IDs;
- forbidden IDs absent;
- `found` and facet counts exclude forbidden records;
- autocomplete excludes forbidden names;
- page totals do not reveal hidden records;
- raw `out_of`, `request_params`, and private-query analytics never reach the client;
- direct client-supplied `filter_by`, collection, `include_fields`, or sort overrides are rejected;
- raw Typesense documents are never serialized.

### 12.2 Stale data/index tests

- Leave a public Typesense document after DB consent withdrawal; public search must return nothing immediately.
- Change accepted friend to removed/blocked while the index remains unchanged; due search must return nothing.
- Make connection stale; due search excludes participant but positive history remains visible to owner.
- Fail outbox once; retry upserts exact newest version and does not resurrect withdrawn data.
- Rebuild `participants_v2`, verify counts/projections, then switch alias.

### 12.3 Duplicate/import tests

- Same provider source ID twice.
- Same file uploaded twice.
- Same manual event submitted twice within duplicate window.
- Overlapping washer/dryer machine records cluster into one session.
- Partial file failure shows per-row status and does not award duplicates.
- Import response is checked per row; do not treat a successful batch HTTP response as all rows accepted.

### 12.4 Scoring tests

- First valid washer awards one weekly credit.
- Second/tiny/expensive/long load awards zero extra.
- Dryer-only, failed, refunded, retracted, duplicate do not award.
- Shared session can credit owner plus one accepted participant only.
- Hall percentage uses locked eligible roster, not current profile count.
- Small hall fails public minimum.
- Paused holiday produces no score/streak break.
- Late import within 72 hours recomputes; later import requires review.
- Correction/retraction creates reversal without double subtraction.
- Week boundary honors competition timezone and daylight-saving transition.

### 12.5 Consent/deletion tests

- Import consent and public sharing can be granted/withdrawn independently.
- Withdrawing import consent stops future adapter sync but does not silently publish/delete unrelated data.
- Withdrawing public sharing immediately 404s public profile and removes it from hits/counts/facets/autocomplete.
- Account deletion blocks session, revokes connection, deletes search docs, activities, social edges, and public output.
- Uploaded source file is inaccessible to another user and purged after retention.

### 12.6 Encouragement abuse tests

- Nonfriend denied unless recipient opted into same-hall encouragement.
- Unknown/stale activity cannot be targeted through due search.
- Pair cooldown and daily cap enforced under concurrent requests.
- Block wins over an in-flight encouragement.
- Report contents never appear in search/public responses.

### 12.7 UX and presentation tests

- 375×667 and 390×844 mobile flows.
- Keyboard-only navigation.
- Automated accessibility scan plus manual labels/focus review.
- Empty, loading, stale, minimum-not-met, index-unavailable, and simulated-data states.
- No browser console errors or leaked server environment values.

---

## 13. Two-minute demo script

Use 18 synthetic participants in fictional Maple, River, and Oak halls. Put a visible `Synthetic demo` banner on every screen.

**0:00–0:15 — Promise and fairness**

Open the mobile landing page:

> “Launder Board turns laundry into a hall competition—but paying more never buys points. Each participant can help their hall once per week.”

Show Maple 67%, River 50%, Oak 33%, with counts such as 4/6 rather than raw load totals.

**0:15–0:35 — Honest dashboard**

Sign in as synthetic participant Maya. Show:

- one self-reported event;
- one simulated CSC-format event with an amber label;
- “Last recorded wash: 16 days ago”; and
- tracking status `Current through today`.

Mention that live CSC access is not claimed; the adapter seam is ready for an approved contract.

**0:35–1:00 — Typesense is the interaction**

Search:

> “Friends with no recorded wash in 14 days”

Show two accepted, opted-in friends. Open “Why these results?” to show authorized-friend scope, current tracking, and date cutoff. A third synthetic user with stale tracking is correctly absent. Type a misspelled display name to demonstrate typo-tolerant autocomplete.

**1:00–1:15 — Friendly encouragement**

Send “Laundry quest this week? You’ve got this.” The button changes to `Available again in 72 hours`. Point out recipient controls and no public inactivity list.

**1:15–1:40 — Import, dedupe, and anti-cheating**

Import the synthetic CSV. Preview shows one new washer, one duplicate, and one refunded row. Confirm. Only the new washer qualifies. Attempt a second tiny manual load; dashboard states:

> “Recorded, but this week’s participation credit is already earned.”

This is the key anti-waste/pay-to-win moment.

**1:40–1:52 — Hall result update**

Return to leaderboard. Typesense-sorted hall results update; Maple moves from 4/6 to 5/6. Search “top halls this week.”

**1:52–2:00 — Consent proof**

Open Maya’s public preview showing only display name, badge, and weekly point. Toggle public sharing off in the prepared flow; public profile/search immediately disappears despite a deliberately queued index update.

Close:

> “Search creates the social moment, one capped weekly action keeps it sustainable, and every public field is voluntary.”

---

## 14. Decisions required before implementation

These are the only decisions that should block implementation:

1. **Team/time:** Confirm number of implementers and event hours. Recommendation: three people; protect the 32-person-hour cap.
2. **CSC status:** Identify whether anyone has written CSC/university authorization and whether the site uses CSCPay Mobile or CSC GO. Recommendation: assume no live integration until documentation and sandbox credentials exist.
3. **Demo halls:** Approve three fictional names and 18 synthetic profiles. Do not use real student records.
4. **Hall verification:** Recommendation: one-use or limited-use hall invite codes for MVP; university SSO later.
5. **Visibility defaults:** Recommendation: private profile, public sharing off, reminder/encouragement off.
6. **Competition settings:** Recommendation: seven-day week, one credit, five-person public minimum, 72-hour late-import window, shared-load maximum two.
7. **Natural-language search:** Recommendation: implement filter presets first; enable Typesense NLS only if credentials and core tests are complete.
8. **Photo evidence:** Recommendation: defer entirely from MVP.
9. **Hosting accounts:** Confirm Supabase, Typesense Cloud, and Vercel team access before coding.

---

## 15. Principal risks and mitigations

- **CSC access never arrives:** Core demo uses manual and clearly synthetic file adapters.
- **Product becomes hygiene surveillance:** Voluntary participants only, precise “recorded activity” language, no public due status, and easy withdrawal.
- **Extra washing is incentivized:** One weekly credit, no spend/load multiplier, shared-load support.
- **Typesense leaks private counts:** Server-authorized ID filter before query plus DB rehydration and leak-focused tests.
- **Index lags after privacy change:** DB denial is immediate; synchronous delete plus outbox retry.
- **Small halls dominate by volatility:** Minimum roster and visible numerator/denominator; shared ties.
- **Self-report fraud:** Accept as a bounded limitation; cap value, deduplicate, label evidence, review suspicious cases.
- **Natural-language search fails during pitch:** Deterministic presets use the same Typesense queries and remain the primary demo path.
- **Name implies buying advantage:** Product copy explicitly says “paying more never buys points.” No payment or boost features.

---

## 16. Sources

### CSC / CSCPay / CSC GO

- **[CSC-1]** CSC ServiceWorks, Help/FAQ — separate CSCPay Mobile and CSC GO support, physical machine IDs: https://www.cscsw.com/help-faq/
- **[CSC-2]** Apple App Store official developer listing, CSCPay Mobile — Bluetooth payment/start, QR scan, transaction purchase history, availability, completion alerts: https://apps.apple.com/us/app/cscpay-mobile/id1368674385
- **[CSC-3]** Apple App Store official developer listing, CSC GO — separate participating locations, QR/NFC start, availability, completion alerts, payment/transaction history: https://apps.apple.com/us/app/csc-go/id1552572916
- **[CSC-4]** CSC GO Help, Wallet/Payment History: https://help.mycscgo.com/hc/en-us/articles/1500011284441-Can-I-use-Google-Pay-or-Apple-Pay-to-add-funds-to-my-CSC-GO-wallet
- **[CSC-5]** CSC ServiceWorks, Welcome — machine availability, payment, load status, dryer time, completion notifications, refunds: https://www.cscsw.com/welcome/
- **[CSC-6]** CSC Marketing Pro, Property Management System Integration — Yardi/RealPage onboarding/communications integration: https://marketingpro.cscsw.com/pmsi/
- **[CSC-7]** CSC ServiceWorks Privacy Policy, updated June 16, 2026 — commercial activity, machine-user tracking, access/correction/deletion requests: https://www.cscsw.com/privacy-policy/
- **[CSC-8]** CSCPay Mobile Help — transaction inquiry asks for date, machine-use details, amount, and card information: https://help.getpaymobile.com/hc/en-us/articles/360041085434-I-have-a-question-about-a-recent-credit-card-transaction-whom-should-I-contact
- **[CSC-9]** CSCPay Mobile Help — refund request permits an optional machine number: https://help.getpaymobile.com/hc/en-us/articles/360038615373-How-do-I-request-a-refund
- **[CSC-10]** CSC ServiceWorks, Digital Laundry — machine health monitoring and manager usage/revenue/service reporting; no load-weight claim: https://www.cscsw.com/csc-difference/digital-laundry/
- **[CSC-11]** CSC/KioSoft app terms — prohibits reverse engineering/decompilation: https://digitalinsights.cscsw.com/privacy_terms_web/terms_and_conditions_kiopay

### Typesense 30.2

- **[TS-1]** Search — text query, `filter_by`, `sort_by`, facets, typo tolerance, prefix/autocomplete: https://typesense.org/docs/30.2/api/search.html
- **[TS-2]** Collections — dates stored as Unix timestamps in `int64` fields: https://typesense.org/docs/30.2/api/collections.html
- **[TS-3]** Collection aliases — background reindex and atomic alias switch: https://typesense.org/docs/30.2/api/collection-alias.html
- **[TS-4]** API keys/scoped search keys — embedded filters and warning not to expose main search key: https://typesense.org/docs/30.2/api/api-keys.html
- **[TS-5]** Natural-language search — generated filters combine with explicit filters via `AND`: https://typesense.org/docs/30.2/api/natural-language-search.html
- **[TS-6]** Documents — create, update, upsert, batch import, and delete: https://typesense.org/docs/30.2/api/documents.html
- **[TS-7]** Federated multi-search — separate result sets from multiple collections in one request: https://typesense.org/docs/30.2/api/federated-multi-search.html
- **[TS-8]** Analytics/query suggestions — per-query `enable_analytics=false` and aggregated query collections: https://typesense.org/docs/30.2/api/analytics-query-suggestions.html
