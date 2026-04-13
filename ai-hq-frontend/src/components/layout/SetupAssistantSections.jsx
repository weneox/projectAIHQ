import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import SetupReviewActivationPanel from "./SetupReviewActivationPanel.jsx";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function compactText(value, max = 120) {
  const text = s(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}...`;
}

function listPreview(items = [], max = 3) {
  const safe = arr(items).map((item) => compactText(item, 60)).filter(Boolean);
  if (!safe.length) return "";
  if (safe.length <= max) return safe.join(", ");
  return `${safe.slice(0, max).join(", ")} +${safe.length - max}`;
}

const SOURCE_OPTIONS = [
  {
    key: "website",
    label: "Website",
    placeholder: "https://example.com",
    actionLabel: "Pull website",
  },
  {
    key: "instagram",
    label: "Instagram",
    placeholder: "https://instagram.com/brand",
    actionLabel: "Use source",
  },
  {
    key: "facebook",
    label: "Facebook",
    placeholder: "https://facebook.com/page",
    actionLabel: "Use source",
  },
  {
    key: "google_maps",
    label: "Google Maps",
    placeholder: "https://maps.google.com/...",
    actionLabel: "Pull map",
  },
  {
    key: "manual",
    label: "Note",
    placeholder:
      "Business name: Luna Smile Studio\nDescription: Cosmetic dentistry in Baku\nHours: Mon-Fri 09:00-18:00",
    actionLabel: "Use note",
    multiline: true,
  },
];

const STEP_META = {
  company: {
    label: "Business name",
    prompt: "Confirm the legal or public business name.",
    placeholder: "Luna Smile Studio",
    options: [],
  },
  description: {
    label: "Short description",
    prompt: "Store one sentence that explains what the business actually does.",
    placeholder: "Cosmetic dentistry, implants, whitening, and family care in Baku.",
    options: [],
  },
  website: {
    label: "Website",
    prompt: "Confirm the main website used as public truth.",
    placeholder: "https://lunasmile.az",
    options: [],
  },
  services: {
    label: "Services",
    prompt: "Capture the services AI is allowed to mention.",
    placeholder: "Smile design, implants, whitening, consultation",
    options: [],
  },
  hours: {
    label: "Opening hours",
    prompt: "Store the hours exactly as customers should hear them.",
    placeholder: "Mon-Fri 09:00-18:00, Sat 10:00-14:00, Sun closed",
    options: ["Mon-Fri 09:00-18:00", "24/7", "Appointment only"],
  },
  pricing: {
    label: "Pricing posture",
    prompt: "State only what is safe to say publicly about pricing.",
    placeholder: "Consultation from 30 AZN. Exact treatment pricing requires a quote.",
    options: [
      "Exact pricing requires a quote.",
      "Consultation from 30 AZN. Exact treatment pricing requires a quote.",
      "Pricing should be handled by an operator.",
    ],
  },
  contacts: {
    label: "Contact routes",
    prompt: "Confirm the public routes customers should be sent to.",
    placeholder: "+994 50 555 12 12, hello@lunasmile.az, WhatsApp",
    options: [],
  },
  handoff: {
    label: "Handoff rules",
    prompt: "State when AI must hand the conversation to a human.",
    placeholder: "Complaints, urgent requests, treatment-specific quotes, payment issues",
    options: [
      "Complaints should be escalated to a human.",
      "Custom quotes should be escalated to a human.",
      "Urgent requests should be escalated to a human.",
    ],
  },
  finalize: {
    label: "Approval",
    prompt: "Approve business truth once the structured draft is clean.",
    placeholder: "",
    options: [],
  },
};

function normalizeStep(value = "") {
  const key = lower(value);
  if (!key) return "";
  if (key === "profile") return "company";
  if (key === "contact") return "contacts";
  return key;
}

function buildMetrics(assistant = {}, reviewPayload = null) {
  const summary = obj(assistant.setupSummary);
  const reviewRoot = obj(reviewPayload?.review || reviewPayload);
  const sectionStatus = obj(summary.sectionStatus);
  const readySections = Object.values(sectionStatus).filter(
    (item) => lower(item?.status) === "ready"
  ).length;
  const blockerCount = Number(
    summary.blockerCount ?? assistant.review?.blockerCount ?? reviewRoot.blockerCount ?? 0
  );

  return {
    readySections,
    blockerCount,
    sectionCount: Object.keys(sectionStatus).length || 8,
  };
}

function buildHoursSummary(hours = []) {
  const active = arr(hours).filter(
    (item) =>
      item?.enabled === true ||
      item?.allDay === true ||
      item?.appointmentOnly === true ||
      item?.closed === true ||
      s(item?.notes)
  );

  if (!active.length) return "";

  return listPreview(
    active.map((item) => {
      if (item.allDay) return `${item.day} 24 hours`;
      if (item.appointmentOnly) return `${item.day} appointment only`;
      if (item.closed) return `${item.day} closed`;
      if (s(item.notes)) return `${item.day} ${item.notes}`;
      return `${item.day} ${s(item.openTime)}-${s(item.closeTime)}`;
    }),
    2
  );
}

function buildPricingSummary(pricing = {}) {
  const source = obj(pricing);
  return compactText(
    source.publicSummary || source.note || source.summary || source.pricingMode,
    120
  );
}

function buildContactsSummary(contacts = []) {
  return listPreview(
    arr(contacts).map((item) => s(item.label || item.type || item.value || item.channel)),
    3
  );
}

function buildHandoffSummary(handoff = {}) {
  const source = obj(handoff);
  return compactText(
    source.summary || arr(source.triggers).join(", ") || source.escalationTarget,
    120
  );
}

function buildCurrentSource(assistant = {}, reviewPayload = null) {
  const sourceMetadata = obj(assistant.draft?.sourceMetadata);
  const bundleSources = arr(reviewPayload?.bundleSources);
  const primaryBundle =
    bundleSources.find((item) => lower(item.role) === "primary") || bundleSources[0];
  const sourceType =
    lower(primaryBundle?.sourceType || sourceMetadata.primarySourceType) || "manual";
  const sourceUrl =
    s(primaryBundle?.sourceUrl || sourceMetadata.primarySourceUrl) ||
    s(assistant.websitePrefill?.websiteUrl);
  const sourceLabel =
    s(primaryBundle?.label || arr(sourceMetadata.sourceLabels)[0]) ||
    (sourceType === "google_maps"
      ? "Google Maps"
      : sourceType === "instagram"
        ? "Instagram"
        : sourceType === "facebook_page" || sourceType === "facebook"
          ? "Facebook"
          : sourceType === "manual"
            ? "Operator note"
            : "Website");

  return {
    type: sourceType,
    label: sourceLabel,
    url: sourceUrl,
    insight: arr(sourceMetadata.evidenceSummary)[0] || "",
  };
}

function buildTruthRows(assistant = {}) {
  const draft = obj(assistant.draft);
  const profile = obj(draft.businessProfile);

  return [
    {
      key: "company",
      label: "Business name",
      value: s(profile.companyName),
      step: "company",
    },
    {
      key: "description",
      label: "Short description",
      value: compactText(profile.description, 140),
      step: "description",
    },
    {
      key: "website",
      label: "Website",
      value: s(profile.websiteUrl),
      step: "website",
    },
    {
      key: "services",
      label: "Services",
      value: listPreview(arr(draft.services).map((item) => s(item.title || item.name || item.label)), 3),
      step: "services",
    },
    {
      key: "hours",
      label: "Opening hours",
      value: buildHoursSummary(draft.hours),
      step: "hours",
    },
    {
      key: "pricing",
      label: "Pricing posture",
      value: buildPricingSummary(draft.pricingPosture),
      step: "pricing",
    },
    {
      key: "contacts",
      label: "Contact routes",
      value: buildContactsSummary(draft.contacts),
      step: "contacts",
    },
    {
      key: "handoff",
      label: "Handoff rules",
      value: buildHandoffSummary(draft.handoffRules),
      step: "handoff",
    },
  ];
}

function getDominantStep(assistant = {}) {
  const completion = obj(assistant.assistant?.completion);
  if (completion.ready === true || assistant.review?.readyForReview === true) {
    return "finalize";
  }

  const nextQuestion = normalizeStep(assistant.assistant?.nextQuestion?.key);
  if (nextQuestion && STEP_META[nextQuestion]) return nextQuestion;

  const firstMissing = buildTruthRows(assistant).find((row) => !s(row.value));
  return firstMissing?.step || "finalize";
}

function getSourcePrefill(type = "", assistant = {}, reviewPayload = null) {
  const currentSource = buildCurrentSource(assistant, reviewPayload);
  const profile = obj(assistant.draft?.businessProfile);

  if (type === "website") {
    return (
      s(assistant.websitePrefill?.websiteUrl) ||
      s(profile.websiteUrl) ||
      (currentSource.type === "website" ? currentSource.url : "")
    );
  }

  if (type === "google_maps" && currentSource.type === "google_maps") {
    return currentSource.url;
  }

  if (
    (type === "instagram" && currentSource.type === "instagram") ||
    (type === "facebook" &&
      ["facebook", "facebook_page"].includes(currentSource.type))
  ) {
    return currentSource.url;
  }

  return "";
}

function SourceInput({
  option,
  value,
  busy,
  onChange,
  onSubmit,
}) {
  if (option.multiline) {
    return (
      <textarea
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={option.placeholder}
        className="min-h-[108px] w-full resize-none border border-line bg-white px-3 py-2 text-[13px] leading-6 text-text outline-none placeholder:text-text-subtle"
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={option.placeholder}
        className="h-11 w-full border border-line bg-white px-3 text-[13px] text-text outline-none placeholder:text-text-subtle"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={!s(value) || busy}
        className="inline-flex h-11 shrink-0 items-center gap-1.5 bg-slate-900 px-3 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        <span>{option.actionLabel}</span>
      </button>
    </div>
  );
}

export default function SetupAssistantSections({
  assistant,
  reviewPayload = null,
  saving = false,
  finalizing = false,
  capturingSource = false,
  errorMessage = "",
  onCaptureSource,
  onParseMessage,
  onFinalize,
}) {
  const metrics = useMemo(
    () => buildMetrics(assistant, reviewPayload),
    [assistant, reviewPayload]
  );
  const currentSource = useMemo(
    () => buildCurrentSource(assistant, reviewPayload),
    [assistant, reviewPayload]
  );
  const truthRows = useMemo(() => buildTruthRows(assistant), [assistant]);
  const [sourceMode, setSourceMode] = useState("website");
  const [sourceInput, setSourceInput] = useState("");
  const [focusStep, setFocusStep] = useState("");
  const [answerInput, setAnswerInput] = useState("");
  const [localError, setLocalError] = useState("");

  const busy = saving || finalizing || capturingSource;
  const activeStep = focusStep || getDominantStep(assistant);
  const activeMeta = STEP_META[activeStep] || STEP_META.company;
  const sourceOption =
    SOURCE_OPTIONS.find((item) => item.key === sourceMode) || SOURCE_OPTIONS[0];
  const blockersLine = arr(assistant.assistant?.confirmationBlockers)
    .slice(0, 3)
    .map((item) => s(item.label || item.title))
    .filter(Boolean)
    .join(", ");

  useEffect(() => {
    setSourceInput(getSourcePrefill(sourceMode, assistant, reviewPayload));
  }, [assistant, reviewPayload, sourceMode]);

  async function handleSourceSubmit() {
    if (!s(sourceInput) || busy) return;
    setLocalError("");
    try {
      await onCaptureSource?.({ type: sourceMode, value: sourceInput });
      if (sourceMode === "manual") {
        setFocusStep(getDominantStep(assistant));
      }
    } catch (error) {
      setLocalError(s(error?.message, "Source intake failed."));
    }
  }

  async function handleAnswerSubmit(value = answerInput) {
    const text = s(value);
    if (!text || busy) return;
    setLocalError("");
    try {
      await onParseMessage?.({
        step: activeStep,
        text,
      });
      setAnswerInput("");
      setFocusStep("");
    } catch (error) {
      setLocalError(s(error?.message, "The draft could not be updated."));
    }
  }

  async function handleFinalize() {
    if (busy) return;
    setLocalError("");
    try {
      await onFinalize?.();
    } catch (error) {
      setLocalError(s(error?.message, "Business truth could not be approved."));
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="border-b border-line px-4 py-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-text-muted">
              Business truth
            </div>
            <div className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-text">
              Source-first intake
            </div>
          </div>

          <div className="text-right">
            <div className="text-[18px] font-semibold tracking-[-0.03em] text-text">
              {metrics.readySections}/{metrics.sectionCount}
            </div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
              ready
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {SOURCE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`inline-flex h-8 items-center px-2.5 text-[12px] font-semibold ${
                sourceMode === option.key
                  ? "bg-slate-900 text-white"
                  : "border border-line bg-surface text-text-muted"
              }`}
              onClick={() => {
                setSourceMode(option.key);
                setLocalError("");
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-4 border border-line bg-surface px-3 py-3">
          <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-muted">
                Active source
              </div>
              <div className="mt-1 text-[13px] font-semibold text-text">
                {currentSource.label}
              </div>
            </div>

            {s(currentSource.url) ? (
              <div className="max-w-[55%] truncate text-[12px] text-text-muted">
                {currentSource.url}
              </div>
            ) : null}
          </div>

          {s(currentSource.insight) ? (
            <div className="pt-3 text-[12px] leading-5 text-text-muted">
              {currentSource.insight}
            </div>
          ) : null}

          <div className="pt-3">
            <SourceInput
              option={sourceOption}
              value={sourceInput}
              busy={capturingSource}
              onChange={setSourceInput}
              onSubmit={handleSourceSubmit}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 pb-6 pt-4">
        {s(localError || errorMessage) ? (
          <div className="border border-[rgba(var(--color-danger),0.18)] bg-danger-soft px-3 py-2 text-[12px] leading-5 text-danger">
            {localError || errorMessage}
          </div>
        ) : null}

        <SetupReviewActivationPanel
          reviewPayload={reviewPayload}
          assistantReview={assistant.review}
          onFinalize={onFinalize ? handleFinalize : undefined}
          finalizing={finalizing}
        />

        <section className="border-b border-line py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-muted">
                Now confirming
              </div>
              <div className="mt-1 text-[16px] font-semibold tracking-[-0.02em] text-text">
                {activeMeta.label}
              </div>
              <div className="mt-1 text-[12px] leading-5 text-text-muted">
                {activeMeta.prompt}
              </div>
            </div>

            {metrics.blockerCount > 0 ? (
              <div className="text-right">
                <div className="text-[16px] font-semibold tracking-[-0.02em] text-text">
                  {metrics.blockerCount}
                </div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-text-muted">
                  open
                </div>
              </div>
            ) : null}
          </div>

          {s(blockersLine) ? (
            <div className="mt-3 text-[12px] leading-5 text-text-muted">
              Waiting on: {blockersLine}
            </div>
          ) : null}

          {activeStep === "finalize" ? (
            <div className="mt-4 flex items-center justify-between gap-3 border border-line bg-surface px-3 py-3">
              <div className="text-[13px] leading-6 text-text">
                Approve business truth and refresh the governed runtime.
              </div>
              <button
                type="button"
                onClick={handleFinalize}
                disabled={busy}
                className="inline-flex h-10 items-center gap-1.5 bg-slate-900 px-3 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                {finalizing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                <span>Approve truth</span>
              </button>
            </div>
          ) : (
            <>
              {activeMeta.options.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {activeMeta.options.map((option) => (
                    <button
                      key={option}
                      type="button"
                      disabled={busy}
                      className="inline-flex h-8 items-center border border-line bg-white px-2.5 text-[12px] font-semibold text-text disabled:cursor-not-allowed disabled:opacity-45"
                      onClick={() => handleAnswerSubmit(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 flex items-end gap-2">
                <textarea
                  rows={3}
                  value={answerInput}
                  onChange={(event) => setAnswerInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleAnswerSubmit();
                    }
                  }}
                  placeholder={activeMeta.placeholder}
                  className="min-h-[88px] w-full resize-none border border-line bg-white px-3 py-2 text-[13px] leading-6 text-text outline-none placeholder:text-text-subtle"
                />
                <button
                  type="button"
                  onClick={() => handleAnswerSubmit()}
                  disabled={!s(answerInput) || busy}
                  className="inline-flex h-11 shrink-0 items-center gap-1.5 bg-slate-900 px-3 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  <span>Store</span>
                </button>
              </div>
            </>
          )}
        </section>

        <section className="py-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-text-muted">
            Draft ledger
          </div>
          <div className="mt-3 border border-line">
            {truthRows.map((row) => {
              const filled = Boolean(s(row.value));
              const active = row.step === activeStep;

              return (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => setFocusStep(row.step)}
                  className={`flex w-full items-start justify-between gap-4 border-b border-line px-3 py-3 text-left last:border-b-0 ${
                    active ? "bg-surface" : "bg-white"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-text-muted">
                      {row.label}
                    </div>
                    <div className="mt-1 text-[13px] leading-6 text-text">
                      {row.value || "Pending"}
                    </div>
                  </div>

                  <div className="mt-[2px] shrink-0">
                    {filled ? (
                      <span className="inline-flex h-7 w-7 items-center justify-center border border-line bg-surface text-text">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span className="inline-flex h-7 items-center gap-1 text-[12px] font-semibold text-text-muted">
                        <span>Edit</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
