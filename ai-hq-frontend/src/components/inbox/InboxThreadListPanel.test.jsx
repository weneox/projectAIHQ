import { fireEvent, render, screen, within } from "@testing-library/react";
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
              contact_name: "A",
              status: "open",
              handoff_active: false,
            },
            {
              id: "thread-2",
              contact_name: "B",
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

    const openThreadsBlock = screen.getByText(/^open threads$/i).parentElement;
    expect(openThreadsBlock).not.toBeNull();

    const statsGrid = openThreadsBlock?.parentElement;
    expect(statsGrid).not.toBeNull();

    const statsScope = within(statsGrid);

    const aiActiveBlock = statsScope.getByText(/^ai active$/i).parentElement;
    const handoffBlock = statsScope.getByText(/^handoff$/i).parentElement;

    expect(aiActiveBlock).not.toBeNull();
    expect(handoffBlock).not.toBeNull();

    expect(within(openThreadsBlock).getByText("1")).toBeInTheDocument();
    expect(within(aiActiveBlock).getByText("2")).toBeInTheDocument();
    expect(within(handoffBlock).getByText("3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "resolved" }));
    expect(setFilter).toHaveBeenCalledWith("resolved");

    fireEvent.click(screen.getAllByRole("button", { name: /open/i })[1]);
    expect(openThread).toHaveBeenCalled();
  });
});