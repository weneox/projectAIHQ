import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleAlert,
  Globe,
  History,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User2,
  Wrench,
} from "lucide-react";

import { getSettingsTrustView } from "../../api/trust.js";
import {
  getCanonicalTruthSnapshot,
  getTruthReviewWorkbench,
  getTruthVersionDetail,
  rollbackTruthVersion,
} from "../../api/truth.js";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
} from "../../components/ui/AppShellPrimitives.jsx";
import TruthVersionComparePanel from "../../components/truth/TruthVersionComparePanel.jsx";
import useWorkspaceTenantKey from "../../hooks/useWorkspaceTenantKey.js";
import { compactSentence } from "../../lib/appUi.js";
import {
  emitLaunchSliceRefresh,
  useLaunchSliceRefreshToken,
} from "../../lib/launchSliceRefresh.js";
import { buildTruthOperationalState } from "../../lib/readinessViewModel.js";
import { cx } from "../../lib/cx.js";

function text(value, fallback = "") {
  const next = String(value ?? "").trim();
  return next || fallback;
}

function lower(value, fallback = "") {
  return text(value, fallback).toLowerCase();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function initialState(tenantKey = "") {
  return {
    tenantKey,
    loading: true,
    refreshing: false,
    error: "",
    data: {
      fields: [],
      approval: { approvedAt: "", approvedBy: "", version: "" },
      history: [],
      notices: [],
      hasProvenance: false,
      approvedTruthUnavailable: false,
      readiness: {},
      sourceSummary: {},
      metadata: {},
      governance: {},
      finalizeImpact: {},
      reviewWorkbench: { summary: {}, items: [] },
      trust: null,
    },
  };
}

function normalizeTruthToken(value = "") {
  return String(value ?? "").trim();
}

function formatWhen(value = "") {
  const raw = text(value);
  if (!raw) return "Not available";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleString();
}

function formatShortWhen(value = "") {
  const raw = text(value);
  if (!raw) return "Not available";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function resolveRequestedVersionId(searchParams, location) {
  const hashValue = String(location?.hash || "").replace(/^#/, "");
  const hashVersionId = hashValue.startsWith("version:")
    ? hashValue.slice("version:".length)
    : hashValue.startsWith("truth-version:")
      ? hashValue.slice("truth-version:".length)
      : "";

  return normalizeTruthToken(
    location?.state?.versionId ||
      location?.state?.truthVersionId ||
      location?.state?.selectedVersionId ||
      location?.state?.openVersionId ||
      location?.state?.remediationVersionId ||
      location?.state?.version ||
      searchParams.get("versionId") ||
      searchParams.get("truthVersionId") ||
      searchParams.get("selectedVersionId") ||
      searchParams.get("openVersionId") ||
      searchParams.get("version") ||
      hashVersionId
  );
}

function getHistoryVersionId(item = {}) {
  return normalizeTruthToken(
    item?.id || item?.versionId || item?.truthVersionId || item?.version || ""
  );
}

function findRequestedHistoryItem({ history, requestedVersionId, approval }) {
  const requested = normalizeTruthToken(requestedVersionId);
  if (!requested) return null;

  if (["latest", "current", "approved"].includes(requested.toLowerCase())) {
    return history[0] || null;
  }

  const aliases = new Set(
    [requested, approval?.version]
      .map((value) => normalizeTruthToken(value))
      .filter(Boolean)
  );

  return (
    history.find((item) => {
      const candidates = [
        item?.id,
        item?.versionId,
        item?.truthVersionId,
        item?.version,
        item?.versionLabel,
        item?.slug,
      ]
        .map((value) => normalizeTruthToken(value))
        .filter(Boolean);

      return candidates.some(
        (candidate) => candidate === requested || aliases.has(candidate)
      );
    }) || null
  );
}

function findField(fields = [], key = "") {
  return arr(fields).find((field) => text(field.key) === text(key)) || null;
}

function fieldValue(fields = [], key = "") {
  return text(findField(fields, key)?.value);
}

function fieldProvenance(fields = [], key = "") {
  return text(findField(fields, key)?.provenance);
}

function hasTrustOperationalData(trust = null) {
  const summary = obj(trust?.summary);

  return (
    Object.keys(obj(summary.truth)).length > 0 ||
    Object.keys(obj(summary.runtimeProjection)).length > 0
  );
}

function hasApprovedTruth(data = {}) {
  if (data.approvedTruthUnavailable) return false;

  return Boolean(
    text(data.approval?.version) ||
      text(data.approval?.approvedAt) ||
      arr(data.fields).length ||
      arr(data.history).length
  );
}

function buildSnapshotOperationalState(data = {}) {
  const approval = obj(data.approval);
  const readiness = obj(data.readiness);
  const ready =
    lower(readiness.status) === "ready" && Boolean(text(approval.version));

  if (!ready) {
    return {
      truthReady: false,
      runtimeReady: false,
      status: "blocked",
      statusLabel: "Unavailable",
      title: "Approved truth unavailable",
      summary: "Only approved business truth can power the runtime.",
      detail: "This surface stays fail-closed until approved truth is available.",
      action: {
        label: "Continue setup",
        path: "/home?assistant=setup",
      },
    };
  }

  return {
    truthReady: true,
    runtimeReady: true,
    status: "ready",
    statusLabel: "Healthy",
    title: "Approved truth active",
    summary: "Approved business truth is aligned with the runtime.",
    detail: text(approval.version)
      ? `Truth version ${approval.version} is the active runtime source.`
      : "Approved truth is active.",
    action: null,
  };
}

function resolveOperationalState(data = {}) {
  if (data.approvedTruthUnavailable) {
    return buildSnapshotOperationalState({
      ...data,
      approval: {},
      readiness: { status: "blocked" },
    });
  }

  if (hasTrustOperationalData(data.trust)) {
    try {
      return buildTruthOperationalState(data.trust);
    } catch {
      return buildSnapshotOperationalState(data);
    }
  }

  return buildSnapshotOperationalState(data);
}

function resolveRuntimeLabel(data = {}, operationalState = {}) {
  if (data.approvedTruthUnavailable) return "Unavailable";

  return text(
    operationalState.statusLabel ||
      operationalState.runtimeLabel ||
      data.readiness?.status,
    "Unknown"
  );
}

function resolveSourceSummaryLine(sourceSummary = {}) {
  const source = obj(sourceSummary);
  const latestImport = obj(source.latestImport);

  const sourceType = text(
    latestImport.sourceLabel ||
      latestImport.sourceType ||
      source.primaryLabel ||
      source.primarySourceLabel ||
      source.primarySourceType
  );

  const sourceUrl = text(
    latestImport.sourceUrl ||
      source.primaryUrl ||
      source.primarySourceUrl ||
      source.url
  );

  return [sourceType, sourceUrl].filter(Boolean).join(" · ");
}

function toneForStatus(status = "") {
  const safe = lower(status);

  if (["ready", "healthy", "approved", "success"].includes(safe)) {
    return "success";
  }

  if (["blocked", "danger", "error", "unavailable"].includes(safe)) {
    return "danger";
  }

  if (["warning", "attention", "pending", "review"].includes(safe)) {
    return "warning";
  }

  return "neutral";
}

function titleize(value = "") {
  const safe = text(value);
  if (!safe) return "";

  return safe
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (item) => item.toUpperCase());
}

function toneTextClass(tone = "neutral") {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "brand" || tone === "info") return "text-brand";
  return "text-text-muted";
}

function toneDotClass(tone = "neutral") {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "brand" || tone === "info") return "bg-brand";
  return "bg-[rgb(var(--color-text-soft))]";
}

