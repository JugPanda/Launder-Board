import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  WashingMachine,
} from "lucide-react";

import { isSupabaseAuthConfigured } from "@/lib/supabase/env";

import styles from "./sign-in.module.css";

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
  const guestRelease = process.env.LAUNDER_BOARD_DEMO_MODE === "enabled";
  const authConfigured = isSupabaseAuthConfigured();
  const demoHref = "/demo";

  return (
    <main className={styles.page}>
      <div className={styles.safety}>
        <ShieldCheck aria-hidden="true" size={16} />
        <span>
          {guestRelease
            ? "SYNTHETIC DEMO · Presentation access only · No real student records"
            : "INDEPENDENT STUDENT CONCEPT · Privacy-first participation"}
        </span>
      </div>

      <div className={styles.frame}>
        <header className={`${styles.header} motion-rise`}>
          <Link className={styles.brand} href="/">
            <span className={styles.brandMark}>
              <WashingMachine aria-hidden="true" size={24} />
            </span>
            <span>LaundroStat</span>
            <span className={styles.brandTag}>/ laundry, together</span>
          </Link>
          <Link aria-label="Back to LaundroStat home" className={styles.backLink} href="/">
            <ArrowLeft aria-hidden="true" size={17} />
            <span>Back to home</span>
          </Link>
        </header>

        <div className={styles.layout}>
          <aside className={`${styles.story} motion-rise motion-delay-2`} aria-labelledby="sign-in-story-heading">
            <p className={styles.eyebrow}>Laundry, together</p>
            <h2 id="sign-in-story-heading">Your laundry routine, in one place.</h2>
            <p className={styles.storyIntro}>
              Return to your Clean-O-Meter, saved demo nudges, Wash Mate matches, and Dorm Wars view.
            </p>

            <div className={styles.drum} aria-hidden="true">
              <div className={styles.drumInner}>
                <div>
                  <WashingMachine size={54} strokeWidth={1.5} />
                  <span>Fresh start</span>
                </div>
              </div>
            </div>

            <ul className={styles.proofList}>
              <li><CheckCircle2 aria-hidden="true" size={19} /> Account-bound demo updates remain available after refresh.</li>
              <li><CheckCircle2 aria-hidden="true" size={19} /> Synthetic profiles stay clearly separate from the real creator team.</li>
              <li><CheckCircle2 aria-hidden="true" size={19} /> No real students are contacted and nothing is sent to CSC.</li>
            </ul>
          </aside>

          <section className={`${styles.card} motion-rise motion-delay-1`} aria-labelledby="sign-in-heading">
            <p className={styles.kicker}>
              {authConfigured
                ? (guestRelease ? "Presentation account" : "Participant access")
                : "Demo-only access"}
            </p>
            <h1 id="sign-in-heading">
              {authConfigured
                ? (guestRelease ? "Demo account sign in" : "Sign in or join")
                : "Account setup pending"}
            </h1>
            <p className={styles.description}>
              {!authConfigured
                ? "Sign-in and account creation are unavailable because the authentication service has not been configured. Explore synthetic demo data without creating a participant profile."
                : guestRelease
                  ? "Use your provided presentation account. This is a synthetic demo, not a university account. Demo nudges and preset updates are saved to your account; no real students are contacted."
                  : "Sign in first, then use your hall invite during onboarding."}
            </p>

            {error ? <p role="alert" className={styles.alert}>{error}</p> : null}
            {message ? <p className={styles.message}>{message}</p> : null}

            {authConfigured ? (
              <form action="/sign-in/actions" method="post" className={styles.form}>
                <label className={styles.field}>
                  Email
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    maxLength={254}
                    required
                  />
                </label>
                <label className={styles.field}>
                  Password
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    minLength={8}
                    maxLength={128}
                    required
                  />
                </label>
                <div className={styles.actions}>
                  <button className={styles.primaryButton} name="intent" value="sign-in">
                    Sign in <ArrowRight aria-hidden="true" size={18} />
                  </button>
                  {!guestRelease ? (
                    <button className={styles.secondaryButton} name="intent" value="sign-up">
                      Create account
                    </button>
                  ) : null}
                </div>
              </form>
            ) : (
              <Link className={`${styles.primaryButton} motion-lift`} href={demoHref}>
                View synthetic demo <ArrowRight aria-hidden="true" size={18} />
              </Link>
            )}

            <div className={styles.demoRow}>
              <span>{authConfigured ? "Want to look around first?" : "No account or credentials required."}</span>
              <Link className={styles.demoLink} href={demoHref}>
                Explore the public demo <ArrowRight aria-hidden="true" size={17} />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
