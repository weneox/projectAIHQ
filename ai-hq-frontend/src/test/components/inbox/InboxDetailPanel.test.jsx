import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import InboxDetailPanel from "../../../components/inbox/InboxDetailPanel.jsx";

describe("InboxDetailPanel", () => {
  it("renders actionable conversation detail semantics and delivery truth", () => {
    const markRead = vi.fn();
    const assignThread = vi.fn();
    const activateHandoff = vi.fn();
    const setThreadStatus = vi.fn();
    const onOpenDetails = vi.fn();

    render(
      <InboxDetailPanel
        selectedThread={{
          id: "thread-1",
          customer_name: "Alex Morgan",
          external_username: "alexm",
          assigned_to: "Jamie",
          unread_count: 1,
          handoff_active: false,
        }}
        messages={[
          {
            id: "msg-1",
            direction: "outbound",
            sender_type: "agent",
            text: "Your appointment request is on the way.",
            sent_at: "2026-03-29T08:00:00.000Z",
            outbound_attempt_correlation: "corr-1",
          },
        ]}
        outboundAttempts={[
          {
            id: "attempt-1",
            status: "failed",
            attempt_count: 1,
            max_attempts: 3,
            provider: "meta",
            updated_at: "2026-03-29T08:05:00.000Z",
            message_correlation: "corr-1",
          },
        ]}
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
        markRead={markRead}
        assignThread={assignThread}
        activateHandoff={activateHandoff}
        setThreadStatus={setThreadStatus}
        onOpenDetails={onOpenDetails}
        composer={<div>Composer slot</div>}
      />
    );

    expect(screen.getByText(/thread assigned/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refresh conversation/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open conversation details/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open detail drawer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /conversation actions/i })).toBeInTheDocument();
    expect(screen.getByText(/composer slot/i)).toBeInTheDocument();
    expect(screen.getAllByText(/failed/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/most recent delivery attempt failed on attempt 1 of 3/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open conversation details/i }));
    fireEvent.click(screen.getByRole("button", { name: /open detail drawer/i }));
    fireEvent.click(screen.getByRole("button", { name: /conversation actions/i }));
    expect(screen.getByRole("button", { name: /mark as read/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^assign$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start handoff/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^resolve$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^close$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /mark as read/i }));
    fireEvent.click(screen.getByRole("button", { name: /conversation actions/i }));
    fireEvent.click(screen.getByRole("button", { name: /^assign$/i }));
    fireEvent.click(screen.getByRole("button", { name: /conversation actions/i }));
    fireEvent.click(screen.getByRole("button", { name: /start handoff/i }));
    fireEvent.click(screen.getByRole("button", { name: /conversation actions/i }));
    fireEvent.click(screen.getByRole("button", { name: /^resolve$/i }));
    fireEvent.click(screen.getByRole("button", { name: /conversation actions/i }));
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));

    expect(assignThread).toHaveBeenCalledWith("thread-1");
    expect(markRead).toHaveBeenCalledWith("thread-1");
    expect(activateHandoff).toHaveBeenCalledWith("thread-1");
    expect(setThreadStatus).toHaveBeenCalledWith("thread-1", "resolved");
    expect(setThreadStatus).toHaveBeenCalledWith("thread-1", "closed");
    expect(onOpenDetails).toHaveBeenCalledTimes(2);
  });

  it("renders object-shaped outbound lineage truth without changing detail behavior", () => {
    render(
      <InboxDetailPanel
        selectedThread={{
          id: "thread-2",
          customer_name: "Alex Morgan",
          unread_count: 0,
          handoff_active: false,
        }}
        messages={[
          {
            id: "msg-2",
            direction: "outbound",
            sender_type: "agent",
            text: "Your follow-up is retrying.",
            sent_at: "2026-03-29T08:00:00.000Z",
            outbound_attempt_correlation: {
              message_id: "msg-2",
              provider_message_id: "provider-2",
              type: "outbound_attempt",
            },
          },
        ]}
        outboundAttempts={[
          {
            id: "attempt-2",
            status: "retrying",
            attempt_count: 2,
            max_attempts: 5,
            provider: "meta",
            updated_at: "2026-03-29T08:05:00.000Z",
            message_correlation: {
              type: "outbound_attempt",
              provider_message_id: "provider-2",
              message_id: "msg-2",
            },
          },
        ]}
        surface={{
          loading: false,
          error: "",
          unavailable: false,
          ready: true,
          saving: false,
          saveError: "",
          saveSuccess: "",
          refresh: vi.fn(),
        }}
        actionState={{ isActionPending: vi.fn().mockReturnValue(false) }}
        markRead={vi.fn()}
        assignThread={vi.fn()}
        activateHandoff={vi.fn()}
        setThreadStatus={vi.fn()}
        onOpenDetails={vi.fn()}
        composer={null}
      />
    );

    expect(screen.getAllByText(/retrying/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/retry lineage is active after attempt 2 of 5/i)).toBeInTheDocument();
  });
});
