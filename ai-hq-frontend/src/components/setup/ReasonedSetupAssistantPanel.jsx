import { useMemo } from "react";
import {
  ArrowRight,
  Brain,
  CircleAlert,
  Loader2,
  MessagesSquare,
  RefreshCcw,
  Sparkles,
} from "lucide-react";

import Button from "../ui/Button.jsx";
import {
  InlineNotice,
  LoadingSurface,
} from "../ui/AppShellPrimitives.jsx";
import { cx } from "../../lib/cx.js";
import { useSetupAssistant } from "../../hooks/useSetupAssistant.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function compactSentence(value = "", fallback = "") {
  const text = s(value);
  if (!text) return s(fallback);
  return text.replace(/\s+/g, " ").trim();
}

function FactRow({ label, value }) {
  if (!s(value)) return null;

  return (
    <div className="flex flex-wrap items-start gap-x-2 gap-y-1 text-[13px] leading-6">
      <span className="font-medium text-text">{label}</span>
      <span className="text-text-muted">{value}</span>
    </div>
  );
}

function FactList({ businessFacts = {} }) {
  const facts = obj(businessFacts);

  const serviceValue = arr(facts.services).join(", ");
  const hoursValue = arr(facts.hours).join(" · ");
  const pricingValue =
    s(facts.pricingPolicy) || arr(facts.pricingHints).join(" | ");
  const languageValue = arr(facts.languages).join(", ");

  const contactValue = [
    s(facts.primaryPhone),
    s(facts.primaryEmail),
    s(facts.primaryAddress),
  ]
    .filter(Boolean)
    .join(" · ");

  const faqValue = arr(facts.faqQuestions).slice(0, 3).join(" · ");

  return (
    <div className="space-y-2">
      <FactRow label="Business" value={facts.companyName} />
      <FactRow label="Services" value={serviceValue} />
      <FactRow label="Pricing" value={pricingValue} />
      <FactRow label="Contact" value={contactValue} />
      <FactRow label="Hours" value={hoursValue} />
      <FactRow label="Language" value={languageValue} />
      <FactRow label="FAQ seeds" value={faqValue} />
    </div>
  );
}

function UnknownList({ unknowns = [] }) {
  const items = arr(unknowns).filter(Boolean);
  if (!items.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-black/8 bg-white/72 px-2.5 py-1 text-[12px] font-medium text-text-muted"
        >
          {item.replace(/_/g, " ")}
        </span>
      ))}
    </div>
  );
}

