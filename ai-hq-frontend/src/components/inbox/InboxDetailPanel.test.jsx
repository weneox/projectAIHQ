import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import InboxDetailPanel from "./InboxDetailPanel.jsx";

describe("InboxDetailPanel", () => {
  it("renders explicit detail surface feedback", () => {
    render(
      <InboxDetailPanel
        selectedThread={{
          id: "thread-1",
          status: "open",
          labels: [],
          unread_count: 1,
          last_decision_meta: {
            executionPolicyOutcome: "blocked_until_repair",
            executionPolicyReasonCodes: ["runtime_authority_unavailable", "projection_stale"],
            runtimeReference: "approved-runtime/inbox-primary",
            runtimeVersion: "2026.03.29",
            behaviorSummary: "The assistant held a guided booking posture before offering a CTA.",
            promptLayers: ["system-core", { label: "inbox-booking", version: "v4" }],
            channel: "inbox",
            usecase: "lead_capture",
            ctaDecision: "Offer booking consult",
            qualificationDecision: "Collect treatment intent",
            qualificationReference: "lead-qualifier-v2",
            handoffTrigger: "human_request",
            handoffReason: "customer asked for a specialist",
            disallowedClaimBlockReason: "Diagnosis claims remain blocked in DMs.",
          },
        }}
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
    expect(screen.getByText(/channel autonomy/i)).toBeInTheDocument();
    expect(screen.getByText(/blocked until repair/i)).toBeInTheDocument();
    expect(screen.getByText(/runtime authority unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/latest execution inspect/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/approved-runtime\/inbox-primary/i).length
    ).toBeGreaterThan(0);
    expect(screen.getByText(/offer booking consult/i)).toBeInTheDocument();
    expect(screen.getByText(/diagnosis claims remain blocked in dms/i)).toBeInTheDocument();
  });
});
