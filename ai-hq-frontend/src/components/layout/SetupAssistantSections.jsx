import { useEffect, useMemo, useRef, useState } from "react";
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
    const text = s(item);
    if (!text) return null;
    return {
      id: `choice-${index}-${text}`,
      label: text,
      value: text,
    };
  }

  const safe = obj(item);
  const label = s(safe.label || safe.title || safe.name || safe.value);
  const value = s(
    safe.value || safe.answer || safe.label || safe.title || safe.name
  );

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

  return raw.map(normalizeChoice).filter(Boolean).slice(0, 6);
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
      helper: "Nothing goes live until you finish setup.",
    };
  }

  return {
    id: "setup-welcome",
    role: "assistant",
    text: "Let's shape the business here first.",
    helper: "We will finalize it only after the draft is ready.",
  };
}

function buildQuestionFromAssistant(assistant = {}) {
  const assistantData = obj(assistant.assistant);
  const nextQuestion = obj(assistantData.nextQuestion);
  const completion = obj(assistantData.completion);
  const blockers = arr(assistantData.confirmationBlockers);

  const prompt = s(
    nextQuestion.prompt || nextQuestion.question || nextQuestion.summary
  );
  const title = s(nextQuestion.title || nextQuestion.label);
  const key = s(nextQuestion.key, "profile");
  const helper = s(nextQuestion.helper || nextQuestion.description);
  const options = normalizeChoices(nextQuestion);

  if (prompt || title || options.length > 0) {
    return {
      key,
      title,
      prompt: prompt || "Tell me the next business detail.",
      helper,
      options,
    };
  }

  if (completion.ready === true) {
    return {
      key: "finalize",
      title: "",
      prompt: s(
        completion.message,
        "The setup draft is ready to finalize."
      ),
      helper: "",
      options: [],
    };
  }

  if (blockers.length > 0) {
    const first = obj(blockers[0]);
    return {
      key: s(first.key, "profile"),
      title: s(first.title),
      prompt: s(
        first.reason,
        "This section still needs confirmation before setup can finish."
      ),
      helper: s(first.metric || first.sourceHint),
      options: [],
    };
  }

  return {
    key: "profile",
    title: "",
    prompt: "Tell me the business name and what the business mainly does.",
    helper: "",
    options: [],
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

function FinalizePrompt({ message, busy, onFinalize }) {
  return (
    <div className="ai-row assistant">
      <div className="ai-bubble assistant">
        <div className="ai-bubble-text">
          {s(message, "The setup draft is ready to finalize.")}
        </div>

        <div className="ai-quick-row">
          <button
            type="button"
            className="ai-action-link"
            onClick={onFinalize}
            disabled={busy}
          >
            <span>{busy ? "Finalizing..." : "Finish setup"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SetupAssistantSections({
  assistant,
  saving = false,
  finalizing = false,
  onSendMessage,
  onFinalize,
}) {
  const threadRef = useRef(null);
  const seenAssistantSignaturesRef = useRef(new Set());

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(() => [buildWelcomeMessage(assistant)]);

  const busy = saving || finalizing;
  const question = useMemo(
    () => buildQuestionFromAssistant(assistant),
    [assistant]
  );
  const completion = obj(assistant?.assistant?.completion);
  const canFinalize = completion.ready === true;
  const latestAssistantId = [...messages]
    .reverse()
    .find((item) => item.role === "assistant")?.id;

  useEffect(() => {
    setMessages((current) => {
      if (!current.length) return [buildWelcomeMessage(assistant)];
      const first = current[0];
      if (first?.id !== "setup-welcome") return current;
      return [buildWelcomeMessage(assistant), ...current.slice(1)];
    });
  }, [assistant]);

  useEffect(() => {
    const signature = JSON.stringify({
      sessionId: s(assistant?.session?.id, "default"),
      version: Number(assistant?.draft?.version || 0),
      updatedAt: assistant?.draft?.updatedAt || "",
      key: question.key,
      title: question.title,
      prompt: question.prompt,
      helper: question.helper,
      options: arr(question.options).map((item) => `${item.id}:${item.label}`),
      finalize: canFinalize,
      finalizeMessage: s(completion.message),
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
    canFinalize,
    completion.message,
  ]);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTo({
      top: threadRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy, canFinalize]);

  async function submitMessage(rawValue) {
    const value = s(rawValue);
    if (!value || busy) return;

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

  async function finalizeSetup() {
    if (!canFinalize || busy) return;

    try {
      await onFinalize?.();
      setMessages((current) => [
        ...current,
        {
          id: `assistant-finalized-${Date.now()}`,
          role: "assistant",
          text:
            "Setup finalized. Approved truth and strict runtime projection were refreshed.",
          helper:
            "Now go back to channels or inbox and refresh their readiness state.",
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-finalize-error-${Date.now()}`,
          role: "assistant",
          text: s(
            error?.message,
            "Finalization failed. Review the remaining blockers and try again."
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
              !busy &&
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

          {canFinalize ? (
            <FinalizePrompt
              message={completion.message}
              busy={busy}
              onFinalize={finalizeSetup}
            />
          ) : null}

          {busy ? <TypingBubble /> : null}
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
            disabled={!s(input) || busy}
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