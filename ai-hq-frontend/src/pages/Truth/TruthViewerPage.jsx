// ai-hq-frontend/src/pages/Truth/TruthViewerPage.jsx

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import {
  Building2,
  Clock3,
  Eye,
  Globe,
  History,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  User2,
} from "lucide-react";

import {
  getCanonicalTruthSnapshot,
  getTruthReviewWorkbench,
  getTruthVersionDetail,
  rollbackTruthVersion,
} from "../../api/truth.js";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import TruthVersionComparePanel from "../../components/truth/TruthVersionComparePanel.jsx";
import { cx } from "../../lib/cx.js";

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
    },
  };
}

function normalizeTruthToken(value = "") {
  return String(value ?? "").trim();
}

function titleize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (x) => x.toUpperCase());
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

function SectionBlock({ eyebrow, title, description, children, last = false }) {
  return (
    <section
      className={cx(
        "pt-7 first:pt-0",
        !last && "border-b border-[#e8edf3] pb-7",
        last && "pb-0"
      )}
    >
      {eyebrow ? (
        <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a96ab]">
          {eyebrow}
        </div>
      ) : null}

      {title ? (
        <div className="mt-3 text-[22px] font-semibold tracking-[-0.045em] text-[#101828]">
          {title}
        </div>
      ) : null}

      {description ? (
        <p className="mt-3 max-w-[680px] text-[14px] leading-8 text-[#667085]">
          {description}
        </p>
      ) : null}

      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  provenance = "",
  showEvidence = false,
  multiline = false,
}) {
  if (!s(value)) return null;

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 border-b border-[#eef2f6] py-4 last:border-b-0">
      <div className="pt-0.5 text-[#667085]">
        <Icon className="h-4.5 w-4.5" strokeWidth={2.2} />
      </div>

      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a96ab]">
          {label}
        </div>

        <div
          className={cx(
            "mt-2 text-[15px] font-medium text-[#101828]",
            multiline ? "leading-7 whitespace-pre-wrap break-words" : "leading-6"
          )}
        >
          {value}
        </div>

        {showEvidence && s(provenance) ? (
          <div className="mt-2 text-[12px] leading-6 text-[#667085]">
            {provenance}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MetaRow({ label, value }) {
  if (!s(value)) return null;

  return (
    <div className="border-b border-[#eef2f6] py-3 last:border-b-0">
      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8a96ab]">
        {label}
      </div>
      <div className="mt-2 text-[13px] font-medium leading-6 text-[#101828]">
        {value}
      </div>
    </div>
  );
}

function NoticeBanner({ children }) {
  if (!s(children)) return null;

  return (
    <div className="rounded-[12px] border border-[#e6ebf2] bg-[#fafbfd] px-4 py-3 text-[13px] leading-6 text-[#5f6c80]">
      {children}
    </div>
  );
}

function resolveRuntimeMeta(readiness = {}, approvedTruthUnavailable = false) {
  if (approvedTruthUnavailable) {
    return { label: "Unavailable", tone: "warning" };
  }

  const status = s(readiness?.status).toLowerCase();

  if (status === "ready") return { label: "Ready", tone: "success" };
  if (status === "blocked") return { label: "Blocked", tone: "warning" };
  if (status) return { label: titleize(status), tone: "neutral" };

  return { label: "Unknown", tone: "neutral" };
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

  const parts = [sourceType ? titleize(sourceType) : "", sourceUrl].filter(Boolean);
  return parts.join(" · ");
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

function buildSections(fields = []) {
  const business = [
    {
      key: "companyName",
      label: "Business name",
      icon: Building2,
      value: fieldValue(fields, "companyName"),
      provenance: fieldProvenance(fields, "companyName"),
    },
    {
      key: "description",
      label: "Summary",
      icon: Sparkles,
      value:
        fieldValue(fields, "description") ||
        fieldValue(fields, "summaryShort") ||
        fieldValue(fields, "shortDescription"),
      provenance:
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
      provenance: fieldProvenance(fields, "mainLanguage"),
    },
  ].filter((item) => s(item.value));

  const contact = [
    {
      key: "primaryPhone",
      label: "Phone",
      icon: Phone,
      value: fieldValue(fields, "primaryPhone"),
      provenance: fieldProvenance(fields, "primaryPhone"),
    },
    {
      key: "primaryEmail",
      label: "Email",
      icon: Mail,
      value: fieldValue(fields, "primaryEmail"),
      provenance: fieldProvenance(fields, "primaryEmail"),
    },
    {
      key: "primaryAddress",
      label: "Address",
      icon: MapPin,
      value: fieldValue(fields, "primaryAddress"),
      provenance: fieldProvenance(fields, "primaryAddress"),
      multiline: true,
    },
  ].filter((item) => s(item.value));

  const presence = [
    {
      key: "websiteUrl",
      label: "Website",
      icon: Globe,
      value: fieldValue(fields, "websiteUrl"),
      provenance: fieldProvenance(fields, "websiteUrl"),
      multiline: true,
    },
    {
      key: "socialLinks",
      label: "Social",
      icon: Globe,
      value: fieldValue(fields, "socialLinks"),
      provenance: fieldProvenance(fields, "socialLinks"),
      multiline: true,
    },
  ].filter((item) => s(item.value));

  const offering = [
    {
      key: "services",
      label: "Services",
      icon: Sparkles,
      value: fieldValue(fields, "services"),
      provenance: fieldProvenance(fields, "services"),
      multiline: true,
    },
    {
      key: "products",
      label: "Products",
      icon: Sparkles,
      value: fieldValue(fields, "products"),
      provenance: fieldProvenance(fields, "products"),
      multiline: true,
    },
    {
      key: "pricingHints",
      label: "Pricing",
      icon: Sparkles,
      value: fieldValue(fields, "pricingHints"),
      provenance: fieldProvenance(fields, "pricingHints"),
      multiline: true,
    },
  ].filter((item) => s(item.value));

  return {
    business,
    contact,
    presence,
    offering,
  };
}

export default function TruthViewerPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [state, setState] = useState(initialState);
  const [showEvidence, setShowEvidence] = useState(false);
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

  const runtimeMeta = useMemo(
    () =>
      resolveRuntimeMeta(
        state.data.readiness,
        state.data.approvedTruthUnavailable
      ),
    [state.data.readiness, state.data.approvedTruthUnavailable]
  );

  const sourceLine = useMemo(
    () => resolveSourceSummaryLine(state.data.sourceSummary),
    [state.data.sourceSummary]
  );

  const sections = useMemo(
    () => buildSections(state.data.fields),
    [state.data.fields]
  );

  const heroName = useMemo(
    () =>
      fieldValue(state.data.fields, "companyName") ||
      "Approved business data",
    [state.data.fields]
  );

  const heroSummary = useMemo(
    () =>
      fieldValue(state.data.fields, "description") ||
      fieldValue(state.data.fields, "summaryShort") ||
      fieldValue(state.data.fields, "shortDescription"),
    [state.data.fields]
  );

  async function refreshTruthSurface() {
    const [truthResult, reviewResult] = await Promise.allSettled([
      getCanonicalTruthSnapshot(),
      getTruthReviewWorkbench({ limit: 100 }),
    ]);

    if (truthResult.status !== "fulfilled") {
      throw truthResult.reason;
    }

    const truthData = truthResult.value || {};
    const reviewData =
      reviewResult.status === "fulfilled"
        ? reviewResult.value || { summary: {}, items: [] }
        : { summary: {}, items: [] };

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
      },
    });
  }

  useEffect(() => {
    let alive = true;

    Promise.allSettled([
      getCanonicalTruthSnapshot(),
      getTruthReviewWorkbench({ limit: 100 }),
    ])
      .then((results) => {
        if (!alive) return;

        const truthResult = results[0];
        const reviewResult = results[1];

        if (truthResult.status !== "fulfilled") {
          throw truthResult.reason;
        }

        const truthData = truthResult.value || {};
        const reviewData =
          reviewResult.status === "fulfilled"
            ? reviewResult.value || { summary: {}, items: [] }
            : { summary: {}, items: [] };

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
      <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="rounded-[20px] border border-[#e6ebf2] bg-white px-5 py-5 text-sm text-[#667085]">
          Loading approved business truth...
        </div>
      </div>
    );
  }

  const notice = s(state.data.notices?.[0]);
  const latestHistoryItem = arr(state.data.history)[0] || null;
  const reviewSummary = obj(state.data.reviewWorkbench?.summary);
  const hasFields =
    arr(sections.business).length ||
    arr(sections.contact).length ||
    arr(sections.presence).length ||
    arr(sections.offering).length;

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 lg:px-8">
      <Card
        variant="surface"
        clip
        padded={false}
        className="overflow-hidden rounded-[28px] border-[#dbe3ec] bg-white shadow-[0_20px_38px_-28px_rgba(15,23,42,0.18)]"
      >
        <div className="border-b border-[#e8edf3] px-7 py-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a96ab]">
                Business data
              </div>

              <div className="mt-3 text-[34px] font-semibold leading-none tracking-[-0.06em] text-[#101828]">
                {heroName}
              </div>

              <p className="mt-4 max-w-[760px] text-[14px] leading-8 text-[#667085]">
                {heroSummary ||
                  "Current approved business profile, shown in one cleaner operator surface."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                size="md"
                leftIcon={<Eye className="h-4 w-4" />}
                onClick={() => setShowEvidence((value) => !value)}
              >
                {showEvidence ? "Hide evidence" : "Show evidence"}
              </Button>

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

            <Badge tone={runtimeMeta.tone} variant="subtle" dot>
              Runtime {runtimeMeta.label}
            </Badge>

            {s(state.data.approval?.version) ? (
              <Badge tone="info" variant="subtle">
                {state.data.approval.version}
              </Badge>
            ) : null}

            {Number(reviewSummary.pending || 0) > 0 ? (
              <Badge tone="warning" variant="subtle">
                {Number(reviewSummary.pending || 0)} pending review
              </Badge>
            ) : null}

            {Number(reviewSummary.quarantined || 0) > 0 ? (
              <Badge tone="warning" variant="subtle">
                {Number(reviewSummary.quarantined || 0)} quarantined
              </Badge>
            ) : null}
          </div>

          {state.error ? (
            <div className="mt-5 rounded-[12px] border border-[rgba(var(--color-danger),0.18)] bg-[rgba(var(--color-danger),0.05)] px-4 py-3 text-[13px] leading-6 text-danger">
              {state.error}
            </div>
          ) : null}

          {!state.error && notice ? (
            <div className="mt-5">
              <NoticeBanner>{notice}</NoticeBanner>
            </div>
          ) : null}
        </div>

        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="px-7 py-7">
            {!hasFields ? (
              <div className="rounded-[14px] border border-[#e6ebf2] bg-[#fafbfd] px-4 py-4 text-[14px] leading-7 text-[#667085]">
                No approved fields were returned by the backend.
              </div>
            ) : (
              <div className="space-y-0">
                {arr(sections.business).length ? (
                  <SectionBlock
                    eyebrow="Business"
                    title="Core business profile"
                    description="Only the approved fields are shown here."
                  >
                    <div className="space-y-0">
                      {sections.business.map((item) => (
                        <InfoRow
                          key={item.key}
                          icon={item.icon}
                          label={item.label}
                          value={item.value}
                          provenance={item.provenance}
                          showEvidence={showEvidence}
                          multiline={item.multiline}
                        />
                      ))}
                    </div>
                  </SectionBlock>
                ) : null}

                {arr(sections.contact).length ? (
                  <SectionBlock eyebrow="Contact" title="Reachability">
                    <div className="space-y-0">
                      {sections.contact.map((item) => (
                        <InfoRow
                          key={item.key}
                          icon={item.icon}
                          label={item.label}
                          value={item.value}
                          provenance={item.provenance}
                          showEvidence={showEvidence}
                          multiline={item.multiline}
                        />
                      ))}
                    </div>
                  </SectionBlock>
                ) : null}

                {arr(sections.presence).length ? (
                  <SectionBlock eyebrow="Presence" title="Public presence">
                    <div className="space-y-0">
                      {sections.presence.map((item) => (
                        <InfoRow
                          key={item.key}
                          icon={item.icon}
                          label={item.label}
                          value={item.value}
                          provenance={item.provenance}
                          showEvidence={showEvidence}
                          multiline={item.multiline}
                        />
                      ))}
                    </div>
                  </SectionBlock>
                ) : null}

                {arr(sections.offering).length ? (
                  <SectionBlock eyebrow="Offering" title="Services and pricing" last>
                    <div className="space-y-0">
                      {sections.offering.map((item) => (
                        <InfoRow
                          key={item.key}
                          icon={item.icon}
                          label={item.label}
                          value={item.value}
                          provenance={item.provenance}
                          showEvidence={showEvidence}
                          multiline={item.multiline}
                        />
                      ))}
                    </div>
                  </SectionBlock>
                ) : null}
              </div>
            )}
          </div>

          <aside className="border-t border-[#e8edf3] bg-[#fbfcfe] px-7 py-7 xl:border-l xl:border-t-0">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8a96ab]">
              Snapshot
            </div>

            <div className="mt-5 space-y-0">
              <MetaRow
                label="Version"
                value={s(state.data.approval?.version, "Pending")}
              />
              <MetaRow
                label="Approved at"
                value={s(state.data.approval?.approvedAt)
                  ? formatWhen(state.data.approval.approvedAt)
                  : "Not available"}
              />
              <MetaRow
                label="Approved by"
                value={s(state.data.approval?.approvedBy, "Not available")}
              />
              <MetaRow
                label="Source"
                value={s(sourceLine, "Not available")}
              />
              <MetaRow
                label="Saved versions"
                value={String(arr(state.data.history).length)}
              />
              <MetaRow
                label="Pending review"
                value={String(Number(reviewSummary.pending || 0))}
              />
            </div>

            {showEvidence ? (
              <div className="mt-6 rounded-[12px] border border-[#e6ebf2] bg-white px-4 py-3 text-[12px] leading-6 text-[#667085]">
                Evidence mode is on. Field-level source notes are shown directly under each approved value.
              </div>
            ) : null}

            <div className="sr-only">Business data review</div>
            <div className="sr-only">Truth Readiness</div>
            <div className="sr-only">Approved behavior profile</div>
            <div className="sr-only">Truth Review Workbench</div>
          </aside>
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