function reviewSummaryTotal(summary = {}) {
  return (
    n(summary.pending) +
    n(summary.quarantined) +
    n(summary.conflicting) +
    n(summary.autoApprovable) +
    n(summary.highRisk || summary.blockedHighRisk)
  );
}

function isTruthUnavailableNotice(notice = {}) {
  const raw =
    typeof notice === "string"
      ? notice
      : `${notice?.code || ""} ${notice?.title || ""} ${notice?.message || ""} ${notice?.description || ""}`;

  const safe = lower(raw);
  return (
    safe.includes("approved truth") &&
    (safe.includes("unavailable") || safe.includes("not available"))
  );
}

function normalizeSnapshotPayload(payload = {}) {
  const root = obj(
    payload?.data ||
      payload?.snapshot ||
      payload?.truth ||
      payload?.canonicalTruth ||
      payload
  );

  return {
    fields: arr(root.fields || root.approvedFields),
    approval: obj(root.approval || root.approved || root.versionApproval),
    history: arr(root.history || root.versions),
    notices: arr(root.notices || root.warnings),
    hasProvenance: Boolean(root.hasProvenance),
    approvedTruthUnavailable: Boolean(root.approvedTruthUnavailable),
    readiness: obj(root.readiness || root.runtimeReadiness),
    sourceSummary: obj(root.sourceSummary),
    metadata: obj(root.metadata),
    governance: obj(root.governance),
    finalizeImpact: obj(root.finalizeImpact),
  };
}

function normalizeReviewWorkbenchPayload(payload = {}) {
  const root = obj(payload?.data || payload?.workbench || payload);

  return {
    tenantId: text(root.tenantId),
    tenantKey: text(root.tenantKey),
    viewerRole: text(root.viewerRole).toLowerCase(),
    count: n(root.count),
    summary: {
      total: n(root.summary?.total),
      pending: n(root.summary?.pending),
      quarantined: n(root.summary?.quarantined),
      conflicting: n(root.summary?.conflicting),
      autoApprovable: n(root.summary?.autoApprovable),
      blockedHighRisk: n(root.summary?.blockedHighRisk),
      highRisk: n(root.summary?.highRisk || root.summary?.blockedHighRisk),
    },
    items: arr(root.items).map((item) => {
      const current = obj(item);
      return {
        id: text(current.id || current.candidateId || current.candidate_id),
        candidateId: text(
          current.candidateId || current.candidate_id || current.id
        ),
        title: text(current.title || current.valueText || "Candidate"),
        valueText: text(current.valueText || current.value_text),
        normalizedText: text(current.normalizedText || current.normalized_text),
        status: text(current.status).toLowerCase(),
        queueBucket: text(current.queueBucket || current.queue_bucket).toLowerCase(),
        source: obj(current.source),
        review: obj(current.review),
        approvalPolicy: obj(current.approvalPolicy || current.approval_policy),
        actions: arr(current.actions),
      };
    }),
  };
}

function normalizeCompareDetail(payload = {}, fallbackItem = {}) {
  const root = obj(payload?.data || payload?.detail || payload);
  const versionId = getHistoryVersionId(fallbackItem);

  const changedFields = arr(root.changedFields || root.changed_fields);
  const fieldChanges = arr(root.fieldChanges || root.field_changes);
  const sectionChanges = arr(root.sectionChanges || root.section_changes);
  const versionDiff = obj(root.versionDiff || root.version_diff || root.diff);

  return {
    ...root,
    selectedVersion:
      root.selectedVersion ||
      root.version ||
      root.truthVersion ||
      root.selected ||
      fallbackItem,
    comparedVersion:
      root.comparedVersion ||
      root.compareToVersion ||
      root.previousVersion ||
      root.compared ||
      {},
    currentVersion:
      root.currentVersion ||
      root.currentApprovedVersion ||
      root.current ||
      {},
    changedFields,
    fieldChanges,
    sectionChanges,
    versionDiff,
    rollbackPreview: obj(root.rollbackPreview || root.rollback_preview),
    rollbackAction: obj(root.rollbackAction || root.rollback_action),
    hasStructuredDiff:
      root.hasStructuredDiff !== false &&
      Boolean(
        root.hasStructuredDiff ||
          changedFields.length ||
          fieldChanges.length ||
          sectionChanges.length ||
          Object.keys(versionDiff).length
      ),
    selectedVersionId: text(root.selectedVersionId || versionId),
  };
}

