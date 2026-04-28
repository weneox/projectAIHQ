import { useEffect, useMemo, useRef } from "react";
import {
  CornerDownLeft,
  Paperclip,
  Plus,
  SendHorizonal,
  Smile,
} from "lucide-react";

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
  disabled = false,
  sending = false,
  placeholder = "Write a reply...",
  showReturnToAi = false,
  onReturnToAi,
  onReleaseHandoff,
  onPickAttachment,
  onPickEmoji,
  onPickMore,
  className = "",
  submitLabel = "Send",
}) {
  const textareaRef = useRef(null);
  const hasSelectedThreadProp = selectedThread !== undefined;
  const hasThread = !hasSelectedThreadProp || Boolean(selectedThread?.id);

  const normalizedValue = s(replyText ?? value);

  const surfaceSaving = Boolean(surface?.saving);
  const pendingReply = isActionPending(actionState, "reply");
  const isSending = Boolean(sending || surfaceSaving || pendingReply);
  const unavailable = Boolean(surface?.unavailable || surface?.availability === "unavailable");
  const ready = surface?.ready === false ? false : true;

  const resolvedDisabled = Boolean(
    disabled || isSending || unavailable || !ready || !hasThread
  );

  const canSend = useMemo(() => {
    return !resolvedDisabled && normalizedValue.trim().length > 0;
  }, [resolvedDisabled, normalizedValue]);

  const showReleaseToAi =
    showReturnToAi || Boolean(selectedThread?.handoff_active);

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

  function handleKeyDown(event) {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;

    event.preventDefault();
    handleSubmit();
  }

  function handleReleaseToAi() {
    if (typeof onReturnToAi === "function") {
      onReturnToAi();
      return;
    }

    if (typeof onReleaseHandoff === "function") {
      onReleaseHandoff();
    }
  }

  return (
    <div className={["w-full", className].join(" ")}>
      <div
        className={[
          "relative flex items-end gap-3 overflow-hidden rounded-[24px] border border-[#DDE6F1]",
          "bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_100%)] px-4 py-3",
          "shadow-[0_28px_70px_-52px_rgba(15,23,42,0.34),inset_0_1px_0_rgba(255,255,255,0.98)]",
          embedded ? "" : "",
        ].join(" ")}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-0 top-0 h-px bg-white"
        />

        <div className="flex items-center gap-1 self-center">
          <button
            type="button"
            onClick={() => call(onPickMore)}
            disabled={resolvedDisabled}
            title="More"
            aria-label="More"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.1} />
          </button>

          <button
            type="button"
            onClick={() => call(onPickEmoji)}
            disabled={resolvedDisabled}
            title="Emoji"
            aria-label="Emoji"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Smile className="h-[17px] w-[17px]" strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={() => call(onPickAttachment)}
            disabled={resolvedDisabled}
            title="Attach"
            aria-label="Attach"
            className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Paperclip className="h-[17px] w-[17px]" strokeWidth={2} />
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
            className={[
              "block w-full resize-none overflow-y-auto bg-transparent",
              "border-0 p-0 text-[15px] font-medium leading-[28px] text-[#0F172A] outline-none",
              "placeholder:text-[#94A3B8]",
              "disabled:cursor-not-allowed disabled:text-[#94A3B8]",
            ].join(" ")}
          />
        </div>

        <div className="flex items-center gap-2 self-center pl-1">
          {showReleaseToAi ? (
            <button
              type="button"
              onClick={handleReleaseToAi}
              disabled={resolvedDisabled && !isSending}
              className="hidden h-10 items-center gap-1.5 rounded-[13px] border border-[#E2E8F0] bg-white px-3 text-[12px] font-bold text-[#64748B] transition-colors hover:border-[#D8E2EE] hover:bg-[#F8FAFC] hover:text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-45 sm:inline-flex"
            >
              <CornerDownLeft className="h-3.5 w-3.5" />
              Return to AI
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSend}
            title={submitLabel}
            aria-label={submitLabel}
            className={[
              "inline-flex h-11 w-11 items-center justify-center rounded-[15px] border",
              "transition-all duration-150",
              canSend
                ? [
                    "border-[#1676DE]",
                    "bg-[linear-gradient(135deg,#3BA6FF_0%,#147FEA_58%,#075FCC_100%)]",
                    "text-white",
                    "shadow-[0_18px_36px_-24px_rgba(37,99,235,0.56),inset_0_1px_0_rgba(255,255,255,0.26)]",
                    "hover:translate-y-[-1px]",
                  ].join(" ")
                : "cursor-not-allowed border-[#DFE7F1] bg-[#F1F5F9] text-[#94A3B8]",
            ].join(" ")}
          >
            <SendHorizonal className="h-[17px] w-[17px]" strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  );
}