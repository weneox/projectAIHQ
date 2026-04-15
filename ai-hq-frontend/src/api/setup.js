import { apiGet, apiPatch, apiPost, apiPut } from "./client.js";

const SETUP_STATE_PATH = "/api/setup/status";
const SETUP_ASSISTANT_SESSION_START_PATH = "/api/setup/assistant/session/start";
const SETUP_ASSISTANT_SESSION_CURRENT_PATH = "/api/setup/assistant/session/current";
const SETUP_ASSISTANT_MESSAGE_PATH = "/api/setup/assistant/session/current/message";
const SETUP_REVIEW_CURRENT_PATH = "/api/setup/review/current";
const SETUP_REVIEW_ANALYZE_PATH = "/api/setup/review/current/analyze";
const SETUP_REVIEW_DISCARD_PATH = "/api/setup/review/current/discard";
const SETUP_REVIEW_FINALIZE_PATH = "/api/setup/review/current/finalize";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeAssistantPayload(value = {}) {
  const source = obj(value);

  return {
    nextQuestion: obj(source.nextQuestion),
    confirmationBlockers: arr(source.confirmationBlockers),
    sections: arr(source.sections),
    completion: obj(source.completion),
    servicesCatalog: obj(source.servicesCatalog),
    sourceInsights: arr(source.sourceInsights),
    phase: s(source.phase),
    message: s(source.message || source.assistantMessage),
    assistantMessage: s(source.assistantMessage || source.message),
    draft: obj(source.draft),
    confidence: obj(source.confidence),
    recommendation: obj(source.recommendation),
    readyForApproval: source.readyForApproval === true,
    sourceSignals: obj(source.sourceSignals),
    interviewPlan: obj(source.interviewPlan),
    reviewSessionId: s(source.reviewSessionId),
    draftVersion: toNumber(source.draftVersion, 0),
    rejectedInputs: arr(source.rejectedInputs),
    provider: s(source.provider),
    model: s(source.model),
    usedFallback: source.usedFallback === true,
    error: s(source.error),
  };
}

function normalizeSessionPayload(value = {}) {
  const source = obj(value);

  return {
    id: s(source.id),
    status: s(source.status),
    mode: s(source.mode),
    currentStep: s(source.currentStep),
    startedAt: source.startedAt || null,
    updatedAt: source.updatedAt || null,
    draftVersion: toNumber(source.draftVersion, 0),
    reviewSessionId: s(source.reviewSessionId),
    draftOnly: source.draftOnly === true,
    storageModel: s(source.storageModel),
    sourceType: s(source.sourceType),
    namespace: s(source.namespace),
  };
}

function normalizeSetupDraftPayload(value = {}) {
  const source = obj(value);

  return {
    businessProfile: obj(source.businessProfile),
    services: arr(source.services),
    contacts: arr(source.contacts),
    hours: arr(source.hours),
    pricingPosture: obj(source.pricingPosture),
    handoffRules: obj(source.handoffRules),
    sourceMetadata: obj(source.sourceMetadata),
    assistantState: obj(source.assistantState),
    progress: obj(source.progress),
    version: toNumber(source.version, 0),
    updatedAt: source.updatedAt || null,
  };
}

function normalizeSetupReviewPayload(value = {}) {
  const source = obj(value);

  return {
    status: s(source.status),
    draftOnly: source.draftOnly === true,
    sourceType: s(source.sourceType),
    namespace: s(source.namespace),
    readyForReview: source.readyForReview === true,
    readyForApproval: source.readyForApproval === true,
    finalizeAvailable: source.finalizeAvailable === true,
    finalized: source.finalized === true,
    message: s(source.message),
  };
}

function normalizeSetupPayload(value = {}) {
  const source = obj(value);

  return {
    status: s(source.status),
    draftOnly: source.draftOnly === true,
    sourceType: s(source.sourceType),
    namespace: s(source.namespace),
    summary: obj(source.summary),
    websitePrefill: obj(source.websitePrefill),
    review: normalizeSetupReviewPayload(source.review),
    draft: normalizeSetupDraftPayload(source.draft),
    assistant: normalizeAssistantPayload(source.assistant),
  };
}

