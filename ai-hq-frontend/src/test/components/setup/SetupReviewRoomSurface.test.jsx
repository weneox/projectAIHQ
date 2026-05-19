/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

import SetupReviewRoomSurface from "../../../components/setup/SetupReviewRoomSurface.jsx";

afterEach(() => {
  cleanup();
});

function baseRoom(overrides = {}) {
  return {
    brain: {
      version: 5,
      sourceIntelligence: { quality: "strong", evidenceCount: 2 },
      sectionCompletion: { percent: 80 },
      missingFactsPlan: { required: false, missingSections: [] },
      conflictPlan: { hasConflicts: false },
      decisionPlan: { operatorDecision: "review_business_draft" },
      runtimeSimulation: { canActivateAfterApproval: false },
    },
    sections: [],
    runtimeConsumers: { consumers: [] },
    actions: {
      primary: {
        id: "continue_setup",
        label: "Continue",
        intent: "continue_setup",
        enabled: true,
      },
    },
    issues: [],
    ...overrides,
  };
}

function polishedRoom(overrides = {}) {
  return baseRoom({
    evidence: {
      primarySource: {
        type: "website",
        url: "https://atlas.example",
        label: "atlas.example",
      },
      evidenceCards: [
        {
          id: "e1",
          label: "Website",
          text: "Atlas Clinic website evidence",
          sourceUrl: "https://atlas.example",
        },
      ],
    },
    polishedTruthDraft: {
      title: "Atlas Clinic",
      subtitle: "Polished draft",
      source: {
        type: "website",
        url: "https://atlas.example",
        label: "atlas.example",
      },
      businessIdentity: {
        name: "Atlas Clinic",
        description: "Dental clinic in Baku.",
        website: "https://atlas.example",
        publicSummary: "Dental clinic in Baku.",
      },
      whatThisBusinessDoes: "Atlas Clinic provides dental care.",
      services: [{ title: "Consultation", sourceBacked: true }],
      contacts: [{ type: "phone", label: "Phone", value: "+994501112233" }],
      hours: ["monday 09:00-18:00"],
      pricingPosture: "Pricing depends on the service.",
      safeAiBehavior: {
        canSay: ["Atlas Clinic provides dental care."],
        shouldNotSay: ["Do not invent prices."],
        handoffRules: ["Route uncertain questions to a human."],
      },
      missingQuestions: [],
      approval: { canApprove: false, missingSections: [], publishCount: 4 },
      evidence: [
        {
          label: "Website",
          text: "Atlas Clinic website evidence",
          sourceUrl: "https://atlas.example",
        },
      ],
    },
    ...overrides,
  });
}

