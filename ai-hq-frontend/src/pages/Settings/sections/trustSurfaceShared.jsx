import { useEffect, useState } from "react";
import {
  Database,
  FileText,
  Globe2,
  Instagram,
  Link2,
  MessageCircle,
  RefreshCw,
  ShieldPlus,
} from "lucide-react";

import Card from "../../../components/ui/Card.jsx";
import Button from "../../../components/ui/Button.jsx";
import Input from "../../../components/ui/Input.jsx";
import Badge from "../../../components/ui/Badge.jsx";
import { cx } from "../../../lib/cx.js";

function toFiniteNumber(value, fallback = 0) {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
}

export function formatTimestampLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Unavailable";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}

export function titleizeTrustAction(value = "") {
  return String(value || "")
    .trim()
    .replace(/[._]+/g, " ")
    .replace(/\b\w/g, (x) => x.toUpperCase());
}

export function truthMaintenanceMeta(item = {}) {
  const metadata =
    item && typeof item.metadata_json === "object" && !Array.isArray(item.metadata_json)
      ? item.metadata_json
      : {};
  const settings =
    item && typeof item.settings_json === "object" && !Array.isArray(item.settings_json)
      ? item.settings_json
      : {};
  const review =
    item && typeof item.review === "object" && !Array.isArray(item.review)
      ? item.review
      : {};
  const syncStatus = String(item?.sync_status || "").trim().toLowerCase();
  const projectionStatus = String(
    review?.projectionStatus ||
      item?.projection_status ||
      metadata?.projection_status ||
      settings?.projection_status
  )
    .trim()
    .toLowerCase();
  const reviewSessionId = String(
    review?.sessionId ||
      item?.review_session_id ||
      item?.reviewSessionId ||
      metadata?.review_session_id ||
      metadata?.reviewSessionId
  ).trim();
  const pendingReviewCount = Math.max(
    toFiniteNumber(review?.candidateDraftCount, 0),
    toFiniteNumber(review?.candidateCreatedCount, 0),
    toFiniteNumber(item?.pending_review_count, 0),
    toFiniteNumber(metadata?.pendingReviewCount, 0),
    toFiniteNumber(metadata?.reviewRequiredCount, 0),
    toFiniteNumber(metadata?.candidateCount, 0),
    toFiniteNumber(settings?.pendingReviewCount, 0)
  );
  const reviewRequired =
    !!review?.required ||
    pendingReviewCount > 0 ||
    projectionStatus === "review_required" ||
    !!reviewSessionId ||
    !!(
      item?.review_required ??
      metadata?.reviewRequired ??
      metadata?.needsReview ??
      settings?.reviewRequired
    );

  if (syncStatus === "running" || syncStatus === "queued" || syncStatus === "pending") {
    return {
      tone:
        "border-sky-200/80 bg-sky-50/90 text-sky-800 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-200",
      label: "Evidence refresh in progress",
      body:
        "This sync is refreshing source evidence. Approved truth will not change until review is completed.",
    };
  }

  if (syncStatus === "failed" || syncStatus === "error") {
    return {
      tone:
        "border-rose-200/80 bg-rose-50/90 text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
      label: "Evidence refresh needs attention",
      body:
        "The latest sync did not finish cleanly. Approved truth remains unchanged until a valid review-backed update exists.",
    };
  }

  if (reviewRequired) {
    return {
      tone:
        "border-amber-200/80 bg-amber-50/90 text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
      label:
        pendingReviewCount > 0
          ? `${pendingReviewCount} review item${pendingReviewCount === 1 ? "" : "s"} waiting`
          : "Review required",
      body:
        pendingReviewCount > 0
          ? "New source evidence created candidate changes. Review them before approved truth can change."
          : "This source produced evidence that may affect approved truth, but review is still required first.",
    };
  }

  if (syncStatus === "success" || syncStatus === "completed") {
    return {
      tone:
        "border-slate-200/80 bg-slate-50/90 text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300",
      label: "Evidence refreshed",
      body:
        "This source was refreshed successfully. Sync updates evidence only, and approved truth still changes through review.",
    };
  }

  return {
    tone:
      "border-slate-200/80 bg-slate-50/90 text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300",
    label: "Truth maintenance source",
    body:
      "This source can provide future evidence for truth updates, but sync alone never changes approved truth.",
  };
}

