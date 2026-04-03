import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, LoaderCircle, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cx } from "../../lib/cx.js";
import AskAIPresence from "./AskAIPresence.jsx";
import { getAskAiSuggestions, runAskAiMock } from "./askAiMock.js";

function toneClasses(tone = "neutral") {
  switch (tone) {
    case "brand":
      return {
        dot: "bg-brand",
        chip: "bg-brand-soft text-brand border-brand/15",
        action:
          "bg-brand text-white shadow-[0_14px_28px_rgba(37,99,235,0.24)] hover:translate-y-[-1px]",
      };
    case "warning":
      return {
        dot: "bg-warning",
        chip: "bg-warning-soft text-warning border-warning/15",
        action: "bg-warning text-white",
      };
    case "danger":
      return {
        dot: "bg-danger",
        chip: "bg-danger-soft text-danger border-danger/15",
        action: "bg-danger text-white",
      };
    default:
      return {
        dot: "bg-text-subtle",
        chip: "bg-surface-muted text-text-muted border-line-soft",
        action: "bg-surface-muted text-text hover:bg-canvas",
      };
  }
}

function SuggestionChip({ label, prompt, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(prompt)}
      className="rounded-full border border-line/75 bg-canvas px-3 py-1.5 text-[11px] font-semibold tracking-[-0.01em] text-text-muted transition hover:border-line-strong hover:bg-surface hover:text-text"
    >
      {label}
    </button>
  );
}

function EmptyState({ focusLabel, statusLine }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <AskAIPresence compact className="h-12 w-12" />
        <div className="min-w-0">
          <div className="text-[15px] font-semibold tracking-[-0.03em] text-text">
            Ask for a route, brief, or next action.
          </div>
          <div className="mt-1 text-[12px] leading-5 text-text-muted">
            Keep it short. This should feel like an operator copilot, not a
            chat room.
          </div>
        </div>
      </div>

      <div className="text-[11px] leading-5 text-text-subtle">
        <span className="font-semibold text-text">{focusLabel}</span>
        <span className="mx-1.5 text-line-strong">·</span>
        {statusLine}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/10 text-brand">
        <LoaderCircle className="h-4.5 w-4.5 animate-spin" strokeWidth={2} />
      </div>

      <div className="min-w-0">
        <div className="text-[14px] font-semibold tracking-[-0.02em] text-text">
          Reviewing operator context
        </div>
        <div className="mt-1 text-[11px] leading-5 text-text-muted">
          Building a compact answer.
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="space-y-2">
      <div className="text-[14px] font-semibold tracking-[-0.02em] text-danger">
        Ask AI is temporarily unavailable
      </div>
      <div className="text-[11px] leading-5 text-danger/80">{message}</div>

      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-8 items-center rounded-full border border-danger/20 bg-white px-3 text-[11px] font-semibold text-danger transition hover:border-danger/35"
      >
        Retry last prompt
      </button>
    </div>
  );
}

