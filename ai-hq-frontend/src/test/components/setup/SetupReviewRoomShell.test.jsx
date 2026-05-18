import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SetupReviewRoomShell from "../../../components/setup/SetupReviewRoomShell.jsx";

function createAssistant(overrides = {}) {
  return {
    session: {
      id: "session-1",
    },
    review: {
      finalizeAvailable: false,
      readyForReview: false,
    },
    assistant: {
      nextQuestion: {
        key: "handoff",
        step: "handoff",
        title: "Operator handoff",
        prompt: "Canonical handoff question",
        group: "business_truth",
      },
      interviewPlan: {
        activeQuestions: [
          {
            key: "handoff",
            step: "handoff",
            title: "Operator handoff",
            group: "business_truth",
          },
        ],
      },
      draft: {
        businessName: "Alpha",
      },
      readyForApproval: false,
    },
    ...overrides,
  };
}

describe("SetupReviewRoomShell", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollTo = vi.fn();
  });

  async function startSetup() {
    const startButton = screen.queryByRole("button", { name: "Start setup" });
    if (startButton) {
      fireEvent.click(startButton);
    }

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
  }

  it("routes review room approval action to finalize", async () => {
    const onFinalize = vi.fn().mockResolvedValue(true);

    render(
      <SetupReviewRoomShell
        sessionHydrated
        assistant={createAssistant()}
        reviewPayload={{
          setup: {
            reviewRoom: {
              header: {
                title: "Business truth is ready to approve",
                subtitle: "Approval will publish runtime truth.",
                statusLabel: "Ready for approval",
                badgeTone: "success",
                trustNote: "Draft data is not runtime authority.",
              },
              sections: [],
              actions: {
                primary: {
                  id: "approve_and_publish_truth",
                  label: "Approve truth",
                  intent: "finalize_review",
                  enabled: true,
                },
              },
              runtimeConsumers: {
                consumers: [],
              },
              issues: [],
            },
          },
        }}
        onCaptureSource={vi.fn().mockResolvedValue(true)}
        onParseMessage={vi.fn()}
        onFinalize={onFinalize}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /approve truth/i }));

    await waitFor(() => {
      expect(onFinalize).toHaveBeenCalledTimes(1);
    });
  });

  it("uses canonical setup review room product copy", async () => {
    render(
      <SetupReviewRoomShell
        sessionHydrated={false}
        assistant={createAssistant()}
        onStartSetup={vi.fn()}
        onGoToChannels={vi.fn()}
        onCaptureSource={vi.fn().mockResolvedValue(true)}
        onParseMessage={vi.fn()}
        onFinalize={vi.fn()}
      />
    );

    expect(screen.getByText("Business truth setup")).toBeInTheDocument();
    expect(screen.getByText("Setup review room")).toBeInTheDocument();
    expect(screen.queryByText("Assistant setup")).not.toBeInTheDocument();
    expect(screen.queryByText("AI receptionist setup")).not.toBeInTheDocument();
  });

  it("reads the canonical assistant state without any legacy assistantBrain fallback", async () => {
    render(
      <SetupReviewRoomShell
        sessionHydrated
        assistant={createAssistant()}
        reviewPayload={{
          assistant: {
            nextQuestion: {
              key: "handoff",
              step: "handoff",
              title: "Operator handoff",
              prompt: "Canonical handoff question",
              group: "business_truth",
            },
            interviewPlan: {
              activeQuestions: [
                {
                  key: "handoff",
                  step: "handoff",
                  title: "Operator handoff",
                  group: "business_truth",
                },
              ],
            },
            readyForApproval: false,
          },
        }}
        onCaptureSource={vi.fn().mockResolvedValue(true)}
        onParseMessage={vi.fn()}
        onFinalize={vi.fn()}
      />
    );

    await startSetup();

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveAttribute(
        "placeholder",
        "Handoff halları"
      );
    });
  });

  it("keeps the smart draft curated and hides the old analysis-heavy headings", async () => {
    render(
      <SetupReviewRoomShell
        sessionHydrated
        assistant={createAssistant({
          assistant: {
            nextQuestion: {},
            interviewPlan: {
              activeQuestions: [],
            },
            draft: {
              businessName: "Alpha Clinic",
              whatThisBusinessIs: "Dental clinic in Baku",
              coreServices: ["Consultation", "Cleaning"],
              pricingPosture: "Exact pricing requires a quote.",
              contactRoutes: ["+994555555555"],
              humanHandoff: "Complaints and custom quotes go to an operator.",
            },
            sourceSignals: {
              primarySourceType: "website",
              primarySourceLabel: "Website",
              primarySourceUrl: "https://alpha.example",
              strongestEvidence: ["Homepage and contact page imported"],
              discoveredPublicClaims: ["WhatsApp bookings"],
            },
            confidence: {
              strong: ["Business identity is anchored on a confirmed public source."],
              unclear: ["Business hours still need confirmation."],
              contradictions: ["Pricing wording needs one final check."],
            },
            recommendation: {
              notes: ["Keep the public pricing reply policy concise."],
            },
            message: "This draft is ready for a final operator pass.",
            readyForApproval: true,
          },
        })}
        onCaptureSource={vi.fn().mockResolvedValue(true)}
        onParseMessage={vi.fn()}
        onFinalize={vi.fn()}
      />
    );

    await startSetup();

    await waitFor(() => {
      expect(screen.getByText("Business Truth draft")).toBeInTheDocument();
    });

    expect(screen.getByText("Review signals")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Approve truth" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Strongest evidence")).not.toBeInTheDocument();
    expect(screen.queryByText("What the system noticed")).not.toBeInTheDocument();
    expect(screen.queryByText("What looks strong")).not.toBeInTheDocument();
    expect(screen.queryByText("What still looks unclear")).not.toBeInTheDocument();
    expect(screen.queryByText("What may be inconsistent")).not.toBeInTheDocument();
    expect(screen.queryByText("Recommendation")).not.toBeInTheDocument();
  });

  it("does not treat legacy review readiness as approval readiness", async () => {
    render(
      <SetupReviewRoomShell
        sessionHydrated
        assistant={createAssistant({
          review: {
            finalizeAvailable: false,
            readyForReview: true,
          },
          assistant: {
            nextQuestion: {},
            interviewPlan: {
              activeQuestions: [],
            },
            draft: {
              businessName: "Alpha Clinic",
              whatThisBusinessIs: "Dental clinic in Baku",
              coreServices: ["Consultation"],
            },
            sourceSignals: {
              primarySourceType: "website",
              primarySourceLabel: "Website",
              primarySourceUrl: "https://alpha.example",
            },
            confidence: {
              strong: [],
              unclear: ["Business hours still need confirmation."],
              contradictions: [],
            },
            recommendation: {
              notes: [],
            },
            message: "A few launch-critical details still need confirmation.",
            readyForApproval: false,
          },
        })}
        onCaptureSource={vi.fn().mockResolvedValue(true)}
        onParseMessage={vi.fn()}
        onFinalize={vi.fn()}
      />
    );

    await startSetup();

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: "Approve truth" })
    ).not.toBeInTheDocument();
  });
});
