import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SettingsSurfaceBanner from "./SettingsSurfaceBanner.jsx";

afterEach(() => {
  cleanup();
});

describe("SettingsSurfaceBanner", () => {
  it("renders save feedback and unavailable refresh affordances consistently", () => {
    const refresh = vi.fn();

    render(
      <SettingsSurfaceBanner
        surface={{
          saveSuccess: "Saved cleanly.",
          saveError: "",
          error: "",
          unavailable: true,
          loading: false,
          saving: false,
          refresh,
        }}
        unavailableMessage="Surface unavailable."
        refreshLabel="Retry"
      />
    );

    expect(screen.getByText(/saved cleanly/i)).toBeInTheDocument();
    expect(screen.getByText(/surface unavailable/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
