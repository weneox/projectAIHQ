/* @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SetupStudioScene from "./SetupStudioScene.jsx";

globalThis.React = React;

afterEach(() => {
  cleanup();
});

function noop() {}

describe("Setup Studio entry smoke", () => {
  it("opens on entry first and shows the simplified setup actions", () => {
    const openWorkspace = vi.fn();
    const openWorkspacePreview = vi.fn();

    render(
      <SetupStudioScene
        status={{
          loading: false,
          refreshing: false,
          importingWebsite: false,
          savingBusiness: false,
          actingKnowledgeId: "",
          savingServiceSuggestion: "",
          showKnowledge: false,
          error: "",
        }}
        forms={{
          businessForm: {},
          discoveryForm: {},
          manualSections: {},
        }}
        review={{
          discoveryState: { mode: "idle" },
          currentReview: {},
          meta: { setupCompleted: false },
          reviewSources: [],
          reviewEvents: [],
          reviewSyncState: {},
          hasStoredReview: true,
          hasApprovedTruth: true,
        }}
        content={{
          currentTitle: "",
          currentDescription: "",
          discoveryProfileRows: [],
          knowledgePreview: "",
          knowledgeItems: [],
          serviceSuggestionTitle: "",
          studioProgress: { nextStudioStage: "" },
          services: [],
          hasVisibleResults: false,
          visibleKnowledgeCount: 0,
          visibleServiceCount: 0,
        }}
        actions={{
          setBusinessField: noop,
          setManualSection: noop,
          setDiscoveryField: noop,
          continueFlow: noop,
          resumeReview: noop,
          saveBusiness: noop,
          approveKnowledge: noop,
          rejectKnowledge: noop,
          createSuggestedService: vi.fn(),
          openWorkspace,
          openWorkspacePreview,
          reloadReviewDraft: noop,
          refresh: noop,
          toggleKnowledge: noop,
        }}
        discoveryModeLabel={() => "Draft flow"}
      />
    );

    expect(
      screen.getByRole("heading", {
        name: /tell us about your business/i,
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /build draft/i })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /continue draft/i })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /enter workspace/i })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /^open workspace$/i })
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^open workspace$/i }));

    expect(openWorkspacePreview).toHaveBeenCalledTimes(1);
    expect(openWorkspace).not.toHaveBeenCalled();
  });

  it("keeps the main build draft CTA working with the shared visual system", () => {
    const continueFlow = vi.fn();

    render(
      <SetupStudioScene
        status={{
          loading: false,
          refreshing: false,
          importingWebsite: false,
          savingBusiness: false,
          actingKnowledgeId: "",
          savingServiceSuggestion: "",
          showKnowledge: false,
          error: "",
        }}
        forms={{
          businessForm: {},
          discoveryForm: { note: "Bakery with custom cakes" },
          manualSections: {},
        }}
        review={{
          discoveryState: { mode: "idle" },
          currentReview: {},
          meta: { setupCompleted: false },
          reviewSources: [],
          reviewEvents: [],
          reviewSyncState: {},
          hasStoredReview: false,
          hasApprovedTruth: false,
        }}
        content={{
          currentTitle: "",
          currentDescription: "",
          discoveryProfileRows: [],
          knowledgePreview: "",
          knowledgeItems: [],
          serviceSuggestionTitle: "",
          studioProgress: { nextStudioStage: "" },
          services: [],
          hasVisibleResults: false,
          visibleKnowledgeCount: 0,
          visibleServiceCount: 0,
        }}
        actions={{
          setBusinessField: noop,
          setManualSection: noop,
          setDiscoveryField: noop,
          continueFlow,
          resumeReview: noop,
          saveBusiness: noop,
          approveKnowledge: noop,
          rejectKnowledge: noop,
          createSuggestedService: vi.fn(),
          openWorkspace: noop,
          openWorkspacePreview: noop,
          reloadReviewDraft: noop,
          refresh: noop,
          toggleKnowledge: noop,
        }}
        discoveryModeLabel={() => "Draft flow"}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /build draft/i }));
    expect(continueFlow).toHaveBeenCalledTimes(1);
  });

  it("shows a visible retry action when background loading fails", () => {
    const refresh = vi.fn();

    render(
      <SetupStudioScene
        status={{
          loading: false,
          refreshing: false,
          importingWebsite: false,
          savingBusiness: false,
          actingKnowledgeId: "",
          savingServiceSuggestion: "",
          showKnowledge: false,
          error: "Workspace status could not be checked.",
        }}
        forms={{
          businessForm: {},
          discoveryForm: {},
          manualSections: {},
        }}
        review={{
          discoveryState: { mode: "idle" },
          currentReview: {},
          meta: { setupCompleted: false },
          reviewSources: [],
          reviewEvents: [],
          reviewSyncState: {},
          hasStoredReview: false,
          hasApprovedTruth: false,
        }}
        content={{
          currentTitle: "",
          currentDescription: "",
          discoveryProfileRows: [],
          knowledgePreview: "",
          knowledgeItems: [],
          serviceSuggestionTitle: "",
          studioProgress: { nextStudioStage: "" },
          services: [],
          hasVisibleResults: false,
          visibleKnowledgeCount: 0,
          visibleServiceCount: 0,
        }}
        actions={{
          setBusinessField: noop,
          setManualSection: noop,
          setDiscoveryField: noop,
          continueFlow: noop,
          resumeReview: noop,
          saveBusiness: noop,
          approveKnowledge: noop,
          rejectKnowledge: noop,
          createSuggestedService: vi.fn(),
          openWorkspace: noop,
          openWorkspacePreview: noop,
          reloadReviewDraft: noop,
          refresh,
          toggleKnowledge: noop,
        }}
        discoveryModeLabel={() => "Draft flow"}
      />
    );

    expect(screen.getByText(/workspace status could not be checked/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /retry setup load/i }));
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
