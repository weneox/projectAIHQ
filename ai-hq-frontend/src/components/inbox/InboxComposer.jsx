import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Paperclip, Plus, Send, Smile } from "lucide-react";

import SurfaceBanner from "../feedback/SurfaceBanner.jsx";

function shouldRenderSurfaceBanner(surface) {
  return Boolean(
    surface?.saveSuccess ||
      surface?.saveError ||
      surface?.unavailable ||
      (!surface?.unavailable && surface?.error)
  );
}

function ComposerIconButton({ icon: Icon, label, disabled = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={[
        "inline-flex h-8 w-8 items-center justify-center rounded-[10px] transition-all duration-200",
        disabled
          ? "cursor-not-allowed text-[rgba(148,163,184,0.8)]"
          : "text-[rgba(100,116,139,0.92)] hover:bg-[rgba(248,250,252,0.96)] hover:text-[rgba(15,23,42,0.92)]",
      ].join(" ")}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ReturnToAIAction({ disabled = false, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex h-8 items-center gap-2 rounded-[10px] px-2.5 text-[12.5px] font-medium transition-all duration-200",
        disabled
          ? "cursor-not-allowed text-[rgba(148,163,184,0.82)]"
          : "text-[rgba(71,85,105,0.94)] hover:bg-[rgba(248,250,252,0.92)] hover:text-[rgba(15,23,42,0.9)]",
      ].join(" ")}
    >
      <Bot className="h-3.5 w-3.5" />
      <span>Return to AI</span>
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
        "inline-flex h-10 items-center gap-2 rounded-[12px] px-4 text-[13px] font-semibold transition-all duration-200",
        disabled
          ? "cursor-not-allowed bg-[rgba(37,99,235,0.14)] text-white/90"
          : "bg-[rgba(37,99,235,0.98)] text-white shadow-[0_16px_34px_-20px_rgba(37,99,235,0.5)] hover:-translate-y-[1px]",
      ].join(" ")}
    >
      <Send className="h-4 w-4" />
      <span>{sending ? "Sending" : "Send"}</span>
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
    const nextHeight = Math.max(42, Math.min(textarea.scrollHeight, 120));
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
        textarea.style.height = "42px";
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

      <div className="rounded-[20px] border border-[rgba(15,23,42,0.06)] bg-[rgba(255,255,255,0.92)] px-4 py-3 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.18)] backdrop-blur supports-[backdrop-filter]:bg-[rgba(255,255,255,0.84)]">
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
            hasThread ? "Write a reply…" : "Select a conversation to reply"
          }
          aria-label={
            hasThread ? "Reply to conversation" : "Select a conversation first"
          }
          className="block min-h-[42px] max-h-[120px] w-full resize-none overflow-y-auto border-0 bg-transparent px-0 py-1 text-[15px] leading-7 text-[rgba(15,23,42,0.96)] placeholder:text-[rgba(148,163,184,0.96)] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed"
          style={{
            outline: "none",
            border: "0",
            boxShadow: "none",
            WebkitAppearance: "none",
            appearance: "none",
          }}
        />

        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <ComposerIconButton
              icon={Plus}
              label="More actions"
              disabled={!hasThread}
            />
            <ComposerIconButton
              icon={Smile}
              label="Emoji"
              disabled={!hasThread}
            />
            <ComposerIconButton
              icon={Paperclip}
              label="Attach"
              disabled={!hasThread}
            />
          </div>

          <div className="flex items-center gap-1.5">
            {handoffActive ? (
              <ReturnToAIAction
                disabled={releasing}
                onClick={onReleaseHandoff}
              />
            ) : null}

            <SendButton
              disabled={sendDisabled}
              sending={Boolean(sending)}
              onClick={handleSendClick}
            />
          </div>
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