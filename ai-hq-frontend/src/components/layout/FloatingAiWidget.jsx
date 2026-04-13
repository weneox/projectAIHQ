import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, SendHorizontal, X } from "lucide-react";
import {
  analyzeSetupIntake,
  finalizeSetupAssistantSession,
  getCurrentSetupAssistantSession,
  getCurrentSetupReview,
  importWebsiteForSetup,
  sendSetupAssistantMessage,
  startSetupAssistantSession,
  updateCurrentSetupAssistantDraft,
} from "../../api/setup.js";
import {
  buildWorkspaceScopedQueryKey,
  useWorkspaceTenantKey,
} from "../../hooks/useWorkspaceTenantKey.js";
import { SETUP_WIDGET_ROUTE } from "../../lib/appEntry.js";
import { emitLaunchSliceRefresh } from "../../lib/launchSliceRefresh.js";
import SetupAssistantSections from "./SetupAssistantSections.jsx";

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
    },
    launchPosture: "",
    setupNeeded: false,
    launchChannel: {},
    truthRuntime: {},
    statusLabel: "",
  };
}

function buildLoadingAssistantSeed() {
  return {
    ...buildDefaultAssistant(),
    title: "Loading setup studio",
    statusLabel: "Loading",
    summary: "Loading the current workspace setup state.",
  };
}

function normalizeAssistantState(input = null) {
  const source = input || buildDefaultAssistant();
  const draft = obj(source.draft);
  const assistant = obj(source.assistant);

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
    assistant: {
      nextQuestion: obj(assistant.nextQuestion),
      confirmationBlockers: arr(assistant.confirmationBlockers),
      sections: arr(assistant.sections),
      completion: obj(assistant.completion),
      servicesCatalog: obj(assistant.servicesCatalog),
      sourceInsights: arr(assistant.sourceInsights),
    },
  };
}

function buildAssistantFromApi(base = {}, response = {}) {
  return normalizeAssistantState({
    ...base,
    session: obj(response.session),
    review: obj(response.setup?.review),
    websitePrefill: obj(response.setup?.websitePrefill),
    setupSummary: obj(response.setup?.summary),
    draft: obj(response.setup?.draft),
    assistant: obj(response.setup?.assistant),
  });
}

function normalizeUiAction(action = null, fallback = null) {
  const primary = obj(action);
  const secondary = obj(fallback);
  const path = s(
    primary.path ||
      primary.target?.path ||
      secondary.path ||
      secondary.target?.path
  );
  const label = s(primary.label || secondary.label);

  if (!path && !label) return null;

  return {
    label: label || "Open",
    path: path || "/home",
  };
}

function buildSupportContext(assistantState = {}) {
  const source = normalizeAssistantState(assistantState);
  const launchChannel = obj(source.launchChannel);
  const truthRuntime = obj(source.truthRuntime);
  const channelLabel = s(launchChannel.channelLabel || "Launch channel");

  return {
    launchPosture: lower(source.launchPosture),
    setupNeeded: source.setupNeeded === true,
    channelConnected: launchChannel.connected === true,
    channelLabel,
    channelSummary: s(launchChannel.summary),
    truthTitle: s(truthRuntime.title, "Business truth"),
    truthSummary: s(truthRuntime.summary),
    blockedBy: lower(truthRuntime.blockedBy),
    channelAction: normalizeUiAction(launchChannel.action, {
      label: "Open channels",
      path: "/channels",
    }),
    truthAction: normalizeUiAction(truthRuntime.action, {
      label: "Open truth",
      path: "/truth",
    }),
    setupAction: normalizeUiAction(source.primaryAction, {
      label: "Open setup",
      path: SETUP_WIDGET_ROUTE,
    }),
    inboxAction: { label: "Open inbox", path: "/inbox" },
    commentsAction: { label: "Open comments", path: "/comments" },
    voiceAction: { label: "Open voice", path: "/voice" },
  };
}

