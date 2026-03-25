import { apiGet } from "./client.js";
import { getSetupOverview, getSetupTruth } from "./setup.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function hasKeys(value = {}) {
  return Object.keys(obj(value)).length > 0;
}

function pickFirstObject(...values) {
  for (const value of values) {
    const next = obj(value);
    if (Object.keys(next).length) return next;
  }
  return {};
}

function pickFirstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length) return value;
  }
  return [];
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    const next = s(value);
    if (!next) continue;
    query.set(key, next);
  }

  const text = query.toString();
  return text ? `?${text}` : "";
}

function normalizeFieldValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string"
          ? s(item)
          : s(item?.title || item?.name || item?.label || item?.value || item?.description)
      )
      .filter(Boolean)
      .join(", ");
  }

  if (value && typeof value === "object") {
    return s(
      value.text ||
        value.value ||
        value.label ||
        value.name ||
        value.title ||
        value.description
    );
  }

  return s(value);
}

function summarizeProvenance(value = {}) {
  const item = obj(value);
  const labels = [
    s(item.label || item.sourceLabel || item.sourceType),
    s(item.sourceUrl),
  ].filter(Boolean);

  const unique = [...new Set(labels)];
  const authorityRank = Number(item.authorityRank);
  const note = Number.isFinite(authorityRank) && authorityRank > 0
    ? `Authority ${authorityRank}`
    : s(item.note || item.reason || item.summary || item.display);

  if (unique.length && note) return `${unique.join(", ")} - ${note}`;
  if (unique.length) return unique.join(", ");
  return note;
}

function summarizeSourceSummary(value = {}) {
  const item = obj(value);
  const parts = [
    s(item.primaryLabel || item.primarySourceLabel || item.label),
    s(item.primaryUrl || item.primarySourceUrl || item.url),
  ].filter(Boolean);

  const supportingCount = Number(
    item.supportingCount || item.sourceCount || item.supportingSourcesCount
  );

  if (Number.isFinite(supportingCount) && supportingCount > 0) {
    parts.push(
      `${supportingCount} supporting source${supportingCount === 1 ? "" : "s"}`
    );
  }

  return parts.join(" - ");
}

function summarizeVersionDiff(value = {}) {
  const item = obj(value);
  const changedFields = arr(item.changedFields || item.changed_fields)
    .map((field) =>
      typeof field === "string"
        ? s(field)
        : s(field?.label || field?.key || field?.field)
    )
    .filter(Boolean);

  if (changedFields.length > 0) {
    const preview = changedFields.slice(0, 3).join(", ");
    const remainder = changedFields.length - 3;
    return remainder > 0 ? `${preview}, +${remainder} more` : preview;
  }

  return s(
    item.diffSummary ||
      item.diff_summary ||
      item.changeSummary ||
      item.change_summary ||
      item.diff?.summary ||
      item.diff?.changeSummary
  );
}

function normalizeChangedFields(value = []) {
  return arr(value)
    .map((field) =>
      typeof field === "string"
        ? {
            key: s(field),
            label: s(field),
          }
        : {
            key: s(field?.key || field?.field || field?.name || field?.label),
            label: s(field?.label || field?.key || field?.field || field?.name),
          }
    )
    .filter((field) => field.key || field.label);
}

function summarizeFieldChangeValue(value) {
  const x = obj(value);
  return s(
    x.summary ||
      x.display ||
      x.text ||
      x.label ||
      x.value ||
      x.description ||
      normalizeFieldValue(x)
  );
}

function normalizeFieldChanges(value = []) {
    return arr(value)
      .map((entry) => {
        const item = obj(entry);
        const beforeValue =
          item.beforeSummary ?? item.before ?? item.previous ?? item.from;
        const afterValue =
          item.afterSummary ?? item.after ?? item.current ?? item.to;

      return {
        key: s(item.key || item.field || item.name || item.label),
        label: s(item.label || item.key || item.field || item.name),
        beforeSummary: summarizeFieldChangeValue(beforeValue),
        afterSummary: summarizeFieldChangeValue(afterValue),
        summary: s(
          item.summary || item.changeSummary || item.change_summary
        ),
      };
    })
    .filter((item) => item.key || item.label || item.beforeSummary || item.afterSummary);
}

