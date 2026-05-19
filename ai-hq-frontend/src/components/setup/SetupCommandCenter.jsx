import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  discardCurrentSetupReview,
  finalizeSetupAssistantSession,
  getCurrentSetupAssistantSession,
  getCurrentSetupReview,
  importGoogleMapsForSetup,
  importSourceForSetup,
  importWebsiteForSetup,
  sendSetupAssistantMessage,
  startSetupAssistantSession,
} from "../../api/setup.js";
import {
  buildWorkspaceScopedQueryKey,
  useWorkspaceTenantKey,
} from "../../hooks/useWorkspaceTenantKey.js";
import { emitLaunchSliceRefresh } from "../../lib/launchSliceRefresh.js";
import SetupReviewRoomShell from "./SetupReviewRoomShell.jsx";
import { resolveSetupSourceInput } from "./setupSourceIntake.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function buildHoursDraft(value = []) {
  const existing = arr(value);
  const order = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  return order.map((day, index) => ({
    day,
    enabled: existing[index]?.enabled === true,
    closed: existing[index]?.closed === true,
    openTime: s(existing[index]?.openTime),
    closeTime: s(existing[index]?.closeTime),
    allDay: existing[index]?.allDay === true,
    appointmentOnly: existing[index]?.appointmentOnly === true,
    notes: s(existing[index]?.notes),
  }));
}

function buildDefaultAssistant() {
  return {
    mode: "setup",
    title: "Setup",
    summary: "",
    primaryAction: null,
    secondaryAction: null,
    review: {},
    websitePrefill: {
      supported: true,
      status: "awaiting_input",
      websiteUrl: "",
    },
    session: {},
    setupSummary: {},
    draft: {
      businessProfile: {},
      services: [],
      contacts: [],
      hours: buildHoursDraft([]),
      pricingPosture: {},
      handoffRules: {},
      sourceMetadata: {},
      assistantState: {},
      progress: {},
      version: 0,
    },
    assistantTimeline: [],
    assistant: {
      nextQuestion: {},
      confirmationBlockers: [],
      sections: [],
      completion: {
        ready: false,
        action: null,
        message: "",
      },
      servicesCatalog: {
        items: [],
        packs: [],
        suggestedServices: [],
      },
      sourceInsights: [],
      timeline: [],
      phase: "source_capture",
      message: "",
      assistantMessage: "",
      draft: {},
      reviewDraft: {},
      draftPreviewHidden: false,
      draftVisibilityMode: "",
      confidence: {},
      recommendation: {},
      readyForApproval: false,
      finalizeAvailable: false,
      sourceSignals: {},
      interviewPlan: {},
      aiBehavior: {},
      rejectedInputs: [],
      provider: "",
      model: "",
      usedFallback: false,
      error: "",
    },
    launchPosture: "",
    setupNeeded: false,
    launchChannel: {},
    truthRuntime: {},
    statusLabel: "",
  };
}

function normalizeDecisionAssistant(value = {}) {
  const source = obj(value);

  return {
    nextQuestion: obj(source.nextQuestion),
    confirmationBlockers: arr(source.confirmationBlockers),
    sections: arr(source.sections),
    completion: obj(source.completion),
    servicesCatalog: obj(source.servicesCatalog),
    sourceInsights: arr(source.sourceInsights),
    timeline: arr(source.timeline),
    phase: s(source.phase),
    message: s(source.message || source.assistantMessage),
    assistantMessage: s(source.assistantMessage || source.message),
    draft: obj(source.draft),
    reviewDraft: obj(source.reviewDraft),
    draftPreviewHidden: source.draftPreviewHidden === true,
    draftVisibilityMode: s(source.draftVisibilityMode),
    confidence: obj(source.confidence),
    recommendation: obj(source.recommendation),
    readyForApproval: source.readyForApproval === true,
    finalizeAvailable: source.finalizeAvailable === true,
    sourceSignals: obj(source.sourceSignals),
    interviewPlan: obj(source.interviewPlan),
    aiBehavior: obj(source.aiBehavior),
    reviewSessionId: s(source.reviewSessionId),
    draftVersion: Number(source.draftVersion || 0),
    rejectedInputs: arr(source.rejectedInputs),
    provider: s(source.provider),
    model: s(source.model),
    usedFallback: source.usedFallback === true,
    error: s(source.error),
  };
}

