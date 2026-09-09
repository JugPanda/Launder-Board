# Hosted guest integration

## Deliverable
Keep the current no-sign-in synthetic Clean-O-Meter product and supplied logos. Replace bundled participant data and local friend search with Supabase-backed records and real Typesense Cloud search. Persist each anonymous browser's demo nudges and preset feed updates separately, without impersonating a real resident or publicly publishing user submissions. Proof images remain explicitly local-only (no new storage/upload claims).

## Authority and scope
- Supabase is authoritative for participant visibility, consent, recency, schedules, and anonymous-session events.
- Typesense indexes only eligible synthetic participant projections and public Purdue catalog metadata. Rehydrate every search hit through current Supabase rules.
- No weekly-credit/load-volume backend migration is used for this current guest product.
- No signup flow, real student data, provider CSC integration, unrestricted feed text, or global anonymous score mutations.
- Direct main delivery only after schema/provider gates; preserve unrelated work.

## Shared implementation contract
Standalone atomic/replay-safe setup: `supabase/guest-migrations/0001_hosted_guest.sql` (independent of legacy migrations).
Tables: `demo_participants`, `demo_sessions`, `demo_nudges`, `demo_posts`; sourced `purdue_housing_catalog` may be installed separately using existing metadata migration.
Participant columns: id, display_name, hall, days_since_wash, tracking_state, visibility, reminder_consent (boolean), scrub_streak, last_full_cycle_date, source_label, usual_days, usual_time_window, as_of, synthetic, updated_at. Seed existing nine synthetic fixtures only. RLS denies direct anon/authenticated access; server uses service key.
Session columns: id uuid, token_hash (SHA256 hex), created_at, expires_at (7 days). Opaque 32-byte random cookie; hash only stored. Never returned in JSON. HttpOnly/Secure in production/SameSite=Lax.
Nudges: id uuid, session_id, recipient_id, preset, created_at. 72h per recipient cooldown, five per session/day, consent/current >=14 day eligibility; atomic RPC with session row lock.
Posts: id uuid, session_id, preset, created_at. Only `fresh_start` preset, one per session. Synthetic baseline feed is labeled separately; session updates never global.
RPCs: demo_open_session(p_token_hash text)->uuid; demo_save_nudge(p_token_hash text,p_recipient_id text,p_preset text)->jsonb {ok,code}; demo_save_post(p_token_hash text,p_preset text)->jsonb {ok,code}; demo_reset_session(p_token_hash text)->void. Service role only. Read-only demo_schema_status()->jsonb {version:1,participants:9} callable by anon for installation verification.

## HTTP contract
All `/api/demo/*` handlers have explicit JSON/no-store responses and contain their own safeguards. Private legacy APIs stay protected.
- POST `/api/demo/session`: same-origin, create/reuse cookie; return bootstrap.
- GET `/api/demo/bootstrap`: `{participants: GuestParticipant[], nudgedIds:string[], posts:{id,preset,createdAt}[], providers:{database:'supabase',search:'typesense'}, asOf:'2026-09-08'}`. Session events only when valid cookie; participants only eligible current/consenting/nonprivate synthetic fixtures. Do not return fabricated fallback if provider missing.
- GET `/api/demo/search?q=&hall=&minDays=`: `{participants: GuestParticipant[], source:'typesense', returnedCount:number}` with current DB revalidation and Typesense ordering. Strict query validation; no raw provider totals.
- POST `/api/demo/nudges`: `{recipientId,preset:'fresh_start'}` -> saved result. POST `/api/demo/posts`: `{preset:'fresh_start'}` -> saved result. Require valid session cookie, strict schema, origin, body-size bounds; DB RPC decides limits.
- POST `/api/demo/reset`: removes only current session's events/session, expires cookie. UI starts a new session afterward.
- POST `/api/demo/index`: admin-only Bearer `DEMO_INDEX_SECRET`; rebuild/upsert eligible participants from Supabase and Purdue catalog from sourced metadata. Read back exact documents/count before claiming success.

Typesense collection: `laundrostat_demo_participants_v1` fields id,name,hall,daysSinceWash,tracking,visibility,reminderConsent,synthetic; only coarse synthetic fields. Canonical hall collection remains `purdue_housing_catalog_v1`.

## Work split
1. SQL setup + local PostgreSQL RLS/RPC/replay tests.
2. Server-only repository, API handlers, Typesense indexing/search, security tests.
3. Guest UI remote loading/search/persistence, no bundled fallback; mocked provider tests.
4. Parent: credentials in Vercel, proxy allowlist, shared helper optional dataset arguments, documentation, schema operator handoff, integration/independent reviews, build/live verification and main push.

## Gates
- Verify Typesense supplied admin/search keys without exposing values; save server-only Production variables.
- Rehearse standalone SQL locally; user/operator must run it on the exact hosted project if SQL access unavailable. Do not pretend service-role API keys grant DDL.
- Read back schema status before application promotion.
- Run unit/security tests, lint/type/build, actual provider searches, cookie-isolation/persistence browser tests and mobile/desktop visual checks.
- Final handoff separates live provider-backed synthetic functionality from deferred real-user/CSC/photo features.
