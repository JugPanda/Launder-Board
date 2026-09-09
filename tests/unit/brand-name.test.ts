import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const brandedFiles = [
  "README.md",
  "app/(public)/purdue/halls/page.tsx",
  "docs/supabase-setup.md",
  "app/layout.tsx",
  "app/(public)/page.tsx",
  "app/(auth)/sign-in/page.tsx",
  "components/navigation/AppNavigation.tsx",
  "components/demo/PublicDemoShell.tsx",
  "components/activity/tracking-state.tsx",
  "app/(app)/activity/page.tsx",
  "app/(app)/friends/page.tsx",
  "docs/design-system.md",
  "docs/demo-script.md",
  "docs/product-rules.md",
];

describe("LaundroStat brand contract", () => {
  it.each(brandedFiles)("uses the chosen name in %s", (path) => {
    const source = read(path);
    expect(source).toContain("LaundroStat");
    expect(source).not.toMatch(/pay2win|Launder Board/i);
  });

  it("uses deployment-safe internal names", () => {
    expect(JSON.parse(read("package.json")).name).toBe("launder-board");
    expect(JSON.parse(read("package-lock.json")).name).toBe("launder-board");
    expect(read("supabase/config.toml")).toContain('project_id = "launder-board"');
    expect(read(".env.example")).toContain("LAUNDER_BOARD_DEMO_MODE=disabled");
    expect(read(".env.example")).not.toContain("PAY2WIN_DEMO_MODE");
  });
});
