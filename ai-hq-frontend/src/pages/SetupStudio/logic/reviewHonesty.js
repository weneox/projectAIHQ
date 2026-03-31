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
  let title = "Review detected business details";
  let message =
    "Check the detected information before saving it to your business profile.";

  if (barrierWarnings.length) {
    tone = "warn";
    title = "Limited source coverage";
    message =
      "Some sources limited what could be detected. Verify important fields manually before saving.";
  } else if (partialWarnings.length || lowConfidenceFields.length) {
    tone = "warn";
    title = "Some fields need review";
    message =
      "Some fields were detected with limited confidence. Review them before saving.";
  } else if (sourceBackedFieldCount > 0) {
    tone = "success";
    title = "Detected information is ready for review";
    message =
      "Detected values are backed by source evidence. Confirm them before saving.";
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
          label: `${lowConfidenceFields.length} low-confidence field${lowConfidenceFields.length === 1 ? "" : "s"}`,
          tone: "warn",
        }
      : null,
    sourceBackedFieldCount
      ? {
          label: `${sourceBackedFieldCount} detected field${sourceBackedFieldCount === 1 ? "" : "s"}`,
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
    ? "Some detected values came from limited source coverage. Save only after checking those fields carefully."
    : lowConfidenceFields.length || partialWarnings.length
      ? "Some fields still have limited evidence. Review them before saving."
      : "Save after the draft and detected source evidence both look correct.";

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
      label: "Limited access",
      note: "Source access was limited for this field, so the detected value may be incomplete.",
      provenanceLabel: "Detected from source",
    };
  }

  if (!hasObservedSignal) {
    return {
      tone: "warn",
      label: "Needs review",
      note: "No field-specific source evidence was captured for this field yet.",
      provenanceLabel: "Source",
    };
  }

  if (score >= 0.8) {
    return {
      tone: "success",
      label: "High confidence",
      note: "This value has strong source support, but it should still be confirmed before saving.",
      provenanceLabel: "Detected from source",
    };
  }

  if (score >= 0.55) {
    return {
      tone: "default",
      label: "Needs review",
      note: "This value has some source support, but it should be confirmed before saving.",
      provenanceLabel: "Detected from source",
    };
  }

  return {
    tone: "warn",
    label: "Low confidence",
    note: "This value was detected with limited support and should be reviewed carefully before saving.",
    provenanceLabel: "Detected from source",
  };
}
