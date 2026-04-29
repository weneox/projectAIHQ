import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
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
import Badge from "../../components/ui/Badge.jsx";
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

function initialState(tenantKey = "") {
  return {
    tenantKey,
    loading: true,
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
      statusLabel: "Approval required",
      title: "Approved truth is unavailable.",
      summary:
        "No non-approved fallback data is being shown. Continue setup or truth review before trusting runtime.",
      detail:
        "This page is intentionally fail-closed when approved truth is unavailable.",
      action: {
        label: "Continue AI setup",
        path: "/home?assistant=setup",
      },
    };
  }

  return {
    truthReady: true,
    runtimeReady: true,
    status: "ready",
    statusLabel: "Healthy",
    title: "Approved truth is available.",
    summary: "Approved truth is present, and no blocker is visible from this page.",
    detail: text(approval.version)
      ? `Truth version ${approval.version} is currently approved.`
      : "Approved truth is available.",
    action: null,
  };
}

function resolveRuntimeLabel(
  trust = null,
  approvedTruthUnavailable = false,
  snapshot = {}
) {
  if (approvedTruthUnavailable) return "Unavailable";

  if (!hasTrustOperationalData(trust)) {
    return lower(snapshot?.readiness?.status) === "ready" ? "Ready" : "Unknown";
  }

  const operationalState = buildTruthOperationalState(trust);
  return text(operationalState.statusLabel, "Unknown");
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

function dotClass(tone = "neutral") {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "brand" || tone === "info") return "bg-brand";
  return "bg-[rgb(var(--color-text-soft))]";
}

function titleize(value = "") {
  const safe = text(value);
  if (!safe) return "";

  return safe
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (item) => item.toUpperCase());
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

function EmptyInline({ text: value }) {
  return (
    <div className="rounded-[14px] border border-line-soft bg-surface-muted px-4 py-3 text-[13.5px] font-medium leading-6 text-text-muted">
      {value}
    </div>
  );
}

function MainRow({
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
        "grid grid-cols-[32px_minmax(0,1fr)_18px] gap-3 py-3.5",
        !last && "border-b border-line-soft"
      )}
    >
      <div className="pt-[2px] text-text-subtle">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-[11px] border border-line-soft bg-surface shadow-[var(--shadow-inset-top)]">
          <Icon className="h-[16px] w-[16px]" strokeWidth={2.05} />
        </span>
      </div>

      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
          {label}
        </div>

        <div
          className={cx(
            "mt-1.5 text-[14px] font-medium text-text",
            multiline ? "whitespace-pre-wrap break-words leading-6" : "leading-6"
          )}
        >
          {value}
        </div>
      </div>

      <div className="pt-[6px]">
        <InfoHint text={hint} align="right" />
      </div>
    </div>
  );
}

