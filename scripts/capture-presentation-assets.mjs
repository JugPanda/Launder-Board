import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const out = resolve("presentation/assets");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

try {
  await page.goto("https://laundrostat.vercel.app/", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/landing.png` });

  await page.goto("https://laundrostat.vercel.app/demo", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Meet your Clean-O-Meter." }).waitFor();
  const panel = page.locator('[role="tabpanel"]');
  await panel.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/overview.png` });

  for (const [label, name, heading] of [
    ["Search", "search", "Time for a fresh start?"],
    ["Wash Mates", "wash-mates", "Find your Wash Mate."],
    ["Leaderboards", "leaderboards", "Two squads. Same friendly competition."],
    ["Community", "community", "Small wins. Shared routines."],
  ]) {
    await page.getByRole("tab", { name: label, exact: true }).click();
    await page.getByRole("heading", { name: heading, exact: true }).waitFor();
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${out}/${name}.png` });
  }
} finally {
  await browser.close();
}
