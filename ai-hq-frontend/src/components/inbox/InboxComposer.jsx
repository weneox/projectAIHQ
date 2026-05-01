import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Mic, Paperclip, Plus, SendHorizonal, Smile } from "lucide-react";

function s(value) {
  return String(value ?? "");
}

function trim(value) {
  return String(value ?? "").trim();
}

function call(fn, ...args) {
  if (typeof fn === "function") fn(...args);
}

function isActionPending(actionState, key) {
  try {
    return Boolean(actionState?.isActionPending?.(key));
  } catch {
    return false;
  }
}

function InboxComposer({
  embedded = false,
  selectedThread,
  surface = null,
  actionState = null,
  replyText,
  setReplyText,
  value,
  onChange,
  onSubmit,
  onSend,
  onVoice,
  onRecordVoice,
  disabled = false,
  sending = false,
  placeholder = "Write a reply...",
  onPickAttachment,
  onPickEmoji,
  onPickMore,
  className = "",
  submitLabel = "Send",
  voiceLabel = "Voice message",
  aiReplyEnabled = false,
  threadAiEnabled = false,
  threadAiPaused = false,
  threadAiSaving = false,
  onToggleThreadAi,
}) {
  const textareaRef = useRef(null);
  const autosizeRafRef = useRef(0);
  const [aiNoticeOpen, setAiNoticeOpen] = useState(false);

  const selectedThreadId = trim(selectedThread?.id);
  const hasSelectedThreadProp = selectedThread !== undefined;
  const hasThread = !hasSelectedThreadProp || Boolean(selectedThreadId);

  useEffect(() => {
    setAiNoticeOpen(false);
  }, [selectedThreadId]);

  const controlled =
    replyText !== undefined ||
    value !== undefined ||
    typeof setReplyText === "function" ||
    typeof onChange === "function";

  const [localDraft, setLocalDraft] = useState({
    threadId: selectedThreadId,
    text: "",
  });

  const normalizedValue = controlled
    ? s(replyText ?? value)
    : localDraft.threadId === selectedThreadId
      ? localDraft.text
      : "";

  const hasText = normalizedValue.trim().length > 0;

  const surfaceSaving = Boolean(surface?.saving);
  const pendingReply = isActionPending(actionState, "reply");
  const isSending = Boolean(sending || surfaceSaving || pendingReply);

  const unavailable = Boolean(
    surface?.unavailable || surface?.availability === "unavailable"
  );

  const ready = surface?.ready === false ? false : true;

  const resolvedDisabled = Boolean(
    disabled || isSending || unavailable || !ready || !hasThread
  );

  const globalAiActive = aiReplyEnabled === true;
  const threadAiActive = threadAiEnabled === true && threadAiPaused !== true;
  const threadAiSwitchPending =
    threadAiSaving === true ||
    isActionPending(actionState, "handoff") ||
    isActionPending(actionState, "release");

  const shouldShowAiNotice = aiNoticeOpen && hasThread && globalAiActive;

  function revealAiNotice() {
    if (!globalAiActive || !hasThread) return;
    setAiNoticeOpen(true);
  }

  function handleThreadAiToggle() {
    if (threadAiSwitchPending) return;
    if (typeof onToggleThreadAi !== "function") return;
    void onToggleThreadAi(!threadAiActive);
  }

  const canSend = useMemo(() => {
    return !resolvedDisabled && hasText;
  }, [resolvedDisabled, hasText]);

  const canVoice = useMemo(() => {
    return !resolvedDisabled && !hasText;
  }, [resolvedDisabled, hasText]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return undefined;

    if (autosizeRafRef.current) {
      window.cancelAnimationFrame(autosizeRafRef.current);
    }

    autosizeRafRef.current = window.requestAnimationFrame(() => {
      autosizeRafRef.current = 0;

      const target = textareaRef.current;
      if (!target) return;

      target.style.height = "0px";

      const nextHeight = Math.min(target.scrollHeight, 132);
      target.style.height = `${Math.max(nextHeight, 28)}px`;
    });

    return () => {
      if (autosizeRafRef.current) {
        window.cancelAnimationFrame(autosizeRafRef.current);
        autosizeRafRef.current = 0;
      }
    };
  }, [normalizedValue]);

  function emitChange(nextValue) {
    if (typeof setReplyText === "function") {
      setReplyText(nextValue);
      return;
    }

    if (typeof onChange === "function") {
      onChange(nextValue);
      return;
    }

    setLocalDraft({
      threadId: selectedThreadId,
      text: String(nextValue ?? ""),
    });
  }

  function clearLocalDraftAfterSend() {
    if (controlled) return;

    setLocalDraft((current) => {
      if (current.threadId !== selectedThreadId) return current;

      return {
        threadId: selectedThreadId,
        text: "",
      };
    });
  }

  function handleTextareaChange(event) {
    emitChange(event.target.value);
  }

  async function handleSubmit() {
    if (!canSend) return false;

    const nextText = normalizedValue.trim();

    if (typeof onSubmit === "function") {
      const result = await onSubmit(nextText);

      if (result !== false) {
        clearLocalDraftAfterSend();
      }

      return result;
    }

    if (typeof onSend === "function") {
      const result = await onSend(nextText);

      if (result !== false) {
        clearLocalDraftAfterSend();
      }

      return result;
    }

    clearLocalDraftAfterSend();
    return true;
  }

  function handleVoice() {
    if (!canVoice) return;

    if (typeof onVoice === "function") {
      onVoice();
      return;
    }

    if (typeof onRecordVoice === "function") {
      onRecordVoice();
    }
  }

  function handlePrimaryAction() {
    if (hasText) {
      void handleSubmit();
      return;
    }

    handleVoice();
  }

  function handleKeyDown(event) {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;

    event.preventDefault();
    void handleSubmit();
  }

  const actionDisabled = hasText ? !canSend : !canVoice;
  const actionLabel = hasText ? submitLabel : voiceLabel;

  const utilityButtonClass = [
    "group relative inline-flex h-10 w-9 items-center justify-center",
    "text-[#617086]",
    "transition-[color,opacity] duration-200 ease-out",
    "hover:text-[#18375D]",
    "active:opacity-80",
    "disabled:cursor-not-allowed disabled:opacity-35",
    "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
  ].join(" ");

  return (
    <div className={["w-full", className].filter(Boolean).join(" ")}>
      {shouldShowAiNotice ? (
        <div className="mb-2 overflow-hidden rounded-[20px] border border-[#D8E7F7] bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(246,250,255,0.98)_100%)] px-4 py-3 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.94)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-[220px] flex-1">
              <div className="text-[13px] font-semibold leading-5 tracking-[-0.01em] text-[#15263B]">
                {threadAiActive
                  ? "AI bu söhbətdə aktivdir."
                  : "Operator rejimi aktivdir."}
              </div>
              <div className="mt-0.5 text-[12px] font-medium leading-5 text-[#64748B]">
                {threadAiActive
                  ? "Manual cavab yazsanız, AI cavabı ilə üst-üstə düşə bilər."
                  : "AI bu söhbətdə avtomatik cavab verməyəcək. İstəsəniz yenidən aktiv edin."}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                role="switch"
                aria-checked={threadAiActive}
                disabled={threadAiSwitchPending || !globalAiActive}
                onClick={handleThreadAiToggle}
                className={[
                  "inline-flex h-9 items-center gap-2 rounded-full border px-2.5 pr-3",
                  "text-[12px] font-semibold transition-all duration-200",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  threadAiActive
                    ? "border-[#B9D7FF] bg-[#EEF7FF] text-[#1167C7]"
                    : "border-[#E3EAF2] bg-white text-[#526176]",
                ].join(" ")}
              >
                <span
                  className={[
                    "relative inline-flex h-[20px] w-[34px] items-center rounded-full transition-colors duration-200",
                    threadAiActive ? "bg-[#2F8FEA]" : "bg-[#CBD5E1]",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "absolute top-[3px] h-[14px] w-[14px] rounded-full bg-white shadow-[0_2px_6px_rgba(15,23,42,0.18)] transition-transform duration-200",
                      threadAiActive ? "translate-x-[17px]" : "translate-x-[3px]",
                    ].join(" ")}
                  />
                </span>
                <span>{threadAiActive ? "AI ON" : "AI OFF"}</span>
              </button>

              <button
                type="button"
                onClick={() => setAiNoticeOpen(false)}
                className="inline-flex h-9 items-center rounded-full px-3 text-[12px] font-semibold text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#1E293B]"
              >
                Bağla
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div
        onFocusCapture={revealAiNotice}
        onClick={revealAiNotice}
        className={[
          "relative min-h-[66px] w-full min-w-0 overflow-hidden rounded-[23px] border",
          "border-[#D8E4F1]/95",
          "bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,251,255,0.985)_52%,rgba(245,248,252,0.99)_100%)]",
          "px-[18px] py-[13px]",
          "shadow-[0_18px_44px_-38px_rgba(15,23,42,0.36),0_7px_18px_-18px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,1),inset_0_-1px_0_rgba(148,163,184,0.08)]",
          "transition-[border-color,box-shadow,background-color] duration-200 ease-out",
          "focus-within:border-[#BDD2E8]",
          "focus-within:shadow-[0_20px_48px_-40px_rgba(15,23,42,0.40),0_8px_22px_-20px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,1),inset_0_-1px_0_rgba(148,163,184,0.08)]",
          embedded ? "" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/95"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-9 bottom-0 h-px bg-[#D8E4F1]/34"
        />

        <div className="flex min-h-[38px] w-full items-end gap-3">
          <div className="flex items-center gap-1.5 self-center">
            <button
              type="button"
              onClick={() => call(onPickMore)}
              disabled={resolvedDisabled}
              title="More"
              aria-label="More"
              className={utilityButtonClass}
            >
              <Plus className="h-[19px] w-[19px]" strokeWidth={2.05} />
            </button>

            <button
              type="button"
              onClick={() => call(onPickEmoji)}
              disabled={resolvedDisabled}
              title="Emoji"
              aria-label="Emoji"
              className={utilityButtonClass}
            >
              <Smile className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>

            <button
              type="button"
              onClick={() => call(onPickAttachment)}
              disabled={resolvedDisabled}
              title="Attach"
              aria-label="Attach"
              className={utilityButtonClass}
            >
              <Paperclip className="h-[18px] w-[18px]" strokeWidth={2} />
            </button>
          </div>

          <div className="min-w-0 flex-1 self-center">
            <textarea
              ref={textareaRef}
              value={normalizedValue}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              disabled={resolvedDisabled}
              placeholder={placeholder}
              rows={1}
              spellCheck="true"
              className={[
                "block w-full resize-none overflow-y-auto bg-transparent",
                "border-0 p-0",
                "text-[15px] font-medium leading-[28px] tracking-[-0.01em] text-[#102033]",
                "placeholder:text-[#899AAF]",
                "outline-none ring-0",
                "transition-[color] duration-200",
                "focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
                "disabled:cursor-not-allowed disabled:text-[#94A3B8]",
                "[box-shadow:none] [appearance:none]",
                "[&:focus]:outline-none [&:focus]:ring-0 [&:focus]:[box-shadow:none]",
                "[&:focus-visible]:outline-none [&:focus-visible]:ring-0 [&:focus-visible]:[box-shadow:none]",
              ].join(" ")}
              style={{
                outline: "none",
                boxShadow: "none",
              }}
            />
          </div>

          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={actionDisabled}
            title={actionLabel}
            aria-label={actionLabel}
            className={[
              "relative inline-flex h-10 w-10 shrink-0 items-center justify-center self-center",
              "border-0 bg-transparent p-0 shadow-none outline-none ring-0",
              "transition-[opacity,color] duration-[260ms] ease-out",
              "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
              actionDisabled
                ? "cursor-not-allowed opacity-35"
                : "cursor-pointer hover:opacity-100",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span
              className={[
                "absolute inset-0 flex items-center justify-center",
                "transition-[opacity,color] duration-[260ms] ease-out",
                hasText ? "opacity-0 text-[#1477E6]" : "opacity-100 text-[#1477E6]",
              ].join(" ")}
            >
              <Mic className="h-[24px] w-[24px]" strokeWidth={2.15} />
            </span>

            <span
              className={[
                "absolute inset-0 flex items-center justify-center",
                "transition-[opacity,color] duration-[260ms] ease-out",
                hasText ? "opacity-100 text-[#1685E8]" : "opacity-0 text-[#1685E8]",
              ].join(" ")}
            >
              <SendHorizonal
                className="h-[25px] w-[25px] translate-x-[1px]"
                strokeWidth={2.25}
              />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(InboxComposer);