function buildSupportWelcomeFromAssistant(assistantState = {}) {
  const context = buildSupportContext(assistantState);

  if (!context.channelConnected) {
    return [
      {
        id: "support-connect",
        role: "assistant",
        title: `Connect ${context.channelLabel.toLowerCase()} first`,
        text:
          context.channelSummary ||
          `Setup stays available here, but live operation still needs ${context.channelLabel.toLowerCase()} connected.`,
        actions: [context.channelAction].filter(Boolean),
        suggestions: ["Open channels", "Open setup"],
      },
    ];
  }

  if (
    context.launchPosture === "runtime_repair_needed" ||
    context.blockedBy === "truth" ||
    context.blockedBy === "runtime"
  ) {
    return [
      {
        id: "support-truth",
        role: "assistant",
        title: context.truthTitle || "Truth needs attention",
        text:
          context.truthSummary ||
          "Approved truth or runtime still needs review before live automation should be trusted.",
        actions: [context.truthAction, context.setupAction].filter(Boolean),
        suggestions: ["Open truth", "Open setup"],
      },
    ];
  }

  if (context.setupNeeded || context.launchPosture === "setup_needed") {
    return [
      {
        id: "support-setup",
        role: "assistant",
        title: "Continue the draft",
        text:
          "Business truth still deserves one governed pass before you rely on live behavior.",
        actions: [context.setupAction, context.truthAction].filter(Boolean),
        suggestions: ["Open setup", "Open truth"],
      },
    ];
  }

  return [
    {
      id: "support-ready",
      role: "assistant",
      title: "Live surfaces are available",
      text:
        "Truth, channels, and operator surfaces look ready. Pick the surface you need.",
      actions: [context.inboxAction, context.commentsAction].filter(Boolean),
      suggestions: ["Open inbox", "Open comments", "Open voice", "Open truth"],
    },
  ];
}

function buildSupportReply(rawText = "", assistantState = {}) {
  const text = lower(rawText);
  const context = buildSupportContext(assistantState);

  if (/channel|connect|instagram|facebook|telegram|oauth|meta/.test(text)) {
    return {
      text: context.channelConnected
        ? `${context.channelLabel} looks connected. Open Channels if you want to inspect or reconnect it.`
        : context.channelSummary ||
          `${context.channelLabel} still needs to be connected before launch is clean.`,
      actions: [context.channelAction].filter(Boolean),
      suggestions: ["Open channels", "Open setup"],
    };
  }

  if (/truth|runtime|review|approve|finalize|publish/.test(text)) {
    return {
      text:
        context.truthSummary ||
        "Open the truth surface when you need the governed review and approval posture.",
      actions: [context.truthAction].filter(Boolean),
      suggestions: ["Open truth", "Open setup"],
    };
  }

  if (/setup|draft|source|business|services|hours|pricing|contact/.test(text)) {
    return {
      text:
        "Open setup to continue the interview, edit the final draft, or approve truth.",
      actions: [context.setupAction].filter(Boolean),
      suggestions: ["Open setup", "Open truth"],
    };
  }

  if (/voice|call|phone/.test(text)) {
    return {
      text: "Voice remains a separate operator surface for phone posture and call handling.",
      actions: [context.voiceAction],
      suggestions: ["Open voice", "Open truth"],
    };
  }

  if (/comment|post|moderation/.test(text)) {
    return {
      text: "Comments stay available as an operator surface for moderation and reply review.",
      actions: [context.commentsAction],
      suggestions: ["Open comments", "Open inbox"],
    };
  }

  if (/inbox|message|reply|dm/.test(text)) {
    return {
      text: "Inbox is the main live surface for conversations, follow-up, and operator review.",
      actions: [context.inboxAction],
      suggestions: ["Open inbox", "Open comments"],
    };
  }

  return {
    text: "Pick the surface you need: setup, truth, inbox, comments, voice, or channels.",
    actions: [context.setupAction, context.truthAction].filter(Boolean),
    suggestions: ["Open setup", "Open truth", "Open inbox", "Open channels"],
  };
}

function normalizeManualSourceType(value = "") {
  const key = lower(value);
  if (key === "note" || key === "manual") return "manual";
  if (key === "facebook") return "facebook_page";
  return key;
}