function groupBusinessRows(fields = []) {
  const identity = [
    {
      key: "companyName",
      label: "Business name",
      icon: Building2,
      value: fieldValue(fields, "companyName"),
      hint: fieldProvenance(fields, "companyName"),
    },
    {
      key: "description",
      label: "Summary",
      icon: Sparkles,
      value:
        fieldValue(fields, "description") ||
        fieldValue(fields, "summaryShort") ||
        fieldValue(fields, "shortDescription"),
      hint:
        fieldProvenance(fields, "description") ||
        fieldProvenance(fields, "summaryShort") ||
        fieldProvenance(fields, "shortDescription"),
      multiline: true,
    },
    {
      key: "mainLanguage",
      label: "Language",
      icon: User2,
      value: fieldValue(fields, "mainLanguage"),
      hint: fieldProvenance(fields, "mainLanguage"),
    },
  ].filter((item) => text(item.value));

  const contact = [
    {
      key: "primaryPhone",
      label: "Phone",
      icon: Phone,
      value: fieldValue(fields, "primaryPhone"),
      hint: fieldProvenance(fields, "primaryPhone"),
    },
    {
      key: "primaryEmail",
      label: "Email",
      icon: Mail,
      value: fieldValue(fields, "primaryEmail"),
      hint: fieldProvenance(fields, "primaryEmail"),
    },
    {
      key: "primaryAddress",
      label: "Address",
      icon: MapPin,
      value: fieldValue(fields, "primaryAddress"),
      hint: fieldProvenance(fields, "primaryAddress"),
      multiline: true,
    },
  ].filter((item) => text(item.value));

  const presence = [
    {
      key: "websiteUrl",
      label: "Website",
      icon: Globe,
      value: fieldValue(fields, "websiteUrl"),
      hint: fieldProvenance(fields, "websiteUrl"),
      multiline: true,
    },
    {
      key: "socialLinks",
      label: "Social",
      icon: Globe,
      value: fieldValue(fields, "socialLinks"),
      hint: fieldProvenance(fields, "socialLinks"),
      multiline: true,
    },
  ].filter((item) => text(item.value));

  const offering = [
    {
      key: "services",
      label: "Services",
      icon: Sparkles,
      value: fieldValue(fields, "services"),
      hint: fieldProvenance(fields, "services"),
      multiline: true,
    },
    {
      key: "products",
      label: "Products",
      icon: Sparkles,
      value: fieldValue(fields, "products"),
      hint: fieldProvenance(fields, "products"),
      multiline: true,
    },
    {
      key: "pricingHints",
      label: "Pricing",
      icon: Sparkles,
      value:
        fieldValue(fields, "pricingHints") ||
        fieldValue(fields, "pricingPolicy") ||
        fieldValue(fields, "pricingSummary"),
      hint:
        fieldProvenance(fields, "pricingHints") ||
        fieldProvenance(fields, "pricingPolicy") ||
        fieldProvenance(fields, "pricingSummary"),
      multiline: true,
    },
    {
      key: "hours",
      label: "Hours",
      icon: Sparkles,
      value: fieldValue(fields, "hours"),
      hint: fieldProvenance(fields, "hours"),
      multiline: true,
    },
    {
      key: "faqQuestions",
      label: "FAQ",
      icon: Sparkles,
      value: fieldValue(fields, "faqQuestions"),
      hint: fieldProvenance(fields, "faqQuestions"),
      multiline: true,
    },
  ].filter((item) => text(item.value));

  return { identity, contact, presence, offering };
}

function groupBehaviorRows(fields = []) {
  const core = [
    {
      key: "greetingBehaviorSummary",
      label: "Greeting",
      icon: Sparkles,
      value:
        fieldValue(fields, "greetingBehaviorSummary") ||
        fieldValue(fields, "greetingStyle"),
      hint:
        fieldProvenance(fields, "greetingBehaviorSummary") ||
        fieldProvenance(fields, "greetingStyle"),
      multiline: true,
    },
    {
      key: "closingBehaviorSummary",
      label: "Closing",
      icon: Sparkles,
      value: fieldValue(fields, "closingBehaviorSummary"),
      hint: fieldProvenance(fields, "closingBehaviorSummary"),
      multiline: true,
    },
    {
      key: "toneBehaviorSummary",
      label: "Tone",
      icon: ShieldCheck,
      value:
        fieldValue(fields, "toneBehaviorSummary") || fieldValue(fields, "tone"),
      hint:
        fieldProvenance(fields, "toneBehaviorSummary") ||
        fieldProvenance(fields, "tone"),
      multiline: true,
    },
    {
      key: "afterHoursBehavior",
      label: "After-hours",
      icon: ShieldAlert,
      value: fieldValue(fields, "afterHoursBehavior"),
      hint: fieldProvenance(fields, "afterHoursBehavior"),
      multiline: true,
    },
  ].filter((item) => text(item.value));

  const routing = [
    {
      key: "pricingBehaviorSummary",
      label: "Pricing response",
      icon: Sparkles,
      value: fieldValue(fields, "pricingBehaviorSummary"),
      hint: fieldProvenance(fields, "pricingBehaviorSummary"),
      multiline: true,
    },
    {
      key: "locationBehaviorSummary",
      label: "Location response",
      icon: MapPin,
      value: fieldValue(fields, "locationBehaviorSummary"),
      hint: fieldProvenance(fields, "locationBehaviorSummary"),
      multiline: true,
    },
    {
      key: "bookingBehaviorSummary",
      label: "Booking routing",
      icon: Sparkles,
      value: fieldValue(fields, "bookingBehaviorSummary"),
      hint: fieldProvenance(fields, "bookingBehaviorSummary"),
      multiline: true,
    },
    {
      key: "contactBehaviorSummary",
      label: "Contact preference",
      icon: Phone,
      value: fieldValue(fields, "contactBehaviorSummary"),
      hint: fieldProvenance(fields, "contactBehaviorSummary"),
      multiline: true,
    },
    {
      key: "handoffBehaviorSummary",
      label: "Handoff behavior",
      icon: Wrench,
      value: fieldValue(fields, "handoffBehaviorSummary"),
      hint: fieldProvenance(fields, "handoffBehaviorSummary"),
      multiline: true,
    },
  ].filter((item) => text(item.value));

  return { core, routing };
}

