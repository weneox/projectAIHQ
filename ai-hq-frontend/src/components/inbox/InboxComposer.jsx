import { Bot, Plus, Send } from "lucide-react";
import SettingsSurfaceBanner from "../settings/SettingsSurfaceBanner.jsx";

function IconButton({
  children,
  onClick,
  disabled = false,
  variant = "default",
  label = "",
}) {
  const variants = {
    default:
      "border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950",
    accent:
      "border-transparent bg-[#4d8ae6] text-white hover:bg-[#3f79cf]",
    subtle:
      "border-slate-200/80 bg-[#f7f8fb] text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-950",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label || undefined}
      title={label || undefined}
      className={[
        "inline-flex h-10 items-center justify-center rounded-full border px-3 transition disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant] || variants.default,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function hasSurfaceFeedback(surface) {
  const safe = surface && typeof surface === "object" ? surface : {};
  return Boolean(
    safe.unavailable ||
      safe.error ||
      safe.message ||
      safe.saveError ||
      safe.saveSuccess ||
      safe.successMessage ||
      safe.errorMessage ||
      safe.availability === "unavailable"
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
  const showBanner = hasThread && hasSurfaceFeedback(surface);

  function handleKeyDown(event) {
    if (event.key !== "Enter") return;
    if (event.shiftKey) return;
    event.preventDefault();
    if (!hasThread || !replyText.trim() || sending) return;
    onSend?.();
  }

  return (
    <>
      {showBanner ? (
        <div className="mb-3">
          <SettingsSurfaceBanner
            surface={surface}
            unavailableMessage="Operator reply controls are temporarily unavailable."
            refreshLabel="Refresh reply controls"
          />
        </div>
      ) : null}

      <div className="rounded-[28px] border border-slate-200/80 bg-white/98 px-3 py-2 shadow-[0_10px_28px_rgba(15,23,42,0.05)]">
        <div className="flex items-center gap-3">
          <IconButton
            disabled={!hasThread}
            variant="subtle"
            label="Add note or attachment"
          >
            <Plus className="h-4 w-4" />
          </IconButton>

          <input
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!hasThread || sending}
            placeholder={
              hasThread ? "Reply to conversation..." : "Select a thread first..."
            }
            aria-label={hasThread ? "Reply to conversation" : "Select a thread first"}
            className="h-11 flex-1 border-none bg-transparent px-0 text-[15px] text-slate-900 shadow-none outline-none placeholder:text-slate-400 focus:outline-none focus:ring-0"
          />

          {handoffActive ? (
            <IconButton
              onClick={onReleaseHandoff}
              disabled={releasing}
              variant="subtle"
              label="Release handoff"
            >
              <Bot className="h-4 w-4" />
              <span className="ml-1 text-[12px] font-medium">
                {releasing ? "Releasing..." : "Release"}
              </span>
            </IconButton>
          ) : null}

          <IconButton
            onClick={onSend}
            disabled={!hasThread || !replyText.trim() || sending}
            variant="accent"
            label={sending ? "Sending operator reply" : "Send operator reply"}
          >
            <Send className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </>
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
      <div className="border-t border-slate-200/70 bg-white px-6 py-4">
        {content}
      </div>
    );
  }

  return (
    <section className="border-t border-slate-200/70 bg-white px-6 py-4">
      {content}
    </section>
  );
}