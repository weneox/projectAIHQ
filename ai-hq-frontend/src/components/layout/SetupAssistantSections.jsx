import { useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";

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

function normalizeChoice(item, index = 0) {
  if (typeof item === "string") {
    return {
      id: `choice-${index}-${item}`,
      label: item,
      value: item,
    };
  }

  const safe = obj(item);
  const label = s(safe.label || safe.title || safe.name || safe.value);
  const value = s(safe.value || safe.answer || safe.label || safe.title || safe.name);

  if (!label && !value) return null;

  return {
    id: s(safe.id || safe.key || `${index}-${label || value}`),
    label: label || value,
    value: value || label,
  };
}

function normalizeChoices(question = {}) {
  const safe = obj(question);
  const raw =
    arr(safe.options).length > 0
      ? arr(safe.options)
      : arr(safe.choices).length > 0
      ? arr(safe.choices)
      : arr(safe.quickReplies).length > 0
      ? arr(safe.quickReplies)
      : arr(safe.suggestions);

  return raw.map(normalizeChoice).filter(Boolean).slice(0, 5);
}

function buildFallbackChoices(key = "profile", assistant = {}) {
  const draft = obj(assistant.draft);
  const businessProfile = obj(draft.businessProfile);

  if (!s(businessProfile.companyName)) {
    return [
      {
        id: "business-name",
        label: "Business name",
        value: "I'll share the business name now.",
      },
      {
        id: "website",
        label: "Website",
        value: "Let's start from the website.",
      },
      {
        id: "instagram",
        label: "Instagram",
        value: "Let's use Instagram as a source.",
      },
      {
        id: "manual",
        label: "Manual details",
        value: "I want to write the business details manually.",
      },
    ];
  }

  if (key === "services" || arr(draft.services).length === 0) {
    return [
      {
        id: "services-list",
        label: "List services",
        value: "I'll list the services now.",
      },
      {
        id: "rough-note",
        label: "Paste rough note",
        value: "I want to paste a rough services note.",
      },
      {
        id: "pricing",
        label: "Pricing first",
        value: "Let's define pricing posture first.",
      },
      {
        id: "skip-services",
        label: "Skip for now",
        value: "Let's skip services for now and continue.",
      },
    ];
  }

  if (key === "hours") {
    return [
      {
        id: "hours",
        label: "Working hours",
        value: "I'll share the working hours now.",
      },
      {
        id: "appointment",
        label: "Appointment only",
        value: "The business is appointment only.",
      },
      {
        id: "always-open",
        label: "24/7",
        value: "The business is open 24/7.",
      },
    ];
  }

  if (key === "pricing") {
    return [
      {
        id: "starting-from",
        label: "Starting from",
        value: "Pricing starts from a visible base amount.",
      },
      {
        id: "quote-required",
        label: "Quote required",
        value: "Exact pricing requires a quote.",
      },
      {
        id: "public-pricing",
        label: "Public summary",
        value: "I want to define what AI can say publicly about pricing.",
      },
    ];
  }

  return [
    {
      id: "continue",
      label: "Continue",
      value: "Let's continue.",
    },
    {
      id: "add-detail",
      label: "Add detail",
      value: "I want to add more detail here.",
    },
  ];
}

function deriveQuestion(assistant = {}) {
  const assistantData = obj(assistant.assistant);
  const nextQuestion = obj(assistantData.nextQuestion);
  const blockers = arr(assistantData.confirmationBlockers);
  const draft = obj(assistant.draft);
  const businessProfile = obj(draft.businessProfile);

  const nextPrompt = s(nextQuestion.prompt || nextQuestion.question || nextQuestion.summary);
  const nextTitle = s(nextQuestion.title || nextQuestion.label);
  const nextKey = s(nextQuestion.key, "profile");
  const nextHelper = s(nextQuestion.helper || nextQuestion.description);
  const nextChoices = normalizeChoices(nextQuestion);

  if (nextPrompt || nextTitle || nextChoices.length > 0) {
    return {
      key: nextKey,
      title: nextTitle || "",
      prompt:
        nextPrompt || "Tell me the next detail and I’ll keep shaping the draft.",
      helper: nextHelper,
      options: nextChoices.length ? nextChoices : buildFallbackChoices(nextKey, assistant),
    };
  }

  if (blockers.length > 0) {
    const blocker = obj(blockers[0]);
    const key = s(blocker.key, "profile");
    return {
      key,
      title: "",
      prompt: s(
        blocker.reason,
        "This part still needs confirmation before the draft feels solid."
      ),
      helper: s(blocker.metric),
      options: buildFallbackChoices(key, assistant),
    };
  }

  if (!s(businessProfile.companyName)) {
    return {
      key: "profile",
      title: "",
      prompt: "Tell me the name and what the business mainly does.",
      helper: "",
      options: buildFallbackChoices("profile", assistant),
    };
  }

  if (arr(draft.services).length === 0) {
    return {
      key: "services",
      title: "",
      prompt: "What does the business offer? A rough list is enough.",
      helper: "",
      options: buildFallbackChoices("services", assistant),
    };
  }

  return {
    key: "profile",
    title: "",
    prompt: "What should we refine next?",
    helper: "",
    options: buildFallbackChoices("profile", assistant),
  };
}

function buildWelcomeMessage(assistant = {}) {
  const draft = obj(assistant.draft);
  const businessProfile = obj(draft.businessProfile);
  const companyName = s(businessProfile.companyName);

  if (companyName) {
    return {
      id: "setup-welcome",
      role: "assistant",
      text: `We already have a starting draft for ${companyName}. Let's refine it here.`,
      helper: "Nothing launches from this chat.",
    };
  }

  return {
    id: "setup-welcome",
    role: "assistant",
    text: "Let's shape the business here first.",
    helper: "Channels can come later.",
  };
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

export default function SetupAssistantSections({
  assistant,
  saving = false,
  onSendMessage,
}) {
  const threadRef = useRef(null);
  const seenAssistantSignaturesRef = useRef(new Set());

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(() => [buildWelcomeMessage(assistant)]);

  const question = deriveQuestion(assistant);
  const latestAssistantId = [...messages]
    .reverse()
    .find((item) => item.role === "assistant")?.id;

  useEffect(() => {
    const signature = JSON.stringify({
      sessionId: s(assistant?.session?.id, "default"),
      version: Number(assistant?.draft?.version || 0),
      updatedAt: assistant?.draft?.updatedAt || "",
      key: question.key,
      title: question.title,
      prompt: question.prompt,
      helper: question.helper,
    });

    if (seenAssistantSignaturesRef.current.has(signature)) return;
    seenAssistantSignaturesRef.current.add(signature);

    setMessages((current) => [
      ...current,
      {
        id: `assistant-${signature}`,
        role: "assistant",
        title: question.title,
        text: question.prompt,
        helper: question.helper,
        options: arr(question.options),
      },
    ]);
  }, [
    assistant?.session?.id,
    assistant?.draft?.version,
    assistant?.draft?.updatedAt,
    question.key,
    question.title,
    question.prompt,
    question.helper,
    question.options,
  ]);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, saving]);

  async function submitMessage(rawValue) {
    const value = s(rawValue);
    if (!value || saving) return;

    setMessages((current) => [
      ...current,
      {
        id: `user-${Date.now()}`,
        role: "user",
        text: value,
      },
    ]);
    setInput("");

    try {
      await onSendMessage?.({
        text: value,
        step: question.key,
      });
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text: s(
            error?.message,
            "The message could not be processed. Please try again."
          ),
        },
      ]);
    }
  }

  return (
    <div className="ai-thread-wrap">
      <div ref={threadRef} className="ai-thread-scroll">
        <div className="ai-thread-stack">
          {messages.map((message, index) => {
            const isUser = message.role === "user";
            const showOptions =
              !saving &&
              !isUser &&
              latestAssistantId === message.id &&
              arr(message.options).length > 0;

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

                  {s(message.helper) ? (
                    <div className="ai-bubble-helper">{message.helper}</div>
                  ) : null}

                  {showOptions ? (
                    <div className="ai-quick-row">
                      {arr(message.options).map((option) => (
                        <button
                          key={`${message.id}-${option.id}`}
                          type="button"
                          className="ai-quick-chip"
                          onClick={() => submitMessage(option.value)}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}

          {saving ? <TypingBubble /> : null}
        </div>
      </div>

      <div className="ai-composer">
        <div className="ai-composer-shell">
          <textarea
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitMessage(input);
              }
            }}
            placeholder="Write the next detail..."
            className="ai-composer-input"
          />

          <button
            type="button"
            onClick={() => submitMessage(input)}
            disabled={!s(input) || saving}
            className="ai-send-btn"
            aria-label="Send setup message"
          >
            <SendHorizontal className="h-4 w-4" strokeWidth={2.1} />
          </button>
        </div>
      </div>
    </div>
  );
}