function buildSourceRows(data = {}) {
  const fields = arr(data.fields);
  const sourceSummary = obj(data.sourceSummary);
  const latestImport = obj(sourceSummary.latestImport);

  const primaryRows = [
    {
      label: "Latest source",
      value: text(
        latestImport.sourceLabel ||
          latestImport.sourceType ||
          sourceSummary.primaryLabel ||
          sourceSummary.primarySourceType
      ),
    },
    {
      label: "Source URL",
      value: text(
        latestImport.sourceUrl ||
          sourceSummary.primaryUrl ||
          sourceSummary.primarySourceUrl
      ),
    },
    {
      label: "Provenance",
      value: data.hasProvenance ? "Available" : "Not returned",
    },
  ].filter((item) => text(item.value));

  const provenanceRows = fields
    .filter((field) => text(field?.provenance))
    .map((field) => ({
      key: text(field.key || field.label),
      label: text(field.label || field.key),
      value: text(field.value),
      provenance: text(field.provenance),
    }));

  return {
    primaryRows,
    provenanceRows,
  };
}

function StatusText({ tone = "neutral", children }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold">
      <span className={cx("h-1.5 w-1.5 rounded-full", toneDotClass(tone))} />
      <span className={toneTextClass(tone)}>{children}</span>
    </span>
  );
}

function FreeIcon({ icon: Icon, tone = "neutral", className }) {
  return (
    <Icon
      className={cx(
        "h-[20px] w-[20px] shrink-0",
        toneTextClass(tone),
        className
      )}
      strokeWidth={2.05}
    />
  );
}

function EmptyLine({ children = "Nothing approved yet." }) {
  return (
    <div className="py-2 text-[13px] font-medium leading-6 text-text-subtle">
      {children}
    </div>
  );
}

function InfoHint({ text: message = "", align = "right" }) {
  const safe = text(message);
  if (!safe) return null;

  return (
    <span className="group relative inline-flex shrink-0">
      <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-[7px] border border-line bg-surface text-[11px] font-semibold leading-none text-text-subtle transition-colors duration-base ease-premium hover:border-line-strong hover:text-text">
        i
      </span>

      <span
        className={cx(
          "pointer-events-none absolute top-[calc(100%+8px)] z-30 hidden w-[260px] rounded-[14px] border border-line-soft bg-surface px-3 py-2 text-[12px] font-medium leading-5 text-text-muted shadow-panel group-hover:block",
          align === "left"
            ? "left-0"
            : align === "center"
              ? "left-1/2 -translate-x-1/2"
              : "right-0"
        )}
      >
        {safe}
      </span>
    </span>
  );
}

function RecordRow({
  icon: Icon,
  label,
  value,
  hint = "",
  multiline = false,
  last = false,
}) {
  if (!text(value)) return null;

  return (
    <div
      className={cx(
        "grid grid-cols-[22px_minmax(0,1fr)_18px] gap-3 py-3",
        !last && "border-b border-line-soft"
      )}
    >
      <FreeIcon
        icon={Icon}
        tone="neutral"
        className="mt-[3px] h-[17px] w-[17px]"
      />

      <div className="min-w-0">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
          {label}
        </div>

        <div
          className={cx(
            "mt-1 text-[14px] font-semibold tracking-[var(--tracking-tight-md)] text-text",
            multiline ? "whitespace-pre-wrap break-words leading-6" : "leading-6"
          )}
        >
          {value}
        </div>
      </div>

      <div className="pt-[4px]">
        <InfoHint text={hint} align="right" />
      </div>
    </div>
  );
}

function RecordCard({ title, subtitle = "", rows = [], tone = "neutral" }) {
  return (
    <Card padded={false} clip>
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
              {title}
            </div>

            {subtitle ? (
              <div className="mt-1 text-[13px] font-medium leading-5 text-text-muted">
                {subtitle}
              </div>
            ) : null}
          </div>

          <span className={cx("mt-1 h-1.5 w-1.5 rounded-full", toneDotClass(tone))} />
        </div>

        <div className="mt-3">
          {arr(rows).length ? (
            rows.map((item, index) => (
              <RecordRow
                key={item.key}
                icon={item.icon}
                label={item.label}
                value={item.value}
                hint={item.hint}
                multiline={item.multiline}
                last={index === rows.length - 1}
              />
            ))
          ) : (
            <EmptyLine />
          )}
        </div>
      </div>
    </Card>
  );
}

function TabButton({ active = false, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className={cx(
        "relative inline-flex h-9 items-center px-2.5 text-[12.5px] font-semibold tracking-[var(--tracking-tight-sm)]",
        "transition-colors duration-base ease-premium",
        active ? "text-text" : "text-text-muted hover:text-text"
      )}
    >
      {children}
      <span
        className={cx(
          "absolute bottom-0 left-2 right-2 h-px rounded-full transition-opacity duration-base ease-premium",
          active ? "bg-brand opacity-100" : "bg-transparent opacity-0"
        )}
      />
    </button>
  );
}

function MetaLine({ approval, runtimeLabel, sourceLine, reviewSummary, history }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] font-medium leading-5 text-text-subtle">
      <span>
        <span className="text-text-muted">Version:</span>{" "}
        {text(approval?.version, "Pending")}
      </span>
      <span className="text-line-strong">/</span>
      <span>
        <span className="text-text-muted">Runtime:</span> {runtimeLabel}
      </span>
      <span className="text-line-strong">/</span>
      <span>
        <span className="text-text-muted">Approved:</span>{" "}
        {text(approval?.approvedAt) ? formatWhen(approval.approvedAt) : "Not available"}
      </span>
      <span className="text-line-strong">/</span>
      <span>
        <span className="text-text-muted">Source:</span>{" "}
        {text(sourceLine, "Not available")}
      </span>
      <span className="text-line-strong">/</span>
      <span>
        <span className="text-text-muted">Versions:</span>{" "}
        {String(arr(history).length)}
      </span>
      <span className="text-line-strong">/</span>
      <span>
        <span className="text-text-muted">Review:</span>{" "}
        {String(Number(reviewSummary.pending || 0))}
      </span>
    </div>
  );
}

