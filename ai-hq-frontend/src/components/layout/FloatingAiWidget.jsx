import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bot,
  LifeBuoy,
  SendHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import {
  finalizeSetupAssistantSession,
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
  };
}

function normalizeAssistantState(input = null) {
  const source = input || buildDefaultAssistant();
  const draft = obj(source.draft);
  const assistant = obj(source.assistant);

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

function buildChannelDisplay(context = {}) {
  const source = obj(context);
  const channelLabel = s(source.channelLabel || "Launch channel");
  const displayName = s(source.accountDisplayName);
  const handle = s(source.accountHandle);
  const parts = [displayName, handle].filter(Boolean);
  const identity = parts.join(" · ");

  return {
    channelLabel,
    identity,
    provider: lower(source.provider),
    action: normalizeUiAction(source.action, {
      label: "Open channels",
      path: "/channels",
    }),
  };
}

function buildSupportContext(assistantState = {}) {
  const source = normalizeAssistantState(assistantState);
  const launchPosture = lower(source.launchPosture);
  const launchChannel = obj(source.launchChannel);
  const truthRuntime = obj(source.truthRuntime);
  const channelView = buildChannelDisplay(launchChannel);

  const channelAction = normalizeUiAction(launchChannel.action, {
    label: channelView.channelLabel
      ? `Open ${channelView.channelLabel}`
      : "Open channels",
    path: "/channels",
  });

  const truthAction = normalizeUiAction(truthRuntime.action, {
    label: "Open truth",
    path: "/truth",
  });

  const setupAction = normalizeUiAction(source.primaryAction, {
    label: "Open AI setup",
    path: SETUP_WIDGET_ROUTE,
  });

  const secondaryAction = normalizeUiAction(source.secondaryAction, {
    label: "Open home",
    path: "/home",
  });

  return {
    launchPosture,
    setupNeeded: source.setupNeeded === true,
    channelConnected: launchChannel.connected === true,
    channelAvailable: launchChannel.available !== false,
    channelStatus: s(launchChannel.statusLabel || launchChannel.status),
    channelSummary: s(launchChannel.summary),
    channelDetail: s(launchChannel.detail),
    channelLabel: channelView.channelLabel,
    channelIdentity: channelView.identity,
    channelProvider: channelView.provider,
    truthReady: truthRuntime.truthReady === true,
    runtimeReady: truthRuntime.runtimeReady === true,
    deliveryReady: truthRuntime.deliveryReady === true,
    truthStatus: s(truthRuntime.statusLabel || truthRuntime.status),
    truthSummary: s(truthRuntime.summary),
    truthTitle: s(truthRuntime.title),
    truthDetail: s(truthRuntime.detail),
    blockedBy: lower(truthRuntime.blockedBy),
    leadReason: lower(truthRuntime.leadReason),
    setupAction,
    truthAction,
    channelAction,
    secondaryAction,
  };
}

function buildSupportWelcomeFromAssistant(assistantState = {}) {
  const context = buildSupportContext(assistantState);
  const launchLabel = context.channelLabel || "launch channel";
  const identityText = context.channelIdentity
    ? ` ${context.channelIdentity}`
    : "";

  if (context.launchPosture === "connect_channel" || !context.channelConnected) {
    return [
      {
        id: "support-welcome-connect",
        role: "assistant",
        title: `Connect ${launchLabel} first.`,
        text:
          context.channelSummary ||
          `The fastest next move is to connect ${launchLabel.toLowerCase()} before starting live AI operations.${identityText}`,
        actions: [context.channelAction].filter(Boolean),
        suggestions: [
          `Open ${launchLabel}`,
          "Why is setup blocked?",
          "How do I start AI setup?",
        ],
      },
    ];
  }

  if (
    context.launchPosture === "runtime_repair_needed" ||
    context.blockedBy === "runtime" ||
    context.blockedBy === "truth"
  ) {
    return [
      {
        id: "support-welcome-runtime",
        role: "assistant",
        title: context.truthTitle || "Truth or runtime still needs repair.",
        text:
          context.truthSummary ||
          `Approved truth exists, but live automation on ${launchLabel.toLowerCase()} should wait until truth/runtime repair finishes.`,
        actions: [context.truthAction, context.channelAction].filter(Boolean),
        suggestions: [
          "Why is runtime blocked?",
          "Open truth",
          `Open ${launchLabel}`,
        ],
      },
    ];
  }

  if (context.launchPosture === "setup_needed" || context.setupNeeded) {
    return [
      {
        id: "support-welcome-setup",
        role: "assistant",
        title: "Continue the setup draft.",
        text:
          `The current launch channel is ${launchLabel.toLowerCase()}. Continue the structured setup draft before you expect live automation to behave consistently.` +
          (identityText ? ` Connected identity: ${identityText}.` : ""),
        actions: [context.setupAction, context.truthAction].filter(Boolean),
        suggestions: [
          "Open AI setup",
          "What still needs confirmation?",
          "Open truth",
        ],
      },
    ];
  }

  return [
    {
      id: "support-welcome-ready",
      role: "assistant",
      title: "Live surfaces are available.",
      text:
        `Truth and runtime look aligned for ${launchLabel.toLowerCase()}. Open the live surfaces or ask about channels, inbox, comments, voice, setup, or runtime.` +
        (identityText ? ` Connected identity: ${identityText}.` : ""),
      actions: [
        { label: "Open inbox", path: "/inbox" },
        { label: "Open comments", path: "/comments" },
      ],
      suggestions: [
        "Open inbox",
        "Open comments",
        "Open voice",
        "Open truth",
      ],
    },
  ];
}

function buildSupportFallbackReply(context) {
  const launchLabel = context.channelLabel || "launch channel";

  if (context.launchPosture === "connect_channel" || !context.channelConnected) {
    return {
      text:
        context.channelSummary ||
        `The next move is still to connect ${launchLabel.toLowerCase()} before the rest of the setup flow matters.`,
      actions: [context.channelAction].filter(Boolean),
      suggestions: [`Open ${launchLabel}`, "Why is setup blocked?"],
    };
  }

  if (
    context.launchPosture === "runtime_repair_needed" ||
    context.blockedBy === "runtime" ||
    context.blockedBy === "truth"
  ) {
    return {
      text:
        context.truthSummary ||
        `Truth/runtime repair still comes before trusting live automation on ${launchLabel.toLowerCase()}.`,
      actions: [context.truthAction, context.channelAction].filter(Boolean),
      suggestions: ["Open truth", "What should I repair?"],
    };
  }

  if (context.launchPosture === "setup_needed" || context.setupNeeded) {
    return {
      text:
        `The current launch channel is ${launchLabel.toLowerCase()}, but the structured setup draft still deserves attention before you treat automation as fully ready.`,
      actions: [context.setupAction, context.truthAction].filter(Boolean),
      suggestions: ["Open AI setup", "Open truth"],
    };
  }

  return {
    text:
      "Pick the surface you need: inbox, comments, voice, channels, truth, or setup.",
    actions: [
      { label: "Open inbox", path: "/inbox" },
      { label: "Open truth", path: "/truth" },
    ],
    suggestions: [
      "Open inbox",
      "Open comments",
      "Open voice",
      "Open channels",
    ],
  };
}

function buildSupportReply(rawText = "", assistantState = {}) {
  const text = s(rawText);
  const lowerText = text.toLowerCase();
  const context = buildSupportContext(assistantState);
  const launchLabel = context.channelLabel || "launch channel";

  if (
    /channel|channels|connect|connected|telegram|meta|instagram|facebook|oauth|token|secret/.test(
      lowerText
    )
  ) {
    if (!context.channelConnected || context.launchPosture === "connect_channel") {
      return {
        text:
          context.channelSummary ||
          `${launchLabel} is not ready yet. Start from Channels and finish the connect flow first.`,
        actions: [context.channelAction].filter(Boolean),
        suggestions: [`Open ${launchLabel}`, "How do I start AI setup?"],
      };
    }

    if (
      context.launchPosture === "runtime_repair_needed" ||
      context.blockedBy === "runtime" ||
      context.blockedBy === "truth"
    ) {
      return {
        text:
          `${launchLabel} is attached, but live automation is still blocked by truth/runtime posture.`,
        actions: [context.truthAction, context.channelAction].filter(Boolean),
        suggestions: ["Why is runtime blocked?", "Open truth"],
      };
    }

    return {
      text:
        `${launchLabel} looks connected. Open Channels if you want to inspect identities, delivery posture, or reconnect state.`,
      actions: [context.channelAction].filter(Boolean),
      suggestions: [`Open ${launchLabel}`, "Open inbox"],
    };
  }

  if (
    /truth|runtime|projection|repair|blocked|approval|approve|publish|review|memory/.test(
      lowerText
    )
  ) {
    if (
      context.launchPosture === "runtime_repair_needed" ||
      context.blockedBy === "runtime" ||
      context.blockedBy === "truth"
    ) {
      return {
        text:
          context.truthSummary ||
          "Approved truth exists, but runtime still needs repair before live automation should be trusted.",
        actions: [context.truthAction].filter(Boolean),
        suggestions: ["Open truth", "What should I repair?"],
      };
    }

    if (context.launchPosture === "setup_needed" || context.setupNeeded) {
      return {
        text:
          "Truth is still downstream of the setup draft. Continue setup first, then review and publish truth.",
        actions: [context.setupAction, context.truthAction].filter(Boolean),
        suggestions: ["Open AI setup", "Open truth"],
      };
    }

    return {
      text:
        "Truth and runtime already look aligned from the current assistant posture. Open Truth if you want the full review surface.",
      actions: [context.truthAction].filter(Boolean),
      suggestions: ["Open truth", "Open inbox"],
    };
  }

  if (/setup|draft|website|business|service|services|company|profile/.test(lowerText)) {
    if (!context.channelConnected || context.launchPosture === "connect_channel") {
      return {
        text:
          `Setup is available, but the cleanest first move is still to connect ${launchLabel.toLowerCase()}.`,
        actions: [context.channelAction, context.setupAction].filter(Boolean),
        suggestions: [`Open ${launchLabel}`, "Open AI setup"],
      };
    }

    if (context.launchPosture === "runtime_repair_needed") {
      return {
        text:
          "You can still inspect the draft, but the more urgent issue is truth/runtime repair before trusting live automation.",
        actions: [context.truthAction, context.setupAction].filter(Boolean),
        suggestions: ["Open truth", "Open AI setup"],
      };
    }

    return {
      text:
        "Open the AI setup flow to continue the structured draft and confirm the business details that shape runtime.",
      actions: [context.setupAction].filter(Boolean),
      suggestions: ["Open AI setup", "What still needs confirmation?"],
    };
  }

  if (/inbox|dm|message|messages|reply/.test(lowerText)) {
    if (!context.channelConnected || context.launchPosture === "connect_channel") {
      return {
        text:
          "The inbox surface exists, but the system still wants a connected launch channel first.",
        actions: [context.channelAction].filter(Boolean),
        suggestions: ["Open channels", "Open inbox"],
      };
    }

    if (
      context.launchPosture === "runtime_repair_needed" ||
      context.blockedBy === "runtime" ||
      context.blockedBy === "truth"
    ) {
      return {
        text:
          "You can inspect inbox activity, but live automation should still be treated cautiously until truth/runtime repair finishes.",
        actions: [
          context.truthAction,
          { label: "Open inbox", path: "/inbox" },
        ].filter(Boolean),
        suggestions: ["Open truth", "Open inbox"],
      };
    }

    return {
      text:
        "Inbox is the main live surface for conversation triage and follow-up.",
      actions: [{ label: "Open inbox", path: "/inbox" }],
      suggestions: ["Open inbox", "Open comments"],
    };
  }

  if (/comment|comments|moderation|post/.test(lowerText)) {
    if (
      context.launchPosture === "runtime_repair_needed" ||
      context.blockedBy === "runtime" ||
      context.blockedBy === "truth"
    ) {
      return {
        text:
          "Comments can still be inspected, but live automation should wait for truth/runtime repair.",
        actions: [
          context.truthAction,
          { label: "Open comments", path: "/comments" },
        ].filter(Boolean),
        suggestions: ["Open truth", "Open comments"],
      };
    }

    return {
      text:
        "Comments remain a separate operator surface. Open it when you want moderation and reply review.",
      actions: [{ label: "Open comments", path: "/comments" }],
      suggestions: ["Open comments", "Open inbox"],
    };
  }

  if (/voice|call|phone|twilio|receptionist/.test(lowerText)) {
    return {
      text:
        "Voice stays available as its own surface. Open it when you need receptionist posture, live call handling, or phone readiness.",
      actions: [{ label: "Open voice", path: "/voice" }],
      suggestions: ["Open voice", "Open truth"],
    };
  }

  return buildSupportFallbackReply(context);
}

function useWidgetStyles() {
  return useMemo(
    () => `
      .ai-widget-root {
        position: fixed;
        right: 22px;
        bottom: 22px;
        z-index: 92;
      }

      .ai-widget-launcher {
        position: relative;
        width: 66px;
        height: 66px;
        border: 0;
        padding: 0;
        background: transparent;
        cursor: pointer;
      }

      .ai-widget-launcher-core {
        position: absolute;
        inset: 0;
        border-radius: 999px;
        border: 1px solid rgba(209,213,219,0.98);
        background: rgba(255,255,255,0.98);
        box-shadow: 0 10px 24px rgba(15,23,42,0.12);
      }

      .ai-widget-launcher-badge {
        position: absolute;
        top: 7px;
        right: 7px;
        width: 10px;
        height: 10px;
        border-radius: 999px;
        border: 2px solid rgba(255,255,255,0.98);
        background: #2563eb;
      }

      .ai-widget-glyph {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        z-index: 2;
      }

      .ai-widget-panel {
        position: absolute;
        right: 0;
        bottom: calc(100% + 14px);
        width: min(calc(100vw - 28px), 414px);
        height: min(82vh, 760px);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-radius: 12px;
        border: 1px solid rgba(229,231,235,0.98);
        background: rgba(255,255,255,0.99);
        box-shadow: 0 18px 34px rgba(15,23,42,0.12);
        animation: aiWidgetPanelIn .22s cubic-bezier(.22,1,.36,1);
      }

      .ai-widget-header {
        flex: 0 0 auto;
        padding: 16px 16px 12px;
        border-bottom: 1px solid rgba(229,231,235,0.98);
        background: rgba(255,255,255,0.98);
      }

      .ai-widget-header-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .ai-widget-title {
        font-size: 15px;
        line-height: 1.1;
        font-weight: 700;
        letter-spacing: -.03em;
        color: #111827;
      }

      .ai-widget-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 10px;
        border: 1px solid rgba(209,213,219,0.98);
        background: rgba(255,255,255,0.96);
        color: #6b7280;
        transition: all .18s ease;
      }

      .ai-widget-close:hover {
        color: #111827;
      }

      .ai-widget-switch {
        display: inline-flex;
        gap: 4px;
        margin-top: 12px;
        padding: 4px;
        border-radius: 10px;
        background: rgba(243,244,246,0.98);
        border: 1px solid rgba(229,231,235,0.98);
      }

      .ai-widget-switch-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-width: 112px;
        min-height: 36px;
        padding: 0 12px;
        border: 0;
        border-radius: 8px;
        background: transparent;
        color: #6b7280;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: -.02em;
        transition: all .18s ease;
      }

      .ai-widget-switch-btn.active {
        background: rgba(255,255,255,0.98);
        color: #111827;
      }

      .ai-widget-body {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
      }

      .ai-thread-wrap {
        flex: 1 1 auto;
        min-height: 0;
        display: flex;
        flex-direction: column;
      }

      .ai-thread-scroll {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        padding: 16px;
        scroll-behavior: smooth;
      }

      .ai-thread-scroll::-webkit-scrollbar {
        width: 10px;
      }

      .ai-thread-scroll::-webkit-scrollbar-thumb {
        border-radius: 999px;
        background: rgba(199, 207, 220, 0.58);
        border: 2px solid transparent;
        background-clip: padding-box;
      }

      .ai-thread-stack {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .ai-row {
        display: flex;
        width: 100%;
        animation: aiWidgetBubbleIn .34s cubic-bezier(.22,1,.36,1) both;
      }

      .ai-row.assistant {
        justify-content: flex-start;
      }

      .ai-row.user {
        justify-content: flex-end;
      }

      .ai-bubble {
        max-width: 78%;
        padding: 14px 15px;
        border-radius: 12px;
        position: relative;
        border: 1px solid rgba(229,231,235,0.98);
      }

      .ai-bubble.assistant {
        background: rgba(255,255,255,0.98);
        color: #111827;
      }

      .ai-bubble.user {
        background: rgba(239,246,255,0.98);
        color: #111827;
      }

      .ai-bubble-title {
        font-size: 15px;
        line-height: 1.32;
        font-weight: 700;
        letter-spacing: -.03em;
      }

      .ai-bubble-text {
        margin-top: 2px;
        font-size: 14px;
        line-height: 1.68;
        white-space: pre-wrap;
      }

      .ai-bubble-helper {
        margin-top: 6px;
        font-size: 12px;
        line-height: 1.55;
        opacity: .62;
      }

      .ai-quick-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
      }

      .ai-quick-chip,
      .ai-action-link {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 34px;
        padding: 0 12px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: -.02em;
        transition: all .18s ease;
      }

      .ai-quick-chip {
        border: 1px solid rgba(209,213,219,0.98);
        background: rgba(243,244,246,0.98);
        color: #4b5563;
      }

      .ai-action-link {
        border: 1px solid rgba(209,213,219,0.98);
        background: rgba(255,255,255,0.96);
        color: #111827;
      }

      .ai-quick-chip:hover,
      .ai-action-link:hover {}

      .ai-review-sheet {
        border: 1px solid rgba(229,231,235,0.98);
        background: rgba(249,250,251,0.98);
        border-radius: 12px;
        padding: 16px 16px 14px;
        box-shadow: none;
      }

      .ai-review-kicker {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .16em;
        text-transform: uppercase;
        color: rgba(15,23,42,0.34);
      }

      .ai-review-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-top: 8px;
      }

      .ai-review-title-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .ai-review-title {
        margin: 0;
        font-size: 18px;
        line-height: 1.12;
        font-weight: 700;
        letter-spacing: -.04em;
        color: rgba(15,23,42,0.96);
      }

      .ai-review-status {
        display: inline-flex;
        align-items: center;
        min-height: 24px;
        padding: 0 9px;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: -.02em;
        border: 1px solid rgba(15,23,42,0.07);
        background: rgba(255,255,255,0.88);
        color: rgba(15,23,42,0.68);
      }

      .ai-review-status.strong {
        border-color: rgba(22,101,52,0.12);
        background: rgba(236,253,245,0.9);
        color: rgba(22,101,52,0.9);
      }

      .ai-review-status.partial {
        border-color: rgba(180,83,9,0.12);
        background: rgba(255,251,235,0.94);
        color: rgba(180,83,9,0.9);
      }

      .ai-review-status.weak {
        border-color: rgba(185,28,28,0.12);
        background: rgba(254,242,242,0.92);
        color: rgba(185,28,28,0.88);
      }

      .ai-review-summary {
        margin: 8px 0 0;
        font-size: 13px;
        line-height: 1.7;
        color: rgba(15,23,42,0.58);
      }

      .ai-review-action {
        flex: 0 0 auto;
      }

      .ai-review-stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 14px;
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid rgba(15,23,42,0.06);
      }

      .ai-review-stat {
        min-width: 0;
      }

      .ai-review-stat-label {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: .14em;
        text-transform: uppercase;
        color: rgba(15,23,42,0.32);
      }

      .ai-review-stat-value {
        margin-top: 6px;
        font-size: 14px;
        line-height: 1.35;
        font-weight: 700;
        letter-spacing: -.03em;
        color: rgba(15,23,42,0.94);
      }

      .ai-review-block {
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid rgba(15,23,42,0.06);
      }

      .ai-review-block-title {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: .14em;
        text-transform: uppercase;
        color: rgba(15,23,42,0.34);
      }

      .ai-review-rows {
        margin-top: 10px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .ai-review-row {
        display: grid;
        grid-template-columns: 68px minmax(0, 1fr);
        gap: 10px;
      }

      .ai-review-row-label {
        font-size: 12px;
        font-weight: 700;
        letter-spacing: -.01em;
        color: rgba(15,23,42,0.54);
      }

      .ai-review-row-value {
        min-width: 0;
        font-size: 13px;
        line-height: 1.6;
        color: rgba(15,23,42,0.86);
      }

      .ai-review-row-value.multiline {
        line-height: 1.72;
      }

      .ai-review-pages {
        margin-top: 10px;
        display: flex;
        flex-direction: column;
      }

      .ai-review-page {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 0;
        border-top: 1px solid rgba(15,23,42,0.05);
      }

      .ai-review-page:first-child {
        border-top: 0;
        padding-top: 0;
      }

      .ai-review-page:last-child {
        padding-bottom: 0;
      }

      .ai-review-page-main {
        min-width: 0;
        flex: 1 1 auto;
      }

      .ai-review-page-title {
        font-size: 13px;
        line-height: 1.45;
        font-weight: 700;
        letter-spacing: -.02em;
        color: rgba(15,23,42,0.94);
      }

      .ai-review-page-meta {
        margin-top: 3px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 11px;
        line-height: 1.45;
        color: rgba(15,23,42,0.42);
      }

      .ai-review-page-note {
        flex: 0 0 auto;
        max-width: 132px;
        text-align: right;
        font-size: 11px;
        line-height: 1.5;
        color: rgba(15,23,42,0.54);
      }

      .ai-review-footer {
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid rgba(15,23,42,0.06);
        display: flex;
        flex-direction: column;
        gap: 7px;
      }

      .ai-review-footnote {
        font-size: 12px;
        line-height: 1.6;
        color: rgba(15,23,42,0.6);
      }

      .ai-typing-bubble {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 14px 15px;
        border-radius: 12px;
        border: 1px solid rgba(229,231,235,0.98);
        background: rgba(255,255,255,0.98);
      }

      .ai-typing-dot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: rgba(100,116,139,0.82);
        animation: aiWidgetTyping 1s ease-in-out infinite;
      }

      .ai-typing-dot:nth-child(2) { animation-delay: .14s; }
      .ai-typing-dot:nth-child(3) { animation-delay: .28s; }

      .ai-composer {
        flex: 0 0 auto;
        padding: 12px 16px 16px;
        border-top: 1px solid rgba(229,231,235,0.98);
        background: rgba(249,250,251,0.98);
      }

      .ai-composer-shell {
        display: flex;
        align-items: flex-end;
        gap: 10px;
        padding: 10px 10px 10px 14px;
        border-radius: 12px;
        border: 1px solid rgba(209,213,219,0.98);
        background: #ffffff;
      }

      .ai-composer-input {
        flex: 1 1 auto;
        min-height: 24px;
        max-height: 140px;
        border: 0;
        outline: 0;
        resize: none;
        background: transparent;
        color: #111827;
        font-size: 14px;
        line-height: 1.65;
        padding: 2px 0 0;
      }

      .ai-composer-input::placeholder {
        color: #94a3b8;
      }

      .ai-send-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        width: 44px;
        height: 44px;
        border-radius: 10px;
        border: 1px solid rgba(37,99,235,0.36);
        color: #ffffff;
        background: #2563eb;
        box-shadow: none;
        transition: transform .18s ease, opacity .18s ease;
      }

      .ai-send-btn:hover:not(:disabled) {}

      .ai-send-btn:disabled {
        opacity: .46;
        cursor: default;
      }

      @keyframes aiWidgetPanelIn {
        from {
          opacity: 0;
          transform: translateY(10px) scale(.986);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes aiWidgetBubbleIn {
        from {
          opacity: 0;
          transform: translateY(14px) scale(.988);
          filter: blur(5px);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
          filter: blur(0);
        }
      }

      @keyframes aiWidgetTyping {
        0%, 80%, 100% {
          transform: translateY(0);
          opacity: .4;
        }
        40% {
          transform: translateY(-4px);
          opacity: 1;
        }
      }

      @media (max-width: 640px) {
        .ai-widget-root {
          right: 14px;
          bottom: 14px;
        }

        .ai-widget-panel {
          width: min(calc(100vw - 18px), 100vw);
          height: min(84vh, 720px);
        }

        .ai-widget-switch-btn {
          min-width: 0;
          flex: 1 1 0;
        }

        .ai-bubble {
          max-width: 86%;
        }

        .ai-review-header {
          flex-direction: column;
          align-items: flex-start;
        }

        .ai-review-action {
          width: 100%;
        }

        .ai-review-page {
          flex-direction: column;
        }

        .ai-review-page-note {
          max-width: none;
          text-align: left;
        }
      }
    `,
    []
  );
}

function LauncherGlyph() {
  return (
    <div className="ai-widget-glyph" aria-hidden="true">
      <Bot className="h-[20px] w-[20px] text-white" strokeWidth={2.1} />
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="ai-row assistant">
      <div className="ai-typing-bubble" aria-hidden="true">
        <span className="ai-typing-dot" />
        <span className="ai-typing-dot" />
        <span className="ai-typing-dot" />
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

  function handleSubmit() {
    onSend?.(input);
  }

  return (
    <div className="ai-thread-wrap">
      <div ref={scrollRef} className="ai-thread-scroll">
        <div className="ai-thread-stack">
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
                className={`ai-row ${isUser ? "user" : "assistant"}`}
                style={{ animationDelay: `${Math.min(index * 36, 180)}ms` }}
              >
                <div className={`ai-bubble ${isUser ? "user" : "assistant"}`}>
                  {s(message.title) ? (
                    <div className="ai-bubble-title">{message.title}</div>
                  ) : null}

                  <div className="ai-bubble-text">{message.text}</div>

                  {showActions ? (
                    <div className="ai-quick-row">
                      {arr(message.actions).map((action) => (
                        <button
                          key={`${message.id}-${action.path}-${action.label}`}
                          type="button"
                          className="ai-action-link"
                          onClick={() => onAction?.(action.path)}
                        >
                          <span>{action.label}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {showSuggestions ? (
                    <div className="ai-quick-row">
                      {arr(message.suggestions).map((suggestion) => (
                        <button
                          key={`${message.id}-${suggestion}`}
                          type="button"
                          className="ai-quick-chip"
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

      <div className="ai-composer">
        <div className="ai-composer-shell">
          <textarea
            rows={1}
            value={input}
            onChange={(event) => onInputChange?.(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask about setup, runtime, channels, inbox, comments, or voice..."
            className="ai-composer-input"
          />

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!s(input) || busy}
            className="ai-send-btn"
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
  const styles = useWidgetStyles();
  const queryClient = useQueryClient();
  const rootRef = useRef(null);
  const assistantRef = useRef(normalizeAssistantState(assistant));
  const pageMode = presentation === "page";
  const panelOpen = pageMode ? true : open;
  const workspace = useWorkspaceTenantKey({
    enabled: panelOpen,
  });

  const [clientAssistant, setClientAssistant] = useState(
    normalizeAssistantState(assistant)
  );
  const [surfaceMode, setSurfaceMode] = useState("setup");
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [importingWebsite, setImportingWebsite] = useState(false);
  const [importError, setImportError] = useState("");

  const [supportMessages, setSupportMessages] = useState(
    buildSupportWelcomeFromAssistant(assistantRef.current)
  );
  const [supportInput, setSupportInput] = useState("");
  const [supportBusy, setSupportBusy] = useState(false);
  const productHomeQueryKey = buildWorkspaceScopedQueryKey(
    ["product-home"],
    workspace.tenantKey
  );
  const setupReviewQueryKey = buildWorkspaceScopedQueryKey(
    ["setup-review-current", "widget"],
    workspace.tenantKey
  );
  const telegramStatusQueryKey = buildWorkspaceScopedQueryKey(
    ["telegram-channel-status"],
    workspace.tenantKey
  );
  const metaStatusQueryKey = buildWorkspaceScopedQueryKey(
    ["meta-channel-status"],
    workspace.tenantKey
  );
  const reviewQuery = useQuery({
    queryKey: setupReviewQueryKey,
    queryFn: () => getCurrentSetupReview({ eventLimit: 12 }),
    enabled: panelOpen && surfaceMode === "setup" && workspace.ready,
    retry: false,
    staleTime: 30_000,
  });

  useEffect(() => {
    const normalized = normalizeAssistantState(assistant);
    assistantRef.current = normalized;
    setClientAssistant(normalized);
  }, [assistant]);

  useEffect(() => {
    assistantRef.current = clientAssistant;
  }, [clientAssistant]);

    const supportWelcomeMessages = useMemo(
    () => buildSupportWelcomeFromAssistant(clientAssistant),
    [clientAssistant]
  );

  useEffect(() => {
    setSupportMessages((current) => {
      const hasUserMessages = current.some((item) => item.role === "user");
      if (hasUserMessages) return current;
      return supportWelcomeMessages;
    });
  }, [supportWelcomeMessages]);

  useEffect(() => {
    if (!panelOpen || pageMode) return;

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        onOpenChange?.(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [onOpenChange, pageMode, panelOpen]);

  useEffect(() => {
    if (!panelOpen) return;
    if (clientAssistant.launchPosture === "runtime_repair_needed") {
      setSurfaceMode("support");
    }
  }, [clientAssistant.launchPosture, panelOpen]);

  if (hidden) return null;

  async function ensureSession() {
    const current = assistantRef.current;
    if (s(current.session?.id)) {
      return current;
    }

    const response = await startSetupAssistantSession();
    let nextAssistant = null;

    setClientAssistant((prev) => {
      nextAssistant = buildAssistantFromApi(prev, response);
      return nextAssistant;
    });

    return nextAssistant || assistantRef.current;
  }

  async function handleSetupPatchDraft(payload = {}) {
    if (saving || finalizing || importingWebsite) return null;

    setSaving(true);
    setImportError("");
    try {
      await ensureSession();
      const response = await updateCurrentSetupAssistantDraft(payload);

      setClientAssistant((prev) => buildAssistantFromApi(prev, response));

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: productHomeQueryKey }),
        queryClient.invalidateQueries({ queryKey: setupReviewQueryKey }),
      ]);
      return response;
    } finally {
      setSaving(false);
    }
  }

  async function handleSetupParseMessage({ text, step }) {
    const answer = s(text);
    if (!answer || saving || finalizing || importingWebsite) return null;

    setSaving(true);
    setImportError("");
    try {
      await ensureSession();
      const response = await sendSetupAssistantMessage({
        step: s(step, "profile"),
        answer,
      });

      setClientAssistant((prev) => buildAssistantFromApi(prev, response));

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: productHomeQueryKey }),
        queryClient.invalidateQueries({ queryKey: setupReviewQueryKey }),
      ]);
      return response;
    } finally {
      setSaving(false);
    }
  }

  async function handleSetupFinalize() {
    if (saving || finalizing || importingWebsite) return null;

    setFinalizing(true);
    setImportError("");
    try {
      await ensureSession();
      const response = await finalizeSetupAssistantSession({});

      if (response?.ok === false) {
        throw new Error(
          s(response?.reason || response?.error, "Failed to finalize setup")
        );
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: productHomeQueryKey }),
        queryClient.invalidateQueries({ queryKey: setupReviewQueryKey }),
        queryClient.invalidateQueries({ queryKey: telegramStatusQueryKey }),
        queryClient.invalidateQueries({ queryKey: metaStatusQueryKey }),
      ]);

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
              "Setup finalized. Approved truth and strict runtime projection were refreshed.",
          },
          assistant: {
            ...obj(prev.assistant),
            completion: {
              ready: false,
              action: null,
              message:
                "Setup finalized. Approved truth and strict runtime projection were refreshed.",
            },
          },
        })
      );

      return response;
    } finally {
      setFinalizing(false);
    }
  }

  async function handleImportWebsite(url = "") {
    const websiteUrl =
      s(url) ||
      s(assistantRef.current?.websitePrefill?.websiteUrl) ||
      s(assistantRef.current?.draft?.businessProfile?.websiteUrl);

    if (!websiteUrl || saving || finalizing || importingWebsite) {
      return null;
    }

    setImportError("");
    setImportingWebsite(true);
    try {
      await ensureSession();
      const response = await importWebsiteForSetup({
        websiteUrl,
        allowSessionReuse: true,
        waitForCompletion: true,
      });

      if (response?.ok === false) {
        throw new Error(
          s(response?.reason || response?.error, "Website scan failed")
        );
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: productHomeQueryKey }),
        queryClient.invalidateQueries({ queryKey: setupReviewQueryKey }),
      ]);

      return response;
    } catch (error) {
      setImportError(s(error?.message, "Website scan failed"));
      return null;
    } finally {
      setImportingWebsite(false);
    }
  }

  async function handleSupportSend(rawText) {
    const text = s(rawText);
    if (!text || supportBusy) return;

    setSupportMessages((current) => [
      ...current,
      {
        id: `support-user-${Date.now()}`,
        role: "user",
        text,
      },
    ]);
    setSupportInput("");
    setSupportBusy(true);

    const reply = buildSupportReply(text, assistantRef.current);
    await new Promise((resolve) => window.setTimeout(resolve, 240));

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

  return (
    <>
      <style>{styles}</style>

      <div
        ref={rootRef}
        className="ai-widget-root"
        style={
          pageMode
            ? {
                position: "relative",
                right: "auto",
                bottom: "auto",
                width: "100%",
                zIndex: "auto",
              }
            : undefined
        }
      >
        {panelOpen ? (
          <section
            className="ai-widget-panel"
            role={pageMode ? "region" : "dialog"}
            aria-modal={pageMode ? undefined : "false"}
            aria-label={pageMode ? "Setup workspace" : "AI assistant"}
            style={
              pageMode
                ? {
                    position: "relative",
                    right: "auto",
                    bottom: "auto",
                    width: "100%",
                    maxWidth: "none",
                    height: "100%",
                    minHeight: "720px",
                    animation: "none",
                  }
                : undefined
            }
          >
            <div className="ai-widget-header">
              <div className="ai-widget-header-top">
                <div className="ai-widget-title">
                  {surfaceMode === "setup" ? "Setup" : "Support"}
                </div>

                {!pageMode ? (
                  <button
                    type="button"
                    onClick={() => onOpenChange?.(false)}
                    className="ai-widget-close"
                    aria-label="Close AI assistant"
                  >
                    <X className="h-4 w-4" strokeWidth={2} />
                  </button>
                ) : null}
              </div>

              <div className="ai-widget-switch">
                <button
                  type="button"
                  className={`ai-widget-switch-btn ${
                    surfaceMode === "setup" ? "active" : ""
                  }`}
                  onClick={() => setSurfaceMode("setup")}
                >
                  <Sparkles className="h-4 w-4" strokeWidth={2.05} />
                  <span>Setup</span>
                </button>

                <button
                  type="button"
                  className={`ai-widget-switch-btn ${
                    surfaceMode === "support" ? "active" : ""
                  }`}
                  onClick={() => setSurfaceMode("support")}
                >
                  <LifeBuoy className="h-4 w-4" strokeWidth={2.05} />
                  <span>Support</span>
                </button>
              </div>
            </div>

            <div className="ai-widget-body">
              {surfaceMode === "setup" ? (
                  <SetupAssistantSections
                    assistant={clientAssistant}
                    reviewPayload={reviewQuery.data}
                    saving={saving}
                    finalizing={finalizing}
                    importingWebsite={importingWebsite}
                    importError={importError}
                    onImportWebsite={handleImportWebsite}
                    onPatchDraft={handleSetupPatchDraft}
                    onParseMessage={handleSetupParseMessage}
                    onFinalize={handleSetupFinalize}
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
        ) : null}

        {!pageMode ? (
          <button
            type="button"
            onClick={() => onOpenChange?.(!panelOpen)}
            aria-label="Open AI assistant"
            aria-expanded={panelOpen}
            className="ai-widget-launcher"
          >
            <span className="ai-widget-launcher-core" />
            <span className="ai-widget-launcher-badge" />
            <LauncherGlyph />
          </button>
        ) : null}
      </div>
    </>
  );
}
