import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";


afterEach(cleanup);

import { SourceBadge } from "@/components/activity/source-badge";
import { TrackingState } from "@/components/activity/tracking-state";

describe("activity provenance UI", () => {
  it("never hides the simulated label behind its evidence label", () => {
    render(<SourceBadge source="synthetic_demo" evidenceLevel="user_supplied" />);
    expect(screen.getByText("Simulated CSC-format demo")).toBeInTheDocument();
    expect(screen.getByTitle(/User-supplied evidence/i)).toBeInTheDocument();
  });

  it("uses the complete user-file source label", () => {
    render(<SourceBadge source="user_file" evidenceLevel="user_supplied" />);
    expect(screen.getByText("User-supplied record")).toBeInTheDocument();
  });
});

describe("tracking state UI", () => {
  it.each([
    ["current", "Current"],
    ["partial", "Partial"],
    ["unknown", "Unknown"],
    ["stale", "Connection stale"],
  ] as const)("renders %s as a non-color status label", (state, label) => {
    render(<TrackingState state={state} />);
    expect(screen.getByRole("status")).toHaveAttribute("data-tracking-state", state);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText("Based on activity shared with Launder Board.")).toBeInTheDocument();
  });
});
