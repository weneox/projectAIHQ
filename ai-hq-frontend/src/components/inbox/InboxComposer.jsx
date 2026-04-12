import { Bot, Plus, Send, Smile, Sparkles } from "lucide-react";
import SurfaceBanner from "../feedback/SurfaceBanner.jsx";
import Button from "../ui/Button.jsx";
import { Textarea } from "../ui/Input.jsx";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function shouldRenderSurfaceBanner(surface) {
  return Boolean(
    surface?.saveSuccess ||
      surface?.saveError ||
      surface?.unavailable ||
      (!surface?.unavailable && surface?.error)
  );
}

function InboxAutomationToggle({
  automationControl,
  onToggle,
}) {
  const loading = automationControl?.loading;
  const saving = automationControl?.saving;
  const enabled = automationControl?.enabled === true;
  const disabled = automationControl?.disabled === true;

  const helperText = loading
    ? "Checking inbox automation posture..."
    : saving
      ? "Updating inbox automation..."
      : enabled
        ? "Automatic OpenAI replies are enabled for inbox automation."
        : "Inbox is in operator-only mode. Automatic OpenAI replies are off.";

  return (
    <div className="rounded-[18px] border border-line bg-surface px-4 py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-text">
              OpenAI auto-reply
            </span>

            <span
              className={[
                "inline-flex items-center rounded-pill px-2.5 py-1 text-[11px] font-medium",
                enabled
                  ? "bg-[rgba(var(--color-success),0.12)] text-[rgb(var(--color-success))]"
                  : "bg-[rgba(var(--color-warning),0.14)] text-[rgb(var(--color-warning))]",
              ].join(" ")}
            >
              {s(automationControl?.statusLabel, enabled ? "Enabled" : "Disabled")}
            </span>
          </div>

          <p className="mt-1 text-[12px] leading-5 text-text-muted">
            {helperText}
          </p>

          {s(automationControl?.disabledReason) ? (
            <p className="mt-1 text-[12px] leading-5 text-warning">
              {automationControl.disabledReason}
            </p>
          ) : null}

          {s(automationControl?.saveError) ? (
            <p className="mt-1 text-[12px] leading-5 text-danger">
              {automationControl.saveError}
            </p>
          ) : null}

          {s(automationControl?.saveSuccess) ? (
            <p className="mt-1 text-[12px] leading-5 text-success">
              {automationControl.saveSuccess}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={
            enabled
              ? "Disable OpenAI automatic replies for inbox"
              : "Enable OpenAI automatic replies for inbox"
          }
          onClick={() => {
            if (disabled || loading || saving) return;
            onToggle?.(!enabled);
          }}
          disabled={disabled || loading || saving}
          className={[
            "relative inline-flex h-8 w-[56px] shrink-0 items-center rounded-full border transition-all duration-base ease-premium",
            enabled
              ? "border-brand bg-brand"
              : "border-line-strong bg-surface-subtle",
            disabled || loading || saving ? "cursor-not-allowed opacity-60" : "",
          ].join(" ")}
        >
          <span
            className={[
              "inline-block h-6 w-6 rounded-full bg-white shadow-[0_8px_20px_-12px_rgba(15,23,42,0.45)] transition-transform duration-base ease-premium",
              enabled ? "translate-x-[26px]" : "translate-x-[3px]",
            ].join(" ")}
          />
        </button>
      </div>
    </div>
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
  automationControl,
  onToggleAutomation,
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

      <InboxAutomationToggle
        automationControl={automationControl}
        onToggle={onToggleAutomation}
      />

      <div className="rounded-[18px] border border-line bg-surface px-4 py-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
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

        <div className="flex items-end gap-3">
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
            textClassName="max-h-[128px] min-h-[72px] resize-none"
          />

          <Button
            onClick={onSend}
            disabled={!hasThread || !replyText.trim() || sending}
            isLoading={sending}
            size="icon"
            aria-label={sending ? "Sending operator reply" : "Send operator reply"}
            className="h-11 w-11 shrink-0"
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
  automationControl = null,
  onToggleAutomation = null,
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
      automationControl={automationControl}
      onToggleAutomation={onToggleAutomation}
    />
  );

  if (embedded) {
    return (
      <div className="border-t border-line-soft bg-surface-muted px-4 py-3">
        {content}
      </div>
    );
  }

  return (
    <section className="border-t border-line-soft bg-surface-muted px-4 py-3">
      {content}
    </section>
  );
}