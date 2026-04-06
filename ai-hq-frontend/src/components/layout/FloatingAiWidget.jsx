import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Globe2,
  Link2,
  MessageSquareText,
  Sparkles,
  X,
} from "lucide-react";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import Input, { Textarea } from "../ui/Input.jsx";
import { InlineNotice } from "../ui/AppShellPrimitives.jsx";
import {
  startOnboardingSession,
  updateCurrentOnboardingDraft,
} from "../../api/onboarding.js";

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

function useWidgetStyles() {
  return useMemo(
    () => `
      @keyframes liveWidgetFloat {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-2px); }
      }

      @keyframes liveWidgetPulse {
        0%, 100% { opacity: 0.82; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.04); }
      }

      @keyframes liveWidgetSweep {
        0% { opacity: 0; transform: translateX(-18px); }
        18% { opacity: 0.16; }
        50% { opacity: 0.24; transform: translateX(0px); }
        82% { opacity: 0.14; }
        100% { opacity: 0; transform: translateX(18px); }
      }

      @keyframes liveWidgetTyping1 {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.42; }
        40% { transform: translateY(-2px); opacity: 1; }
      }

      @keyframes liveWidgetTyping2 {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.42; }
        48% { transform: translateY(-2px); opacity: 1; }
      }

      @keyframes liveWidgetTyping3 {
        0%, 80%, 100% { transform: translateY(0); opacity: 0.42; }
        56% { transform: translateY(-2px); opacity: 1; }
      }

      @keyframes liveWidgetBadge {
        0%, 100% { transform: scale(1); opacity: 0.94; }
        50% { transform: scale(1.08); opacity: 1; }
      }

      @keyframes liveWidgetPanelEnter {
        from { opacity: 0; transform: translateY(18px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .live-widget-wrap {
        position: fixed;
        z-index: 90;
      }

      .live-widget-btn {
        position: relative;
        width: 58px;
        height: 58px;
        border: 0;
        padding: 0;
        background: transparent;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        animation: liveWidgetFloat 4.8s ease-in-out infinite;
        transition: transform 180ms ease;
      }

      .live-widget-btn:hover {
        transform: translateY(-1px) scale(1.025);
      }

      .live-widget-btn:active {
        transform: scale(0.975);
      }

      .live-widget-shadow {
        position: absolute;
        left: 50%;
        bottom: -3px;
        width: 42px;
        height: 12px;
        transform: translateX(-50%);
        border-radius: 999px;
        background: radial-gradient(
          ellipse at center,
          rgba(15, 23, 42, 0.18) 0%,
          rgba(15, 23, 42, 0.08) 46%,
          rgba(15, 23, 42, 0) 80%
        );
        filter: blur(5px);
        pointer-events: none;
      }

      .live-widget-shell {
        position: absolute;
        inset: 0;
        overflow: hidden;
        border-radius: 18px;
        background:
          radial-gradient(circle at 28% 20%, rgba(255,255,255,0.26) 0%, rgba(255,255,255,0.08) 18%, transparent 40%),
          linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(244,247,252,0.98) 100%);
        border: 1px solid rgba(205, 214, 229, 0.98);
        box-shadow:
          0 16px 32px rgba(15, 23, 42, 0.12),
          0 6px 12px rgba(15, 23, 42, 0.07),
          inset 0 1px 0 rgba(255,255,255,0.92);
        transition:
          transform 180ms ease,
          box-shadow 180ms ease,
          border-color 180ms ease;
      }

      .live-widget-btn:hover .live-widget-shell {
        border-color: rgba(179, 191, 212, 1);
        box-shadow:
          0 18px 36px rgba(15, 23, 42, 0.14),
          0 8px 14px rgba(15, 23, 42, 0.08),
          inset 0 1px 0 rgba(255,255,255,0.95);
      }

      .live-widget-rim {
        position: absolute;
        inset: 4px;
        border-radius: 14px;
        border: 1px solid rgba(255,255,255,0.72);
        opacity: 0.58;
        pointer-events: none;
      }

      .live-widget-shine {
        position: absolute;
        top: 8px;
        left: 10px;
        width: 16px;
        height: 8px;
        border-radius: 999px;
        background: linear-gradient(
          180deg,
          rgba(255,255,255,0.92) 0%,
          rgba(255,255,255,0.18) 100%
        );
        transform: rotate(-18deg);
        pointer-events: none;
      }

      .live-widget-aura {
        position: absolute;
        inset: 8px;
        border-radius: 14px;
        background: radial-gradient(
          circle at 50% 58%,
          rgba(61, 109, 242, 0.10) 0%,
          rgba(61, 109, 242, 0.04) 42%,
          rgba(61, 109, 242, 0) 74%
        );
        animation: liveWidgetPulse 3.6s ease-in-out infinite;
        pointer-events: none;
      }

      .live-widget-chat {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 28px;
        height: 20px;
        transform: translate(-50%, -50%);
      }

      .live-widget-chat-bubble {
        position: absolute;
        inset: 0;
        border-radius: 10px;
        background: linear-gradient(180deg, #4f7cf5 0%, #3157d5 100%);
        box-shadow:
          0 8px 16px rgba(49, 87, 213, 0.22),
          inset 0 1px 0 rgba(255,255,255,0.24);
      }

      .live-widget-chat-tail {
        position: absolute;
        left: 3px;
        bottom: -2px;
        width: 8px;
        height: 8px;
        background: #3157d5;
        clip-path: polygon(0 0, 100% 0, 0 100%);
        filter: drop-shadow(0 2px 3px rgba(49, 87, 213, 0.16));
      }

      .live-widget-chat-sweep {
        position: absolute;
        top: 3px;
        bottom: 3px;
        left: 7px;
        width: 7px;
        border-radius: 999px;
        background: linear-gradient(
          180deg,
          rgba(255,255,255,0) 0%,
          rgba(255,255,255,0.42) 45%,
          rgba(255,255,255,0) 100%
        );
        transform: rotate(-14deg);
        animation: liveWidgetSweep 4.4s ease-in-out infinite;
        pointer-events: none;
      }

      .live-widget-dots {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
      }

      .live-widget-dot {
        width: 4px;
        height: 4px;
        border-radius: 999px;
        background: #ffffff;
      }

      .live-widget-dot:nth-child(1) { animation: liveWidgetTyping1 1.5s ease-in-out infinite; }
      .live-widget-dot:nth-child(2) { animation: liveWidgetTyping2 1.5s ease-in-out infinite; }
      .live-widget-dot:nth-child(3) { animation: liveWidgetTyping3 1.5s ease-in-out infinite; }

      .live-widget-status {
        position: absolute;
        top: 5px;
        right: 5px;
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: #3f6df2;
        border: 2px solid #ffffff;
        box-shadow:
          0 0 0 1px rgba(191, 219, 254, 0.72),
          0 0 10px rgba(63,109,242,0.14);
        animation: liveWidgetBadge 2.8s ease-in-out infinite;
      }

      .live-widget-panel {
        animation: liveWidgetPanelEnter 180ms ease;
      }

      @media (max-width: 768px) {
        .live-widget-btn {
          width: 54px;
          height: 54px;
        }

        .live-widget-chat {
          width: 26px;
          height: 18px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .live-widget-btn,
        .live-widget-aura,
        .live-widget-chat-sweep,
        .live-widget-dot,
        .live-widget-status,
        .live-widget-panel {
          animation: none !important;
        }
      }
    `,
    []
  );
}

