import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import InboxThreadListPanel from "../../../components/inbox/InboxThreadListPanel.jsx";

function buildThreadList(overrides = {}) {
  return {
    filter: "all",
    setFilter: vi.fn(),
    deepLinkNotice: "Opened from a saved thread link.",
    filteredThreads: [
      {
        id: "thread-1",
        customer_name: "Alex",
        channel_label: "Conversation",
        channel_type: "instagram",
        provider: "meta",
        last_message_text: "Need help with booking",
        status: "open",
      },
      {
        id: "thread-2",
        customer_name: "Blair",
        channel_label: "Conversation",
        channel_type: "facebook",
        provider: "meta",
        last_message_text: "Following up on my request",
        status: "open",
      },
    ],
    openThread: vi.fn(),
    surface: {
      loading: false,
      error: "",
      unavailable: false,
      ready: true,
      refresh: vi.fn(),
    },
    ...overrides,
  };
}

describe("InboxThreadListPanel", () => {
  it("renders explicit thread list surface data", () => {
    const threadList = buildThreadList();

    render(
      <InboxThreadListPanel
        threadList={threadList}
        selectedThreadId="thread-2"
        searchQuery=""
      />
    );

    expect(
      screen.getByRole("heading", { name: /all conversations/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /^all conversations$/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /search conversations/i })
    ).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /primary/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /general/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /requests/i })).toBeInTheDocument();

    expect(screen.getByText(/alex/i)).toBeInTheDocument();
    expect(screen.getByText(/blair/i)).toBeInTheDocument();
    expect(screen.getByText(/need help with booking/i)).toBeInTheDocument();
    expect(screen.getByText(/following up on my request/i)).toBeInTheDocument();
    expect(screen.getByText(/opened from a saved thread link/i)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /search conversations/i })
    );

    expect(
      screen.getByRole("textbox", { name: /search conversations/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /blair/i }));
    expect(threadList.openThread).toHaveBeenCalledTimes(1);
    expect(threadList.openThread).toHaveBeenCalledWith(
      expect.objectContaining({ id: "thread-2" })
    );
  });

  it("labels web channel threads as website conversations in the channel menu", () => {
    const threadList = buildThreadList({
      deepLinkNotice: "",
      filteredThreads: [
        {
          id: "thread-web",
          customer_name: "Taylor",
          channel: "web",
          channel_type: "web",
          provider: "web",
          last_message_text: "I found you on the pricing page",
          status: "open",
        },
      ],
    });

    render(
      <InboxThreadListPanel
        threadList={threadList}
        selectedThreadId=""
        searchQuery=""
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /^all conversations$/i })
    );

    expect(screen.getByText("Website")).toBeInTheDocument();
  });
});