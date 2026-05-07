import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { RefreshCw } from "lucide-react";

import {
  getCanonicalTruthSnapshot,
  getTruthVersionDetail,
  rollbackTruthVersion,
} from "../../api/truth.js";
import { getSettingsTrustView } from "../../api/trust.js";
import useWorkspaceTenantKey from "../../hooks/useWorkspaceTenantKey.js";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
} from "../../components/ui/AppShellPrimitives.jsx";
import { cx } from "../../lib/cx.js";
import { useLaunchSliceRefreshToken } from "../../lib/launchSliceRefresh.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function titleize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatWhen(value = "") {
  const raw = s(value);
  if (!raw) return "";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeFieldValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return s(item);
        return s(item?.title || item?.name || item?.label || item?.value || item?.description);
      })
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
        value.description ||
        JSON.stringify(value)
    );
  }

  return s(value);
}

function normalizeField(field = {}) {
  const source = obj(field);
  const key = s(source.key || source.field || source.name || source.label);
  const label = s(source.label || source.title || source.key || source.field || source.name);
  const value = normalizeFieldValue(
    source.value ??
      source.valueText ??
      source.value_text ??
      source.text ??
      source.content ??
      source.summary
  );

  const provenance = s(
    source.provenance ||
      source.sourceLabel ||
      source.source_label ||
      source.sourceType ||
      source.source_type ||
      source.source ||
      ""
  );

  return {
    key: key || label || value,
    label: label || titleize(key) || "Business fact",
    value,
    provenance,
  };
}

function fieldsFromPayload(payload = {}) {
  const root = obj(
    payload?.data ||
      payload?.snapshot ||
      payload?.truth ||
      payload?.canonicalTruth ||
      payload
  );

  const directFields = arr(root.fields || root.approvedFields || root.approved_fields)
    .map(normalizeField)
    .filter((field) => s(field.value));

  if (directFields.length) return directFields;

  const candidates = [
    ["companyName", "Company name"],
    ["description", "Summary"],
    ["summary", "Summary"],
    ["primaryPhone", "Phone"],
    ["phone", "Phone"],
    ["primaryEmail", "Email"],
    ["email", "Email"],
    ["primaryAddress", "Address"],
    ["address", "Address"],
    ["websiteUrl", "Website"],
    ["website", "Website"],
    ["services", "Services"],
    ["products", "Products"],
    ["pricing", "Pricing"],
    ["hours", "Hours"],
  ];

  return candidates
    .map(([key, label]) => ({
      key,
      label,
      value: normalizeFieldValue(root[key]),
      provenance: "",
    }))
    .filter((field) => s(field.value));
}

function approvalFromPayload(payload = {}) {
  const root = obj(
    payload?.data ||
      payload?.snapshot ||
      payload?.truth ||
      payload?.canonicalTruth ||
      payload
  );

  const approval = obj(root.approval || root.approved || root.versionApproval);

  return {
    version: s(approval.version || approval.versionId || root.version || root.versionId),
    approvedAt: s(approval.approvedAt || approval.approved_at || root.approvedAt || root.updatedAt),
    approvedBy: s(approval.approvedBy || approval.approved_by || root.approvedBy),
  };
}

function sourceFromPayload(payload = {}) {
  const root = obj(payload?.data || payload?.snapshot || payload);
  const latest = obj(root?.sourceSummary?.latestImport);

  const type = s(latest.sourceType || latest.type);
  const url = s(latest.sourceUrl || latest.url);

  if (type || url) return `${type || "source"} · ${url || "Not available"}`;

  return "Not available";
}

function runtimeFromTrust(trust = {}) {
  const runtime = obj(trust?.summary?.runtimeProjection);
  const readiness = obj(runtime.readiness);
  const healthy = runtime?.health?.usable === true || runtime?.authority?.available === true;

  if (healthy || s(readiness.status).toLowerCase() === "ready") return "Healthy";
  return "Unavailable";
}

