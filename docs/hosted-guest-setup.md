# Hosted synthetic guest setup

This setup serves the current Clean-O-Meter, Squeaky/Stinky squads, Wash Mates, and session-scoped demo events. It does not activate real student accounts or CSC integration.

## Exact project and deployment

- Supabase: `lpynsochpzuazxkypoaq`
- Site: https://laundrostat.vercel.app/demo
- Vercel project: `jugpandaco/laundrostat`

## Create the current schema

Open the intended Supabase project's SQL Editor and run the complete `supabase/guest-migrations/0001_hosted_guest.sql` file. It is a standalone atomic setup; **do not run legacy weekly-scoring migrations or seed/reset scripts** for this guest release.

It installs synthetic participant metadata, hashed anonymous demo sessions, session-private nudges and preset feed updates, plus the separate sourced Purdue housing catalog. Direct browser reads/writes to guest tables are denied by privileges and RLS. Trusted Next.js handlers use the server key; no service key is sent to the browser.

Replay does not overwrite changed fixture rows or existing demo events. Only expired anonymous demo sessions are cleaned by session creation; no legacy tables are reset.

Read-only verification: `select public.demo_schema_status();` must report `ok: true`, `tables_healthy: true`, `schema_version: 1`, and `canonical_synthetic_count: 9` on the initial setup.

## Environment

Production needs `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`; the latter is the service-role/secret key, not the public key.

Typesense variables: `TYPESENSE_HOST`, `TYPESENSE_PORT=443`, `TYPESENSE_PROTOCOL=https`, server-only `TYPESENSE_ADMIN_API_KEY`, `TYPESENSE_SEARCH_API_KEY`. A separate random server-only `DEMO_INDEX_SECRET` protects the indexing operation. Never paste keys into source or commit them.

Keep `LAUNDER_BOARD_DEMO_MODE=enabled`. `/demo` remains sign-in-free; public access does not open legacy private APIs.

## Index and verify

After the schema is installed and the application deployed, the operator calls POST `/api/demo/index` with `Authorization: Bearer <DEMO_INDEX_SECRET>`. This endpoint reads eligible synthetic participants from Supabase and indexes them into `laundrostat_demo_participants_v1`. Sourced halls use `purdue_housing_catalog_v1`. Index completion requires document read-back, not only an import HTTP status.

Live search requires Typesense; outages do not substitute bundled results. Every hit is rechecked against current Supabase consent/visibility/tracking before it is returned.

## What persistence means

An opaque, HttpOnly, same-site browser cookie owns an anonymous synthetic demo session. Supabase stores only its token hash. Nudges and fixed feed presets belong only to that session, survive refresh, and are never messages to real people or globally published posts. Reset removes only that session's records. A private browser/context starts separately.

Proof images remain local previews, never uploaded or verified. Supabase-backed synthetic records are not provider-confirmed laundry activity.
