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
        role: "operator",
        sender_role: "operator",
        text: "Your appointment request is on the way.",
        body: "Your appointment request is on the way.",
        message_text: "Your appointment request is on the way.",
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
  it("renders actionable conversation detail semantics and delivery truth", () => {
    const props = buildProps();

    render(<InboxDetailPanel {...props} />);

    expect(screen.getByText(/alex morgan/i)).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: /enable inbox automatic replies/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /refresh conversation/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /open detail drawer/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /conversation actions/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/composer slot/i)).toBeInTheDocument();
    expect(screen.getByText(/your appointment request is on the way/i)).toBeInTheDocument();
    expect(screen.getByText(/assigned/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open detail drawer/i }));
    expect(props.onOpenDetails).toHaveBeenCalledTimes(1);
  });

  it("renders object-shaped outbound lineage truth without changing detail behavior", () => {
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
      screen.getByRole("button", { name: /open detail drawer/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /conversation actions/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/composer slot/i)).toBeInTheDocument();
  });
});