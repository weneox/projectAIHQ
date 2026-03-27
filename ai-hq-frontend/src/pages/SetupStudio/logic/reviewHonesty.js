import { isWebsiteBarrierWarning } from "../state/profile.js";
import { arr, obj, s } from "../state/shared.js";
import { humanizeStudioIssue } from "./helpers.js";

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeHonestyScore(value) {
  const raw =
    typeof value === "number"
      ? value
      : Number(
          obj(value).score ??
            obj(value).value ??
            obj(value).confidence ??
            0
        );

  if (!Number.isFinite(raw)) return 0;
  if (raw > 1) return clamp(raw / 100);
  return clamp(raw);
}

function uniqueTexts(items = []) {
  const seen = new Set();
  const out = [];

  for (const item of arr(items)) {
    const value = s(item);
    if (!value) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }

  return out;
}

export function isPartialStudioWarning(value = "") {
  const code = s(value).toLowerCase();
  if (!code) return false;

  return (
    code.includes("partial") ||
    code.includes("weak") ||
    code.includes("incomplete") ||
    code.includes("review_required") ||
    code.includes("manual") ||
    code.includes("needs_review") ||
    code.includes("review")
  );
}

export function summarizeSetupStudioHonesty({
  reviewProjection = {},
  reviewSources = [],
  extraWarnings = [],
} = {}) {
  const draft = obj(reviewProjection);
  const fieldConfidence = obj(draft.fieldConfidence);
  const fieldProvenance = obj(draft.fieldProvenance);
  const warningCodes = uniqueTexts([
    ...arr(draft.reviewFlags),
    ...arr(draft.warnings),
    ...arr(extraWarnings),
  ]);

  const barrierWarnings = warningCodes.filter((item) => isWebsiteBarrierWarning(item));
  const partialWarnings = warningCodes.filter(
    (item) => !barrierWarnings.includes(item) && isPartialStudioWarning(item)
  );

  const lowConfidenceFields = [];
  const mediumConfidenceFields = [];
  const strongConfidenceFields = [];

  for (const [key, raw] of Object.entries(fieldConfidence)) {
    const score = normalizeHonestyScore(raw);
    if (score >= 0.8) {
      strongConfidenceFields.push(key);
      continue;
    }

    if (score >= 0.55) {
      mediumConfidenceFields.push(key);
      continue;
    }

    lowConfidenceFields.push(key);
  }

  const sourceBackedFieldCount = Object.keys(fieldProvenance).length;
  const trackedFieldCount = Math.max(
    Object.keys(fieldConfidence).length,
    sourceBackedFieldCount
  );
  const sourceCount = arr(reviewSources).length || arr(draft.sources).length;
  const needsReview =
    !!draft.reviewRequired ||
    lowConfidenceFields.length > 0 ||
    partialWarnings.length > 0 ||
    barrierWarnings.length > 0;

  let tone = "default";
  let title = "Reviewed session draft";
  let message =
    "This is still a temporary review-session draft. Source-derived evidence should be confirmed field by field before finalization.";

  if (barrierWarnings.length) {
    tone = "warn";
    title = "Barrier-limited source draft";
    message =
      "Some sources blocked or limited extraction. Treat observed evidence as incomplete and verify important fields manually before finalizing.";
  } else if (partialWarnings.length || lowConfidenceFields.length) {
    tone = "warn";
    title = "Partial source evidence";
    message =
      "Some draft fields still rely on weak or partial source signals. Keep the draft editable and confirm those fields before finalizing.";
  } else if (sourceBackedFieldCount > 0) {
    tone = "success";
    title = "Source-backed review draft";
    message =
      "The draft is backed by visible source evidence, but it still becomes approved truth only after final review and finalize.";
  }

  const chips = [
    barrierWarnings.length
      ? {
          label: `${barrierWarnings.length} barrier warning${barrierWarnings.length === 1 ? "" : "s"}`,
          tone: "warn",
        }
      : null,
    partialWarnings.length
      ? {
          label: `${partialWarnings.length} partial warning${partialWarnings.length === 1 ? "" : "s"}`,
          tone: "warn",
        }
      : null,
    lowConfidenceFields.length
      ? {
          label: `${lowConfidenceFields.length} weak field${lowConfidenceFields.length === 1 ? "" : "s"}`,
          tone: "warn",
        }
      : null,
    sourceBackedFieldCount
      ? {
          label: `${sourceBackedFieldCount} source-backed field${sourceBackedFieldCount === 1 ? "" : "s"}`,
          tone: "default",
        }
      : null,
    sourceCount
      ? {
          label: `${sourceCount} source${sourceCount === 1 ? "" : "s"}`,
          tone: "default",
        }
      : null,
  ].filter(Boolean);

  const finalizeMessage = barrierWarnings.length
    ? "Barrier-limited source results remain in this draft. Finalize only after checking those fields against visible evidence or manual confirmation."
    : lowConfidenceFields.length || partialWarnings.length
      ? "Weak or partial source signals remain in this draft. Finalize only after reviewing those fields against visible evidence."
      : "Finalize only after the reviewed draft and the source-derived evidence both look correct.";

  return {
    tone,
    title,
    message,
    finalizeMessage,
    chips,
    trackedFieldCount,
    sourceBackedFieldCount,
    sourceCount,
    weakFieldCount: lowConfidenceFields.length,
    mediumFieldCount: mediumConfidenceFields.length,
    strongFieldCount: strongConfidenceFields.length,
    barrierWarnings,
    partialWarnings,
    barrierMessages: barrierWarnings.map((item) => humanizeStudioIssue(item)).filter(Boolean),
    partialMessages: partialWarnings.map((item) => humanizeStudioIssue(item)).filter(Boolean),
    needsReview,
  };
}