export function Select({ className = "", children, ...props }) {
  return (
    <div
      className={cx(
        "relative w-full min-w-0 overflow-hidden border-t",
        "border-slate-200/80 bg-transparent",
        "transition-[border-color,box-shadow,background-color] duration-200",
        "focus-within:border-sky-300/90 focus-within:ring-4 focus-within:ring-sky-100/70",
        "dark:border-white/10 dark:bg-transparent dark:focus-within:ring-sky-400/10",
        className
      )}
    >
      <select
        {...props}
        className="relative z-10 h-12 w-full appearance-none bg-transparent px-4 text-[14px] text-slate-900 outline-none dark:text-slate-100"
      >
        {children}
      </select>
    </div>
  );
}

function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all duration-200",
        checked
          ? "border-sky-400/40 bg-[linear-gradient(180deg,rgba(14,165,233,0.92),rgba(37,99,235,0.92))] shadow-[0_10px_24px_rgba(37,99,235,0.24)]"
          : "border-slate-300/80 bg-slate-200/85 dark:border-white/10 dark:bg-white/[0.08]",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      )}
    >
      <span
        className={cx(
          "inline-block h-5 w-5 rounded-full bg-white shadow-[0_4px_10px_rgba(15,23,42,0.18)] transition-all duration-200",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="block space-y-2.5">
      <div className="space-y-1">
        <div className="text-[13px] font-semibold tracking-[-0.01em] text-slate-800 dark:text-slate-100">
          {label}
        </div>
        {hint ? (
          <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            {hint}
          </div>
        ) : null}
      </div>
      {children}
    </label>
  );
}

