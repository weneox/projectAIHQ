import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import PublicWebsiteWidget from "../../pages/PublicWebsiteWidget.jsx";

function jsonResponse(payload = {}) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(payload),
  });
}

describe("PublicWebsiteWidget", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.restoreAllMocks();

    Object.defineProperty(window, "location", {
      configurable: true,
      value: new URL(
        "https://widget.example.com/public-widget?tenantKey=acme&widgetId=ww_test&origin=https%3A%2F%2Fwww.acme.com&brand=Acme"
      ),
    });

    global.fetch = vi.fn((url, options = {}) => {
      const method = String(options.method || "GET").toUpperCase();
      const target = String(url);

      if (method === "GET" && target.includes("/api/channels/webchat/bootstrap")) {
        return jsonResponse({
          ok: true,
          live: true,
          tenantKey: "acme",
          widgetId: "ww_test",
          origin: "https://www.acme.com",
          assistant: {
            title: "Acme Web Chat",
            subtitle: "Ask a question.",
            accentColor: "#0f172a",
            statusLabel: "Live",
            initialPrompts: ["Pricing", "Talk to sales"],
          },
          controls: {
            manualFirst: false,
            approvedTruthOnly: true,
            publicAnswering: true,
            approvedTruthReady: true,
            messageCaptureReady: true,
          },
        });
      }

      if (method === "POST" && target.includes("/api/channels/webchat/message")) {
        return jsonResponse({
          ok: true,
          received: true,
          live: true,
          sessionId: "web_test_session",
          threadId: "thread_test",
          messageId: "message_test",
          assistant: {
            mode: "approved_truth_answer",
            text: "Based on approved business information: Pricing starts after a short business fit review.",
            source: {
              title: "Pricing",
              type: "service_catalog",
            },
          },
        });
      }

      return jsonResponse({
        ok: false,
        live: false,
        reasonCode: "unexpected_request",
      });
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });

    vi.restoreAllMocks();
  });

  it("loads live bootstrap state and captures a visitor message", async () => {
    render(<PublicWebsiteWidget />);

    expect(screen.getByText(/loading website chat/i)).toBeInTheDocument();

    expect(await screen.findByText("Acme Web Chat")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Write your message");
    fireEvent.change(input, {
      target: {
        value: "Do you have pricing?",
      },
    });

    fireEvent.click(screen.getByLabelText("Send message"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/channels/webchat/message"),
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    expect(await screen.findByText("Do you have pricing?")).toBeInTheDocument();
    expect(
      await screen.findByText(
        "Based on approved business information: Pricing starts after a short business fit review."
      )
    ).toBeInTheDocument();

    const [, messageCall] = global.fetch.mock.calls;
    expect(await screen.findByText("Approved business info")).toBeInTheDocument();
    expect(await screen.findByText("Source: Pricing")).toBeInTheDocument();

    expect(JSON.parse(messageCall[1].body)).toMatchObject({
      tenantKey: "acme",
      widgetId: "ww_test",
      origin: "https://www.acme.com",
      text: "Do you have pricing?",
    });
  });
});
