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

  it("reads the canonical assistant state instead of legacy assistantBrain fallback", async () => {
    render(
      <SetupAssistantSections
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
          assistantBrain: {
            nextQuestion: {
              key: "languages",
              step: "languages",
              title: "Languages",
              prompt: "Legacy languages question",
              group: "business_truth",
            },
            readyForApproval: false,
          },
        }}
        onCaptureSource={vi.fn().mockResolvedValue(true)}
        onParseMessage={vi.fn()}
        onFinalize={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "https://alpha.example" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(
        screen.getByText((content) => content.includes("Canonical handoff question"))
      ).toBeInTheDocument();
    });

    expect(screen.queryByText("Legacy languages question")).not.toBeInTheDocument();
  });
});
