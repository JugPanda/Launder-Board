import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { bootstrap, DemoError, mutate, openSession, sessionId } from './repository.server';
import { filtersSchema, indexCollections, searchParticipants } from './search.server';
import { presentationSessionHash, provisionPresentationAccount } from './account.server';
const COOKIE = 'laundrostat_demo';
const MAX_BODY = 1024;
const empty = z.object({}).strict();
const postSchema = z.object({ preset: z.literal('fresh_start') }).strict();
const nudgeSchema = z.object({ recipientId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/), preset: z.literal('fresh_start') }).strict();
function cookieToken(request: Request): string | undefined {
  const matches = (request.headers.get('cookie') || '').split(';').map(v => v.trim()).filter(v => v.startsWith(`${COOKIE}=`));
  if (matches.length !== 1) return undefined;
  const value = matches[0].slice(COOKIE.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
function cookie(value: string, reset = false) { return `${COOKIE}=${value}; Path=/api/demo; Max-Age=${reset ? 0 : 604800}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`; }
function json(data: unknown, status = 200, setCookie?: string) { return Response.json(data, { status, headers: { 'Cache-Control': 'no-store, private', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff', ...(setCookie ? { 'Set-Cookie': setCookie } : {}) } }); }
function origin(request: Request) {
  const internal = new URL(request.url);
  // Next's proxy may normalize request.url to localhost; Host retains the browser destination.
  const host = request.headers.get('host') || internal.host;
  const forwarded = process.env.VERCEL === '1' ? request.headers.get('x-forwarded-proto') : null;
  const protocol = forwarded === 'https' || forwarded === 'http' ? `${forwarded}:` : internal.protocol;
  const expected = `${protocol}//${host}`;
  if (request.headers.get('origin') !== expected || request.headers.get('sec-fetch-site') === 'cross-site') throw new DemoError(403, 'invalid_origin');
}
async function body(request: Request): Promise<unknown> {
  if (!/^application\/json(?:\s*;.*)?$/i.test(request.headers.get('content-type') || '')) throw new DemoError(415, 'json_required');
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY)) throw new DemoError(413, 'body_too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new DemoError(400, 'invalid_body');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const chunk = await reader.read(); if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > MAX_BODY) { await reader.cancel(); throw new DemoError(413, 'body_too_large'); }
    chunks.push(chunk.value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new DemoError(400, 'invalid_body'); }
}
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new DemoError(400, 'invalid_request');
  return result.data;
}
type Action = 'bootstrap' | 'session' | 'search' | 'nudges' | 'posts' | 'reset' | 'index' | 'presentation-account';
export function handler(action: Action) {
  return async (request: Request): Promise<Response> => {
    try {
      if (action === 'index' || action === 'presentation-account') {
        const secret = process.env.DEMO_INDEX_SECRET;
        const authorization = request.headers.get('authorization') || '';
        const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
        if (!secret || !supplied || !timingSafeEqual(createHash('sha256').update(secret).digest(), createHash('sha256').update(supplied).digest())) throw new DemoError(401, 'unauthorized');
        // Bearer-only operational endpoint, never cookie-authorized.
        origin(request);
        parse(empty, await body(request));
        return json(action === 'index' ? await indexCollections() : await provisionPresentationAccount());
      }
      if (action === 'session' || action === 'nudges' || action === 'posts' || action === 'reset') origin(request);
      const token = cookieToken(request);
      const accountHash = action === 'search' ? null : await presentationSessionHash(request);
      const ownerHash = accountHash ?? (token ? digest(token) : undefined);
      if (action === 'bootstrap') return json(await bootstrap(ownerHash));
      if (action === 'search') {
        const values: Record<string, string> = Object.create(null);
        for (const [key, value] of new URL(request.url).searchParams) {
          if (Object.hasOwn(values, key)) throw new DemoError(400, 'invalid_request');
          values[key] = value;
        }
        return json(await searchParticipants(parse(filtersSchema, values)));
      }
      const input = await body(request);
      if (action === 'session') {
        parse(empty, input);
        if (accountHash) {
          await openSession(accountHash);
          return json(await bootstrap(accountHash), 200, cookie('', true));
        }
        // Random cookie values only: session IDs never cross the boundary.
        const existing = token ? await sessionId(digest(token)) : null;
        const nextToken = existing && token ? token : randomBytes(32).toString('hex');
        await openSession(digest(nextToken));
        return json(await bootstrap(digest(nextToken)), 200, cookie(nextToken));
      }
      const payload = action === 'nudges' ? parse(nudgeSchema, input) : action === 'posts' ? parse(postSchema, input) : parse(empty, input);
      if (!ownerHash) throw new DemoError(401, 'invalid_session');
      const result = await mutate(ownerHash, action, 'recipientId' in payload ? payload.recipientId as string : undefined);
      return json(result, 200, action === 'reset' ? cookie('', true) : undefined);
    } catch (error) {
      // Provider errors, Zod diagnostics and credentials never reach clients or logs.
      return error instanceof DemoError ? json({ ok: false, code: error.code }, error.status) : json({ ok: false, code: 'provider_unavailable' }, 503);
    }
  };
}
