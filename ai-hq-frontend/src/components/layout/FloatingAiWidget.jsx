import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { RotateCcw, X } from "lucide-react";
import {
  analyzeSetupIntake,
  discardCurrentSetupReview,
  finalizeSetupAssistantSession,
  getCurrentSetupAssistantSession,
  getCurrentSetupReview,
  importGoogleMapsForSetup,
  importWebsiteForSetup,
  sendSetupAssistantMessage,
  startSetupAssistantSession,
  updateCurrentSetupAssistantDraft,
} from "../../api/setup.js";
import {
  buildWorkspaceScopedQueryKey,
  useWorkspaceTenantKey,
} from "../../hooks/useWorkspaceTenantKey.js";
import { emitLaunchSliceRefresh } from "../../lib/launchSliceRefresh.js";
import SetupAssistantSections from "./SetupAssistantSections.jsx";
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
    closed: existing[index]?.closed !== false,
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
    title: "Setup studio",
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
      draft: {},
      confidence: {},
      recommendation: {},
      readyForApproval: false,
      sourceSignals: {},
      interviewPlan: {},
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

function buildFreshEntryAssistantSeed() {
  const base = buildDefaultAssistant();

  return {
    ...base,
    title: "Setup studio",
    statusLabel: "New",
    summary: "Fresh setup entry",
    primaryAction: {
      id: "connect_channel",
      label: "Go to channel",
      intent: "launch_channel",
    },
    secondaryAction: {
      id: "start_setup",
      label: "Start setup",
      intent: "setup",
    },
    assistant: {
      ...base.assistant,
      phase: "source_capture",
      message: "",
      assistantMessage: "",
    },
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
    confidence: obj(source.confidence),
    recommendation: obj(source.recommendation),
    readyForApproval: source.readyForApproval === true,
    sourceSignals: obj(source.sourceSignals),
    interviewPlan: obj(source.interviewPlan),
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
    obj(source.assistant).timeline || source.assistantTimeline || source.timeline
  );

  return {
    mode: s(source.mode, "setup"),
    title: s(source.title, "Setup studio"),
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

  return normalizeAssistantState({
    ...base,
    session: obj(root.session),
    review: obj(setup.review),
    websitePrefill: obj(setup.websitePrefill),
    setupSummary: obj(setup.summary),
    draft: obj(setup.draft),
    assistant:
      Object.keys(obj(setup.assistant)).length
        ? obj(setup.assistant)
        : obj(root.assistant),
  });
}

function buildMergedReviewPayload(reviewPayload = null, assistantState = {}) {
  const reviewRoot = obj(reviewPayload);
  const assistant = normalizeDecisionAssistant(
    Object.keys(obj(reviewRoot.assistant)).length
      ? reviewRoot.assistant
      : obj(assistantState.assistant)
  );

  return {
    ...reviewRoot,
    review: obj(reviewRoot.review),
    timeline: arr(reviewRoot.timeline),
    bundleSources: arr(reviewRoot.bundleSources),
    contributionSummary: obj(reviewRoot.contributionSummary),
    fieldProvenance: obj(reviewRoot.fieldProvenance),
    reviewDraftSummary: obj(reviewRoot.reviewDraftSummary),
    assistant: {
      ...assistant,
      timeline: arr(
        obj(reviewRoot.assistant).timeline ||
          reviewRoot.timeline ||
          obj(assistantState.assistant).timeline
      ),
    },
  };
}

function normalizeManualSourceType(value = "") {
  const key = lower(value);
  if (key === "note" || key === "manual") return "manual";
  return key;
}

function buildManualSourceMetadata(type = "", value = "") {
  const sourceType = normalizeManualSourceType(type);
  const sourceUrl = sourceType === "manual" ? "" : s(value);
  const sourceLabel =
    sourceType === "instagram"
      ? "Instagram"
      : sourceType === "facebook"
        ? "Facebook"
        : sourceType === "manual"
          ? "Manual note"
          : "Source";

  return {
    primarySourceType: sourceType,
    primarySourceUrl: sourceUrl,
    sourceLabels: [sourceLabel],
    evidenceSummary: [
      sourceType === "manual"
        ? "Manual note captured"
        : `${sourceLabel} supplied by operator`,
    ],
  };
}

function buildManualAnalyzePayload(type = "", value = "") {
  const sourceType = normalizeManualSourceType(type);
  const input = s(value);

  if (sourceType === "instagram") {
    return {
      manualText: `Instagram: ${input}`,
      answers: { instagramUrl: input },
      note: "instagram source",
    };
  }

  if (sourceType === "facebook") {
    return {
      manualText: `Facebook: ${input}`,
      answers: { facebookUrl: input },
      note: "facebook source",
    };
  }

  return {
    manualText: input,
    note: sourceType === "manual" ? "manual business note" : `${sourceType} source`,
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

function hasVisibleSetupState(state = {}) {
  const assistant = obj(state.assistant);
  const draft = obj(state.draft);
  const profile = obj(draft.businessProfile);
  const sourceMetadata = obj(draft.sourceMetadata);

  return Boolean(
    s(obj(state.session).id) ||
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
      assistant.readyForApproval === true
  );
}

export default function FloatingAiWidget({
  hidden = false,
  open = false,
  onOpenChange,
  assistant = null,
  presentation = "floating",
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pageMode = presentation === "page";
  const panelOpen = pageMode ? true : open;
  const workspace = useWorkspaceTenantKey({ enabled: panelOpen });

  const freshEntrySeed = useMemo(
    () => normalizeAssistantState(buildFreshEntryAssistantSeed()),
    []
  );

  const assistantRef = useRef(freshEntrySeed);
  const [freshEntryMode, setFreshEntryMode] = useState(true);
  const [clientAssistant, setClientAssistant] = useState(freshEntrySeed);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [capturingSource, setCapturingSource] = useState(false);
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
    () => buildWorkspaceScopedQueryKey(["meta-channel-status"], workspace.tenantKey),
    [workspace.tenantKey]
  );

  const sessionQuery = useQuery({
    queryKey: setupAssistantSessionQueryKey,
    queryFn: () => getCurrentSetupAssistantSession(),
    enabled: panelOpen && workspace.ready,
    retry: false,
    staleTime: 30_000,
  });

  const reviewQuery = useQuery({
    queryKey: setupReviewQueryKey,
    queryFn: () => getCurrentSetupReview({ eventLimit: 12 }),
    enabled: panelOpen && workspace.ready,
    retry: false,
    staleTime: 30_000,
  });

  const serverAssistant = useMemo(
    () => normalizeAssistantState(sessionQuery.data),
    [sessionQuery.data]
  );

  const hasServerVisibleSetup = useMemo(() => {
    const reviewRoot = obj(reviewQuery.data);
    return (
      hasVisibleSetupState(serverAssistant) ||
      Boolean(
        s(obj(reviewRoot.session).id) ||
          s(obj(obj(reviewRoot.review).session).id)
      )
    );
  }, [serverAssistant, reviewQuery.data]);

  const baseAssistant = useMemo(() => {
    if (freshEntryMode) {
      return freshEntrySeed;
    }

    const sessionAssistant = serverAssistant;
    return s(sessionAssistant.session?.id)
      ? sessionAssistant
      : normalizeAssistantState(assistant);
  }, [assistant, serverAssistant, freshEntryMode, freshEntrySeed]);

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
    setFreshEntryMode(true);
    assistantRef.current = freshEntrySeed;
    setClientAssistant(freshEntrySeed);
    setSaving(false);
    setFinalizing(false);
    setCapturingSource(false);
    setResetting(false);
    setSetupError("");
  }, [workspace.tenantKey, freshEntrySeed]);

  useEffect(() => {
    if (!panelOpen || !workspace.ready) return;
    if (!freshEntryMode) return;
    if (sessionQuery.isLoading || reviewQuery.isLoading) return;
    if (hasServerVisibleSetup) return;

    let alive = true;

    (async () => {
      try {
        const response = await startSetupAssistantSession();
        if (!alive || !response?.ok) return;
        queryClient.setQueryData(setupAssistantSessionQueryKey, response);
        setClientAssistant((prev) => buildAssistantFromApi(prev, response));
        setFreshEntryMode(false);
      } catch {
        // keep empty seed
      }
    })();

    return () => {
      alive = false;
    };
  }, [
    panelOpen,
    workspace.ready,
    freshEntryMode,
    sessionQuery.isLoading,
    reviewQuery.isLoading,
    hasServerVisibleSetup,
    queryClient,
    setupAssistantSessionQueryKey,
  ]);

  const mergedReviewPayload = useMemo(
    () =>
      freshEntryMode
        ? null
        : buildMergedReviewPayload(reviewQuery.data, clientAssistant),
    [reviewQuery.data, clientAssistant, freshEntryMode]
  );

  const sessionHydrated = useMemo(() => {
    if (!panelOpen || !workspace.ready) return false;
    if (freshEntryMode) return true;
    return !sessionQuery.isLoading && !reviewQuery.isLoading;
  }, [
    panelOpen,
    workspace.ready,
    sessionQuery.isLoading,
    reviewQuery.isLoading,
    freshEntryMode,
  ]);

  const conversationStorageKey = useMemo(
    () => getConversationStorageKey(workspace.tenantKey),
    [workspace.tenantKey]
  );

  const effectiveStorageKey = useMemo(
    () =>
      freshEntryMode
        ? `${conversationStorageKey}:fresh`
        : conversationStorageKey,
    [conversationStorageKey, freshEntryMode]
  );

  const canReset = useMemo(
    () => freshEntryMode !== true || hasVisibleSetupState(clientAssistant),
    [clientAssistant, freshEntryMode]
  );

  if (hidden) return null;

  async function refreshWidgetWorkspaceState({
    includeChannelStatus = false,
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

    await Promise.all(refreshTasks);

    if (emitReason) {
      emitLaunchSliceRefresh({
        tenantKey: workspace.tenantKey,
        reason: emitReason,
      });
    }
  }

  async function syncLatestAssistantSession() {
    const latestSession = await getCurrentSetupAssistantSession();
    if (latestSession) {
      queryClient.setQueryData(setupAssistantSessionQueryKey, latestSession);
      setClientAssistant((prev) => buildAssistantFromApi(prev, latestSession));
      setFreshEntryMode(false);
      return latestSession;
    }

    queryClient.setQueryData(setupAssistantSessionQueryKey, null);
    setFreshEntryMode(true);
    setClientAssistant(freshEntrySeed);
    return null;
  }

  async function bootstrapFreshSessionIfNeeded() {
    if (!freshEntryMode) return;

    if (hasServerVisibleSetup) {
      try {
        await discardCurrentSetupReview({
          reason: "fresh widget entry",
        });
      } catch {
        // ignore and continue
      }
    }

    clearSetupConversationStorage(workspace.tenantKey);
    queryClient.setQueryData(setupAssistantSessionQueryKey, null);
    queryClient.setQueryData(setupReviewQueryKey, null);
  }

  async function ensureSession() {
    const current = assistantRef.current;
    if (!freshEntryMode && s(current.session?.id)) return current;

    const cachedSession = normalizeAssistantState(
      queryClient.getQueryData(setupAssistantSessionQueryKey)
    );

    if (!freshEntryMode && s(cachedSession.session?.id)) {
      assistantRef.current = cachedSession;
      setClientAssistant(cachedSession);
      return cachedSession;
    }

    await bootstrapFreshSessionIfNeeded();

    const response = await startSetupAssistantSession();
    let nextAssistant = null;
    setClientAssistant((prev) => {
      nextAssistant = buildAssistantFromApi(prev, response);
      return nextAssistant;
    });
    queryClient.setQueryData(setupAssistantSessionQueryKey, response);
    setFreshEntryMode(false);
    return nextAssistant || assistantRef.current;
  }

  async function handleSetupParseMessage({ text, step }) {
    const answer = s(text);
    if (!answer || saving || finalizing || capturingSource || resetting) return null;
    setSaving(true);
    setSetupError("");

    try {
      await ensureSession();
      const response = await sendSetupAssistantMessage({
        step: s(step, "profile"),
        answer,
      });
      setClientAssistant((prev) => buildAssistantFromApi(prev, response));
      queryClient.setQueryData(setupAssistantSessionQueryKey, response);
      setFreshEntryMode(false);
      await refreshWidgetWorkspaceState();
      return response;
    } catch (error) {
      setSetupError(
        s(error?.message, "The answer could not be processed. Please try again.")
      );
      throw error;
    } finally {
      setSaving(false);
    }
  }

  async function handleSetupFinalize() {
    if (saving || finalizing || capturingSource || resetting) return null;
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

      await refreshWidgetWorkspaceState({
        includeChannelStatus: true,
        emitReason: "setup-finalized",
      });

      setClientAssistant((prev) =>
        normalizeAssistantState({
          ...prev,
          review: {
            ...obj(prev.review),
            finalized: true,
            readyForReview: false,
            readyForApproval: false,
            finalizeAvailable: false,
            message:
              "Business truth was approved. Runtime and approved truth were refreshed.",
          },
          assistant: {
            ...obj(prev.assistant),
            readyForApproval: false,
          },
        })
      );

      return response;
    } catch (error) {
      setSetupError(s(error?.message, "Business truth could not be approved."));
      throw error;
    } finally {
      setFinalizing(false);
    }
  }

  async function handleSetupReset() {
    if (saving || finalizing || capturingSource || resetting) return null;

    setResetting(true);
    setSetupError("");

    try {
      try {
        await discardCurrentSetupReview({
          reason: "fresh setup restart",
        });
      } catch {
        // ignore missing session cases
      }

      clearSetupConversationStorage(workspace.tenantKey);

      queryClient.setQueryData(setupAssistantSessionQueryKey, null);
      queryClient.setQueryData(setupReviewQueryKey, null);

      assistantRef.current = freshEntrySeed;
      setClientAssistant(freshEntrySeed);
      setFreshEntryMode(true);

      await refreshWidgetWorkspaceState({
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

  async function handleSetupCaptureSource({ type, value }) {
    const sourceValue = s(value);
    const resolvedSource = resolveSetupSourceInput(sourceValue);
    const sourceType =
      lower(type) === lower(resolvedSource.type)
        ? lower(type)
        : lower(resolvedSource.type);
    const normalizedSourceValue = s(resolvedSource.value || sourceValue);

    if (
      !sourceType ||
      !sourceValue ||
      saving ||
      finalizing ||
      capturingSource ||
      resetting
    ) {
      return null;
    }

    setCapturingSource(true);
    setSetupError("");

    try {
      await ensureSession();

      if (sourceType === "website") {
        const response = await importWebsiteForSetup({
          url: normalizedSourceValue,
          allowSessionReuse: true,
          waitForCompletion: true,
        });
        if (response?.ok === false) {
          throw new Error(
            s(response?.reason || response?.error, "Website import failed")
          );
        }
      } else if (sourceType === "google_maps") {
        const response = await importGoogleMapsForSetup({
          url: normalizedSourceValue,
          allowSessionReuse: true,
          waitForCompletion: true,
        });
        if (response?.ok === false) {
          throw new Error(
            s(response?.reason || response?.error, "Google Maps import failed")
          );
        }
      } else {
        const patchResponse = await updateCurrentSetupAssistantDraft({
          sourceMetadata: buildManualSourceMetadata(
            sourceType,
            normalizedSourceValue
          ),
        });
        setClientAssistant((prev) => buildAssistantFromApi(prev, patchResponse));
        queryClient.setQueryData(setupAssistantSessionQueryKey, patchResponse);
        setFreshEntryMode(false);

        const analyzeResponse = await analyzeSetupIntake(
          buildManualAnalyzePayload(sourceType, normalizedSourceValue)
        );

        if (analyzeResponse?.ok === false) {
          throw new Error(
            s(analyzeResponse?.reason || analyzeResponse?.error, "Source intake failed")
          );
        }
      }

      await refreshWidgetWorkspaceState();
      return await syncLatestAssistantSession();
    } catch (error) {
      setSetupError(s(error?.message, "Source intake failed."));
      throw error;
    } finally {
      setCapturingSource(false);
    }
  }

  function handlePrimaryIntroAction(action = {}) {
    const intent = lower(action?.intent);

    if (intent === "launch_channel" || intent === "connect_channel") {
      onOpenChange?.(false);
      navigate("/channels");
      return;
    }

    navigate("/channels");
  }

  function handleSecondaryIntroAction() {
    setFreshEntryMode(true);
    setSetupError("");
  }

  const wrapperClass = pageMode
    ? "relative h-full w-full"
    : "fixed inset-0 z-[95] pointer-events-none";

  return (
    <AnimatePresence>
      {panelOpen ? (
        <div className={wrapperClass}>
          {!pageMode ? (
            <motion.button
              type="button"
              aria-label="Close setup"
              className="absolute inset-0 bg-[rgba(15,23,42,0.16)] pointer-events-auto"
              onClick={() => onOpenChange?.(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            />
          ) : null}

          <motion.section
            className={
              pageMode
                ? "relative ml-auto flex h-full w-full max-w-[760px] flex-col border-l border-[rgba(15,23,42,0.06)] bg-white"
                : "absolute right-0 top-0 flex h-screen w-[min(760px,100vw)] flex-col border-l border-[rgba(15,23,42,0.06)] bg-white shadow-[-24px_0_64px_rgba(15,23,42,0.14)] pointer-events-auto"
            }
            role={pageMode ? "region" : "dialog"}
            aria-modal={pageMode ? undefined : "true"}
            aria-label="Setup"
            initial={{ x: "100%", opacity: 0.98 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0.98 }}
            transition={{
              duration: 0.28,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="flex items-center justify-between border-b border-[rgba(15,23,42,0.08)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                  Setup
                </div>

                {canReset ? (
                  <button
                    type="button"
                    onClick={handleSetupReset}
                    disabled={resetting || saving || finalizing || capturingSource}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium text-text-muted transition-colors hover:bg-[rgba(15,23,42,0.04)] hover:text-text disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.1} />
                    {resetting ? "Resetting" : "Fresh start"}
                  </button>
                ) : null}
              </div>

              {!pageMode ? (
                <button
                  type="button"
                  onClick={() => onOpenChange?.(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-[rgba(15,23,42,0.04)] hover:text-text"
                  aria-label="Close setup"
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </button>
              ) : null}
            </div>

            <div className="min-h-0 flex-1">
              <SetupAssistantSections
                key={effectiveStorageKey}
                storageKey={effectiveStorageKey}
                sessionHydrated={sessionHydrated}
                assistant={clientAssistant}
                reviewPayload={mergedReviewPayload}
                saving={saving}
                finalizing={finalizing}
                capturingSource={capturingSource || resetting}
                errorMessage={setupError}
                onCaptureSource={handleSetupCaptureSource}
                onParseMessage={handleSetupParseMessage}
                onFinalize={handleSetupFinalize}
                onPrimaryAction={handlePrimaryIntroAction}
                onSecondaryAction={handleSecondaryIntroAction}
              />
            </div>
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  );
}