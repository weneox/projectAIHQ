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
      "border-cyan-200 bg-cyan-50 text-cyan-900 hover:border-cyan-300 hover:bg-cyan-100",
    violet:
      "border-slate-900 bg-slate-900 text-white hover:border-slate-950 hover:bg-slate-950",
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

export default function InboxComposer({
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
    <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/88 shadow-[0_18px_40px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-200/80 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
            <Send className="h-4 w-4 text-slate-600" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Response zone
            </div>
            <div className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
              Operator reply
            </div>
            <div className="mt-1 text-sm text-slate-500">
              A clean action strip for human response, handoff release, and future AI assist modules.
            </div>
          </div>
        </div>

        {hasThread ? (
          <div className="mt-4">
            <SettingsSurfaceBanner
              surface={surface}
              unavailableMessage="Operator reply controls are temporarily unavailable."
              refreshLabel="Refresh reply controls"
            />
          </div>
        ) : null}
      </div>

      <div className="px-5 py-4">
        <div className="rounded-2xl border border-slate-200 bg-[#fbfcfd] p-4">
          {!hasThread ? (
            <div className="mb-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
              <div className="text-sm font-medium text-slate-700">Composer placeholder</div>
              <div className="mt-2 text-sm leading-6 text-slate-500">
                AI assist / operator controls will live here after a conversation is selected.
              </div>
            </div>
          ) : null}

          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            disabled={!hasThread || sending}
            placeholder={hasThread ? "Reply as operator..." : "Select a thread first..."}
            className="min-h-[132px] w-full resize-none rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] text-slate-500">
              {hasThread
                ? "Operator-authored response. Delivery confirmation remains separate from send acceptance."
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
        </div>
      </div>
    </section>
  );
}
