import { redirect } from "next/navigation";

import {
  AuthenticationRequiredError,
  requireAuthenticatedUser,
} from "@/lib/auth/require-user";

export const dynamic = "force-dynamic";

type OnboardingPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  let authenticated;
  try {
    authenticated = await requireAuthenticatedUser();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect("/sign-in");
    throw error;
  }

  const { data: existingProfile } = await authenticated.supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", authenticated.authUserId)
    .eq("active", true)
    .is("deleted_at", null)
    .not("onboarding_completed_at", "is", null)
    .maybeSingle();
  if (existingProfile) redirect("/dashboard");

  const params = await searchParams;
  const rawError = params.error;
  const error = Array.isArray(rawError) ? rawError[0] : rawError;

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-12">
      <section className="rounded-3xl border border-line bg-surface p-7 shadow-sm sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-accent">Private by default</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight">Set up your participant profile</h1>
        <p className="mt-3 max-w-2xl leading-7 text-muted">
          Join your residence hall with its invite. Every optional sharing setting starts off.
        </p>
        {error ? <p role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p> : null}

        <form action="/onboarding/actions" method="post" className="mt-8 grid gap-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="grid gap-2 font-bold">
              Display name
              <input className="min-h-12 rounded-xl border border-line px-4 font-normal" name="displayName" minLength={2} maxLength={40} required />
            </label>
            <label className="grid gap-2 font-bold">
              Hall invite code
              <input className="min-h-12 rounded-xl border border-line px-4 font-mono font-normal uppercase" name="hallInviteCode" minLength={6} maxLength={32} required />
            </label>
          </div>

          <fieldset className="grid gap-4 rounded-2xl border border-line p-5">
            <legend className="px-2 font-black">Optional participation settings</legend>
            <label className="grid gap-2 font-bold">Profile visibility
              <select className="min-h-12 rounded-xl border border-line bg-white px-4 font-normal" name="visibility" defaultValue="private">
                <option value="private">Private</option><option value="friends">Friends</option><option value="public">Public</option>
              </select>
            </label>
            <label className="flex gap-3"><input type="checkbox" name="directoryOptIn" /> Let eligible participants discover my profile</label>
            <label className="flex gap-3"><input type="checkbox" name="activityImportOptIn" /> Import qualifying washer activity</label>
            <label className="flex gap-3"><input type="checkbox" name="publicStatsOptIn" /> Show my participation stats when visibility allows it</label>
            <label className="flex gap-3"><input type="checkbox" name="publicHallOptIn" /> Show my hall when visibility allows it</label>
            <label className="grid gap-2 font-bold">Who may encourage me?
              <select className="min-h-12 rounded-xl border border-line bg-white px-4 font-normal" name="encouragementScope" defaultValue="off">
                <option value="off">Nobody</option><option value="friends">Accepted friends</option><option value="hall">My hall</option>
              </select>
            </label>
            <label className="flex gap-3"><input type="checkbox" name="reminderEnabled" /> Enable inactivity reminders</label>
            <label className="grid gap-2 font-bold">Reminder interval
              <select className="min-h-12 rounded-xl border border-line bg-white px-4 font-normal" name="reminderDays" defaultValue="14">
                <option value="7">7 days</option><option value="14">14 days</option><option value="21">21 days</option>
              </select>
            </label>
          </fieldset>

          <button className="min-h-12 rounded-full bg-accent px-7 font-bold text-white" type="submit">Join my hall</button>
        </form>
      </section>
    </main>
  );
}