export function StatTile({ label, value, hint, tone = "neutral" }) {
  return (
    <div className="border-t border-slate-200/80 px-1 py-4">
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          {label}
        </div>
        <div className="text-[20px] font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
          {value}
        </div>
        {hint ? (
          <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            {hint}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FeatureToggleCard({
  title,
  subtitle,
  checked,
  onChange,
  disabled = false,
}) {
  return (
    <div className="border-t border-slate-200/80 px-1 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {title}
            </div>
            <Badge
              tone={checked ? "success" : "neutral"}
              variant="subtle"
              size="sm"
              dot={checked}
            >
              {checked ? "On" : "Off"}
            </Badge>
          </div>

          <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {subtitle}
          </div>
        </div>

        <Toggle checked={checked} onChange={onChange} disabled={disabled} />
      </div>
    </div>
  );
}

export function EmptyState({ title, subtitle, actionLabel, onAction, disabled = false }) {
  return (
    <div className="border-t border-slate-200/80 px-1 py-5">
      <div className="space-y-4">
        <div>
          <div className="text-base font-semibold text-slate-900 dark:text-white">
            {title}
          </div>
          <div className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {subtitle}
          </div>
        </div>
        {actionLabel ? (
          <div>
            <Button onClick={onAction} disabled={disabled}>
              {actionLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function getSourceTypeIcon(type) {
  const x = String(type || "").toLowerCase();
  if (x === "website") return Globe2;
  if (x === "instagram") return Instagram;
  if (x === "whatsapp_business" || x === "messenger") return MessageCircle;
  if (["pdf", "document", "spreadsheet", "notion"].includes(x)) return FileText;
  return Link2;
}

export function SourceTypeBadge({ type }) {
  const x = String(type || "other").toLowerCase();
  return (
    <Badge tone="info" variant="subtle" dot>
      {x}
    </Badge>
  );
}

export function SourceStatusBadge({ status }) {
  const x = String(status || "pending").toLowerCase();
  const tone =
    x === "connected"
      ? "success"
      : x === "error" || x === "revoked"
        ? "danger"
        : x === "pending"
          ? "warn"
          : "neutral";

  return (
    <Badge tone={tone} variant="subtle" dot>
      {x}
    </Badge>
  );
}

export function SyncStatusBadge({ status }) {
  const x = String(status || "idle").toLowerCase();
  const tone =
    x === "success"
      ? "success"
      : x === "running" || x === "queued"
        ? "info"
        : x === "partial"
          ? "warn"
          : x === "error" || x === "failed"
            ? "danger"
            : "neutral";

  return (
    <Badge tone={tone} variant="subtle" dot>
      {x}
    </Badge>
  );
}

export function ConfidenceBadge({ label, value }) {
  const x = String(label || "low").toLowerCase();
  const tone =
    x === "very_high" || x === "high"
      ? "success"
      : x === "medium"
        ? "warn"
        : "neutral";

  return (
    <Badge tone={tone} variant="subtle" dot>
      {x} {typeof value === "number" ? `· ${Math.round(value * 100)}%` : ""}
    </Badge>
  );
}

export function SourceCard({
  item,
  canManage,
  onSave,
  onStartSync,
  onViewSyncRuns,
  saving,
  syncing,
}) {
  const [local, setLocal] = useState({
    id: item?.id || "",
    source_type: item?.source_type || "website",
    source_key: item?.source_key || "",
    display_name: item?.display_name || "",
    status: item?.status || "pending",
    auth_status: item?.auth_status || "not_required",
    sync_status: item?.sync_status || "idle",
    connection_mode: item?.connection_mode || "manual",
    access_scope: item?.access_scope || "public",
    source_url: item?.source_url || "",
    external_account_id: item?.external_account_id || "",
    external_page_id: item?.external_page_id || "",
    external_username: item?.external_username || "",
    is_enabled: typeof item?.is_enabled === "boolean" ? item.is_enabled : true,
    is_primary: typeof item?.is_primary === "boolean" ? item.is_primary : false,
    permissions_json:
      item &&
      typeof item.permissions_json === "object" &&
      !Array.isArray(item.permissions_json)
        ? item.permissions_json
        : {
            allowProfileRead: true,
            allowFutureSync: true,
            allowBusinessInference: true,
            requireApprovalForCriticalFacts: true,
          },
    settings_json:
      item &&
      typeof item.settings_json === "object" &&
      !Array.isArray(item.settings_json)
        ? item.settings_json
        : {},
    metadata_json:
      item &&
      typeof item.metadata_json === "object" &&
      !Array.isArray(item.metadata_json)
        ? item.metadata_json
        : {},
  });

  useEffect(() => {
    setLocal({
      id: item?.id || "",
      source_type: item?.source_type || "website",
      source_key: item?.source_key || "",
      display_name: item?.display_name || "",
      status: item?.status || "pending",
      auth_status: item?.auth_status || "not_required",
      sync_status: item?.sync_status || "idle",
      connection_mode: item?.connection_mode || "manual",
      access_scope: item?.access_scope || "public",
      source_url: item?.source_url || "",
      external_account_id: item?.external_account_id || "",
      external_page_id: item?.external_page_id || "",
      external_username: item?.external_username || "",
      is_enabled: typeof item?.is_enabled === "boolean" ? item.is_enabled : true,
      is_primary: typeof item?.is_primary === "boolean" ? item.is_primary : false,
      permissions_json:
        item &&
        typeof item.permissions_json === "object" &&
        !Array.isArray(item.permissions_json)
          ? item.permissions_json
          : {
              allowProfileRead: true,
              allowFutureSync: true,
              allowBusinessInference: true,
              requireApprovalForCriticalFacts: true,
            },
      settings_json:
        item &&
        typeof item.settings_json === "object" &&
        !Array.isArray(item.settings_json)
          ? item.settings_json
          : {},
      metadata_json:
        item &&
        typeof item.metadata_json === "object" &&
        !Array.isArray(item.metadata_json)
          ? item.metadata_json
          : {},
    });
  }, [item]);

  const Icon = getSourceTypeIcon(local.source_type);
  const maintenanceState = truthMaintenanceMeta(item);

  function patch(key, value) {
    setLocal((prev) => ({ ...prev, [key]: value }));
  }

  function patchPermission(key, value) {
    setLocal((prev) => ({
      ...prev,
      permissions_json: {
        ...(prev.permissions_json || {}),
        [key]: value,
      },
    }));
  }

  return (
    <Card variant="surface" padded="lg" className="rounded-[28px]">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-slate-200/80 bg-white/90 text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100">
              <Icon className="h-5 w-5" />
            </div>

            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <SourceTypeBadge type={local.source_type} />
                <SourceStatusBadge status={local.status} />
                <SyncStatusBadge status={local.sync_status} />
                {local.is_primary ? (
                  <Badge tone="success" variant="subtle" dot>
                    primary
                  </Badge>
                ) : null}
              </div>

              <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                {local.display_name || local.source_url || local.source_key || "New Source"}
              </div>

              <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                Qoşulan source-dan AI profil, kontakt, xidmət, qayda və digər business kontekstini toplaya bilər.
              </div>

              <div
                className={cx(
                  "rounded-[18px] border px-3 py-3 text-sm leading-6",
                  maintenanceState.tone
                )}
              >
                <div className="font-medium">{maintenanceState.label}</div>
                <div className="mt-1">{maintenanceState.body}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {local.id ? (
              <>
                <Button variant="secondary" onClick={() => onViewSyncRuns(local)}>
                  Sync Runs
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => onStartSync(local)}
                  disabled={!canManage || syncing}
                  leftIcon={<RefreshCw className="h-4 w-4" />}
                >
                  {syncing ? "Syncing..." : "Start Sync"}
                </Button>
              </>
            ) : null}

            <Button onClick={() => onSave(local)} disabled={!canManage || saving}>
              {saving ? "Saving..." : local.id ? "Save Source" : "Create Source"}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Source Type" hint="Website, Instagram, WhatsApp, document və s.">
            <Select
              value={local.source_type}
              disabled={!canManage}
              onChange={(e) => patch("source_type", e.target.value)}
            >
              <option value="website">website</option>
              <option value="instagram">instagram</option>
              <option value="facebook_page">facebook_page</option>
              <option value="messenger">messenger</option>
              <option value="whatsapp_business">whatsapp_business</option>
              <option value="google_maps">google_maps</option>
              <option value="pdf">pdf</option>
              <option value="document">document</option>
              <option value="spreadsheet">spreadsheet</option>
              <option value="notion">notion</option>
              <option value="crm">crm</option>
              <option value="manual_note">manual_note</option>
              <option value="other">other</option>
            </Select>
          </Field>

          <Field label="Display Name" hint="Admin panel üçün source adı">
            <Input
              value={local.display_name}
              disabled={!canManage}
              onChange={(e) => patch("display_name", e.target.value)}
              placeholder="Main Website"
            />
          </Field>

          <Field label="Source Key" hint="Unikal daxili açar. Boş qalsa backend düzəldəcək">
            <Input
              value={local.source_key}
              disabled={!canManage}
              onChange={(e) => patch("source_key", e.target.value)}
              placeholder="website:main"
            />
          </Field>

          <Field label="Source URL" hint="Website, doc və ya public profile linki">
            <Input
              value={local.source_url}
              disabled={!canManage}
              onChange={(e) => patch("source_url", e.target.value)}
              placeholder="https://example.com"
            />
          </Field>

          <Field label="Connection Mode">
            <Select
              value={local.connection_mode}
              disabled={!canManage}
              onChange={(e) => patch("connection_mode", e.target.value)}
            >
              <option value="manual">manual</option>
              <option value="oauth">oauth</option>
              <option value="webhook">webhook</option>
              <option value="crawler">crawler</option>
              <option value="upload">upload</option>
              <option value="import">import</option>
              <option value="api_key">api_key</option>
            </Select>
          </Field>

          <Field label="Access Scope">
            <Select
              value={local.access_scope}
              disabled={!canManage}
              onChange={(e) => patch("access_scope", e.target.value)}
            >
              <option value="public">public</option>
              <option value="private">private</option>
              <option value="hybrid">hybrid</option>
            </Select>
          </Field>

          <Field label="External Username" hint="Instagram username və s.">
            <Input
              value={local.external_username}
              disabled={!canManage}
              onChange={(e) => patch("external_username", e.target.value)}
              placeholder="neox.az"
            />
          </Field>

          <Field label="External Account ID" hint="Meta və digər provider account id">
            <Input
              value={local.external_account_id}
              disabled={!canManage}
              onChange={(e) => patch("external_account_id", e.target.value)}
              placeholder="1784147..."
            />
          </Field>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FeatureToggleCard
            title="Enabled"
            subtitle="Source runtime üçün aktiv olsun"
            checked={!!local.is_enabled}
            onChange={(v) => patch("is_enabled", v)}
            disabled={!canManage}
          />
          <FeatureToggleCard
            title="Primary"
            subtitle="Bu tip üçün əsas source"
            checked={!!local.is_primary}
            onChange={(v) => patch("is_primary", v)}
            disabled={!canManage}
          />
          <FeatureToggleCard
            title="Profile Read"
            subtitle="Bio/profile/public metadata oxunsun"
            checked={!!local.permissions_json?.allowProfileRead}
            onChange={(v) => patchPermission("allowProfileRead", v)}
            disabled={!canManage}
          />
          <FeatureToggleCard
            title="Future Sync"
            subtitle="Gələcək sync-lərə icazə ver"
            checked={!!local.permissions_json?.allowFutureSync}
            onChange={(v) => patchPermission("allowFutureSync", v)}
            disabled={!canManage}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <FeatureToggleCard
            title="Business Inference"
            subtitle="AI bu source-dan xidmət, tone, contact və rules çıxarsın"
            checked={!!local.permissions_json?.allowBusinessInference}
            onChange={(v) => patchPermission("allowBusinessInference", v)}
            disabled={!canManage}
          />
          <FeatureToggleCard
            title="Critical Fact Approval"
            subtitle="Kritik məlumatlar üçün manual approval tələb olunsun"
            checked={!!local.permissions_json?.requireApprovalForCriticalFacts}
            onChange={(v) => patchPermission("requireApprovalForCriticalFacts", v)}
            disabled={!canManage}
          />
        </div>
      </div>
    </Card>
  );
}

export function KnowledgeCandidateCard({
  item,
  canManage,
  busyApprove,
  busyReject,
  onApprove,
  onReject,
}) {
  return (
    <Card variant="surface" padded="lg" className="rounded-[28px]">
      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info" variant="subtle" dot>
                {item.category}
              </Badge>
              <Badge tone="neutral" variant="subtle" dot>
                {item.item_key || "item"}
              </Badge>
              <ConfidenceBadge label={item.confidence_label} value={item.confidence} />
              {item.source_type ? <SourceTypeBadge type={item.source_type} /> : null}
              {item.status ? <SyncStatusBadge status={item.status} /> : null}
            </div>

            <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
              {item.title || item.value_text || "Candidate"}
            </div>

            <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
              Source: {item.source_display_name || item.source_type || "unknown"} · First seen:{" "}
              {item.first_seen_at || "—"}
            </div>

            <div className="text-sm leading-6 text-slate-600 dark:text-slate-300">
              This is source evidence under review, not approved truth yet.
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => onApprove(item)}
              disabled={!canManage || busyApprove || busyReject}
              leftIcon={<ShieldPlus className="h-4 w-4" />}
            >
              {busyApprove ? "Approving..." : "Approve"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => onReject(item)}
              disabled={!canManage || busyApprove || busyReject}
            >
              {busyReject ? "Rejecting..." : "Reject"}
            </Button>
          </div>
        </div>

        {item.value_text ? (
          <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/80 px-4 py-4 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
            {item.value_text}
          </div>
        ) : null}

        {Array.isArray(item.source_evidence_json) && item.source_evidence_json.length ? (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Source Evidence
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {item.source_evidence_json.slice(0, 4).map((ev, idx) => (
                <div
                  key={`${item.id}-ev-${idx}`}
                  className="rounded-[18px] border border-slate-200/80 bg-white/80 px-4 py-3 text-sm text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300"
                >
                  <div className="font-medium text-slate-800 dark:text-slate-100">
                    {ev?.label || ev?.field || `Evidence ${idx + 1}`}
                  </div>
                  <div className="mt-1 break-words text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {typeof ev === "string"
                      ? ev
                      : ev?.value || ev?.text || JSON.stringify(ev)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {item.review_reason ? (
          <div className="rounded-[18px] border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
            {item.review_reason}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function createNewSource() {
  return {
    source_type: "website",
    source_key: "",
    display_name: "",
    status: "pending",
    auth_status: "not_required",
    sync_status: "idle",
    connection_mode: "manual",
    access_scope: "public",
    source_url: "",
    external_account_id: "",
    external_page_id: "",
    external_username: "",
    is_enabled: true,
    is_primary: false,
    permissions_json: {
      allowProfileRead: true,
      allowFutureSync: true,
      allowBusinessInference: true,
      requireApprovalForCriticalFacts: true,
    },
    settings_json: {},
    metadata_json: {},
  };
}

export const trustSurfaceIcons = {
  Database,
};
