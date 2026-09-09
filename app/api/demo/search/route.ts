import { handler } from '@/lib/hosted-guest/api.server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = handler('search');
