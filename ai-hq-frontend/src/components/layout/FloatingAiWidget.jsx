import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  sendSetupAssistantMessage,
  startSetupAssistantSession,
  updateCurrentSetupAssistantDraft,
} from "../../api/setup.js";
import SetupAssistantSections from "./SetupAssistantSections.jsx";

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

function buildInitialSupportMessages() {
  return [
    {
      id: "support-welcome",
      role: "assistant",
      text: "Tell me what is broken, and I’ll guide you from there.",
      suggestions: [
        "Instagram connection problem",
        "Truth/runtime is unavailable",
        "Inbox is not updating",
      ],
      actions: [],
    },
  ];
}

function buildSupportReply(rawText = "") {
  const text = s(rawText);
  const lower = text.toLowerCase();

  if (
    /instagram|telegram|whatsapp|channel|channels|meta|facebook/.test(lower)
  ) {
    return {
      text:
        "Start from the channel surface. Check connector state, identifiers, and blocked secrets before treating it as a runtime problem.",
      actions: [{ label: "Open channels", path: "/channels" }],
      suggestions: [
        "Telegram is connected but not working",
        "Instagram webhook problem",
      ],
    };
  }

  if (/truth|runtime|approved|projection|brain/.test(lower)) {
    return {
      text:
        "Check the approved truth and runtime projection first. Compare the latest state instead of trusting the page at a glance.",
      actions: [
        { label: "Open truth", path: "/truth" },
        { label: "Open home", path: "/home" },
      ],
      suggestions: [
        "Why is runtime unavailable?",
        "Compare truth versions",
      ],
    };
  }

  if (/inbox|dm|message|messages|comment|comments|reply/.test(lower)) {
    return {
      text:
        "Look at the operator surface first. We usually need to confirm inbound freshness and outbound execution truth.",
      actions: [
        { label: "Open inbox", path: "/inbox" },
        { label: "Open comments", path: "/comments" },
      ],
      suggestions: ["DMs are not appearing", "Comment reply failed"],
    };
  }

  if (/voice|call|phone|twilio/.test(lower)) {
    return {
      text:
        "Voice issues are usually readiness, authority, or session-truth problems. The voice surface is the fastest place to inspect it.",
      actions: [{ label: "Open voice", path: "/voice" }],
      suggestions: [
        "Voice assistant not answering",
        "Phone number readiness issue",
      ],
    };
  }

  if (/setup|business|draft|service|services|website/.test(lower)) {
    return {
      text:
        "Setup should shape the business first. Channels come later. I can take you back into the setup flow now.",
      actions: [{ label: "Open home", path: "/home?assistant=setup" }],
      suggestions: ["Continue business setup", "How should I add services?"],
    };
  }

  return {
    text:
      "Tell me which area is affected: channels, truth/runtime, inbox/comments, voice, or setup.",
    actions: [{ label: "Open home", path: "/home" }],
    suggestions: [
      "Channels issue",
      "Truth/runtime issue",
      "Inbox issue",
      "Setup issue",
    ],
  };
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
        border: 1px solid rgba(65, 101, 216, 0.55);
        background:
          radial-gradient(circle at 28% 24%, rgba(255,255,255,0.22), transparent 26%),
          linear-gradient(180deg, #4474f5 0%, #355ed8 62%, #2949b5 100%);
        box-shadow:
          0 22px 40px rgba(39, 67, 158, 0.34),
          inset 0 1px 0 rgba(255,255,255,0.14);
      }

      .ai-widget-launcher-badge {
        position: absolute;
        top: 7px;
        right: 7px;
        width: 10px;
        height: 10px;
        border-radius: 999px;
        border: 2px solid rgba(237,241,255,0.98);
        background: #81a3ff;
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
        border-radius: 28px;
        border: 1px solid rgba(220, 225, 234, 0.98);
        background: linear-gradient(180deg, rgba(253,254,255,0.99), rgba(248,249,252,0.99));
        box-shadow:
          0 44px 100px -46px rgba(15, 23, 42, 0.42),
          0 16px 32px rgba(15, 23, 42, 0.10);
        animation: aiWidgetPanelIn .22s cubic-bezier(.22,1,.36,1);
      }

      .ai-widget-header {
        flex: 0 0 auto;
        padding: 16px 16px 12px;
        border-bottom: 1px solid rgba(232, 235, 241, 0.98);
        background: rgba(255,255,255,0.82);
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
        color: #0f172a;
      }

      .ai-widget-close {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 38px;
        height: 38px;
        border-radius: 14px;
        border: 1px solid rgba(228,232,239,0.98);
        background: rgba(255,255,255,0.96);
        color: #64748b;
        transition: all .18s ease;
      }

      .ai-widget-close:hover {
        color: #0f172a;
        transform: translateY(-1px);
      }

      .ai-widget-switch {
        display: inline-flex;
        gap: 4px;
        margin-top: 12px;
        padding: 4px;
        border-radius: 16px;
        background: rgba(245,247,250,0.98);
        border: 1px solid rgba(231,234,240,0.98);
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
        border-radius: 12px;
        background: transparent;
        color: #64748b;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: -.02em;
        transition: all .18s ease;
      }

      .ai-widget-switch-btn.active {
        background: rgba(255,255,255,0.98);
        color: #1f3b90;
        box-shadow: 0 8px 20px -18px rgba(52,93,215,0.5);
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
        border-radius: 22px;
        position: relative;
      }

      .ai-bubble.assistant {
        border-bottom-left-radius: 8px;
        background: #f2f4f7;
        color: #111827;
      }

      .ai-bubble.user {
        border-bottom-right-radius: 8px;
        background: linear-gradient(180deg, #4673f2 0%, #355cd6 100%);
        color: #ffffff;
        box-shadow: 0 18px 30px -22px rgba(53,92,214,0.5);
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
        border: 1px solid rgba(206,216,238,0.98);
        background: rgba(247,249,255,0.98);
        color: #2445aa;
      }

      .ai-action-link {
        border: 1px solid rgba(226,231,239,0.98);
        background: rgba(255,255,255,0.96);
        color: #0f172a;
      }

      .ai-quick-chip:hover,
      .ai-action-link:hover {
        transform: translateY(-1px);
      }

      .ai-typing-bubble {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 14px 15px;
        border-radius: 20px;
        border-bottom-left-radius: 8px;
        background: #f2f4f7;
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
        border-top: 1px solid rgba(232,235,241,0.98);
        background: rgba(255,255,255,0.94);
      }

      .ai-composer-shell {
        display: flex;
        align-items: flex-end;
        gap: 10px;
        padding: 10px 10px 10px 14px;
        border-radius: 22px;
        border: 1px solid rgba(228,232,239,0.98);
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
        color: #0f172a;
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
        border-radius: 16px;
        border: 1px solid rgba(86,118,226,0.36);
        color: #ffffff;
        background: linear-gradient(180deg, #4a75f6 0%, #355cd6 100%);
        box-shadow: 0 18px 28px -20px rgba(53,92,214,0.52);
        transition: transform .18s ease, opacity .18s ease;
      }

      .ai-send-btn:hover:not(:disabled) {
        transform: translateY(-1px);
      }

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
                          key={`${message.id}-${action.path}`}
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
            placeholder="Ask a question..."
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
}) {
  const styles = useWidgetStyles();
  const queryClient = useQueryClient();
  const rootRef = useRef(null);
  const assistantRef = useRef(normalizeAssistantState(assistant));

  const [clientAssistant, setClientAssistant] = useState(
    normalizeAssistantState(assistant)
  );
  const [surfaceMode, setSurfaceMode] = useState("setup");
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const [supportMessages, setSupportMessages] = useState(
    buildInitialSupportMessages()
  );
  const [supportInput, setSupportInput] = useState("");
  const [supportBusy, setSupportBusy] = useState(false);

  useEffect(() => {
    const normalized = normalizeAssistantState(assistant);
    assistantRef.current = normalized;
    setClientAssistant(normalized);
  }, [assistant]);

  useEffect(() => {
    assistantRef.current = clientAssistant;
  }, [clientAssistant]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        onOpenChange?.(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, onOpenChange]);

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
    if (saving || finalizing) return null;

    setSaving(true);
    try {
      await ensureSession();
      const response = await updateCurrentSetupAssistantDraft(payload);

      setClientAssistant((prev) => buildAssistantFromApi(prev, response));

      await queryClient.invalidateQueries({ queryKey: ["product-home"] });
      return response;
    } finally {
      setSaving(false);
    }
  }

  async function handleSetupParseMessage({ text, step }) {
    const answer = s(text);
    if (!answer || saving || finalizing) return null;

    setSaving(true);
    try {
      await ensureSession();
      const response = await sendSetupAssistantMessage({
        step: s(step, "profile"),
        answer,
      });

      setClientAssistant((prev) => buildAssistantFromApi(prev, response));

      await queryClient.invalidateQueries({ queryKey: ["product-home"] });
      return response;
    } finally {
      setSaving(false);
    }
  }

  async function handleSetupFinalize() {
    if (saving || finalizing) return null;

    setFinalizing(true);
    try {
      await ensureSession();
      const response = await finalizeSetupAssistantSession({});

      if (response?.ok === false) {
        throw new Error(
          s(response?.reason || response?.error, "Failed to finalize setup")
        );
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["product-home"] }),
        queryClient.invalidateQueries({ queryKey: ["telegram-channel-status"] }),
        queryClient.invalidateQueries({ queryKey: ["meta-channel-status"] }),
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

    const reply = buildSupportReply(text);
    await new Promise((resolve) => window.setTimeout(resolve, 240));

    setSupportMessages((current) => [
      ...current,
      {
        id: `support-assistant-${Date.now()}`,
        role: "assistant",
        text: reply.text,
        actions: arr(reply.actions),
        suggestions: arr(reply.suggestions),
      },
    ]);

    setSupportBusy(false);
  }

  function handleSupportAction(path) {
    if (!s(path)) return;
    onNavigate?.(path);
    onOpenChange?.(false);
  }

  return (
    <>
      <style>{styles}</style>

      <div ref={rootRef} className="ai-widget-root">
        {open ? (
          <section
            className="ai-widget-panel"
            role="dialog"
            aria-modal="false"
            aria-label="AI assistant"
          >
            <div className="ai-widget-header">
              <div className="ai-widget-header-top">
                <div className="ai-widget-title">
                  {surfaceMode === "setup" ? "Setup" : "Support"}
                </div>

                <button
                  type="button"
                  onClick={() => onOpenChange?.(false)}
                  className="ai-widget-close"
                  aria-label="Close AI assistant"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
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
                  saving={saving}
                  finalizing={finalizing}
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

        <button
          type="button"
          onClick={() => onOpenChange?.(!open)}
          aria-label="Open AI assistant"
          aria-expanded={open}
          className="ai-widget-launcher"
        >
          <span className="ai-widget-launcher-core" />
          <span className="ai-widget-launcher-badge" />
          <LauncherGlyph />
        </button>
      </div>
    </>
  );
}