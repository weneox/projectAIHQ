import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import InboxMessageBubble from "./InboxMessageBubble.jsx";
import { indexAttemptsByMessageCorrelation } from "./outboundAttemptTruth.js";

describe("InboxMessageBubble", () => {
  it("reveals compact replay reasoning for AI messages", () => {
    render(
      <InboxMessageBubble
        m={{
          id: "msg-1",
          direction: "outbound",
          sender_type: "ai",
          sent_at: "2026-03-29T08:00:00.000Z",
          text: "I can help you book a consultation.",
          replay_trace: {
            runtime_reference: "approved-runtime/inbox-primary",
            behavior_summary: "Used the approved booking behavior bundle.",
            prompt_layers: ["system-core", "booking-intake"],
            channel: "inbox",
            usecase: "lead_capture",
            cta_decision: "Invite booking",
            qualification_decision: "Confirm service interest",
            handoff_trigger: "price_exception",
            handoff_reason: "customer requested a custom package",
          },
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /inspect reasoning/i }));

    expect(screen.getByText(/message inspect/i)).toBeInTheDocument();
    expect(screen.getByText(/invite booking/i)).toBeInTheDocument();
    expect(screen.getByText(/confirm service interest/i)).toBeInTheDocument();
  });

  it("renders corrected outbound lineage truth for object-shaped correlations", () => {
    render(
      <InboxMessageBubble
        m={{
          id: "msg-2",
          direction: "outbound",
          sender_type: "agent",
          sent_at: "2026-03-29T08:00:00.000Z",
          text: "Checking in on your booking request.",
          outbound_attempt_correlation: {
            message_id: "msg-2",
            provider_message_id: "provider-2",
            type: "outbound_attempt",
          },
        }}
        attemptsByCorrelation={indexAttemptsByMessageCorrelation([
          {
            id: "attempt-9",
            status: "retrying",
            attempt_count: 2,
            max_attempts: 5,
            provider: "meta",
            last_error: "Provider timeout",
            message_correlation: {
              type: "outbound_attempt",
              provider_message_id: "provider-2",
              message_id: "msg-2",
            },
          },
        ])}
      />
    );

    expect(screen.getAllByText(/retrying/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/retry lineage is active after attempt 2 of 5/i)).toBeInTheDocument();
    expect(screen.getByText(/provider: meta/i)).toBeInTheDocument();
    expect(screen.getByText(/error: provider timeout/i)).toBeInTheDocument();
  });

  it("keeps waiting state explicit when correlation exists but attempt truth has not arrived", () => {
    render(
      <InboxMessageBubble
        m={{
          id: "msg-3",
          direction: "outbound",
          sender_type: "agent",
          sent_at: "2026-03-29T08:00:00.000Z",
          text: "Following up now.",
          outbound_attempt_correlation: {
            message_id: "msg-3",
            scope: "tenant",
          },
        }}
        attemptsByCorrelation={indexAttemptsByMessageCorrelation([])}
      />
    );

    expect(screen.getByText(/waiting for attempt truth/i)).toBeInTheDocument();
    expect(
      screen.getByText(/no outbound attempt record is attached yet/i)
    ).toBeInTheDocument();
  });
});