function TabButton({ active = false, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex h-9 items-center rounded-[11px] px-3.5 text-[12.5px] font-semibold tracking-[var(--tracking-tight-sm)]",
        "transition-[background-color,color,box-shadow] duration-base ease-premium",
        active
          ? "bg-surface text-text shadow-[var(--shadow-inset-top),0_12px_28px_-26px_rgba(15,23,42,0.22)]"
          : "text-text-muted hover:bg-surface-subtle hover:text-text"
      )}
    >
      {children}
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
        <span className="text-text-muted">Saved:</span>{" "}
        {String(arr(history).length)}
      </span>
      <span className="text-line-strong">/</span>
      <span>
        <span className="text-text-muted">Pending review:</span>{" "}
        {String(Number(reviewSummary.pending || 0))}
      </span>
    </div>
  );
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
      icon: ShieldCheck,
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
      icon: Sparkles,
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
      icon: Sparkles,
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
      label: "Latest source type",
      value: text(
        latestImport.sourceLabel ||
          latestImport.sourceType ||
          sourceSummary.primaryLabel ||
          sourceSummary.primarySourceType
      ),
    },
    {
      label: "Latest source url",
      value: text(
        latestImport.sourceUrl ||
          sourceSummary.primaryUrl ||
          sourceSummary.primarySourceUrl
      ),
    },
    {
      label: "Has provenance",
      value: data.hasProvenance ? "Yes" : "No",
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

function SectionCard({ title, subtitle = "", children }) {
  return (
    <Card padded="sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
        {title}
      </div>

      {subtitle ? (
        <div className="mt-1 text-[13px] font-medium leading-6 text-text-muted">
          {subtitle}
        </div>
      ) : null}

      <div className="mt-3">{children}</div>
    </Card>
  );
}

function RowsBlock({ rows = [] }) {
  if (!arr(rows).length) {
    return <EmptyInline text="No approved fields are visible in this section yet." />;
  }

  return (
    <div>
      {rows.map((item, index) => (
        <MainRow
          key={item.key}
          icon={item.icon}
          label={item.label}
          value={item.value}
          hint={item.hint}
          multiline={item.multiline}
          last={index === rows.length - 1}
        />
      ))}
    </div>
  );
}

function VersionsList({ history = [], onOpenVersion }) {
  if (!arr(history).length) {
    return <EmptyInline text="No approved truth versions are available yet." />;
  }

  return (
    <div className="space-y-3">
      {arr(history).map((item) => {
        const key = text(item.id || item.version || item.versionId);
        const label = text(
          item.versionLabel || item.version || item.id || "Truth version"
        );

        return (
          <Card key={key} padded="sm" interactive>
            <button
              type="button"
              onClick={() => onOpenVersion(item)}
              className="w-full text-left"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                    {label}
                  </div>

                  <div className="mt-1 text-[13px] font-medium leading-6 text-text-muted">
                    {text(
                      item.diffSummary || item.sourceSummary || "Open compare view"
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenVersion(item);
                  }}
                >
                  Compare
                </Button>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-medium text-text-subtle">
                <span>Version: {text(item.version, "Unknown")}</span>
                <span className="text-line-strong">/</span>
                <span>Status: {text(item.profileStatus, "Unknown")}</span>
                <span className="text-line-strong">/</span>
                <span>
                  Approved:{" "}
                  {text(item.approvedAt) ? formatWhen(item.approvedAt) : "Unknown"}
                </span>
              </div>
            </button>
          </Card>
        );
      })}
    </div>
  );
}

function ProvenanceList({ rows = [] }) {
  if (!arr(rows).length) {
    return <EmptyInline text="No field-level provenance was returned by the backend." />;
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <Card key={`${row.key}-${row.label}`} padded="sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[13.5px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
              {row.label}
            </div>

            {row.value ? (
              <Badge tone="neutral" size="sm">
                {row.value}
              </Badge>
            ) : null}
          </div>

          <div className="mt-2 text-[13px] font-medium leading-6 text-text-muted">
            {row.provenance}
          </div>
        </Card>
      ))}
    </div>
  );
}

