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
  const originalHref = window.location.href;

  beforeEach(() => {
    vi.restoreAllMocks();

    window.history.pushState(
      {},
      "",
      "/widget/website-chat?widgetId=ww_test&bootstrapToken=boot_test&apiBase=https%3A%2F%2Fapi.example.com%2Fapi&brand=Acme&accent=%230f172a"
    );

    global.fetch = vi.fn((url, options = {}) => {
      const method = String(options.method || "GET").toUpperCase();
      const target = String(url);

      if (
        method === "POST" &&
        target === "https://api.example.com/api/public/widget/bootstrap"
      ) {
        return jsonResponse({
          ok: true,
          sessionToken: "session_test",
          session: {
            sessionId: "web_test_session",
            widgetId: "ww_test",
          },
          widget: {
            title: "Acme Web Chat",
            subtitle: "Ask a question.",
            accentColor: "#0f172a",
            initialPrompts: ["Pricing", "Talk to sales"],
          },
          automation: {
            available: true,
            mode: "assistant_available",
          },
          messages: [],
          delivery: {
            mode: "awaiting_reply",
          },
        });
      }

      if (
        method === "POST" &&
        target === "https://api.example.com/api/public/widget/message"
      ) {
        return jsonResponse({
          ok: true,
          sessionToken: "session_next",
          thread: {
            id: "thread_test",
            channel: "website",
          },
          messages: [
            {
              id: "message_test",
              direction: "inbound",
              role: "visitor",
              text: "Do you have pricing?",
            },
            {
              id: "reply_test",
              direction: "outbound",
              role: "assistant",
              text: "Based on approved business information: Pricing starts after a short business fit review.",
              mode: "approved_truth_answer",
              source: {
                title: "Pricing",
                type: "service_catalog",
              },
            },
          ],
          delivery: {
            mode: "assistant_replied",
          },
        });
      }

      if (
        method === "POST" &&
        target === "https://api.example.com/api/public/widget/transcript"
      ) {
        return jsonResponse({
          ok: true,
          sessionToken: "session_transcript",
          thread: {
            id: "thread_test",
            channel: "website",
          },
          messages: [
            {
              id: "message_test",
              direction: "inbound",
              role: "visitor",
              text: "Do you have pricing?",
            },
            {
              id: "reply_test",
              direction: "outbound",
              role: "assistant",
              text: "Based on approved business information: Pricing starts after a short business fit review.",
              mode: "approved_truth_answer",
              source: {
                title: "Pricing",
                type: "service_catalog",
              },
            },
          ],
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
    window.history.pushState({}, "", originalHref);

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
        "https://api.example.com/api/public/widget/message",
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

    expect(await screen.findByText("Approved business info")).toBeInTheDocument();
    expect(await screen.findByText("Source: Pricing")).toBeInTheDocument();

    const [bootstrapCall, messageCall, transcriptCall] = global.fetch.mock.calls;
    expect(bootstrapCall[0]).toBe(
      "https://api.example.com/api/public/widget/bootstrap"
    );
    expect(JSON.parse(bootstrapCall[1].body)).toEqual({
      widgetId: "ww_test",
      bootstrapToken: "boot_test",
    });
    expect(JSON.parse(messageCall[1].body)).toMatchObject({
      sessionToken: "session_test",
      text: "Do you have pricing?",
    });
    expect(JSON.parse(messageCall[1].body)).not.toHaveProperty("tenantKey");
    expect(JSON.parse(messageCall[1].body)).not.toHaveProperty("origin");
    expect(transcriptCall[0]).toBe(
      "https://api.example.com/api/public/widget/transcript"
    );
    expect(JSON.parse(transcriptCall[1].body)).toEqual({
      sessionToken: "session_next",
    });
  });
});
