import { Bot, Plus, Send, Smile, Sparkles } from "lucide-react";
import SettingsSurfaceBanner from "../settings/SettingsSurfaceBanner.jsx";

function shouldRenderSurfaceBanner(surface) {
  return Boolean(
    surface?.saveSuccess ||
      surface?.saveError ||
      surface?.unavailable ||
      (!surface?.unavailable && surface?.error)
  );
}

function IconButton({
  children,
  onClick,
  disabled = false,
  variant = "default",
  label = "",
  className = "",
}) {
  const variants = {
    default:
      "text-slate-500 hover:bg-white/80 hover:text-slate-950",
    accent:
      "bg-[#4d8ae6] text-white hover:bg-[#3f79cf]",
    subtle:
      "text-slate-500 hover:bg-white/80 hover:text-slate-950",
    ghost:
      "text-slate-500 hover:bg-white/80 hover:text-slate-950",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label || undefined}
      title={label || undefined}
      className={[
        "inline-flex h-10 items-center justify-center rounded-full px-3 transition disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant] || variants.default,
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function PillButton({
  children,
  onClick,
  disabled = false,
  active = false,
  label = "",
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label || undefined}
      title={label || undefined}
      className={[
        "inline-flex h-9 items-center gap-2 rounded-full px-3 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-45",
        active
          ? "bg-white text-[#335ea8] shadow-[0_6px_18px_rgba(15,23,42,0.06)]"
          : "text-slate-600 hover:bg-white/80 hover:text-slate-900",
      ].join(" ")}
    >
      {children}
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
        <SettingsSurfaceBanner
          surface={surface}
          unavailableMessage="Operator reply controls are temporarily unavailable."
          refreshLabel="Refresh reply controls"
        />
      ) : null}

      <div className="relative">
        <div className="flex flex-wrap items-center gap-1 px-2 pb-2">
          <PillButton
            disabled={!hasThread}
            active={Boolean(replyText.trim())}
            label="AI Assist"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>AI Assist</span>
          </PillButton>

          <IconButton
            disabled={!hasThread}
            variant="ghost"
            label="Open emoji picker"
            className="w-10 px-0"
          >
            <Smile className="h-4 w-4" />
          </IconButton>

          <IconButton
            disabled={!hasThread}
            variant="ghost"
            label="Add note or attachment"
            className="w-10 px-0"
          >
            <Plus className="h-4 w-4" />
          </IconButton>

          {handoffActive ? (
            <PillButton
              onClick={onReleaseHandoff}
              disabled={releasing}
              label="Release handoff"
            >
              <Bot className="h-3.5 w-3.5" />
              <span>{releasing ? "Releasing..." : "Release AI"}</span>
            </PillButton>
          ) : null}
        </div>

        <div className="rounded-[32px] bg-white/88 px-5 py-4 shadow-[0_12px_28px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/70 backdrop-blur-sm">
          <div className="flex items-end gap-3">
            <textarea
              value={replyText}
              onChange={(event) => setReplyText(event.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!hasThread || sending}
              rows={1}
              placeholder={
                hasThread
                  ? "Message..."
                  : "Select a conversation to reply..."
              }
              aria-label={
                hasThread ? "Reply to conversation" : "Select a conversation first"
              }
              className="max-h-32 min-h-[52px] flex-1 resize-none border-none bg-transparent px-0 py-2 text-[15px] leading-6 text-slate-900 shadow-none outline-none placeholder:text-slate-400 focus:outline-none focus:ring-0"
            />

            <IconButton
              onClick={onSend}
              disabled={!hasThread || !replyText.trim() || sending}
              variant="accent"
              label={sending ? "Sending operator reply" : "Send operator reply"}
              className="h-11 w-11 shrink-0 px-0 shadow-[0_10px_22px_rgba(77,138,230,0.26)]"
            >
              <Send className="h-4 w-4" />
            </IconButton>
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
    return <div className="bg-[#f6f6f7] px-6 pb-5 pt-2">{content}</div>;
  }

  return <section className="bg-[#f6f6f7] px-6 pb-5 pt-2">{content}</section>;
}