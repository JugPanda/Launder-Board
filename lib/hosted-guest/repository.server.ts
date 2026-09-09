import 'server-only';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin.server';
import { cleanScore, type GuestParticipant } from '@/lib/guest-demo';

export const AS_OF = '2026-09-08';
export class DemoError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
export const unavailable = () => new DemoError(503, 'provider_unavailable');
const rowSchema = z.object({
  id: z.string().min(1).max(100), display_name: z.string().min(1).max(100),
  hall: z.enum(['Earhart Hall', 'Harrison Hall', 'Shreve Hall']),
  days_since_wash: z.number().int().nonnegative(), tracking_state: z.literal('current'),
  visibility: z.enum(['public','friends']), reminder_consent: z.literal(true), synthetic: z.literal(true),
  scrub_streak: z.number().int().nonnegative(), last_full_cycle_date: z.string().nullable(),
  source_label: z.enum(['Simulated CSC-format demo', 'Self-reported demo']),
  usual_days: z.array(z.string()), usual_time_window: z.string(), as_of: z.literal(AS_OF),
});
const columns = 'id,display_name,hall,days_since_wash,tracking_state,visibility,reminder_consent,synthetic,scrub_streak,last_full_cycle_date,source_label,usual_days,usual_time_window,as_of';
export async function participants(ids?: string[]): Promise<GuestParticipant[]> {
  if (ids?.length === 0) return [];
  let query = createAdminClient().from('demo_participants').select(columns)
    .eq('synthetic', true).eq('tracking_state', 'current').eq('reminder_consent', true)
    .in('visibility', ['public','friends']).eq('as_of', AS_OF).gte('days_since_wash', 0);
  if (ids) query = query.in('id', ids);
  const { data, error } = await query.order('id');
  if (error || !Array.isArray(data)) throw unavailable();
  return data.map(value => {
    const parsed = rowSchema.safeParse(value);
    if (!parsed.success) throw unavailable();
    const r = parsed.data;
    return { id: r.id, name: r.display_name, hall: r.hall, daysSinceWash: r.days_since_wash,
      tracking: r.tracking_state, visibility: r.visibility, reminderConsent: 'demo-assumed',
      score: cleanScore(r.days_since_wash, r.scrub_streak), scrubStreak: r.scrub_streak,
      lastFullCycleDate: r.last_full_cycle_date, source: r.source_label, usualDays: r.usual_days,
      usualTimeWindow: r.usual_time_window,
      scenarioLabel: 'Synthetic hosted scenario; generated schedule and source labels, no verified CSC data',
      scoreBasis: { label: 'Not used: hosted Clean-O-Meter uses database recency and streak only', loads: [], scoreBeforeInactivity: 0 },
    };
  });
}
export async function sessionId(hash: string): Promise<string | null> {
  const { data, error } = await createAdminClient().from('demo_sessions').select('id')
    .eq('token_hash', hash).gt('expires_at', new Date().toISOString()).limit(1);
  if (error || !Array.isArray(data)) throw unavailable();
  if (!data.length) return null;
  const parsed = z.uuid().safeParse(data[0].id);
  if (!parsed.success) throw unavailable();
  return parsed.data;
}
export async function openSession(hash: string) {
  const { data, error } = await createAdminClient().rpc('demo_open_session', { p_token_hash: hash });
  if (error || !z.uuid().safeParse(data).success) throw unavailable();
}
export async function bootstrap(hash?: string) {
  const roster = await participants();
  const id = hash ? await sessionId(hash) : null;
  let nudgedIds: string[] = [];
  let posts: { id: string; preset: 'fresh_start'; createdAt: string }[] = [];
  if (id) {
    const db = createAdminClient();
    const [nudgesResult, postsResult] = await Promise.all([
      db.from('demo_nudges').select('recipient_id').eq('session_id', id).gt('created_at', new Date(Date.now() - 72 * 3600000).toISOString()).order('created_at').limit(100),
      db.from('demo_posts').select('id,preset,created_at').eq('session_id', id).order('created_at').limit(100),
    ]);
    if (nudgesResult.error || postsResult.error) throw unavailable();
    const nudges = z.array(z.object({ recipient_id: z.string() })).safeParse(nudgesResult.data);
    const savedPosts = z.array(z.object({ id: z.string(), preset: z.literal('fresh_start'), created_at: z.string() })).safeParse(postsResult.data);
    if (!nudges.success || !savedPosts.success) throw unavailable();
    const eligible = new Set(roster.map(p => p.id));
    nudgedIds = [...new Set(nudges.data.map(n => n.recipient_id).filter(id => eligible.has(id)))];
    posts = savedPosts.data.map(p => ({ id: p.id, preset: p.preset, createdAt: p.created_at }));
  }
  return { participants: roster, nudgedIds, posts, providers: { database: 'supabase', search: 'typesense' }, asOf: AS_OF };
}
export async function mutate(hash: string, kind: 'nudges' | 'posts' | 'reset', recipientId?: string) {
  if (!await sessionId(hash)) throw new DemoError(401, 'invalid_session');
  const name = kind === 'nudges' ? 'demo_save_nudge' : kind === 'posts' ? 'demo_save_post' : 'demo_reset_session';
  const args = { p_token_hash: hash, ...(kind === 'reset' ? {} : { p_preset: 'fresh_start' }), ...(kind === 'nudges' ? { p_recipient_id: recipientId } : {}) };
  const { data, error } = await createAdminClient().rpc(name, args);
  if (error) throw unavailable();
  if (kind === 'reset') return { ok: true, code: 'reset' };
  const result = z.object({ ok: z.boolean(), code: z.string().optional() }).safeParse(data);
  if (!result.success) throw unavailable();
  if (result.data.ok) return { ok: true, code: result.data.code === 'already_saved' ? 'already_saved' : 'saved' };
  const code = result.data.code;
  if (!code || !['invalid_session','ineligible','cooldown','daily_limit','invalid_preset','already_saved'].includes(code)) throw unavailable();
  throw new DemoError(code === 'invalid_session' ? 401 : code === 'invalid_preset' ? 400 : code === 'cooldown' || code === 'daily_limit' ? 429 : 409, code);
}