function normalizeAssistantState(input = null) {
  const source = input || buildDefaultAssistant();
  const draft = obj(source.draft);
  const decisionAssistant = normalizeDecisionAssistant(obj(source.assistant));
  const assistantTimeline = arr(
    obj(source.assistant).timeline ||
      source.assistantTimeline ||
      source.timeline
  );

  return {
    mode: s(source.mode, "setup"),
    title: s(source.title, "Setup"),
    summary: s(source.summary),
    statusLabel: s(source.statusLabel),
    primaryAction: obj(source.primaryAction),
    secondaryAction: source.secondaryAction ? obj(source.secondaryAction) : null,
    review: obj(source.review),
    websitePrefill: obj(source.websitePrefill),
    session: obj(source.session),
    setupSummary: obj(source.setupSummary),
    launchPosture: s(source.launchPosture),
    setupNeeded: source.setupNeeded === true,
    launchChannel: obj(source.launchChannel),
    truthRuntime: obj(source.truthRuntime),
    draft: {
      businessProfile: obj(draft.businessProfile),
      services: arr(draft.services),
      contacts: arr(draft.contacts),
      hours: buildHoursDraft(draft.hours),
      pricingPosture: obj(draft.pricingPosture),
      handoffRules: obj(draft.handoffRules),
      sourceMetadata: obj(draft.sourceMetadata),
      assistantState: obj(draft.assistantState),
      progress: obj(draft.progress),
      version: Number(draft.version || 0),
      updatedAt: draft.updatedAt || null,
    },
    assistantTimeline,
    assistant: {
      ...decisionAssistant,
      timeline: assistantTimeline,
    },
  };
}

function buildAssistantFromApi(base = {}, response = {}) {
  const root = obj(response);
  const setup = obj(root.setup);

  const responseAssistant =
    Object.keys(obj(setup.assistant)).length > 0
      ? obj(setup.assistant)
      : obj(root.assistant);

  const responseTimeline = arr(
    obj(setup.assistant).timeline ||
      setup.timeline ||
      root.timeline ||
      obj(root.assistant).timeline
  );

  return normalizeAssistantState({
    ...base,
    session: obj(root.session),
    review: obj(setup.review || root.review),
    websitePrefill: obj(setup.websitePrefill),
    setupSummary: obj(setup.summary),
    draft: obj(setup.draft),
    assistant: {
      ...responseAssistant,
      timeline: responseTimeline,
    },
    assistantTimeline: responseTimeline,
    timeline: responseTimeline,
  });
}

function normalizeSetupSourceKeyValue(type = "", value = "") {
  const sourceType = lower(type);
  const text = s(value);
  if (!text) return "";

  if (["website", "google_maps", "instagram"].includes(sourceType)) {
    try {
      const parsed = new URL(text);
      parsed.hash = "";
      const path = parsed.pathname.replace(/\/+$/, "") || "/";
      parsed.pathname = path;
      return parsed.toString().replace(/\/$/, "").toLowerCase();
    } catch {
      return text.toLowerCase().replace(/\/+$/, "");
    }
  }

  return text.toLowerCase();
}

function buildSetupSourceKey(input = {}) {
  const sourceInput = obj(input);
  const type = lower(sourceInput.type || sourceInput.sourceType);
  const value = normalizeSetupSourceKeyValue(
    type,
    sourceInput.value ||
      sourceInput.url ||
      sourceInput.sourceUrl ||
      sourceInput.source_url
  );

  if (!type || !value) return "";
  return `${type}|${value}`;
}

function sourceInputFromUrl(type = "", value = "") {
  const url = s(value);
  if (!url) return {};
  const resolved = resolveSetupSourceInput(url);
  return {
    type: lower(type || resolved.type || "website"),
    value: resolved.value || url,
  };
}