function LivingSupportGlyph() {
  return (
    <span className="live-widget-chat" aria-hidden="true">
      <span className="live-widget-chat-bubble" />
      <span className="live-widget-chat-tail" />
      <span className="live-widget-chat-sweep" />
      <span className="live-widget-dots">
        <span className="live-widget-dot" />
        <span className="live-widget-dot" />
        <span className="live-widget-dot" />
      </span>
    </span>
  );
}

function MessageBubble({ message }) {
  const tone =
    message?.role === "system"
      ? "border-[rgba(var(--color-warning),0.18)] bg-[rgba(var(--color-warning),0.08)]"
      : "border-line bg-white";

  return (
    <div className={`rounded-[16px] border px-4 py-3 shadow-[0_6px_18px_-16px_rgba(15,23,42,0.22)] ${tone}`}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
        {message?.role === "assistant" ? (
          <Sparkles className="h-3.5 w-3.5 text-brand" strokeWidth={1.9} />
        ) : (
          <Bot className="h-3.5 w-3.5 text-text-subtle" strokeWidth={1.9} />
        )}
        <span>{message?.title || "Update"}</span>
      </div>
      <div className="mt-2 text-[13px] leading-6 text-text-muted">
        {message?.body}
      </div>
    </div>
  );
}

function ReviewMetric({ label, value }) {
  return (
    <div className="rounded-[14px] border border-line bg-white px-3 py-3 shadow-[0_6px_18px_-16px_rgba(15,23,42,0.18)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
        {label}
      </div>
      <div className="mt-2 text-[14px] font-semibold tracking-[-0.03em] text-text">
        {value}
      </div>
    </div>
  );
}

