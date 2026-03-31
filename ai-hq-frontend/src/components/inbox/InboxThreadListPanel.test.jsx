import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import InboxThreadListPanel from "./InboxThreadListPanel.jsx";

describe("InboxThreadListPanel", () => {
  it("renders explicit thread list surface data", () => {
    const setFilter = vi.fn();
    const openThread = vi.fn();

    render(
      <InboxThreadListPanel
        selectedThreadId="thread-2"
        threadList={{
          filter: "all",
          setFilter,
          deepLinkNotice: "The requested inbox thread is no longer available.",
          stats: { open: 1, aiActive: 2, handoff: 3, resolved: 4 },
          filteredThreads: [
            {
              id: "thread-1",
              customer_name: "Alex",
              channel: "instagram",
              last_message_text: "Need help with booking",
              status: "open",
              handoff_active: false,
            },
            {
              id: "thread-2",
              customer_name: "Blair",
              channel: "instagram",
              last_message_text: "Following up on my request",
              status: "resolved",
              handoff_active: false,
            },
          ],
          openThread,
          surface: { loading: false },
        }}
      />
    );

    expect(
      screen.getByText(/requested inbox thread is no longer available/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /all conversations/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /primary/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /general/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: /requests/i })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(
      screen.getByRole("button", { name: /open conversation filters/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /search conversations/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /requests/i }));
    expect(setFilter).toHaveBeenCalledWith("handoff");

    fireEvent.click(screen.getByRole("button", { name: /blair/i }));
    expect(openThread).toHaveBeenCalledWith(
      expect.objectContaining({ id: "thread-2", customer_name: "Blair" })
    );
  });
});
