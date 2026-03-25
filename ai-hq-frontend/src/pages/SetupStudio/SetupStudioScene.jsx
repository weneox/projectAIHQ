import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { RefreshCw } from "lucide-react";

import { TinyChip, TinyLabel } from "./components/SetupStudioUi.jsx";

import SetupStudioEntryStage from "./stages/SetupStudioEntryStage.jsx";
import SetupStudioScanningStage from "./stages/SetupStudioScanningStage.jsx";
import SetupStudioIdentityStage from "./stages/SetupStudioIdentityStage.jsx";
import SetupStudioKnowledgeStage from "./stages/SetupStudioKnowledgeStage.jsx";
import SetupStudioServiceStage from "./stages/SetupStudioServiceStage.jsx";
import SetupStudioReadyStage from "./stages/SetupStudioReadyStage.jsx";
import SetupStudioRefineModal from "./components/SetupStudioRefineModal.jsx";
import FocusDialog from "../../components/ui/FocusDialog.jsx";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function sourceLabelFromProps(discoveryState = {}, discoveryModeLabel) {
  return s(
    discoveryState?.sourceLabel ||
      (typeof discoveryModeLabel === "function"
        ? discoveryModeLabel(discoveryState?.lastSourceType)
        : "")
  );
}

function hasText(value = "") {
  return !!s(value);
}

function hasManualDraftInput({
  businessForm = {},
  manualSections = {},
  discoveryForm = {},
  discoveryState = {},
}) {
  const form = obj(businessForm);
  const sections = obj(manualSections);
  const discovery = obj(discoveryForm);
  const state = obj(discoveryState);

  return !!(
    hasText(form.companyName) ||
    hasText(form.description) ||
    hasText(form.primaryPhone) ||
    hasText(form.primaryEmail) ||
    hasText(form.primaryAddress) ||
    hasText(form.websiteUrl) ||
    hasText(form.timezone) ||
    hasText(form.language) ||
    hasText(sections.servicesText) ||
    hasText(sections.faqsText) ||
    hasText(sections.policiesText) ||
    hasText(discovery.note) ||
    hasText(state.manualTranscript) ||
    hasText(state.manualSummary)
  );
}

function hasVoiceDraftInput({ discoveryForm = {}, discoveryState = {} }) {
  const discovery = obj(discoveryForm);
  const state = obj(discoveryState);

  return !!(
    hasText(discovery.voiceTranscript) ||
    hasText(discovery.voiceNote) ||
    hasText(discovery.voiceText) ||
    hasText(state.voiceTranscript) ||
    hasText(state.voiceNote) ||
    hasText(state.voiceText) ||
    hasText(state.audioTranscript)
  );
}