describe("SetupReviewRoomSurface", () => {
  it("renders composer-only empty setup state", () => {
    render(<SetupReviewRoomSurface sourceValue="" reviewRoom={baseRoom({ brain: { version: 0, sourceIntelligence: { quality: "missing", evidenceCount: 0 }, sectionCompletion: { percent: 0 }, missingFactsPlan: { required: true, missingSections: [] }, conflictPlan: { hasConflicts: false }, decisionPlan: { operatorDecision: "add_business_input" }, runtimeSimulation: { canActivateAfterApproval: false } } })} />);

    expect(screen.getByRole("region", { name: /setup workspace/i })).toBeInTheDocument();
    expect(screen.getByText(/biznesini ai/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/google maps/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oxu" })).toBeDisabled();
    expect(screen.queryByText(/ai biznes truth draft/i)).not.toBeInTheDocument();
  });

  it("renders a clean source-loading state without progress panels", () => {
    render(<SetupReviewRoomSurface sourceValue="weneox.com" sourceBusy reviewRoom={baseRoom({ brain: { version: 0, sourceIntelligence: { quality: "missing", evidenceCount: 0 }, sectionCompletion: { percent: 0 }, missingFactsPlan: { required: true, missingSections: [] }, conflictPlan: { hasConflicts: false }, decisionPlan: { operatorDecision: "add_business_input" }, runtimeSimulation: { canActivateAfterApproval: false } } })} />);

    expect(screen.getByText(/biznes m.lumatlar. oxunur/i)).toBeInTheDocument();
    expect(screen.queryByText(/0%/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ai biznes truth draft/i)).not.toBeInTheDocument();
  });

  it("submits a website source from the empty state", () => {
    const onSubmitSource = vi.fn();

    render(<SetupReviewRoomSurface sourceValue="weneox.com" onSubmitSource={onSubmitSource} reviewRoom={baseRoom()} />);

    fireEvent.click(screen.getByRole("button", { name: "Oxu" }));

    expect(onSubmitSource).toHaveBeenCalledTimes(1);
  });

  it("renders polished truth draft from source analysis", () => {
    render(<SetupReviewRoomSurface sourceValue="" reviewRoom={polishedRoom()} />);

    expect(screen.getByText(/ai biznes truth draft/i)).toBeInTheDocument();
    expect(screen.getByText(/business identity/i)).toBeInTheDocument();
    expect(screen.getAllByText(/atlas clinic/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/atlas clinic provides dental care/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/consultation/i)).toBeInTheDocument();
    expect(screen.getByText(/ai safety/i)).toBeInTheDocument();
    expect(screen.queryByText(/^faktlar$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/80%/i)).not.toBeInTheDocument();
  });

  it("renders manual brief or partial assistant state visibly", () => {
    render(
      <SetupReviewRoomSurface
        sourceValue=""
        reviewRoom={baseRoom({
          polishedTruthDraft: {
            title: "Men bunu anladim",
            subtitle: "Bakida klinika oldugunuzu anladim.",
            businessIdentity: { description: "Bakida klinika oldugunuzu anladim." },
            whatThisBusinessDoes: "Bakida klinika oldugunuzu anladim.",
            services: [],
            contacts: [],
            safeAiBehavior: { canSay: ["Bakida klinika oldugunuzu anladim."], shouldNotSay: ["Do not invent facts."], handoffRules: [] },
            missingQuestions: [{ key: "services", label: "Services", prompt: "Esas xidmetleri yazin." }],
          },
        })}
      />
    );

    expect(screen.getByText(/men bunu anladim/i)).toBeInTheDocument();
    expect(screen.getByText(/esas xidmetleri yazin/i)).toBeInTheDocument();
  });

  it("hides fake missing or empty-answer blockers", () => {
    render(
      <SetupReviewRoomSurface
        sourceValue=""
        reviewRoom={baseRoom({
          sectionDetails: [
            {
              key: "profile",
              title: "Profile",
              sourceBacked: true,
              facts: [{ key: "companyName", label: "Business name", value: "Atlas Clinic" }],
              items: [],
            },
          ],
          issues: [{ id: "bad-empty", severity: "blocking", section: "missing", message: "Empty answer" }],
        })}
      />
    );

    expect(screen.getByText(/ai biznes truth draft/i)).toBeInTheDocument();
    expect(screen.queryByText(/empty answer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/.at..mayan suallar/i)).not.toBeInTheDocument();
  });

  it("reveals approval when truth can be approved", () => {
    const onAction = vi.fn();

    render(
      <SetupReviewRoomSurface
        sourceValue=""
        onAction={onAction}
        reviewRoom={polishedRoom({
          readyForApproval: true,
          actions: { primary: { id: "approve_and_publish_truth", label: "Approve", intent: "finalize_review", enabled: true } },
          approvalPreview: { canApprove: true },
        })}
      />
    );

    expect(screen.getByText(/t.sdiql.m.y. haz.rd.r/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /t.sdiql/i }));

    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ id: "approve_and_publish_truth" }));
  });

  it("hides approval until the review is actually approvable", () => {
    render(
      <SetupReviewRoomSurface
        sourceValue=""
        reviewRoom={polishedRoom({
          readyForApproval: false,
          actions: { primary: { id: "continue_setup", label: "Continue", intent: "continue_setup", enabled: true } },
          approvalPreview: { canApprove: false },
        })}
      />
    );

    expect(screen.queryByText(/t.sdiql.m.y. haz.rd.r/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /t.sdiql/i })).not.toBeInTheDocument();
  });
});
