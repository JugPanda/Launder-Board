import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import HomePage from '@/app/(public)/page';
import { proxy } from '@/proxy';
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
it('introduces the guest score-and-search game, not the old weekly cap', () => {
  render(<HomePage />);
  expect(screen.getByRole('link', { name: /view synthetic demo/i })).toHaveAttribute('href', '/demo');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Laundry. With a competitive streak.');
  expect(screen.getByText(/no account needed/i)).toBeVisible();
  expect(screen.queryByText(/one participation credit per week/i)).toBeNull();
});
it('keeps guest access independent of providers and private APIs protected', async () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', '');
  vi.stubEnv('LAUNDER_BOARD_DEMO_MODE', 'enabled');
  const guest = await proxy(new NextRequest('https://example.com/demo'));
  expect(guest.status).toBe(200);
  expect(guest.headers.get('location')).toBeNull();
  const login = await proxy(new NextRequest('https://example.com/sign-in'));
  expect(login.status).toBe(200);
  expect(login.headers.get('location')).toBeNull();
  for (const path of ['/dashboard', '/friends', '/activity/new', '/leaderboards/fall-weekly-quest']) {
    const old = await proxy(new NextRequest('https://example.com' + path));
    expect(old.headers.get('location')).toBe('https://example.com/demo');
  }
  const privateApi = await proxy(new NextRequest('https://example.com/api/me'));
  expect(privateApi.status).toBe(503);
});
