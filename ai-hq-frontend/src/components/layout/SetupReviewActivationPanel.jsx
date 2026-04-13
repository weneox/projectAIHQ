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

function formatPath(url = "") {
  const value = s(url);
  if (!value) return "";
  try {
    const parsed = new URL(value);
    return parsed.pathname && parsed.pathname !== "/"
      ? `${parsed.hostname}${parsed.pathname}`
      : parsed.hostname;
  } catch {
    return value;
  }
}

function sourceTypeLabel(value = "") {
  const key = lower(value);
  if (key === "google_maps") return "Google Maps";
  if (key === "instagram") return "Instagram";
  if (key === "facebook_page" || key === "facebook") return "Facebook";
  if (key === "manual") return "Manual note";
  return "Website";
}

function buildReviewModel(reviewPayload = {}, assistantReview = {}) {
  const root = obj(reviewPayload);
  const review = obj(root.review || reviewPayload);
  const draft = obj(review.draft);
  const profile = obj(draft.businessProfile);
  const services = arr(draft.services)
    .map((item) => s(item.title || item.name || item.label))
    .filter(Boolean);
  const contacts = arr(draft.contacts)
    .map((item) => s(item.label || item.channel || item.value || item.type))
    .filter(Boolean);
  const sourceRows = arr(root.bundleSources).map((item, index) => ({
    key: s(item.sourceId || item.runId || `${item.sourceType}-${index}`),
    label: s(item.label || sourceTypeLabel(item.sourceType)),
    type: sourceTypeLabel(item.sourceType),
    url: s(item.sourceUrl),
  }));

  const hours = arr(profile.hours).length
    ? listPreview(arr(profile.hours), 3)
    : listPreview(
        arr(draft.hours).map((item) => s(item.notes || `${item.day} ${item.openTime}-${item.closeTime}`)),
        3
      );

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

  const coreOffer = services[0] || "";
  const additionalServices = services.slice(1);

  const fields = [
    {
      key: "name",
      label: "Business name",
      value: s(profile.companyName || profile.displayName),
    },
    {
      key: "description",
      label: "What this business is",
      value: description,
    },
    {
      key: "core-offer",
      label: "Core offer",
      value: coreOffer,
    },
    {
      key: "additional-services",
      label: "Additional services",
      value: additionalServices.length ? listPreview(additionalServices, 5) : "",
    },
    {
      key: "audience",
      label: "Audience",
      value: audience,
    },
    {
      key: "website",
      label: "Website",
      value: s(profile.websiteUrl),
    },
    {
      key: "contact-routes",
      label: "Contact routes",
      value: listPreview(
        [
          s(profile.primaryPhone),
          s(profile.primaryEmail),
          s(profile.primaryAddress),
          ...contacts,
        ],
        4
      ),
    },
    {
      key: "hours",
      label: "Hours",
      value: hours,
    },
    {
      key: "pricing",
      label: "Pricing posture",
      value: pricing,
    },
    {
      key: "handoff",
      label: "Human handoff",
      value: handoff,
    },
  ].filter((item) => s(item.value));

  if (!fields.length && !sourceRows.length) {
    return null;
  }

  const canFinalize =
    obj(obj(root.permissions).setupReviewFinalize).allowed !== false &&
    (root?.setup?.review?.finalizeAvailable === true ||
      assistantReview?.finalizeAvailable === true ||
      assistantReview?.readyForReview === true);

  return {
    fields,
    sourceRows,
    canFinalize,
  };
}

export default function SetupReviewActivationPanel({
  reviewPayload = {},
  assistantReview = {},
  onFinalize,
  finalizing = false,
}) {
  const model = buildReviewModel(reviewPayload, assistantReview);

  if (!model) return null;

  return (
    <section
      className="border border-[rgba(15,23,42,0.06)] bg-[linear-gradient(180deg,rgba(248,250,252,0.82),rgba(255,255,255,0.98))] px-4 py-4"
      aria-label="Business truth review"
      role="region"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-muted">
            Business draft
          </div>
          <div className="mt-1 text-[19px] font-semibold tracking-[-0.04em] text-text">
            Approve business truth
          </div>
          <div className="mt-2 max-w-[34ch] text-[12px] leading-5 text-text-muted">
            Source-lar və cavabların birləşdirilib. Yekun truth yazılmazdan əvvəl bunu yoxla.
          </div>
        </div>

        {model.canFinalize && typeof onFinalize === "function" ? (
          <button
            type="button"
            onClick={() => onFinalize?.()}
            disabled={finalizing}
            className="inline-flex h-10 items-center bg-slate-950 px-3.5 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {finalizing ? "Approving..." : "Approve truth"}
          </button>
        ) : null}
      </div>

      <div className="mt-5 border-t border-[rgba(15,23,42,0.08)]">
        {model.fields.map((field) => (
          <div
            key={field.key}
            className="border-b border-[rgba(15,23,42,0.08)] py-3"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
              {field.label}
            </div>
            <div className="mt-1 text-[14px] leading-7 text-text">
              {field.value}
            </div>
          </div>
        ))}
      </div>

      {model.sourceRows.length ? (
        <div className="mt-5 border-t border-[rgba(15,23,42,0.08)] pt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">
            Sources used
          </div>

          <div className="mt-2 space-y-2">
            {model.sourceRows.map((row) => (
              <div key={row.key} className="text-[13px] leading-6 text-text">
                <span className="font-semibold">{row.label}</span>
                {s(row.url) ? (
                  <span className="text-text-muted"> · {formatPath(row.url)}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 text-[12px] leading-5 text-text-muted">
        Dəyişmək istədiyin məlumatları mənə yaz. Mən draft-ı yenidən quracağam.
      </div>
    </section>
  );
}