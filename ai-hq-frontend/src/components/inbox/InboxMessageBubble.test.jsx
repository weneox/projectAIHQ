import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import InboxMessageBubble from "./InboxMessageBubble.jsx";

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
});