function buildManualSourceMetadata(type = "", value = "") {
  const sourceType = normalizeManualSourceType(type);
  const sourceUrl = sourceType === "manual" ? "" : s(value);
  const sourceLabel =
    sourceType === "instagram"
      ? "Instagram"
      : sourceType === "facebook_page"
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

  if (sourceType === "facebook_page") {
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

function TypingBubble() {
  return (
    <div className="flex">
      <div className="inline-flex h-10 items-center gap-1.5 border border-[rgba(15,23,42,0.06)] bg-[rgba(248,250,252,0.72)] px-3 text-text-muted">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:120ms]" />
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current [animation-delay:240ms]" />
      </div>
    </div>
  );
}

function SupportThread({
  messages,
  busy,
  input,
  onInputChange,
  onSend,
  onAction,
}) {
  const scrollRef = useRef(null);
  const latestAssistantId = [...messages]
    .reverse()
    .find((item) => item.role === "assistant")?.id;

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-auto px-5 py-6">
        <div className="flex flex-col gap-4">
          {messages.map((message, index) => {
            const isUser = message.role === "user";
            const showActions =
              !busy &&
              !isUser &&
              latestAssistantId === message.id &&
              arr(message.actions).length > 0;
            const showSuggestions =
              !busy &&
              !isUser &&
              latestAssistantId === message.id &&
              arr(message.suggestions).length > 0;

            return (
              <div
                key={message.id}
                className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                style={{ animationDelay: `${Math.min(index * 24, 160)}ms` }}
              >
                <div
                  className={`max-w-[86%] px-4 py-3.5 text-[14px] leading-7 ${
                    isUser
                      ? "bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]"
                      : "border border-[rgba(15,23,42,0.06)] bg-[linear-gradient(180deg,rgba(248,250,252,0.8),rgba(255,255,255,0.98))] text-text"
                  }`}
                >
                  {s(message.title) ? (
                    <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] opacity-60">
                      {message.title}
                    </div>
                  ) : null}

                  <div className="whitespace-pre-wrap">{message.text}</div>

                  {showActions ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {arr(message.actions).map((action) => (
                        <button
                          key={`${message.id}-${action.path}-${action.label}`}
                          type="button"
                          className="inline-flex h-8 items-center gap-1.5 border border-[rgba(15,23,42,0.08)] bg-white px-2.5 text-[12px] font-semibold tracking-[0.01em] text-text"
                          onClick={() => onAction?.(action.path)}
                        >
                          <span>{action.label}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {showSuggestions ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {arr(message.suggestions).map((suggestion) => (
                        <button
                          key={`${message.id}-${suggestion}`}
                          type="button"
                          className="inline-flex h-8 items-center border border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.82)] px-2.5 text-[12px] font-semibold tracking-[0.01em] text-text"
                          onClick={() => onSend?.(suggestion)}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}

          {busy ? <TypingBubble /> : null}
        </div>
      </div>

      <div className="border-t border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.82))] px-5 py-4">
        <div className="flex items-end gap-3 border-b border-[rgba(15,23,42,0.1)] py-2">
          <textarea
            rows={1}
            value={input}
            onChange={(event) => onInputChange?.(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSend?.(input);
              }
            }}
            placeholder="Ask about setup, truth, channels, inbox, comments, or voice..."
            className="min-h-[22px] w-full resize-none bg-transparent text-[14px] leading-7 text-text outline-none placeholder:text-text-subtle"
          />

          <button
            type="button"
            onClick={() => onSend?.(input)}
            disabled={!s(input) || busy}
            className="inline-flex h-10 w-10 items-center justify-center bg-slate-950 text-white disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="Send support message"
          >
            <SendHorizontal className="h-4 w-4" strokeWidth={2.1} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FloatingAiWidget({
  hidden = false,
  open = false,
  onOpenChange,
  onNavigate,
  assistant = null,
  presentation = "floating",
}) {
  const queryClient = useQueryClient();
  const assistantRef = useRef(normalizeAssistantState(assistant));
  const pageMode = presentation === "page";
  const panelOpen = pageMode ? true : open;
  const workspace = useWorkspaceTenantKey({ enabled: panelOpen });

  const [clientAssistant, setClientAssistant] = useState(
    normalizeAssistantState(assistant)
  );
  const [surfaceMode, setSurfaceMode] = useState("setup");
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [capturingSource, setCapturingSource] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [supportMessages, setSupportMessages] = useState(
    buildSupportWelcomeFromAssistant(assistantRef.current)
  );
  const [supportInput, setSupportInput] = useState("");
  const [supportBusy, setSupportBusy] = useState(false);
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
    enabled: panelOpen && surfaceMode === "setup" && workspace.ready,
    retry: false,
    staleTime: 30_000,
  });

  const baseAssistant = useMemo(() => {
    const sessionAssistant = normalizeAssistantState(sessionQuery.data);
    return s(sessionAssistant.session?.id)
      ? sessionAssistant
      : normalizeAssistantState(assistant);
  }, [assistant, sessionQuery.data]);

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
    const loadingAssistant = normalizeAssistantState(buildLoadingAssistantSeed());
    assistantRef.current = loadingAssistant;
    setClientAssistant(loadingAssistant);
    setSurfaceMode("setup");
    setSaving(false);
    setFinalizing(false);
    setCapturingSource(false);
    setSetupError("");
    setSupportMessages(buildSupportWelcomeFromAssistant(loadingAssistant));
    setSupportInput("");
    setSupportBusy(false);
  }, [workspace.tenantKey]);

  useEffect(() => {
    setSupportMessages((current) => {
      if (current.some((item) => item.role === "user")) return current;
      return buildSupportWelcomeFromAssistant(clientAssistant);
    });
  }, [clientAssistant]);

  useEffect(() => {
    if (panelOpen && clientAssistant.launchPosture === "runtime_repair_needed") {
      setSurfaceMode("support");
    }
  }, [clientAssistant.launchPosture, panelOpen]);

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
    let nextAssistant = null;
    setClientAssistant((prev) => {
      nextAssistant = buildAssistantFromApi(prev, response);
      return nextAssistant;
    });
    queryClient.setQueryData(setupAssistantSessionQueryKey, response);
    return nextAssistant || assistantRef.current;
  }

  async function handleSetupPatchDraft(payload = {}) {
    if (saving || finalizing || capturingSource) return null;
    setSaving(true);
    setSetupError("");

    try {
      await ensureSession();
      const response = await updateCurrentSetupAssistantDraft(payload);
      setClientAssistant((prev) => buildAssistantFromApi(prev, response));
      queryClient.setQueryData(setupAssistantSessionQueryKey, response);
      await refreshWidgetWorkspaceState();
      return response;
    } catch (error) {
      setSetupError(
        s(error?.message, "The draft could not be updated. Please try again.")
      );
      throw error;
    } finally {
      setSaving(false);
    }
  }

  async function handleSetupParseMessage({ text, step }) {
    const answer = s(text);
    if (!answer || saving || finalizing || capturingSource) return null;
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
    if (saving || finalizing || capturingSource) return null;
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

  async function handleSetupCaptureSource({ type, value }) {
    const sourceType = lower(type);
    const sourceValue = s(value);
    if (!sourceType || !sourceValue || saving || finalizing || capturingSource) {
      return null;
    }

    setCapturingSource(true);
    setSetupError("");

    try {
      await ensureSession();

      if (sourceType === "website") {
        const response = await importWebsiteForSetup({
          url: sourceValue,
          allowSessionReuse: true,
          waitForCompletion: true,
        });
        if (response?.ok === false) {
          throw new Error(
            s(response?.reason || response?.error, "Website import failed")
          );
        }
      } else {
        const patchResponse = await updateCurrentSetupAssistantDraft({
          sourceMetadata: buildManualSourceMetadata(sourceType, sourceValue),
        });
        setClientAssistant((prev) => buildAssistantFromApi(prev, patchResponse));
        queryClient.setQueryData(setupAssistantSessionQueryKey, patchResponse);

        const analyzeResponse = await analyzeSetupIntake(
          buildManualAnalyzePayload(sourceType, sourceValue)
        );

        if (analyzeResponse?.ok === false) {
          throw new Error(
            s(analyzeResponse?.reason || analyzeResponse?.error, "Source intake failed")
          );
        }
      }

      await refreshWidgetWorkspaceState();
      return true;
    } catch (error) {
      setSetupError(s(error?.message, "Source intake failed."));
      throw error;
    } finally {
      setCapturingSource(false);
    }
  }

  async function handleSupportSend(rawText) {
    const text = s(rawText);
    if (!text || supportBusy) return;

    setSupportMessages((current) => [
      ...current,
      { id: `support-user-${Date.now()}`, role: "user", text },
    ]);
    setSupportInput("");
    setSupportBusy(true);

    const reply = buildSupportReply(text, assistantRef.current);
    await new Promise((resolve) => window.setTimeout(resolve, 220));

    setSupportMessages((current) => [
      ...current,
      {
        id: `support-assistant-${Date.now()}`,
        role: "assistant",
        title: s(reply.title),
        text: reply.text,
        actions: arr(reply.actions).filter((item) => s(item?.path)),
        suggestions: arr(reply.suggestions).filter(Boolean),
      },
    ]);

    setSupportBusy(false);
  }

  function handleSupportAction(path) {
    const target = s(path);
    if (!target) return;
    onNavigate?.(target);
    onOpenChange?.(false);
  }

  const shellTitle = surfaceMode === "setup" ? "Ask AI" : "Support";
  const shellSummary =
    surfaceMode === "setup"
      ? "Source-first setup. Conversation-first refinement."
      : "Channels, truth, inbox, comments, or voice.";

  const wrapperClass = pageMode
    ? "relative h-full w-full"
    : "fixed inset-0 z-[95]";

  const backdrop = !pageMode ? (
    <button
      type="button"
      aria-label="Close Ask AI"
      className="absolute inset-0 bg-[rgba(15,23,42,0.2)]"
      onClick={() => onOpenChange?.(false)}
    />
  ) : null;

  return (
    <div className={wrapperClass}>
      {panelOpen ? (
        <>
          {backdrop}

          <section
            className={
              pageMode
                ? "relative ml-auto flex h-full w-full max-w-[720px] flex-col border-l border-[rgba(15,23,42,0.06)] bg-white"
                : "absolute right-0 top-0 flex h-screen w-[min(720px,100vw)] flex-col border-l border-[rgba(15,23,42,0.06)] bg-white shadow-[-24px_0_64px_rgba(15,23,42,0.14)]"
            }
            role={pageMode ? "region" : "dialog"}
            aria-modal={pageMode ? undefined : "true"}
            aria-label={pageMode ? "Setup workspace" : "Ask AI panel"}
          >
            <div className="border-b border-[rgba(15,23,42,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.998),rgba(249,250,251,0.985))] px-6 pb-4 pt-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-muted">
                    AI HQ
                  </div>
                  <div className="mt-1 text-[32px] font-semibold tracking-[-0.05em] text-text">
                    {shellTitle}
                  </div>
                  <div className="mt-2 max-w-[42ch] text-[13px] leading-6 text-text-muted">
                    {shellSummary}
                  </div>
                </div>

                {!pageMode ? (
                  <button
                    type="button"
                    onClick={() => onOpenChange?.(false)}
                    className="inline-flex h-9 w-9 items-center justify-center text-text-muted transition-colors hover:text-text"
                    aria-label="Close Ask AI panel"
                  >
                    <X className="h-5 w-5" strokeWidth={2} />
                  </button>
                ) : null}
              </div>

              <div className="mt-5 flex items-center gap-6 border-t border-[rgba(15,23,42,0.08)] pt-3">
                <button
                  type="button"
                  className={`inline-flex border-b-[1.5px] pb-2 text-[13px] font-semibold tracking-[0.01em] ${
                    surfaceMode === "setup"
                      ? "border-slate-900 text-text"
                      : "border-transparent text-text-muted"
                  }`}
                  onClick={() => setSurfaceMode("setup")}
                >
                  <span>Setup</span>
                </button>

                <button
                  type="button"
                  className={`inline-flex border-b-[1.5px] pb-2 text-[13px] font-semibold tracking-[0.01em] ${
                    surfaceMode === "support"
                      ? "border-slate-900 text-text"
                      : "border-transparent text-text-muted"
                  }`}
                  onClick={() => setSurfaceMode("support")}
                >
                  <span>Support</span>
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1">
              {surfaceMode === "setup" ? (
                <SetupAssistantSections
                  assistant={clientAssistant}
                  reviewPayload={reviewQuery.data}
                  saving={saving}
                  finalizing={finalizing}
                  capturingSource={capturingSource}
                  errorMessage={setupError}
                  onCaptureSource={handleSetupCaptureSource}
                  onParseMessage={handleSetupParseMessage}
                  onFinalize={handleSetupFinalize}
                  onPatchDraft={handleSetupPatchDraft}
                />
              ) : (
                <SupportThread
                  messages={supportMessages}
                  busy={supportBusy}
                  input={supportInput}
                  onInputChange={setSupportInput}
                  onSend={handleSupportSend}
                  onAction={handleSupportAction}
                />
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}