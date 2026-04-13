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

function compactText(value, max = 140) {
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
  if (key === "manual") return "Operator note";
  return "Website";
}

function buildTruthRows(draft = {}) {
  const safeDraft = obj(draft);
  const profile = obj(safeDraft.businessProfile);

  return [
    {
      key: "company",
      label: "Business name",
      value: s(profile.companyName || profile.displayName),
    },
    {
      key: "description",
      label: "Short description",
      value: compactText(profile.description || profile.companySummaryShort, 160),
    },
    {
      key: "website",
      label: "Website",
      value: s(profile.websiteUrl),
    },
    {
      key: "services",
      label: "Services",
      value: listPreview(
        arr(safeDraft.services).map((item) => s(item.title || item.name || item.label)),
        4
      ),
    },
    {
      key: "pricing",
      label: "Pricing posture",
      value: compactText(
        profile.pricingPolicy ||
          obj(safeDraft.pricingPosture).publicSummary ||
          obj(safeDraft.pricingPosture).note,
        140
      ),
    },
    {
      key: "contacts",
      label: "Contact routes",
      value: listPreview(
        [
          profile.primaryPhone,
          profile.primaryEmail,
          profile.primaryAddress,
          ...arr(safeDraft.contacts).map((item) =>
            s(item.label || item.channel || item.value)
          ),
        ],
        3
      ),
    },
    {
      key: "hours",
      label: "Opening hours",
      value: listPreview(
        arr(profile.hours).length
          ? arr(profile.hours)
          : arr(safeDraft.hours).map((item) => s(item.notes)),
        2
      ),
    },
  ].filter((item) => s(item.value));
}

function buildSourceRows(root = {}, draft = {}) {
  const bundleSources = arr(root.bundleSources);
  if (bundleSources.length) {
    return bundleSources.map((item, index) => ({
      key: s(item.sourceId || item.runId || `${item.sourceType}-${index}`),
      label: s(item.label || sourceTypeLabel(item.sourceType)),
      type: sourceTypeLabel(item.sourceType),
      url: s(item.sourceUrl),
      role: lower(item.role),
      detail: listPreview(
        [
          Number(item.observationCount || 0) > 0
            ? `${Number(item.observationCount)} observations`
            : "",
          Number(item.candidateCount || 0) > 0
            ? `${Number(item.candidateCount)} candidates`
            : "",
          Number(item.warningCount || 0) > 0
            ? `${Number(item.warningCount)} warnings`
            : "",
        ],
        2
      ),
    }));
  }

  const sourceSummary = obj(draft.sourceSummary);
  const sourceType = s(sourceSummary.primarySourceType);
  const sourceUrl = s(sourceSummary.primarySourceUrl);
  if (!sourceType && !sourceUrl) return [];

  return [
    {
      key: "primary-source",
      label: sourceTypeLabel(sourceType),
      type: sourceTypeLabel(sourceType),
      url: sourceUrl,
      role: "primary",
      detail: listPreview(arr(sourceSummary.evidenceSummary), 2),
    },
  ];
}

function buildProvenanceNotes(fieldProvenance = {}) {
  return Object.entries(obj(fieldProvenance))
    .slice(0, 4)
    .map(([field, value]) => {
      const source = obj(value);
      const label = s(source.label || sourceTypeLabel(source.sourceType));
      const observed = compactText(source.observedValue || source.value, 52);
      const fieldLabel = field
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^./, (char) => char.toUpperCase());
      if (!label || !observed) return "";
      return `${fieldLabel} leaned on ${label}: ${observed}`;
    })
    .filter(Boolean);
}

