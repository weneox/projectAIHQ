import { Bot, Plus, Send } from "lucide-react";
import SettingsSurfaceBanner from "../settings/SettingsSurfaceBanner.jsx";

function IconButton({
  children,
  onClick,
  disabled = false,
  variant = "default",
}) {
  const variants = {
    default:
      "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950",
    accent:
      "border-transparent bg-[#4d8ae6] text-white hover:bg-[#3f79cf]",
    subtle:
      "border-slate-200 bg-[#f5f7fb] text-slate-600 hover:border-slate-300 hover:text-slate-950",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex h-10 items-center justify-center rounded-full border px-3 transition",
        variants[variant] || variants.default,
        disabled ? "cursor-not-allowed opacity-45" : "",
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

      <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
        <IconButton disabled={!hasThread} variant="subtle">
          <Plus className="h-4 w-4" />
        </IconButton>

        <input
          value={replyText}
          onChange={(event) => setReplyText(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!hasThread || sending}
          placeholder={hasThread ? "Reply to conversation..." : "Select a thread first..."}
          className="h-10 flex-1 border-none bg-transparent px-0 text-[15px] text-slate-900 shadow-none outline-none placeholder:text-slate-400 focus:outline-none focus:ring-0"
        />

        {handoffActive ? (
          <IconButton
            onClick={onReleaseHandoff}
            disabled={releasing}
            variant="subtle"
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
        >
          <Send className="h-4 w-4" />
        </IconButton>
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
  if (embedded) {
    return (
      <div className="border-t border-slate-200/80 px-6 py-4">
        <ComposerBody
          selectedThread={selectedThread}
          surface={surface}
          actionState={actionState}
          replyText={replyText}
          setReplyText={setReplyText}
          onSend={onSend}
          onReleaseHandoff={onReleaseHandoff}
        />
      </div>
    );
  }

  return (
    <section className="border-t border-slate-200/80 px-6 py-4">
      <ComposerBody
        selectedThread={selectedThread}
        surface={surface}
        actionState={actionState}
        replyText={replyText}
        setReplyText={setReplyText}
        onSend={onSend}
        onReleaseHandoff={onReleaseHandoff}
      />
    </section>
  );
}