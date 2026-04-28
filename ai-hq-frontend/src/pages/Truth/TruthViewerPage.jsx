import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Building2,
  Globe,
  History,
  Mail,
  MapPin,
  Phone,
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
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
  Surface,
} from "../../components/ui/AppShellPrimitives.jsx";
import TruthVersionComparePanel from "../../components/truth/TruthVersionComparePanel.jsx";
import useWorkspaceTenantKey from "../../hooks/useWorkspaceTenantKey.js";
import { compactSentence, toneFromReadiness } from "../../lib/appUi.js";
import {
  emitLaunchSliceRefresh,
  useLaunchSliceRefreshToken,
} from "../../lib/launchSliceRefresh.js";
import { buildTruthOperationalState } from "../../lib/readinessViewModel.js";

function text(value, fallback = "") {
  return String(value ?? fallback).trim();
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

function InfoHint({ text: message = "", align = "right" }) {
  const safe = text(message);
  if (!safe) return null;

  return (
    <span className="group relative inline-flex shrink-0">
      <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-line bg-surface text-[11px] font-semibold leading-none text-text-subtle transition-colors hover:border-line-strong hover:text-text">
        i
      </span>

      <span
        className={[
          "pointer-events-none absolute top-[calc(100%+8px)] z-30 hidden w-[260px] rounded-panel border border-line bg-surface px-3 py-2 text-[12px] leading-5 text-text-muted shadow-panel group-hover:block",
          align === "left"
            ? "left-0"
            : align === "center"
              ? "left-1/2 -translate-x-1/2"
              : "right-0",
        ].join(" ")}
      >
        {safe}
      </span>
    </span>
  );
}

function EmptyInline({ text: value }) {
  return (
    <div className="rounded-[18px] border border-line bg-surface-muted px-4 py-3 text-[14px] leading-6 text-text-muted">
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
      className={[
        "grid grid-cols-[18px_minmax(0,1fr)_18px] gap-4 py-3.5",
        !last && "border-b border-line-soft",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="pt-[2px] text-text-subtle">
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.05} />
      </div>

      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-subtle">
          {label}
        </div>
        <div
          className={[
            "mt-1.5 text-[14px] text-text",
            multiline ? "whitespace-pre-wrap break-words leading-6" : "leading-6",
          ].join(" ")}
        >
          {value}
        </div>
      </div>

      <div className="pt-[2px]">
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
      className={[
        "inline-flex h-9 items-center rounded-full px-3.5 text-[12px] font-medium tracking-[-0.01em] transition-colors",
        active
          ? "bg-slate-950 text-white"
          : "border border-line bg-white text-text-muted hover:border-line-strong hover:text-text",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function MetaLine({ approval, runtimeLabel, sourceLine, reviewSummary, history }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] leading-5 text-text-subtle">
      <span>
        <span className="text-text-muted">Version:</span>{" "}
        {text(approval?.version, "Pending")}
      </span>
      <span className="text-slate-300">•</span>
      <span>
        <span className="text-text-muted">Runtime:</span> {runtimeLabel}
      </span>
      <span className="text-slate-300">•</span>
      <span>
        <span className="text-text-muted">Approved:</span>{" "}
        {text(approval?.approvedAt) ? formatWhen(approval.approvedAt) : "Not available"}
      </span>
      <span className="text-slate-300">•</span>
      <span>
        <span className="text-text-muted">Source:</span>{" "}
        {text(sourceLine, "Not available")}
      </span>
      <span className="text-slate-300">•</span>
      <span>
        <span className="text-text-muted">Saved:</span> {String(arr(history).length)}
      </span>
      <span className="text-slate-300">•</span>
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
    <div className="rounded-[18px] border border-line-soft bg-white px-4 py-4">
      <div className="text-[12px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
        {title}
      </div>
      {subtitle ? (
        <div className="mt-1 text-[13px] leading-6 text-text-muted">{subtitle}</div>
      ) : null}
      <div className="mt-3">{children}</div>
    </div>
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
      {arr(history).map((item) => (
        <button
          key={text(item.id || item.version || item.versionId)}
          type="button"
          onClick={() => onOpenVersion(item)}
          className="w-full rounded-[18px] border border-line-soft bg-white px-4 py-4 text-left transition-colors hover:border-line-strong hover:bg-surface-muted"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[14px] font-semibold tracking-[-0.02em] text-text">
                {text(item.versionLabel || item.version || item.id || "Truth version")}
              </div>
              <div className="mt-1 text-[13px] leading-6 text-text-muted">
                {text(item.diffSummary || item.sourceSummary || "Open compare view")}
              </div>
            </div>

            <div className="shrink-0">
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
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-text-subtle">
            <span>Version: {text(item.version, "Unknown")}</span>
            <span className="text-slate-300">•</span>
            <span>Status: {text(item.profileStatus, "Unknown")}</span>
            <span className="text-slate-300">•</span>
            <span>Approved: {text(item.approvedAt) ? formatWhen(item.approvedAt) : "Unknown"}</span>
          </div>
        </button>
      ))}
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
        <div
          key={`${row.key}-${row.label}`}
          className="rounded-[16px] border border-line-soft bg-white px-4 py-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-[13px] font-medium text-text">{row.label}</div>
            {row.value ? (
              <Badge tone="neutral" variant="subtle">
                {row.value}
              </Badge>
            ) : null}
          </div>
          <div className="mt-2 text-[13px] leading-6 text-text-muted">
            {row.provenance}
          </div>
        </div>
      ))}
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
    if (!workspace.ready) {
      return initialState();
    }

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
    const trustData = trustResult.status === "fulfilled" ? trustResult.value : null;

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
    const versionId = normalizeTruthToken(
      item?.id || item?.versionId || item?.truthVersionId || item?.version || ""
    );
    const compareTo = normalizeTruthToken(
      item?.previousVersionId || item?.compareTo || ""
    );

    if (!versionId) return;

    setCompareOpen(true);
    setCompareState({
      loading: true,
      error: "",
      detail: {
        selectedVersion: {
          id: versionId,
          version: normalizeTruthToken(item?.version),
          versionLabel: normalizeTruthToken(item?.versionLabel),
          profileStatus: normalizeTruthToken(item?.profileStatus),
          approvedAt: normalizeTruthToken(item?.approvedAt),
          approvedBy: normalizeTruthToken(item?.approvedBy),
          sourceSummary: normalizeTruthToken(item?.sourceSummary),
        },
        comparedVersion: {
          id: compareTo,
        },
        changedFields: Array.isArray(item?.changedFields)
          ? item.changedFields
          : [],
        fieldChanges: Array.isArray(item?.fieldChanges)
          ? item.fieldChanges
          : [],
        sectionChanges: [],
        diffSummary: normalizeTruthToken(item?.diffSummary),
        hasStructuredDiff:
          !!normalizeTruthToken(item?.diffSummary) ||
          (Array.isArray(item?.changedFields) && item.changedFields.length > 0) ||
          (Array.isArray(item?.fieldChanges) && item.fieldChanges.length > 0),
      },
      rollbackSurface: {
        saving: false,
        error: "",
        saveSuccess: "",
        rollbackReceipt: null,
      },
    });

    try {
      const detail = await getTruthVersionDetail(versionId, { compareTo });

      setCompareState({
        loading: false,
        error: "",
        detail,
        rollbackSurface: {
          saving: false,
          error: "",
          saveSuccess: "",
          rollbackReceipt: null,
        },
      });
    } catch (error) {
      setCompareState((prev) => ({
        loading: false,
        error: String(
          error?.message || error || "Truth version detail could not be loaded."
        ),
        detail: prev.detail,
        rollbackSurface: prev.rollbackSurface,
      }));
    }
  }

  async function handleRollback(detail = {}) {
    const versionId = normalizeTruthToken(
      detail?.selectedVersion?.id ||
        detail?.rollbackPreview?.targetRollbackVersion?.id ||
        ""
    );

    if (!versionId) return;

    setCompareState((prev) => ({
      ...prev,
      rollbackSurface: {
        saving: true,
        error: "",
        saveSuccess: "",
        rollbackReceipt: prev.rollbackSurface?.rollbackReceipt || null,
      },
    }));

    try {
      const result = await rollbackTruthVersion(versionId, {
        metadataJson: {
          rollbackPreview: {
            rollbackDisposition:
              detail?.rollbackPreview?.rollbackDisposition || "",
            canonicalAreasChangedBack:
              detail?.rollbackPreview?.canonicalAreasChangedBack || [],
            runtimeAreasLikelyAffected:
              detail?.rollbackPreview?.runtimeAreasLikelyAffected || [],
            affectedSurfaces: detail?.rollbackPreview?.affectedSurfaces || [],
          },
        },
      });

      await refreshTruthSurface();
      emitLaunchSliceRefresh({
        tenantKey: workspace.tenantKey,
        reason: "truth-rollback",
      });

      const refreshed = await getTruthVersionDetail(versionId, {
        compareTo: detail?.comparedVersion?.id || "",
      });

      setCompareState({
        loading: false,
        error: "",
        detail: {
          ...refreshed,
          rollbackReceipt: result.rollbackReceipt || null,
        },
        rollbackSurface: {
          saving: false,
          error: "",
          saveSuccess:
            result?.rollbackReceipt?.rollbackStatus === "success"
              ? "Rollback completed."
              : "Rollback completed with follow-up telemetry.",
          rollbackReceipt: result.rollbackReceipt || null,
        },
      });
    } catch (error) {
      setCompareState((prev) => ({
        ...prev,
        rollbackSurface: {
          saving: false,
          error: String(error?.message || error || "Governed rollback failed."),
          saveSuccess: "",
          rollbackReceipt: prev.rollbackSurface?.rollbackReceipt || null,
        },
      }));
    }
  }

  useEffect(() => {
    if (!requestedVersionId || viewState.loading || compareOpen) return;

    const marker = [
      requestedVersionId,
      viewState.data.history.length,
      viewState.data.approval?.version || "",
      location?.key || "",
    ].join("|");

    if (deepLinkHandledRef.current === marker) return;

    const matchedItem = findRequestedHistoryItem({
      history: viewState.data.history || [],
      requestedVersionId,
      approval: viewState.data.approval || {},
    });

    deepLinkHandledRef.current = marker;

    if (matchedItem) {
      handleOpenVersion(matchedItem);
      return;
    }

    handleOpenVersion({
      id: requestedVersionId,
      versionId: requestedVersionId,
      truthVersionId: requestedVersionId,
      version: requestedVersionId,
    });
  }, [
    compareOpen,
    requestedVersionId,
    viewState.data.approval,
    viewState.data.history,
    viewState.loading,
    location?.key,
  ]);

  if (viewState.loading) {
    return (
      <PageCanvas>
        <LoadingSurface title="Loading truth" />
      </PageCanvas>
    );
  }

  const latestHistoryItem = arr(viewState.data.history)[0] || null;
  const reviewSummary = obj(viewState.data.reviewWorkbench?.summary);

  const pageHint =
    text(viewState.data.notices?.[0]) ||
    text(viewState.error) ||
    (viewState.data.approvedTruthUnavailable
      ? "Approved truth is unavailable. No non-approved fallback data is being shown."
      : "This surface shows only approved truth. Draft and review context stay separated from the main approved view.");

  const hasBusinessData =
    arr(businessGroups.identity).length > 0 ||
    arr(businessGroups.contact).length > 0 ||
    arr(businessGroups.presence).length > 0 ||
    arr(businessGroups.offering).length > 0;

  const hasBehaviorData =
    arr(behaviorGroups.core).length > 0 || arr(behaviorGroups.routing).length > 0;

  const emptyStateText = viewState.data.approvedTruthUnavailable
    ? "Approved truth is unavailable. No non-approved fallback data is being shown."
    : "No approved fields were returned by the backend.";

  return (
    <PageCanvas className="space-y-3">
      {text(viewState.error) ? (
        <InlineNotice
          tone="danger"
          title="Truth viewer unavailable"
          description={viewState.error}
          compact
        />
      ) : null}

      {!viewState.data.approvedTruthUnavailable &&
      lower(operationalState.status) !== "ready" ? (
        <InlineNotice
          tone={toneFromReadiness(operationalState)}
          title={text(operationalState.title, "Truth posture")}
          description={compactSentence(
            operationalState.summary,
            "Truth still needs review."
          )}
          compact
        />
      ) : null}

      <Surface padded="lg" className="rounded-[22px]">
        <div className="space-y-5">
          <div className="flex flex-col gap-4 border-b border-line-soft pb-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge tone={toneFromReadiness(operationalState)}>
                  {text(operationalState.statusLabel, "Truth")}
                </Badge>
                <div className="inline-flex items-center gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                    Truth
                  </div>
                  <InfoHint text={pageHint} align="left" />
                </div>
              </div>

              <h1 className="text-[1.55rem] font-semibold leading-tight tracking-[-0.03em] text-text md:text-[1.75rem]">
                Business truth
              </h1>

              <p className="mt-2 max-w-[760px] text-[14px] leading-6 text-text-muted">
                {viewState.data.approvedTruthUnavailable
                  ? "No fallback data is shown here."
                  : "Approved fields and the latest governed snapshot."}
              </p>

              <div className="mt-3">
                <MetaLine
                  approval={viewState.data.approval}
                  runtimeLabel={runtimeLabel}
                  sourceLine={sourceLine}
                  reviewSummary={reviewSummary}
                  history={viewState.data.history}
                />
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {operationalState.action?.path ? (
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Wrench className="h-4 w-4" />}
                  onClick={() => navigate(operationalState.action.path)}
                >
                  {operationalState.action.label}
                </Button>
              ) : null}

              <Button
                variant="secondary"
                size="sm"
                leftIcon={<History className="h-4 w-4" />}
                onClick={() => latestHistoryItem && handleOpenVersion(latestHistoryItem)}
                disabled={!latestHistoryItem}
              >
                Version history
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <TabButton
              active={activeTab === "business"}
              onClick={() => setActiveTab("business")}
            >
              Business
            </TabButton>
            <TabButton
              active={activeTab === "behavior"}
              onClick={() => setActiveTab("behavior")}
            >
              Behavior
            </TabButton>
            <TabButton
              active={activeTab === "sources"}
              onClick={() => setActiveTab("sources")}
            >
              Sources
            </TabButton>
            <TabButton
              active={activeTab === "versions"}
              onClick={() => setActiveTab("versions")}
            >
              Versions
            </TabButton>
          </div>

          {activeTab === "business" ? (
            !hasBusinessData ? (
              <EmptyInline text={emptyStateText} />
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                <SectionCard
                  title="Identity"
                  subtitle="The core business facts the AI can safely rely on."
                >
                  <RowsBlock rows={businessGroups.identity} />
                </SectionCard>

                <SectionCard
                  title="Contact"
                  subtitle="Primary customer-facing contact and location details."
                >
                  <RowsBlock rows={businessGroups.contact} />
                </SectionCard>

                <SectionCard
                  title="Presence"
                  subtitle="Approved website and public presence details."
                >
                  <RowsBlock rows={businessGroups.presence} />
                </SectionCard>

                <SectionCard
                  title="Offering"
                  subtitle="What the business offers, pricing hints, and operating facts."
                >
                  <RowsBlock rows={businessGroups.offering} />
                </SectionCard>
              </div>
            )
          ) : null}

          {activeTab === "behavior" ? (
            !hasBehaviorData ? (
              <EmptyInline text="No approved assistant-behavior fields are visible yet." />
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                <SectionCard
                  title="Core behavior"
                  subtitle="How the assistant should sound and frame the conversation."
                >
                  <RowsBlock rows={behaviorGroups.core} />
                </SectionCard>

                <SectionCard
                  title="Response behavior"
                  subtitle="How the assistant should handle pricing, location, booking, contact, and handoff."
                >
                  <RowsBlock rows={behaviorGroups.routing} />
                </SectionCard>
              </div>
            )
          ) : null}

          {activeTab === "sources" ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard
                title="Source summary"
                subtitle="Where the approved truth currently points for its primary source context."
              >
                {arr(sourceGroups.primaryRows).length ? (
                  <div className="space-y-3">
                    {sourceGroups.primaryRows.map((row) => (
                      <div
                        key={row.label}
                        className="rounded-[16px] border border-line-soft bg-white px-4 py-3"
                      >
                        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                          {row.label}
                        </div>
                        <div className="mt-1 text-[14px] leading-6 text-text">
                          {row.value}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyInline text="No source summary is visible yet." />
                )}
              </SectionCard>

              <SectionCard
                title="Field provenance"
                subtitle="Approved field-level provenance returned by the backend."
              >
                <ProvenanceList rows={sourceGroups.provenanceRows} />
              </SectionCard>
            </div>
          ) : null}

          {activeTab === "versions" ? (
            <SectionCard
              title="Approved versions"
              subtitle="Open compare view to inspect diffs, behavior changes, and rollback preview."
            >
              <VersionsList
                history={viewState.data.history}
                onOpenVersion={handleOpenVersion}
              />
            </SectionCard>
          ) : null}
        </div>
      </Surface>

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
