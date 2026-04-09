import { useCallback, useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import SetupReviewActivationPanel from "./SetupReviewActivationPanel.jsx";

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

function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

const STEP_ORDER = [
  "company",
  "description",
  "website",
  "services",
  "hours",
  "pricing",
  "contacts",
  "handoff",
];

const REQUIRED_STEPS = [
  "company",
  "description",
  "website",
  "services",
  "hours",
  "pricing",
  "contacts",
];

const STEP_META = {
  company: {
    question: "Great. First, what is the business name?",
    helper: "Keep it exact.",
    placeholder: "e.g. Neox Company",
    options: [],
  },
  description: {
    question: "What does the business mainly do?",
    helper: "One clean sentence is enough.",
    placeholder:
      "e.g. AI automation, chatbot systems, and workflow solutions for businesses.",
    options: [],
  },
  website: {
    question: "What is the main website?",
    helper: "This becomes a truth anchor later.",
    placeholder: "e.g. https://neox.az",
    options: [],
  },
  services: {
    question: "What services should AI talk about?",
    helper: "List only the real ones.",
    placeholder:
      "e.g. AI chatbot setup, automation consulting, WhatsApp integration",
    options: [],
  },
  hours: {
    question: "When is the business open?",
    helper: "Use a clear weekly format.",
    placeholder:
      "e.g. Mon-Fri 09:00-18:00, Sat 10:00-14:00, Sun closed",
    options: [
      {
        id: "hours-1",
        label: "Mon-Fri 09:00-18:00",
        value: "Mon-Fri 09:00-18:00",
      },
      { id: "hours-2", label: "24/7", value: "24/7" },
      {
        id: "hours-3",
        label: "Appointment only",
        value: "Appointment only",
      },
    ],
  },
  pricing: {
    question: "What is safe to say about pricing?",
    helper: "Public summary or quote rule.",
    placeholder: "e.g. Starts from 50 AZN. Exact prices require a quote.",
    options: [
      {
        id: "pricing-1",
        label: "Quote required",
        value: "Exact prices require a quote.",
      },
      {
        id: "pricing-2",
        label: "Starts from 50 AZN",
        value: "Starts from 50 AZN. Exact prices require a quote.",
      },
      {
        id: "pricing-3",
        label: "Operator handles pricing",
        value: "Pricing should be handled by an operator.",
      },
    ],
  },
  contacts: {
    question: "Where should AI send customers?",
    helper: "Add the real public contact routes.",
    placeholder: "e.g. +994..., WhatsApp link, hello@company.com",
    options: [],
  },
  handoff: {
    question: "When should AI escalate to a human?",
    helper: "Optional but useful.",
    placeholder:
      "e.g. Complaints, urgent requests, custom quotes, payment issues",
    options: [
      {
        id: "handoff-1",
        label: "Complaints",
        value: "Complaints should be escalated to a human.",
      },
      {
        id: "handoff-2",
        label: "Custom quotes",
        value: "Custom quotes should be escalated to a human.",
      },
      {
        id: "handoff-3",
        label: "Urgent requests",
        value: "Urgent requests should be escalated to a human.",
      },
    ],
  },
};

const CLARIFIERS = {
  company: {
    text: "I still need the exact business name.",
    helper: "Example: Neox Company",
  },
  description: {
    text: "I still need a clearer short description.",
    helper: "Example: AI automation and chatbot systems for businesses.",
  },
  website: {
    text: "I still need the website in a clearer form.",
    helper: "Example: https://neox.az",
  },
  services: {
    text: "I still need the service list in a clearer form.",
    helper:
      "Example: AI chatbot setup, automation consulting, WhatsApp integration",
  },
  hours: {
    text: "I still need opening hours in a clearer format.",
    helper:
      "Example: Mon-Fri 09:00-18:00, Sat 10:00-14:00, Sun closed",
  },
  pricing: {
    text: "I still need a pricing rule I can safely store.",
    helper: "Example: Starts from 50 AZN. Exact prices require a quote.",
  },
  contacts: {
    text: "I still need at least one real contact route.",
    helper: "Example: +994..., WhatsApp link, hello@company.com",
  },
  handoff: {
    text: "I still need clearer escalation rules.",
    helper: "Example: Complaints, urgent requests, payment issues",
  },
};

function normalizeStep(value = "") {
  const key = s(value).toLowerCase();
  if (key === "profile") return "company";
  if (STEP_ORDER.includes(key)) return key;
  return "";
}

function buildAssistantLike(response = {}) {
  return {
    session: obj(response.session),
    draft: obj(response.setup?.draft),
    assistant: obj(response.setup?.assistant),
    websitePrefill: obj(response.setup?.websitePrefill),
    review: obj(response.setup?.review),
  };
}

function buildHoursSummary(hours = []) {
  const count = arr(hours).filter(
    (item) =>
      item?.enabled === true ||
      item?.allDay === true ||
      item?.appointmentOnly === true
  ).length;

  return count ? `${count} day${count > 1 ? "s" : ""} configured` : "";
}

function stepAnswered(step = "", assistantState = {}) {
  const profile = obj(assistantState?.draft?.businessProfile);
  const services = arr(assistantState?.draft?.services);
  const hours = arr(assistantState?.draft?.hours);
  const pricing = obj(assistantState?.draft?.pricingPosture);
  const contacts = arr(assistantState?.draft?.contacts);
  const handoff = obj(assistantState?.draft?.handoffRules);

  switch (step) {
    case "company":
      return Boolean(s(profile.companyName));
    case "description":
      return Boolean(s(profile.description));
    case "website":
      return Boolean(s(profile.websiteUrl));
    case "services":
      return services.length > 0;
    case "hours":
      return Boolean(buildHoursSummary(hours));
    case "pricing":
      return Boolean(s(pricing.pricingMode) && s(pricing.publicSummary));
    case "contacts":
      return contacts.length > 0;
    case "handoff":
      return Boolean(
        handoff.enabled === true ||
          s(handoff.summary) ||
          arr(handoff.triggers).length > 0
      );
    default:
      return false;
  }
}

function hasAnyProgress(assistantState = {}) {
  return STEP_ORDER.some((step) => stepAnswered(step, assistantState));
}

function getNaturalStep(assistantState = {}) {
  const completion = obj(assistantState?.assistant?.completion);
  if (completion.ready === true) return "finalize";

  const nextQuestion = obj(assistantState?.assistant?.nextQuestion);
  const nextKey = normalizeStep(nextQuestion.key);
  if (nextKey) return nextKey;

  const firstMissingRequired = REQUIRED_STEPS.find(
    (step) => !stepAnswered(step, assistantState)
  );
  if (firstMissingRequired) return firstMissingRequired;

  if (!stepAnswered("handoff", assistantState)) return "handoff";

  return "finalize";
}

function buildWelcomeMessage(assistantState = {}) {
  if (hasAnyProgress(assistantState)) {
    return {
      id: uid("assistant"),
      role: "assistant",
      text: "Ready to continue setting up your business?",
      helper: "",
      options: [
        { id: "continue", label: "Continue setup", kind: "start" },
        { id: "later", label: "Maybe later", kind: "later" },
      ],
      kind: "welcome",
    };
  }

  return {
    id: uid("assistant"),
    role: "assistant",
    text: "Ready to set up your business now?",
    helper: "",
    options: [
      { id: "start", label: "Start setup", kind: "start" },
      { id: "later", label: "Maybe later", kind: "later" },
    ],
    kind: "welcome",
  };
}

function buildPauseMessage() {
  return {
    id: uid("assistant"),
    role: "assistant",
    text: "Okay. Say start whenever you want to continue.",
    helper: "",
    options: [{ id: "resume", label: "Start setup", kind: "start" }],
    kind: "pause",
  };
}

function buildQuestionMessage(step = "") {
  const meta = STEP_META[step] || STEP_META.company;

  return {
    id: uid("assistant"),
    role: "assistant",
    text: meta.question,
    helper: meta.helper,
    options: arr(meta.options),
    step,
    kind: "question",
  };
}

function buildClarifierMessage(step = "") {
  const item = CLARIFIERS[step] || CLARIFIERS.company;
  return {
    id: uid("assistant"),
    role: "assistant",
    text: item.text,
    helper: item.helper,
    options: [],
    step,
    kind: "clarifier",
  };
}

function buildFinalizeMessage(assistantState = {}) {
  const completion = obj(assistantState?.assistant?.completion);

  return {
    id: uid("assistant"),
    role: "assistant",
    text: s(completion.message, "Setup looks complete. Finish now?"),
    helper: "",
    options: [{ id: "finish", label: "Finish setup", kind: "finish" }],
    kind: "finalize",
  };
}

function isAffirmative(value = "") {
  return /^(yes|yeah|yep|ok|okay|start|continue|bəli|hə|hazıram|başla)$/i.test(
    s(value)
  );
}

function isNegative(value = "") {
  return /^(no|nah|later|not now|skip|yox|sonra)$/i.test(s(value));
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

function scrollThread(container, top, behavior = "auto") {
  if (!container) return;

  if (typeof container.scrollTo === "function") {
    container.scrollTo({ top, behavior });
    return;
  }

  container.scrollTop = top;
}

function MessageRow({ message, index, busy, onOptionClick }) {
  const isUser = message.role === "user";
  const options = arr(message.options);

  return (
    <div
      className={`ai-row ${isUser ? "user" : "assistant"}`}
      style={{ animationDelay: `${Math.min(index * 34, 170)}ms` }}
    >
      <div className={`ai-bubble ${isUser ? "user" : "assistant"}`}>
        <div className="ai-bubble-text">{message.text}</div>

        {s(message.helper) ? (
          <div className="ai-bubble-helper">{message.helper}</div>
        ) : null}

        {!isUser && options.length ? (
          <div className="ai-quick-row">
            {options.map((option) => (
              <button
                key={`${message.id}-${option.id}`}
                type="button"
                className="ai-quick-chip"
                onClick={() => onOptionClick(option)}
                disabled={busy}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SetupAssistantSession({
  assistant,
  reviewPayload = null,
  saving = false,
  finalizing = false,
  onParseMessage,
  onFinalize,
}) {
  const scrollRef = useRef(null);
  const askedRef = useRef(new Set());
  const introShownRef = useRef(false);
  const typingFrameRef = useRef(null);
  const messageTimerRef = useRef(null);
  const initialReviewScrollRef = useRef(false);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [typing, setTyping] = useState(false);
  const [localError, setLocalError] = useState("");

  const busy = saving || finalizing;
  const currentStep = started && !paused ? getNaturalStep(assistant) : "";
  const canFinalize = currentStep === "finalize";
  const normalizedReviewRoot = obj(obj(reviewPayload).review, reviewPayload);
  const hasWebsiteReview =
    Object.keys(obj(obj(obj(normalizedReviewRoot).reviewDebug).websiteKnowledge)).length > 0;

  const clearQueuedAssistant = useCallback(() => {
    if (
      typingFrameRef.current != null &&
      typeof window !== "undefined" &&
      typeof window.cancelAnimationFrame === "function"
    ) {
      window.cancelAnimationFrame(typingFrameRef.current);
      typingFrameRef.current = null;
    }

    if (messageTimerRef.current != null) {
      window.clearTimeout(messageTimerRef.current);
      messageTimerRef.current = null;
    }
  }, []);

  const queueAssistantMessage = useCallback(
    (message, signature, delay = 420) => {
      if (!message || !signature) return;
      if (askedRef.current.has(signature)) return;

      askedRef.current.add(signature);
      clearQueuedAssistant();

      if (
        typeof window !== "undefined" &&
        typeof window.requestAnimationFrame === "function"
      ) {
        typingFrameRef.current = window.requestAnimationFrame(() => {
          setTyping(true);
          typingFrameRef.current = null;
        });
      } else {
        messageTimerRef.current = window.setTimeout(() => {
          setTyping(true);
        }, 0);
      }

      messageTimerRef.current = window.setTimeout(() => {
        setMessages((current) => [...current, message]);
        setTyping(false);
        messageTimerRef.current = null;
      }, delay);
    },
    [clearQueuedAssistant]
  );

  useEffect(() => {
    return () => {
      clearQueuedAssistant();
    };
  }, [clearQueuedAssistant]);

  useEffect(() => {
    if (introShownRef.current) return;
    introShownRef.current = true;

    queueAssistantMessage(
      buildWelcomeMessage(assistant),
      `welcome:${hasAnyProgress(assistant) ? "continue" : "start"}`,
      520
    );
  }, [assistant, queueAssistantMessage]);

  useEffect(() => {
    if (!started || paused || busy || canFinalize) return;
    if (!currentStep) return;

    const versionKey = `${s(assistant?.session?.id || "default")}:${Number(
      assistant?.draft?.version || 0
    )}:${currentStep}`;

    queueAssistantMessage(
      buildQuestionMessage(currentStep),
      `question:${versionKey}`,
      360
    );
  }, [
    started,
    paused,
    busy,
    canFinalize,
    currentStep,
    assistant?.session?.id,
    assistant?.draft?.version,
    queueAssistantMessage,
  ]);

  useEffect(() => {
    if (!started || paused || busy || !canFinalize) return;

    const signature = `finalize:${s(assistant?.session?.id || "default")}:${Number(
      assistant?.draft?.version || 0
    )}`;

    queueAssistantMessage(buildFinalizeMessage(assistant), signature, 360);
  }, [
    started,
    paused,
    busy,
    canFinalize,
    assistant,
    assistant?.session?.id,
    assistant?.draft?.version,
    queueAssistantMessage,
  ]);

  useEffect(() => {
    if (!scrollRef.current) return;

    if (hasWebsiteReview && (!initialReviewScrollRef.current || !started)) {
      scrollThread(scrollRef.current, 0, "auto");
      initialReviewScrollRef.current = true;
      return;
    }

    scrollThread(scrollRef.current, scrollRef.current.scrollHeight, "smooth");
  }, [messages, typing, busy, hasWebsiteReview, started]);

  async function handleSetupAnswer(rawText, forcedStep = "") {
    const text = s(rawText);
    const step = forcedStep || currentStep;

    if (!text || !step || step === "finalize" || busy) return;

    setLocalError("");

    setMessages((current) => [
      ...current,
      {
        id: uid("user"),
        role: "user",
        text,
      },
    ]);
    setInput("");

    try {
      const response = await onParseMessage?.({
        step,
        text,
      });

      const nextAssistant = buildAssistantLike(response);

      if (!stepAnswered(step, nextAssistant)) {
        queueAssistantMessage(
          buildClarifierMessage(step),
          uid(`clarifier-${step}`),
          260
        );
      }
    } catch (error) {
      const reason = s(
        error?.message,
        "The answer could not be processed. Please try again."
      );
      setLocalError(reason);
      queueAssistantMessage(
        {
          id: uid("assistant"),
          role: "assistant",
          text: reason,
          helper: "",
          options: [],
          kind: "error",
        },
        uid("error"),
        200
      );
    }
  }

  async function handleStartFromUser(rawText = "") {
    const text = s(rawText);

    if (!text) return;

    if (isNegative(text)) {
      setMessages((current) => [
        ...current,
        {
          id: uid("user"),
          role: "user",
          text,
        },
      ]);
      setPaused(true);
      queueAssistantMessage(buildPauseMessage(), uid("pause"), 250);
      setInput("");
      return;
    }

    if (isAffirmative(text)) {
      setMessages((current) => [
        ...current,
        {
          id: uid("user"),
          role: "user",
          text,
        },
      ]);
      setStarted(true);
      setPaused(false);
      setInput("");
      return;
    }

    setStarted(true);
    setPaused(false);
    await handleSetupAnswer(
      text,
      hasAnyProgress(assistant) ? getNaturalStep(assistant) : "company"
    );
  }

  async function handleOptionClick(option = {}) {
    const kind = s(option.kind).toLowerCase();

    if (kind === "start") {
      await handleStartFromUser(option.label || "Start setup");
      return;
    }

    if (kind === "later") {
      await handleStartFromUser(option.label || "Maybe later");
      return;
    }

    if (kind === "finish") {
      if (busy) return;

      setMessages((current) => [
        ...current,
        {
          id: uid("user"),
          role: "user",
          text: option.label || "Finish setup",
        },
      ]);

      try {
        await onFinalize?.();
        queueAssistantMessage(
          {
            id: uid("assistant"),
            role: "assistant",
            text:
              "Setup finished. Approved truth and strict runtime were refreshed.",
            helper: "",
            options: [],
            kind: "done",
          },
          uid("done"),
          260
        );
      } catch (error) {
        setLocalError(s(error?.message, "Setup could not be finalized."));
      }
      return;
    }

    if (s(option.value)) {
      await handleSetupAnswer(option.value);
    }
  }

  async function handleComposerSubmit() {
    const text = s(input);
    if (!text || busy) return;

    if (!started || paused) {
      await handleStartFromUser(text);
      return;
    }

    if (canFinalize && isAffirmative(text)) {
      await handleOptionClick({ kind: "finish", label: text });
      return;
    }

    await handleSetupAnswer(text);
  }

  const placeholder = !started
    ? "Reply here..."
    : paused
      ? "Type start whenever you're ready..."
      : STEP_META[currentStep]?.placeholder || "Type your answer...";

  return (
    <div className="ai-thread-wrap">
      <div ref={scrollRef} className="ai-thread-scroll">
        <div className="ai-thread-stack">
          {hasWebsiteReview ? (
            <SetupReviewActivationPanel
              reviewPayload={reviewPayload}
              assistantReview={assistant?.review}
              onFinalize={onFinalize}
              finalizing={finalizing}
            />
          ) : null}

          {messages.map((message, index) => (
            <MessageRow
              key={message.id}
              message={message}
              index={index}
              busy={busy}
              onOptionClick={handleOptionClick}
            />
          ))}

          {typing || busy ? <TypingBubble /> : null}
        </div>
      </div>

      <div className="ai-composer">
        {localError ? (
          <div className="mb-3 rounded-panel border border-[rgba(var(--color-danger),0.18)] bg-danger-soft px-3 py-2.5 text-[12px] leading-5 text-danger">
            {localError}
          </div>
        ) : null}

        <div className="ai-composer-shell">
          <textarea
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleComposerSubmit();
              }
            }}
            placeholder={placeholder}
            className="ai-composer-input"
          />

          <button
            type="button"
            onClick={handleComposerSubmit}
            disabled={!s(input) || busy}
            className="ai-send-btn"
            aria-label="Send setup reply"
          >
            <SendHorizontal className="h-4 w-4" strokeWidth={2.1} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SetupAssistantSections(props) {
  const sessionKey = s(props?.assistant?.session?.id || "setup-session");
  return <SetupAssistantSession key={sessionKey} {...props} />;
}