function collectPrimarySourceKeysFromPayload(payload = {}) {
  const root = obj(payload);
  const setup = obj(root.setup);
  const reviewRoom = obj(setup.reviewRoom || root.reviewRoom || obj(root.review).reviewRoom);
  const draft = obj(setup.draft || root.draft);
  const sourceMetadata = obj(draft.sourceMetadata || setup.sourceMetadata);
  const assistant = obj(setup.assistant || root.assistant || obj(root.assistant));
  const evidenceSource = obj(obj(reviewRoom.evidence).primarySource);
  const polishedSource = obj(obj(reviewRoom.polishedTruthDraft).source);
  const sourceSignals = obj(assistant.sourceSignals);

  return [
    buildSetupSourceKey(sourceInputFromUrl(
      sourceMetadata.primarySourceType,
      sourceMetadata.primarySourceUrl
    )),
    buildSetupSourceKey(sourceInputFromUrl(
      sourceSignals.primarySourceType,
      sourceSignals.primarySourceUrl
    )),
    buildSetupSourceKey(sourceInputFromUrl(evidenceSource.type, evidenceSource.url)),
    buildSetupSourceKey(sourceInputFromUrl(polishedSource.type, polishedSource.url)),
    buildSetupSourceKey(sourceInputFromUrl(root.sourceType, root.sourceUrl)),
  ].filter(Boolean);
}

function firstPrimarySourceKey(...payloads) {
  for (const payload of payloads) {
    const [key] = collectPrimarySourceKeysFromPayload(payload);
    if (key) return key;
  }
  return "";
}

function buildMergedReviewPayload(reviewPayload = null, assistantState = {}) {
  const reviewRoot = obj(reviewPayload);

  const localAssistant = normalizeDecisionAssistant(obj(assistantState.assistant));
  const localTimeline = arr(
    obj(assistantState.assistant).timeline ||
      assistantState.assistantTimeline ||
      assistantState.timeline
  );

  const reviewAssistant = normalizeDecisionAssistant(obj(reviewRoot.assistant));
  const reviewTimeline = arr(
    obj(reviewRoot.assistant).timeline || reviewRoot.timeline
  );

  const reviewSourceKey = firstPrimarySourceKey(reviewRoot);
  const assistantSourceKey = firstPrimarySourceKey(assistantState);
  const sourceMatches =
    !reviewSourceKey || !assistantSourceKey || reviewSourceKey === assistantSourceKey;

  const hasLocalLiveState = sourceMatches && Boolean(
    localTimeline.length ||
      s(localAssistant.message || localAssistant.assistantMessage) ||
      s(obj(localAssistant.nextQuestion).key) ||
      localAssistant.readyForApproval === true ||
      Object.keys(obj(localAssistant.reviewDraft)).length
  );

  const mergedAssistant = hasLocalLiveState
    ? {
        ...reviewAssistant,
        ...localAssistant,
        timeline: localTimeline,
      }
    : {
        ...reviewAssistant,
        timeline: reviewTimeline,
      };

  return {
    ...reviewRoot,
    review: obj(reviewRoot.review),
    timeline: hasLocalLiveState ? localTimeline : reviewTimeline,
    bundleSources: arr(reviewRoot.bundleSources),
    contributionSummary: obj(reviewRoot.contributionSummary),
    fieldProvenance: obj(reviewRoot.fieldProvenance),
    reviewDraftSummary: obj(reviewRoot.reviewDraftSummary),
    assistant: mergedAssistant,
  };
}

function getConversationStorageKey(tenantKey = "") {
  return `setup-assistant-timeline:${lower(tenantKey || "workspace")}`;
}

function clearSetupConversationStorage(tenantKey = "") {
  try {
    const storageKey = getConversationStorageKey(tenantKey);
    window.sessionStorage.removeItem(`setup_assistant_chat_v3:${storageKey}`);
  } catch {
    return;
  }
}

function humanizeSetupSourceError(error = null, sourceType = "") {
  const code = lower(error?.code || error?.payload?.error);
  const message = lower(error?.message || error?.payload?.reason);
  const sourceLabel =
    lower(sourceType) === "google_maps"
      ? "Google Maps linkini"
      : lower(sourceType) === "instagram"
        ? "Instagram profilini"
        : "mənbəni";

  if (code === "request_timeout" || message.includes("timeout")) {
    return "Oxuma çox uzun çəkdi. Bir az sonra yenidən yoxla və ya qısa biznes təsviri yaz.";
  }

  if (
    message.includes("unsafe") ||
    message.includes("denied") ||
    message.includes("valid source url")
  ) {
    return `${sourceLabel} oxuya bilmədim. Linki yoxla və ya biznes haqqında qısa təsvir yaz.`;
  }

  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("unavailable")
  ) {
    return "Mənbəyə indi çata bilmədim. Linki yoxla və ya qısa təsvirlə davam et.";
  }

  return "Mənbəni oxuya bilmədim. Linki yoxla və ya biznes haqqında qısa təsvir yaz.";
}

