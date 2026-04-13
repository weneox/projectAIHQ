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

function compactText(value, max = 180) {
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
    actionLabel: "Continue",
  },
  {
    key: "instagram",
    label: "Instagram",
    placeholder: "https://instagram.com/brand",
    actionLabel: "Continue",
  },
  {
    key: "facebook",
    label: "Facebook",
    placeholder: "https://facebook.com/page",
    actionLabel: "Continue",
  },
  {
    key: "manual",
    label: "Manual note",
    placeholder:
      "Qadın gözəllik salonudur. Əsas xidmətlər saç baxımı, kəsim, dırnaq xidməti və makiyajdır.",
    actionLabel: "Continue",
    multiline: true,
  },
];

const QUESTION_META = {
  company: {
    title: "Business name",
    prompt: "Bu biznesin adı necə görünməlidir?",
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
  services: {
    title: "Core services",
    prompt: "Əsas xidmətləri sadalayın.",
    placeholder: "Website hazırlanması, reklam, branding...",
    quickAnswers: [],
  },
  audience: {
    title: "Audience",
    prompt: "Əsasən kimlərə xidmət göstərirsiniz?",
    placeholder: "Kiçik bizneslər, şirkətlər, fərdi brendlər...",
    quickAnswers: ["Kiçik bizneslər", "Şirkətlər", "Fərdi brendlər", "Hamısı"],
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

const QUESTION_ORDER = [
  "company",
  "description",
  "services",
  "audience",
  "pricing",
  "contacts",
  "handoff",
];

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
    (sourceType === "instagram"
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

  return {
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
}

function buildQuestionState(draftModel = {}) {
  for (const key of QUESTION_ORDER) {
    if (key === "company" && !s(draftModel.name)) {
      return { key, ...QUESTION_META[key] };
    }

    if (key === "description" && !s(draftModel.description)) {
      return { key, ...QUESTION_META[key] };
    }

    if (key === "services" && !draftModel.serviceList?.length) {
      return { key, ...QUESTION_META[key] };
    }

    if (key === "audience" && !s(draftModel.audience)) {
      return { key, ...QUESTION_META[key] };
    }

    if (key === "pricing" && !s(draftModel.pricing)) {
      return { key, ...QUESTION_META[key] };
    }

    if (key === "contacts" && !draftModel.contacts?.length) {
      return { key, ...QUESTION_META[key] };
    }

    if (key === "handoff" && !s(draftModel.handoff)) {
      return { key, ...QUESTION_META[key] };
    }
  }

  return null;
}

function getSourcePrefillValue(mode = "", source = {}, assistant = {}, draftModel = {}) {
  if (mode === "website") {
    return s(assistant.websitePrefill?.websiteUrl || draftModel.website);
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
          className="min-h-[140px] w-full resize-none border-b border-[rgba(15,23,42,0.12)] bg-transparent px-0 py-2 text-[15px] leading-7 text-text outline-none placeholder:text-text-subtle"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={!s(value) || busy}
          className="inline-flex h-10 items-center gap-2 bg-slate-950 px-4 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
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
        className="h-12 w-full bg-transparent px-0 text-[15px] text-text outline-none placeholder:text-text-subtle"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={!s(value) || busy}
        className="inline-flex h-10 shrink-0 items-center gap-2 bg-slate-950 px-4 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
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
  buttonLabel = "Continue",
  onChange,
  onSubmit,
}) {
  return (
    <div className="border-t border-[rgba(15,23,42,0.08)] pt-4">
      <div className="flex items-end gap-3 border-b border-[rgba(15,23,42,0.12)] py-2">
        <textarea
          rows={4}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          placeholder={placeholder}
          className="min-h-[98px] w-full resize-none bg-transparent px-0 py-1 text-[15px] leading-7 text-text outline-none placeholder:text-text-subtle"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={!s(value) || busy}
          className="inline-flex h-10 shrink-0 items-center gap-2 bg-slate-950 px-4 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          <span>{buttonLabel}</span>
        </button>
      </div>
    </div>
  );
}

function AssistantBubble({ eyebrow = "", title = "", body = "", children = null }) {
  return (
    <div className="border border-[rgba(15,23,42,0.06)] bg-[linear-gradient(180deg,rgba(248,250,252,0.82),rgba(255,255,255,0.98))] px-5 py-5 text-text">
      {s(eyebrow) ? (
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
          {eyebrow}
        </div>
      ) : null}
      {s(title) ? (
        <div className="mt-1 text-[28px] font-semibold tracking-[-0.05em] text-text">
          {title}
        </div>
      ) : null}
      {s(body) ? (
        <div className="mt-3 whitespace-pre-wrap text-[15px] leading-8 text-text-muted">
          {body}
        </div>
      ) : null}
      {children ? <div className="mt-5">{children}</div> : null}
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
    () => buildQuestionState(draftModel),
    [draftModel]
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
  const [sourceStarted, setSourceStarted] = useState(false);
  const [pendingSource, setPendingSource] = useState(null);

  const busy = saving || finalizing || capturingSource;
  const interviewReady = sourceStarted || source.hasSource;
  const draftReady =
    assistant.review?.finalizeAvailable === true ||
    assistant.review?.readyForReview === true ||
    assistant.assistant?.completion?.ready === true ||
    (!question && interviewReady);

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

  const displaySource = source.hasSource
    ? source
    : pendingSource || source;

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
    setSourceStarted(true);
    setPendingSource({
      type: sourceMode,
      label: selectedSource.label,
      url: value,
      hasSource: true,
    });

    try {
      await onCaptureSource?.({
        type: sourceMode,
        value,
      });
      setReplyInput("");
    } catch (error) {
      if (!source.hasSource) {
        setSourceStarted(false);
        setPendingSource(null);
      }
      setLocalError(s(error?.message, "Source intake failed."));
    }
  }

  async function handleReplySubmit() {
    const value = s(replyInput);
    if (!value || busy) return;
    setLocalError("");

    try {
      await onParseMessage?.({
        step: draftReady ? "profile" : question?.key || "profile",
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
      <div className="border-b border-[rgba(15,23,42,0.08)] px-6 pb-5 pt-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
          Setup Studio
        </div>
        <div className="mt-1 text-[24px] font-semibold tracking-[-0.04em] text-text">
          {stage === "source"
            ? "Start from one good source"
            : stage === "interview"
              ? "Conversation setup"
              : "Final draft"}
        </div>
        <div className="mt-2 text-[13px] leading-6 text-text-muted">
          {displaySource?.hasSource
            ? displaySource.url
              ? `${displaySource.label || "Source"} · ${displaySource.url}`
              : displaySource.label
            : "Website, Instagram, Facebook və ya qısa qeyd kifayətdir."}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        {s(localError || errorMessage) ? (
          <div className="mb-5 border-l-2 border-[rgba(var(--color-danger),0.78)] bg-danger-soft px-3 py-2 text-[12px] leading-6 text-danger">
            {localError || errorMessage}
          </div>
        ) : null}

        {stage === "source" ? (
          <div className="space-y-6">
            <AssistantBubble
              eyebrow="First step"
              title="Mənə ilk siqnalı ver"
              body="Bir düzgün başlanğıc kifayətdir. Source arxa planda analiz olunacaq, sonra sənə hazır suallar verəcəyəm."
            >
              <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-[rgba(15,23,42,0.08)] pb-2">
                {SOURCE_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`border-b pb-1 text-[13px] font-semibold transition-colors ${
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
          <div className="space-y-6">
            <AssistantBubble
              eyebrow="Question"
              title={question?.title || "Next question"}
              body={[
                displaySource?.hasSource
                  ? `${displaySource.label || "Source"} qəbul olundu.`
                  : "",
                question?.prompt || "Mənə növbəti vacib detalı yaz.",
              ]
                .filter(Boolean)
                .join("\n\n")}
            >
              {arr(question?.quickAnswers).length ? (
                <div className="flex flex-wrap gap-2">
                  {arr(question.quickAnswers).map((option) => (
                    <button
                      key={option}
                      type="button"
                      disabled={busy}
                      className="inline-flex h-9 items-center border border-[rgba(15,23,42,0.08)] bg-white px-3 text-[12px] font-semibold text-text disabled:cursor-not-allowed disabled:opacity-45"
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
                title="Arxa planda draft qurulur"
                body="Source analiz olunur və cavabların uyğun yerlərə yığılır."
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
          <div className="space-y-6">
            <SetupReviewActivationPanel
              reviewPayload={reviewPayload}
              assistantReview={assistant.review}
              onFinalize={onFinalize ? handleFinalize : undefined}
              finalizing={finalizing}
            />

            <AssistantBubble
              eyebrow="Refine"
              title="Dəyişmək istədiyini yaz"
              body="Məsələn: əsas xidməti dəyiş, branding-i sil, bizi software partner kimi göstər, pricing hissəsini yumşalt."
            />

            {busy ? (
              <AssistantBubble
                eyebrow="Thinking"
                title="Draft yenidən qurulur"
                body="Source-lar, əvvəlki cavablar və yeni düzəliş birləşdirilir."
              />
            ) : null}

            <ReplyComposer
              value={replyInput}
              busy={busy}
              placeholder="Nəyi dəyişmək istədiyini yaz"
              buttonLabel="Update draft"
              onChange={setReplyInput}
              onSubmit={handleReplySubmit}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}