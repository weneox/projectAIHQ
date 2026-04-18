import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SetupAssistantSections from "../../../components/layout/SetupAssistantSections.jsx";

function createAssistant(overrides = {}) {
  return {
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

describe("SetupAssistantSections", () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollTo = vi.fn();
  });

  async function startSetup() {
    fireEvent.click(screen.getByRole("button", { name: "Start setup" }));

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
  }

  it("reads the canonical assistant state without any legacy assistantBrain fallback", async () => {
    render(
      <SetupAssistantSections
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
      expect(
        screen.getByText((content) => content.includes("Canonical handoff question"))
      ).toBeInTheDocument();
    });
  });

  it("keeps the smart draft curated and hides the old analysis-heavy headings", async () => {
    render(
      <SetupAssistantSections
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
      expect(screen.getByText("Draft ready")).toBeInTheDocument();
    });

    expect(screen.getByText("Review intelligence")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Approve and finish setup" })
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
      <SetupAssistantSections
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
      screen.queryByRole("button", { name: "Approve and finish setup" })
    ).not.toBeInTheDocument();
  });
});
