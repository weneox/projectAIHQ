import { Bot, Send } from "lucide-react";
import SettingsSurfaceBanner from "../settings/SettingsSurfaceBanner.jsx";

function Button({
  children,
  onClick,
  tone = "default",
  disabled = false,
  icon: Icon,
}) {
  const toneMap = {
    cyan:
      "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-100 hover:border-cyan-400/30 hover:bg-cyan-400/[0.14]",
    violet:
      "border-slate-200/20 bg-white text-slate-950 hover:border-white hover:bg-slate-100",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-full border px-3.5 py-2 text-[12px] font-medium transition",
        toneMap[tone] || toneMap.violet,
        disabled ? "cursor-not-allowed opacity-45" : "",
      ].join(" ")}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
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

  return (
    <>
      {hasThread ? (
        <div className="mb-4">
          <SettingsSurfaceBanner
            surface={surface}
            unavailableMessage="Operator reply controls are temporarily unavailable."
            refreshLabel="Refresh reply controls"
          />
        </div>
      ) : null}

      {!hasThread ? (
        <div className="mb-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-slate-400">
          Channel-aware reply controls will live here once a conversation is selected.
        </div>
      ) : null}

      <textarea
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        disabled={!hasThread || sending}
        placeholder={hasThread ? "Reply as operator..." : "Select a thread first..."}
        className="min-h-[132px] w-full resize-none rounded-[22px] border border-white/10 bg-[#0b1220] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-[12px] text-slate-500">
          {hasThread
            ? "Operator-authored response. Delivery confirmation stays separate from send acceptance."
            : "Select a conversation to enable reply controls."}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            tone="violet"
            icon={Send}
            onClick={onSend}
            disabled={!hasThread || !replyText.trim() || sending}
          >
            {sending ? "Sending..." : "Send operator reply"}
          </Button>

          <Button
            tone="cyan"
            icon={Bot}
            onClick={onReleaseHandoff}
            disabled={!hasThread || !handoffActive || releasing}
          >
            {releasing ? "Releasing..." : "Release handoff"}
          </Button>
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
  if (embedded) {
    return (
      <div className="border-t border-white/8 px-5 py-4">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
            <Send className="h-4 w-4 text-slate-400" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Composer
            </div>
            <div className="mt-1 text-[16px] font-semibold tracking-[-0.02em] text-white">
              Operator reply
            </div>
          </div>
        </div>
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
    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#10192b]">
      <div className="border-b border-white/8 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
            <Send className="h-4 w-4 text-slate-400" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Response zone
            </div>
            <div className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-white">
              Operator reply
            </div>
            <div className="mt-1 text-sm text-slate-400">
              A clean action strip for human response, handoff release, and future AI assist modules.
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 py-4">
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
    </section>
  );
}
