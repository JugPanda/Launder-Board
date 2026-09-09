import { EyeOff, Info } from "lucide-react";
import { notFound } from "next/navigation";

import { PublicDemoShell } from "@/components/demo/PublicDemoShell";
import { WithdrawablePublicProfile } from "@/components/demo/WithdrawablePublicProfile";
import { DEMO_PROFILE } from "@/lib/demo/fixtures";

type PublicProfilePageProps = {
  params: Promise<{ publicSlug: string }>;
};

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { publicSlug } = await params;
  if (publicSlug !== DEMO_PROFILE.slug) notFound();

  return (
    <PublicDemoShell>
      <header className="mx-auto mb-8 max-w-3xl text-center">
        <p className="text-xs font-black uppercase tracking-[0.17em] text-accent">Public sharing demonstration</p>
        <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">Only opted-in, coarse participation details appear.</h2>
        <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600">This fictional profile is visible only to show the intended public boundary. The withdrawal control below removes the whole local view immediately.</p>
      </header>

      <WithdrawablePublicProfile />

      <aside className="mx-auto mt-6 flex max-w-3xl gap-3 rounded-2xl border border-line bg-white p-5 text-sm leading-6 text-slate-600">
        <EyeOff aria-hidden="true" className="mt-0.5 shrink-0 text-accent" size={18} />
        <p><strong className="text-slate-950">Deny-first behavior:</strong> an unknown or withdrawn slug does not fall back to this synthetic person. It returns no participant profile.</p>
      </aside>
      <aside className="mx-auto mt-3 flex max-w-3xl gap-3 rounded-2xl border border-pink-200 bg-pink-50 p-5 text-sm leading-6 text-pink-950">
        <Info aria-hidden="true" className="mt-0.5 shrink-0" size={18} />
        <p>This page is entirely synthetic. Its withdrawal button changes browser state only; it does not make an API request or update an account.</p>
      </aside>
    </PublicDemoShell>
  );
}
