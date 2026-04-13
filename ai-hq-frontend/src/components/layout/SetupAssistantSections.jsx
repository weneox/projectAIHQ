import { useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import SetupReviewActivationPanel from "./SetupReviewActivationPanel.jsx";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lower(value, fallback = "") {
  return s(value ?? fallback).toLowerCase();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function compactText(value, max = 160) {
  const text = s(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}...`;
}

function listPreview(items = [], max = 4) {
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
    actionLabel: "Use source",
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
    actionLabel: "Use source",
  },
  {
    key: "manual",
    label: "Manual note",
    placeholder:
      "Qadın gözəllik salonudur. Əsas xidmətlər saç baxımı, kəsim, dırnaq xidməti və makiyajdır.",
    actionLabel: "Use note",
    multiline: true,
  },
];

const QUESTION_META = {
  company: {
    title: "Business name",
    prompt: "Bu biznesin public adı necə görünməlidir?",
    placeholder: "Məsələn: Saytpro",
    quickAnswers: [],
  },
  description: {
    title: "What the business is",
    prompt: "Bu biznesi bir-iki cümlə ilə necə təqdim etməliyəm?",
    placeholder:
      "Məsələn: Website hazırlanması, reklam və branding xidmətləri göstərən digital şirkət",
    quickAnswers: [],
  },
  website: {
    title: "Main website",
    prompt: "Əsas public website hansıdır?",
    placeholder: "https://example.com",
    quickAnswers: [],
  },
  services: {
    title: "Core services",
    prompt: "Əsas xidmətləri sadalayın.",
    placeholder: "Website hazırlanması, reklam, branding...",
    quickAnswers: [],
  },
  hours: {
    title: "Opening hours",
    prompt: "Müştəriyə hansı iş saatları deyilməlidir?",
    placeholder: "B.e.-C. 10:00-19:00",
    quickAnswers: ["24/7", "Appointment only", "Mon-Fri 10:00-19:00"],
  },
  pricing: {
    title: "Pricing posture",
    prompt: "Qiymət necə təqdim olunmalıdır?",
    placeholder:
      "Qiymətlər xidmətə görə dəyişir. Dəqiq qiymət üçün müraciət edin.",
    quickAnswers: [
      "Qiymətlər xidmətə görə dəyişir.",
      "Dəqiq qiymət üçün müraciət edilməlidir.",
      "Qiymət operator tərəfindən paylaşılmalıdır.",
    ],
  },
  contacts: {
    title: "Contact routes",
    prompt: "Müştəri hansı əlaqə yollarına yönləndirilməlidir?",
    placeholder: "+994..., WhatsApp, Instagram DM, email...",
    quickAnswers: [],
  },
  handoff: {
    title: "Human handoff",
    prompt: "AI hansı hallarda mütləq insana ötürməlidir?",
    placeholder:
      "Şikayət, fərdi qiymət sorğusu, təcili müraciət, ödəniş problemi",
    quickAnswers: [
      "Şikayətlər insana ötürülsün.",
      "Fərdi qiymət sorğuları insana ötürülsün.",
      "Təcili hallarda insana ötürülsün.",
    ],
  },
};

function normalizeQuestionKey(value = "") {
  const key = lower(value);
  if (!key) return "";
  if (key === "profile") return "company";
  if (key === "contact") return "contacts";
  return key;
}

function buildCurrentSource(assistant = {}, reviewPayload = null) {
  const sourceMetadata = obj(assistant.draft?.sourceMetadata);
  const bundleSources = arr(reviewPayload?.bundleSources);
  const primaryBundle =
    bundleSources.find((item) => lower(item.role) === "primary") ||
    bundleSources[0];

  const sourceType =
    lower(primaryBundle?.sourceType || sourceMetadata.primarySourceType) || "";
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
            ? "Manual note"
            : sourceType === "website"
              ? "Website"
              : "");

  return {
    type: sourceType,
    label: sourceLabel,
    url: sourceUrl,
    insight: arr(sourceMetadata.evidenceSummary)[0] || "",
    hasSource: Boolean(sourceType || sourceUrl || sourceLabel),
  };
}

function buildDraftModel(assistant = {}, reviewPayload = null) {
  const review = obj(reviewPayload?.review || reviewPayload);
  const draft = Object.keys(obj(review.draft)).length
    ? obj(review.draft)
    : obj(assistant.draft);
  const profile = obj(draft.businessProfile);

  const services = arr(draft.services)
    .map((item) => s(item.title || item.name || item.label))
    .filter(Boolean);

  const contacts = arr(draft.contacts)
    .map((item) => s(item.label || item.channel || item.value || item.type))
    .filter(Boolean);

  const hours = arr(profile.hours).length
    ? arr(profile.hours).map((item) => s(item))
    : arr(draft.hours)
        .map((item) => {
          if (item?.allDay) return `${item.day} 24 hours`;
          if (item?.appointmentOnly) return `${item.day} appointment only`;
          if (item?.closed) return `${item.day} closed`;
          if (s(item?.notes)) return `${item.day} ${s(item.notes)}`;
          if (s(item?.openTime) || s(item?.closeTime)) {
            return `${item.day} ${s(item.openTime)}-${s(item.closeTime)}`;
          }
          return "";
        })
        .filter(Boolean);

  const pricing =
    s(profile.pricingPolicy) ||
    s(draft.pricingPosture?.publicSummary) ||
    s(draft.pricingPosture?.note) ||
    s(draft.pricingPosture?.summary);

  const handoff =
    s(draft.handoffRules?.summary) ||
    listPreview(arr(draft.handoffRules?.triggers), 3) ||
    s(draft.handoffRules?.escalationTarget);

  const audience =
    s(profile.targetAudience) ||
    s(profile.audience) ||
    s(profile.customerType) ||
    s(profile.customerTypes);

  const description =
    s(profile.description) ||
    s(profile.companySummaryShort) ||
    s(profile.companySummary);

  const model = {
    name: s(profile.companyName || profile.displayName),
    description,
    website: s(profile.websiteUrl),
    coreOffer: services[0] || "",
    additionalServices: services.slice(1),
    audience,
    contacts: [
      s(profile.primaryPhone),
      s(profile.primaryEmail),
      s(profile.primaryAddress),
      ...contacts,
    ].filter(Boolean),
    hours,
    pricing,
    handoff,
    serviceList: services,
  };

  model.fieldCount = [
    model.name,
    model.description,
    model.website,
    model.coreOffer,
    model.audience,
    model.contacts.length ? "contacts" : "",
    model.hours.length ? "hours" : "",
    model.pricing,
    model.handoff,
  ].filter(Boolean).length;

  return model;
}

function buildQuestionState(assistant = {}, draftModel = {}) {
  const nextQuestion = normalizeQuestionKey(assistant.assistant?.nextQuestion?.key);

  if (nextQuestion && QUESTION_META[nextQuestion]) {
    return {
      key: nextQuestion,
      ...QUESTION_META[nextQuestion],
    };
  }

  if (!s(draftModel.name)) return { key: "company", ...QUESTION_META.company };
  if (!s(draftModel.description)) {
    return { key: "description", ...QUESTION_META.description };
  }
  if (!draftModel.serviceList?.length) {
    return { key: "services", ...QUESTION_META.services };
  }
  if (!s(draftModel.pricing)) return { key: "pricing", ...QUESTION_META.pricing };
  if (!draftModel.contacts?.length) {
    return { key: "contacts", ...QUESTION_META.contacts };
  }
  if (!s(draftModel.handoff)) return { key: "handoff", ...QUESTION_META.handoff };

  return null;
}

function buildInterviewSummary(source = {}, draftModel = {}) {
  const lines = [];

  if (source.label || source.url) {
    lines.push(
      source.url
        ? `${source.label || "Source"} qəbul olundu: ${source.url}`
        : `${source.label || "Source"} qəbul olundu.`
    );
  }

  if (draftModel.name) {
    lines.push(`Hazırda gördüyüm brend adı: ${draftModel.name}`);
  }

  if (draftModel.description) {
    lines.push(`İlkin anlayış: ${compactText(draftModel.description, 120)}`);
  }

  if (draftModel.serviceList?.length) {
    lines.push(`Görünən xidmətlər: ${listPreview(draftModel.serviceList, 4)}`);
  }

  if (!lines.length) {
    lines.push("Mən source-dan siqnalları yığıram və business draft qururam.");
  }

  return lines;
}

function getSourcePrefillValue(mode = "", source = {}, assistant = {}, draftModel = {}) {
  if (mode === "website") {
    return s(assistant.websitePrefill?.websiteUrl || draftModel.website);
  }

  if (mode === "google_maps" && lower(source.type) === "google_maps" && source.url) {
    return source.url;
  }

  if (mode === "instagram" && lower(source.type) === "instagram" && source.url) {
    return source.url;
  }

  if (
    mode === "facebook" &&
    ["facebook", "facebook_page"].includes(lower(source.type)) &&
    source.url
  ) {
    return source.url;
  }

  return "";
}

function SourceComposer({
  option,
  value,
  busy,
  onChange,
  onSubmit,
}) {
  if (option.multiline) {
    return (
      <div className="space-y-3">
        <textarea
          rows={5}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={option.placeholder}
          className="min-h-[128px] w-full resize-none border-b border-[rgba(15,23,42,0.12)] bg-transparent px-0 py-2 text-[14px] leading-7 text-text outline-none placeholder:text-text-subtle"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={!s(value) || busy}
          className="inline-flex h-10 items-center gap-2 bg-slate-950 px-3.5 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          <span>{option.actionLabel}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-3 border-b border-[rgba(15,23,42,0.12)] py-2">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={option.placeholder}
        className="h-11 w-full bg-transparent px-0 text-[14px] text-text outline-none placeholder:text-text-subtle"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={!s(value) || busy}
        className="inline-flex h-10 shrink-0 items-center gap-2 bg-slate-950 px-3.5 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
      >
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
        <span>{option.actionLabel}</span>
      </button>
    </div>
  );
}

function ReplyComposer({
  value,
  busy,
  placeholder,
  onChange,
  onSubmit,
}) {
  return (
    <div className="border-t border-[rgba(15,23,42,0.08)] pt-4">
      <div className="flex items-end gap-3 border-b border-[rgba(15,23,42,0.12)] py-2">
        <textarea
          rows={3}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          placeholder={placeholder}
          className="min-h-[84px] w-full resize-none bg-transparent px-0 py-1 text-[14px] leading-7 text-text outline-none placeholder:text-text-subtle"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={!s(value) || busy}
          className="inline-flex h-10 shrink-0 items-center gap-2 bg-slate-950 px-3.5 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          <span>Continue</span>
        </button>
      </div>
    </div>
  );
}

function AssistantBubble({ eyebrow = "", title = "", body = "", children = null }) {
  return (
    <div className="border border-[rgba(15,23,42,0.06)] bg-[linear-gradient(180deg,rgba(248,250,252,0.82),rgba(255,255,255,0.98))] px-4 py-4 text-text">
      {s(eyebrow) ? (
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
          {eyebrow}
        </div>
      ) : null}
      {s(title) ? (
        <div className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-text">
          {title}
        </div>
      ) : null}
      {s(body) ? (
        <div className="mt-2 whitespace-pre-wrap text-[14px] leading-7 text-text-muted">
          {body}
        </div>
      ) : null}
      {children ? <div className="mt-4">{children}</div> : null}
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
  const source = useMemo(
    () => buildCurrentSource(assistant, reviewPayload),
    [assistant, reviewPayload]
  );

  const draftModel = useMemo(
    () => buildDraftModel(assistant, reviewPayload),
    [assistant, reviewPayload]
  );

  const question = useMemo(
    () => buildQuestionState(assistant, draftModel),
    [assistant, draftModel]
  );

  const [sourceMode, setSourceMode] = useState("website");
  const sessionKey = s(
    assistant.session?.id ||
      assistant.websitePrefill?.websiteUrl ||
      source.url ||
      assistant.draft?.version ||
      "default"
  );
  const [sourceInputState, setSourceInputState] = useState(() => ({
    sessionKey,
    values: {
      website: getSourcePrefillValue("website", source, assistant, draftModel),
    },
  }));
  const [replyInput, setReplyInput] = useState("");
  const [localError, setLocalError] = useState("");

  const busy = saving || finalizing || capturingSource;
  const interviewReady = source.hasSource;
  const draftReady =
    assistant.review?.finalizeAvailable === true ||
    assistant.review?.readyForReview === true ||
    assistant.assistant?.completion?.ready === true ||
    (!question && draftModel.fieldCount >= 3);
  const stage = !interviewReady ? "source" : draftReady ? "draft" : "interview";

  const selectedSource =
    SOURCE_OPTIONS.find((item) => item.key === sourceMode) || SOURCE_OPTIONS[0];

  const resolvedSourceInputState =
    sourceInputState.sessionKey === sessionKey
      ? sourceInputState
      : { sessionKey, values: {} };

  const sourceInput =
    resolvedSourceInputState.values[sourceMode] ??
    getSourcePrefillValue(sourceMode, source, assistant, draftModel);

  function setSourceInput(nextValue) {
    setSourceInputState((prev) => {
      const current =
        prev.sessionKey === sessionKey
          ? prev
          : { sessionKey, values: {} };

      return {
        sessionKey,
        values: {
          ...current.values,
          [sourceMode]: nextValue,
        },
      };
    });
  }

  async function handleSourceSubmit() {
    const value = s(sourceInput);
    if (!value || busy) return;
    setLocalError("");

    try {
      await onCaptureSource?.({
        type: sourceMode,
        value,
      });
      setReplyInput("");
    } catch (error) {
      setLocalError(s(error?.message, "Source intake failed."));
    }
  }

  async function handleReplySubmit() {
    const value = s(replyInput);
    if (!value || busy) return;
    setLocalError("");

    try {
      await onParseMessage?.({
        step: stage === "draft" ? "profile" : question?.key || "profile",
        text: value,
      });
      setReplyInput("");
    } catch (error) {
      setLocalError(s(error?.message, "The draft could not be updated."));
    }
  }

  async function handleQuickAnswer(value = "") {
    if (!s(value) || busy) return;
    setReplyInput(value);
    setLocalError("");

    try {
      await onParseMessage?.({
        step: question?.key || "profile",
        text: value,
      });
      setReplyInput("");
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
      <div className="border-b border-[rgba(15,23,42,0.08)] px-4 pb-4 pt-3">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
          Setup Studio
        </div>
        <div className="mt-1 text-[19px] font-semibold tracking-[-0.04em] text-text">
          {stage === "source"
            ? "Start from one good source"
            : stage === "interview"
              ? "I’m building the business draft"
              : "Review the final draft"}
        </div>
        <div className="mt-2 text-[12px] leading-5 text-text-muted">
          {source.hasSource
            ? source.url
              ? `${source.label || "Source"} · ${source.url}`
              : source.label
            : "Website, social profile, map link, or a short note is enough to begin."}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-4 py-5">
        {s(localError || errorMessage) ? (
          <div className="mb-4 border-l-2 border-[rgba(var(--color-danger),0.78)] bg-danger-soft px-3 py-2 text-[12px] leading-5 text-danger">
            {localError || errorMessage}
          </div>
        ) : null}

        {stage === "source" ? (
          <div className="space-y-5">
            <AssistantBubble
              eyebrow="Setup"
              title="Give me the first signal"
              body="Mən source-ları və cavablarını birləşdirib business draft hazırlayacağam. Hələ xam field-lər doldurmağa ehtiyac yoxdur."
            >
              <div className="flex flex-wrap gap-x-4 gap-y-2 border-b border-[rgba(15,23,42,0.08)] pb-2">
                {SOURCE_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`border-b pb-1 text-[12px] font-semibold transition-colors ${
                      sourceMode === option.key
                        ? "border-slate-900 text-text"
                        : "border-transparent text-text-muted"
                    }`}
                    onClick={() => {
                      const nextMode = option.key;
                      setSourceMode(nextMode);
                      setSourceInputState((prev) => {
                        const current =
                          prev.sessionKey === sessionKey
                            ? prev
                            : { sessionKey, values: {} };

                        return {
                          sessionKey,
                          values: {
                            ...current.values,
                            [nextMode]:
                              current.values[nextMode] ??
                              getSourcePrefillValue(
                                nextMode,
                                source,
                                assistant,
                                draftModel
                              ),
                          },
                        };
                      });
                      setLocalError("");
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <SourceComposer
                  option={selectedSource}
                  value={sourceInput}
                  busy={capturingSource}
                  onChange={setSourceInput}
                  onSubmit={handleSourceSubmit}
                />
              </div>
            </AssistantBubble>
          </div>
        ) : null}

        {stage === "interview" ? (
          <div className="space-y-5">
            <AssistantBubble
              eyebrow="Current understanding"
              title={question?.title || "Next question"}
              body={[
                ...buildInterviewSummary(source, draftModel),
                "",
                question?.prompt || "Mənə növbəti vacib detalı yaz.",
              ]
                .filter(Boolean)
                .join("\n")}
            >
              {arr(question?.quickAnswers).length ? (
                <div className="flex flex-wrap gap-2">
                  {arr(question.quickAnswers).map((option) => (
                    <button
                      key={option}
                      type="button"
                      disabled={busy}
                      className="inline-flex h-8 items-center border border-[rgba(15,23,42,0.08)] bg-white px-2.5 text-[12px] font-semibold text-text disabled:cursor-not-allowed disabled:opacity-45"
                      onClick={() => handleQuickAnswer(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : null}
            </AssistantBubble>

            {busy ? (
              <AssistantBubble
                eyebrow="Thinking"
                title="I’m updating the draft"
                body="Source siqnalları və sənin cavabın birləşdirilir."
              />
            ) : null}

            <ReplyComposer
              value={replyInput}
              busy={busy}
              placeholder={question?.placeholder || "Cavabını yaz"}
              onChange={setReplyInput}
              onSubmit={handleReplySubmit}
            />
          </div>
        ) : null}

        {stage === "draft" ? (
          <div className="space-y-5">
            <SetupReviewActivationPanel
              reviewPayload={reviewPayload}
              assistantReview={assistant.review}
              onFinalize={onFinalize ? handleFinalize : undefined}
              finalizing={finalizing}
            />

            <AssistantBubble
              eyebrow="Refine"
              title="Dəyişiklik istəyirsənsə mənə yaz"
              body="Məsələn: əsas xidməti dəyiş, branding-i sil, pricing hissəsini yumşalt, bizi software partner kimi göstər."
            />

            {busy ? (
              <AssistantBubble
                eyebrow="Thinking"
                title="I’m rebuilding the draft"
                body="Source-lar, əvvəlki cavablar və yeni düzəliş birləşdirilir."
              />
            ) : null}

            <ReplyComposer
              value={replyInput}
              busy={busy}
              placeholder="Nəyi dəyişmək istədiyini yaz"
              onChange={setReplyInput}
              onSubmit={handleReplySubmit}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}