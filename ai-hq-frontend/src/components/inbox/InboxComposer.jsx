import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Paperclip,
  Send,
  Smile,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import SurfaceBanner from "../feedback/SurfaceBanner.jsx";

function shouldRenderSurfaceBanner(surface) {
  return Boolean(
    surface?.saveSuccess ||
      surface?.saveError ||
      surface?.unavailable ||
      (!surface?.unavailable && surface?.error)
  );
}

function ComposerAction({
  icon,
  label,
  onClick,
  disabled = false,
  active = false,
}) {
  const Icon = icon;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={[
        "inline-flex h-9 items-center gap-2 rounded-[12px] px-3 text-[12.5px] font-medium transition-all",
        active
          ? "bg-[rgba(37,99,235,0.10)] text-[rgba(37,99,235,0.98)]"
          : "text-[rgba(71,85,105,0.92)] hover:bg-[rgba(248,250,252,0.96)] hover:text-[rgba(15,23,42,0.92)]",
        disabled ? "cursor-not-allowed opacity-40" : "",
      ].join(" ")}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function ComposerUtilityButton({
  icon,
  label,
  onClick,
  disabled = false,
}) {
  const Icon = icon;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={[
        "inline-flex h-10 w-10 items-center justify-center rounded-[12px] text-[rgba(100,116,139,0.96)] transition-all hover:bg-[rgba(248,250,252,0.96)] hover:text-[rgba(15,23,42,0.92)]",
        disabled ? "cursor-not-allowed opacity-40" : "",
      ].join(" ")}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ComposerSendButton({ disabled, sending, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={sending ? "Sending operator reply" : "Send operator reply"}
      className={[
        "inline-flex h-12 items-center gap-2 rounded-[15px] px-4 text-[13px] font-semibold transition-all duration-200",
        disabled
          ? "cursor-not-allowed bg-[rgba(37,99,235,0.16)] text-white/90"
          : "bg-[rgba(37,99,235,0.98)] text-white shadow-[0_22px_45px_-24px_rgba(37,99,235,0.72)] hover:-translate-y-[1px]",
      ].join(" ")}
    >
      <Send className="h-4 w-4" />
      <span className="hidden sm:inline">{sending ? "Sending" : "Send"}</span>
    </button>
  );
}

function ComposerBody({
  selectedThread,
  surface,
  actionState,
  replyText,
  setReplyText,
  onSend,
  onReleaseHandoff,
}) {
  const hasThread = Boolean(selectedThread?.id);
  const handoffActive = Boolean(selectedThread?.handoff_active);
  const sending = actionState?.isActionPending?.("reply");
  const releasing = actionState?.isActionPending?.("release");
  const showBanner = hasThread && shouldRenderSurfaceBanner(surface);
  const textareaRef = useRef(null);
  const [isComposing, setIsComposing] = useState(false);

  const sendDisabled = useMemo(
    () =>
      !hasThread ||
      !replyText.trim() ||
      sending ||
      surface?.unavailable === true,
    [hasThread, replyText, sending, surface?.unavailable]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    const nextHeight = Math.max(60, Math.min(textarea.scrollHeight, 168));
    textarea.style.height = `${nextHeight}px`;
  }, [replyText, hasThread]);

  function handleKeyDown(event) {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    if (event.nativeEvent?.isComposing || isComposing) return;
    event.preventDefault();
    if (sendDisabled) return;
    onSend?.();
  }

  function handleSendClick() {
    if (sendDisabled) return;
    onSend?.();

    const textarea = textareaRef.current;
    if (textarea) {
      window.requestAnimationFrame(() => {
        textarea.style.height = "60px";
      });
    }
  }

  return (
    <div className="mx-auto w-full max-w-[960px]">
      {showBanner ? (
        <div className="mb-3">
          <SurfaceBanner
            surface={surface}
            unavailableMessage="Operator reply controls are temporarily unavailable."
            refreshLabel="Refresh reply controls"
          />
        </div>
      ) : null}

      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-1">
          <ComposerAction
            icon={Sparkles}
            label="AI Assist"
            disabled={!hasThread}
            active={Boolean(replyText.trim())}
          />

          <ComposerUtilityButton
            icon={Smile}
            label="Open emoji picker"
            disabled={!hasThread}
          />

          <ComposerUtilityButton
            icon={Paperclip}
            label="Attach file"
            disabled={!hasThread}
          />
        </div>

        {handoffActive ? (
          <button
            type="button"
            onClick={onReleaseHandoff}
            disabled={releasing}
            className={[
              "inline-flex h-9 items-center gap-2 rounded-[12px] px-3 text-[12.5px] font-medium transition-all",
              releasing
                ? "cursor-not-allowed opacity-45"
                : "text-[rgba(15,23,42,0.88)] hover:bg-[rgba(248,250,252,0.96)]",
            ].join(" ")}
          >
            <Bot className="h-4 w-4" />
            <span>{releasing ? "Returning..." : "Return to AI"}</span>
          </button>
        ) : null}
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-x-8 -top-3 h-10 rounded-full bg-[rgba(37,99,235,0.08)] blur-2xl" />

        <div className="relative flex items-end gap-3 rounded-[24px] border border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.84)] px-4 py-3 shadow-[0_28px_60px_-42px_rgba(15,23,42,0.22)] backdrop-blur supports-[backdrop-filter]:bg-[rgba(255,255,255,0.74)]">
          <button
            type="button"
            disabled={!hasThread}
            aria-label="Improve reply"
            title="Improve reply"
            className={[
              "mb-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] transition-all",
              hasThread
                ? "text-[rgba(37,99,235,0.96)] hover:bg-[rgba(239,246,255,0.96)]"
                : "cursor-not-allowed text-[rgba(148,163,184,0.96)]",
            ].join(" ")}
          >
            <WandSparkles className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1">
            <textarea
              ref={textareaRef}
              value={replyText}
              onChange={(event) => setReplyText(event.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              disabled={!hasThread || sending || surface?.unavailable === true}
              rows={1}
              placeholder={
                hasThread
                  ? "Write a thoughtful reply…"
                  : "Select a conversation to reply"
              }
              aria-label={
                hasThread ? "Reply to conversation" : "Select a conversation first"
              }
              className="block min-h-[60px] max-h-[168px] w-full resize-none overflow-y-auto border-0 bg-transparent px-0 py-1 text-[15px] leading-8 text-[rgba(15,23,42,0.96)] outline-none placeholder:text-[rgba(148,163,184,0.96)] disabled:cursor-not-allowed"
            />
          </div>

          <div className="mb-1 shrink-0">
            <ComposerSendButton
              disabled={sendDisabled}
              sending={Boolean(sending)}
              onClick={handleSendClick}
            />
          </div>
        </div>

        <div className="mt-2 flex items-center justify-between px-1 text-[11.5px] text-[rgba(148,163,184,0.96)]">
          <div className="truncate">
            {hasThread
              ? "Enter to send • Shift + Enter for new line"
              : "Choose a conversation to start replying"}
          </div>
          <div className="hidden sm:block">AI-assisted drafting ready</div>
        </div>
      </div>
    </div>
  );
}

export default function InboxComposer({
  selectedThread,
  surface,
  actionState,
  replyText,
  setReplyText,
  onSend,
  onReleaseHandoff,
  embedded = false,
}) {
  const content = (
    <ComposerBody
      selectedThread={selectedThread}
      surface={surface}
      actionState={actionState}
      replyText={replyText}
      setReplyText={setReplyText}
      onSend={onSend}
      onReleaseHandoff={onReleaseHandoff}
    />
  );

  if (embedded) {
    return content;
  }

  return <div className="px-6 pb-6 pt-4">{content}</div>;
}