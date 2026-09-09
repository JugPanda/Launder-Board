import 'server-only';
import { z } from 'zod';
import type { GuestParticipant } from '@/lib/guest-demo';
import { PURDUE_HALLS } from '@/lib/purdue/catalog';
import { participants, unavailable } from './repository.server';
export const DEMO_COLLECTION = 'laundrostat_demo_participants_v1';
const HOUSING_COLLECTION = 'purdue_housing_catalog_v1';
export const filtersSchema = z.object({ q: z.string().trim().max(100).default(''), hall: z.enum(['','all','Earhart Hall','Harrison Hall','Shreve Hall']).default(''), minDays: z.string().regex(/^(0|[1-9]\d{0,3})$/).transform(Number).default(14) }).strict();
export type SearchFilters = z.infer<typeof filtersSchema>;
async function typesense(path: string, admin = false, options: RequestInit = {}) {
  const host = process.env.TYPESENSE_HOST;
  const key = process.env[admin ? 'TYPESENSE_ADMIN_API_KEY' : 'TYPESENSE_SEARCH_API_KEY'];
  const protocol = process.env.TYPESENSE_PROTOCOL || 'https';
  const port = process.env.TYPESENSE_PORT || (protocol === 'https' ? '443' : '8108');
  if (!host || !key || !/^[a-zA-Z0-9.-]+$/.test(host) || !['https','http'].includes(protocol) || !/^\d{1,5}$/.test(port)) throw unavailable();
  return fetch(`${protocol}://${host}:${port}${path}`, { ...options, headers: { 'X-TYPESENSE-API-KEY': key, 'Content-Type': 'application/json', ...options.headers }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
}
export async function searchParticipants(filters: SearchFilters) {
  const clauses = ['synthetic:=true','tracking:=current','visibility:=[public,friends]','reminderConsent:=true',`daysSinceWash:>=${filters.minDays}`];
  if (filters.hall && filters.hall !== 'all') clauses.push(`hall:=\`${filters.hall}\``);
  const params = new URLSearchParams({ q: filters.q || '*', query_by: 'name,hall', filter_by: clauses.join(' && '), per_page: '100', include_fields: 'id' });
  const response = await typesense(`/collections/${DEMO_COLLECTION}/documents/search?${params}`);
  if (!response.ok) throw unavailable();
  const parsed = z.object({ hits: z.array(z.object({ document: z.object({ id: z.string().min(1).max(100) }) })).max(100) }).safeParse(await response.json());
  if (!parsed.success) throw unavailable();
  const ids = [...new Set(parsed.data.hits.map(h => h.document.id))];
  const current = new Map((await participants(ids)).map(p => [p.id,p]));
  const roster = ids.flatMap(id => {
    const p = current.get(id);
    if (!p || p.daysSinceWash === null || p.daysSinceWash < filters.minDays || (filters.hall && filters.hall !== 'all' && p.hall !== filters.hall)) return [];
    return [p];
  });
  return { participants: roster, source: 'typesense', returnedCount: roster.length };
}
type Document = Record<string, unknown> & { id: string };
const demoDocument = (p: GuestParticipant): Document => ({ id: p.id, name: p.name, hall: p.hall, daysSinceWash: p.daysSinceWash, tracking: p.tracking, visibility: p.visibility, reminderConsent: true, synthetic: true });
function lines(text: string): unknown[] { return text.trim() ? text.trim().split('\n').map(line => JSON.parse(line)) : []; }
async function exported(collection: string): Promise<Document[]> {
  const response = await typesense(`/collections/${collection}/documents/export`, true);
  if (!response.ok) throw unavailable();
  const parsed = z.array(z.object({ id: z.string() }).catchall(z.unknown())).safeParse(lines(await response.text()));
  if (!parsed.success) throw unavailable();
  return parsed.data;
}
async function removeStale(collection: string, actual: Document[], desired: Document[]) {
  const wanted = new Set(desired.map(d => d.id));
  for (const old of actual) if (!wanted.has(old.id)) {
    const response = await typesense(`/collections/${collection}/documents/${encodeURIComponent(old.id)}`, true, { method: 'DELETE' });
    if (!response.ok && response.status !== 404) throw unavailable();
  }
}
function verify(actual: Document[], desired: Document[]) {
  if (actual.length !== desired.length || new Set(actual.map(d => d.id)).size !== desired.length || desired.some(d => !actual.some(a => a.id === d.id && Object.keys(a).length === Object.keys(d).length && Object.keys(d).every(k => JSON.stringify(a[k]) === JSON.stringify(d[k]))))) throw unavailable();
}
async function sync(collection: string, fields: Record<string, unknown>[], documents: Document[]) {
  const response = await typesense(`/collections/${collection}`, true);
  if (response.status === 404) {
    const created = await typesense('/collections', true, { method: 'POST', body: JSON.stringify({ name: collection, fields }) });
    if (!created.ok) throw unavailable();
  } else if (!response.ok) throw unavailable();
  // Delete withdrawn IDs before upsert; never copy old exported content back.
  await removeStale(collection, await exported(collection), documents);
  if (documents.length) {
    const imported = await typesense(`/collections/${collection}/documents/import?action=upsert`, true, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: documents.map(d => JSON.stringify(d)).join('\n') });
    if (!imported.ok) throw unavailable();
    const results = z.array(z.object({ success: z.literal(true) })).safeParse(lines(await imported.text()));
    if (!results.success || results.data.length !== documents.length) throw unavailable();
  }
  verify(await exported(collection), documents);
}
export async function indexCollections() {
  const roster = await participants();
  const demoFields = [{ name: 'name', type: 'string' }, ...['hall','tracking','visibility'].map(name => ({ name, type: 'string', facet: true })), { name: 'daysSinceWash', type: 'int32' }, ...['reminderConsent','synthetic'].map(name => ({ name, type: 'bool', facet: true }))];
  await sync(DEMO_COLLECTION, demoFields, roster.map(demoDocument));
  const halls = PURDUE_HALLS.map(({ slug, officialName, aliases, campus, housingType, term, active, laundryPaymentCategory }) => ({ id: slug, slug, officialName, aliases, campus, housingType, term, active, laundryPaymentCategory: laundryPaymentCategory ?? 'unknown' }));
  const housingFields = [{ name: 'slug', type: 'string' }, { name: 'officialName', type: 'string' }, { name: 'aliases', type: 'string[]' }, ...['campus','housingType','term','laundryPaymentCategory'].map(name => ({ name, type: 'string', facet: true })), { name: 'active', type: 'bool', facet: true }];
  await sync(HOUSING_COLLECTION, housingFields, halls);
  // Revalidate DB eligibility after network writes to purge mid-run withdrawals.
  const current = (await participants()).map(demoDocument);
  await removeStale(DEMO_COLLECTION, await exported(DEMO_COLLECTION), current);
  verify(await exported(DEMO_COLLECTION), current);
  verify(await exported(HOUSING_COLLECTION), halls);
  return { ok: true, collections: { [DEMO_COLLECTION]: current.length, [HOUSING_COLLECTION]: halls.length }, verified: true };
}