function hasVisibleSetupState(state = {}) {
  const assistant = obj(state.assistant);
  const draft = obj(state.draft);
  const reviewDraft = obj(assistant.reviewDraft);
  const profile = obj(draft.businessProfile);
  const sourceMetadata = obj(draft.sourceMetadata);

  return Boolean(
    s(profile.companyName) ||
      s(profile.description) ||
      s(profile.websiteUrl) ||
      arr(draft.services).length ||
      arr(draft.contacts).length ||
      arr(draft.hours).some(
        (item) =>
          item?.enabled === true ||
          item?.closed === true ||
          item?.allDay === true ||
          item?.appointmentOnly === true ||
          s(item?.notes)
      ) ||
      s(obj(draft.pricingPosture).publicSummary) ||
      s(obj(draft.handoffRules).summary) ||
      s(sourceMetadata.primarySourceType) ||
      s(sourceMetadata.primarySourceUrl) ||
      s(obj(assistant.nextQuestion).key) ||
      s(assistant.message || assistant.assistantMessage) ||
      assistant.readyForApproval === true ||
      Object.keys(reviewDraft).length > 0 ||
      arr(assistant.sections).length > 0
  );
}

export default function SetupCommandCenter({
  hidden = false,
  assistant = null,
  storageKey = "",
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const panelOpen = !hidden;
  const workspace = useWorkspaceTenantKey({ enabled: panelOpen });

  const emptySeed = useMemo(
    () => normalizeAssistantState(buildDefaultAssistant()),
    []
  );
  const assistantRef = useRef(emptySeed);

  const [clientAssistant, setClientAssistant] = useState(emptySeed);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [setupError, setSetupError] = useState("");
  const lastTenantKeyRef = useRef("");

  const productHomeQueryKey = useMemo(
    () => buildWorkspaceScopedQueryKey(["product-home"], workspace.tenantKey),
    [workspace.tenantKey]
  );

  const setupAssistantSessionQueryKey = useMemo(
    () =>
      buildWorkspaceScopedQueryKey(
        ["setup-assistant-session-current", "widget"],
        workspace.tenantKey
      ),
    [workspace.tenantKey]
  );

  const setupReviewQueryKey = useMemo(
    () =>
      buildWorkspaceScopedQueryKey(
        ["setup-review-current", "widget"],
        workspace.tenantKey
      ),
    [workspace.tenantKey]
  );

  const telegramStatusQueryKey = useMemo(
    () =>
      buildWorkspaceScopedQueryKey(
        ["telegram-channel-status"],
        workspace.tenantKey
      ),
    [workspace.tenantKey]
  );

  const metaStatusQueryKey = useMemo(
    () =>
      buildWorkspaceScopedQueryKey(
        ["meta-channel-status"],
        workspace.tenantKey
      ),
    [workspace.tenantKey]
  );

  const sessionQuery = useQuery({
    queryKey: setupAssistantSessionQueryKey,
    queryFn: () => getCurrentSetupAssistantSession(),
    enabled: panelOpen && workspace.ready,
    retry: false,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });

  const reviewQuery = useQuery({
    queryKey: setupReviewQueryKey,
    queryFn: () => getCurrentSetupReview({ eventLimit: 12 }),
    enabled: panelOpen && workspace.ready,
    retry: false,
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });

  const serverAssistant = useMemo(
    () => normalizeAssistantState(sessionQuery.data),
    [sessionQuery.data]
  );

  const baseAssistant = useMemo(() => {
    const sessionAssistant = serverAssistant;
    if (s(sessionAssistant.session?.id)) {
      return sessionAssistant;
    }
    return normalizeAssistantState(assistant);
  }, [assistant, serverAssistant]);

  useEffect(() => {
    assistantRef.current = baseAssistant;
    setClientAssistant(baseAssistant);
  }, [baseAssistant]);

  useEffect(() => {
    assistantRef.current = clientAssistant;
  }, [clientAssistant]);

  useEffect(() => {
    const nextTenantKey = lower(workspace.tenantKey);
    if (!nextTenantKey) {
      lastTenantKeyRef.current = "";
      return;
    }
    if (!lastTenantKeyRef.current) {
      lastTenantKeyRef.current = nextTenantKey;
      return;
    }
    if (lastTenantKeyRef.current === nextTenantKey) return;

    lastTenantKeyRef.current = nextTenantKey;
    assistantRef.current = emptySeed;
    setClientAssistant(emptySeed);
    setSaving(false);
    setFinalizing(false);
    setResetting(false);
    setSetupError("");
  }, [workspace.tenantKey, emptySeed]);

  const mergedReviewPayload = useMemo(
    () => buildMergedReviewPayload(reviewQuery.data, clientAssistant),
    [reviewQuery.data, clientAssistant]
  );

  const sessionHydrated = useMemo(() => {
    if (!panelOpen || !workspace.ready) return false;
    return !sessionQuery.isLoading && !reviewQuery.isLoading;
  }, [
    panelOpen,
    workspace.ready,
    sessionQuery.isLoading,
    reviewQuery.isLoading,
  ]);

  const conversationStorageKey = useMemo(
    () => s(storageKey) || getConversationStorageKey(workspace.tenantKey),
    [storageKey, workspace.tenantKey]
  );

  const canReset = useMemo(
    () => hasVisibleSetupState(clientAssistant),
    [clientAssistant]
  );

  if (hidden) return null;

  function applyAssistantResponseToState(response = null) {
    if (!response) return null;

    let nextAssistant = null;
    setClientAssistant((prev) => {
      nextAssistant = buildAssistantFromApi(prev, response);
      assistantRef.current = nextAssistant;
      return nextAssistant;
    });

    queryClient.setQueryData(setupAssistantSessionQueryKey, response);

    if (nextAssistant) {
      queryClient.setQueryData(setupReviewQueryKey, (previous) =>
        buildMergedReviewPayload(previous, nextAssistant)
      );
    }

    return nextAssistant;
  }

  function resetSetupImportStateForFreshSource() {
    clearSetupConversationStorage(workspace.tenantKey);
    queryClient.setQueryData(setupAssistantSessionQueryKey, null);
    queryClient.setQueryData(setupReviewQueryKey, null);
    assistantRef.current = emptySeed;
    setClientAssistant(emptySeed);
  }

  function applySetupImportResponseToState(response = null, context = {}) {
    if (!response) return null;

    const nextSourceKey = s(context.nextSourceKey);
    const responseSourceKey = firstPrimarySourceKey(response);
    const currentSourceKey = firstPrimarySourceKey(
      assistantRef.current,
      queryClient.getQueryData(setupReviewQueryKey)
    );
    const mustReplace =
      context.replacePrimarySource === true ||
      (nextSourceKey && currentSourceKey && nextSourceKey !== currentSourceKey) ||
      (responseSourceKey && currentSourceKey && responseSourceKey !== currentSourceKey);
    const base = mustReplace ? emptySeed : assistantRef.current;
    const nextAssistant = buildAssistantFromApi(base, response);

    assistantRef.current = nextAssistant;
    setClientAssistant(nextAssistant);
    queryClient.setQueryData(setupAssistantSessionQueryKey, response);
    queryClient.setQueryData(setupReviewQueryKey, response);

    return nextAssistant;
  }

  function scheduleWorkspaceBackgroundRefresh({
    includeReview = false,
    includeProductHome = false,
    includeChannelStatus = false,
    emitReason = "",
  } = {}) {
    queueMicrotask(() => {
      if (includeProductHome) {
        queryClient.invalidateQueries({
          queryKey: productHomeQueryKey,
          refetchType: "none",
        });
      }

      if (includeReview) {
        queryClient.invalidateQueries({
          queryKey: setupReviewQueryKey,
          refetchType: "none",
        });
      }

      if (includeChannelStatus) {
        queryClient.invalidateQueries({
          queryKey: telegramStatusQueryKey,
          refetchType: "none",
        });
        queryClient.invalidateQueries({
          queryKey: metaStatusQueryKey,
          refetchType: "none",
        });
      }

      if (emitReason) {
        emitLaunchSliceRefresh({
          tenantKey: workspace.tenantKey,
          reason: emitReason,
        });
      }
    });
  }

  async function refreshSetupCommandCenterState({
    includeChannelStatus = false,
    includeTruthRuntime = false,
    emitReason = "",
  } = {}) {
    const refreshTasks = [
      queryClient.invalidateQueries({ queryKey: productHomeQueryKey }),
      queryClient.invalidateQueries({ queryKey: setupAssistantSessionQueryKey }),
      queryClient.invalidateQueries({ queryKey: setupReviewQueryKey }),
    ];

    if (includeChannelStatus) {
      refreshTasks.push(
        queryClient.invalidateQueries({ queryKey: telegramStatusQueryKey }),
        queryClient.invalidateQueries({ queryKey: metaStatusQueryKey })
      );
    }

    if (includeTruthRuntime) {
      refreshTasks.push(
        queryClient.invalidateQueries({ queryKey: ["truth"] }),
        queryClient.invalidateQueries({ queryKey: ["trust"] }),
        queryClient.invalidateQueries({ queryKey: ["settings-trust"] }),
        queryClient.invalidateQueries({ queryKey: ["setup-truth-current"] })
      );
    }

    await Promise.all(refreshTasks);

    if (emitReason) {
      emitLaunchSliceRefresh({
        tenantKey: workspace.tenantKey,
        reason: emitReason,
      });
    }
  }

  async function ensureSession() {
    const current = assistantRef.current;
    if (s(current.session?.id)) return current;

    const cachedSession = normalizeAssistantState(
      queryClient.getQueryData(setupAssistantSessionQueryKey)
    );

    if (s(cachedSession.session?.id)) {
      assistantRef.current = cachedSession;
      setClientAssistant(cachedSession);
      return cachedSession;
    }

    const response = await startSetupAssistantSession();
    const nextAssistant = applyAssistantResponseToState(response);

    scheduleWorkspaceBackgroundRefresh({
      includeReview: true,
    });

    return nextAssistant || assistantRef.current;
  }

  async function handleStartSetup() {
    if (saving || finalizing || resetting) return null;

    setSetupError("");
    try {
      await ensureSession();
      return true;
    } catch (error) {
      setSetupError(s(error?.message, "Setup could not be started."));
      throw error;
    }
  }

  async function handleGoToChannels() {
    navigate("/channels");
  }

  async function importSetupSourceByType(sourceInput = {}, answer = "", options = {}) {
    const sourceType = lower(sourceInput.type || "website");
    const sourceValue = s(sourceInput.value);
    const metadataJson = obj(options.metadataJson);
    const allowSessionReuse = options.allowSessionReuse === true;
    const replacePrimarySource = options.replacePrimarySource === true;

    const payload = {
      type: sourceType,
      sourceType,
      value: sourceValue,
      url: sourceValue,
      sourceUrl: sourceValue,
      primarySource: {
        type: sourceType,
        sourceType,
        value: sourceValue,
        url: sourceValue,
        sourceUrl: sourceValue,
      },
      sources: [
        {
          type: sourceType,
          sourceType,
          value: sourceValue,
          url: sourceValue,
          sourceUrl: sourceValue,
        },
      ],
      note: answer,
      allowSessionReuse,
      replacePrimarySource,
      freshSourceImport: replacePrimarySource,
      metadataJson,
      waitForCompletion: true,
    };

    if (sourceType === "website") {
      return importWebsiteForSetup({
        ...payload,
        websiteUrl: sourceValue,
      });
    }

    if (sourceType === "google_maps") {
      return importGoogleMapsForSetup(payload);
    }

    return importSourceForSetup(payload);
  }

  async function handleSetupParseMessage({ text, step, source = null }) {
    const answer = s(text);
    if (!answer || saving || finalizing || resetting) return null;

    setSaving(true);
    setSetupError("");

    try {
      const sourceInput = obj(source);
      const resolvedSource = sourceInput.isImportedSource
        ? {
            ...resolveSetupSourceInput(answer),
            ...sourceInput,
            value: sourceInput.value || resolveSetupSourceInput(answer).value,
          }
        : sourceInput;
      const shouldImportSource =
        resolvedSource.isImportedSource === true && s(resolvedSource.value);

      if (shouldImportSource) {
        const nextSourceKey = buildSetupSourceKey(resolvedSource);
        const previousSourceKey = firstPrimarySourceKey(
          assistantRef.current,
          queryClient.getQueryData(setupReviewQueryKey),
          queryClient.getQueryData(setupAssistantSessionQueryKey)
        );
        const sameSource =
          Boolean(previousSourceKey && nextSourceKey) &&
          previousSourceKey === nextSourceKey;
        const replacePrimarySource = !sameSource;

        if (replacePrimarySource) {
          resetSetupImportStateForFreshSource();
        }

        const response = await importSetupSourceByType(resolvedSource, answer, {
          allowSessionReuse: sameSource,
          replacePrimarySource,
          metadataJson: {
            setupImportMode: replacePrimarySource
              ? "replace_primary_source"
              : "same_primary_source_retry",
            previousSourceKey,
            nextSourceKey,
          },
        });

        applySetupImportResponseToState(response, {
          previousSourceKey,
          nextSourceKey,
          replacePrimarySource,
        });

        await refreshSetupCommandCenterState({
          includeChannelStatus: false,
          emitReason: "setup-source-imported",
        });

        return response;
      }

      await ensureSession();

      const response = await sendSetupAssistantMessage({
        step: s(step, "company"),
        answer,
      });

      applyAssistantResponseToState(response);

      scheduleWorkspaceBackgroundRefresh({
        includeReview: true,
      });

      return response;
    } catch (error) {
      const sourceInput = obj(source);
      const shouldImportSource =
        sourceInput.isImportedSource === true && s(sourceInput.value);

      setSetupError(
        shouldImportSource
          ? humanizeSetupSourceError(error, sourceInput.type)
          : s(
              error?.message,
              "Məlumatı əlavə edə bilmədim. Zəhmət olmasa yenidən yoxla."
            )
      );
      throw error;
    } finally {
      setSaving(false);
    }
  }

  async function handleSetupFinalize() {
    if (saving || finalizing || resetting) return null;

    setFinalizing(true);
    setSetupError("");

    try {
      await ensureSession();

      const response = await finalizeSetupAssistantSession({});
      if (response?.ok === false) {
        throw new Error(
          s(response?.reason || response?.error, "Failed to finalize setup")
        );
      }

      await refreshSetupCommandCenterState({
        includeChannelStatus: true,
        includeTruthRuntime: true,
        emitReason: "setup-finalized",
      });

      setClientAssistant((prev) => {
        const next = normalizeAssistantState({
          ...prev,
          review: {
            ...obj(prev.review),
            finalized: true,
            readyForReview: false,
            readyForApproval: false,
            finalizeAvailable: false,
            message:
              "Approved Business Truth live. Runtime and voice can now use approved truth.",
          },
          assistant: {
            ...obj(prev.assistant),
            readyForApproval: false,
            finalizeAvailable: false,
          },
        });
        assistantRef.current = next;
        return next;
      });

      return response;
    } catch (error) {
      setSetupError(
        s(error?.message, "Business truth could not be approved.")
      );
      throw error;
    } finally {
      setFinalizing(false);
    }
  }

  async function handleSetupReset() {
    if (saving || finalizing || resetting) return null;

    setResetting(true);
    setSetupError("");

    try {
      try {
        await discardCurrentSetupReview({
          reason: "fresh setup restart",
        });
      } catch {
        void 0;
      }

      clearSetupConversationStorage(workspace.tenantKey);

      queryClient.setQueryData(setupAssistantSessionQueryKey, null);
      queryClient.setQueryData(setupReviewQueryKey, null);

      assistantRef.current = emptySeed;
      setClientAssistant(emptySeed);

      await refreshSetupCommandCenterState({
        emitReason: "setup-reset",
      });

      return true;
    } catch (error) {
      setSetupError(
        s(error?.message, "The setup session could not be reset.")
      );
      throw error;
    } finally {
      setResetting(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[rgb(var(--color-canvas))]">
      <div className="mx-auto w-full max-w-[1120px] px-6 py-6">
        {canReset ? (
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={handleSetupReset}
              disabled={resetting || saving || finalizing}
              className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] px-3 text-[12px] font-semibold text-text-subtle transition hover:bg-[rgb(var(--color-surface-subtle))] hover:text-text disabled:cursor-not-allowed disabled:opacity-45"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.1} />
              {resetting ? "Sıfırlanır" : "Yenidən başla"}
            </button>
          </div>
        ) : null}

        <SetupReviewRoomShell
          key={conversationStorageKey}
          storageKey={conversationStorageKey}
          sessionHydrated={sessionHydrated}
          assistant={clientAssistant}
          reviewPayload={mergedReviewPayload}
          saving={saving}
          finalizing={finalizing}
          capturingSource={resetting}
          errorMessage={setupError}
          onParseMessage={handleSetupParseMessage}
          onFinalize={handleSetupFinalize}
          onStartSetup={handleStartSetup}
          onGoToChannels={handleGoToChannels}
        />
      </div>
    </main>
  );
}
