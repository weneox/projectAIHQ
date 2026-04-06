// ai-hq-frontend/src/pages/Truth/TruthViewerPage.jsx

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  Building2,
  Clock3,
  Globe,
  History,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import {
  getCanonicalTruthSnapshot,
  getTruthVersionDetail,
  rollbackTruthVersion,
} from "../../api/truth.js";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import TruthVersionComparePanel from "../../components/truth/TruthVersionComparePanel.jsx";

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
      behavior: { rows: [], summary: "", hasBehavior: false },
      history: [],
      notices: [],
      hasProvenance: false,
      approvedTruthUnavailable: false,
      readiness: {},
      sourceSummary: {},
      metadata: {},
      governance: {},
      finalizeImpact: {},
    },
  };
}

function normalizeTruthToken(value = "") {
  return String(value ?? "").trim();
}

function formatWhen(value = "") {
  const raw = s(value);
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}

function titleize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (x) => x.toUpperCase());
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

function compactUrl(value = "") {
  const text = s(value);
  if (!text) return "";
  return text.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function resolveRuntimeStatus(readiness = {}, approvedTruthUnavailable = false) {
  if (approvedTruthUnavailable) {
    return {
      label: "Unavailable",
      tone: "warning",
    };
  }

  const status = s(readiness?.status).toLowerCase();
  if (status === "ready") {
    return {
      label: "Ready",
      tone: "success",
    };
  }
  if (status === "blocked") {
    return {
      label: "Blocked",
      tone: "warning",
    };
  }
  if (status) {
    return {
      label: titleize(status),
      tone: "neutral",
    };
  }

  return {
    label: "Unknown",
    tone: "neutral",
  };
}

function resolveSourceLine(sourceSummary = {}) {
  const current = obj(sourceSummary);
  const latestImport = obj(current.latestImport);

  const label = s(
    latestImport.sourceLabel ||
      latestImport.sourceType ||
      current.primarySourceType ||
      current.primaryLabel ||
      current.primarySourceLabel
  );
  const url = s(
    latestImport.sourceUrl ||
      current.primarySourceUrl ||
      current.primaryUrl ||
      current.url
  );

  const bits = [label ? titleize(label) : "", compactUrl(url)].filter(Boolean);
  return bits.join(" · ");
}

function resolveHeroTitle(fields = []) {
  return (
    s(findField(fields, "companyName")?.value) ||
    s(findField(fields, "displayName")?.value) ||
    "Approved business data"
  );
}

function resolveHeroSummary(fields = []) {
  return (
    s(findField(fields, "description")?.value) ||
    s(findField(fields, "shortDescription")?.value) ||
    s(findField(fields, "summaryShort")?.value)
  );
}

function buildSections(fields = []) {
  const groups = [
    {
      id: "identity",
      title: "Identity",
      icon: Building2,
      keys: ["companyName", "description", "mainLanguage"],
    },
    {
      id: "contact",
      title: "Contact",
      icon: Phone,
      keys: ["primaryPhone", "primaryEmail", "primaryAddress"],
    },
    {
      id: "presence",
      title: "Presence",
      icon: Globe,
      keys: ["websiteUrl", "socialLinks"],
    },
    {
      id: "offering",
      title: "Offering",
      icon: Sparkles,
      keys: ["services", "products", "pricingHints"],
    },
  ];

  return groups
    .map((group) => ({
      ...group,
      rows: group.keys
        .map((key) => findField(fields, key))
        .filter(Boolean)
        .map((field) => ({
          key: s(field.key),
          label: s(field.label),
          value: s(field.value),
          provenance: s(field.provenance),
        })),
    }))
    .filter((group) => group.rows.length > 0);
}

function InfoPill({ label, value, compact = false }) {
  if (!s(value)) return null;

  return (
    <div
      className={[
        "rounded-[18px] border border-slate-200/80 bg-white/88 px-4 py-3",
        compact ? "min-h-[72px]" : "min-h-[84px]",
      ].join(" ")}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div
        className={[
          "mt-2 text-sm font-medium text-slate-900",
          compact ? "leading-5" : "leading-6",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function TruthRow({ label, value, provenance = "", showProvenance = false }) {
  if (!s(value)) return null;

  return (
    <div className="border-t border-slate-200/80 py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-[15px] leading-7 text-slate-900 whitespace-pre-wrap break-words">
        {value}
      </div>

      {showProvenance && s(provenance) ? (
        <div className="mt-2 text-[12px] leading-5 text-slate-500">
          {provenance}
        </div>
      ) : null}
    </div>
  );
}

function TruthSection({ title, icon: Icon, rows = [], showProvenance = false }) {
  if (!rows.length) return null;

  return (
    <div className="rounded-[22px] border border-slate-200/80 bg-white/82 p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-slate-200/80 bg-slate-50 text-slate-700">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="text-[16px] font-semibold tracking-[-0.02em] text-slate-950">
          {title}
        </div>
      </div>

      <div className="mt-5">
        {rows.map((row) => (
          <TruthRow
            key={row.key}
            label={row.label}
            value={row.value}
            provenance={row.provenance}
            showProvenance={showProvenance}
          />
        ))}
      </div>
    </div>
  );
}

export default function TruthViewerPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [state, setState] = useState(initialState);
  const [showProvenance, setShowProvenance] = useState(false);
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

  const heroTitle = useMemo(
    () => resolveHeroTitle(state.data.fields),
    [state.data.fields]
  );

  const heroSummary = useMemo(
    () => resolveHeroSummary(state.data.fields),
    [state.data.fields]
  );

  const runtimeState = useMemo(
    () =>
      resolveRuntimeStatus(
        state.data.readiness,
        state.data.approvedTruthUnavailable
      ),
    [state.data.readiness, state.data.approvedTruthUnavailable]
  );

  const sourceLine = useMemo(
    () => resolveSourceLine(state.data.sourceSummary),
    [state.data.sourceSummary]
  );

  async function refreshTruthSnapshot() {
    const truthData = await getCanonicalTruthSnapshot();

    setState({
      loading: false,
      error: "",
      data: {
        fields: truthData.fields || [],
        approval: truthData.approval || {},
        behavior:
          truthData.behavior || { rows: [], summary: "", hasBehavior: false },
        history: truthData.history || [],
        notices: truthData.notices || [],
        hasProvenance: !!truthData.hasProvenance,
        approvedTruthUnavailable: !!truthData.approvedTruthUnavailable,
        readiness: truthData.readiness || {},
        sourceSummary: truthData.sourceSummary || {},
        metadata: truthData.metadata || {},
        governance: truthData.governance || {},
        finalizeImpact: truthData.finalizeImpact || {},
      },
    });
  }

  useEffect(() => {
    let alive = true;

    getCanonicalTruthSnapshot()
      .then((truthData) => {
        if (!alive) return;

        setState({
          loading: false,
          error: "",
          data: {
            fields: truthData.fields || [],
            approval: truthData.approval || {},
            behavior:
              truthData.behavior || { rows: [], summary: "", hasBehavior: false },
            history: truthData.history || [],
            notices: truthData.notices || [],
            hasProvenance: !!truthData.hasProvenance,
            approvedTruthUnavailable: !!truthData.approvedTruthUnavailable,
            readiness: truthData.readiness || {},
            sourceSummary: truthData.sourceSummary || {},
            metadata: truthData.metadata || {},
            governance: truthData.governance || {},
            finalizeImpact: truthData.finalizeImpact || {},
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

      await refreshTruthSnapshot();

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
      <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-[24px] border border-slate-200/80 bg-white/80 px-5 py-5 text-sm text-slate-500">
          Loading approved business truth...
        </div>
      </div>
    );
  }

  const latestHistoryItem = state.data.history?.[0] || null;
  const notice = s(state.data.notices?.[0]);
  const hasSections = sections.length > 0;
  const versionCount = arr(state.data.history).length;
  const approvedVersion = s(state.data.approval?.version);
  const approvedAt = s(state.data.approval?.approvedAt);
  const approvedBy = s(state.data.approval?.approvedBy);
  const reviewSensitive = state.data.governance?.quarantine === true;

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-10 sm:px-6 lg:px-8">
      <Card
        variant="elevated"
        className="overflow-hidden rounded-[30px] border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,250,252,0.88)_100%)] p-0"
      >
        <div className="border-b border-slate-200/80 px-6 py-6 sm:px-7 sm:py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Business data
              </div>
              <h1 className="mt-2 text-[32px] font-semibold tracking-[-0.05em] text-slate-950 sm:text-[38px]">
                Approved business data
              </h1>
              <div className="mt-4 text-[24px] font-semibold tracking-[-0.04em] text-slate-900">
                {heroTitle}
              </div>
              {heroSummary ? (
                <div className="mt-2 max-w-[760px] text-[15px] leading-7 text-slate-600">
                  {heroSummary}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="md"
                leftIcon={<History className="h-4 w-4" />}
                onClick={() => latestHistoryItem && handleOpenVersion(latestHistoryItem)}
                disabled={!latestHistoryItem}
              >
                History
              </Button>

              <Button
                variant={showProvenance ? "soft" : "outline"}
                size="md"
                leftIcon={<ShieldCheck className="h-4 w-4" />}
                onClick={() => setShowProvenance((value) => !value)}
              >
                {showProvenance ? "Hide evidence" : "Show evidence"}
              </Button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Badge
              tone={state.data.approvedTruthUnavailable ? "warning" : "success"}
              variant="subtle"
              dot
            >
              {state.data.approvedTruthUnavailable
                ? "Approved truth unavailable"
                : "Approved truth active"}
            </Badge>

            <Badge tone={runtimeState.tone} variant="subtle" dot>
              Runtime {runtimeState.label}
            </Badge>

            {reviewSensitive ? (
              <Badge tone="warning" variant="subtle" dot>
                Review-sensitive
              </Badge>
            ) : null}

            <Badge tone="neutral" variant="subtle">
              {versionCount} version{versionCount === 1 ? "" : "s"}
            </Badge>
          </div>

          {state.error ? (
            <div className="mt-5 rounded-[16px] border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm leading-6 text-rose-700">
              {state.error}
            </div>
          ) : null}

          {!state.error && notice ? (
            <div className="mt-5 rounded-[16px] border border-slate-200/80 bg-white/78 px-4 py-3 text-sm leading-6 text-slate-600">
              {notice}
            </div>
          ) : null}
        </div>

        <div className="px-6 py-6 sm:px-7 sm:py-7">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoPill label="Version" value={approvedVersion || "Pending"} compact />
            <InfoPill label="Approved at" value={approvedAt ? formatWhen(approvedAt) : ""} compact />
            <InfoPill label="Approved by" value={approvedBy} compact />
            <InfoPill
              label="Source"
              value={sourceLine || compactUrl(findField(state.data.fields, "websiteUrl")?.value)}
              compact
            />
          </div>

          <div className="mt-6 grid gap-4 xl:grid-cols-2">
            {hasSections ? (
              sections.map((section) => (
                <TruthSection
                  key={section.id}
                  title={section.title}
                  icon={section.icon}
                  rows={section.rows}
                  showProvenance={showProvenance}
                />
              ))
            ) : (
              <div className="xl:col-span-2">
                <div className="rounded-[22px] border border-slate-200/80 bg-white/82 px-5 py-6 text-sm leading-6 text-slate-500">
                  No approved business fields were returned by the backend.
                </div>
              </div>
            )}
          </div>

          {(sourceLine || approvedAt || versionCount > 0) && !state.error ? (
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] leading-5 text-slate-500">
              {sourceLine ? (
                <div className="inline-flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5" />
                  <span>{sourceLine}</span>
                </div>
              ) : null}

              {approvedAt ? (
                <div className="inline-flex items-center gap-2">
                  <Clock3 className="h-3.5 w-3.5" />
                  <span>{formatWhen(approvedAt)}</span>
                </div>
              ) : null}

              {versionCount > 0 ? (
                <div className="inline-flex items-center gap-2">
                  <History className="h-3.5 w-3.5" />
                  <span>
                    {versionCount} saved version{versionCount === 1 ? "" : "s"}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

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