function TruthHero({
  data,
  operationalState,
  runtimeLabel,
  sourceLine,
  reviewSummary,
  approvedTruthAvailable,
  onRefresh,
  refreshing = false,
}) {
  const approval = obj(data.approval);
  const history = arr(data.history);
  const tone = toneForStatus(operationalState.status || runtimeLabel);

  return (
    <Card padded={false} clip>
      <section className="grid xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 px-5 py-[18px] md:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
              Approved truth
            </div>

            <StatusText tone={tone}>{runtimeLabel}</StatusText>
          </div>

          <h1 aria-label="Business truth runtime" className="mt-3 max-w-[760px] font-display text-[32px] font-semibold leading-[1.02] tracking-[var(--tracking-tight-xl)] text-text md:text-[42px]">
            Business truth
          </h1>

          <p className="mt-2.5 max-w-[720px] text-[14.5px] font-medium leading-6 tracking-[var(--tracking-tight-sm)] text-text-muted">
            {approvedTruthAvailable
              ? compactSentence(
                  operationalState.summary ||
                    "Approved business truth is the source of runtime authority."
                )
              : "Create the approved business record before AI can use customer-facing facts."}
          </p>

          <div className="mt-4">
            <MetaLine
              approval={approval}
              runtimeLabel={runtimeLabel}
              sourceLine={sourceLine}
              reviewSummary={reviewSummary}
              history={history}
            />
          </div>
        </div>

        <div className="border-t border-line-soft px-5 py-4 xl:border-l xl:border-t-0">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.15em] text-text-subtle">
            Current record
          </div>

          <div className="mt-2 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
            {approvedTruthAvailable ? "Version active" : "Setup required"}
          </div>

          <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
            {approvedTruthAvailable && text(approval.approvedAt)
              ? `Approved ${formatShortWhen(approval.approvedAt)}`
              : "No approved business truth is published yet."}
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <Button
              type="button"
              size="md"
              variant={approvedTruthAvailable ? "primary" : "secondary"}
              className="min-w-[118px] justify-center"
              loading={refreshing}
              onClick={onRefresh}
            >
              <span className="inline-flex items-center gap-2"><RefreshCw className="h-4 w-4" strokeWidth={2.1} />Refresh</span>
            </Button>
          </div>
        </div>
      </section>
    </Card>
  );
}

function RuntimeStrip({ operationalState, runtimeLabel }) {
  const tone = toneForStatus(operationalState.status || runtimeLabel);
  const Icon = tone === "success" ? CheckCircle2 : CircleAlert;

  return (
    <Card padded={false} clip>
      <div className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5">
        <FreeIcon icon={Icon} tone={tone} />

        <div className="min-w-0">
          <div className="text-[15px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
            {text(operationalState.title, "Runtime status")}
          </div>

          <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
            {compactSentence(
              operationalState.detail ||
                operationalState.summary ||
                "Truth and runtime state are being checked."
            )}
          </div>
        </div>

        <StatusText tone={tone}>{runtimeLabel}</StatusText>
      </div>
    </Card>
  );
}

function ReviewPressureStrip({ summary = {}, onOpenReview }) {
  const total = reviewSummaryTotal(summary);

  if (!total) {
    return (
      <Card padded={false} clip>
        <button
          type="button"
          onClick={onOpenReview}
          className="group grid w-full grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 text-left transition-colors duration-base ease-premium hover:bg-surface-subtle"
        >
          <FreeIcon icon={CheckCircle2} tone="success" />

          <div className="min-w-0">
            <div className="text-[14.5px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              Review queue clear
            </div>

            <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
              No pending, conflicting, quarantined, or high-risk truth items.
            </div>
          </div>

          <ArrowRight
            className="h-4 w-4 text-text-subtle transition-colors duration-base ease-premium group-hover:text-text"
            strokeWidth={2.1}
          />
        </button>
      </Card>
    );
  }

  const items = [
    ["Pending", summary.pending, "warning"],
    ["Quarantined", summary.quarantined, "danger"],
    ["Conflicting", summary.conflicting, "warning"],
    ["Auto approvable", summary.autoApprovable, "success"],
    ["High risk", summary.highRisk || summary.blockedHighRisk, "danger"],
  ].filter(([, value]) => n(value) > 0);

  return (
    <Card padded={false} clip>
      <button
        type="button"
        onClick={onOpenReview}
        className="group w-full px-4 py-3.5 text-left transition-colors duration-base ease-premium hover:bg-surface-subtle"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FreeIcon icon={CircleAlert} tone="warning" />

            <div>
              <div className="text-[14.5px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                Review pressure
              </div>
              <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
                Some truth items need operator attention.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {items.map(([label, value, tone]) => (
              <span
                key={label}
                className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-text-muted"
              >
                <span
                  className={cx("h-1.5 w-1.5 rounded-full", toneDotClass(tone))}
                />
                <span>{label}</span>
                <span className={toneTextClass(tone)}>{n(value)}</span>
              </span>
            ))}

            <ArrowRight
              className="h-4 w-4 text-text-subtle transition-colors duration-base ease-premium group-hover:text-text"
              strokeWidth={2.1}
            />
          </div>
        </div>
      </button>
    </Card>
  );
}

function EmptyStep({ icon: Icon, title, detail, tone = "warning", last = false }) {
  return (
    <div
      className={cx(
        "min-w-0 px-4 py-4",
        !last && "border-b border-line-soft md:border-b-0 md:border-r"
      )}
    >
      <FreeIcon icon={Icon} tone={tone} className="h-[19px] w-[19px]" />

      <div className="mt-3 text-[13.5px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
        {title}
      </div>

      <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
        {detail}
      </div>
    </div>
  );
}