function QueueList({ followupQueue = [], currentKey = "" }) {
  const items = arr(followupQueue);
  if (!items.length) return null;

  return (
    <div className="space-y-2">
      {items.slice(0, 4).map((item, index) => {
        const active = s(item.key) === s(currentKey) || index === 0;

        return (
          <div
            key={item.key || index}
            className={cx(
              "grid grid-cols-[20px_minmax(0,1fr)] gap-3 rounded-[18px] border px-3 py-3 transition-colors",
              active
                ? "border-brand/18 bg-brand/[0.06]"
                : "border-black/6 bg-white/58"
            )}
          >
            <div className="pt-0.5">
              {active ? (
                <MessagesSquare className="h-4 w-4 text-brand" />
              ) : (
                <span className="text-[12px] font-semibold text-text-subtle">
                  {String(index + 1).padStart(2, "0")}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <div className="text-[13px] font-medium leading-6 text-text">
                {compactSentence(item.question)}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-text-subtle">
                {s(item.category) ? <span>{item.category}</span> : null}
                {s(item.reason) ? <span>· {item.reason}</span> : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PanelHeader({
  phase = "",
  unresolvedCount = 0,
  followupCount = 0,
  onRefresh,
  isRefreshing = false,
}) {
  const title =
    phase === "ready_for_review"
      ? "Setup draft is ready for review"
      : "Setup assistant is refining the draft";

  const meta =
    phase === "ready_for_review"
      ? "No more clarification is required from the current draft."
      : unresolvedCount === 1
        ? "1 unresolved area is still blocking a cleaner business brain."
        : `${unresolvedCount} unresolved areas are still blocking a cleaner business brain.`;

  return (
    <div className="flex flex-col gap-4 border-b border-black/6 pb-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-brand">
          <Brain className="h-4 w-4" />
          Setup assistant
        </div>

        <h3 className="mt-2 text-[1.05rem] font-semibold tracking-[-0.03em] text-text">
          {title}
        </h3>

        <p className="mt-1 text-[13px] leading-6 text-text-muted">{meta}</p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-subtle">
          <span>Follow-ups {followupCount}</span>
          <span>·</span>
          <span>Unresolved {unresolvedCount}</span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onRefresh}
          disabled={isRefreshing}
          leftIcon={
            isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )
          }
        >
          Refresh
        </Button>
      </div>
    </div>
  );
}

export default function ReasonedSetupAssistantPanel({
  reviewSessionId = "",
  className = "",
}) {
  const assistant = useSetupAssistant({
    enabled: true,
    mode: "turn",
    reviewSessionId,
  });

  const data = assistant.data || {};
  const turn = obj(data.turn);
  const payload = obj(turn.payload || data.assistant);
  const conversationStatus = obj(
    payload.conversationStatus || data.conversationStatus
  );
  const primaryQuestion = obj(
    payload.primaryQuestion || data.primaryQuestion || data.question
  );
  const followupQueue = arr(payload.followupQueue || data.followupQueue);
  const businessFacts = obj(payload.businessFacts || data.businessFacts);
  const reasoningSummary = s(
    payload.reasoningSummary || data.reasoningSummary
  );
  const unknowns = arr(payload.unknowns || data.unknowns);
  const assistantHints = arr(payload.assistantHints || data.assistantHints);
  const guardrails = arr(payload.guardrails || data.guardrails);

  const currentQuestionKey = useMemo(
    () =>
      s(primaryQuestion.key) ||
      s(turn.questionKey) ||
      s(assistant.currentQuestionKey),
    [primaryQuestion.key, turn.questionKey, assistant.currentQuestionKey]
  );

  if (assistant.isLoading) {
    return (
      <section
        className={cx(
          "rounded-[28px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(255,255,255,0.58))] px-5 py-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.28)]",
          className
        )}
      >
        <LoadingSurface
          title="Loading setup assistant"
          description="Reading the current draft and generating the next useful clarification."
        />
      </section>
    );
  }

  if (assistant.isError) {
    return (
      <section
        className={cx(
          "rounded-[28px] border border-danger/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(255,255,255,0.62))] px-5 py-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.28)]",
          className
        )}
      >
        <InlineNotice
          tone="danger"
          title="Setup assistant is unavailable"
          description={compactSentence(
            assistant.error?.message,
            "The assistant state could not be loaded."
          )}
        />
      </section>
    );
  }

  return (
    <section
      className={cx(
        "rounded-[28px] border border-black/6 bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(255,255,255,0.6))] px-5 py-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.34)] md:px-6",
        className
      )}
    >
      <PanelHeader
        phase={s(conversationStatus.phase)}
        unresolvedCount={Number(conversationStatus.unresolvedCount || 0)}
        followupCount={Number(conversationStatus.followupCount || followupQueue.length || 0)}
        onRefresh={assistant.refresh}
        isRefreshing={assistant.isFetching}
      />

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="min-w-0 space-y-5">
          <div className="rounded-[22px] border border-brand/10 bg-brand/[0.045] px-4 py-4">
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-brand">
              <Sparkles className="h-4 w-4" />
              Current question
            </div>

            <div className="mt-3 text-[16px] font-semibold leading-7 tracking-[-0.02em] text-text">
              {compactSentence(
                primaryQuestion.question || turn.text,
                "No clarification question is needed right now."
              )}
            </div>

            {s(primaryQuestion.reason) ? (
              <div className="mt-2 text-[12px] text-text-subtle">
                Why this question: {primaryQuestion.reason}
              </div>
            ) : null}
          </div>

          {reasoningSummary ? (
            <div className="rounded-[22px] border border-black/6 bg-white/62 px-4 py-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                Reasoning summary
              </div>
              <div className="mt-2 text-[14px] leading-7 text-text-muted">
                {reasoningSummary}
              </div>
            </div>
          ) : null}

          <div className="rounded-[22px] border border-black/6 bg-white/62 px-4 py-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
              Known business facts
            </div>
            <div className="mt-3">
              <FactList businessFacts={businessFacts} />
            </div>
          </div>

          {followupQueue.length ? (
            <div className="rounded-[22px] border border-black/6 bg-white/62 px-4 py-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                Follow-up queue
              </div>
              <div className="mt-3">
                <QueueList
                  followupQueue={followupQueue}
                  currentKey={currentQuestionKey}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          {unknowns.length ? (
            <div className="rounded-[22px] border border-warning/12 bg-warning/[0.05] px-4 py-4">
              <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-warning">
                <CircleAlert className="h-4 w-4" />
                Unknowns
              </div>

              <div className="mt-3">
                <UnknownList unknowns={unknowns} />
              </div>
            </div>
          ) : null}

          {assistantHints.length ? (
            <div className="rounded-[22px] border border-black/6 bg-white/62 px-4 py-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                Assistant hints
              </div>

              <div className="mt-3 space-y-2">
                {assistantHints.slice(0, 6).map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className="text-[13px] leading-6 text-text-muted"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {guardrails.length ? (
            <div className="rounded-[22px] border border-black/6 bg-white/62 px-4 py-4">
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                Guardrails
              </div>

              <div className="mt-3 space-y-2">
                {guardrails.slice(0, 6).map((item, index) => (
                  <div
                    key={`${item}-${index}`}
                    className="text-[13px] leading-6 text-text-muted"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-[22px] border border-black/6 bg-white/62 px-4 py-4">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
              Next
            </div>

            <div className="mt-2 text-[14px] leading-7 text-text-muted">
              Use this panel as the source of truth for what the setup assistant
              should ask next. It should not jump back to generic website,
              pricing, or service questions if they are already resolved here.
            </div>

            <div className="mt-4">
              <Button
                type="button"
                variant="secondary"
                rightIcon={<ArrowRight className="h-4 w-4" />}
                onClick={assistant.refresh}
              >
                Re-evaluate draft
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}