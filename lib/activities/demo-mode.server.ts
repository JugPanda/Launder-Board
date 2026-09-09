import "server-only";

/** Demo mode is intentionally server-only and requires an exact opt-in value. */
export function isSyntheticDemoModeEnabled(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  return environment.PAY2WIN_DEMO_MODE === "enabled";
}
