import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("defines brief purpose-driven motion with a reduced-motion escape hatch", () => {
  const globalCss = readFileSync("app/globals.css", "utf8");
  const demoCss = readFileSync("components/guest-demo/GuestDemo.module.css", "utf8");

  expect(globalCss).toMatch(/\.motion-rise/);
  expect(globalCss).toMatch(/@keyframes\s+rise-in/);
  expect(globalCss).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*animation-duration:\s*0\.01ms/);
  expect(demoCss).toMatch(/\.panel\{[^}]*animation:guestPanelEnter/);
  expect(demoCss).toMatch(/@keyframes guestPanelEnter/);
});
