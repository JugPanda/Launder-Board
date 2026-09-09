import Link from "next/link";
import { isSupabaseAuthConfigured } from "@/lib/supabase/env";

type SignInPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const error = first(params.error);
  const message = first(params.message);

  if (!isSupabaseAuthConfigured()) {
    const demoHref = process.env.LAUNDER_BOARD_DEMO_MODE === "enabled"
      ? "/dashboard"
      : "/leaderboards/fall-weekly-quest";
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center px-5 py-12">
        <section className="w-full rounded-3xl border border-line bg-surface p-7 shadow-sm sm:p-9">
          <Link className="text-xl font-black tracking-[-0.04em] text-accent" href="/">LaundroStat</Link>
          <p className="mt-8 text-sm font-bold uppercase tracking-[0.16em] text-accent">Demo-only access</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">Account setup pending</h1>
          <p className="mt-3 leading-7 text-muted">
            Sign-in and account creation are unavailable because the site&apos;s authentication service has not been configured.
            You can explore synthetic demo data without an account. The demo does not save a real participant profile.
          </p>
          <Link className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-6 font-bold text-white" href={demoHref}>
            View synthetic demo
          </Link>
          <p className="mt-5 text-sm leading-6 text-muted">The site operator needs to finish secure hosted authentication setup before accounts can be used.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-5 py-12">
      <section className="w-full rounded-3xl border border-line bg-surface p-7 shadow-sm sm:p-9">
        <Link className="text-xl font-black tracking-[-0.04em] text-accent" href="/">
          LaundroStat
        </Link>
        <p className="mt-8 text-sm font-bold uppercase tracking-[0.16em] text-accent">
          Participant access
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">Sign in or join</h1>
        <p className="mt-3 leading-7 text-muted">
          Your hall invite is used during onboarding, after your account is authenticated.
        </p>

        {error ? (
          <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-5 rounded-2xl border border-line bg-background p-4 text-sm">
            {message}
          </p>
        ) : null}

        <form action="/sign-in/actions" method="post" className="mt-7 grid gap-5">
          <label className="grid gap-2 font-bold">
            Email
            <input
              className="min-h-12 rounded-xl border border-line bg-white px-4 font-normal"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
            />
          </label>
          <label className="grid gap-2 font-bold">
            Password
            <input
              className="min-h-12 rounded-xl border border-line bg-white px-4 font-normal"
              name="password"
              type="password"
              autoComplete="current-password"
              minLength={8}
              maxLength={128}
              required
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <button className="min-h-12 rounded-full bg-accent px-6 font-bold text-white" name="intent" value="sign-in">
              Sign in
            </button>
            <button className="min-h-12 rounded-full border border-line bg-white px-6 font-bold" name="intent" value="sign-up">
              Create account
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