function normalizeVersionMeta(value = {}, fallbackId = "") {
  const item = obj(value);
  const version = s(item.version || item.revision || item.id || fallbackId);
  const profileStatus = s(item.profileStatus || item.status);
  const versionLabel = s(
    item.versionLabel ||
      item.version_label ||
      item.label ||
      (version ? `Truth version ${version}` : "") ||
      (profileStatus ? `Truth version (${profileStatus})` : "")
  );

  return {
    id: s(item.id || version || fallbackId),
    version,
    versionLabel: versionLabel || "Truth version",
    profileStatus,
    approvedAt: s(item.approvedAt || item.createdAt || item.updatedAt),
    approvedBy: s(
      item.approvedBy ||
        item.actor ||
        item.createdBy ||
        item.updatedBy ||
        item.user
    ),
    sourceSummary: summarizeSourceSummary(
      item.sourceSummary ||
        item.source_summary ||
        item.sourceSummaryJson ||
        item.source_summary_json
    ),
  };
}

function normalizeHistory(items = []) {
  return arr(items)
    .map((entry, index) => {
      const item = obj(entry);
      const meta = normalizeVersionMeta(item, `history-${index + 1}`);
      const changedFields = normalizeChangedFields(
        item.changedFields ||
          item.changed_fields ||
          item.diff?.changedFields ||
          item.diff?.changed_fields
      );
      const fieldChanges = normalizeFieldChanges(
        item.fieldChanges ||
          item.field_changes ||
          item.diff?.fieldChanges ||
          item.diff?.field_changes
      );
      const diffSummary = summarizeVersionDiff(item);

      if (
        !meta.approvedAt &&
        !meta.approvedBy &&
        !meta.version &&
        !meta.versionLabel
      ) {
        return null;
      }

      return {
        ...meta,
        previousVersionId: s(item.previousVersionId || item.previous_version_id),
        changedFields,
        fieldChanges,
        changedFieldCount: changedFields.length || fieldChanges.length,
        diffSummary,
      };
    })
    .filter(Boolean);
}

function normalizeCompareResponse(payload = {}, versionId = "", compareTo = "") {
  const root = obj(payload);
  const detail = pickFirstObject(
    root.detail,
    root.version,
    root.truthVersion,
    root.item,
    root
  );
  const compare = pickFirstObject(
    root.compare,
    root.comparedVersion,
    root.compared_version,
    root.previousVersion,
    root.previous_version
  );
  const diff = pickFirstObject(root.diff, detail.diff);
  const changedFields = normalizeChangedFields(
    root.changedFields ||
      root.changed_fields ||
      detail.changedFields ||
      detail.changed_fields ||
      diff.changedFields ||
      diff.changed_fields
  );
  const fieldChanges = normalizeFieldChanges(
    root.fieldChanges ||
      root.field_changes ||
      detail.fieldChanges ||
      detail.field_changes ||
      diff.fieldChanges ||
      diff.field_changes
  );
  const sectionChanges = arr(
    root.sectionChanges ||
      root.section_changes ||
      diff.sectionChanges ||
      diff.section_changes
  )
    .map((entry) => {
      const item = obj(entry);
      return {
        key: s(item.key || item.section || item.name || item.label),
        label: s(item.label || item.section || item.name || item.key),
        summary: s(item.summary || item.changeSummary || item.change_summary),
      };
    })
    .filter((item) => item.key || item.label || item.summary);

  return {
    selectedVersion: normalizeVersionMeta(detail, versionId),
    comparedVersion: normalizeVersionMeta(compare, compareTo),
    changedFields,
    fieldChanges,
    sectionChanges,
    diffSummary: summarizeVersionDiff({
      ...detail,
      ...diff,
      changedFields,
    }),
    hasStructuredDiff:
      changedFields.length > 0 ||
      fieldChanges.length > 0 ||
      sectionChanges.length > 0 ||
      !!summarizeVersionDiff({ ...detail, ...diff }),
  };
}

