import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../components/inbox/InboxThreadCard.jsx", () => ({
  default: ({ thread, selected, onOpen }) => (
    <button
      type="button"
      data-selected={selected ? "yes" : "no"}
      data-testid={`thread-card-${thread.id}`}
      onClick={() => onOpen?.(thread.id)}
    >
      {thread.customer_name || thread.external_username || thread.id}
    </button>
  ),
}));

vi.mock("../../../components/inbox/InboxLoadingSurface.jsx", () => ({
  InboxThreadListSkeleton: () => <div>loading-skeleton</div>,
}));

import InboxThreadListPanel from "../../../components/inbox/InboxThreadListPanel.jsx";

function buildThread(overrides = {}) {
  return {
    id: overrides.id || "thread_1",
    customer_name: overrides.customer_name || "Taylor",
    external_username: overrides.external_username || "",
    external_user_id: overrides.external_user_id || "",
    last_message_text: overrides.last_message_text || "",
    assigned_to: overrides.assigned_to || "",
    channel: overrides.channel || "instagram",
    channel_type: overrides.channel_type || overrides.channel || "instagram",
    provider: overrides.provider || "",
    source_type: overrides.source_type || "",
    ...overrides,
  };
}

function buildThreadList(overrides = {}) {
  return {
    filter: "all",
    setFilter: vi.fn(),
    deepLinkNotice: "",
    filteredThreads: [],
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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens search with slash when focus is not in a typing field", async () => {
    render(
      <InboxThreadListPanel
        threadList={buildThreadList({
          filteredThreads: [buildThread({ id: "t1", customer_name: "Taylor" })],
        })}
        selectedThreadId=""
        searchQuery=""
      />
    );

    fireEvent.keyDown(window, { key: "/" });

    const input = screen.getByRole("textbox", {
      name: /search conversations/i,
    });

    await waitFor(() => {
      expect(input).toHaveFocus();
    });
  });

  it("opens search with ctrl/cmd+k", async () => {
    render(
      <InboxThreadListPanel
        threadList={buildThreadList({
          filteredThreads: [buildThread({ id: "t1", customer_name: "Taylor" })],
        })}
        selectedThreadId=""
        searchQuery=""
      />
    );

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    const input = screen.getByRole("textbox", {
      name: /search conversations/i,
    });

    await waitFor(() => {
      expect(input).toHaveFocus();
    });
  });

  it("keeps the selected thread visible even when current search would otherwise hide it", () => {
    const selectedThread = buildThread({
      id: "selected_1",
      customer_name: "Visible Selected",
      channel: "instagram",
      channel_type: "instagram",
      last_message_text: "hello",
    });

    const otherThread = buildThread({
      id: "other_1",
      customer_name: "Search Match",
      channel: "instagram",
      channel_type: "instagram",
      last_message_text: "banana",
    });

    render(
      <InboxThreadListPanel
        threadList={buildThreadList({
          filteredThreads: [selectedThread, otherThread],
        })}
        selectedThreadId="selected_1"
        searchQuery=""
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /search conversations/i })
    );

    const input = screen.getByRole("textbox", {
      name: /search conversations/i,
    });

    fireEvent.change(input, { target: { value: "banana" } });

    expect(screen.getByTestId("thread-card-selected_1")).toBeInTheDocument();
    expect(screen.getByTestId("thread-card-other_1")).toBeInTheDocument();
    expect(screen.getByTestId("thread-card-selected_1")).toHaveAttribute(
      "data-selected",
      "yes"
    );
  });

  it("filters by channel from the menu", () => {
    const websiteThread = buildThread({
      id: "web_1",
      customer_name: "Website lead",
      channel: "website",
      channel_type: "website",
    });

    const telegramThread = buildThread({
      id: "tg_1",
      customer_name: "Telegram lead",
      channel: "telegram",
      channel_type: "telegram",
    });

    render(
      <InboxThreadListPanel
        threadList={buildThreadList({
          filteredThreads: [websiteThread, telegramThread],
        })}
        selectedThreadId=""
        searchQuery=""
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /all conversations/i })
    );

    const telegramOptionText = screen.getByText(/^Telegram$/i);
    fireEvent.click(telegramOptionText.closest("button"));

    expect(screen.queryByTestId("thread-card-web_1")).not.toBeInTheDocument();
    expect(screen.getByTestId("thread-card-tg_1")).toBeInTheDocument();
  });
});