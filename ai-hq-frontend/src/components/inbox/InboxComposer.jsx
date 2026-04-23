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
        "inline-flex h-9 w-9 items-center justify-center rounded-[12px] border transition-all duration-200",
        disabled
          ? "cursor-not-allowed border-transparent text-[rgba(148,163,184,0.86)]"
          : "border-transparent text-[rgba(100,116,139,0.94)] hover:border-[rgba(15,23,42,0.06)] hover:bg-[rgba(248,250,252,0.96)] hover:text-[rgba(15,23,42,0.92)]",
      ].join(" ")}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function SecondaryActionButton({
  icon: Icon,
  children,
  disabled = false,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex h-10 items-center gap-2 rounded-[12px] px-3 text-[12.5px] font-medium transition-all duration-200",
        disabled
          ? "cursor-not-allowed border border-[rgba(15,23,42,0.05)] text-[rgba(148,163,184,0.92)]"
          : "border border-[rgba(15,23,42,0.06)] bg-white/80 text-[rgba(15,23,42,0.84)] hover:bg-[rgba(248,250,252,0.96)]",
      ].join(" ")}
    >
      <Icon className="h-4 w-4" />
      <span>{children}</span>
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
          : "bg-[rgba(37,99,235,0.98)] text-white shadow-[0_18px_38px_-22px_rgba(37,99,235,0.56)] hover:-translate-y-[1px]",
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
    const nextHeight = Math.max(52, Math.min(textarea.scrollHeight, 164));
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
        textarea.style.height = "52px";
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

      <div className="rounded-[22px] border border-[rgba(15,23,42,0.07)] bg-[rgba(255,255,255,0.9)] shadow-[0_24px_60px_-40px_rgba(15,23,42,0.2)] backdrop-blur supports-[backdrop-filter]:bg-[rgba(255,255,255,0.82)]">
        <div className="px-4 pt-4">
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
            className="block min-h-[52px] max-h-[164px] w-full resize-none overflow-y-auto border-0 bg-transparent px-0 py-1 text-[15px] leading-7 text-[rgba(15,23,42,0.96)] outline-none placeholder:text-[rgba(148,163,184,0.96)] disabled:cursor-not-allowed"
          />
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 border-t border-[rgba(15,23,42,0.06)] px-3 py-3">
          <div className="flex items-center gap-1.5">
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

          <div className="flex items-center gap-2">
            {handoffActive ? (
              <SecondaryActionButton
                icon={Bot}
                disabled={releasing}
                onClick={onReleaseHandoff}
              >
                Return to AI
              </SecondaryActionButton>
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