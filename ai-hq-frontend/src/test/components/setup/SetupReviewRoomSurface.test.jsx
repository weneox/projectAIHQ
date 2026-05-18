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
              label: "M?nb? ?lav? et",
              enabled: true,
            },
          },
          issues: [],
        }}
      />
    );

    expect(
      screen.getByRole("region", { name: /setup workspace/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/biznesini ai üçün tanidaq/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/google maps/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oxu" })).toBeDisabled();

    expect(screen.queryByText(/0%/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not ready/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/truth hazirdir/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/bunlari tapdim/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^faktlar$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ai cavab preview/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/aktiv olacaq/i)).not.toBeInTheDocument();
  });

  it("renders a clean source-loading state without progress panels", () => {
    render(
      <SetupReviewRoomSurface
        sourceValue="weneox.com"
        sourceBusy
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
              label: "M?nb? ?lav? et",
              enabled: true,
            },
          },
          issues: [],
        }}
      />
    );

    expect(screen.getByText(/biznes m?lumatlari oxunur/i)).toBeInTheDocument();
    expect(screen.queryByText(/0%/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tamamlanib/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/bunlari tapdim/i)).not.toBeInTheDocument();
  });

  it("submits a website source from the empty state", () => {
    const onSubmitSource = vi.fn();

    render(
      <SetupReviewRoomSurface
        sourceValue="weneox.com"
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
              label: "M?nb? ?lav? et",
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
                prompt: "Is saatlarini ?lav? edin.",
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
                  label: "Biznes adi",
                  value: "Atlas Klinika",
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
              title: "Xidm?tl?r",
              status: "complete",
              sourceBacked: true,
              facts: [],
              items: ["Klinika xidm?tl?ri", "Müayin?"],
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

    expect(screen.getByText(/bunlari tapdim/i)).toBeInTheDocument();
    expect(screen.getByText(/^faktlar$/i)).toBeInTheDocument();
    expect(screen.getByText(/biznes adi/i)).toBeInTheDocument();
    expect(screen.getByText(/atlas klinika/i)).toBeInTheDocument();
    expect(screen.getByText(/klinika xidm?tl?ri/i)).toBeInTheDocument();
    expect(screen.getByText(/aydinlasdirmali oldugum suallar/i)).toBeInTheDocument();
    expect(screen.getByText("Is saatlarini ?lav? edin.")).toBeInTheDocument();

    expect(screen.queryByText(/ai brain/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/runtime readiness/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/72%/i)).not.toBeInTheDocument();
  });

  it("hides fake missing or empty-answer blockers", () => {
    render(
      <SetupReviewRoomSurface
        sourceValue=""
        reviewRoom={{
          brain: {
            version: 5,
            sourceIntelligence: { quality: "strong", evidenceCount: 1 },
            sectionCompletion: { percent: 40 },
            missingFactsPlan: { required: true, missingSections: ["missing"] },
            conflictPlan: { hasConflicts: false },
            decisionPlan: { operatorDecision: "answer_missing_facts" },
            runtimeSimulation: { canActivateAfterApproval: false },
          },
          sectionDetails: [
            {
              key: "profile",
              title: "Profil",
              sourceBacked: true,
              facts: [
                {
                  key: "companyName",
                  label: "Biznes adi",
                  value: "Atlas Klinika",
                },
              ],
              items: [],
            },
          ],
          actions: {
            primary: {
              id: "answer_missing_required_facts",
              label: "Tamamla",
              enabled: true,
            },
          },
          issues: [
            {
              id: "bad-empty",
              severity: "blocking",
              section: "missing",
              message: "Empty answer",
            },
          ],
        }}
      />
    );

    expect(screen.getByText(/bunlari tapdim/i)).toBeInTheDocument();
    expect(screen.queryByText(/empty answer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/aydinlasdirmali oldugum suallar/i)).not.toBeInTheDocument();
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
                  label: "Biznes adi",
                  value: "Atlas Klinika",
                },
              ],
              items: [],
            },
          ],
          actions: {
            primary: {
              id: "approve_and_publish_truth",
              label: "T?sdiql?",
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

    expect(screen.getByText(/t?sdiql?m?y? hazirdir/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /t?sdiql?/i }));

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "approve_and_publish_truth",
      })
    );
  });

  it("hides approval until the review is actually approvable", () => {
    render(
      <SetupReviewRoomSurface
        sourceValue=""
        reviewRoom={{
          readyForApproval: false,
          brain: {
            version: 5,
            sourceIntelligence: { quality: "strong", evidenceCount: 4 },
            sectionCompletion: { percent: 100 },
            missingFactsPlan: { required: false, missingSections: [] },
            conflictPlan: { hasConflicts: false },
            decisionPlan: { operatorDecision: "approve_truth", canApprove: false },
            runtimeSimulation: { canActivateAfterApproval: true },
          },
          sectionDetails: [
            {
              key: "profile",
              title: "Profil",
              sourceBacked: true,
              facts: [
                {
                  key: "companyName",
                  label: "Biznes adi",
                  value: "Atlas Klinika",
                },
              ],
              items: [],
            },
          ],
          actions: {
            primary: {
              id: "approve_and_publish_truth",
              label: "T?sdiql?",
              intent: "finalize_review",
              enabled: true,
            },
          },
          approvalPreview: {
            canApprove: false,
          },
          runtimeConsumers: { consumers: [] },
          issues: [],
        }}
      />
    );

    expect(screen.queryByText(/t?sdiql?m?y? hazirdir/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /t?sdiql?/i })).not.toBeInTheDocument();
  });
});
