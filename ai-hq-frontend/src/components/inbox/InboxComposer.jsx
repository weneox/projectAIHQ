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
      "border-[#dfe9ea] bg-[#f2fbfb] text-cyan-900 hover:border-[#cde0e2] hover:bg-[#ebf8f8]",
    violet:
      "border-[#e6def1] bg-[#f7f3fc] text-violet-900 hover:border-[#d9cdea] hover:bg-[#f1ebfa]",
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
    <div className="rounded-[30px] border border-[#ece2d3] bg-[#fffdf9]/92 p-5 shadow-[0_18px_44px_rgba(120,102,73,0.08)]">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e8decf] bg-[#fffaf4]">
          <Send className="h-4 w-4 text-stone-600" />
        </div>
        <div>
          <div className="text-[16px] font-semibold tracking-[-0.03em] text-stone-900">
            Operator Reply
          </div>
          <div className="mt-1 text-sm text-stone-500">
            Use this when a human response is needed or handoff should stay operator-controlled.
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

      <div className="mt-5 rounded-[22px] border border-[#ece2d3] bg-[#fffdfa] p-4">
        <textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          disabled={!hasThread || sending}
          placeholder={
            hasThread ? "Reply as operator..." : "Select a thread first..."
          }
          className="min-h-[120px] w-full resize-none rounded-[20px] border border-[#ece2d3] bg-white px-4 py-3 text-sm text-stone-900 outline-none placeholder:text-stone-400 disabled:cursor-not-allowed disabled:opacity-50"
        />

        <div className="mt-4 flex flex-wrap gap-2">
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
  );
}
