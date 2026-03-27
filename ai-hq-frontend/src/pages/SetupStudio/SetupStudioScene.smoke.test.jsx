/* @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SetupStudioScene from "./SetupStudioScene.jsx";

globalThis.React = React;

afterEach(() => {
  cleanup();
});

function noop() {}

describe("Setup Studio entry smoke", () => {
  it("opens on entry first and shows explicit review/truth actions when relevant", () => {
    render(
      <SetupStudioScene
        status={{
          loading: false,
          refreshing: false,
          importingWebsite: false,
          savingBusiness: false,
          actingKnowledgeId: "",
          savingServiceSuggestion: "",
          showRefine: false,
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
          openWorkspace: noop,
          openTruth: noop,
          reloadReviewDraft: noop,
          refresh: noop,
          toggleRefine: noop,
          toggleKnowledge: noop,
        }}
        discoveryModeLabel={() => "Draft flow"}
      />
    );

    expect(
      screen.getByRole("heading", {
        name: /build your business draft from real signals/i,
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /create draft/i })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /resume review/i })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /open review workspace/i })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /view approved truth/i })
    ).toBeTruthy();
  });
});