function SourcePrimaryRows({ rows = [] }) {
  if (!arr(rows).length) {
    return <EmptyInline text="No source summary was returned by the backend." />;
  }

  return (
    <div className="divide-y divide-line-soft">
      {rows.map((row) => (
        <div
          key={row.label}
          className="grid grid-cols-[170px_minmax(0,1fr)] gap-4 py-3"
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
            {row.label}
          </div>

          <div className="min-w-0 break-words text-[13.5px] font-medium leading-6 text-text">
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewSummary({ summary = {} }) {
  const items = [
    ["Pending", summary.pending, "warning"],
    ["Quarantined", summary.quarantined, "danger"],
    ["Conflicting", summary.conflicting, "warning"],
    ["Auto approvable", summary.autoApprovable, "success"],
    ["High risk", summary.highRisk || summary.blockedHighRisk, "danger"],
  ];

  return (
    <div className="grid gap-3 md:grid-cols-5">
      {items.map(([label, value, tone]) => (
        <Card key={label} padded="sm" tone={tone}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-text-subtle">
            {label}
          </div>

          <div className="mt-2 text-[22px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
            {Number(value || 0)}
          </div>
        </Card>
      ))}
    </div>
  );
}

function ReviewWorkbenchList({ items = [] }) {
  const safeItems = arr(items).slice(0, 12);

  if (!safeItems.length) {
    return <EmptyInline text="No pending truth review items were returned." />;
  }

  return (
    <div className="space-y-3">
      {safeItems.map((item) => (
        <Card key={text(item.id || item.candidateId || item.title)} padded="sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                {text(item.title || item.valueText || "Candidate")}
              </div>

              <div className="mt-1 text-[13px] font-medium leading-6 text-text-muted">
                {compactSentence(
                  item.valueText || item.normalizedText || item.review?.reviewReason,
                  "Review item needs operator decision."
                )}
              </div>
            </div>

            <Badge tone="neutral" size="sm">
              {titleize(item.status || item.queueBucket || "pending")}
            </Badge>
          </div>
        </Card>
      ))}
    </div>
  );
}

function normalizeCompareDetail(payload = {}, fallbackItem = {}) {
  const root = obj(payload);
  const versionId = getHistoryVersionId(fallbackItem);

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
    changedFields: arr(root.changedFields || root.changed_fields),
    fieldChanges: arr(root.fieldChanges || root.field_changes),
    sectionChanges: arr(root.sectionChanges || root.section_changes),
    versionDiff: obj(root.versionDiff || root.version_diff || root.diff),
    rollbackPreview: obj(root.rollbackPreview || root.rollback_preview),
    rollbackAction: obj(root.rollbackAction || root.rollback_action),
    hasStructuredDiff:
      root.hasStructuredDiff !== false &&
      Boolean(
        root.hasStructuredDiff ||
          arr(root.changedFields || root.changed_fields).length ||
          arr(root.fieldChanges || root.field_changes).length ||
          Object.keys(obj(root.versionDiff || root.version_diff || root.diff)).length
      ),
    selectedVersionId: text(root.selectedVersionId || versionId),
  };
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

  const [state, setState] = useState(initialState);
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

  const viewState = useMemo(() => {
    if (!workspace.ready) return initialState();

    if (state.tenantKey !== workspace.tenantKey) {
      return initialState(workspace.tenantKey);
    }

    return state;
  }, [state, workspace.ready, workspace.tenantKey]);

  const requestedVersionId = useMemo(
    () => resolveRequestedVersionId(searchParams, location),
    [searchParams, location]
  );

  const runtimeLabel = useMemo(
    () =>
      resolveRuntimeLabel(
        viewState.data.trust,
        viewState.data.approvedTruthUnavailable,
        viewState.data
      ),
    [viewState.data]
  );

  const sourceLine = useMemo(
    () => resolveSourceSummaryLine(viewState.data.sourceSummary),
    [viewState.data.sourceSummary]
  );

  const operationalState = useMemo(
    () =>
      viewState.data.approvedTruthUnavailable
        ? {
            truthReady: false,
            runtimeReady: false,
            status: "blocked",
            statusLabel: "Approval required",
            title: "Approved truth is unavailable.",
            summary:
              "No non-approved fallback data is being shown. Continue setup or truth review before trusting runtime.",
            detail:
              "This page is intentionally fail-closed when approved truth is unavailable.",
            action: {
              label: "Continue AI setup",
              path: "/home?assistant=setup",
            },
          }
        : hasTrustOperationalData(viewState.data.trust)
          ? buildTruthOperationalState(viewState.data.trust)
          : buildSnapshotOperationalState(viewState.data),
    [viewState.data]
  );

  const businessGroups = useMemo(
    () => groupBusinessRows(viewState.data.fields),
    [viewState.data.fields]
  );

  const behaviorGroups = useMemo(
    () => groupBehaviorRows(viewState.data.fields),
    [viewState.data.fields]
  );

  const sourceGroups = useMemo(
    () => buildSourceRows(viewState.data),
    [viewState.data]
  );

  async function refreshTruthSurface() {
    const [truthResult, reviewResult, trustResult] = await Promise.allSettled([
      getCanonicalTruthSnapshot(),
      getTruthReviewWorkbench({ limit: 100 }),
      getSettingsTrustView({ limit: 6 }),
    ]);

    if (truthResult.status !== "fulfilled") {
      throw truthResult.reason;
    }

    const truthData = truthResult.value || {};
    const reviewData =
      reviewResult.status === "fulfilled"
        ? reviewResult.value || { summary: {}, items: [] }
        : { summary: {}, items: [] };
    const trustData =
      trustResult.status === "fulfilled" ? trustResult.value : null;

    setState({
      tenantKey: workspace.tenantKey,
      loading: false,
      error: "",
      data: {
        fields: truthData.fields || [],
        approval: truthData.approval || {},
        history: truthData.history || [],
        notices: truthData.notices || [],
        hasProvenance: !!truthData.hasProvenance,
        approvedTruthUnavailable: !!truthData.approvedTruthUnavailable,
        readiness: truthData.readiness || {},
        sourceSummary: truthData.sourceSummary || {},
        metadata: truthData.metadata || {},
        governance: truthData.governance || {},
        finalizeImpact: truthData.finalizeImpact || {},
        reviewWorkbench: reviewData || { summary: {}, items: [] },
        trust: trustData,
      },
    });
  }

  useEffect(() => {
    let alive = true;

    setState((current) =>
      current.tenantKey === workspace.tenantKey
        ? {
            ...current,
            error: "",
          }
        : initialState(workspace.tenantKey)
    );

    if (!workspace.ready) {
      return () => {
        alive = false;
      };
    }

    Promise.allSettled([
      getCanonicalTruthSnapshot(),
      getTruthReviewWorkbench({ limit: 100 }),
      getSettingsTrustView({ limit: 6 }),
    ])
      .then((results) => {
        if (!alive) return;

        const truthResult = results[0];
        const reviewResult = results[1];
        const trustResult = results[2];

        if (truthResult.status !== "fulfilled") {
          throw truthResult.reason;
        }

        const truthData = truthResult.value || {};
        const reviewData =
          reviewResult.status === "fulfilled"
            ? reviewResult.value || { summary: {}, items: [] }
            : { summary: {}, items: [] };
        const trustData =
          trustResult.status === "fulfilled" ? trustResult.value : null;

        setState({
          tenantKey: workspace.tenantKey,
          loading: false,
          error: "",
          data: {
            fields: truthData.fields || [],
            approval: truthData.approval || {},
            history: truthData.history || [],
            notices: truthData.notices || [],
            hasProvenance: !!truthData.hasProvenance,
            approvedTruthUnavailable: !!truthData.approvedTruthUnavailable,
            readiness: truthData.readiness || {},
            sourceSummary: truthData.sourceSummary || {},
            metadata: truthData.metadata || {},
            governance: truthData.governance || {},
            finalizeImpact: truthData.finalizeImpact || {},
            reviewWorkbench: reviewData || { summary: {}, items: [] },
            trust: trustData,
          },
        });
      })
      .catch((error) => {
        if (!alive) return;

        setState({
          tenantKey: workspace.tenantKey,
          loading: false,
          error: String(
            error?.message || error || "Truth viewer could not be loaded."
          ),
          data: initialState().data,
        });
      });

    return () => {
      alive = false;
    };
  }, [refreshToken, workspace.ready, workspace.tenantKey]);

  async function handleOpenVersion(item = {}) {
    const versionId = getHistoryVersionId(item);
    const compareTo = normalizeTruthToken(
      item?.previousVersionId || item?.compareTo || ""
    );

    if (!versionId) return;

    setCompareOpen(true);
    setCompareState({
      loading: true,
      error: "",
      detail: normalizeCompareDetail(
        {
          selectedVersion: item,
          selectedVersionId: versionId,
        },
        item
      ),
      rollbackSurface: {
        saving: false,
        error: "",
        saveSuccess: "",
        rollbackReceipt: null,
      },
    });

    try {
      const payload = await getTruthVersionDetail(versionId, {
        compareTo: compareTo || undefined,
      });

      setCompareState((current) => ({
        ...current,
        loading: false,
        error: "",
        detail: normalizeCompareDetail(payload, item),
      }));
    } catch (error) {
      setCompareState((current) => ({
        ...current,
        loading: false,
        error: text(
          error?.message || error,
          "Truth version detail could not be loaded."
        ),
      }));
    }
  }

  async function handleRollback(detail = null) {
    const selected = obj(detail?.selectedVersion);
    const versionId = normalizeTruthToken(
      detail?.selectedVersionId ||
        selected?.id ||
        selected?.versionId ||
        selected?.truthVersionId ||
        selected?.version
    );

    if (!versionId) return;

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
      const receipt = await rollbackTruthVersion(versionId);

      setCompareState((current) => ({
        ...current,
        rollbackSurface: {
          saving: false,
          error: "",
          saveSuccess: "Rollback completed and truth runtime was refreshed.",
          rollbackReceipt: receipt?.rollbackReceipt || receipt || null,
        },
      }));

      emitLaunchSliceRefresh({
        tenantKey: workspace.tenantKey,
        reason: "truth-rollback",
      });

      await refreshTruthSurface();
    } catch (error) {
      setCompareState((current) => ({
        ...current,
        rollbackSurface: {
          ...current.rollbackSurface,
          saving: false,
          error: text(error?.message || error, "Rollback could not be completed."),
        },
      }));
    }
  }

  useEffect(() => {
    if (viewState.loading) return;
    if (!requestedVersionId) return;

    const signature = `${workspace.tenantKey}:${requestedVersionId}:${arr(
      viewState.data.history
    ).length}`;

    if (deepLinkHandledRef.current === signature) return;

    const item = findRequestedHistoryItem({
      history: arr(viewState.data.history),
      requestedVersionId,
      approval: viewState.data.approval,
    });

    if (!item) return;

    deepLinkHandledRef.current = signature;
    handleOpenVersion(item);
  }, [
    requestedVersionId,
    viewState.loading,
    viewState.data.history,
    viewState.data.approval,
    workspace.tenantKey,
  ]);

  const reviewSummary = obj(viewState.data.reviewWorkbench?.summary);
  const operationalTone = toneForStatus(
    operationalState.status || operationalState.statusLabel
  );

  if (!workspace.ready || viewState.loading) {
    return (
      <PageCanvas>
        <LoadingSurface title="Loading truth" />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas className="space-y-4">
      {viewState.error ? (
        <InlineNotice
          tone="danger"
          title="Truth viewer unavailable"
          description={viewState.error}
          compact
        />
      ) : null}

      {arr(viewState.data.notices).map((notice, index) => {
        const noticeObject =
          notice && typeof notice === "object" && !Array.isArray(notice)
            ? notice
            : {
                tone: "warning",
                title: "",
                message: String(notice || ""),
              };

        return (
          <InlineNotice
            key={`${text(noticeObject?.title || noticeObject?.message)}-${index}`}
            tone={lower(noticeObject?.tone || noticeObject?.type) || "info"}
            title={text(noticeObject?.title)}
            description={text(noticeObject?.message || noticeObject?.description)}
            compact
          />
        );
      })}

      <section className="border-b border-line-soft pb-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-[900px]">
            <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-brand">
              Approved truth
            </div>

            <h1 className="mt-3 font-display text-[32px] font-semibold leading-[1.02] tracking-[var(--tracking-tight-xl)] text-text md:text-[38px]">
              Business truth runtime
            </h1>

            <p className="mt-3 max-w-[760px] text-[15px] font-medium leading-7 tracking-[var(--tracking-tight-sm)] text-text-muted">
              {compactSentence(
                operationalState.summary,
                "Approved truth is the only source runtime can trust."
              )}
            </p>

            <div className="mt-4">
              <MetaLine
                approval={viewState.data.approval}
                runtimeLabel={runtimeLabel}
                sourceLine={sourceLine}
                reviewSummary={reviewSummary}
                history={viewState.data.history}
              />
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            {operationalState?.action?.path ? (
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => navigate(operationalState.action.path)}
                rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
              >
                {operationalState.action.label || "Continue setup"}
              </Button>
            ) : null}

            <Button
              type="button"
              size="md"
              onClick={() => {
                emitLaunchSliceRefresh({
                  tenantKey: workspace.tenantKey,
                  reason: "truth-refresh",
                });
                refreshTruthSurface();
              }}
              leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
            >
              Refresh
            </Button>
          </div>
        </div>
      </section>

      <Card padded="md" tone={operationalTone}>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span
              className={cx(
                "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border bg-surface shadow-[var(--shadow-inset-top)]",
                operationalTone === "success"
                  ? "border-[rgba(var(--color-success),0.18)] text-success"
                  : operationalTone === "danger"
                    ? "border-[rgba(var(--color-danger),0.18)] text-danger"
                    : "border-[rgba(var(--color-warning),0.18)] text-warning"
              )}
            >
              {operationalTone === "success" ? (
                <CheckCircle2 className="h-5 w-5" strokeWidth={2.1} />
              ) : (
                <ShieldAlert className="h-5 w-5" strokeWidth={2.1} />
              )}
            </span>

            <div className="min-w-0">
              <div className="text-[18px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                {operationalState.title || operationalState.statusLabel}
              </div>

              <div className="mt-1 text-[13.5px] font-medium leading-6 text-text-muted">
                {operationalState.detail || operationalState.summary}
              </div>
            </div>
          </div>

          <Badge tone={operationalTone} size="sm">
            <span className={cx("h-1.5 w-1.5 rounded-full", dotClass(operationalTone))} />
            {operationalState.statusLabel || titleize(operationalState.status)}
          </Badge>
        </div>
      </Card>

      <ReviewSummary summary={reviewSummary} />

      <div className="flex flex-wrap gap-2 rounded-[16px] border border-line-soft bg-surface-muted p-1.5">
        <TabButton active={activeTab === "business"} onClick={() => setActiveTab("business")}>
          Business
        </TabButton>
        <TabButton active={activeTab === "behavior"} onClick={() => setActiveTab("behavior")}>
          Behavior
        </TabButton>
        <TabButton active={activeTab === "sources"} onClick={() => setActiveTab("sources")}>
          Sources
        </TabButton>
        <TabButton active={activeTab === "versions"} onClick={() => setActiveTab("versions")}>
          Versions
        </TabButton>
        <TabButton active={activeTab === "review"} onClick={() => setActiveTab("review")}>
          Review queue
        </TabButton>
      </div>

      {activeTab === "business" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Identity" subtitle="Approved public business identity.">
            <RowsBlock rows={businessGroups.identity} />
          </SectionCard>

          <SectionCard title="Contact" subtitle="Approved contact and location facts.">
            <RowsBlock rows={businessGroups.contact} />
          </SectionCard>

          <SectionCard title="Presence" subtitle="Approved online presence.">
            <RowsBlock rows={businessGroups.presence} />
          </SectionCard>

          <SectionCard title="Offering" subtitle="Services, products, policies, and FAQs.">
            <RowsBlock rows={businessGroups.offering} />
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "behavior" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Conversation behavior" subtitle="How runtime should speak.">
            <RowsBlock rows={behaviorGroups.core} />
          </SectionCard>

          <SectionCard title="Routing behavior" subtitle="How runtime should route common asks.">
            <RowsBlock rows={behaviorGroups.routing} />
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "sources" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <SectionCard title="Source summary" subtitle="Latest source and provenance posture.">
            <SourcePrimaryRows rows={sourceGroups.primaryRows} />
          </SectionCard>

          <SectionCard title="Field provenance" subtitle="Evidence attached to approved fields.">
            <ProvenanceList rows={sourceGroups.provenanceRows} />
          </SectionCard>
        </div>
      ) : null}

      {activeTab === "versions" ? (
        <SectionCard title="Version history" subtitle="Durable approved truth versions.">
          <VersionsList
            history={viewState.data.history}
            onOpenVersion={handleOpenVersion}
          />
        </SectionCard>
      ) : null}

      {activeTab === "review" ? (
        <SectionCard title="Review workbench" subtitle="Pending truth candidates and conflicts.">
          <ReviewWorkbenchList items={viewState.data.reviewWorkbench?.items} />
        </SectionCard>
      ) : null}

      <TruthVersionComparePanel
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        loading={compareState.loading}
        error={compareState.error}
        detail={compareState.detail}
        versions={viewState.data.history}
        onSelectVersion={handleOpenVersion}
        rollbackSurface={compareState.rollbackSurface}
        onRollback={handleRollback}
      />
    </PageCanvas>
  );
}