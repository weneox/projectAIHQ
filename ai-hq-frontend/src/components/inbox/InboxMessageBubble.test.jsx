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
    expect(
      screen.getByText(/price exception \(customer requested a custom package\)/i)
    ).toBeInTheDocument();
  });

  it("renders authoritative outbound attempt truth on outbound bubbles", () => {
    render(
      <InboxMessageBubble
        m={{
          id: "msg-2",
          direction: "outbound",
          sender_type: "agent",
          sent_at: "2026-03-29T08:00:00.000Z",
          text: "Checking in on your booking request.",
          outbound_attempt_correlation: "corr-1",
        }}
        attemptsByCorrelation={indexAttemptsByMessageCorrelation([
          {
            id: "attempt-9",
            status: "retrying",
            attempt_count: 2,
            max_attempts: 5,
            provider: "meta",
            last_error: "Provider timeout",
            message_correlation: "corr-1",
          },
        ])}
      />
    );

    expect(screen.getAllByText(/retrying/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/retry lineage is active after attempt 2 of 5/i)).toBeInTheDocument();
    expect(screen.getByText(/provider: meta/i)).toBeInTheDocument();
    expect(screen.getByText(/error: provider timeout/i)).toBeInTheDocument();
  });

  it("keeps waiting state explicit when object correlation exists but attempt truth has not arrived", () => {
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
            provider_message_id: "provider-3",
            type: "outbound_attempt",
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

  it("marks correlated attempt truth stale when the attempt record predates the message", () => {
    render(
      <InboxMessageBubble
        m={{
          id: "msg-4",
          direction: "outbound",
          sender_type: "agent",
          sent_at: "2026-03-30T10:00:00.000Z",
          text: "Checking status for you now.",
          outbound_attempt_correlation: "corr-4",
        }}
        attemptsByCorrelation={indexAttemptsByMessageCorrelation([
          {
            id: "attempt-4",
            status: "queued",
            attempt_count: 1,
            max_attempts: 3,
            provider: "meta",
            updated_at: "2026-03-30T09:55:00.000Z",
            message_correlation: "corr-4",
          },
        ])}
      />
    );

    expect(screen.getByText(/attempt truth may be stale/i)).toBeInTheDocument();
    expect(
      screen.getByText(/latest recorded state predates this message record/i)
    ).toBeInTheDocument();
  });

  it("renders outbound attempt truth when object correlations match", () => {
    render(
      <InboxMessageBubble
        m={{
          id: "msg-5",
          direction: "outbound",
          sender_type: "agent",
          sent_at: "2026-03-29T08:00:00.000Z",
          text: "Structured lineage should bind.",
          outbound_attempt_correlation: {
            provider_message_id: "provider-5",
            message_id: "msg-5",
            type: "outbound_attempt",
          },
        }}
        attemptsByCorrelation={indexAttemptsByMessageCorrelation([
          {
            id: "attempt-5",
            status: "failed",
            attempt_count: 1,
            max_attempts: 3,
            provider: "meta",
            last_error: "Provider timeout",
            message_correlation: {
              type: "outbound_attempt",
              message_id: "msg-5",
              provider_message_id: "provider-5",
            },
          },
        ])}
      />
    );

    expect(screen.getAllByText(/failed/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/most recent delivery attempt failed on attempt 1 of 3/i)
    ).toBeInTheDocument();
  });
});
