import { useMemo } from "react";
import { resolveReviewSourceInfo } from "../state/reviewState.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
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
    hasText(sections.servicesText) ||
    hasText(sections.faqsText) ||
    hasText(sections.policiesText) ||
    hasText(discovery.note) ||
    hasText(state.manualTranscript) ||
    hasText(state.manualSummary)
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
    scanLines,
    scanLineIndex,
  };
}

export function useSetupStudioSceneView({
  discoveryState,
  discoveryModeLabel,
  discoveryForm,
  currentReview,
  businessForm,
  manualSections,
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

  return {
    sourceLabel,
    discoveryWarnings,
    scanningView,
  };
}
