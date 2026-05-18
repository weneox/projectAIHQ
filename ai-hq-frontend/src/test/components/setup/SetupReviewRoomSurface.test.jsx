/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import SetupReviewRoomSurface from "../../../components/setup/SetupReviewRoomSurface.jsx";

afterEach(() => {
  cleanup();
});

describe("SetupReviewRoomSurface", () => {
  it("renders composer-only empty setup state", () => {
    render(
      <SetupReviewRoomSurface
        sourceValue=""
        sourceType="website"
        reviewRoom={{
          brain: {
            version: 0,
            sourceIntelligence: { quality: "missing", evidenceCount: 0 },
            sectionCompletion: { percent: 0 },
            missingFactsPlan: { required: true, missingSections: [] },
            conflictPlan: { hasConflicts: false },
            decisionPlan: { operatorDecision: "add_business_input" },
            runtimeSimulation: { canActivateAfterApproval: false },
          },
          sections: [],
          runtimeConsumers: { consumers: [] },
          actions: {
            primary: {
              id: "add_business_input",
              label: "Mənbə əlavə et",
              enabled: true,
            },
          },
          issues: [],
        }}
      />
    );

    expect(
      screen.getByRole("region", { name: /business setup workspace/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/biznesini ai üçün tanıdaq/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("medhouse.az")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oxu" })).toBeDisabled();

    expect(screen.queryByText(/0%/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not ready/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/truth hazırdır/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tapılan faktlar/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ai cavab preview/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/aktiv olacaq/i)).not.toBeInTheDocument();
  });

  it("submits a website source from the empty state", () => {
    const onSubmitSource = vi.fn();

    render(
      <SetupReviewRoomSurface
        sourceValue="medhouse.az"
        sourceType="website"
        onSubmitSource={onSubmitSource}
        reviewRoom={{
          brain: {
            version: 0,
            sourceIntelligence: { quality: "missing", evidenceCount: 0 },
            sectionCompletion: { percent: 0 },
            missingFactsPlan: { required: true, missingSections: [] },
            conflictPlan: { hasConflicts: false },
            decisionPlan: { operatorDecision: "add_business_input" },
            runtimeSimulation: { canActivateAfterApproval: false },
          },
          sections: [],
          runtimeConsumers: { consumers: [] },
          actions: {
            primary: {
              id: "add_business_input",
              label: "Mənbə əlavə et",
              enabled: true,
            },
          },
          issues: [],
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Oxu" }));

    expect(onSubmitSource).toHaveBeenCalledTimes(1);
  });

  it("progressively reveals facts and missing items after source analysis", () => {
    render(
      <SetupReviewRoomSurface
        sourceValue=""
        sourceType="website"
        reviewRoom={{
          brain: {
            version: 5,
            sourceIntelligence: { quality: "strong", evidenceCount: 3 },
            sectionCompletion: { percent: 72 },
            missingFactsPlan: {
              required: true,
              missingSections: ["hours"],
              nextQuestionKey: "hours",
              nextQuestion: {
                prompt: "İş saatlarını əlavə edin.",
              },
            },
            conflictPlan: { hasConflicts: false },
            decisionPlan: { operatorDecision: "answer_missing_facts" },
            runtimeSimulation: { canActivateAfterApproval: false },
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
              items: ["Klinika xidmətləri", "Müayinə"],
            },
          ],
          sections: [],
          runtimeConsumers: { consumers: [] },
          actions: {
            primary: {
              id: "answer_missing_required_facts",
              label: "Tamamla",
              intent: "answer_missing_facts",
              enabled: true,
            },
          },
          issues: [],
        }}
      />
    );

    expect(screen.getByText(/sistem biznesini oxuyur/i)).toBeInTheDocument();
    expect(screen.getByText(/tapılan faktlar/i)).toBeInTheDocument();
    expect(screen.getByText(/biznes adı/i)).toBeInTheDocument();
    expect(screen.getByText(/medhouse klinika/i)).toBeInTheDocument();
    expect(screen.getByText(/klinika xidmətləri/i)).toBeInTheDocument();
    expect(screen.getByText(/tamamlanmalı məlumatlar/i)).toBeInTheDocument();
    expect(screen.getByText(/iş saatlarını əlavə edin/i)).toBeInTheDocument();

    expect(screen.queryByText(/ai brain/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/runtime readiness/i)).not.toBeInTheDocument();
  });

  it("reveals approval only when truth can be approved", () => {
    const onAction = vi.fn();

    render(
      <SetupReviewRoomSurface
        sourceValue=""
        sourceType="website"
        onAction={onAction}
        reviewRoom={{
          brain: {
            version: 5,
            sourceIntelligence: { quality: "strong", evidenceCount: 4 },
            sectionCompletion: { percent: 100 },
            missingFactsPlan: { required: false, missingSections: [] },
            conflictPlan: { hasConflicts: false },
            decisionPlan: { operatorDecision: "approve_truth" },
            runtimeSimulation: {
              canActivateAfterApproval: true,
              afterApproval: [
                {
                  key: "public_widget",
                  label: "Website widget",
                  state: "ready_after_approval",
                },
              ],
            },
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
                  value: "Medhouse Klinika",
                },
              ],
              items: [],
            },
          ],
          actions: {
            primary: {
              id: "approve_and_publish_truth",
              label: "Truth-u təsdiqlə",
              intent: "finalize_review",
              enabled: true,
            },
          },
          approvalPreview: {
            canApprove: true,
          },
          runtimeConsumers: { consumers: [] },
          issues: [],
        }}
      />
    );

    expect(screen.getByText(/təsdiqə hazırdır/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /truth-u təsdiqlə/i }));

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "approve_and_publish_truth",
      })
    );
  });
});
