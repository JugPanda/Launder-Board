# Secure hosted Supabase setup

> **Deferred for the current guest release.** `/demo` needs no Supabase or sign-in. With the showcase flag enabled, `/sign-in` redirects to `/demo`. The instructions below describe retained authentication infrastructure for later real-user work, not tonight's demo.

## What this enables—and what it does not

A deployment with only `LAUNDER_BOARD_DEMO_MODE=enabled` has no hosted authentication. `/sign-in` deliberately shows **Account setup pending**, not a credential form. Its demo link does not create an account. Missing or invalid public Supabase configuration makes POST `/sign-in/actions` redirect safely (303, private/no-store) before initializing the provider. Provider failures return generic errors; they are not successful authentication.

**Adding Supabase does NOT finish real UI wiring.** The existing dashboard, friends, and privacy screens are browser demos using synthetic fixtures/local state. Their controls are not proof of persisted account data or enforced sharing preferences. Auth and onboarding/server APIs exist, but the product still needs real authenticated UI integration and end-to-end privacy verification before onboarding real participants. Do not enter real participant data into demo controls. Typesense Cloud is a separate service, not included with Supabase.

## 1. Create a hosted project

1. In the [Supabase dashboard](https://supabase.com/dashboard), create a project in the intended organization and region. Keep development/preview and production projects separate.
2. Save its database password in a password manager. Wait for provisioning, then copy the **Project URL** and **anon (public) key** from the project's Connect/API settings. They must belong to the same project. Do not use a localhost URL on Vercel.
3. Retrieve the **service_role** key separately for privileged server integrations. It bypasses RLS: restrict access to operators and server processes. Never use it in a participant/browser client.

## 2. Add the exact Vercel variables

Open Vercel project **`jugpandaco/launderboard` → Settings → Environment Variables**. Set these explicitly for Production; use a separate Supabase project and separate values for Preview/Development:

| Variable | Value | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Exact project URL, e.g. `https://<project-ref>.supabase.co` | Browser-safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same project's anon public key | Browser-safe; RLS remains the security boundary |
| `SUPABASE_SERVICE_ROLE_KEY` | Same project's service_role key | **Server-only secret**, never `NEXT_PUBLIC_` |
| `LAUNDER_BOARD_DEMO_MODE` | `disabled` for a real private deployment | Server-only access-mode setting |

The sign-in client needs only URL + anon key; service-role is for privileged backend work, not a workaround for failed participant auth. Never expose database passwords, service-role keys, SMTP passwords, CLI access tokens, or Typesense admin keys in browser variables, source code, screenshots, logs, or Telegram/chat. Add secrets directly through the provider's secure dashboard or a trusted local secret-manager environment. Do not send them to the assistant.

Keep demo mode `enabled` only on an intentionally public synthetic showcase. Disabling it restores auth gates but does not convert demo UI to real account UI. Neither choice disables database RLS or makes a profile public by default.

## 3. Apply migrations only

Use a trusted workstation with the Supabase CLI. Before touching the hosted database, confirm the project reference against the intended project's dashboard and review every pending SQL migration. Back up an existing database first.

Have your secret manager inject `SUPABASE_ACCESS_TOKEN` (CLI management access) and `SUPABASE_DB_PASSWORD` into that terminal session. Alternatively use the CLI's interactive login flow. Do not paste credentials into shell history, command arguments, Telegram, or repository files. For direct PostgreSQL tools, use the project's Connect dialog to obtain the correct direct connection parameters; inject `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, and `PGSSLMODE=require` securely. A database password/connection is distinct from the public anon key and service-role key. If direct connectivity is unavailable, use the supported session-pooler connection from Connect, not a guessed hostname.

From the repository root (replace only the non-secret project reference):

```sh
supabase link --project-ref <project-ref>
supabase migration list --linked
supabase db push --linked --dry-run
# Review the exact pending migrations and target, then:
supabase db push --linked
supabase migration list --linked
```

Apply reviewed files in `supabase/migrations/` in order, including their grants, RLS policies, functions, and schema changes. Do not manually disable RLS to make tests pass. Verify migrations and private-by-default profile behavior before testing enrollment; real hall invites must be provisioned through an authorized operational process.

**Never run synthetic demo seeds in production.** Do not run `supabase/seed/demo.sql`, `db push --include-seed`, or `db reset --linked`. The local config enables demo seeding on reset; that is not a production installation recipe. Do not copy local test/demo users, enrollment tokens, or fabricated activity into hosted production.

## 4. Configure email/password and exact destinations

In Supabase **Authentication → Providers → Email**, enable email/password sign-in and enable new-user signups only when ready to accept accounts. Keep email confirmation enabled for production. The repository's local `supabase/config.toml` is for local development; its confirmation settings do not define hosted policy.

In **Authentication → URL Configuration**:

- Confirm the actual production domain in Vercel Settings → Domains. For a deployment served at `https://launderboard.vercel.app`, set **Site URL** to **`https://launderboard.vercel.app/sign-in`**. If the assigned/custom domain differs, use that exact HTTPS origin plus `/sign-in` instead.
- Set the redirect allowlist to the exact **`https://launderboard.vercel.app/sign-in`** destination (or the exact confirmed custom-domain equivalent), not `https://**.vercel.app/**` or a wildcard.
- For a separate development Supabase project, use Site URL **`http://localhost:3000/sign-in`** and allowlist **`http://localhost:3000/sign-in`**. Add **`http://127.0.0.1:3000/sign-in`** only if actually used. For a preview project, use its exact stable preview HTTPS origin plus `/sign-in`; remove obsolete preview URLs.

The current `signUp({ email, password })` call does not supply `emailRedirectTo`, so Supabase's Site URL is the confirmation return destination. Keep Supabase's default confirmation template using `{{ .ConfirmationURL }}`: it verifies email at Supabase, then returns the user to sign in with their password. There is **no implemented `/auth/callback` or `/auth/confirm` route** in this app; do not copy a token-hash/PKCE callback template expecting either route. This flow does not promise automatic login from the email link. A server callback and corresponding allowlist/template changes are separate work if automatic email-link sessions are desired.

## 5. Configure delivery before public signup

Supabase's default SMTP is for testing, not production: it sends only to pre-authorized organization team addresses and imposes very low rate limits (documented as two messages/hour, subject to change). Other users can fail signup/email delivery even with correct API keys.

Configure a custom SMTP provider under Authentication → SMTP, verify the sender domain/address (including the provider's DNS requirements), and securely enter its host, port, username, and password. Check provider sandbox/recipient restrictions and Supabase auth rate limits. Test with an authorized mailbox you control, check spam folders, and test expired links and resend limits. Do not turn off email confirmation merely to hide delivery failures, and do not invite someone into your Supabase organization just to let them use LaundroStat.

## 6. Redeploy and verify honestly

Redeploy Vercel after saving the environment variables; `NEXT_PUBLIC_` values are bundled at build time, so an old deployment will not pick them up. Verify the new deployment is assigned to the production domain.

1. `/sign-in` should show the form only with valid public configuration. If absent/invalid, it must show setup pending, no credential inputs, and a working synthetic demo link.
2. With an authorized test mailbox, create an account, confirm email, then sign in. Check Supabase Authentication → Users for the real user and confirmation state. A generic email-confirmation prompt alone is not proof an account was created (providers can intentionally avoid revealing existing accounts).
3. Confirm the cookie-bound session and onboarding routing. An authenticated user with an active, completed profile routes to `/dashboard`; otherwise to `/onboarding`. Do not interpret the synthetic dashboard as the authenticated user's stored data.
4. Wrong passwords, unavailable provider, and missing config must not reveal credentials or grant access. Anonymous private API requests must remain rejected. Confirm private profile defaults and opt-in sharing through backend/database checks, not demo switches.
5. Validate real UI integration before claiming production readiness. No hosted signup, delivery, migrations, or secret provisioning is verified merely by local mocked tests.

For search, separately provision Typesense Cloud and set the server variables in `.env.example`: `TYPESENSE_HOST`, `TYPESENSE_PORT=443`, `TYPESENSE_PROTOCOL=https`, `TYPESENSE_ADMIN_API_KEY`, `TYPESENSE_SEARCH_API_KEY`, plus a strong server-only `CRON_SECRET` for the indexing worker. Keep admin credentials server-only and verify indexing/access control separately. Supabase auth configuration does not populate the search index.

## References

- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase SMTP and test restrictions](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase CLI](https://supabase.com/docs/reference/cli/introduction)
- [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables)
