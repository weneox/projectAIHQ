import { Bot, Plus, Send, Smile, Sparkles } from "lucide-react";
import SurfaceBanner from "../feedback/SurfaceBanner.jsx";
import Button from "../ui/Button.jsx";

function shouldRenderSurfaceBanner(surface) {
  return Boolean(
    surface?.saveSuccess ||
      surface?.saveError ||
      surface?.unavailable ||
      (!surface?.unavailable && surface?.error)
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

  function handleKeyDown(event) {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    event.preventDefault();
    if (!hasThread || !replyText.trim() || sending) return;
    onSend?.();
  }

  return (
    <div className="space-y-3">
      {showBanner ? (
        <SurfaceBanner
          surface={surface}
          unavailableMessage="Operator reply controls are temporarily unavailable."
          refreshLabel="Refresh reply controls"
        />
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant={replyText.trim() ? "soft" : "ghost"}
            size="sm"
            disabled={!hasThread}
            leftIcon={<Sparkles className="h-4 w-4" />}
          >
            AI Assist
          </Button>

          <Button
            variant="ghost"
            size="icon"
            disabled={!hasThread}
            aria-label="Open emoji picker"
          >
            <Smile className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            disabled={!hasThread}
            aria-label="Add note or attachment"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {handoffActive ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={onReleaseHandoff}
            disabled={releasing}
            isLoading={releasing}
            leftIcon={!releasing ? <Bot className="h-4 w-4" /> : undefined}
          >
            Release AI
          </Button>
        ) : null}
      </div>

      <div className="flex items-end gap-3 rounded-[24px] bg-white/88 px-4 py-3 shadow-[0_18px_50px_-34px_rgba(15,23,42,0.24)] ring-1 ring-[rgba(15,23,42,0.06)] backdrop-blur supports-[backdrop-filter]:bg-white/78">
        <div className="min-w-0 flex-1">
          <textarea
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!hasThread || sending}
            rows={1}
            placeholder={
              hasThread ? "Write a reply" : "Select a conversation to reply"
            }
            aria-label={
              hasThread ? "Reply to conversation" : "Select a conversation first"
            }
            className="block min-h-[56px] max-h-[132px] w-full resize-none border-0 bg-transparent px-0 py-1 text-[14px] leading-7 text-text outline-none placeholder:text-text-subtle disabled:cursor-not-allowed"
          />
        </div>

        <button
          type="button"
          onClick={onSend}
          disabled={!hasThread || !replyText.trim() || sending}
          aria-label={sending ? "Sending operator reply" : "Send operator reply"}
          className={[
            "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-base ease-premium",
            !hasThread || !replyText.trim() || sending
              ? "cursor-not-allowed bg-[rgba(37,99,235,0.18)] text-white/90"
              : "bg-brand text-white shadow-[0_18px_38px_-22px_rgba(var(--color-brand),0.75)] hover:translate-y-[-1px]",
          ].join(" ")}
        >
          <Send className="h-4 w-4" />
        </button>
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
    return (
      <div className="border-t border-line-soft bg-[rgba(249,250,252,0.78)] px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-[rgba(249,250,252,0.7)]">
        <div className="mx-auto w-full max-w-[920px]">{content}</div>
      </div>
    );
  }

  return (
    <section className="border-t border-line-soft bg-[rgba(249,250,252,0.78)] px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-[rgba(249,250,252,0.7)]">
      <div className="mx-auto w-full max-w-[920px]">{content}</div>
    </section>
  );
}