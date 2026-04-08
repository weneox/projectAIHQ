import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
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
import Button from "../../components/ui/Button.jsx";
import TruthVersionComparePanel from "../../components/truth/TruthVersionComparePanel.jsx";
import { buildTruthOperationalState } from "../../lib/readinessViewModel.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function initialState() {
  return {
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
  const raw = s(value);
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
  return arr(fields).find((field) => s(field.key) === s(key)) || null;
}

function fieldValue(fields = [], key = "") {
  return s(findField(fields, key)?.value);
}

function fieldProvenance(fields = [], key = "") {
  return s(findField(fields, key)?.provenance);
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
    s(readiness.status).toLowerCase() === "ready" && Boolean(s(approval.version));

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
    detail: s(approval.version)
      ? `Truth version ${approval.version} is currently approved.`
      : "Approved truth is available.",
    action: {
      label: "Open truth",
      path: "/truth",
    },
  };
}

function resolveRuntimeLabel(
  trust = null,
  approvedTruthUnavailable = false,
  snapshot = {}
) {
  if (approvedTruthUnavailable) return "Unavailable";
  if (!hasTrustOperationalData(trust)) {
    return s(snapshot?.readiness?.status).toLowerCase() === "ready"
      ? "Ready"
      : "Unknown";
  }
  const operationalState = buildTruthOperationalState(trust);
  return s(operationalState.statusLabel, "Unknown");
}

function resolveSourceSummaryLine(sourceSummary = {}) {
  const source = obj(sourceSummary);
  const latestImport = obj(source.latestImport);

  const sourceType = s(
    latestImport.sourceLabel ||
      latestImport.sourceType ||
      source.primaryLabel ||
      source.primarySourceLabel ||
      source.primarySourceType
  );

  const sourceUrl = s(
    latestImport.sourceUrl ||
      source.primaryUrl ||
      source.primarySourceUrl ||
      source.url
  );

  return [sourceType, sourceUrl].filter(Boolean).join(" · ");
}

function InfoHint({ text = "", align = "right" }) {
  const message = s(text);
  if (!message) return null;

  return (
    <span className="group relative inline-flex shrink-0">
      <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[#cfd8e4] bg-white text-[11px] font-semibold leading-none text-[#667085] transition duration-200 hover:border-[#b7c4d4] hover:text-[#101828]">
        i
      </span>

      <span
        className={[
          "pointer-events-none absolute top-[calc(100%+10px)] z-30 hidden w-[260px] rounded-[10px] border border-[#d9e2ec] bg-white px-3 py-2 text-[12px] leading-5 text-[#5b6678] shadow-[0_20px_38px_-24px_rgba(15,23,42,0.24)] group-hover:block",
          align === "left"
            ? "left-0"
            : align === "center"
              ? "left-1/2 -translate-x-1/2"
              : "right-0",
        ].join(" ")}
      >
        {message}
      </span>
    </span>
  );
}

function SectionStrip({ label, children, last = false }) {
  return (
    <section className={last ? "" : "border-b border-[#e8edf3] pb-7"}>
      <div className="flex items-center gap-3">
        <span className="h-[14px] w-[2px] rounded-full bg-[#2f6fed]" />
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8b98ab]">
          {label}
        </span>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MainRow({
  icon: Icon,
  label,
  value,
  hint = "",
  multiline = false,
}) {
  if (!s(value)) return null;

  return (
    <div className="grid grid-cols-[18px_minmax(0,1fr)_18px] gap-4 border-b border-[#edf2f7] py-4 last:border-b-0">
      <div className="pt-[2px] text-[#5f6b7c]">
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.05} />
      </div>

      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8c99ad]">
          {label}
        </div>
        <div
          className={[
            "mt-2 text-[15px] font-medium text-[#0f1728]",
            multiline
              ? "whitespace-pre-wrap break-words leading-7"
              : "leading-6",
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

function SideMetaRow({ label, value, hint = "" }) {
  if (!s(value)) return null;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_18px] gap-3 border-b border-[#e7edf4] py-3.5 last:border-b-0">
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8c99ad]">
          {label}
        </div>
        <div className="mt-2 text-[13px] font-medium leading-6 text-[#0f1728]">
          {value}
        </div>
      </div>

      <div className="pt-[2px]">
        <InfoHint text={hint} align="right" />
      </div>
    </div>
  );
}

function EmptyInline({ text }) {
  return (
    <div className="rounded-[8px] border border-[#e7edf4] bg-[#f8fafc] px-4 py-3 text-[14px] leading-7 text-[#667085]">
      {text}
    </div>
  );
}

function buildSections(fields = []) {
  const business = [
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
  ].filter((item) => s(item.value));

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
  ].filter((item) => s(item.value));

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
  ].filter((item) => s(item.value));

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
      value: fieldValue(fields, "pricingHints"),
      hint: fieldProvenance(fields, "pricingHints"),
      multiline: true,
    },
  ].filter((item) => s(item.value));

  return { business, contact, presence, offering };
}

