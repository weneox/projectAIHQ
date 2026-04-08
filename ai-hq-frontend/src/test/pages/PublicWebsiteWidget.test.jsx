import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PublicWebsiteWidget from "../../pages/PublicWebsiteWidget.jsx";

describe("PublicWebsiteWidget", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(
      {},
      "",
      "/widget/website-chat?tenantKey=acme&pageUrl=https%3A%2F%2Facme.example%2Fpricing&pageTitle=Pricing"
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("bootstraps the public widget and shows honest automation status", async () => {
    vi.spyOn(window, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        sessionToken: "session-1",
        widget: {
          title: "Acme Clinic",
          subtitle: "Leave a message here and the team can take over.",
        },
        automation: {
          available: false,
          mode: "blocked_until_repair",
          summary:
            "AI replies are unavailable until approved truth and runtime authority are ready.",
        },
        thread: null,
        messages: [],
      }),
    });

    render(<PublicWebsiteWidget />);

    expect(await screen.findByText("Acme Clinic")).toBeInTheDocument();
    expect(screen.getByText(/ai unavailable/i)).toBeInTheDocument();
    expect(
      screen.getByText(/approved truth and runtime authority are ready/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(window.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/public/widget/bootstrap"),
        expect.objectContaining({
          method: "POST",
          credentials: "omit",
        })
      );
    });
  });
});
