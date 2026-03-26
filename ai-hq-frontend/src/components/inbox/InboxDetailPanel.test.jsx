import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import InboxDetailPanel from "./InboxDetailPanel.jsx";

describe("InboxDetailPanel", () => {
  it("renders explicit detail surface feedback", () => {
    render(
      <InboxDetailPanel
        selectedThread={{ id: "thread-1", status: "open", labels: [], unread_count: 1 }}
        messages={[]}
        surface={{
          loading: false,
          error: "",
          unavailable: false,
          ready: true,
          saving: false,
          saveError: "",
          saveSuccess: "Thread assigned.",
          refresh: vi.fn(),
        }}
        actionState={{ isActionPending: vi.fn().mockReturnValue(false) }}
        markRead={vi.fn()}
        assignThread={vi.fn()}
        activateHandoff={vi.fn()}
        releaseHandoff={vi.fn()}
        setThreadStatus={vi.fn()}
      />
    );

    expect(screen.getByText(/thread assigned/i)).toBeInTheDocument();
    expect(screen.getByText(/conversation detail/i)).toBeInTheDocument();
  });
});
