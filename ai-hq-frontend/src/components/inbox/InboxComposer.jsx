import { Bot, Plus, Send, Smile, Sparkles } from "lucide-react";
import SurfaceBanner from "../feedback/SurfaceBanner.jsx";
import Button from "../ui/Button.jsx";
import { Textarea } from "../ui/Input.jsx";

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
    <div className="space-y-2.5">
      {showBanner ? (
        <SurfaceBanner
          surface={surface}
          unavailableMessage="Operator reply controls are temporarily unavailable."
          refreshLabel="Refresh reply controls"
        />
      ) : null}

      <div className="rounded-[16px] border border-line bg-surface px-3.5 py-3">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
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

        <div className="flex items-end gap-2.5">
          <Textarea
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!hasThread || sending}
            rows={2}
            placeholder={
              hasThread ? "Write a reply" : "Select a conversation to reply"
            }
            aria-label={
              hasThread ? "Reply to conversation" : "Select a conversation first"
            }
            className="flex-1"
            appearance="quiet"
            textClassName="!min-h-[56px] max-h-[112px] resize-none"
          />

          <Button
            onClick={onSend}
            disabled={!hasThread || !replyText.trim() || sending}
            isLoading={sending}
            size="icon"
            aria-label={sending ? "Sending operator reply" : "Send operator reply"}
            className="h-10 w-10 shrink-0"
          >
            {!sending ? <Send className="h-4 w-4" /> : null}
          </Button>
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
    return (
      <div className="border-t border-line-soft bg-surface-muted px-3 py-3">
        {content}
      </div>
    );
  }

  return (
    <section className="border-t border-line-soft bg-surface-muted px-3 py-3">
      {content}
    </section>
  );
}