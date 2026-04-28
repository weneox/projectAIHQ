import { useEffect, useMemo, useRef } from "react";
import { Mic, Paperclip, Plus, SendHorizonal, Smile } from "lucide-react";

function s(value) {
  return String(value ?? "");
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

export default function InboxComposer({
  embedded = false,
  selectedThread,
  surface = null,
  actionState = null,
  replyText,
  setReplyText,
  value = "",
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
}) {
  const textareaRef = useRef(null);

  const hasSelectedThreadProp = selectedThread !== undefined;
  const hasThread = !hasSelectedThreadProp || Boolean(selectedThread?.id);

  const normalizedValue = s(replyText ?? value);
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

  const canSend = useMemo(() => {
    return !resolvedDisabled && hasText;
  }, [resolvedDisabled, hasText]);

  const canVoice = useMemo(() => {
    return !resolvedDisabled && !hasText;
  }, [resolvedDisabled, hasText]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "0px";

    const nextHeight = Math.min(el.scrollHeight, 132);
    el.style.height = `${Math.max(nextHeight, 28)}px`;
  }, [normalizedValue]);

  function emitChange(nextValue) {
    if (typeof setReplyText === "function") {
      setReplyText(nextValue);
      return;
    }

    if (typeof onChange === "function") {
      onChange(nextValue);
    }
  }

  function handleTextareaChange(event) {
    emitChange(event.target.value);
  }

  function handleSubmit() {
    if (!canSend) return;

    const nextText = normalizedValue.trim();

    if (typeof onSubmit === "function") {
      onSubmit(nextText);
      return;
    }

    if (typeof onSend === "function") {
      onSend(nextText);
    }
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
      handleSubmit();
      return;
    }

    handleVoice();
  }

  function handleKeyDown(event) {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;

    event.preventDefault();
    handleSubmit();
  }

  const actionDisabled = hasText ? !canSend : !canVoice;
  const actionLabel = hasText ? submitLabel : voiceLabel;

  const utilityButtonClass = [
    "group relative inline-flex h-10 w-9 items-center justify-center",
    "text-[#617086]",
    "transition-[color,opacity,filter] duration-200 ease-out",
    "hover:text-[#18375D]",
    "active:opacity-80",
    "disabled:cursor-not-allowed disabled:opacity-35",
    "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
  ].join(" ");

  return (
    <div className={["w-full", className].filter(Boolean).join(" ")}>
      <div
        className={[
          "relative min-h-[66px] w-full min-w-0 overflow-hidden rounded-[23px] border",
          "border-[#D8E4F1]/95",
          "bg-[linear-gradient(180deg,rgba(255,255,255,0.99)_0%,rgba(248,251,255,0.985)_52%,rgba(245,248,252,0.99)_100%)]",
          "px-[18px] py-[13px]",
          "shadow-[0_18px_44px_-38px_rgba(15,23,42,0.36),0_7px_18px_-18px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,1),inset_0_-1px_0_rgba(148,163,184,0.08)]",
          "transition-[border-color,box-shadow,background-color] duration-200 ease-out",
          "focus-within:border-[#BDD2E8]",
          "focus-within:shadow-[0_20px_48px_-40px_rgba(15,23,42,0.40),0_8px_22px_-20px_rgba(37,99,235,0.16),inset_0_1px_0_rgba(255,255,255,1),inset_0_-1px_0_rgba(148,163,184,0.08)]",
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
              "transition-[opacity,color,filter] duration-[260ms] ease-out",
              "focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0",
              actionDisabled
                ? "cursor-not-allowed opacity-35"
                : "cursor-pointer hover:opacity-100",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span
              aria-hidden="true"
              className={[
                "pointer-events-none absolute inset-[-10px]",
                "transition-opacity duration-[260ms] ease-out",
                actionDisabled
                  ? "opacity-0"
                  : hasText
                  ? "opacity-100"
                  : "opacity-70",
              ].join(" ")}
              style={{
                background: hasText
                  ? "radial-gradient(circle at 50% 50%, rgba(22,133,232,0.16) 0%, rgba(22,133,232,0.07) 34%, rgba(22,133,232,0) 72%)"
                  : "radial-gradient(circle at 50% 50%, rgba(20,119,230,0.10) 0%, rgba(20,119,230,0.04) 34%, rgba(20,119,230,0) 72%)",
                filter: "blur(8px)",
              }}
            />

            <span
              className={[
                "absolute inset-0 flex items-center justify-center",
                "transition-[opacity,filter,color] duration-[260ms] ease-out",
                hasText
                  ? "opacity-0 blur-[1px] text-[#1477E6]"
                  : "opacity-100 blur-0 text-[#1477E6]",
              ].join(" ")}
            >
              <Mic className="h-[24px] w-[24px]" strokeWidth={2.15} />
            </span>

            <span
              className={[
                "absolute inset-0 flex items-center justify-center",
                "transition-[opacity,filter,color] duration-[260ms] ease-out",
                hasText
                  ? "opacity-100 blur-0 text-[#1685E8]"
                  : "opacity-0 blur-[1px] text-[#1685E8]",
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