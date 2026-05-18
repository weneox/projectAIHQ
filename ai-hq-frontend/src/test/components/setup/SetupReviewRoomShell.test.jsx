/* @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import SetupReviewRoomShell from "../../../components/setup/SetupReviewRoomShell.jsx";

function createReviewRoom(overrides = {}) {
  return {
    brain: {
      version: 5,
      sourceIntelligence: { quality: "strong", evidenceCount: 2 },
      sectionCompletion: { percent: 100 },
      missingFactsPlan: { required: false, missingSections: [] },
      conflictPlan: { hasConflicts: false },
      decisionPlan: { operatorDecision: "approve_truth" },
      runtimeSimulation: { canActivateAfterApproval: true },
    },
    sectionDetails: [
      {
        key: "profile",
        title: "Profil",
        status: "complete",
        sourceBacked: true,
        facts: [
          {
            key: "companyName",
            label: "Biznes adı",
            value: "Atlas Klinika",
          },
        ],
        items: [],
      },
    ],
    sections: [],
    actions: {
      primary: {
        id: "approve_and_publish_truth",
        label: "Təsdiqlə",
        intent: "finalize_review",
        enabled: true,
      },
    },
    approvalPreview: {
      canApprove: true,
    },
    runtimeConsumers: {
      consumers: [],
    },
    issues: [],
    ...overrides,
  };
}

describe("SetupReviewRoomShell", () => {
  it("submits website source as imported source intent", async () => {
    const onStartSetup = vi.fn().mockResolvedValue(true);
    const onParseMessage = vi.fn().mockResolvedValue(true);

    render(
      <SetupReviewRoomShell
        sessionHydrated
        assistant={{ session: { id: "session-1" } }}
        reviewPayload={{ setup: { reviewRoom: createReviewRoom() } }}
        onStartSetup={onStartSetup}
        onParseMessage={onParseMessage}
        onFinalize={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/google maps/i), {
      target: { value: "weneox.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Oxu" }));

    await waitFor(() => {
      expect(onStartSetup).toHaveBeenCalledTimes(1);
      expect(onParseMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "weneox.com",
          step: "source",
          source: expect.objectContaining({
            type: "website",
            value: "https://weneox.com",
            isImportedSource: true,
          }),
        })
      );
    });
  });

  it("submits manual brief as missing fact message", async () => {
    const onParseMessage = vi.fn().mockResolvedValue(true);

    render(
      <SetupReviewRoomShell
        sessionHydrated
        assistant={{
          session: { id: "session-1" },
          assistant: {
            nextQuestion: {
              key: "hours",
              step: "hours",
              prompt: "İş saatları necədir?",
            },
          },
        }}
        reviewPayload={{
          setup: {
            reviewRoom: createReviewRoom({
              brain: {
                version: 5,
                sourceIntelligence: { quality: "partial", evidenceCount: 1 },
                sectionCompletion: { percent: 80 },
                missingFactsPlan: {
                  required: true,
                  missingSections: ["hours"],
                  nextQuestionKey: "hours",
                  nextQuestion: {
                    key: "hours",
                    prompt: "İş saatları necədir?",
                  },
                },
                conflictPlan: { hasConflicts: false },
                decisionPlan: { operatorDecision: "answer_missing_facts" },
                runtimeSimulation: { canActivateAfterApproval: false },
              },
              actions: {
                primary: {
                  id: "answer_missing_required_facts",
                  label: "Tamamla",
                  intent: "answer_missing_facts",
                  enabled: true,
                },
              },
              approvalPreview: {
                canApprove: false,
              },
            }),
          },
        }}
        onStartSetup={vi.fn().mockResolvedValue(true)}
        onParseMessage={onParseMessage}
        onFinalize={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/google maps/i), {
      target: { value: "Həftə içi 09:00-18:00 işləyirik." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Oxu" }));

    await waitFor(() => {
      expect(onParseMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "Həftə içi 09:00-18:00 işləyirik.",
          step: "hours",
          source: expect.objectContaining({
            type: "manual",
            isImportedSource: false,
          }),
        })
      );
    });
  });

  it("routes approval action to finalize", async () => {
    const onFinalize = vi.fn().mockResolvedValue(true);

    render(
      <SetupReviewRoomShell
        sessionHydrated
        assistant={{ session: { id: "session-1" } }}
        reviewPayload={{ setup: { reviewRoom: createReviewRoom() } }}
        onStartSetup={vi.fn()}
        onParseMessage={vi.fn()}
        onFinalize={onFinalize}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /təsdiqlə/i }));

    await waitFor(() => {
      expect(onFinalize).toHaveBeenCalledTimes(1);
    });
  });
});
