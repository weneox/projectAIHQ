import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Link2, Send, X } from "lucide-react";
import Button from "../ui/Button.jsx";
import { InlineNotice } from "../ui/AppShellPrimitives.jsx";
import {
  sendOnboardingMessage,
  startOnboardingSession,
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

const STEP_ORDER = [
  "website",
  "company",
  "description",
  "services",
  "contact",
  "hours",
  "pricing",
  "handoff",
  "review",
];

const STEP_META = {
  website: {
    question: "Saytın var?",
    placeholder: "https://yourbusiness.com",
  },
  company: {
    question: "Biznes adı nədir?",
    placeholder: "NEOX AI",
  },
  description: {
    question: "Nə iş görürsən?",
    placeholder: "Bir cümlə ilə yaz",
  },
  services: {
    question: "Əsas xidmətlərin hansılardır?",
    placeholder: "məs: dizayn, quraşdırma, servis",
  },
  contact: {
    question: "Müştəri sənə necə çatsın?",
    placeholder: "telefon, whatsapp, email",
  },
  hours: {
    question: "İş saatların necədir?",
    placeholder: "məs: hər gün 09:00-19:00",
  },
  pricing: {
    question: "Qiymət barədə necə cavab verək?",
    placeholder: "məs: qiymət üçün yazın",
  },
  handoff: {
    question: "Bot səni hansı hallarda çağırsın?",
    placeholder: "məs: şikayət, təcili sifariş",
  },
};

function nextStep(step = "website") {
  const index = STEP_ORDER.indexOf(step);
  if (index < 0) return "review";
  return STEP_ORDER[Math.min(index + 1, STEP_ORDER.length - 1)];
}

function prevStep(step = "review") {
  const index = STEP_ORDER.indexOf(step);
  if (index <= 0) return "website";
  return STEP_ORDER[index - 1];
}

function getBackStepFromConversation(conversation = []) {
  const items = arr(conversation)
    .filter((item) => s(item?.step))
    .map((item) => s(item.step).toLowerCase());

  if (!items.length) return "website";

  const lastStep = items[items.length - 1];
  if (lastStep === "review") return "handoff";
  return prevStep(lastStep);
}

function buildDefaultAssistant() {
  return {
    mode: "shortcut",
    title: "Setup",
    summary: "Home-da davam et.",
    primaryAction: {
      label: "Open Home",
      path: "/home?assistant=setup",
    },
    secondaryAction: null,
    session: {},
    draft: {
      businessProfile: {},
      services: [],
      contacts: [],
      hours: [],
      pricingPosture: {},
      handoffRules: {},
      progress: {},
      version: 0,
      updatedAt: null,
    },
    review: {},
    websitePrefill: {
      supported: true,
      status: "awaiting_input",
      websiteUrl: "",
    },
    assistant: {
      nextQuestion: {
        key: "website",
        prompt: "Saytın var?",
        placeholder: "https://yourbusiness.com",
      },
      conversation: [],
      composer: {
        step: "website",
        placeholder: "https://yourbusiness.com",
      },
    },
  };
}

function buildFallbackNextQuestion({ draft, websitePrefill }) {
  const businessProfile = obj(draft.businessProfile);
  const checks = [
    {
      key: "website",
      answered: Boolean(
        s(businessProfile.websiteUrl || websitePrefill.websiteUrl)
      ),
    },
    {
      key: "company",
      answered: Boolean(s(businessProfile.companyName)),
    },
    {
      key: "description",
      answered: Boolean(s(businessProfile.description)),
    },
    {
      key: "services",
      answered: arr(draft.services).length > 0,
    },
    {
      key: "contact",
      answered: arr(draft.contacts).length > 0,
    },
    {
      key: "hours",
      answered: arr(draft.hours).length > 0,
    },
    {
      key: "pricing",
      answered: Boolean(s(obj(draft.pricingPosture).summary)),
    },
    {
      key: "handoff",
      answered: Boolean(
        s(obj(draft.handoffRules).summary) ||
          arr(obj(draft.handoffRules).triggers).length
      ),
    },
  ];

  const next = checks.find((item) => !item.answered);
  if (!next) return null;

  return {
    key: next.key,
    prompt: STEP_META[next.key]?.question || "Davam edək?",
    placeholder: STEP_META[next.key]?.placeholder || "",
  };
}

function buildFallbackConversation({ draft, websitePrefill, nextQuestion }) {
  const items = [];
  const businessProfile = obj(draft.businessProfile);
  const website = s(businessProfile.websiteUrl || websitePrefill.websiteUrl);
  const company = s(businessProfile.companyName);
  const description = s(businessProfile.description);

  items.push({
    id: "q:website",
    role: "assistant",
    step: "website",
    text: STEP_META.website.question,
  });

  if (website) {
    items.push({
      id: "a:website",
      role: "user",
      step: "website",
      text: website,
    });
  }

  if (company || nextQuestion?.key !== "website") {
    items.push({
      id: "q:company",
      role: "assistant",
      step: "company",
      text: STEP_META.company.question,
    });
  }

  if (company) {
    items.push({
      id: "a:company",
      role: "user",
      step: "company",
      text: company,
    });
  }

  if (
    description ||
    (nextQuestion?.key !== "website" && nextQuestion?.key !== "company")
  ) {
    items.push({
      id: "q:description",
      role: "assistant",
      step: "description",
      text: STEP_META.description.question,
    });
  }

  if (description) {
    items.push({
      id: "a:description",
      role: "user",
      step: "description",
      text: description,
    });
  }

  if (!nextQuestion) {
    items.push({
      id: "q:review",
      role: "assistant",
      step: "review",
      text: "Topladıqlarım bunlardır.",
    });
  }

  return items;
}

function normalizeAssistantState(input = null) {
  const source = input || buildDefaultAssistant();
  const nestedAssistant = obj(source.assistant);
  const draft = obj(source.draft);
  const websitePrefill = obj(source.websitePrefill);

  const nextQuestion =
    obj(nestedAssistant.nextQuestion).key
      ? obj(nestedAssistant.nextQuestion)
      : buildFallbackNextQuestion({ draft, websitePrefill });

  const conversation = arr(nestedAssistant.conversation).length
    ? arr(nestedAssistant.conversation).map((item, index) => ({
        id: s(item.id, String(index)),
        role: s(item.role, "assistant"),
        text: s(item.text || item.prompt),
        step: s(item.step),
      }))
    : buildFallbackConversation({
        draft,
        websitePrefill,
        nextQuestion,
      });

  return {
    mode: s(source.mode, "shortcut"),
    title: s(source.title, "Setup"),
    summary: s(source.summary),
    statusLabel: s(source.statusLabel),
    primaryAction: obj(source.primaryAction),
    secondaryAction: source.secondaryAction ? obj(source.secondaryAction) : null,
    session: obj(source.session),
    review: obj(source.review),
    websitePrefill,
    draft: {
      businessProfile: obj(draft.businessProfile),
      services: arr(draft.services),
      contacts: arr(draft.contacts),
      hours: arr(draft.hours),
      pricingPosture: obj(draft.pricingPosture),
      handoffRules: obj(draft.handoffRules),
      progress: obj(draft.progress),
      version: Number(draft.version || 0),
      updatedAt: draft.updatedAt || null,
    },
    nextQuestion,
    composer:
      nestedAssistant.composer && obj(nestedAssistant.composer).step
        ? obj(nestedAssistant.composer)
        : nextQuestion
          ? {
              step: s(nextQuestion.key),
              placeholder: s(nextQuestion.placeholder),
            }
          : null,
    conversation,
  };
}

function useWidgetStyles() {
  return useMemo(
    () => `
      @keyframes widgetFloat {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-2px); }
      }

      @keyframes widgetPulse {
        0%, 100% { opacity: .92; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.04); }
      }

      @keyframes widgetPanelEnter {
        from { opacity: 0; transform: translateY(8px) scale(.985); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .ai-widget-root {
        position: fixed;
        right: 18px;
        bottom: 18px;
        z-index: 92;
      }

      .ai-widget-launcher {
        position: relative;
        width: 60px;
        height: 60px;
        border: 0;
        border-radius: 999px;
        padding: 0;
        cursor: pointer;
        background: transparent;
        -webkit-tap-highlight-color: transparent;
        animation: widgetFloat 4.8s ease-in-out infinite;
      }

      .ai-widget-launcher-shell {
        position: absolute;
        inset: 0;
        overflow: hidden;
        border-radius: 999px;
        background:
          radial-gradient(circle at 30% 24%, rgba(255,255,255,.34), rgba(255,255,255,.08) 34%, transparent 50%),
          linear-gradient(180deg, #ffffff 0%, #f2f5fb 100%);
        border: 1px solid rgba(206,214,228,.95);
        box-shadow:
          0 18px 38px rgba(15,23,42,.16),
          0 8px 18px rgba(15,23,42,.08),
          inset 0 1px 0 rgba(255,255,255,.92);
      }

      .ai-widget-launcher-shell::after {
        content: "";
        position: absolute;
        inset: 8px;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(61,109,242,.12), rgba(61,109,242,.02) 58%, transparent 74%);
        animation: widgetPulse 3.2s ease-in-out infinite;
      }

      .ai-widget-shadow {
        position: absolute;
        left: 50%;
        bottom: -4px;
        transform: translateX(-50%);
        width: 44px;
        height: 12px;
        border-radius: 999px;
        background: radial-gradient(ellipse at center, rgba(15,23,42,.16), rgba(15,23,42,.04) 60%, transparent 80%);
        filter: blur(6px);
        pointer-events: none;
      }

      .ai-widget-badge {
        position: absolute;
        right: 4px;
        top: 4px;
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: #3f6df2;
        border: 2px solid #fff;
        box-shadow: 0 0 0 1px rgba(191,219,254,.72);
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
        bottom: calc(100% + 12px);
        width: min(calc(100vw - 24px), 360px);
        overflow: hidden;
        border-radius: 24px;
        border: 1px solid rgba(210,218,231,.92);
        background: linear-gradient(180deg, rgba(255,255,255,.99), rgba(246,248,252,.99));
        box-shadow: 0 30px 70px -28px rgba(15,23,42,.32);
        animation: widgetPanelEnter 180ms ease;
      }

      @media (max-width: 768px) {
        .ai-widget-root {
          right: 14px;
          bottom: 14px;
        }

        .ai-widget-launcher {
          width: 56px;
          height: 56px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .ai-widget-launcher,
        .ai-widget-launcher-shell::after,
        .ai-widget-panel {
          animation: none !important;
        }
      }
    `,
    []
  );
}

function LauncherGlyph() {
  return (
    <div className="ai-widget-glyph" aria-hidden="true">
      <div className="relative flex h-[28px] w-[28px] items-center justify-center rounded-full bg-[linear-gradient(180deg,#4f7cf5_0%,#3157d5_100%)] shadow-[0_10px_20px_rgba(49,87,213,0.22)]">
        <div className="flex items-center gap-[3px]">
          <span className="h-[4px] w-[4px] rounded-full bg-white" />
          <span className="h-[4px] w-[4px] rounded-full bg-white" />
          <span className="h-[4px] w-[4px] rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
}

function Bubble({ role = "assistant", text = "" }) {
  const assistant = role === "assistant";

  return (
    <div className={`flex ${assistant ? "justify-start" : "justify-end"}`}>
      <div
        className={[
          "max-w-[85%] rounded-[18px] px-4 py-3 text-[14px] leading-6 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.16)]",
          assistant
            ? "border border-line bg-white text-text"
            : "bg-brand text-white",
        ].join(" ")}
      >
        {text}
      </div>
    </div>
  );
}

function AnswerRow({ label, value }) {
  return (
    <div className="rounded-[14px] border border-line bg-white px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
        {label}
      </div>
      <div className="mt-1 text-[13px] font-semibold tracking-[-0.03em] text-text">
        {value}
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
  const composerRef = useRef(null);

  const resolvedAssistant = useMemo(
    () => normalizeAssistantState(assistant),
    [assistant]
  );

  const [clientAssistant, setClientAssistant] = useState(resolvedAssistant);
  const [composer, setComposer] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    setClientAssistant(resolvedAssistant);
  }, [resolvedAssistant]);

  const shortcutMode = clientAssistant.mode === "shortcut";

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

  useEffect(() => {
    if (!open || shortcutMode || !clientAssistant.nextQuestion) {
      setComposer("");
      return;
    }
    setComposer("");
  }, [open, shortcutMode, s(clientAssistant.nextQuestion?.key)]);

  useEffect(() => {
    if (!open || shortcutMode || !clientAssistant.nextQuestion) return;
    window.requestAnimationFrame(() => composerRef.current?.focus?.());
  }, [open, shortcutMode, s(clientAssistant.nextQuestion?.key)]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") onOpenChange?.(false);
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !shortcutMode &&
        clientAssistant.nextQuestion &&
        document.activeElement === composerRef.current
      ) {
        event.preventDefault();
        handleSubmitAnswer();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, shortcutMode, clientAssistant.nextQuestion, composer, onOpenChange]);

  if (hidden) return null;

  async function ensureSession() {
    if (s(clientAssistant.session?.id)) return s(clientAssistant.session.id);

    const started = await startOnboardingSession();

    const nextAssistant = normalizeAssistantState({
      ...clientAssistant,
      draft: obj(started?.onboarding?.draft),
      review: obj(started?.onboarding?.review),
      websitePrefill: obj(started?.onboarding?.websitePrefill),
      assistant: obj(started?.onboarding?.assistant),
      session: obj(started?.session),
    });

    setClientAssistant(nextAssistant);
    return s(nextAssistant.session?.id);
  }

  async function handleSubmitAnswer() {
    if (shortcutMode || saving || !clientAssistant.nextQuestion) return;

    const value = s(composer);
    if (!value) {
      setNotice({
        tone: "danger",
        title: "Boşdur",
        description: "Cavab yaz.",
      });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      await ensureSession();

      const response = await sendOnboardingMessage({
        step: s(clientAssistant.nextQuestion?.key),
        answer: value,
      });

      const nextAssistant = normalizeAssistantState({
        ...clientAssistant,
        draft: obj(response?.onboarding?.draft),
        review: obj(response?.onboarding?.review),
        websitePrefill: obj(response?.onboarding?.websitePrefill),
        assistant: obj(response?.onboarding?.assistant),
        session: obj(response?.session),
      });

      setClientAssistant(nextAssistant);
      setComposer("");
      await queryClient.invalidateQueries({ queryKey: ["product-home"] });
    } catch (error) {
      setNotice({
        tone: "danger",
        title: "Xəta",
        description: s(error?.message, "Yadda saxlamaq olmadı."),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    const currentStep = s(clientAssistant.nextQuestion?.key);
    if (!currentStep || saving) return;

    setSaving(true);
    setNotice(null);

    try {
      await ensureSession();

      const response = await sendOnboardingMessage({
        step: currentStep,
        skip: true,
      });

      const nextAssistant = normalizeAssistantState({
        ...clientAssistant,
        draft: obj(response?.onboarding?.draft),
        review: obj(response?.onboarding?.review),
        websitePrefill: obj(response?.onboarding?.websitePrefill),
        assistant: obj(response?.onboarding?.assistant),
        session: obj(response?.session),
      });

      setClientAssistant(nextAssistant);
      setComposer("");
      await queryClient.invalidateQueries({ queryKey: ["product-home"] });
    } catch (error) {
      setNotice({
        tone: "danger",
        title: "Xəta",
        description: s(error?.message, "Skip etmək olmadı."),
      });
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    const currentStep = s(clientAssistant.nextQuestion?.key);

    if (currentStep) {
      if (currentStep === "website") return;

      const previous = prevStep(currentStep);
      const previousQuestion =
        previous === "review"
          ? null
          : {
              key: previous,
              prompt: STEP_META[previous]?.question || "",
              placeholder: STEP_META[previous]?.placeholder || "",
            };

      setClientAssistant((before) => ({
        ...before,
        nextQuestion: previousQuestion,
        composer: previousQuestion
          ? {
              step: previousQuestion.key,
              placeholder: previousQuestion.placeholder,
            }
          : null,
      }));
      setNotice(null);
      setComposer("");
      return;
    }

    const previous = getBackStepFromConversation(clientAssistant.conversation);
    const previousQuestion = {
      key: previous,
      prompt: STEP_META[previous]?.question || "",
      placeholder: STEP_META[previous]?.placeholder || "",
    };

    setClientAssistant((before) => ({
      ...before,
      nextQuestion: previousQuestion,
      composer: {
        step: previousQuestion.key,
        placeholder: previousQuestion.placeholder,
      },
    }));
    setNotice(null);
    setComposer("");
  }

  function handleDone() {
    setNotice({
      tone: "success",
      title: "Hazırdır",
      description: "Növbəti mərhələ: review + activate.",
    });
  }

  const conversation = arr(clientAssistant.conversation);
  const draft = obj(clientAssistant.draft);
  const businessProfile = obj(draft.businessProfile);
  const nextQuestion = obj(clientAssistant.nextQuestion);
  const inReview = !nextQuestion.key;

  const summaryItems = [
    {
      label: "Website",
      value: s(
        businessProfile.websiteUrl || clientAssistant.websitePrefill?.websiteUrl,
        "—"
      ),
    },
    {
      label: "Name",
      value: s(businessProfile.companyName, "—"),
    },
    {
      label: "About",
      value: s(businessProfile.description, "—"),
    },
    arr(draft.services).length
      ? {
          label: "Services",
          value: arr(draft.services)
            .map((item) => s(item.title || item.name || item.label))
            .filter(Boolean)
            .slice(0, 4)
            .join(", "),
        }
      : null,
    arr(draft.contacts).length
      ? {
          label: "Contact",
          value: s(arr(draft.contacts)[0]?.value, "—"),
        }
      : null,
    arr(draft.hours).length
      ? {
          label: "Hours",
          value: s(arr(draft.hours)[0]?.notes || arr(draft.hours)[0]?.day, "—"),
        }
      : null,
    s(obj(draft.pricingPosture).summary)
      ? {
          label: "Pricing",
          value: s(obj(draft.pricingPosture).summary),
        }
      : null,
    s(obj(draft.handoffRules).summary)
      ? {
          label: "Handoff",
          value: s(obj(draft.handoffRules).summary),
        }
      : null,
  ].filter(Boolean);

  const composerPlaceholder = s(
    clientAssistant.composer?.placeholder ||
      nextQuestion.placeholder ||
      STEP_META[nextQuestion.key]?.placeholder
  );

  return (
    <>
      <style>{styles}</style>

      <div ref={rootRef} className="ai-widget-root">
        {open ? (
          <section
            className="ai-widget-panel"
            role="dialog"
            aria-modal="false"
            aria-label="AI setup"
          >
            <div className="border-b border-line-soft px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
                    AI setup
                  </div>
                  <div className="mt-2 text-[18px] font-semibold tracking-[-0.045em] text-text">
                    {shortcutMode
                      ? "Home-da davam et"
                      : clientAssistant.title || "Quick setup"}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenChange?.(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-line bg-white text-text-subtle transition duration-200 hover:bg-surface-muted hover:text-text"
                  aria-label="Close AI setup"
                >
                  <X className="h-4 w-4" strokeWidth={1.9} />
                </button>
              </div>
            </div>

            <div className="px-5 py-4">
              {notice ? (
                <InlineNotice
                  tone={notice.tone}
                  title={notice.title}
                  description={notice.description}
                  compact
                  className="mb-4"
                />
              ) : null}

              {shortcutMode ? (
                <div className="space-y-4">
                  <Bubble role="assistant" text="Home-da davam et." />

                  <div className="flex flex-col gap-2">
                    {clientAssistant.primaryAction?.path ? (
                      <Button
                        type="button"
                        size="hero"
                        onClick={() => {
                          onNavigate?.(clientAssistant.primaryAction.path);
                          onOpenChange?.(false);
                        }}
                        fullWidth
                      >
                        {clientAssistant.primaryAction.label || "Open Home"}
                      </Button>
                    ) : null}

                    {clientAssistant.secondaryAction?.path ? (
                      <Button
                        type="button"
                        size="hero"
                        variant="secondary"
                        onClick={() => {
                          onNavigate?.(clientAssistant.secondaryAction.path);
                          onOpenChange?.(false);
                        }}
                        fullWidth
                      >
                        {clientAssistant.secondaryAction.label}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="max-h-[360px] space-y-3 overflow-y-auto pr-1">
                    {conversation.map((item) => (
                      <Bubble key={item.id} role={item.role} text={item.text} />
                    ))}

                    {inReview ? (
                      <div className="space-y-3">
                        {summaryItems.map((item) => (
                          <AnswerRow
                            key={item.label}
                            label={item.label}
                            value={item.value}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {!inReview ? (
                    <>
                      <div className="rounded-[18px] border border-line bg-white px-4 py-3 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.16)]">
                        <div className="flex items-end gap-3">
                          <textarea
                            ref={composerRef}
                            rows={1}
                            value={composer}
                            onChange={(event) => setComposer(event.target.value)}
                            placeholder={composerPlaceholder}
                            className="min-h-[24px] flex-1 resize-none border-0 bg-transparent p-0 text-[14px] leading-6 text-text outline-none placeholder:text-text-subtle"
                          />
                          <button
                            type="button"
                            onClick={handleSubmitAnswer}
                            disabled={saving}
                            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white transition duration-200 hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="Send answer"
                          >
                            <Send className="h-4 w-4" strokeWidth={2} />
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={handleBack}
                          disabled={s(clientAssistant.nextQuestion?.key) === "website"}
                          leftIcon={<ArrowLeft className="h-4 w-4" />}
                          fullWidth
                        >
                          Back
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={handleSkip}
                          disabled={saving}
                          fullWidth
                        >
                          Skip
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="hero"
                          variant="secondary"
                          onClick={handleBack}
                          leftIcon={<ArrowLeft className="h-4 w-4" />}
                          fullWidth
                        >
                          Back
                        </Button>

                        {clientAssistant.secondaryAction?.path ? (
                          <Button
                            type="button"
                            size="hero"
                            variant="secondary"
                            onClick={() => {
                              onNavigate?.(clientAssistant.secondaryAction.path);
                              onOpenChange?.(false);
                            }}
                            leftIcon={<Link2 className="h-4 w-4" />}
                            fullWidth
                          >
                            {clientAssistant.secondaryAction.label}
                          </Button>
                        ) : null}
                      </div>

                      <Button
                        type="button"
                        size="hero"
                        onClick={handleDone}
                        fullWidth
                      >
                        Done
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        ) : null}

        <button
          type="button"
          onClick={() => onOpenChange?.(!open)}
          aria-label={shortcutMode ? "Open setup shortcut" : "Open AI setup"}
          aria-expanded={open}
          className="ai-widget-launcher"
        >
          <span className="ai-widget-shadow" />
          <span className="ai-widget-launcher-shell" />
          <span className="ai-widget-badge" />
          <LauncherGlyph />
        </button>
      </div>
    </>
  );
}