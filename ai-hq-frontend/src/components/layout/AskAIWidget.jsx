import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  LoaderCircle,
  Sparkles,
  X,
} from "lucide-react";
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
        badge: "border-brand/15 bg-brand/8 text-brand",
        action:
          "bg-brand text-white shadow-[0_18px_36px_rgba(37,99,235,0.24)] hover:translate-y-[-1px]",
      };
    case "warning":
      return {
        dot: "bg-warning",
        badge: "border-warning/15 bg-warning/10 text-warning",
        action:
          "bg-warning text-white shadow-[0_18px_36px_rgba(245,158,11,0.24)] hover:translate-y-[-1px]",
      };
    case "danger":
      return {
        dot: "bg-danger",
        badge: "border-danger/15 bg-danger/10 text-danger",
        action:
          "bg-danger text-white shadow-[0_18px_36px_rgba(239,68,68,0.22)] hover:translate-y-[-1px]",
      };
    default:
      return {
        dot: "bg-text-subtle",
        badge: "border-line/80 bg-canvas text-text-muted",
        action:
          "bg-canvas text-text shadow-[0_12px_24px_rgba(15,23,42,0.08)] hover:bg-surface-muted hover:translate-y-[-1px]",
      };
  }
}

function SuggestionChip({ label, prompt, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(prompt)}
      className="inline-flex items-center rounded-full border border-line/70 bg-white/88 px-3.5 py-2 text-[11px] font-medium tracking-[-0.01em] text-text-muted transition hover:border-brand/25 hover:bg-brand/5 hover:text-text"
    >
      {label}
    </button>
  );
}

function HistoryChip({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="truncate rounded-full border border-line/60 bg-surface-muted/70 px-3 py-1.5 text-[10px] font-semibold text-text-muted transition hover:border-line-strong hover:bg-canvas hover:text-text"
    >
      {label}
    </button>
  );
}

function EmptyState({ focusLabel, statusLine }) {
  return (
    <div className="space-y-4">
      <div className="inline-flex items-center gap-2 rounded-full border border-brand/12 bg-brand/6 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand">
        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_0_5px_rgba(37,99,235,0.10)]" />
        Live copilot
      </div>

      <div className="max-w-[15ch] text-[34px] font-semibold leading-[0.94] tracking-[-0.08em] text-text">
        Route, brief, or next action.
      </div>

      <div className="max-w-[38ch] text-[13px] leading-6 text-text-muted">
        Compact, premium, and useful. No floating junk. No oversized hover card.
      </div>

      <div className="text-[11px] text-text-subtle">
        <span className="font-medium text-text">{focusLabel}</span>
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

      <div>
        <div className="text-[15px] font-semibold tracking-[-0.03em] text-text">
          Reviewing context
        </div>
        <div className="mt-1 text-[12px] leading-5 text-text-muted">
          Building the shortest useful answer.
        </div>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="space-y-3">
      <div className="inline-flex items-center gap-2 rounded-full border border-danger/12 bg-danger/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-danger">
        Temporary issue
      </div>

      <div className="text-[22px] font-semibold leading-none tracking-[-0.05em] text-text">
        Ask AI is unavailable
      </div>

      <div className="max-w-[36ch] text-[12px] leading-6 text-text-muted">
        {message}
      </div>

      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-9 items-center rounded-full border border-danger/15 bg-white px-3.5 text-[11px] font-semibold text-danger transition hover:border-danger/30 hover:bg-danger/5"
      >
        Retry
      </button>
    </div>
  );
}