export function describeSetupStudioFieldHonesty({
  fieldKey = "",
  fieldConfidence = {},
  observedValue = "",
  evidence = [],
  warnings = [],
} = {}) {
  const aliases = {
    description: ["description", "companySummaryShort", "companySummaryLong"],
    language: ["language", "mainLanguage", "primaryLanguage"],
    companyName: ["companyName", "displayName"],
    services: ["services"],
    faqs: ["faqs"],
    policies: ["policies"],
  };

  const keys = aliases[fieldKey] || [fieldKey];
  const confidenceEntry =
    keys.map((key) => obj(fieldConfidence)[key]).find(Boolean) || {};
  const score = normalizeHonestyScore(confidenceEntry);
  const hasObservedSignal = !!s(observedValue) || arr(evidence).length > 0;
  const hasBarrier = arr(warnings).some((item) => isWebsiteBarrierWarning(item));

  if (!hasObservedSignal && hasBarrier) {
    return {
      tone: "warn",
      label: "Barrier-limited",
      note: "Source access was blocked or limited for this field, so the observed side is incomplete.",
      provenanceLabel: "Source-derived suggestion",
    };
  }

  if (!hasObservedSignal) {
    return {
      tone: "warn",
      label: "No visible evidence",
      note: "No visible source evidence was captured for this field yet.",
      provenanceLabel: "Needs manual review",
    };
  }

  if (score >= 0.8) {
    return {
      tone: "success",
      label: "Stronger signal",
      note: "This field has comparatively stronger source support, but it is still not approved truth until finalized.",
      provenanceLabel: "Source-derived suggestion",
    };
  }

  if (score >= 0.55) {
    return {
      tone: "default",
      label: "Needs confirmation",
      note: "This field has some source support, but it still needs a human review decision.",
      provenanceLabel: "Source-derived suggestion",
    };
  }

  return {
    tone: "warn",
    label: "Weak signal",
    note: "The current source support for this field is weak or incomplete, so the draft should be treated cautiously.",
    provenanceLabel: "Source-derived suggestion",
  };
}
