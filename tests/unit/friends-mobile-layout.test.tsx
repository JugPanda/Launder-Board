import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import FriendsPage from "@/app/(app)/friends/page";

describe("friends mobile layout", () => {
  it("allows the encouragement controls and grid columns to shrink to the viewport", () => {
    const { container } = render(<FriendsPage />);

    expect(container.querySelector(".mt-6.grid")).toHaveClass("min-w-0");
    expect(screen.getByRole("combobox", { name: /encouragement for noah/i })).toHaveClass(
      "min-w-0",
      "w-full",
      "max-w-full",
    );
  });
});