function ResponseView({ response, onAction }) {
  const tone = toneClasses(response?.tone);

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cx("h-1.5 w-1.5 rounded-full", tone.dot)} />
            <div className="truncate text-[15px] font-semibold tracking-[-0.03em] text-text">
              {response.title}
            </div>
          </div>

          <div className="mt-1.5 text-[12px] leading-5 text-text-muted">
            {response.summary}
          </div>
        </div>

        <div
          className={cx(
            "shrink-0 rounded-full border px-2.5 py-[5px] text-[9px] font-semibold uppercase tracking-[0.16em]",
            tone.chip
          )}
        >
          {response.focusLabel}
        </div>
      </div>

      {Array.isArray(response.bullets) && response.bullets.length ? (
        <div className="space-y-2">
          {response.bullets.slice(0, 2).map((bullet) => (
            <div
              key={bullet}
              className="flex items-start gap-2 text-[11px] leading-5 text-text-muted"
            >
              <span className="mt-[8px] h-1 w-1 rounded-full bg-text-subtle" />
              <span>{bullet}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div className="truncate text-[10px] text-text-subtle">
          {response.statusLine}
        </div>

        {response.action ? (
          <button
            type="button"
            onClick={() => onAction(response.action)}
            className={cx(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
              tone.action
            )}
          >
            {response.action.label}
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function AskAIWidget({
  shellSection,
  activeContextItem,
  shellStats,
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [responses, setResponses] = useState([]);

  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  const rootRef = useRef(null);
  const textareaRef = useRef(null);
  const lastPromptRef = useRef("");

  const suggestions = useMemo(
    () => getAskAiSuggestions(location.pathname),
    [location.pathname]
  );

  const focusLabel =
    activeContextItem?.label || shellSection?.label || "Workspace";

  const statusLine = useMemo(() => {
    if (responses[0]?.statusLine) return responses[0].statusLine;

    return (
      [
        typeof shellStats?.inboxUnread === "number"
          ? `${shellStats.inboxUnread} unread`
          : null,
        typeof shellStats?.leadsOpen === "number"
          ? `${shellStats.leadsOpen} open leads`
          : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Operator context ready"
    );
  }, [responses, shellStats]);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    function handleOutside(event) {
      if (!open) return;
      if (rootRef.current?.contains(event.target)) return;
      setOpen(false);
    }

    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [open]);

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "j") {
        event.preventDefault();
        setOpen((value) => !value);
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!textareaRef.current) return;

    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(
      textareaRef.current.scrollHeight,
      128
    )}px`;
  }, [input, open]);

  async function submitPrompt(rawPrompt) {
    const prompt = String(rawPrompt || "").trim();
    if (!prompt || pending) return;

    setPending(true);
    setError("");
    lastPromptRef.current = prompt;

    try {
      const response = await runAskAiMock({
        prompt,
        pathname: location.pathname,
        shellSection,
        activeContextItem,
        shellStats,
      });

      setResponses((current) =>
        [response, ...current.filter((entry) => entry.id !== response.id)].slice(
          0,
          4
        )
      );

      setInput("");

      if (response?.action?.autoNavigate && response.action.to) {
        navigate(response.action.to);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Ask AI is temporarily unavailable."
      );
    } finally {
      setPending(false);
    }
  }

  function handleAction(action) {
    if (!action?.to) return;
    navigate(action.to);
  }

  function handleTextareaKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submitPrompt(input);
    }
  }

  const panelInitial = reduceMotion
    ? { opacity: 0 }
    : { opacity: 0, y: 16, scale: 0.96 };

  const panelAnimate = reduceMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0, scale: 1 };

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed bottom-4 right-4 z-[85] md:bottom-5 md:right-5"
    >
      <AnimatePresence initial={false}>
        {open ? (
          <motion.section
            key="ask-ai-panel"
            initial={panelInitial}
            animate={panelAnimate}
            exit={panelInitial}
            transition={{
              duration: reduceMotion ? 0 : 0.22,
              ease: [0.22, 1, 0.36, 1],
            }}
            role="dialog"
            aria-label="Ask AI"
            className="pointer-events-auto absolute bottom-[84px] right-0 w-[min(372px,calc(100vw-24px))] overflow-hidden rounded-[28px] border border-line/80 bg-surface shadow-[0_28px_84px_rgba(15,23,42,0.16)]"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_72%)]" />

            <div className="relative p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <AskAIPresence compact active className="h-12 w-12" />

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[15px] font-semibold tracking-[-0.03em] text-text">
                      Ask AI
                      <Sparkles
                        className="h-3.5 w-3.5 text-brand"
                        strokeWidth={2}
                      />
                    </div>

                    <div className="mt-1 text-[11px] leading-5 text-text-muted">
                      {focusLabel}
                      <span className="mx-1.5 text-line-strong">·</span>
                      {statusLine}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition hover:bg-canvas hover:text-text"
                  aria-label="Close Ask AI"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>

              <div className="mt-4 rounded-[24px] border border-line/75 bg-canvas px-4 py-4">
                {error ? (
                  <ErrorState
                    message={error}
                    onRetry={() => submitPrompt(lastPromptRef.current)}
                  />
                ) : pending ? (
                  <LoadingState />
                ) : responses[0] ? (
                  <ResponseView response={responses[0]} onAction={handleAction} />
                ) : (
                  <EmptyState focusLabel={focusLabel} statusLine={statusLine} />
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((suggestion) => (
                  <SuggestionChip
                    key={suggestion.id}
                    label={suggestion.label}
                    prompt={suggestion.prompt}
                    onClick={(prompt) => {
                      setInput(prompt);
                      submitPrompt(prompt);
                    }}
                  />
                ))}
              </div>

              <div className="mt-3 rounded-[24px] border border-line/80 bg-surface px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.34)]">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="Ask for a route, brief, or action"
                  rows={1}
                  className="max-h-[128px] min-h-[24px] w-full resize-none border-0 bg-transparent p-0 text-[13px] leading-6 text-text outline-none placeholder:text-text-subtle"
                />

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="truncate text-[10px] text-text-subtle">
                    Enter sends · Shift+Enter adds a line
                  </div>

                  <button
                    type="button"
                    onClick={() => submitPrompt(input)}
                    disabled={pending || !String(input).trim()}
                    className={cx(
                      "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition",
                      pending || !String(input).trim()
                        ? "cursor-not-allowed bg-surface-muted text-text-subtle"
                        : "bg-brand text-white shadow-[0_16px_32px_rgba(37,99,235,0.26)] hover:translate-y-[-1px]"
                    )}
                    aria-label="Send Ask AI prompt"
                  >
                    {pending ? (
                      <LoaderCircle
                        className="h-4 w-4 animate-spin"
                        strokeWidth={2}
                      />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" strokeWidth={2.2} />
                    )}
                  </button>
                </div>
              </div>

              {responses.length > 1 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {responses.slice(1).map((response) => (
                    <button
                      key={response.id}
                      type="button"
                      onClick={() =>
                        setResponses((current) => [
                          response,
                          ...current.filter((entry) => entry.id !== response.id),
                        ])
                      }
                      className="truncate rounded-full border border-line/70 bg-canvas px-3 py-1.5 text-[10px] font-semibold text-text-muted transition hover:border-line-strong hover:bg-surface hover:text-text"
                    >
                      {response.prompt}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((value) => !value)}
        initial={panelInitial}
        animate={panelAnimate}
        transition={{
          duration: reduceMotion ? 0 : 0.18,
          ease: [0.22, 1, 0.36, 1],
        }}
        className="pointer-events-auto group relative flex h-[68px] w-[68px] items-center justify-center rounded-full transition active:scale-[0.98]"
        aria-label={open ? "Close Ask AI" : "Open Ask AI"}
      >
        <div className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition duration-200 group-hover:opacity-100 group-hover:shadow-[0_0_0_10px_rgba(37,99,235,0.08)]" />
        <AskAIPresence
          compact
          pulse={!open}
          active={open}
          className="h-[62px] w-[62px] transition duration-200 group-hover:scale-[1.03]"
        />
      </motion.button>
    </div>
  );
}