function groupFields(fields = []) {
  const groups = {
    identity: { title: "Identity", rows: [] },
    contact: { title: "Contact", rows: [] },
    offering: { title: "Offering", rows: [] },
    other: { title: "Other facts", rows: [] },
  };

  for (const field of fields) {
    const key = s(field.key).toLowerCase();

    if (
      key.includes("company") ||
      key.includes("business") ||
      key.includes("description") ||
      key.includes("summary")
    ) {
      groups.identity.rows.push(field);
      continue;
    }

    if (
      key.includes("phone") ||
      key.includes("email") ||
      key.includes("address") ||
      key.includes("website")
    ) {
      groups.contact.rows.push(field);
      continue;
    }

    if (
      key.includes("service") ||
      key.includes("product") ||
      key.includes("pricing") ||
      key.includes("price") ||
      key.includes("hour") ||
      key.includes("faq")
    ) {
      groups.offering.rows.push(field);
      continue;
    }

    groups.other.rows.push(field);
  }

  return Object.values(groups).filter((group) => group.rows.length);
}

function EmptyState() {
  return (
    <div className="flex min-h-[320px] items-center justify-center px-6 py-12 text-center">
      <div className="max-w-[560px]">
        <div className="mx-auto h-1.5 w-14 rounded-full bg-line-strong" />
        <h2 className="mt-6 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
          No approved business info yet
        </h2>
        <p className="mt-2 text-[13.5px] font-medium leading-6 text-text-muted">
          Approved business facts will appear here when the business profile is reviewed.
        </p>
      </div>
    </div>
  );
}

