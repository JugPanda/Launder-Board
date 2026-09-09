import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import HomePage from '@/app/(public)/page';
afterEach(cleanup);
it('introduces the actual creators with the supplied uncropped laundry-room photo', () => {
  render(<HomePage />);
  expect(screen.getByRole('heading', { name: 'Meet the creators.' })).toBeVisible();
  const photo = screen.getByRole('img', { name: 'The four LaundroStat creators together in a laundry room' });
  expect(photo).toHaveAttribute('width', '1280');
  expect(photo).toHaveAttribute('height', '960');
  expect(photo.getAttribute('src')).toContain('laundrostat-creators');
  expect(photo).toHaveClass('h-auto');
});
it.each(['GuestDemo', 'SquadRankings'])('%s uses a readable small-text floor, including mobile overrides', (name) => {
  const css = readFileSync(`components/guest-demo/${name}.module.css`, 'utf8');
  const sizes = [...css.matchAll(/font-size:\s*([\d.]+)(px|rem)/g)].map((m) => Number(m[1]) * (m[2] === 'rem' ? 16 : 1));
  expect(sizes.length).toBeGreaterThan(10);
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(14);
});
it('uses system UI typography and sixteen-pixel dashboard form controls', () => {
  const css = readFileSync('components/guest-demo/GuestDemo.module.css', 'utf8');
  expect(css).toMatch(/font-family:system-ui/);
  expect(css).toMatch(/\.filters input,\.filters select\{[^}]*font-size:1rem/);
  expect(css).toMatch(/\.profileSelect select\{[^}]*font-size:1rem/);
});
