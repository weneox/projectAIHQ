import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import InboxDetailPanel from "../../../components/inbox/InboxDetailPanel.jsx";

function buildProps(overrides = {}) {
  return {
    selectedThread: {
      id: "thread-1",
      customer_name: "Alex Morgan",
      channel_label: "Conversation",
      status: "open",
      unread_count: 1,
      ...overrides.selectedThread,
    },
    messages: [
      {
        id: "message-1",
        direction: "outbound",
        sender_type: "agent",
        text: "Your appointment request is on the way.",
        created_at: "2026-03-29T10:00:00.000Z",
      },
    ],
    outboundAttempts: [
      {
        id: "attempt-1",
        provider: "meta",
        status: "failed",
        delivery_status: "failed",
        attempt_number: 1,
        max_attempts: 3,
        created_at: "2026-03-29T10:01:00.000Z",
        updated_at: "2026-03-29T10:02:00.000Z",
        provider_response: {
          error: "Most recent delivery attempt failed on attempt 1 of 3.",
        },
      },
    ],
    surface: {
      loading: false,
      error: "",
      unavailable: false,
      ready: true,
      saving: false,
      saveError: "",
      saveSuccess: "Thread assigned.",
      refresh: vi.fn(),
      ...overrides.surface,
    },
    actionState: {
      isActionPending: vi.fn().mockReturnValue(false),
      ...overrides.actionState,
    },
    markRead: vi.fn(),
    assignThread: vi.fn(),
    activateHandoff: vi.fn(),
    setThreadStatus: vi.fn(),
    onOpenDetails: vi.fn(),
    automationControl: {
      loading: false,
      saving: false,
      enabled: false,
      controlMode: "operator_only_mode",
      statusLabel: "Operator only",
      disabled: false,
      disabledReason: "",
      saveError: "",
      saveSuccess: "",
      changedAt: "",
      changedBy: "",
      policyReason: "",
      ...overrides.automationControl,
    },
    onToggleAutomation: vi.fn(),
    composer: <div>Composer slot</div>,
    ...overrides,
  };
}

describe("InboxDetailPanel", () => {
  it("renders actionable conversation detail semantics and message history", () => {
    const props = buildProps();

    render(<InboxDetailPanel {...props} />);

    expect(screen.getByRole("switch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /conversation details/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /more actions/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/composer slot/i)).toBeInTheDocument();
    expect(
      screen.getByText(/your appointment request is on the way/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/thread assigned/i).length).toBeGreaterThan(0);
  });

  it("renders object-shaped outbound lineage input without changing detail behavior", () => {
    const props = buildProps({
      outboundAttempts: [
        {
          id: "attempt-1",
          provider: "meta",
          status: "failed",
          delivery_status: "failed",
          attempt_number: 1,
          max_attempts: 3,
          created_at: "2026-03-29T10:01:00.000Z",
          updated_at: "2026-03-29T10:02:00.000Z",
          provider_response: {
            code: "provider_failed",
            detail: {
              reason: "temporary delivery failure",
            },
          },
        },
      ],
    });

    render(<InboxDetailPanel {...props} />);

    expect(
      screen.getByRole("button", { name: /conversation details/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /more actions/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/composer slot/i)).toBeInTheDocument();
    expect(
      screen.getByText(/your appointment request is on the way/i)
    ).toBeInTheDocument();
  });

  it("opens conversation details when the detail action is clicked", () => {
    const props = buildProps();

    render(<InboxDetailPanel {...props} />);

    fireEvent.click(
      screen.getByRole("button", { name: /conversation details/i })
    );

    expect(props.onOpenDetails).toHaveBeenCalledTimes(1);
  });

  it("refreshes the detail surface when refresh is clicked", () => {
    const props = buildProps();

    render(<InboxDetailPanel {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));

    expect(props.surface.refresh).toHaveBeenCalledTimes(1);
  });

  it("renders the next conversation content when a different thread is selected", () => {
    const initialProps = buildProps({
      selectedThread: {
        id: "thread-1",
        customer_name: "Alex Morgan",
      },
      messages: [
        {
          id: "message-1",
          direction: "outbound",
          sender_type: "agent",
          text: "Initial conversation content.",
          created_at: "2026-03-29T10:00:00.000Z",
        },
      ],
    });

    const { rerender } = render(<InboxDetailPanel {...initialProps} />);

    expect(
      screen.getByText(/initial conversation content/i)
    ).toBeInTheDocument();

    const nextProps = buildProps({
      selectedThread: {
        id: "thread-2",
        customer_name: "Jamie Reed",
      },
      messages: [
        {
          id: "message-2",
          direction: "outbound",
          sender_type: "agent",
          text: "Next conversation content.",
          created_at: "2026-03-29T11:00:00.000Z",
        },
      ],
    });

    rerender(<InboxDetailPanel {...nextProps} />);

    expect(screen.getByText(/next conversation content/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/initial conversation content/i)
    ).not.toBeInTheDocument();
  });
});