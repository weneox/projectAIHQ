import { useMemo } from "react";
import { resolveReviewSourceInfo } from "../state/reviewState.js";
import { deriveCanonicalReviewProjection } from "../state/reviewState.js";
import { summarizeSetupStudioHonesty } from "../logic/reviewHonesty.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function hasText(value = "") {
  return !!s(value);
}

export function getSetupStudioSourceLabel(discoveryState = {}, discoveryModeLabel) {
  return s(
    discoveryState?.sourceLabel ||
      (typeof discoveryModeLabel === "function"
        ? discoveryModeLabel(discoveryState?.lastSourceType)
        : "")
  );
}

export function getSetupStudioHasManualInput({
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

export function getSetupStudioHasVoiceInput({
  discoveryForm = {},
  discoveryState = {},
}) {
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

export function getSetupStudioScanningView({
  discoveryState = {},
  discoveryForm = {},
  currentReview = {},
  businessForm = {},
  manualSections = {},
}) {
  const reviewInfo = resolveReviewSourceInfo(currentReview);
  const scanningSourceType = s(
    discoveryState?.lastSourceType ||
      discoveryForm?.sourceType ||
      reviewInfo?.sourceType
  );

  const hasSourceInput = !!s(
    discoveryState?.lastUrl ||
      discoveryForm?.sourceValue ||
      discoveryForm?.websiteUrl
  );

  const scanLines = arr(
    discoveryState?.scanLines ||
      discoveryState?.progressLines ||
      discoveryState?.analysisSteps
  );

  const candidates = [
    discoveryState?.scanLineIndex,
    discoveryState?.progressIndex,
    discoveryState?.analysisStepIndex,
  ];

  let scanLineIndex = 0;
  for (const value of candidates) {
    const x = Number(value);
    if (Number.isFinite(x)) {
      scanLineIndex = x;
      break;
    }
  }

  return {
    sourceType: scanningSourceType,
    hasSourceInput,
    hasManualInput: getSetupStudioHasManualInput({
      businessForm,
      manualSections,
      discoveryForm,
      discoveryState,
    }),
    hasVoiceInput: getSetupStudioHasVoiceInput({
      discoveryForm,
      discoveryState,
    }),
    scanLines,
    scanLineIndex,
  };
}

export function buildSetupStudioReviewWorkspaceDialogProps({
  showRefine,
  savingBusiness,
  businessForm,
  discoveryProfileRows,
  manualSections,
  onSetBusinessField,
  onSetManualSection,
  onSaveBusiness,
  onReloadReviewDraft,
  onToggleRefine,
  currentReview,
  reviewSources,
  reviewSyncState,
}) {
  return {
    open: showRefine,
    savingBusiness,
    businessForm,
    discoveryProfileRows,
    manualSections,
    onSetBusinessField,
    onSetManualSection,
    onSaveBusiness,
    onReloadReviewDraft,
    onClose: onToggleRefine,
    currentReview,
    reviewSources,
    reviewSyncState,
  };
}

export function useSetupStudioSceneView({
  discoveryState,
  discoveryModeLabel,
  discoveryForm,
  currentReview,
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
}) {
  const sourceLabel = useMemo(
    () => getSetupStudioSourceLabel(discoveryState, discoveryModeLabel),
    [discoveryState, discoveryModeLabel]
  );

  const discoveryWarnings = useMemo(
    () => arr(discoveryState?.warnings),
    [discoveryState?.warnings]
  );

  const scanningView = useMemo(
    () =>
      getSetupStudioScanningView({
        discoveryState,
        discoveryForm,
        currentReview,
        businessForm,
        manualSections,
      }),
    [discoveryState, discoveryForm, currentReview, businessForm, manualSections]
  );

  const honestySummary = useMemo(
    () =>
      summarizeSetupStudioHonesty({
        reviewProjection: deriveCanonicalReviewProjection(currentReview),
        reviewSources,
        extraWarnings: discoveryState?.warnings,
      }),
    [currentReview, reviewSources, discoveryState?.warnings]
  );

  const reviewWorkspaceDialogProps = useMemo(
    () =>
      buildSetupStudioReviewWorkspaceDialogProps({
        showRefine,
        savingBusiness,
        businessForm,
        discoveryProfileRows,
        manualSections,
        onSetBusinessField,
        onSetManualSection,
        onSaveBusiness,
        onReloadReviewDraft,
        onToggleRefine,
        currentReview,
        reviewSources,
        reviewSyncState,
      }),
    [
      showRefine,
      savingBusiness,
      businessForm,
      discoveryProfileRows,
      manualSections,
      onSetBusinessField,
      onSetManualSection,
      onSaveBusiness,
      onReloadReviewDraft,
      onToggleRefine,
      currentReview,
      reviewSources,
      reviewSyncState,
    ]
  );

  return {
    sourceLabel,
    discoveryWarnings,
    honestySummary,
    scanningView,
    reviewWorkspaceDialogProps,
  };
}
