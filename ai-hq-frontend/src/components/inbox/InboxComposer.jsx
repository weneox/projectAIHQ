import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Paperclip, Send, Smile, Sparkles } from "lucide-react";

import SurfaceBanner from "../feedback/SurfaceBanner.jsx";

function shouldRenderSurfaceBanner(surface) {
  return Boolean(
    surface?.saveSuccess ||
      surface?.saveError ||
      surface?.unavailable ||
      (!surface?.unavailable && surface?.error)
  );
}

function IconButton({ icon: Icon, label, disabled = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={[
        "inline-flex h-9 w-9 items-center justify-center rounded-[12px] transition-all",
        disabled
          ? "cursor-not-allowed text-[rgba(148,163,184,0.92)]"
          : "text-[rgba(100,116,139,0.96)] hover:bg-[rgba(248,250,252,0.96)] hover:text-[rgba(15,23,42,0.92)]",
      ].join(" ")}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function SendButton({ disabled, sending, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={sending ? "Sending operator reply" : "Send operator reply"}
      className={[
        "inline-flex h-11 items-center gap-2 rounded-[14px] px-4 text-[13px] font-semibold transition-all duration-200",
        disabled
          ? "cursor-not-allowed bg-[rgba(37,99,235,0.16)] text-white/90"
          : "bg-[rgba(37,99,235,0.98)] text-white shadow-[0_18px_40px_-22px_rgba(37,99,235,0.64)] hover:-translate-y-[1px]",
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
    const nextHeight = Math.max(54, Math.min(textarea.scrollHeight, 148));
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
        textarea.style.height = "54px";
      });
    }
  }

  return (
    <div className="mx-auto w-full max-w-[980px]">
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
        <div className="flex items-center gap-1">
          <IconButton
            icon={Sparkles}
            label="AI assist"
            disabled={!hasThread}
          />
          <IconButton
            icon={Smile}
            label="Emoji"
            disabled={!hasThread}
          />
          <IconButton
            icon={Paperclip}
            label="Attach"
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
            <span>Return to AI</span>
          </button>
        ) : null}
      </div>

      <div className="flex items-end gap-3 rounded-[20px] border border-[rgba(15,23,42,0.08)] bg-[rgba(255,255,255,0.84)] px-3 py-3 shadow-[0_20px_50px_-36px_rgba(15,23,42,0.18)] backdrop-blur supports-[backdrop-filter]:bg-[rgba(255,255,255,0.76)]">
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
                ? "Write a reply…"
                : "Select a conversation to reply"
            }
            aria-label={
              hasThread ? "Reply to conversation" : "Select a conversation first"
            }
            className="block min-h-[54px] max-h-[148px] w-full resize-none overflow-y-auto border-0 bg-transparent px-0 py-1 text-[15px] leading-8 text-[rgba(15,23,42,0.96)] outline-none placeholder:text-[rgba(148,163,184,0.96)] disabled:cursor-not-allowed"
          />
        </div>

        <div className="shrink-0">
          <SendButton
            disabled={sendDisabled}
            sending={Boolean(sending)}
            onClick={handleSendClick}
          />
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

  return <div className="px-6 pb-6 pt-3">{content}</div>;
}