function buildDefaultAssistant() {
  return {
    mode: "shortcut",
    title: "AI onboarding lives on Home",
    statusLabel: "Home shortcut",
    summary:
      "Use Home to connect Telegram, continue the structured draft, and inspect truth/runtime readiness.",
    primaryAction: {
      label: "Open home assistant",
      path: "/home?assistant=setup",
    },
    secondaryAction: {
      label: "Open channels",
      path: "/channels?channel=telegram",
    },
    messages: [
      {
        id: "shortcut",
        role: "assistant",
        title: "Open Home",
        body:
          "The onboarding shell is available on Home, where Telegram connect and strict runtime posture are already composed together.",
      },
    ],
    review: {
      message:
        "Draft-only onboarding remains intentionally separate from truth approval and runtime activation in this batch.",
    },
    launchPosture: "shortcut",
    onboardingNeeded: false,
    session: {},
    draft: {
      businessProfile: {},
      services: [],
      contacts: [],
      hours: [],
      pricingPosture: {},
      handoffRules: {},
      version: 0,
      updatedAt: null,
    },
    websitePrefill: {
      supported: true,
      status: "awaiting_input",
      websiteUrl: "",
    },
    launchChannel: {},
    truthRuntime: {},
  };
}

export default function FloatingAiWidget({
  hidden = false,
  open = false,
  onOpenChange,
  onNavigate,
  assistant = null,
  bottomClassName = "bottom-5 md:bottom-6",
  rightClassName = "right-4 md:right-6",
}) {
  const styles = useWidgetStyles();
  const queryClient = useQueryClient();
  const resolvedAssistant = assistant || buildDefaultAssistant();
  const draft = obj(resolvedAssistant.draft);
  const profile = obj(draft.businessProfile);
  const websitePrefill = obj(resolvedAssistant.websitePrefill);
  const review = obj(resolvedAssistant.review);
  const messagesSeed = arr(resolvedAssistant.messages);
  const seedKey = [
    s(resolvedAssistant.launchPosture),
    s(resolvedAssistant.session?.id),
    String(draft.version || 0),
  ].join(":");

  const [panelView, setPanelView] = useState(
    resolvedAssistant.onboardingNeeded ? "conversation" : "review"
  );
  const [messages, setMessages] = useState(messagesSeed);
  const [companyName, setCompanyName] = useState(s(profile.companyName));
  const [websiteUrl, setWebsiteUrl] = useState(
    s(profile.websiteUrl || websitePrefill.websiteUrl)
  );
  const [description, setDescription] = useState(s(profile.description));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  const initialFocusRef = useRef(null);

  useEffect(() => {
    setMessages(messagesSeed);
  }, [seedKey, messagesSeed]);

  useEffect(() => {
    setCompanyName(s(profile.companyName));
    setWebsiteUrl(s(profile.websiteUrl || websitePrefill.websiteUrl));
    setDescription(s(profile.description));
  }, [
    s(resolvedAssistant.session?.id),
    draft.version,
    s(profile.companyName),
    s(profile.websiteUrl),
    s(websitePrefill.websiteUrl),
    s(profile.description),
  ]);

  useEffect(() => {
    setPanelView(resolvedAssistant.onboardingNeeded ? "conversation" : "review");
  }, [resolvedAssistant.onboardingNeeded, seedKey]);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange?.(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => {
      initialFocusRef.current?.focus?.();
    });
  }, [open, panelView]);

  if (hidden) return null;

  const hasDraft =
    Boolean(
      s(profile.companyName) ||
        s(profile.websiteUrl) ||
        s(profile.description) ||
        arr(draft.services).length ||
        arr(draft.contacts).length ||
        arr(draft.hours).length ||
        Object.keys(obj(draft.pricingPosture)).length ||
        Object.keys(obj(draft.handoffRules)).length
    );
  const canEditDraft =
    resolvedAssistant.mode === "onboarding" &&
    s(resolvedAssistant.launchPosture) !== "connect_channel";

  async function handleSaveDraft() {
    if (!canEditDraft || saving) return;

    if (!s(companyName) && !s(websiteUrl) && !s(description)) {
      setNotice({
        tone: "danger",
        title: "Add one business input",
        description:
          "Start with a website, company name, or short description before saving the draft.",
      });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      if (!s(resolvedAssistant.session?.id)) {
        await startOnboardingSession();
      }

      await updateCurrentOnboardingDraft({
        draft: {
          businessProfile: {
            companyName: s(companyName),
            websiteUrl: s(websiteUrl),
            description: s(description),
          },
        },
      });

      await queryClient.invalidateQueries({ queryKey: ["product-home"] });

      setMessages((current) => [
        ...current,
        {
          id: `user-${Date.now()}`,
          role: "system",
          title: "Draft updated",
          body: s(websiteUrl)
            ? `Saved ${s(websiteUrl)} as draft-only onboarding context.`
            : "Saved the current business basics as draft-only onboarding context.",
        },
        {
          id: `assistant-${Date.now() + 1}`,
          role: "assistant",
          title: "Nothing went live",
          body:
            "The onboarding draft was saved, but approved truth and runtime activation remain intentionally untouched in this batch.",
        },
      ]);
      setNotice({
        tone: "success",
        title: "Draft saved",
        description:
          "The onboarding draft is stored for review later. Approved truth and live runtime were not changed.",
      });
      setPanelView("review");
    } catch (error) {
      setNotice({
        tone: "danger",
        title: "Unable to save draft",
        description: s(
          error?.message,
          "The onboarding draft could not be saved right now."
        ),
      });
    } finally {
      setSaving(false);
    }
  }

  function handlePrimaryAction() {
    if (canEditDraft) {
      handleSaveDraft();
      return;
    }

    onNavigate?.(resolvedAssistant.primaryAction?.path);
    onOpenChange?.(false);
  }

  function handleSecondaryAction() {
    onNavigate?.(resolvedAssistant.secondaryAction?.path);
    onOpenChange?.(false);
  }

  return (
    <>
      <style>{styles}</style>

      {open ? (
        <div className="fixed inset-0 z-[88]">
          <button
            type="button"
            aria-label="Close onboarding assistant overlay"
            className="absolute inset-0 bg-[rgba(15,23,42,0.18)] backdrop-blur-[2px]"
            onClick={() => onOpenChange?.(false)}
          />
        </div>
      ) : null}

      {open ? (
        <div
          className={`live-widget-panel fixed z-[89] ${bottomClassName} ${rightClassName}`}
        >
          <section
            className="w-[min(calc(100vw-32px),420px)] overflow-hidden rounded-[24px] border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(247,249,252,0.98)_100%)] shadow-[0_24px_60px_-24px_rgba(15,23,42,0.34)]"
            role="dialog"
            aria-modal="true"
            aria-label="AI onboarding assistant"
          >
            <div className="border-b border-line-soft bg-[radial-gradient(circle_at_top_left,rgba(var(--color-brand),0.12),transparent_56%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
                    <Sparkles className="h-3.5 w-3.5 text-brand" strokeWidth={1.9} />
                    <span>AI onboarding</span>
                    <Badge tone="neutral" variant="outline">
                      {resolvedAssistant.statusLabel || "Ready"}
                    </Badge>
                  </div>
                  <div className="mt-2 text-[18px] font-semibold tracking-[-0.04em] text-text">
                    {resolvedAssistant.title}
                  </div>
                  <div className="mt-1 text-[12px] leading-6 text-text-muted">
                    {resolvedAssistant.summary}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenChange?.(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-line bg-white text-text-subtle transition duration-200 hover:bg-surface-muted hover:text-text"
                  aria-label="Close AI onboarding assistant"
                >
                  <X className="h-4 w-4" strokeWidth={1.9} />
                </button>
              </div>

              {resolvedAssistant.mode === "onboarding" ? (
                <div className="mt-4 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={panelView === "conversation" ? "primary" : "secondary"}
                    onClick={() => setPanelView("conversation")}
                  >
                    Conversation
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={panelView === "review" ? "primary" : "secondary"}
                    onClick={() => setPanelView("review")}
                  >
                    Draft review
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="max-h-[min(74vh,720px)] overflow-y-auto px-5 py-4">
              <div className="space-y-4">
                <div className="space-y-3">
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                </div>

                {notice ? (
                  <InlineNotice
                    tone={notice.tone}
                    title={notice.title}
                    description={notice.description}
                    compact
                  />
                ) : null}

                {panelView === "conversation" ? (
                  canEditDraft ? (
                    <div className="space-y-4 rounded-[18px] border border-line bg-surface px-4 py-4">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                        <Globe2 className="h-3.5 w-3.5 text-brand" strokeWidth={1.9} />
                        <span>Website-first entry</span>
                      </div>

                      <Input
                        ref={initialFocusRef}
                        value={websiteUrl}
                        onChange={(event) => setWebsiteUrl(event.target.value)}
                        placeholder="yourbusiness.com"
                        leftIcon={<Globe2 className="h-4 w-4" />}
                        appearance="product"
                      />

                      <Input
                        value={companyName}
                        onChange={(event) => setCompanyName(event.target.value)}
                        placeholder="Company name"
                        leftIcon={<Bot className="h-4 w-4" />}
                        appearance="product"
                      />

                      <Textarea
                        rows={4}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="One short sentence about the business, services, or customer handoff style."
                        appearance="product"
                      />

                      <div className="rounded-[16px] border border-line bg-[rgba(var(--color-brand),0.04)] px-4 py-3 text-[12px] leading-6 text-text-muted">
                        Website or text input here is draft-only. This batch does not publish directly into approved truth or the strict runtime.
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          type="button"
                          size="hero"
                          onClick={handlePrimaryAction}
                          isLoading={saving}
                          rightIcon={<ArrowRight className="h-4 w-4" />}
                          fullWidth
                        >
                          {s(resolvedAssistant.session?.id)
                            ? "Save onboarding draft"
                            : "Start and save draft"}
                        </Button>

                        {resolvedAssistant.secondaryAction?.path ? (
                          <Button
                            type="button"
                            size="hero"
                            variant="secondary"
                            onClick={handleSecondaryAction}
                            fullWidth
                          >
                            {resolvedAssistant.secondaryAction.label}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[18px] border border-line bg-surface px-4 py-4">
                      <div className="text-[12px] leading-6 text-text-muted">
                        This assistant is currently in shortcut posture. Use the action below to move into the correct connect or home onboarding surface.
                      </div>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <Button
                          ref={initialFocusRef}
                          type="button"
                          size="hero"
                          onClick={handlePrimaryAction}
                          rightIcon={<ArrowRight className="h-4 w-4" />}
                          fullWidth
                        >
                          {resolvedAssistant.primaryAction?.label || "Open home"}
                        </Button>
                        {resolvedAssistant.secondaryAction?.path ? (
                          <Button
                            type="button"
                            size="hero"
                            variant="secondary"
                            onClick={handleSecondaryAction}
                            fullWidth
                          >
                            {resolvedAssistant.secondaryAction.label}
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="space-y-4 rounded-[18px] border border-line bg-surface px-4 py-4">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                      <CheckCircle2 className="h-3.5 w-3.5 text-brand" strokeWidth={1.9} />
                      <span>Review placeholder</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <ReviewMetric
                        label="Website"
                        value={s(profile.websiteUrl || websitePrefill.websiteUrl, "Awaiting input")}
                      />
                      <ReviewMetric
                        label="Draft version"
                        value={String(draft.version || 0)}
                      />
                      <ReviewMetric
                        label="Services"
                        value={String(arr(draft.services).length)}
                      />
                      <ReviewMetric
                        label="Contacts + hours"
                        value={String(arr(draft.contacts).length + arr(draft.hours).length)}
                      />
                    </div>

                    <div className="rounded-[16px] border border-dashed border-line bg-[rgba(15,23,42,0.02)] px-4 py-4">
                      <div className="text-[13px] font-semibold tracking-[-0.03em] text-text">
                        Final review stays intentionally gated.
                      </div>
                      <div className="mt-2 text-[12px] leading-6 text-text-muted">
                        {review.message ||
                          "This panel is only a placeholder for the later approval step. Draft data here does not activate truth or runtime."}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        ref={initialFocusRef}
                        type="button"
                        size="hero"
                        variant="secondary"
                        onClick={() => setPanelView("conversation")}
                        leftIcon={<MessageSquareText className="h-4 w-4" />}
                        fullWidth
                      >
                        Continue drafting
                      </Button>

                      {resolvedAssistant.secondaryAction?.path ? (
                        <Button
                          type="button"
                          size="hero"
                          onClick={handleSecondaryAction}
                          leftIcon={<Link2 className="h-4 w-4" />}
                          fullWidth
                        >
                          {resolvedAssistant.secondaryAction.label}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )}

                {!hasDraft && resolvedAssistant.mode === "onboarding" ? (
                  <div className="rounded-[16px] border border-dashed border-line bg-surface-muted px-4 py-4 text-[12px] leading-6 text-text-muted">
                    No onboarding draft is stored yet. Start with the website or short business description to create the first structured draft.
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <div className={`live-widget-wrap ${bottomClassName} ${rightClassName}`}>
        <button
          type="button"
          onClick={() => onOpenChange?.(!open)}
          aria-label={
            resolvedAssistant.mode === "shortcut"
              ? "Open home onboarding shortcut"
              : "Open AI onboarding assistant"
          }
          aria-expanded={open}
          className="live-widget-btn"
        >
          <span className="live-widget-shadow" />
          <span className="live-widget-shell">
            <span className="live-widget-rim" />
            <span className="live-widget-shine" />
            <span className="live-widget-aura" />
            <LivingSupportGlyph />
          </span>
          <span className="live-widget-status" />
        </button>
      </div>
    </>
  );
}
