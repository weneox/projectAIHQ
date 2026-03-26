import { AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";

import { TinyChip, TinyLabel } from "./components/SetupStudioUi.jsx";

import SetupStudioEntryStage from "./stages/SetupStudioEntryStage.jsx";
import SetupStudioScanningStage from "./stages/SetupStudioScanningStage.jsx";
import SetupStudioIdentityStage from "./stages/SetupStudioIdentityStage.jsx";
import SetupStudioKnowledgeStage from "./stages/SetupStudioKnowledgeStage.jsx";
import SetupStudioServiceStage from "./stages/SetupStudioServiceStage.jsx";
import SetupStudioReadyStage from "./stages/SetupStudioReadyStage.jsx";
import SetupStudioReviewWorkspaceDialog, {
  SetupStudioReviewSyncBanner,
} from "./components/SetupStudioReviewWorkspaceDialog.jsx";
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
    refreshing,
    importingWebsite,
    savingBusiness,
    actingKnowledgeId,
    savingServiceSuggestion,
    showRefine,
    showKnowledge,
    error,
  } = obj(status);
  const { businessForm, discoveryForm, manualSections } = obj(forms);
  const {
    discoveryState,
    reviewDraft,
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
    refresh: onRefresh,
    toggleRefine: onToggleRefine,
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
    reviewDraft,
    businessForm,
    manualSections,
    showRefine,
    savingBusiness,
    discoveryProfileRows,
    onSetBusinessField,
    onSetManualSection,
    onSaveBusiness,
    onReloadReviewDraft,
    onToggleRefine,
    reviewSources,
    reviewSyncState,
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="rounded-full border border-white/80 bg-[rgba(250,250,250,.82)] px-4 py-2 text-sm text-slate-600 shadow-[0_10px_24px_-20px_rgba(15,23,42,.28)] backdrop-blur-[10px]">
          Preparing Setup Studio...
        </div>
      </div>
    );
  }

  if (stageFlow.stage === "entry") {
    return (
      <>
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
          onOpenReviewWorkspace={onToggleRefine}
          onOpenTruth={onOpenTruth}
        />

        <AnimatePresence>
          {showRefine ? (
            <SetupStudioReviewWorkspaceDialog
              {...sceneView.reviewWorkspaceDialogProps}
            />
          ) : null}
        </AnimatePresence>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen overflow-y-auto">
        <main className="mx-auto w-full max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <TinyLabel>Setup Studio</TinyLabel>
              <TinyChip>
                {sceneView.sourceLabel ? sceneView.sourceLabel : "Draft flow"}
              </TinyChip>
            </div>

            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/80 bg-[rgba(250,250,250,.82)] px-4 text-sm font-medium text-slate-700 shadow-[0_10px_24px_-20px_rgba(15,23,42,.28)] backdrop-blur-[10px] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>

          <div className="mb-6">
            <SetupStudioReviewSyncBanner
              reviewSyncState={reviewSyncState}
              onReloadReviewDraft={onReloadReviewDraft}
            />
          </div>

          <AnimatePresence mode="wait">
            {stageFlow.stage === "scanning" ? (
              <SetupStudioScanningStage
                key="scanning"
                lastUrl={discoveryState?.lastUrl}
                sourceType={sceneView.scanningView.sourceType}
                hasSourceInput={sceneView.scanningView.hasSourceInput}
                hasManualInput={sceneView.scanningView.hasManualInput}
                hasVoiceInput={sceneView.scanningView.hasVoiceInput}
                scanLines={sceneView.scanningView.scanLines}
                scanLineIndex={sceneView.scanningView.scanLineIndex}
              />
            ) : null}

            {stageFlow.stage === "identity" ? (
              <SetupStudioIdentityStage
                key="identity"
                currentTitle={currentTitle}
                currentDescription={currentDescription}
                discoveryProfileRows={discoveryProfileRows}
                discoveryWarnings={sceneView.discoveryWarnings}
                sourceLabel={sceneView.sourceLabel}
                reviewSources={reviewSources}
                onNext={stageFlow.goNextFromIdentity}
                onToggleRefine={onToggleRefine}
              />
            ) : null}

            {stageFlow.stage === "knowledge" ? (
              <SetupStudioKnowledgeStage
                key="knowledge"
                knowledgePreview={knowledgePreview}
                knowledgeItems={knowledgeItems}
                actingKnowledgeId={actingKnowledgeId}
                sourceLabel={sceneView.sourceLabel}
                warnings={sceneView.discoveryWarnings}
                onApproveKnowledge={onApproveKnowledge}
                onRejectKnowledge={onRejectKnowledge}
                onNext={stageFlow.goNextFromKnowledge}
                onToggleKnowledge={onToggleKnowledge}
              />
            ) : null}

            {stageFlow.stage === "service" ? (
              <SetupStudioServiceStage
                key="service"
                serviceSuggestionTitle={serviceSuggestionTitle}
                meta={meta}
                services={services}
                savingServiceSuggestion={savingServiceSuggestion}
                onCreateSeed={async () => {
                  await onCreateSuggestedService?.();
                }}
                onSkip={stageFlow.goNextFromService}
              />
            ) : null}

            {stageFlow.stage === "ready" ? (
              <SetupStudioReadyStage
                key="ready"
                meta={meta}
                studioProgress={studioProgress}
                hasKnowledge={visibleKnowledgeCount > 0}
                onToggleRefine={onToggleRefine}
                onToggleKnowledge={onToggleKnowledge}
                onOpenTruth={onOpenTruth}
                onOpenWorkspace={onOpenWorkspace}
              />
            ) : null}
          </AnimatePresence>

          {error ? (
            <div className="mt-6 rounded-[24px] border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </main>
      </div>

      <AnimatePresence>
        <SetupStudioReviewWorkspaceDialog
          {...sceneView.reviewWorkspaceDialogProps}
        />
      </AnimatePresence>
    </>
  );
}
