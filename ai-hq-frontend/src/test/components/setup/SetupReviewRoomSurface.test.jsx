/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import SetupReviewRoomSurface from "../../../components/setup/SetupReviewRoomSurface.jsx";

afterEach(() => {
  cleanup();
});

describe("SetupReviewRoomSurface", () => {
  it("renders source-first setup workspace instead of chat UI", () => {
    render(
      <SetupReviewRoomSurface
        sourceValue="https://medhouse.az"
        sourceType="website"
        reviewRoom={{
          header: {
            statusLabel: "Hazırlanır",
            badgeTone: "info",
          },
          brain: {
            version: 5,
            sourceIntelligence: {
              quality: "strong",
              evidenceCount: 3,
            },
            sectionCompletion: {
              percent: 78,
            },
            missingFactsPlan: {
              required: true,
              missingSections: ["hours", "pricing"],
              nextQuestionKey: "hours",
              nextQuestion: {
                prompt: "İş saatlarını əlavə edin.",
              },
            },
            conflictPlan: {
              hasConflicts: false,
            },
            decisionPlan: {
              operatorDecision: "answer_missing_facts",
              reason: "Required business facts are missing.",
            },
            runtimeSimulation: {
              canActivateAfterApproval: false,
              afterApproval: [
                {
                  key: "public_widget",
                  label: "Website widget",
                  state: "ready",
                  authority: "approved_truth",
                },
              ],
            },
          },
          sections: [],
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
                  value: "Medhouse Klinika",
                },
                {
                  key: "category",
                  label: "Kateqoriya",
                  value: "Tibbi klinika",
                },
              ],
              items: [],
            },
            {
              key: "services",
              title: "Xidmətlər",
              status: "complete",
              sourceBacked: true,
              facts: [],
              items: ["Klinika Xidmətləri", "Müayinə"],
            },
          ],
          actions: {
            primary: {
              id: "answer_missing_required_facts",
              label: "Tamamla",
              intent: "answer_missing_facts",
              enabled: true,
            },
          },
          runtimeConsumers: {
            consumers: [],
          },
          issues: [],
        }}
      />
    );

    expect(
      screen.getByRole("region", { name: /business setup workspace/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/biznesini ai üçün tanıdaq/i)).toBeInTheDocument();
    expect(screen.getByText(/1\. mənbə əlavə et/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://medhouse.az")).toBeInTheDocument();
    expect(screen.getByText(/tapılan biznes faktları/i)).toBeInTheDocument();
    expect(screen.getByText(/medhouse klinika/i)).toBeInTheDocument();
    expect(screen.getByText(/klinika xidmətləri/i)).toBeInTheDocument();
    expect(screen.getByText(/çatışmayanlar/i)).toBeInTheDocument();
    expect(screen.getByText(/iş saatlarını əlavə edin/i)).toBeInTheDocument();
    expect(screen.getByText(/canlı preview/i)).toBeInTheDocument();
    expect(screen.queryByText(/ai brain v5/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/write a message/i)).not.toBeInTheDocument();
  });

  it("submits source input and routes primary action", () => {
    const onSubmitSource = vi.fn();
    const onAction = vi.fn();

    render(
      <SetupReviewRoomSurface
        sourceValue="https://medhouse.az"
        sourceType="website"
        onSubmitSource={onSubmitSource}
        onAction={onAction}
        reviewRoom={{
          actions: {
            primary: {
              id: "approve_and_publish_truth",
              label: "Truth-u təsdiqlə",
              intent: "finalize_review",
              enabled: true,
            },
          },
          brain: {
            version: 5,
            sourceIntelligence: { quality: "strong", evidenceCount: 2 },
            sectionCompletion: { percent: 100 },
            missingFactsPlan: { required: false, missingSections: [] },
            conflictPlan: { hasConflicts: false },
            decisionPlan: { operatorDecision: "approve_truth" },
            runtimeSimulation: { canActivateAfterApproval: true },
          },
          sections: [],
          runtimeConsumers: { consumers: [] },
          issues: [],
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /oxumağa başla/i }));
    expect(onSubmitSource).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /truth-u təsdiqlə/i }));
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "approve_and_publish_truth",
      })
    );
  });
});
