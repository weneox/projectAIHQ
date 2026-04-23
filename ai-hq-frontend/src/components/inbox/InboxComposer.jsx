import { useEffect, useMemo, useRef } from "react";
import {
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

export default function InboxComposer({
  value = "",
  onChange,
  onSubmit,
  onSend,
  disabled = false,
  sending = false,
  placeholder = "Mesaj yazın...",
  showReturnToAi = false,
  onReturnToAi,
  onPickAttachment,
  onPickEmoji,
  onPickMore,
  className = "",
  submitLabel = "Send",
}) {
  const textareaRef = useRef(null);
  const normalizedValue = s(value);
  const canSend = useMemo(() => {
    return !disabled && !sending && normalizedValue.trim().length > 0;
  }, [disabled, sending, normalizedValue]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "0px";
    const nextHeight = Math.min(el.scrollHeight, 132);
    el.style.height = `${Math.max(nextHeight, 26)}px`;
  }, [normalizedValue]);

  function emitChange(nextValue) {
    if (typeof onChange === "function") {
      onChange(nextValue);
      return;
    }

    if (typeof onChange?.target === "function") {
      onChange.target({ target: { value: nextValue } });
    }
  }

  function handleTextareaChange(event) {
    emitChange(event.target.value);
  }

  function handleSubmit() {
    if (!canSend) return;

    if (typeof onSubmit === "function") {
      onSubmit(normalizedValue);
      return;
    }

    if (typeof onSend === "function") {
      onSend(normalizedValue);
    }
  }

  function handleKeyDown(event) {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;

    event.preventDefault();
    handleSubmit();
  }

  return (
    <div
      className={[
        "w-full",
        className,
      ].join(" ")}
    >
      <div
        className={[
          "flex items-end gap-3 rounded-[28px] border border-[#E7EDF5] bg-white",
          "px-4 py-3",
          "shadow-[0_16px_40px_-30px_rgba(15,23,42,0.18)]",
        ].join(" ")}
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => call(onPickMore)}
            disabled={disabled || sending}
            title="More"
            aria-label="More"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2.1} />
          </button>

          <button
            type="button"
            onClick={() => call(onPickEmoji)}
            disabled={disabled || sending}
            title="Emoji"
            aria-label="Emoji"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Smile className="h-[17px] w-[17px]" strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={() => call(onPickAttachment)}
            disabled={disabled || sending}
            title="Attach"
            aria-label="Attach"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-45"
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
            disabled={disabled || sending}
            placeholder={placeholder}
            rows={1}
            className={[
              "block w-full resize-none overflow-y-auto bg-transparent",
              "border-0 p-0 text-[15px] leading-[26px] text-[#0F172A] outline-none",
              "placeholder:text-[#94A3B8]",
              "disabled:cursor-not-allowed disabled:text-[#94A3B8]",
            ].join(" ")}
          />
        </div>

        <div className="flex items-center gap-2 self-center pl-1">
          {showReturnToAi ? (
            <button
              type="button"
              onClick={() => call(onReturnToAi)}
              disabled={disabled || sending}
              className="hidden whitespace-nowrap rounded-full px-2.5 py-1.5 text-[12px] font-medium text-[#64748B] transition-colors hover:bg-[#F8FAFC] hover:text-[#0F172A] disabled:cursor-not-allowed disabled:opacity-45 sm:inline-flex"
            >
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
              "inline-flex h-11 w-11 items-center justify-center rounded-full",
              "border border-[#D7E6FB] bg-[#EEF5FF] text-[#5B86C5]",
              "transition-all duration-150",
              canSend
                ? "hover:border-[#C6DCF8] hover:bg-[#E5F0FF] hover:text-[#3E6FAF]"
                : "cursor-not-allowed opacity-50",
            ].join(" ")}
          >
            <SendHorizonal className="h-[17px] w-[17px]" strokeWidth={2.1} />
          </button>
        </div>
      </div>
    </div>
  );
}