function FieldRow({ field, last = false }) {
  return (
    <div
      className={cx(
        "grid gap-2 py-3 md:grid-cols-[180px_minmax(0,1fr)]",
        !last && "border-b border-line-soft"
      )}
    >
      <div className="text-[12px] font-semibold text-text-muted">
        {field.label}
      </div>

      <div className="min-w-0">
        <div className="whitespace-pre-wrap text-[13.5px] font-medium leading-6 text-text">
          {field.value}
        </div>

        {field.provenance ? (
          <div className="mt-1 text-[11.5px] font-medium text-text-subtle">
            {field.provenance}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FieldGroup({ group }) {
  return (
    <section className="border-t border-line-soft px-5 py-4">
      <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
        {group.title}
      </div>

      <div>
        {group.rows.map((field, index) => (
          <FieldRow
            key={`${group.title}-${field.key}-${index}`}
            field={field}
            last={index === group.rows.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

function NoticeList({ notices = [] }) {
  if (!arr(notices).length) return null;

  return (
    <div className="grid gap-2 border-t border-line-soft px-5 py-4">
      {arr(notices).map((notice, index) => (
        <InlineNotice
          key={`${s(notice.title)}-${index}`}
          tone={s(notice.tone, "warning")}
          title={s(notice.title)}
          description={s(notice.message || notice.description)}
          compact
        />
      ))}
    </div>
  );
}

function VersionsPanel({ history = [], onCompare }) {
  if (!arr(history).length) {
    return (
      <div className="border-t border-line-soft px-5 py-8 text-[13.5px] font-medium text-text-muted">
        No approved truth versions are available yet.
      </div>
    );
  }

  return (
    <div className="border-t border-line-soft">
      {arr(history).map((item) => (
        <div
          key={s(item.id || item.version)}
          className="grid gap-3 border-b border-line-soft px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
        >
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-text">
              {s(item.versionLabel || item.version || item.id)}
            </div>
            <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
              {s(item.sourceSummary) || s(item.diffSummary) || "Approved version"}
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onCompare(s(item.id || item.version))}
          >
            Compare
          </Button>
        </div>
      ))}
    </div>
  );
}

function CompareDialog({
  detail,
  loading,
  rollbackBusy,
  rollbackReceipt,
  onRollback,
  onClose,
}) {
  if (!detail && !loading) return null;

  const selected = obj(detail?.selectedVersion);
  const compared = obj(detail?.comparedVersion);
  const behavior = obj(detail?.behavior);
  const rollbackPreview = obj(detail?.rollbackPreview);
  const action = obj(rollbackPreview.action);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Business data version compare"
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(15,23,42,0.18)] px-4 py-8"
    >
      <Card padded={false} clip className="max-h-[86vh] w-full max-w-[860px] overflow-auto bg-white shadow-[0_28px_100px_-48px_rgba(15,23,42,0.55)]">
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div>
            <div className="text-[12px] font-semibold text-brand">Version compare</div>
            <h2 className="mt-1 text-[19px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              Business data version compare
            </h2>
          </div>

          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {loading ? (
          <div className="border-t border-line-soft px-5 py-10 text-[13.5px] font-medium text-text-muted">
            Loading version compare...
          </div>
        ) : (
          <>
            <div className="grid gap-3 border-t border-line-soft px-5 py-4 md:grid-cols-2">
              <section className="rounded-[20px] bg-surface-subtle px-4 py-4">
                <div className="text-[13px] font-semibold text-text">
                  Selected version behavior
                </div>
                <div className="mt-2 text-[12.5px] font-medium leading-5 text-text-muted">
                  {s(behavior?.selected?.summary) || s(selected.versionLabel || selected.version)}
                </div>
                {arr(behavior?.selected?.rows).map((row) => (
                  <div key={s(row.key || row.label)} className="mt-2 text-[12.5px] font-medium text-text">
                    {s(row.label)}: {s(row.value)}
                  </div>
                ))}
              </section>

              <section className="rounded-[20px] bg-surface-subtle px-4 py-4">
                <div className="text-[13px] font-semibold text-text">
                  Compared version behavior
                </div>
                <div className="mt-2 text-[12.5px] font-medium leading-5 text-text-muted">
                  {s(behavior?.compared?.summary) || s(compared.versionLabel || compared.version)}
                </div>
                {arr(behavior?.compared?.rows).map((row) => (
                  <div key={s(row.key || row.label)} className="mt-2 text-[12.5px] font-medium text-text">
                    {s(row.label)}: {s(row.value)}
                  </div>
                ))}
              </section>
            </div>

            <div className="border-t border-line-soft px-5 py-4">
              <div className="text-[13px] font-semibold text-text">
                Changes
              </div>

              <div className="mt-2 grid gap-2">
                {arr(detail?.fieldChanges).map((item) => (
                  <div key={s(item.key || item.label)} className="rounded-[16px] bg-surface-subtle px-3 py-3 text-[12.5px] font-medium text-text">
                    {s(item.label)}: {s(item.beforeSummary)} → {s(item.afterSummary)}
                  </div>
                ))}
              </div>

              <p className="mt-3 text-[12.5px] font-medium leading-5 text-text-muted">
                {s(detail?.rollbackPreview?.summaryExplanation || detail?.versionDiff?.summaryExplanation || detail?.diffSummary)}
              </p>

              {action.label ? (
                <Button
                  type="button"
                  size="sm"
                  className="mt-4"
                  loading={rollbackBusy}
                  disabled={action.allowed === false}
                  onClick={() => onRollback(s(selected.id || selected.version))}
                >
                  {action.label}
                </Button>
              ) : null}
            </div>

            {rollbackReceipt ? (
              <div className="border-t border-line-soft px-5 py-4">
                <div className="text-[13px] font-semibold text-text">
                  Rollback verification
                </div>
                <p className="mt-2 text-[12.5px] font-medium leading-5 text-text-muted">
                  {s(rollbackReceipt.summaryExplanation)}
                </p>
                <div className="mt-2 text-[12.5px] font-semibold text-text">
                  {s(rollbackReceipt.resultingTruthVersion?.versionLabel || rollbackReceipt.resultingTruthVersionId)}
                </div>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
}

export default function TruthViewerPage() {
  const workspace = useWorkspaceTenantKey();
  const refreshToken = useLaunchSliceRefreshToken(workspace.tenantKey, workspace.ready);
  const [searchParams] = useSearchParams();

  const [tab, setTab] = useState("current");
  const [state, setState] = useState({
    loading: true,
    refreshing: false,
    error: "",
    payload: null,
    trust: null,
  });
  const [compare, setCompare] = useState({
    open: false,
    loading: false,
    detail: null,
    rollbackBusy: false,
    rollbackReceipt: null,
  });

  const load = useCallback(async ({ refreshing = false } = {}) => {
    setState((current) => ({
      ...current,
      loading: !refreshing,
      refreshing,
      error: "",
    }));

    try {
      const [payload, trust] = await Promise.all([
        getCanonicalTruthSnapshot(),
        getSettingsTrustView().catch(() => null),
      ]);

      setState({
        loading: false,
        refreshing: false,
        error: "",
        payload,
        trust,
      });
    } catch (error) {
      setState({
        loading: false,
        refreshing: false,
        error:
          s(error?.payload?.reason || error?.payload?.error || error?.message) ||
          "Business Info could not be loaded.",
        payload: null,
        trust: null,
      });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load, refreshToken]);

  const model = useMemo(() => {
    const fields = fieldsFromPayload(state.payload);
    const approval = approvalFromPayload(state.payload);

    return {
      fields,
      groups: groupFields(fields),
      approval,
      history: arr(state.payload?.history),
      notices: arr(state.payload?.notices),
      unavailable: state.payload?.approvedTruthUnavailable === true,
      runtime: runtimeFromTrust(state.trust),
      source: sourceFromPayload(state.payload),
    };
  }, [state.payload, state.trust]);

  async function openCompare(versionId = "") {
    const id = s(versionId || model.history[0]?.id || model.history[0]?.version);
    if (!id) return;

    setCompare({
      open: true,
      loading: true,
      detail: null,
      rollbackBusy: false,
      rollbackReceipt: null,
    });

    try {
      const detail = await getTruthVersionDetail(id);
      setCompare({
        open: true,
        loading: false,
        detail,
        rollbackBusy: false,
        rollbackReceipt: null,
      });
    } catch (error) {
      setCompare({
        open: true,
        loading: false,
        detail: {
          selectedVersion: { id, version: id, versionLabel: id },
          diffSummary: s(error?.message || "Version detail unavailable."),
        },
        rollbackBusy: false,
        rollbackReceipt: null,
      });
    }
  }

  async function handleRollback(versionId = "") {
    const id = s(versionId);
    if (!id) return;

    setCompare((current) => ({
      ...current,
      rollbackBusy: true,
    }));

    try {
      const result = await rollbackTruthVersion(id);
      setCompare((current) => ({
        ...current,
        rollbackBusy: false,
        rollbackReceipt: result?.rollbackReceipt || result,
      }));
    } catch (error) {
      setCompare((current) => ({
        ...current,
        rollbackBusy: false,
        rollbackReceipt: {
          summaryExplanation: s(error?.message || "Rollback failed."),
          resultingTruthVersionId: "",
        },
      }));
    }
  }

  useEffect(() => {
    const versionId = s(searchParams.get("versionId"));
    const focus = s(searchParams.get("focus"));

    if (versionId && focus === "history" && !compare.open) {
      void openCompare(versionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, model.history.length]);

  if (state.loading) {
    return (
      <PageCanvas className="max-w-[1180px] py-3">
        <LoadingSurface title="Loading truth" />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas className="max-w-[1180px] space-y-4 py-3">
      {state.error ? (
        <InlineNotice
          tone="danger"
          title="Business Info unavailable"
          description={state.error}
          compact
        />
      ) : null}

      <Card padded={false} clip className="shadow-[0_28px_80px_-64px_rgba(15,23,42,0.55)]">
        <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="mt-1 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
              Business Truth Runtime
            </h1>
            <p className="mt-2 max-w-[760px] text-[13.5px] font-medium leading-6 text-text-muted">
              Approved business facts and the governed runtime state AI can use with customers.
            </p>

            <div className="mt-3 flex flex-wrap gap-3 text-[12.5px] font-semibold text-text-muted">
              <span>Version: {model.approval.version || "Unavailable"}</span>
              <span>Runtime: {model.runtime}</span>
              <span>Source: {model.source}</span>
              <span>Saved: {model.approval.approvedAt ? formatWhen(model.approval.approvedAt) : "Unavailable"}</span>
              <span>Pending review: 0</span>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={tab === "current" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setTab("current")}
            >
              Current
            </Button>
            <Button
              type="button"
              variant={tab === "versions" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setTab("versions")}
            >
              Versions
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={state.refreshing}
              onClick={() => load({ refreshing: true })}
              leftIcon={!state.refreshing ? <RefreshCw className="h-4 w-4" strokeWidth={2.1} /> : undefined}
            >
              Refresh
            </Button>
          </div>
        </div>

        <NoticeList notices={model.notices} />

        {tab === "versions" ? (
          <VersionsPanel history={model.history} onCompare={openCompare} />
        ) : model.groups.length ? (
          <div>
            {model.groups.map((group) => (
              <FieldGroup key={group.title} group={group} />
            ))}
          </div>
        ) : (
          <div className="border-t border-line-soft">
            <EmptyState />
          </div>
        )}
      </Card>

      <CompareDialog
        detail={compare.detail}
        loading={compare.loading}
        rollbackBusy={compare.rollbackBusy}
        rollbackReceipt={compare.rollbackReceipt}
        onRollback={handleRollback}
        onClose={() =>
          setCompare({
            open: false,
            loading: false,
            detail: null,
            rollbackBusy: false,
            rollbackReceipt: null,
          })
        }
      />
    </PageCanvas>
  );
}