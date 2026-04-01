import { AnimatePresence } from "framer-motion";
import React, { useMemo } from "react";

import SetupStudioEntryStage from "./stages/SetupStudioEntryStage.jsx";
import SetupStudioScanningStage from "./stages/SetupStudioScanningStage.jsx";
import SetupStudioReviewStage from "./stages/SetupStudioReviewStage.jsx";
import { useSetupStudioStageFlow } from "./hooks/useSetupStudioStageFlow.js";
import { useSetupStudioSceneView } from "./hooks/useSetupStudioSceneView.js";

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
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
    actingKnowledgeId,
    savingServiceSuggestion,
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
    knowledgePreview,
    knowledgeItems = [],
    serviceSuggestionTitle,
    studioProgress,
    services = [],
    hasVisibleResults,
    visibleKnowledgeCount = 0,
    visibleServiceCount = 0,
  } = obj(content);

  const {
    setBusinessField: onSetBusinessField,
    setManualSection: onSetManualSection,
    setDiscoveryField: onSetDiscoveryField,
    continueFlow: onContinueFlow,
    resumeReview: onResumeReview,
    saveBusiness: onSaveBusiness,
    approveKnowledge: onApproveKnowledge,
    rejectKnowledge: onRejectKnowledge,
    createSuggestedService: onCreateSuggestedService,
    openWorkspace: onOpenWorkspace,
    openTruth: onOpenTruth,
    reloadReviewDraft: onReloadReviewDraft,
    toggleKnowledge: onToggleKnowledge,
  } = obj(actions);

  const stageFlow = useSetupStudioStageFlow({
    importingWebsite,
    discoveryMode: discoveryState?.mode,
    setupCompleted: meta?.setupCompleted,
    nextStudioStage: studioProgress?.nextStudioStage,
    hasVisibleResults,
    showKnowledge,
    visibleKnowledgeCount,
    visibleServiceCount,
    serviceSuggestionTitle,
    services,
    discoveryProfileRows,
    knowledgeItems,
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
    showRefine: false,
    savingBusiness,
    discoveryProfileRows,
    onSetBusinessField,
    onSetManualSection,
    onSaveBusiness,
    onReloadReviewDraft,
    onToggleRefine: undefined,
    reviewSources,
    reviewSyncState,
  });

  const activeStage = useMemo(() => {
    if (stageFlow.stage === "ready") return "review";
    return stageFlow.stage;
  }, [stageFlow.stage]);

  const handleReviewContinue = React.useCallback(() => {
    if (typeof onOpenWorkspace === "function") {
      onOpenWorkspace();
      return;
    }

    if (typeof stageFlow.goNextFromReview === "function") {
      stageFlow.goNextFromReview();
    }
  }, [onOpenWorkspace, stageFlow]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto flex min-h-screen w-full max-w-[1120px] items-center justify-center px-6">
          <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
            Preparing setup…
          </div>
        </div>
      </div>
    );
  }

  if (activeStage === "entry") {
    return (
      <div className="min-h-screen bg-white">
        <main className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <SetupStudioEntryStage
            importingWebsite={importingWebsite}
            discoveryForm={discoveryForm}
            businessForm={businessForm}
            manualSections={manualSections}
            hasStoredReview={hasStoredReview}
            hasApprovedTruth={hasApprovedTruth}
            onSetBusinessField={onSetBusinessField}
            onSetManualSection={onSetManualSection}
            onSetDiscoveryField={onSetDiscoveryField}
            onContinueFlow={stageFlow.handleContinueFromEntry}
            onResumeReview={stageFlow.handleResumeFromEntry}
            onOpenTruth={onOpenTruth}
          />

          {error ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <main className="mx-auto w-full max-w-[1120px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <AnimatePresence mode="wait">
          {activeStage === "scanning" ? (
            <SetupStudioScanningStage
              key="building"
              lastUrl={discoveryState?.lastUrl}
              sourceType={sceneView.scanningView.sourceType}
              hasSourceInput={sceneView.scanningView.hasSourceInput}
              hasManualInput={sceneView.scanningView.hasManualInput}
              hasVoiceInput={sceneView.scanningView.hasVoiceInput}
              scanLines={sceneView.scanningView.scanLines}
              scanLineIndex={sceneView.scanningView.scanLineIndex}
            />
          ) : null}

          {activeStage === "review" ? (
            <SetupStudioReviewStage
              key="review"
              meta={meta}
              currentTitle={currentTitle}
              currentDescription={currentDescription}
              discoveryProfileRows={discoveryProfileRows}
              discoveryWarnings={sceneView.discoveryWarnings}
              honestySummary={sceneView.honestySummary}
              sourceLabel={sceneView.sourceLabel}
              reviewSources={reviewSources}
              reviewEvents={reviewEvents}
              knowledgePreview={knowledgePreview}
              knowledgeItems={knowledgeItems}
              actingKnowledgeId={actingKnowledgeId}
              showKnowledge={showKnowledge}
              serviceSuggestionTitle={serviceSuggestionTitle}
              services={services}
              savingServiceSuggestion={savingServiceSuggestion}
              onApproveKnowledge={onApproveKnowledge}
              onRejectKnowledge={onRejectKnowledge}
              onCreateSuggestedService={onCreateSuggestedService}
              onToggleKnowledge={onToggleKnowledge}
              onNext={handleReviewContinue}
              onOpenTruth={onOpenTruth}
              onOpenWorkspace={onOpenWorkspace}
            />
          ) : null}
        </AnimatePresence>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
      </main>
    </div>
  );
}