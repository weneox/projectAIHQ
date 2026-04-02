import { AnimatePresence } from "framer-motion";
import React from "react";

import Button from "../../components/ui/Button.jsx";
import { InlineCallout } from "../../components/ui/PageSection.jsx";
import { useSetupStudioSceneView } from "./hooks/useSetupStudioSceneView.js";
import { useSetupStudioStageFlow } from "./hooks/useSetupStudioStageFlow.js";
import SetupStudioEntryStage from "./stages/SetupStudioEntryStage.jsx";
import SetupStudioScanningStage from "./stages/SetupStudioScanningStage.jsx";
import SetupStudioReviewStage from "./stages/SetupStudioReviewStage.jsx";
import SetupStudioConfirmStage from "./stages/SetupStudioConfirmStage.jsx";

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

export default function SetupStudioScene({
  status,
  forms,
  review,
  content,
  actions,
  discoveryModeLabel,
}) {
  const {
    loading,
    importingWebsite,
    savingBusiness,
    showKnowledge,
    error,
  } = obj(status);

  const { businessForm, discoveryForm, manualSections } = obj(forms);

  const {
    discoveryState,
    currentReview,
    meta,
    reviewSources = [],
    reviewEvents = [],
    reviewSyncState = {},
    hasStoredReview = false,
    hasApprovedTruth = false,
  } = obj(review);

  const {
    currentTitle,
    currentDescription,
    discoveryProfileRows,
    knowledgeItems = [],
    serviceSuggestionTitle,
    services = [],
    hasVisibleResults,
  } = obj(content);

  const {
    setBusinessField: onSetBusinessField,
    setManualSection: onSetManualSection,
    setDiscoveryField: onSetDiscoveryField,
    continueFlow: onContinueFlow,
    resumeReview: onResumeReview,
    saveBusiness: onSaveBusiness,
    openWorkspace: onOpenWorkspace,
    openWorkspacePreview: onOpenWorkspacePreview,
    reloadReviewDraft: onReloadReviewDraft,
    refresh: onRefresh,
    toggleKnowledge: onToggleKnowledge,
  } = obj(actions);

  const stageFlow = useSetupStudioStageFlow({
    importingWebsite,
    discoveryMode: discoveryState?.mode,
    nextStudioStage: meta?.nextStudioStage,
    hasVisibleResults,
    discoveryProfileRows,
    knowledgeItems,
    services,
    reviewSources,
    reviewEvents,
    discoveryWarnings: discoveryState?.warnings,
    onContinueFlow,
    onResumeReview,
  });

  const sceneView = useSetupStudioSceneView({
    discoveryState,
    discoveryModeLabel,
    discoveryForm,
    currentReview,
    businessForm,
    manualSections,
  });

  const handleConfirmSubmit = React.useCallback(async () => {
    if (typeof onSaveBusiness !== "function") return;

    const result = await onSaveBusiness();
    if (result?.ok && typeof onOpenWorkspace === "function") {
      onOpenWorkspace();
    }
  }, [onOpenWorkspace, onSaveBusiness]);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent">
        <div className="mx-auto flex min-h-screen w-full max-w-[1120px] items-center justify-center px-6">
          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
            Preparing setup...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <main className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <AnimatePresence mode="wait">
          {stageFlow.stage === "entry" ? (
            <SetupStudioEntryStage
              key="entry"
              importingWebsite={importingWebsite}
              discoveryForm={discoveryForm}
              businessForm={businessForm}
              hasStoredReview={hasStoredReview}
              hasApprovedTruth={hasApprovedTruth}
              onSetBusinessField={onSetBusinessField}
              onSetDiscoveryField={onSetDiscoveryField}
              onContinueFlow={stageFlow.handleContinueFromEntry}
              onResumeReview={stageFlow.handleResumeFromEntry}
              onOpenWorkspace={onOpenWorkspace}
              onOpenWorkspacePreview={onOpenWorkspacePreview}
            />
          ) : null}

          {stageFlow.stage === "scanning" ? (
            <SetupStudioScanningStage
              key="scanning"
              lastUrl={discoveryState?.lastUrl}
              sourceType={sceneView.scanningView.sourceType}
              hasSourceInput={sceneView.scanningView.hasSourceInput}
              hasManualInput={sceneView.scanningView.hasManualInput}
              scanLines={sceneView.scanningView.scanLines}
              scanLineIndex={sceneView.scanningView.scanLineIndex}
            />
          ) : null}

          {stageFlow.stage === "review" ? (
            <SetupStudioReviewStage
              key="review"
              currentTitle={currentTitle}
              currentDescription={currentDescription}
              discoveryProfileRows={discoveryProfileRows}
              discoveryWarnings={sceneView.discoveryWarnings}
              sourceLabel={sceneView.sourceLabel}
              knowledgeItems={knowledgeItems}
              showKnowledge={showKnowledge}
              serviceSuggestionTitle={serviceSuggestionTitle}
              services={services}
              onToggleKnowledge={onToggleKnowledge}
              onNext={stageFlow.goToConfirm}
              onBack={stageFlow.goToEntry}
            />
          ) : null}

          {stageFlow.stage === "confirm" ? (
            <SetupStudioConfirmStage
              key="confirm"
              savingBusiness={savingBusiness}
              businessForm={businessForm}
              manualSections={manualSections}
              currentReview={currentReview}
              reviewSyncState={reviewSyncState}
              onSetBusinessField={onSetBusinessField}
              onSetManualSection={onSetManualSection}
              onReloadReviewDraft={onReloadReviewDraft}
              onBack={stageFlow.goToReview}
              onSubmit={handleConfirmSubmit}
            />
          ) : null}
        </AnimatePresence>

        {error ? (
          <div className="mt-6">
            <InlineCallout
              title="Setup data could not be loaded"
              body={error}
              tone="danger"
              action={
                typeof onRefresh === "function" ? (
                  <Button type="button" variant="surface" size="pill" onClick={() => onRefresh()}>
                    Retry setup load
                  </Button>
                ) : null
              }
            />
          </div>
        ) : null}
      </main>
    </div>
  );
}
