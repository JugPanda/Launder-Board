import { redirect } from "next/navigation";
import GuestDemo from "@/components/guest-demo/GuestDemo";
import { getPresentationAccount } from "@/lib/hosted-guest/account.server";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const account = await getPresentationAccount();
  if (!account) redirect("/sign-in");
  return <main>
    <section className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-5 px-5 py-6" aria-label="Presentation account">
      <div>
        <h1 className="text-2xl font-black">{account.name}’s presentation account</h1>
        <p className="mt-1 text-sm text-muted">{account.email}</p>
        <p className="mt-2 text-sm">Synthetic presentation profile, not a university account. Your demo events are saved to this account for up to 7 days; reset clears only your account’s demo events.</p>
      </div>
      <form action="/sign-out" method="post">
        <button type="submit" className="min-h-12 rounded-full border border-line px-6 font-bold">Sign out</button>
      </form>
    </section>
    <GuestDemo accountName={account.name} />
  </main>;
}
