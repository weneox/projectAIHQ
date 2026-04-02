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
  it("opens on entry first and shows the simplified setup actions", () => {
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
          openWorkspace: noop,
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
  });
});
