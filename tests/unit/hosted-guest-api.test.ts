// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
const mock = vi.hoisted(() => ({ rows: {} as Record<string, Record<string, unknown>[]>, fail: false, rpc: vi.fn(), queries: [] as { table: string; filters: [string, string, unknown][] }[] }));
vi.mock('@/lib/supabase/admin.server', () => ({ createAdminClient: () => ({
  from(table: string) {
    const filters: [string, string, unknown][] = [];
    mock.queries.push({ table, filters });
    const q = { select: () => q, order: () => q, limit: () => q,
      eq: (k: string, v: unknown) => { filters.push(['eq', k, v]); return q; },
      in: (k: string, v: unknown[]) => { filters.push(['in', k, v]); return q; },
      gte: (k: string, v: unknown) => { filters.push(['gte', k, v]); return q; },
      gt: (k: string, v: unknown) => { filters.push(['gt', k, v]); return q; },
      then(resolve: (v: unknown) => unknown) { return Promise.resolve(resolve({ error: mock.fail ? { message: 'SECRET-provider-detail' } : null, data: (mock.rows[table] || []).filter(r => filters.every(([op,k,v]) => op === 'eq' ? r[k] === v : op === 'in' ? (v as unknown[]).includes(r[k]) : op === 'gt' ? String(r[k]) > String(v) : Number(r[k]) >= Number(v))) })); },
    }; return q;
  }, rpc: mock.rpc,
}) }));
import { GET as bootstrap } from '@/app/api/demo/bootstrap/route';
import { POST as session } from '@/app/api/demo/session/route';
import { GET as search } from '@/app/api/demo/search/route';
import { POST as nudge } from '@/app/api/demo/nudges/route';
import { POST as post } from '@/app/api/demo/posts/route';
import { POST as reset } from '@/app/api/demo/reset/route';
import { POST as index } from '@/app/api/demo/index/route';
const token = 'a'.repeat(64);
const hash = createHash('sha256').update(token).digest('hex');
const row = { id: 'U003', display_name: 'Riley', hall: 'Earhart Hall', days_since_wash: 17, tracking_state: 'current', visibility: 'public', reminder_consent: true, synthetic: true, scrub_streak: 0, last_full_cycle_date: '2026-08-22', source_label: 'Simulated CSC-format demo', usual_days: ['Tuesday'], usual_time_window: '17:00–19:00', as_of: '2026-09-08' };
function request(path: string, body?: unknown, cookie = true, origin = 'https://demo.test') { return new Request(`https://demo.test/api/demo/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie: `laundrostat_demo=${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }); }
beforeEach(() => {
 mock.fail = false; mock.queries = []; mock.rpc.mockReset().mockResolvedValue({ data: { ok: true, code: 'saved' }, error: null });
 mock.rows = { demo_participants: [row], demo_sessions: [{ id: '00000000-0000-4000-8000-000000000001', token_hash: hash, expires_at: '2099-01-01T00:00:00Z' }], demo_nudges: [], demo_posts: [] };
 vi.stubEnv('TYPESENSE_HOST', 'search.test'); vi.stubEnv('TYPESENSE_SEARCH_API_KEY', 'SECRET-search'); vi.stubEnv('TYPESENSE_ADMIN_API_KEY', 'SECRET-admin'); vi.stubEnv('DEMO_INDEX_SECRET', 'test-index-secret');
 vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ hits: [{ document: { id: 'U003', name: 'UNTRUSTED' } }], found: 999 })));
});
function indexRequest() { return new Request('https://demo.test/api/demo/index', { method: 'POST', headers: { authorization: 'Bearer test-index-secret', origin: 'https://demo.test', 'content-type': 'application/json' }, body: '{}' }); }
function indexProvider(options: { corruptReadback?: boolean; failedImport?: boolean; withdraw?: boolean } = {}) {
 const stores: Record<string, Record<string, unknown>[]> = { laundrostat_demo_participants_v1: [{ id: 'withdrawn', name: 'PRIVATE-STORED' }], purdue_housing_catalog_v1: [] };
 const calls: string[] = [];
 vi.mocked(fetch).mockImplementation(async (input, init) => {
  const url = new URL(String(input)); const parts = url.pathname.split('/').filter(Boolean); const collection = parts[1]; calls.push(`${init?.method || 'GET'} ${url.pathname}`);
  expect(['laundrostat_demo_participants_v1','purdue_housing_catalog_v1']).toContain(collection);
  expect((init?.headers as Record<string,string>)['X-TYPESENSE-API-KEY']).toBe('SECRET-admin');
  if (parts.length === 2) return Response.json({ name: collection });
  if (init?.method === 'DELETE') { stores[collection] = stores[collection].filter(d => d.id !== decodeURIComponent(parts[3])); return Response.json({ id: parts[3] }); }
  if (parts[3] === 'import') {
   stores[collection] = String(init?.body).split('\n').map(line => JSON.parse(line));
   if (options.withdraw && collection === 'purdue_housing_catalog_v1') mock.rows.demo_participants[0] = { ...row, visibility: 'private' };
   return new Response(stores[collection].map(() => JSON.stringify({ success: !options.failedImport })).join('\n'));
  }
  if (parts[3] === 'export') return new Response(stores[collection].map(d => JSON.stringify(options.corruptReadback && d.id === 'U003' ? { ...d, name: 'corrupt' } : d)).join('\n'));
  throw new Error('Unexpected Typesense request');
 }); return { stores, calls };
}
describe('hosted guest route security', () => {
 it('uses the incoming Host boundary when Next normalizes the internal request URL', async () => {
  mock.rpc.mockResolvedValue({ data: '00000000-0000-4000-8000-000000000001', error: null });
  const make = (origin: string) => new Request('http://localhost:3220/api/demo/session', { method: 'POST', headers: { host: '127.0.0.1:3220', origin, 'content-type': 'application/json' }, body: '{}' });
  expect((await session(make('http://127.0.0.1:3220'))).status).toBe(200);
  expect((await session(make('http://localhost:3220'))).status).toBe(403);
 });
 it.each(['unknown','expired'])('replaces %s client cookies with a fresh server-issued token', async (kind) => {
  if (kind === 'unknown') mock.rows.demo_sessions = [];
  else mock.rows.demo_sessions[0].expires_at = '2000-01-01';
  mock.rpc.mockResolvedValue({ data: '00000000-0000-4000-8000-000000000001', error: null });
  const result = await session(request('session', {}));
  expect(result.status).toBe(200);
  expect(result.headers.get('set-cookie')).not.toContain(token);
  expect(mock.rpc.mock.calls[0][1].p_token_hash).not.toBe(hash);
 });
 it('expires the rendered cooldown after 72 hours instead of the whole session lifetime', async () => {
  const owner = mock.rows.demo_sessions[0].id;
  mock.rows.demo_nudges = [{ session_id: owner, recipient_id: 'U003', created_at: new Date(Date.now() - 73 * 3600000).toISOString() }];
  expect((await (await bootstrap(request('bootstrap'))).json()).nudgedIds).toEqual([]);
  mock.rows.demo_nudges[0].created_at = new Date().toISOString();
  expect((await (await bootstrap(request('bootstrap'))).json()).nudgedIds).toEqual(['U003']);
 });
 it('indexes both exact collections, deletes withdrawn IDs and verifies every document', async () => {
  const provider = indexProvider(); const response = await index(indexRequest()); const data = await response.json();
  expect(response.status).toBe(200); expect(data.verified).toBe(true); expect(data.collections).toEqual({ laundrostat_demo_participants_v1: 1, purdue_housing_catalog_v1: 18 });
  expect(provider.stores.laundrostat_demo_participants_v1.map(d => d.id)).toEqual(['U003']); expect(provider.calls).toContain('DELETE /collections/laundrostat_demo_participants_v1/documents/withdrawn');
  expect(JSON.stringify(data)).not.toMatch(/SECRET|PRIVATE-STORED/);
 });
 it('purges eligibility withdrawn during indexing instead of resurrecting it', async () => {
  const provider = indexProvider({ withdraw: true }); const r = await index(indexRequest()); expect(r.status).toBe(200); expect(provider.stores.laundrostat_demo_participants_v1).toEqual([]);
 });
 it('does not report index success after partial import or corrupt readback', async () => {
  indexProvider({ failedImport: true }); expect((await index(indexRequest())).status).toBe(503);
  indexProvider({ corruptReadback: true }); const r = await index(indexRequest()); expect(r.status).toBe(503); expect(await r.text()).not.toContain('SECRET');
 });
 it('bounds request bodies and rejects missing origin', async () => {
  const oversized = new Request('https://demo.test/api/demo/posts', { method: 'POST', headers: { origin: 'https://demo.test', 'content-type': 'application/json' }, body: JSON.stringify({ preset: 'x'.repeat(2000) }) });
  expect((await post(oversized)).status).toBe(413);
  expect((await session(new Request('https://demo.test/api/demo/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }))).status).toBe(403); expect(mock.rpc).not.toHaveBeenCalled();
 });
 it('scopes bootstrap event reads to valid cookie owner and ignores foreign events', async () => {
  const owner = mock.rows.demo_sessions[0].id;
  mock.rows.demo_posts = [{ id: 'own', session_id: owner, preset: 'fresh_start', created_at: '2026-09-09' }, { id: 'foreign', session_id: 'other', preset: 'fresh_start', created_at: '2026-09-09' }];
  const data = await (await bootstrap(request('bootstrap'))).json(); expect(data.posts.map((p: { id: string }) => p.id)).toEqual(['own']);
  mock.rows.demo_sessions[0].expires_at = '2000-01-01'; expect((await nudge(request('nudges', { recipientId: 'U003', preset: 'fresh_start' }))).status).toBe(401); expect(mock.rpc).not.toHaveBeenCalled();
 });
 it('bootstrap is database backed and computes score; excludes noneligible rows', async () => {
  mock.rows.demo_participants.push({ ...row, id: 'private', visibility: 'private' }, { ...row, id: 'real', synthetic: false }, { ...row, id: 'unknown', tracking_state: 'unknown' }, { ...row, id: 'no-consent', reminder_consent: false });
  const response = await bootstrap(request('bootstrap')); const data = await response.json();
  expect(response.status).toBe(200); expect(data.participants.map((p: { id: string }) => p.id)).toEqual(['U003']); expect(data.participants[0].score).toBe(32); expect(data.providers).toEqual({ database: 'supabase', search: 'typesense' });
 });
 it('fails closed on database outage without bundled fallback or error details', async () => { mock.fail = true; const r = await bootstrap(request('bootstrap')); expect(r.status).toBe(503); expect(await r.text()).not.toMatch(/SECRET|Riley|Avery/); });
 it('does not read session events for absent or invalid cookies', async () => { await bootstrap(request('bootstrap', undefined, false)); expect(mock.queries.some(q => ['demo_nudges','demo_posts'].includes(q.table))).toBe(false); });
 it('rejects cross-origin writes before DB', async () => { for (const handler of [session,nudge,post,reset]) { const r = await handler(request('x', {}, true, 'https://evil.test')); expect(r.status).toBe(403); } expect(mock.rpc).not.toHaveBeenCalled(); expect(mock.queries).toHaveLength(0); });
 it('rejects client asserted sessions and malformed payloads', async () => { expect((await nudge(request('nudges', { recipientId: 'U003', preset: 'fresh_start', sessionId: 'other' }))).status).toBe(400); expect((await post(request('posts', { preset: 'arbitrary' }))).status).toBe(400); expect(mock.rpc).not.toHaveBeenCalled(); });
 it('requires a valid session to mutate and uses only its hash', async () => { expect((await nudge(request('nudges', { recipientId: 'U003', preset: 'fresh_start' }, false))).status).toBe(401); const r = await nudge(request('nudges', { recipientId: 'U003', preset: 'fresh_start' })); expect(r.status).toBe(200); expect(mock.rpc).toHaveBeenCalledWith('demo_save_nudge', { p_token_hash: hash, p_recipient_id: 'U003', p_preset: 'fresh_start' }); expect(await r.text()).not.toContain(token); });
 it('opens opaque cookie sessions and returns bootstrap', async () => { mock.rpc.mockResolvedValue({ data: '00000000-0000-4000-8000-000000000001', error: null }); const r = await session(request('session', {}, false)); expect(r.status).toBe(200); expect(r.headers.get('set-cookie')).toMatch(/laundrostat_demo=[a-f0-9]{64};.*HttpOnly.*SameSite=Lax/); expect((await r.json()).participants).toHaveLength(1); const args = mock.rpc.mock.calls[0][1]; expect(args.p_token_hash).toMatch(/^[a-f0-9]{64}$/); expect(r.headers.get('set-cookie')).not.toContain(args.p_token_hash); });
 it('rehydrates search IDs from current database; drops private stale hits and duplicates', async () => { mock.rows.demo_participants.push({ ...row, id: 'withdrawn', visibility: 'private' }); vi.mocked(fetch).mockResolvedValue(Response.json({ hits: [{ document: { id: 'withdrawn' } }, { document: { id: 'U003', name: 'UNTRUSTED' } }, { document: { id: 'U003' } }], found: 999 })); const r = await search(request('search?minDays=14')); const data = await r.json(); expect(data.returnedCount).toBe(1); expect(data.participants[0].name).toBe('Riley'); expect(data.source).toBe('typesense'); expect(data).not.toHaveProperty('found'); });
 it('fails closed when Typesense fails and rejects query injection', async () => { vi.mocked(fetch).mockRejectedValue(new Error('SECRET-admin')); const r = await search(request('search')); expect(r.status).toBe(503); expect(await r.text()).not.toMatch(/SECRET|Riley/); expect((await search(request('search?hall=private%20%7C%7C%20true'))).status).toBe(400); expect((await search(request('search?q=a&q=b'))).status).toBe(400); });
 it('reset calls owner-scoped RPC and expires only its cookie', async () => { const r = await reset(request('reset', {})); expect(r.status).toBe(200); expect(mock.rpc).toHaveBeenCalledWith('demo_reset_session', { p_token_hash: hash }); expect(r.headers.get('set-cookie')).toContain('Max-Age=0'); });
 it('index rejects cookie-only and wrong bearer before any provider call', async () => { const r = await index(request('index', {})); expect(r.status).toBe(401); expect(mock.rpc).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled(); });
 it('maps atomic RPC denials and strips arbitrary provider fields', async () => { mock.rpc.mockResolvedValue({ data: { ok: false, code: 'ineligible', secret: 'SECRET' }, error: null }); const r = await nudge(request('nudges', { recipientId: 'U003', preset: 'fresh_start' })); expect(r.status).toBe(409); expect(await r.text()).not.toContain('SECRET'); });
});
