import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SurfaceBanner from "../../../components/feedback/SurfaceBanner.jsx";

afterEach(() => {
  cleanup();
});

describe("SurfaceBanner", () => {
  it("renders floating overlay notifications with compact copy and refresh support", () => {
    const refresh = vi.fn();

    render(
      <SurfaceBanner
        surface={{
          saveSuccess: "Saved cleanly.",
          message: "Heads up.",
          saveError: "",
          error: "",
          unavailable: true,
          loading: false,
          saving: false,
          refresh,
        }}
        unavailableMessage="Inbox operations are temporarily unavailable."
        refreshLabel="Refresh"
      />
    );

    const overlayRoot = document.getElementById("surface-banner-root");
    expect(overlayRoot).toBeTruthy();
    expect(overlayRoot).toHaveClass("fixed");

    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Heads up")).toBeInTheDocument();
    expect(screen.getByText("Inbox unavailable")).toBeInTheDocument();
    expect(screen.getByText(/inbox operations are temporarily unavailable/i)).toHaveClass("sr-only");

    fireEvent.click(screen.getByRole("button", { name: /^refresh$/i }));
    expect(refresh).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /dismiss inbox unavailable/i }));
  });
});