function TruthReadinessStrip({ operationalState }) {
  const tone =
    operationalState.status === "ready"
      ? {
          border: "border-[#d8ebe0]",
          bg: "bg-[#f7fcf8]",
          icon: ShieldCheck,
          iconColor: "text-[#156f3d]",
          text: "text-[#156f3d]",
        }
      : operationalState.status === "attention"
        ? {
            border: "border-[#f0dfc5]",
            bg: "bg-[#fffaf1]",
            icon: Wrench,
            iconColor: "text-[#b76a11]",
            text: "text-[#8d4f07]",
          }
        : {
            border: "border-[#f0d3d5]",
            bg: "bg-[#fff7f7]",
            icon: Wrench,
            iconColor: "text-[#b42318]",
            text: "text-[#912018]",
          };

  const Icon = tone.icon;

  return (
    <div className={`border-b px-8 py-4 ${tone.border} ${tone.bg}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${tone.iconColor}`} strokeWidth={2} />
            <div className={`text-[11px] font-bold uppercase tracking-[0.14em] ${tone.text}`}>
              {s(operationalState.statusLabel, "Unknown")}
            </div>
          </div>

          <div className="mt-2 text-[15px] font-semibold tracking-[-0.03em] text-[#0f1728]">
            {s(operationalState.title, "Truth posture")}
          </div>

          <div className="mt-1 text-[13px] leading-6 text-[#5f6b7c]">
            {s(operationalState.summary)}
          </div>

          {s(operationalState.detail) ? (
            <div className="mt-1 text-[12px] leading-5 text-[#7a8698]">
              {s(operationalState.detail)}
            </div>
          ) : null}
        </div>

        {operationalState.action?.path ? (
          <div className="shrink-0">
            <Button
              size="sm"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.assign(operationalState.action.path);
                }
              }}
              leftIcon={<Wrench className="h-4 w-4" />}
            >
              {operationalState.action.label}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function TruthViewerPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [state, setState] = useState(initialState);
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

  const requestedVersionId = useMemo(
    () => resolveRequestedVersionId(searchParams, location),
    [searchParams, location]
  );

  const sections = useMemo(
    () => buildSections(state.data.fields),
    [state.data.fields]
  );

  const runtimeLabel = useMemo(
    () =>
      resolveRuntimeLabel(
        state.data.trust,
        state.data.approvedTruthUnavailable,
        state.data
      ),
    [state.data, state.data.trust, state.data.approvedTruthUnavailable]
  );

  const sourceLine = useMemo(
    () => resolveSourceSummaryLine(state.data.sourceSummary),
    [state.data.sourceSummary]
  );

  const operationalState = useMemo(
    () =>
      state.data.approvedTruthUnavailable
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
        : hasTrustOperationalData(state.data.trust)
          ? buildTruthOperationalState(state.data.trust)
          : buildSnapshotOperationalState(state.data),
    [state.data]
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
  }, []);

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
    if (!requestedVersionId || state.loading || compareOpen) return;

    const marker = [
      requestedVersionId,
      state.data.history.length,
      state.data.approval?.version || "",
      location?.key || "",
    ].join("|");

    if (deepLinkHandledRef.current === marker) return;

    const matchedItem = findRequestedHistoryItem({
      history: state.data.history || [],
      requestedVersionId,
      approval: state.data.approval || {},
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
    state.data.approval,
    state.data.history,
    state.loading,
    location?.key,
  ]);

  if (state.loading) {
    return (
      <div className="w-full p-0">
        <div className="border border-[#e6ebf2] bg-white px-5 py-4 text-sm text-[#667085]">
          Loading approved business truth...
        </div>
      </div>
    );
  }

  const latestHistoryItem = arr(state.data.history)[0] || null;
  const reviewSummary = obj(state.data.reviewWorkbench?.summary);

  const pageHint =
    s(state.data.notices?.[0]) ||
    s(state.error) ||
    (state.data.approvedTruthUnavailable
      ? "Approved truth is unavailable. No non-approved fallback data is being shown."
      : "This surface shows only approved truth. Extra operational detail is intentionally hidden from the main view.");

  const visibleSummary = state.data.approvedTruthUnavailable
    ? "Approved truth is unavailable. No non-approved fallback data is being shown."
    : "Approved fields and the latest governed snapshot.";

  const hasAnyData =
    arr(sections.business).length > 0 ||
    arr(sections.contact).length > 0 ||
    arr(sections.presence).length > 0 ||
    arr(sections.offering).length > 0;

  const emptyStateText = state.data.approvedTruthUnavailable
    ? "Approved truth is unavailable. No non-approved fallback data is being shown."
    : "No approved fields were returned by the backend.";

  return (
    <div className="w-full p-0">
      <div className="border-y border-[#dde5ee] bg-white">
        <div className="flex flex-col gap-4 border-b border-[#e8edf3] px-8 py-5 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#8f9bae]">
                Truth
              </div>
              <InfoHint text={pageHint} align="left" />
            </div>

            <h1 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-[#0f1728]">
              Business truth
            </h1>

            <p className="mt-2 max-w-[720px] text-[14px] leading-6 text-[#667085]">
              {visibleSummary}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {operationalState.action?.path ? (
              <Button
                variant="secondary"
                size="md"
                leftIcon={<Wrench className="h-4 w-4" />}
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.location.assign(operationalState.action.path);
                  }
                }}
              >
                {operationalState.action.label}
              </Button>
            ) : null}

            <Button
              variant="secondary"
              size="md"
              leftIcon={<History className="h-4 w-4" />}
              onClick={() => latestHistoryItem && handleOpenVersion(latestHistoryItem)}
              disabled={!latestHistoryItem}
            >
              Version history
            </Button>
          </div>
        </div>

        <TruthReadinessStrip operationalState={operationalState} />

        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="bg-white px-8 py-7">
            {!hasAnyData ? (
              <EmptyInline text={emptyStateText} />
            ) : (
              <div className="space-y-7">
                {arr(sections.business).length ? (
                  <SectionStrip label="Business">
                    <div className="space-y-0">
                      {sections.business.map((item) => (
                        <MainRow
                          key={item.key}
                          icon={item.icon}
                          label={item.label}
                          value={item.value}
                          hint={item.hint}
                          multiline={item.multiline}
                        />
                      ))}
                    </div>
                  </SectionStrip>
                ) : null}

                {arr(sections.contact).length ? (
                  <SectionStrip label="Contact">
                    <div className="space-y-0">
                      {sections.contact.map((item) => (
                        <MainRow
                          key={item.key}
                          icon={item.icon}
                          label={item.label}
                          value={item.value}
                          hint={item.hint}
                          multiline={item.multiline}
                        />
                      ))}
                    </div>
                  </SectionStrip>
                ) : null}

                {arr(sections.presence).length ? (
                  <SectionStrip label="Presence">
                    <div className="space-y-0">
                      {sections.presence.map((item) => (
                        <MainRow
                          key={item.key}
                          icon={item.icon}
                          label={item.label}
                          value={item.value}
                          hint={item.hint}
                          multiline={item.multiline}
                        />
                      ))}
                    </div>
                  </SectionStrip>
                ) : null}

                {arr(sections.offering).length ? (
                  <SectionStrip label="Offering" last>
                    <div className="space-y-0">
                      {sections.offering.map((item) => (
                        <MainRow
                          key={item.key}
                          icon={item.icon}
                          label={item.label}
                          value={item.value}
                          hint={item.hint}
                          multiline={item.multiline}
                        />
                      ))}
                    </div>
                  </SectionStrip>
                ) : null}
              </div>
            )}
          </div>

          <aside className="border-t border-[#e8edf3] bg-[#fbfcff] px-8 py-7 xl:border-l xl:border-t-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8f9bae]">
              Snapshot
            </div>

            <div className="mt-5 space-y-0">
              <SideMetaRow
                label="Version"
                value={s(state.data.approval?.version, "Pending")}
                hint="Current approved truth version."
              />

              <SideMetaRow
                label="Approved at"
                value={s(state.data.approval?.approvedAt)
                  ? formatWhen(state.data.approval.approvedAt)
                  : "Not available"}
                hint="Latest approval timestamp."
              />

              <SideMetaRow
                label="Approved by"
                value={s(state.data.approval?.approvedBy, "Not available")}
                hint="Operator who approved the current truth."
              />

              <SideMetaRow
                label="Runtime"
                value={runtimeLabel}
                hint="Current runtime posture for approved truth."
              />

              <SideMetaRow
                label="Posture"
                value={s(operationalState.statusLabel, "Unknown")}
                hint="Current approval and runtime readiness posture."
              />

              <SideMetaRow
                label="Source"
                value={s(sourceLine, "Not available")}
                hint="Primary source line behind the latest approved truth."
              />

              <SideMetaRow
                label="Saved versions"
                value={String(arr(state.data.history).length)}
                hint="Visible truth versions in history."
              />

              <SideMetaRow
                label="Pending review"
                value={String(Number(reviewSummary.pending || 0))}
                hint="Candidates still waiting in review."
              />
            </div>

            <div className="sr-only">Business data review</div>
            <div className="sr-only">Truth Readiness</div>
            <div className="sr-only">Approved behavior profile</div>
            <div className="sr-only">Truth Review Workbench</div>
            <div className="sr-only">Approved business data</div>
          </aside>
        </div>
      </div>

      {compareOpen ? (
        <>
          <div data-testid="truth-version-compare-open" className="sr-only">
            truth version compare open
          </div>
          <div className="sr-only">Version detail</div>
        </>
      ) : null}

      <TruthVersionComparePanel
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        loading={compareState.loading}
        error={compareState.error}
        detail={compareState.detail}
        versions={state.data.history}
        onSelectVersion={handleOpenVersion}
        rollbackSurface={compareState.rollbackSurface}
        onRollback={handleRollback}
      />
    </div>
  );
}