function EmptyTruthStartPanel({ onStartSetup, onOpenHome }) {
  return (
    <div className="space-y-4">
      <Card padded={false} clip>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="px-5 py-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
              Next action
            </div>

            <div className="mt-2 text-[23px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
              Publish the first business truth
            </div>

            <div className="mt-2 max-w-[720px] text-[13.5px] font-medium leading-6 text-text-muted">
              Add business facts, review the draft, then publish the approved record.
              The runtime stays guarded until that record exists.
            </div>
          </div>

          <div className="border-t border-line-soft px-5 py-5 lg:border-l lg:border-t-0">
            <Button
              type="button"
              size="md"
              className="w-full justify-center gap-2"
              onClick={onStartSetup}
            >
              <span className="inline-flex items-center gap-2">Start setup<ArrowRight className="h-4 w-4" strokeWidth={2.1} /></span>
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="md"
              className="mt-2.5 w-full justify-center"
              onClick={onOpenHome}
            >
              Open home
            </Button>
          </div>
        </div>
      </Card>

      <Card padded={false} clip>
        <div className="grid md:grid-cols-4">
          <EmptyStep
            icon={ShieldCheck}
            title="Business facts"
            detail="Name, contacts, services, tone, rules."
            tone="warning"
          />

          <EmptyStep
            icon={Globe}
            title="Sources"
            detail="Website, Instagram, Telegram, or manual input."
            tone="brand"
          />

          <EmptyStep
            icon={Sparkles}
            title="Review"
            detail="Edit the draft before it becomes canonical."
            tone="warning"
          />

          <EmptyStep
            icon={CheckCircle2}
            title="Runtime"
            detail="AI starts using only approved truth."
            tone="success"
            last
          />
        </div>
      </Card>
    </div>
  );
}

function Tabs({ activeTab, onChange }) {
  const tabs = [
    ["business", "Business"],
    ["behavior", "Behavior"],
    ["sources", "Sources"],
    ["versions", "Versions"],
    ["review", "Review queue"],
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-3 border-b border-line-soft px-1"
    >
      {tabs.map(([id, label]) => (
        <TabButton key={id} active={activeTab === id} onClick={() => onChange(id)}>
          {label}
        </TabButton>
      ))}
    </div>
  );
}

function BusinessTab({ groups }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <RecordCard
        title="Identity"
        subtitle="Approved public business identity."
        rows={groups.identity}
        tone={groups.identity.length ? "success" : "neutral"}
      />

      <RecordCard
        title="Contact"
        subtitle="Approved contact and location facts."
        rows={groups.contact}
        tone={groups.contact.length ? "success" : "neutral"}
      />

      <RecordCard
        title="Presence"
        subtitle="Approved online presence."
        rows={groups.presence}
        tone={groups.presence.length ? "success" : "neutral"}
      />

      <RecordCard
        title="Offering"
        subtitle="Services, products, pricing, hours, and FAQs."
        rows={groups.offering}
        tone={groups.offering.length ? "success" : "neutral"}
      />
    </div>
  );
}

function BehaviorTab({ groups }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <RecordCard
        title="Conversation behavior"
        subtitle="Approved customer-facing response style."
        rows={groups.core}
        tone={groups.core.length ? "success" : "neutral"}
      />

      <RecordCard
        title="Routing behavior"
        subtitle="Approved handling for pricing, booking, location, and handoff."
        rows={groups.routing}
        tone={groups.routing.length ? "success" : "neutral"}
      />
    </div>
  );
}