function normalizeTruthResponse(payload = {}, source = "") {
  const root = obj(payload);
  const truth = pickFirstObject(root.truth, root.snapshot);

  const profile = pickFirstObject(
    truth.profile,
    root.profile
  );

  const fieldProvenance = pickFirstObject(
    truth.fieldProvenance,
    truth.field_provenance,
    root.fieldProvenance,
    root.field_provenance
  );

  const history = normalizeHistory(
    pickFirstArray(
      truth.history,
      root.history,
      truth.versions
    )
  );

  const fields = [
    ["Company name", normalizeFieldValue(profile.companyName || profile.name), "companyName"],
    ["Short business summary", normalizeFieldValue(profile.description || profile.summaryShort || profile.companySummaryShort), "description"],
    ["Website URL", normalizeFieldValue(profile.websiteUrl), "websiteUrl"],
    ["Primary phone", normalizeFieldValue(profile.primaryPhone), "primaryPhone"],
    ["Primary email", normalizeFieldValue(profile.primaryEmail), "primaryEmail"],
    ["Primary address", normalizeFieldValue(profile.primaryAddress), "primaryAddress"],
    ["Primary language", normalizeFieldValue(profile.mainLanguage || profile.language || profile.primaryLanguage), "mainLanguage"],
    ["Services", normalizeFieldValue(profile.services), "services"],
    ["Products", normalizeFieldValue(profile.products), "products"],
    ["Pricing", normalizeFieldValue(profile.pricingHints), "pricingHints"],
    ["Social", normalizeFieldValue(profile.socialLinks), "socialLinks"],
  ]
    .map(([label, value, key]) => ({
      key,
      label,
      value,
      provenance: summarizeProvenance(fieldProvenance[key]),
      hasProvenance: !!summarizeProvenance(fieldProvenance[key]),
    }))
    .filter((field) => field.value);

  const approval = {
    approvedAt: s(truth.approvedAt || root.approvedAt),
    approvedBy: s(truth.approvedBy || root.approvedBy),
    version: s(truth.profileStatus || root.profileStatus),
  };

  const hasApprovalMeta = !!(approval.approvedAt || approval.approvedBy || approval.version);
  const hasTruth = fields.length > 0 || hasKeys(profile);

  return {
    source,
    fields,
    approval,
    hasApprovalMeta,
    hasHistory: history.length > 0,
    history,
    hasProvenance: fields.some((field) => field.hasProvenance),
    hasTruth,
  };
}

export const __test__ = {
  normalizeTruthResponse,
  normalizeCompareResponse,
};

export async function getTruthVersionDetail(versionId, options = {}) {
  const id = encodeURIComponent(s(versionId));
  const query = buildQuery({
    compareTo: options.compareTo,
  });
  const payload = await apiGet(`/api/setup/truth/history/${id}${query}`);
  return normalizeCompareResponse(payload, s(versionId), s(options.compareTo));
}

export async function getCanonicalTruthSnapshot() {
  const truth = await getSetupTruth().catch(() => null);
  if (truth) {
    const normalized = normalizeTruthResponse(truth, "/api/setup/truth/current");
    return {
      ...normalized,
      notices:
        normalized.hasTruth || normalized.hasApprovalMeta || normalized.hasHistory
          ? []
          : ["Approved truth exists, but the backend did not return populated truth fields."],
    };
  }

  const overview = await getSetupOverview().catch(() => null);
  if (overview) {
    const fallback = normalizeTruthResponse(overview, "/api/setup/overview");
    return {
      ...fallback,
      notices: [
        "Dedicated approved truth could not be loaded. Showing the current saved business profile instead.",
      ],
    };
  }

  return {
    source: "/api/setup/truth/current",
    fields: [],
    approval: { approvedAt: "", approvedBy: "", version: "" },
    hasApprovalMeta: false,
    hasHistory: false,
    history: [],
    hasProvenance: false,
    hasTruth: false,
    notices: [
      "Approved truth could not be loaded from the backend.",
    ],
  };
}