function ResponseView({ response, onAction }) {
  const tone = toneClasses(response?.tone);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cx(
            "inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
            tone.badge
          )}
        >
          {response.kicker || "Ask AI"}
        </span>

        <span className="text-[10px] uppercase tracking-[0.16em] text-text-subtle">
          {response.focusLabel}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <span
            className={cx(
              "mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full",
              tone.dot
            )}
          />
          <div className="min-w-0">
            <div className="text-[28px] font-semibold leading-[0.95] tracking-[-0.07em] text-text">
              {response.title}
            </div>
            <div className="mt-3 max-w-[38ch] text-[13px] leading-6 text-text-muted">
              {response.summary}
            </div>
          </div>
        </div>

        {Array.isArray(response.bullets) && response.bullets.length ? (
          <div className="space-y-2.5 pl-[14px]">
            {response.bullets.slice(0, 2).map((bullet) => (
              <div
                key={bullet}
                className="flex items-start gap-2.5 text-[12px] leading-6 text-text-muted"
              >
                <span className="mt-[10px] h-1 w-1 rounded-full bg-text-subtle" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="truncate text-[10px] text-text-subtle">
          {response.statusLine}
        </div>

        {response.action ? (
          <button
            type="button"
            onClick={() => onAction(response.action)}
            className={cx(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[11px] font-semibold transition",
              tone.action
            )}
          >
            {response.action.label}
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.1} />
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
  const [hovered, setHovered] = useState(false);
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
    () => getAskAiSuggestions(location.pathname).slice(0, 3),
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
    setOpen(false);
  }, [location.pathname]);

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
      124
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
        [response, ...current.filter((entry) => entry.prompt !== response.prompt)].slice(
          0,
          5
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
    : { opacity: 0, y: 16, scale: 0.985 };

  const panelAnimate = reduceMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0, scale: 1 };

  return (
    <div
      ref={rootRef}
      className="pointer-events-none fixed z-[140]"
      style={{
        right: "max(16px, env(safe-area-inset-right))",
        bottom: "max(16px, env(safe-area-inset-bottom))",
      }}
    >
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="ask-ai-panel"
            initial={panelInitial}
            animate={panelAnimate}
            exit={panelInitial}
            transition={{
              duration: reduceMotion ? 0 : 0.24,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="pointer-events-none absolute bottom-[92px] right-0"
          >
            <motion.section
              role="dialog"
              aria-label="Ask AI"
              className="pointer-events-auto relative flex max-h-[min(740px,calc(100vh-120px))] w-[min(460px,calc(100vw-24px))] flex-col overflow-hidden rounded-[34px] border border-line/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.985),rgba(248,250,254,0.985))] shadow-[0_28px_90px_rgba(15,23,42,0.16)] backdrop-blur-xl"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.08),transparent_72%)]" />
              <div className="pointer-events-none absolute right-[-40px] top-[-30px] h-[140px] w-[140px] rounded-full bg-brand/8 blur-3xl" />
              <div className="pointer-events-none absolute left-[-30px] bottom-[-44px] h-[120px] w-[120px] rounded-full bg-brand/6 blur-3xl" />

              <div className="relative border-b border-line/70 px-6 pb-5 pt-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <AskAIPresence
                      compact
                      active
                      pulse
                      className="h-[62px] w-[62px] shrink-0"
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.05em] text-text">
                        Ask AI
                        <Sparkles
                          className="h-3.5 w-3.5 text-brand"
                          strokeWidth={2}
                        />
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-[11px] text-text-subtle">
                        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
                        <span>Premium operator layer</span>
                        <span className="text-line-strong">·</span>
                        <span>{focusLabel}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition hover:bg-canvas hover:text-text"
                    aria-label="Close Ask AI"
                  >
                    <X className="h-4 w-4" strokeWidth={2} />
                  </button>
                </div>
              </div>

              <div className="relative flex-1 overflow-y-auto px-6 py-5">
                {error ? (
                  <ErrorState
                    message={error}
                    onRetry={() => submitPrompt(lastPromptRef.current)}
                  />
                ) : pending ? (
                  <LoadingState />
                ) : responses[0] ? (
                  <ResponseView
                    response={responses[0]}
                    onAction={handleAction}
                  />
                ) : (
                  <EmptyState focusLabel={focusLabel} statusLine={statusLine} />
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  {suggestions.map((suggestion) => (
                    <SuggestionChip
                      key={suggestion.id}
                      label={suggestion.label}
                      prompt={suggestion.prompt}
                      onClick={submitPrompt}
                    />
                  ))}
                </div>

                {responses.length > 1 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {responses.slice(1).map((response) => (
                      <HistoryChip
                        key={response.id}
                        label={response.prompt}
                        onClick={() =>
                          setResponses((current) => [
                            response,
                            ...current.filter((entry) => entry.id !== response.id),
                          ])
                        }
                      />
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="relative border-t border-line/70 px-5 py-5">
                <div className="rounded-[28px] border border-line/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(246,248,252,0.92))] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_16px_32px_rgba(15,23,42,0.06)]">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(event) => {
                      setInput(event.target.value);
                      if (error) setError("");
                    }}
                    onKeyDown={handleTextareaKeyDown}
                    placeholder="Ask for a route, brief, or action"
                    rows={1}
                    className="max-h-[124px] min-h-[28px] w-full resize-none border-0 bg-transparent p-0 text-[14px] leading-6 text-text outline-none placeholder:text-text-subtle"
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
                        "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition",
                        pending || !String(input).trim()
                          ? "cursor-not-allowed bg-surface-muted text-text-subtle"
                          : "bg-brand text-white shadow-[0_18px_36px_rgba(37,99,235,0.24)] hover:translate-y-[-1px]"
                      )}
                      aria-label="Send Ask AI prompt"
                    >
                      {pending ? (
                        <LoaderCircle
                          className="h-4.5 w-4.5 animate-spin"
                          strokeWidth={2}
                        />
                      ) : (
                        <ArrowUpRight className="h-4.5 w-4.5" strokeWidth={2.2} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((value) => !value)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        whileTap={reduceMotion ? undefined : { scale: 0.98 }}
        className="pointer-events-auto group relative flex h-[82px] w-[82px] items-center justify-center rounded-full"
        aria-label="Open Ask AI"
      >
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.16),rgba(37,99,235,0.08)_45%,transparent_70%)] blur-xl"
          animate={
            reduceMotion
              ? { opacity: hovered || open ? 0.95 : 0.7, scale: 1 }
              : {
                  opacity: hovered || open ? [0.5, 0.95, 0.5] : [0.28, 0.5, 0.28],
                  scale: hovered || open ? [1, 1.08, 1] : [1, 1.04, 1],
                }
          }
          transition={{
            duration: 2.2,
            repeat: reduceMotion ? 0 : Infinity,
            ease: "easeInOut",
          }}
        />

        <div className="pointer-events-none absolute inset-0 rounded-full opacity-0 transition duration-200 group-hover:opacity-100 group-hover:shadow-[0_0_0_12px_rgba(37,99,235,0.08)]" />

        <AskAIPresence
          compact
          pulse
          active={hovered || open}
          className="h-[70px] w-[70px] transition duration-200 group-hover:scale-[1.03]"
        />
      </motion.button>
    </div>
  );
}