function normalizeSetupAssistantResponse(payload = {}) {
  const root = obj(payload);
  const setup = normalizeSetupPayload(root.setup);

  return {
    ...root,
    ok: root.ok !== false,
    created: root.created === true,
    message: s(root.message),
    error: s(root.error),
    reason: s(root.reason),
    session: normalizeSessionPayload(root.session),
    setup,
    assistant: normalizeAssistantPayload(
      Object.keys(obj(root.assistant)).length ? root.assistant : setup.assistant
    ),
    turn: obj(root.turn),
    question: obj(root.question),
    primaryQuestion: obj(root.primaryQuestion),
    conversationStatus: obj(root.conversationStatus),
    followupQueue: arr(root.followupQueue),
    businessFacts: obj(root.businessFacts),
    reasoningSummary: s(root.reasoningSummary),
    unknowns: arr(root.unknowns),
    assistantHints: arr(root.assistantHints),
    review: normalizeSetupReviewPayload(
      Object.keys(obj(root.review)).length ? root.review : setup.review
    ),
  };
}

function normalizeReviewPayload(payload = {}) {
  const root = obj(payload);

  return {
    ...root,
    ok: root.ok !== false,
    error: s(root.error),
    reason: s(root.reason),
    review: obj(root.review),
    assistant: normalizeAssistantPayload(root.assistant),
    bundleSources: arr(root.bundleSources),
    contributionSummary: obj(root.contributionSummary),
    fieldProvenance: obj(root.fieldProvenance),
    reviewDraftSummary: obj(root.reviewDraftSummary),
  };
}

export function getSetupState() {
  return apiGet(SETUP_STATE_PATH);
}

export function getSetupTruth() {
  return apiGet("/api/setup/truth/current");
}

export function saveBusinessProfile(payload = {}) {
  return apiPut("/api/setup/business-profile", payload);
}

export function saveRuntimePreferences(payload = {}) {
  return apiPut("/api/setup/runtime-preferences", payload);
}

export function importWebsiteForSetup(payload = {}) {
  return apiPost("/api/setup/import/website", payload);
}

export function importGoogleMapsForSetup(payload = {}) {
  return apiPost("/api/setup/import/google-maps", payload);
}

export function importSourceForSetup(payload = {}) {
  return apiPost("/api/setup/import/source", payload);
}

export function importBundleForSetup(payload = {}) {
  return apiPost("/api/setup/import/bundle", payload);
}

export function analyzeSetupIntake(payload = {}) {
  return apiPost(SETUP_REVIEW_ANALYZE_PATH, payload);
}

export async function startSetupAssistantSession(payload = {}) {
  const response = await apiPost(SETUP_ASSISTANT_SESSION_START_PATH, payload);
  return normalizeSetupAssistantResponse(response);
}

export async function getCurrentSetupAssistantSession() {
  const response = await apiGet(SETUP_ASSISTANT_SESSION_CURRENT_PATH, {
    allowStatuses: [404],
  });

  if (
    response?.ok === false &&
    s(response?.error) === "SetupAssistantSessionNotFound"
  ) {
    return null;
  }

  return normalizeSetupAssistantResponse(response);
}

export async function updateCurrentSetupAssistantDraft(payload = {}) {
  const response = await apiPatch(SETUP_ASSISTANT_SESSION_CURRENT_PATH, payload);
  return normalizeSetupAssistantResponse(response);
}

export async function sendSetupAssistantMessage(payload = {}) {
  const response = await apiPost(SETUP_ASSISTANT_MESSAGE_PATH, payload);
  return normalizeSetupAssistantResponse(response);
}

export async function finalizeSetupAssistantSession(payload = {}) {
  return apiPost(SETUP_REVIEW_FINALIZE_PATH, payload);
}

export async function getCurrentSetupReview(params = {}) {
  const query = new URLSearchParams();

  if (params?.eventLimit != null && s(params.eventLimit)) {
    query.set("eventLimit", String(params.eventLimit));
  }

  const qs = query.toString();
  const response = await apiGet(`${SETUP_REVIEW_CURRENT_PATH}${qs ? `?${qs}` : ""}`);
  return normalizeReviewPayload(response);
}

export function patchCurrentSetupReview(payload = {}) {
  return apiPatch(SETUP_REVIEW_CURRENT_PATH, payload);
}

export async function discardCurrentSetupReview(payload = {}) {
  const response = await apiPost(SETUP_REVIEW_DISCARD_PATH, payload);
  return normalizeSetupAssistantResponse(response);
}

export function finalizeCurrentSetupReview(payload = {}) {
  return apiPost(SETUP_REVIEW_FINALIZE_PATH, payload);
}