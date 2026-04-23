import { useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, Plus, Send, Smile } from "lucide-react";

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
        "inline-flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200",
        disabled
          ? "cursor-not-allowed text-[#B8C2D1]"
          : "text-[#66758C] hover:bg-[#F8FAFC] hover:text-[#0F172A]",
      ].join(" ")}
    >
      <Icon className="h-5 w-5" />
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
        "inline-flex h-14 w-14 items-center justify-center rounded-[18px] border transition-all duration-200",
        disabled
          ? "border-[#E6ECF5] bg-[#EEF3FA] text-[#A0AEC0]"
          : "border-[#D9E6FF] bg-[#EEF4FF] text-[#4F7CFF] shadow-[0_16px_34px_-24px_rgba(79,124,255,0.28)] hover:-translate-y-[1px]",
      ].join(" ")}
    >
      <Send className="h-5 w-5" />
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
    const nextHeight = Math.max(30, Math.min(textarea.scrollHeight, 120));
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
        textarea.style.height = "30px";
      });
    }
  }

  return (
    <div className="mx-auto w-full max-w-none">
      {showBanner ? (
        <div className="mb-3">
          <SurfaceBanner
            surface={surface}
            unavailableMessage="Operator reply controls are temporarily unavailable."
            refreshLabel="Refresh reply controls"
          />
        </div>
      ) : null}

      <div className="rounded-[30px] border border-[#E7ECF3] bg-white px-5 py-4 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.16)]">
        <div className="flex items-end gap-4">
          <div className="flex shrink-0 items-center gap-1">
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
                hasThread ? "Mesaj yazın..." : "Söhbət seçin..."
              }
              aria-label={
                hasThread ? "Reply to conversation" : "Select a conversation first"
              }
              className="block min-h-[30px] max-h-[120px] w-full resize-none overflow-y-auto border-0 bg-transparent px-0 py-2 text-[15px] leading-7 text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:outline-none focus:ring-0 disabled:cursor-not-allowed"
              style={{
                outline: "none",
                border: 0,
                boxShadow: "none",
                WebkitAppearance: "none",
                appearance: "none",
              }}
            />
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {handoffActive ? (
              <button
                type="button"
                onClick={onReleaseHandoff}
                disabled={releasing}
                className={[
                  "px-2 text-[12px] font-medium transition-colors",
                  releasing
                    ? "cursor-not-allowed text-[#B8C2D1]"
                    : "text-[#6B7280] hover:text-[#0F172A]",
                ].join(" ")}
              >
                Return to AI
              </button>
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

  if (embedded) return content;

  return <div className="px-4 pb-4 pt-3 md:px-6 md:pb-6">{content}</div>;
}