function SourcePrimaryRows({ rows = [] }) {
  if (!arr(rows).length) {
    return <EmptyLine>No source summary returned.</EmptyLine>;
  }

  return (
    <div className="divide-y divide-line-soft">
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid gap-2 py-3 md:grid-cols-[160px_minmax(0,1fr)]"
        >
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
            {row.label}
          </div>

          <div className="min-w-0 break-words text-[13.5px] font-semibold leading-6 text-text">
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProvenanceList({ rows = [] }) {
  if (!arr(rows).length) {
    return <EmptyLine>No field-level provenance returned.</EmptyLine>;
  }

  return (
    <div className="divide-y divide-line-soft">
      {rows.map((row) => (
        <div key={`${row.key}-${row.label}`} className="py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-[13.5px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
              {row.label}
            </div>

            {row.value ? (
              <div className="text-[12.5px] font-medium text-text-subtle">
                {row.value}
              </div>
            ) : null}
          </div>

          <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
            {row.provenance}
          </div>
        </div>
      ))}
    </div>
  );
}

function SourcesTab({ sourceRows }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
      <Card padded={false} clip>
        <div className="px-4 py-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            Source summary
          </div>
          <div className="mt-3">
            <SourcePrimaryRows rows={sourceRows.primaryRows} />
          </div>
        </div>
      </Card>

      <Card padded={false} clip>
        <div className="px-4 py-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            Provenance
          </div>
          <div className="mt-3">
            <ProvenanceList rows={sourceRows.provenanceRows} />
          </div>
        </div>
      </Card>
    </div>
  );
}

function VersionsList({ history = [], onOpenVersion }) {
  if (!arr(history).length) {
    return <EmptyLine>No approved truth versions are available yet.</EmptyLine>;
  }

  return (
    <div className="divide-y divide-line-soft">
      {arr(history).map((item) => {
        const key = text(item.id || item.version || item.versionId);
        const label = text(
          item.versionLabel || item.version || item.id || "Truth version"
        );

        return (
          <button
            key={key}
            type="button"
            onClick={() => onOpenVersion(item)}
            className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-3.5 text-left transition-colors duration-base ease-premium hover:bg-surface-subtle"
          >
            <span className="min-w-0 px-4">
              <span className="block text-[14.5px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                {label}
              </span>

              <span className="mt-1 block text-[12.5px] font-medium leading-5 text-text-muted">
                {text(item.diffSummary || item.sourceSummary || "Open compare view")}
              </span>

              <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-medium text-text-subtle">
                <span>Version: {text(item.version, "Unknown")}</span>
                <span className="text-line-strong">/</span>
                <span>Status: {text(item.profileStatus, "Unknown")}</span>
                <span className="text-line-strong">/</span>
                <span>
                  Approved:{" "}
                  {text(item.approvedAt) ? formatWhen(item.approvedAt) : "Unknown"}
                </span>
              </span>
            </span>

            <span className="mr-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-text-muted transition-colors duration-base ease-premium group-hover:text-text">
              Compare
              <ArrowRight className="h-4 w-4" strokeWidth={2.1} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function VersionsTab({ history, onOpenVersion }) {
  return (
    <Card padded={false} clip>
      <div className="px-4 py-3.5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
              Versions
            </div>
            <div className="mt-1 text-[13px] font-medium leading-5 text-text-muted">
              Approved business truth history and rollback preview.
            </div>
          </div>

          <FreeIcon icon={History} tone="brand" />
        </div>
      </div>

      <div className="border-t border-line-soft">
        <VersionsList history={history} onOpenVersion={onOpenVersion} />
      </div>
    </Card>
  );
}

function ReviewWorkbenchList({ items = [] }) {
  const safeItems = arr(items).slice(0, 12);

  if (!safeItems.length) {
    return <EmptyLine>No pending truth review items.</EmptyLine>;
  }

  return (
    <div className="divide-y divide-line-soft">
      {safeItems.map((item) => (
        <div
          key={text(item.id || item.candidateId || item.title)}
          className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3.5"
        >
          <div className="min-w-0">
            <div className="text-[14px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              {text(item.title || item.valueText || "Candidate")}
            </div>

            <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
              {compactSentence(
                item.valueText ||
                  item.normalizedText ||
                  item.review?.reviewReason,
                "Review item needs operator decision."
              )}
            </div>
          </div>

          <StatusText tone={item.status === "blocked" ? "danger" : "warning"}>
            {titleize(item.status || item.queueBucket || "pending")}
          </StatusText>
        </div>
      ))}
    </div>
  );
}

function ReviewTab({ summary = {}, items = [] }) {
  const reviewItems = [
    ["Pending", summary.pending, "warning"],
    ["Quarantined", summary.quarantined, "danger"],
    ["Conflicting", summary.conflicting, "warning"],
    ["Auto approvable", summary.autoApprovable, "success"],
    ["High risk", summary.highRisk || summary.blockedHighRisk, "danger"],
  ];

  return (
    <div className="space-y-4">
      <Card padded={false} clip>
        <div className="grid divide-y divide-line-soft md:grid-cols-5 md:divide-x md:divide-y-0">
          {reviewItems.map(([label, value, tone]) => (
            <div key={label} className="px-4 py-3.5">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                {label}
              </div>
              <div
                className={cx(
                  "mt-1.5 text-[23px] font-semibold leading-none tracking-[var(--tracking-tight-xl)]",
                  toneTextClass(n(value) > 0 ? tone : "neutral")
                )}
              >
                {n(value)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card padded={false} clip>
        <div className="px-4 py-3.5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
            Review items
          </div>
        </div>

        <div className="border-t border-line-soft px-4">
          <ReviewWorkbenchList items={items} />
        </div>
      </Card>
    </div>
  );
}

export default function TruthViewerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const workspace = useWorkspaceTenantKey();
  const refreshToken = useLaunchSliceRefreshToken(
    workspace.tenantKey,
    workspace.ready
  );

  const [state, setState] = useState(() => initialState(workspace.tenantKey));
  const [activeTab, setActiveTab] = useState("business");
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareState, setCompareState] = useState({
    loading: false,
    error: "",
    detail: null,
    rollbackSurface: {
      saving: false,
      error: "",
      saveSuccess: "",
      rollbackReceipt: null,
    },
  });

  const deepLinkHandledRef = useRef("");

  const loadTruth = useCallback(
    async ({ silent = false } = {}) => {
      if (!workspace.ready || !workspace.tenantKey) return;

      setState((current) => ({
        ...current,
        tenantKey: workspace.tenantKey,
        loading: silent ? current.loading : true,
        refreshing: silent,
        error: "",
      }));

      try {
        const [snapshotResult, workbenchResult, trustResult] =
          await Promise.allSettled([
            getCanonicalTruthSnapshot({ tenantKey: workspace.tenantKey }),
            getTruthReviewWorkbench({ tenantKey: workspace.tenantKey }),
            getSettingsTrustView({ tenantKey: workspace.tenantKey }),
          ]);

        if (snapshotResult.status === "rejected") {
          throw snapshotResult.reason;
        }

        const snapshot = normalizeSnapshotPayload(snapshotResult.value);
        const reviewWorkbench =
          workbenchResult.status === "fulfilled"
            ? normalizeReviewWorkbenchPayload(workbenchResult.value)
            : { summary: {}, items: [] };

        const trust =
          trustResult.status === "fulfilled" ? trustResult.value : null;

        setState({
          tenantKey: workspace.tenantKey,
          loading: false,
          refreshing: false,
          error: "",
          data: {
            ...snapshot,
            reviewWorkbench,
            trust,
          },
        });
      } catch (error) {
        setState((current) => ({
          ...current,
          loading: false,
          refreshing: false,
          error:
            error?.message ||
            error?.reason ||
            "Business truth could not be loaded.",
        }));
      }
    },
    [workspace.ready, workspace.tenantKey]
  );

  useEffect(() => {
    loadTruth();
  }, [loadTruth, refreshToken]);

  const data = state.data;
  const approvedTruthAvailable = hasApprovedTruth(data);
  const operationalState = useMemo(() => resolveOperationalState(data), [data]);
  const runtimeLabel = resolveRuntimeLabel(data, operationalState);
  const sourceLine = resolveSourceSummaryLine(data.sourceSummary);
  const reviewSummary = obj(data.reviewWorkbench?.summary);
  const businessGroups = useMemo(
    () => groupBusinessRows(data.fields),
    [data.fields]
  );
  const behaviorGroups = useMemo(
    () => groupBehaviorRows(data.fields),
    [data.fields]
  );
  const sourceRows = useMemo(() => buildSourceRows(data), [data]);

  const visibleNotices = arr(data.notices).filter(
    (notice) => !(data.approvedTruthUnavailable && isTruthUnavailableNotice(notice))
  );

  const openVersionDetail = useCallback(
    async (item = {}) => {
      const versionId = getHistoryVersionId(item);
      if (!versionId || !workspace.tenantKey) return;

      setCompareOpen(true);
      setCompareState({
        loading: true,
        error: "",
        detail: null,
        rollbackSurface: {
          saving: false,
          error: "",
          saveSuccess: "",
          rollbackReceipt: null,
        },
      });

      try {
        const detail = await getTruthVersionDetail({
          tenantKey: workspace.tenantKey,
          versionId,
          truthVersionId: versionId,
        });

        setCompareState({
          loading: false,
          error: "",
          detail: normalizeCompareDetail(detail, item),
          rollbackSurface: {
            saving: false,
            error: "",
            saveSuccess: "",
            rollbackReceipt: null,
          },
        });
      } catch (error) {
        setCompareState({
          loading: false,
          error:
            error?.message ||
            error?.reason ||
            "Truth version detail could not be loaded.",
          detail: null,
          rollbackSurface: {
            saving: false,
            error: "",
            saveSuccess: "",
            rollbackReceipt: null,
          },
        });
      }
    },
    [workspace.tenantKey]
  );

  useEffect(() => {
    if (state.loading || !arr(data.history).length) return;

    const requestedVersionId = resolveRequestedVersionId(searchParams, location);
    if (!requestedVersionId) return;
    if (deepLinkHandledRef.current === requestedVersionId) return;

    const item = findRequestedHistoryItem({
      history: arr(data.history),
      requestedVersionId,
      approval: data.approval,
    });

    if (!item) return;

    deepLinkHandledRef.current = requestedVersionId;
    openVersionDetail(item);
  }, [
    state.loading,
    data.history,
    data.approval,
    searchParams,
    location,
    openVersionDetail,
  ]);

  async function handleRefresh() {
    await loadTruth({ silent: true });
    emitLaunchSliceRefresh({
      tenantKey: workspace.tenantKey,
      reason: "truth_viewer_refresh",
    });
  }

  async function handleRollback(detail = null) {
    const selected = obj(detail?.selectedVersion);
    const versionId = text(
      detail?.selectedVersionId ||
        selected.id ||
        selected.versionId ||
        selected.truthVersionId ||
        selected.version
    );

    if (!versionId || !workspace.tenantKey) {
      setCompareState((current) => ({
        ...current,
        rollbackSurface: {
          ...current.rollbackSurface,
          error: "Rollback target version is unavailable.",
          saveSuccess: "",
        },
      }));
      return;
    }

    setCompareState((current) => ({
      ...current,
      rollbackSurface: {
        ...current.rollbackSurface,
        saving: true,
        error: "",
        saveSuccess: "",
      },
    }));

    try {
      const result = await rollbackTruthVersion(versionId, {
        tenantKey: workspace.tenantKey,
        truthVersionId: versionId,
      });

      const receipt =
        result?.rollbackReceipt ||
        result?.receipt ||
        result?.data?.rollbackReceipt ||
        result?.data?.receipt ||
        result;

      setCompareState((current) => ({
        ...current,
        rollbackSurface: {
          saving: false,
          error: "",
          saveSuccess: "Rollback request completed.",
          rollbackReceipt: receipt,
        },
      }));

      emitLaunchSliceRefresh({
        tenantKey: workspace.tenantKey,
        reason: "truth_rollback",
      });
      await loadTruth({ silent: true });
    } catch (error) {
      setCompareState((current) => ({
        ...current,
        rollbackSurface: {
          ...current.rollbackSurface,
          saving: false,
          error:
            error?.message ||
            error?.reason ||
            "Rollback request could not be completed.",
          saveSuccess: "",
        },
      }));
    }
  }

  if (state.loading) {
    return (
      <PageCanvas>
        <LoadingSurface title="Loading truth" />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas className="space-y-4 pt-3 md:pt-4">
      {state.error ? (
        <InlineNotice tone="danger" description={state.error} compact />
      ) : null}

      {visibleNotices.length ? (
        <div className="space-y-2">
          {visibleNotices.slice(0, 3).map((notice, index) => (
            <InlineNotice
              key={`${text(notice?.code || notice?.title || "notice")}-${index}`}
              tone={toneForStatus(notice?.tone || notice?.severity || "warning")}
              title={text(notice?.title)}
              description={compactSentence(
                notice?.description || notice?.message || notice
              )}
              compact
            />
          ))}
        </div>
      ) : null}

      <TruthHero
        data={data}
        operationalState={operationalState}
        runtimeLabel={runtimeLabel}
        sourceLine={sourceLine}
        reviewSummary={reviewSummary}
        approvedTruthAvailable={approvedTruthAvailable}
        onRefresh={handleRefresh}
        refreshing={state.refreshing}
      />

      {approvedTruthAvailable ? (
        <>
          <RuntimeStrip
            operationalState={operationalState}
            runtimeLabel={runtimeLabel}
          />

          <ReviewPressureStrip
            summary={reviewSummary}
            onOpenReview={() => setActiveTab("review")}
          />

          <Tabs activeTab={activeTab} onChange={setActiveTab} />

          {activeTab === "business" ? (
            <BusinessTab groups={businessGroups} />
          ) : null}

          {activeTab === "behavior" ? (
            <BehaviorTab groups={behaviorGroups} />
          ) : null}

          {activeTab === "sources" ? (
            <SourcesTab sourceRows={sourceRows} />
          ) : null}

          {activeTab === "versions" ? (
            <VersionsTab
              history={arr(data.history)}
              onOpenVersion={openVersionDetail}
            />
          ) : null}

          {activeTab === "review" ? (
            <ReviewTab
              summary={reviewSummary}
              items={arr(data.reviewWorkbench?.items)}
            />
          ) : null}
        </>
      ) : (
        <EmptyTruthStartPanel
          onOpenHome={() => navigate("/home")}
        />
      )}

      <TruthVersionComparePanel
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        loading={compareState.loading}
        error={compareState.error}
        detail={compareState.detail}
        versions={arr(data.history)}
        onSelectVersion={openVersionDetail}
        rollbackSurface={compareState.rollbackSurface}
        onRollback={handleRollback}
      />
    </PageCanvas>
  );
}