function ReviewSyncBanner({ reviewSyncState = {}, onReloadReviewDraft }) {
  const state = obj(reviewSyncState);
  const level = s(state.level);
  const message = s(state.message);

  if (!message || level === "idle" || level === "ready") return null;

  const showRecoveryAction =
    typeof onReloadReviewDraft === "function" &&
    (level === "conflict" || level === "stale" || level === "mismatch");

  const tone =
    level === "conflict" || level === "stale"
      ? "border-amber-200 bg-amber-50/90 text-amber-900"
      : "border-slate-200 bg-slate-50/90 text-slate-700";

  return (
    <div className={`rounded-[24px] border px-4 py-3 text-sm ${tone}`}>
      <div className="font-medium">
        {level === "conflict"
          ? "Review conflict detected"
          : level === "stale"
            ? "Review is stale"
            : level === "mismatch"
              ? "Review/source mismatch"
              : "Review protection is limited"}
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <div className="leading-6">{message}</div>
        {showRecoveryAction ? (
          <button
            type="button"
            onClick={onReloadReviewDraft}
            className="inline-flex h-9 items-center justify-center rounded-full border border-current/20 bg-white/60 px-3 text-xs font-medium transition hover:bg-white/80"
          >
            Reload draft
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function SetupStudioScene({
  loading,
  refreshing,
  importingWebsite,
  savingBusiness,
  actingKnowledgeId,
  savingServiceSuggestion,
  showRefine,
  showKnowledge,
  error,
  businessForm,
  discoveryForm,
  discoveryState,
  reviewDraft,
  manualSections,
  meta,
  currentTitle,
  currentDescription,
  discoveryProfileRows,
  knowledgePreview,
  knowledgeItems = [],
  serviceSuggestionTitle,
  studioProgress,
  services = [],
  reviewSources = [],
  reviewEvents = [],
  reviewSyncState = {},
  hasVisibleResults,
  hasStoredReview = false,
  hasApprovedTruth = false,
  visibleKnowledgeCount = 0,
  visibleServiceCount = 0,
  onSetBusinessField,
  onSetManualSection,
  onSetDiscoveryField,
  onContinueFlow,
  onResumeReview,
  onSaveBusiness,
  onApproveKnowledge,
  onRejectKnowledge,
  onCreateSuggestedService,
  onOpenWorkspace,
  onOpenTruth,
  onReloadReviewDraft,
  onRefresh,
  onToggleRefine,
  onToggleKnowledge,
  discoveryModeLabel,
}) {
  const [stage, setStage] = useState("entry");
  const [entryLocked, setEntryLocked] = useState(true);

  const sourceLabel = useMemo(
    () => sourceLabelFromProps(discoveryState, discoveryModeLabel),
    [discoveryState, discoveryModeLabel]
  );

  const scanningSourceType = useMemo(() => {
    return s(
      discoveryState?.lastSourceType ||
        discoveryForm?.sourceType ||
        reviewDraft?.sourceType
    );
  }, [
    discoveryState?.lastSourceType,
    discoveryForm?.sourceType,
    reviewDraft?.sourceType,
  ]);

  const hasSourceInput = useMemo(() => {
    return !!s(
      discoveryState?.lastUrl ||
        discoveryForm?.sourceValue ||
        discoveryForm?.websiteUrl
    );
  }, [
    discoveryState?.lastUrl,
    discoveryForm?.sourceValue,
    discoveryForm?.websiteUrl,
  ]);

  const hasManualInput = useMemo(() => {
    return hasManualDraftInput({
      businessForm,
      manualSections,
      discoveryForm,
      discoveryState,
    });
  }, [businessForm, manualSections, discoveryForm, discoveryState]);

  const hasVoiceInput = useMemo(() => {
    return hasVoiceDraftInput({
      discoveryForm,
      discoveryState,
    });
  }, [discoveryForm, discoveryState]);

  const scanLines = useMemo(() => {
    return arr(
      discoveryState?.scanLines ||
        discoveryState?.progressLines ||
        discoveryState?.analysisSteps
    );
  }, [
    discoveryState?.scanLines,
    discoveryState?.progressLines,
    discoveryState?.analysisSteps,
  ]);

  const scanLineIndex = useMemo(() => {
    const candidates = [
      discoveryState?.scanLineIndex,
      discoveryState?.progressIndex,
      discoveryState?.analysisStepIndex,
    ];

    for (const value of candidates) {
      const x = Number(value);
      if (Number.isFinite(x)) return x;
    }

    return 0;
  }, [
    discoveryState?.scanLineIndex,
    discoveryState?.progressIndex,
    discoveryState?.analysisStepIndex,
  ]);

  const hasServiceStage = useMemo(() => {
    return (
      !!s(serviceSuggestionTitle) ||
      arr(services).length > 0 ||
      visibleServiceCount > 0
    );
  }, [serviceSuggestionTitle, services, visibleServiceCount]);

  const hasAnyReviewContent = useMemo(() => {
    return !!(
      arr(discoveryProfileRows).length ||
      arr(knowledgeItems).length ||
      arr(services).length ||
      arr(reviewSources).length ||
      arr(reviewEvents).length ||
      arr(discoveryState?.warnings).length
    );
  }, [
    discoveryProfileRows,
    knowledgeItems,
    services,
    reviewSources,
    reviewEvents,
    discoveryState?.warnings,
  ]);

  useEffect(() => {
    const mode = s(discoveryState?.mode).toLowerCase();
    const forcedReady =
      !!meta?.setupCompleted ||
      s(studioProgress?.nextStudioStage).toLowerCase() === "ready";

    if (importingWebsite || mode === "running") {
      setStage("scanning");
      return;
    }

     if (entryLocked) {
      setStage("entry");
      return;
    }

    if (!hasVisibleResults && !hasAnyReviewContent) {
      setStage("entry");
      return;
    }

    if (forcedReady) {
      setStage("ready");
      return;
    }

    setStage((prev) => {
      if (prev === "entry" || prev === "scanning") {
        if (showKnowledge && visibleKnowledgeCount > 0) return "knowledge";
        return "identity";
      }

      if (prev === "knowledge" && visibleKnowledgeCount <= 0) {
        return hasServiceStage ? "service" : "ready";
      }

      if (prev === "service" && !hasServiceStage) {
        return "ready";
      }

      return prev;
    });
  }, [
    importingWebsite,
    discoveryState?.mode,
    hasVisibleResults,
    hasAnyReviewContent,
    studioProgress?.nextStudioStage,
    meta?.setupCompleted,
    visibleKnowledgeCount,
    hasServiceStage,
    showKnowledge,
    entryLocked,
  ]);

  function goNextFromIdentity() {
    if (visibleKnowledgeCount > 0) {
      setStage("knowledge");
      return;
    }

    if (hasServiceStage) {
      setStage("service");
      return;
    }

    setStage("ready");
  }

  function goNextFromKnowledge() {
    if (hasServiceStage) {
      setStage("service");
      return;
    }

    setStage("ready");
  }

  function goNextFromService() {
    setStage("ready");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="rounded-full border border-white/80 bg-[rgba(250,250,250,.82)] px-4 py-2 text-sm text-slate-600 shadow-[0_10px_24px_-20px_rgba(15,23,42,.28)] backdrop-blur-[10px]">
          Preparing Setup Studio...
        </div>
      </div>
    );
  }

  if (stage === "entry") {
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
          onContinueFlow={() => {
            setEntryLocked(false);
            onContinueFlow?.();
          }}
          onResumeReview={() => {
            setEntryLocked(false);
            onResumeReview?.();
          }}
          onOpenReviewWorkspace={onToggleRefine}
          onOpenTruth={onOpenTruth}
        />

        <AnimatePresence>
          {showRefine ? (
            <FocusDialog
              open={showRefine}
              onClose={onToggleRefine}
              title="Review workspace"
              backdropClassName="bg-[rgba(15,23,42,.18)] backdrop-blur-[14px]"
              panelClassName="w-full max-w-[1180px]"
            >
              <div>
                <div className="mb-3">
                  <ReviewSyncBanner
                    reviewSyncState={reviewSyncState}
                    onReloadReviewDraft={onReloadReviewDraft}
                  />
                </div>
                <SetupStudioRefineModal
                  savingBusiness={savingBusiness}
                  businessForm={businessForm}
                  discoveryProfileRows={discoveryProfileRows}
                  manualSections={manualSections}
                  onSetBusinessField={onSetBusinessField}
                  onSetManualSection={onSetManualSection}
                  onSaveBusiness={onSaveBusiness}
                  onClose={onToggleRefine}
                  reviewDraft={reviewDraft}
                  reviewSources={reviewSources}
                  reviewSyncState={reviewSyncState}
                />
              </div>
            </FocusDialog>
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
              <TinyChip>{sourceLabel ? sourceLabel : "Draft flow"}</TinyChip>
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
            <ReviewSyncBanner
              reviewSyncState={reviewSyncState}
              onReloadReviewDraft={onReloadReviewDraft}
            />
          </div>

          <AnimatePresence mode="wait">
            {stage === "scanning" ? (
              <SetupStudioScanningStage
                key="scanning"
                lastUrl={discoveryState?.lastUrl}
                sourceType={scanningSourceType}
                hasSourceInput={hasSourceInput}
                hasManualInput={hasManualInput}
                hasVoiceInput={hasVoiceInput}
                scanLines={scanLines}
                scanLineIndex={scanLineIndex}
              />
            ) : null}

            {stage === "identity" ? (
              <SetupStudioIdentityStage
                key="identity"
                currentTitle={currentTitle}
                currentDescription={currentDescription}
                discoveryProfileRows={discoveryProfileRows}
                discoveryWarnings={arr(discoveryState?.warnings)}
                sourceLabel={sourceLabel}
                reviewSources={reviewSources}
                onNext={goNextFromIdentity}
                onToggleRefine={onToggleRefine}
              />
            ) : null}

            {stage === "knowledge" ? (
              <SetupStudioKnowledgeStage
                key="knowledge"
                knowledgePreview={knowledgePreview}
                knowledgeItems={knowledgeItems}
                actingKnowledgeId={actingKnowledgeId}
                sourceLabel={sourceLabel}
                warnings={arr(discoveryState?.warnings)}
                onApproveKnowledge={onApproveKnowledge}
                onRejectKnowledge={onRejectKnowledge}
                onNext={goNextFromKnowledge}
                onToggleKnowledge={onToggleKnowledge}
              />
            ) : null}

            {stage === "service" ? (
              <SetupStudioServiceStage
                key="service"
                serviceSuggestionTitle={serviceSuggestionTitle}
                meta={meta}
                services={services}
                savingServiceSuggestion={savingServiceSuggestion}
                onCreateSeed={async () => {
                  await onCreateSuggestedService?.();
                }}
                onSkip={goNextFromService}
              />
            ) : null}

            {stage === "ready" ? (
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
        {showRefine ? (
          <FocusDialog
            open={showRefine}
            onClose={onToggleRefine}
            title="Review workspace"
            backdropClassName="bg-[rgba(15,23,42,.18)] backdrop-blur-[14px]"
            panelClassName="w-full max-w-[1180px]"
          >
            <div>
              <div className="mb-3">
                <ReviewSyncBanner
                  reviewSyncState={reviewSyncState}
                  onReloadReviewDraft={onReloadReviewDraft}
                />
              </div>
              <SetupStudioRefineModal
                savingBusiness={savingBusiness}
                businessForm={businessForm}
                discoveryProfileRows={discoveryProfileRows}
                manualSections={manualSections}
                onSetBusinessField={onSetBusinessField}
                onSetManualSection={onSetManualSection}
                onSaveBusiness={onSaveBusiness}
                onClose={onToggleRefine}
                reviewDraft={reviewDraft}
                reviewSources={reviewSources}
                reviewSyncState={reviewSyncState}
              />
            </div>
          </FocusDialog>
        ) : null}
      </AnimatePresence>
    </>
  );
}
