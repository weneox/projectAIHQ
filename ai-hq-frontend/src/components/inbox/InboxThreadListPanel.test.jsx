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
    expect(screen.getByRole("button", { name: /all 2/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: /assigned 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mentions 3/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /drafts 4/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /drafts 4/i }));
    expect(setFilter).toHaveBeenCalledWith("resolved");

    fireEvent.click(screen.getByRole("button", { name: /blair/i }));
    expect(openThread).toHaveBeenCalledWith(
      expect.objectContaining({ id: "thread-2", customer_name: "Blair" })
    );
  });
});