function buildReviewModel(reviewPayload = {}, assistantReview = {}) {
  const root = obj(reviewPayload);
  const review = obj(root.review || reviewPayload);
  const draft = obj(review.draft);
  const websiteKnowledge = obj(obj(review.reviewDebug).websiteKnowledge);
  const truthRows = buildTruthRows(draft);
  const sourceRows = buildSourceRows(root, draft);
  const evidenceRows = arr(websiteKnowledge.topPages)
    .slice(0, 4)
    .map((item, index) => ({
      key: s(item.url || item.title || index),
      title: compactText(item.title || item.url, 72),
      path: formatPath(item.url),
    }))
    .filter((item) => item.key);
  const provenanceNotes = buildProvenanceNotes(
    root.fieldProvenance || review.fieldProvenance
  );

  if (!truthRows.length && !sourceRows.length && !evidenceRows.length) {
    return null;
  }

  const canFinalize =
    obj(obj(root.permissions).setupReviewFinalize).allowed !== false &&
    (root?.setup?.review?.finalizeAvailable === true ||
      assistantReview?.finalizeAvailable === true ||
      assistantReview?.readyForReview === true);

  return {
    sourceRows,
    truthRows,
    evidenceRows,
    provenanceNotes,
    summary: compactText(
      [
        sourceRows.length
          ? `${sourceRows.length} source${sourceRows.length > 1 ? "s" : ""}`
          : "",
        truthRows.length ? `${truthRows.length} truth fields` : "",
        Number(websiteKnowledge.pageCount || 0) > 0
          ? `${Number(websiteKnowledge.pageCount)} site pages`
          : "",
      ]
        .filter(Boolean)
        .join(", "),
      180
    ),
    statusLabel: canFinalize ? "Ready" : "In progress",
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
      className="border-b border-[rgba(15,23,42,0.08)] py-5"
      aria-label="Business truth review"
      role="region"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-muted">
            Governed review
          </div>
          <div className="mt-1 text-[20px] font-semibold tracking-[-0.045em] text-text">
            Approve business truth
          </div>
          <div className="mt-1 max-w-[30ch] text-[12px] leading-5 text-text-muted">
            {model.summary ||
              "Check the captured source evidence and approve the governed draft."}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-[15px] font-semibold tracking-[-0.03em] text-text">
            {model.statusLabel}
          </div>
          {model.canFinalize && typeof onFinalize === "function" ? (
            <button
              type="button"
              onClick={() => onFinalize?.()}
              disabled={finalizing}
              className="mt-3 inline-flex h-10 items-center bg-slate-950 px-3.5 text-[12px] font-semibold tracking-[0.015em] text-white shadow-[0_12px_28px_rgba(15,23,42,0.14)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Approve truth
            </button>
          ) : null}
        </div>
      </div>

      {model.sourceRows.length ? (
        <div className="mt-4 border-t border-[rgba(15,23,42,0.08)]">
          {model.sourceRows.map((row) => (
            <div
              key={row.key}
              className="flex items-start justify-between gap-4 border-b border-[rgba(15,23,42,0.08)] py-3"
            >
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-text-muted">
                  {row.role === "primary" ? "Primary source" : row.type}
                </div>
                <div className="mt-1 text-[13px] font-semibold text-text">
                  {row.label}
                </div>
                {s(row.detail) ? (
                  <div className="mt-1 text-[12px] leading-5 text-text-muted">
                    {row.detail}
                  </div>
                ) : null}
              </div>

              {s(row.url) ? (
                <div className="max-w-[42%] truncate text-[12px] text-text-muted">
                  {formatPath(row.url)}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {model.truthRows.length ? (
        <div className="border-b border-[rgba(15,23,42,0.08)]">
          {model.truthRows.map((row) => (
            <div
              key={row.key}
              className="flex items-start justify-between gap-4 border-t border-[rgba(15,23,42,0.08)] py-3"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-text-muted">
                {row.label}
              </div>
              <div className="max-w-[66%] text-right text-[13px] leading-6 text-text">
                {row.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {model.evidenceRows.length ? (
        <div className="mt-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-text-muted">
            Website evidence
          </div>
          <div className="mt-2 border-t border-[rgba(15,23,42,0.08)]">
            {model.evidenceRows.map((row) => (
              <div
                key={row.key}
                className="flex items-start justify-between gap-4 border-b border-[rgba(15,23,42,0.08)] py-3"
              >
                <div className="min-w-0 text-[13px] font-semibold text-text">
                  {row.title}
                </div>
                <div className="max-w-[42%] truncate text-[12px] text-text-muted">
                  {row.path}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {model.provenanceNotes.length ? (
        <div className="mt-3 space-y-1 text-[12px] leading-5 text-text-muted">
          {model.provenanceNotes.map((note) => (
            <div key={note}>{note}</div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
