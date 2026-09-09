import 'server-only';
import { createHmac, randomBytes } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin.server';
import { DemoError, unavailable } from './repository.server';

const PRESENTATION_EMAIL = 'demo.laundrostat@example.com';
export async function getPresentationAccount() {
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error && ((error.status ?? 0) >= 500 || error.name === 'AuthRetryableFetchError')) throw unavailable();
  const user = data?.user;
  // app_metadata is operator-controlled; user_metadata cannot grant access.
  if (error || !user || user.app_metadata?.presentation_account !== true || !user.email) return null;
  return { id: user.id, email: user.email, name: 'LaundroStat Demo' };
}

export async function presentationSessionHash(request: Request): Promise<string | null> {
  if (!/(?:^|;\s*)sb-[a-zA-Z0-9_-]+-auth-token(?:\.\d+)?=/.test(request.headers.get('cookie') || '')) return null;
  const account = await getPresentationAccount();
  if (!account) throw new DemoError(401, 'invalid_account_session');
  const secret = process.env.DEMO_INDEX_SECRET;
  if (!secret) throw unavailable();
  // No account capability token is sent to the browser. Every access revalidates Auth.
  // Guest storage expires after seven days; this is presentation data, not permanent history.
  return createHmac('sha256', secret).update(`laundrostat:presentation-session:v1:${account.id}`).digest('hex');
}

/** Operator-only caller; fixed synthetic identity, no account takeover or reset path. */
export async function provisionPresentationAccount() {
  const admin = createAdminClient();
  const password = `Ls!${randomBytes(18).toString('base64url')}9a`;
  const { data, error } = await admin.auth.admin.createUser({
    email: PRESENTATION_EMAIL, password, email_confirm: true,
    app_metadata: { presentation_account: true },
    user_metadata: { display_name: 'LaundroStat Demo', synthetic: true },
  });
  if (error?.code === 'email_exists' || error?.code === 'user_already_exists') throw new DemoError(409, 'presentation_account_exists');
  if (error || !data.user) throw unavailable();
  const readback = await admin.auth.admin.getUserById(data.user.id);
  if (readback.error || readback.data.user?.id !== data.user.id || readback.data.user?.email !== PRESENTATION_EMAIL || readback.data.user?.app_metadata?.presentation_account !== true) throw unavailable();
  return { ok: true, email: PRESENTATION_EMAIL, password };
}
