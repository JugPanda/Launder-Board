// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), createUser: vi.fn(), getUserById: vi.fn(), signInWithPassword: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock('@/lib/supabase/admin.server', () => ({ createAdminClient: () => ({ auth: { admin: { createUser: mocks.createUser, getUserById: mocks.getUserById } } }) }));
import { getPresentationAccount, presentationSessionHash, provisionPresentationAccount } from '@/lib/hosted-guest/account.server';
const user = { id: '00000000-0000-4000-8000-000000000042', email: 'demo.laundrostat@example.com', app_metadata: { presentation_account: true }, user_metadata: {} };
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('DEMO_INDEX_SECRET', 'test-secret-with-at-least-32-characters'); mocks.getUser.mockResolvedValue({ data: { user }, error: null }); mocks.createUser.mockResolvedValue({ data: { user }, error: null }); mocks.getUserById.mockResolvedValue({ data: { user }, error: null }); });
it('only trusts verified server-controlled app metadata, never user metadata', async () => {
 expect(await getPresentationAccount()).toMatchObject({ id: user.id, email: user.email });
 mocks.getUser.mockResolvedValue({ data: { user: { ...user, app_metadata: {}, user_metadata: { presentation_account: true } } }, error: null });
 expect(await getPresentationAccount()).toBeNull();
});
it('derives stable distinct account hashes without trusting client identifiers', async () => {
 const r = new Request('https://demo.test/api/demo/session', { headers: { cookie: 'sb-project-auth-token=opaque; laundrostat_demo=' + 'a'.repeat(64) } });
 const a = await presentationSessionHash(r); expect(a).toMatch(/^[a-f0-9]{64}$/); expect(a).not.toContain(user.id); expect(await presentationSessionHash(r)).toBe(a);
 mocks.getUser.mockResolvedValue({ data: { user: { ...user, id: '00000000-0000-4000-8000-000000000043' } }, error: null });
 expect(await presentationSessionHash(r)).not.toBe(a);
});
it('does not initialize auth for guests and does not downgrade invalid auth to guest access', async () => {
 expect(await presentationSessionHash(new Request('https://demo.test'))).toBeNull(); expect(mocks.getUser).not.toHaveBeenCalled();
 mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
 await expect(presentationSessionHash(new Request('https://demo.test', { headers: { cookie: 'sb-project-auth-token.0=invalid' } }))).rejects.toMatchObject({ status: 401 });
});
it('fails closed on auth outages and missing derivation secret', async () => {
 mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 503 } }); await expect(getPresentationAccount()).rejects.toMatchObject({ status: 503 });
 mocks.getUser.mockResolvedValue({ data: { user }, error: null });vi.stubEnv('DEMO_INDEX_SECRET', '');
 await expect(presentationSessionHash(new Request('https://demo.test', { headers: { cookie: 'sb-project-auth-token=value' } }))).rejects.toMatchObject({ status: 503 });
});
it('provisions only a fixed non-admin synthetic account with random credentials and verifies the exact identity', async () => {
 const result=await provisionPresentationAccount();expect(result.email).toBe(user.email); expect(result.password.length).toBeGreaterThanOrEqual(24);
 expect(mocks.createUser).toHaveBeenCalledWith({ email: user.email, password: result.password, email_confirm: true, app_metadata: { presentation_account: true }, user_metadata: { display_name: 'LaundroStat Demo', synthetic: true } });
 expect(mocks.getUserById).toHaveBeenCalledWith(user.id);
});
it('never resets existing credentials and rejects bad provisioning read-back', async () => {
 mocks.createUser.mockResolvedValue({ data: { user: null }, error: { code: 'email_exists' } });
 await expect(provisionPresentationAccount()).rejects.toMatchObject({ status: 409 }); expect(mocks.getUserById).not.toHaveBeenCalled();
 mocks.createUser.mockResolvedValue({ data: { user }, error: null });mocks.getUserById.mockResolvedValue({ data: { user: { ...user, app_metadata: {} } }, error: null });
 await expect(provisionPresentationAccount()).rejects.toMatchObject({ status: 503 });
});
