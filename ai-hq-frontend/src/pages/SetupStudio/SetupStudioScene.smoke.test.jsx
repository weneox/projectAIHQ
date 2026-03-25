import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SetupStudioScene from "./SetupStudioScene.jsx";

afterEach(() => {
  cleanup();
});

function noop() {}

describe("Setup Studio entry smoke", () => {
  it("opens on entry first and shows explicit review/truth actions when relevant", () => {
    render(
      <SetupStudioScene
        loading={false}
        refreshing={false}
        importingWebsite={false}
        savingBusiness={false}
        actingKnowledgeId=""
        savingServiceSuggestion=""
        showRefine={false}
        showKnowledge={false}
        error=""
        businessForm={{}}
        discoveryForm={{}}
        discoveryState={{ mode: "idle" }}
        reviewDraft={{}}
        manualSections={{}}
        meta={{ setupCompleted: false }}
        currentTitle=""
        currentDescription=""
        discoveryProfileRows={[]}
        knowledgePreview=""
        knowledgeItems={[]}
        serviceSuggestionTitle=""
        studioProgress={{ nextStudioStage: "" }}
        services={[]}
        reviewSources={[]}
        reviewEvents={[]}
        reviewSyncState={{}}
        hasVisibleResults={false}
        hasStoredReview
        hasApprovedTruth
        visibleKnowledgeCount={0}
        visibleServiceCount={0}
        onSetBusinessField={noop}
        onSetManualSection={noop}
        onSetDiscoveryField={noop}
        onContinueFlow={noop}
        onResumeReview={noop}
        onSaveBusiness={noop}
        onApproveKnowledge={noop}
        onRejectKnowledge={noop}
        onCreateSuggestedService={vi.fn()}
        onOpenWorkspace={noop}
        onOpenTruth={noop}
        onReloadReviewDraft={noop}
        onRefresh={noop}
        onToggleRefine={noop}
        onToggleKnowledge={noop}
        discoveryModeLabel={() => "Draft flow"}
      />
    );

    expect(
      screen.getByRole("heading", {
        name: /build your business draft from real signals/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create draft/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /resume review/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /open review workspace/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /view approved truth/i })
    ).toBeInTheDocument();
  });
});
