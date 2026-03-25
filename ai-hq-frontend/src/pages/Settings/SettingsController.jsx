// src/pages/Settings.jsx
// PREMIUM v5.4 — final settings assembly + tenant business brain + source intelligence + stable dirty sync

import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Bot,
  Building2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  Waypoints,
  BrainCircuit,
  Contact2,
  ListTree,
  Database,
  SearchCheck,
  Globe2,
  Instagram,
  MessageCircle,
  FileText,
  Link2,
  ShieldPlus,
} from "lucide-react";

import Card from "../../components/ui/Card.jsx";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import Badge from "../../components/ui/Badge.jsx";

import SettingsShell from "../../components/settings/SettingsShell.jsx";
import SettingsSection from "../../components/settings/SettingsSection.jsx";
import ChannelsPanel from "../../components/settings/ChannelsPanel.jsx";
import AgentsPanel from "../../components/settings/AgentsPanel.jsx";
import TeamPanel from "../../components/settings/TeamPanel.jsx";
import SettingsSaveBar from "../../components/settings/SettingsSaveBar.jsx";

import {
  askPermission,
  getNotificationPermission,
  subscribePush,
} from "../../lib/pushClient.js";

import {
  getWorkspaceSettings,
  saveWorkspaceSettings,
  getWorkspaceAgents,
  saveWorkspaceAgent,
  getTenantBusinessFacts,
  saveTenantBusinessFact,
  deleteTenantBusinessFact,
  getTenantChannelPolicies,
  saveTenantChannelPolicy,
  deleteTenantChannelPolicy,
  getTenantLocations,
  saveTenantLocation,
  deleteTenantLocation,
  getTenantContacts,
  saveTenantContact,
  deleteTenantContact,
  listSettingsSources,
  createSettingsSource,
  updateSettingsSource,
  getSettingsSourceSyncRuns,
  startSettingsSourceSync,
  listKnowledgeReviewQueue,
  approveKnowledgeCandidate,
  rejectKnowledgeCandidate,
} from "../../api/settings.js";

import { cx } from "../../lib/cx.js";
import { useSettingsWorkspace } from "./hooks/useSettingsWorkspace.js";
import { useBusinessBrain } from "./hooks/useBusinessBrain.js";
import { useSourceIntelligence } from "./hooks/useSourceIntelligence.js";
import GeneralSection from "./sections/GeneralSection.jsx";
import BrandSection from "./sections/BrandSection.jsx";
import AiPolicySection from "./sections/AiPolicySection.jsx";
import SourcesSection from "./sections/SourcesSection.jsx";
import KnowledgeReviewSection from "./sections/KnowledgeReviewSection.jsx";
import AutoContentSection from "./sections/AutoContentSection.jsx";
import NotificationsSection from "./sections/NotificationsSection.jsx";
import BusinessFactsSection from "./sections/BusinessFactsSection.jsx";
import ChannelPoliciesSection from "./sections/ChannelPoliciesSection.jsx";
import LocationsSection from "./sections/LocationsSection.jsx";
import ContactsSection from "./sections/ContactsSection.jsx";
import {
  createNewBusinessFact,
  createNewChannelPolicy,
  createNewContact,
  createNewLocation,
} from "./settingsShared.js";

function pad2(n) {
  return String(Number(n || 0)).padStart(2, "0");
}

function clampHour(v, fallback = 10) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(23, n));
}

function clampMinute(v, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(59, n));
}

function normalizeTimeString(v, fallback = "10:00") {
  const raw = String(v || "").trim();
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(raw);
  if (!m) return fallback;
  return `${pad2(clampHour(m[1]))}:${pad2(clampMinute(m[2]))}`;
}

function normalizeAutomationMode(v, fallback = "manual") {
  const x = String(v || fallback).trim().toLowerCase();
  return x === "full_auto" ? "full_auto" : "manual";
}

function toFiniteNumber(value, fallback = 0) {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
}

function formatTimestampLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Unavailable";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString();
}

function titleizeTrustAction(value = "") {
  return String(value || "")
    .trim()
    .replace(/[._]+/g, " ")
    .replace(/\b\w/g, (x) => x.toUpperCase());
}

function truthMaintenanceMeta(item = {}) {
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

function describeSourceSyncOutcome(result = {}) {
  const review =
    result && typeof result.review === "object" && !Array.isArray(result.review)
      ? result.review
      : {};
  const run = result && typeof result.run === "object" && !Array.isArray(result.run) ? result.run : {};
  const source =
    result && typeof result.source === "object" && !Array.isArray(result.source)
      ? result.source
      : {};
  const syncStatus = String(result?.status || run?.status || source?.sync_status || "").trim().toLowerCase();
  const reviewSessionId = String(review?.sessionId || "").trim();
  const pendingReviewCount = Math.max(
    toFiniteNumber(review?.candidateDraftCount, 0),
    toFiniteNumber(review?.candidateCreatedCount, 0)
  );
  const reviewRequired = !!review?.required;

  if (result?.accepted || syncStatus === "running" || syncStatus === "queued" || syncStatus === "pending") {
    return reviewRequired || reviewSessionId
      ? "Source sync was queued and opened review-backed follow-up work. Approved truth will not change until review is completed."
      : "Source sync was queued. New evidence may still require review before approved truth changes.";
  }

  if (syncStatus === "failed" || syncStatus === "error") {
    return "Source sync did not complete cleanly. Approved truth remains unchanged.";
  }

  if (reviewRequired && pendingReviewCount > 0) {
    return `Source sync refreshed evidence. ${pendingReviewCount} review item${
      pendingReviewCount === 1 ? "" : "s"
    } may affect approved truth next.`;
  }

  if (reviewRequired) {
    return "Source sync refreshed evidence and opened review-backed follow-up work before approved truth can change.";
  }

  return "Source sync refreshed evidence. Review may still be required before approved truth changes.";
}

function Select({ className = "", children, ...props }) {
  return (
    <div
      className={cx(
        "relative w-full min-w-0 overflow-hidden rounded-[22px] border",
        "border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_12px_32px_rgba(15,23,42,0.06)]",
        "transition-[border-color,box-shadow,background-color] duration-200",
        "focus-within:border-sky-300/90 focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_0_0_4px_rgba(56,189,248,0.08),0_16px_38px_rgba(15,23,42,0.08)]",
        "dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.80))]",
        "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_44px_rgba(0,0,0,0.46)]",
        className
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[22px] bg-[linear-gradient(180deg,rgba(255,255,255,0.20),transparent_44%)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_38%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/10"
      />
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

function StatTile({ label, value, hint, tone = "neutral" }) {
  return (
    <Card variant="subtle" padded="md" tone={tone} className="rounded-[24px]">
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
    </Card>
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
    <Card
      variant="subtle"
      padded="md"
      className="rounded-[24px]"
      tone={checked ? "info" : "neutral"}
    >
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
    </Card>
  );
}

function RowActions({ onSave, onDelete, saving, deleting, canManage }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onSave} disabled={!canManage || saving}>
        {saving ? "Saving..." : "Save"}
      </Button>
      <Button
        variant="secondary"
        onClick={onDelete}
        disabled={!canManage || deleting}
      >
        {deleting ? "Deleting..." : "Delete"}
      </Button>
    </div>
  );
}

function EmptyState({ title, subtitle, actionLabel, onAction, disabled = false }) {
  return (
    <Card variant="subtle" padded="lg" className="rounded-[28px]">
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
    </Card>
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

function SourceTypeBadge({ type }) {
  const x = String(type || "other").toLowerCase();
  return (
    <Badge tone="info" variant="subtle" dot>
      {x}
    </Badge>
  );
}

function SourceStatusBadge({ status }) {
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

function SyncStatusBadge({ status }) {
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

function ConfidenceBadge({ label, value }) {
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

function createNewSource() {
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

function SourcesPanel({
  items,
  canManage,
  onCreate,
  onSave,
  onStartSync,
  onViewSyncRuns,
  trustSummary,
  trustRecentRuns,
  trustStatus,
}) {
  const [savingId, setSavingId] = useState("");
  const [syncingId, setSyncingId] = useState("");

  async function handleSave(item) {
    setSavingId(String(item.id || item.source_key || "new"));
    try {
      await onSave(item);
    } finally {
      setSavingId("");
    }
  }

  async function handleStartSync(item) {
    if (!item?.id) return;
    setSyncingId(String(item.id));
    try {
      await onStartSync(item);
    } finally {
      setSyncingId("");
    }
  }

  const connectedCount = items.filter(
    (x) => String(x.status).toLowerCase() === "connected"
  ).length;
  const enabledCount = items.filter((x) => !!x.is_enabled).length;
  const sourceHealth = trustSummary?.sources || {};
  const runtimeHealth = trustSummary?.runtimeProjection || {};
  const truthHealth = trustSummary?.truth || {};
  const reviewHealth = trustSummary?.reviewQueue || {};
  const trustUnavailable = trustStatus === "unavailable";

  return (
    <SettingsSection
      eyebrow="Source Intelligence"
      title="Connected Sources"
      subtitle="Refresh source evidence here, then route anything important into review before approved truth changes."
      tone="default"
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatTile
            label="Total Sources"
            value={sourceHealth.total ?? items.length}
            hint="Tenant üçün qeydiyyatlı source sayı"
            tone="info"
          />
          <StatTile
            label="Connected"
            value={sourceHealth.connected ?? connectedCount}
            hint="Aktiv qoşulmuş source-lar"
            tone="success"
          />
          <StatTile
            label="Enabled"
            value={sourceHealth.enabled ?? enabledCount}
            hint="Enabled for evidence refresh and future review work"
            tone="neutral"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card variant="surface" padded="md" className="rounded-[24px]">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  Source Health
                </div>
                <Badge
                  tone={
                    trustUnavailable
                      ? "warn"
                      : (sourceHealth.failed || 0) > 0
                        ? "warn"
                        : "success"
                  }
                  variant="subtle"
                  dot
                >
                  {trustUnavailable
                    ? "Unavailable"
                    : (sourceHealth.failed || 0) > 0
                      ? "Needs attention"
                      : "Healthy"}
                </Badge>
              </div>
              <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                Running: {sourceHealth.running ?? 0} · Failed: {sourceHealth.failed ?? 0} · Review
                required: {sourceHealth.reviewRequired ?? 0}
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Last run {formatTimestampLabel(sourceHealth.lastRunAt)}
              </div>
            </div>
          </Card>

          <Card variant="surface" padded="md" className="rounded-[24px]">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  Runtime Projection
                </div>
                <Badge
                  tone={trustUnavailable ? "warn" : runtimeHealth.stale ? "warn" : "success"}
                  variant="subtle"
                  dot
                >
                  {trustUnavailable ? "Unavailable" : runtimeHealth.stale ? "Stale" : "Current"}
                </Badge>
              </div>
              <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                Status: {runtimeHealth.status || "unknown"}
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Updated {formatTimestampLabel(runtimeHealth.updatedAt)}
              </div>
            </div>
          </Card>

          <Card variant="surface" padded="md" className="rounded-[24px]">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  Approved Truth
                </div>
                <Badge tone={trustUnavailable ? "warn" : "success"} variant="subtle" dot>
                  {truthHealth.latestVersionId ? "Versioned" : trustUnavailable ? "Unavailable" : "Pending"}
                </Badge>
              </div>
              <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                Review queue: {reviewHealth.pending ?? 0} pending · Conflicts: {reviewHealth.conflicts ?? 0}
              </div>
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Last approved {formatTimestampLabel(truthHealth.approvedAt)}
              </div>
            </div>
          </Card>
        </div>

        <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
          Sync refreshes source evidence only. If something may change the approved business twin, it should appear in Knowledge Review before truth is updated.
        </div>

        {trustUnavailable ? (
          <div className="rounded-[22px] border border-amber-200/80 bg-amber-50/90 px-4 py-4 text-sm leading-6 text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">
            Operator trust summary is temporarily unavailable. Source cards below still reflect the last loaded settings state, but health and audit signals could not be loaded.
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button
            onClick={onCreate}
            disabled={!canManage}
            leftIcon={<Database className="h-4 w-4" />}
          >
            Add Source
          </Button>
        </div>

        {!items.length ? (
          <EmptyState
            title="Hələ source yoxdur"
            subtitle="Website, Instagram və digər mənbələri əlavə et ki AI şirkəti özü anlamağa başlasın."
            actionLabel="Create First Source"
            onAction={onCreate}
            disabled={!canManage}
          />
        ) : (
          <div className="space-y-4">
            {items.map((item, idx) => (
              <SourceCard
                key={item.id || `${item.source_key || "source"}-${idx}`}
                item={item}
                canManage={canManage}
                saving={savingId === String(item.id || item.source_key || "new")}
                syncing={syncingId === String(item.id || "")}
                onSave={handleSave}
                onStartSync={handleStartSync}
                onViewSyncRuns={onViewSyncRuns}
              />
            ))}
          </div>
        )}

        <Card variant="surface" padded="md" className="rounded-[24px]">
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold text-slate-950 dark:text-white">
                Recent Sync Health
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Latest source sync outcomes that may affect review and approved truth.
              </div>
            </div>

            {!trustRecentRuns?.length ? (
              <EmptyState
                title="No recent sync runs"
                subtitle="New source sync activity will appear here once operators refresh evidence."
              />
            ) : (
              <div className="space-y-3">
                {trustRecentRuns.slice(0, 5).map((run) => (
                  <div
                    key={run.id || `${run.sourceId || "source"}-${run.startedAt || run.createdAt || ""}`}
                    className="flex flex-col gap-2 rounded-[18px] border border-slate-200/80 px-4 py-3 dark:border-white/10"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="info" variant="subtle" dot>
                        {run.sourceDisplayName || run.sourceType || "Source"}
                      </Badge>
                      <SyncStatusBadge status={run.status} />
                      {run.reviewRequired ? (
                        <Badge tone="warn" variant="subtle" dot>
                          Review required
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Started {formatTimestampLabel(run.startedAt || run.createdAt)} · Finished{" "}
                      {formatTimestampLabel(run.finishedAt)}
                    </div>
                    {run.errorMessage ? (
                      <div className="text-sm text-rose-600 dark:text-rose-300">{run.errorMessage}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </SettingsSection>
  );
}

function SourceCard({
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

function SyncRunsModal({ open, source, items, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
      <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-950">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-5 dark:border-white/10">
          <div className="space-y-1">
            <div className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">
              Source Sync Runs
            </div>
            <div className="text-xl font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
              {source?.display_name || source?.source_url || source?.source_key || "Source"}
            </div>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {!items.length ? (
            <EmptyState
              title="Sync run yoxdur"
              subtitle="Bu source üçün hələ heç bir sync işə düşməyib."
            />
          ) : (
            <div className="space-y-4">
              {items.map((run) => (
                <Card key={run.id} variant="surface" padded="md" className="rounded-[24px]">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="info" variant="subtle" dot>
                          {run.run_type}
                        </Badge>
                        <Badge tone="neutral" variant="subtle" dot>
                          {run.trigger_type}
                        </Badge>
                        <SyncStatusBadge status={run.status} />
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        Started: {run.started_at || "—"} · Finished: {run.finished_at || "—"}
                      </div>
                    </div>

                    <div className="grid min-w-[320px] gap-3 sm:grid-cols-3">
                      <StatTile
                        label="Candidates"
                        value={run.candidates_created || 0}
                        hint="çıxarılan knowledge"
                        tone="info"
                      />
                      <StatTile
                        label="Promoted"
                        value={run.items_promoted || 0}
                        hint="approved/trusted"
                        tone="success"
                      />
                      <StatTile
                        label="Conflicts"
                        value={run.conflicts_found || 0}
                        hint="review tələb edir"
                        tone={run.conflicts_found > 0 ? "warn" : "neutral"}
                      />
                    </div>
                  </div>

                  {run.error_message ? (
                    <div className="mt-4 rounded-[18px] border border-rose-200/80 bg-rose-50/90 px-4 py-3 text-sm text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
                      {run.error_message}
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KnowledgeReviewPanel({
  items,
  canManage,
  onApprove,
  onReject,
  trustAudit,
  trustStatus,
}) {
  const [busyId, setBusyId] = useState("");
  const [busyAction, setBusyAction] = useState("");

  async function handleApprove(item) {
    setBusyId(String(item.id || ""));
    setBusyAction("approve");
    try {
      await onApprove(item);
    } finally {
      setBusyId("");
      setBusyAction("");
    }
  }

  async function handleReject(item) {
    setBusyId(String(item.id || ""));
    setBusyAction("reject");
    try {
      await onReject(item);
    } finally {
      setBusyId("");
      setBusyAction("");
    }
  }

  const conflictCount = items.filter(
    (x) => String(x.status).toLowerCase() === "conflict"
  ).length;
  const trustUnavailable = trustStatus === "unavailable";

  return (
    <SettingsSection
      eyebrow="Source Intelligence"
      title="Knowledge Review"
      subtitle="Candidates from source sync and source evidence land here before they can influence approved truth."
      tone="default"
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <StatTile
            label="Pending Items"
            value={items.length}
            hint="Evidence-backed candidates waiting for review"
            tone="info"
          />
          <StatTile
            label="Conflicts"
            value={conflictCount}
            hint="Candidates that need closer human judgment"
            tone={conflictCount > 0 ? "warn" : "neutral"}
          />
          <StatTile
            label="Truth Protection"
            value="Review Required"
            hint="Sync never auto-promotes evidence into approved truth"
            tone="success"
          />
        </div>

        <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
          Approve a candidate only when the source evidence is strong enough to move it forward in the truth-maintenance workflow. Rejecting leaves approved truth unchanged.
        </div>

        <Card variant="surface" padded="md" className="rounded-[24px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-950 dark:text-white">
                  Recent Trust Activity
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Minimal audit trail for source, review, and truth-governance actions.
                </div>
              </div>
              {trustUnavailable ? (
                <Badge tone="warn" variant="subtle" dot>
                  Unavailable
                </Badge>
              ) : null}
            </div>

            {!trustAudit?.length ? (
              <EmptyState
                title="No recent trust activity"
                subtitle={
                  trustUnavailable
                    ? "Audit signals are temporarily unavailable."
                    : "Recent source, review, and truth actions will appear here."
                }
              />
            ) : (
              <div className="space-y-3">
                {trustAudit.slice(0, 6).map((entry) => (
                  <div
                    key={entry.id || `${entry.action || "action"}-${entry.createdAt || ""}`}
                    className="flex flex-col gap-2 rounded-[18px] border border-slate-200/80 px-4 py-3 dark:border-white/10"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="info" variant="subtle" dot>
                        {titleizeTrustAction(entry.action)}
                      </Badge>
                      <Badge tone="neutral" variant="subtle" dot>
                        {entry.actor || "system"}
                      </Badge>
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {formatTimestampLabel(entry.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {!items.length ? (
          <EmptyState
            title="No review items waiting"
            subtitle="When source sync surfaces candidate changes that may affect approved truth, they will appear here for review."
          />
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <KnowledgeCandidateCard
                key={item.id}
                item={item}
                canManage={canManage}
                busyApprove={busyId === String(item.id) && busyAction === "approve"}
                busyReject={busyId === String(item.id) && busyAction === "reject"}
                onApprove={handleApprove}
                onReject={handleReject}
              />
            ))}
          </div>
        )}
      </div>
    </SettingsSection>
  );
}

function KnowledgeCandidateCard({
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

export default function SettingsController() {
  const [activeSection, setActiveSection] = useState("general");
  const [perm, setPerm] = useState("default");
  const [pushBusy, setPushBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [pushMessage, setPushMessage] = useState("");

  const env = useMemo(() => {
    const VAPID = String(import.meta.env?.VITE_VAPID_PUBLIC_KEY || "").trim();
    const API_BASE = String(import.meta.env?.VITE_API_BASE || "").trim();
    const DEBUG_PUSH = String(import.meta.env?.VITE_DEBUG_PUSH || "").trim();
    return { VAPID, API_BASE, DEBUG_PUSH };
  }, []);

  const workspaceState = useSettingsWorkspace({ setMessage });
  const {
    loading,
    setLoading,
    saving,
    workspace,
    setWorkspace,
    agents,
    agentsLoading,
    setAgentsLoading,
    dirty,
    dirtyMap,
    canManageSettings,
    tenantKey,
    patchTenant,
    patchProfile,
    patchAi,
    loadWorkspaceBase,
    onSaveWorkspace,
    onResetWorkspace,
    saveAgent,
    setInitialWorkspace,
  } = workspaceState;

  const businessBrain = useBusinessBrain({
    canManageSettings,
    setWorkspace,
    setInitialWorkspace,
    setMessage,
  });

  const {
    businessFacts,
    setBusinessFacts,
    channelPolicies,
    setChannelPolicies,
    locations,
    setLocations,
    contacts,
    setContacts,
    refreshBusinessBrain,
    handleSaveBusinessFact,
    handleDeleteBusinessFact,
    handleSaveChannelPolicy,
    handleDeleteChannelPolicy,
    handleSaveLocation,
    handleDeleteLocation,
    handleSaveContact,
    handleDeleteContact,
  } = businessBrain;

  const sourceIntelligence = useSourceIntelligence({
    tenantKey,
    canManageSettings,
    setWorkspace,
    setInitialWorkspace,
    setMessage,
    onRefreshBusinessBrain: refreshBusinessBrain,
  });

  const {
    sources,
    setSources,
    knowledgeReview,
    setKnowledgeReview,
    syncRunsOpen,
    setSyncRunsOpen,
    syncRunsSource,
    syncRunsItems,
    trustSummary,
    trustRecentRuns,
    trustAudit,
    trustStatus,
    refreshSourceIntelligence,
    handleSaveSource,
    handleStartSourceSync,
    handleViewSourceSyncRuns,
    handleApproveKnowledge,
    handleRejectKnowledge,
  } = sourceIntelligence;

  const navItems = useMemo(
    () => [
      { key: "general", label: "General", description: "Workspace identity, region, language", dirty: !!dirtyMap.general, icon: Building2 },
      { key: "brand", label: "Brand", description: "Voice, audience, services, CTA", dirty: !!dirtyMap.brand, icon: Sparkles },
      { key: "ai_policy", label: "AI Policy", description: "Auto reply, approvals, quiet hours", dirty: !!dirtyMap.ai_policy, icon: ShieldCheck },
      { key: "business_facts", label: "Business Facts", description: "Structured company facts for AI", dirty: !!dirtyMap.business_facts, icon: BrainCircuit },
      { key: "channel_policies", label: "Channel Policies", description: "Per-channel reply behavior rules", dirty: !!dirtyMap.channel_policies, icon: ListTree },
      { key: "locations", label: "Locations", description: "Branches, address, working hours", dirty: !!dirtyMap.locations, icon: MapPin },
      { key: "contacts", label: "Contacts", description: "Phone, email, WhatsApp, public lines", dirty: !!dirtyMap.contacts, icon: Contact2 },
      { key: "sources", label: "Sources", description: "Connected data sources and sync intelligence", dirty: !!dirtyMap.sources, icon: Database },
      { key: "knowledge_review", label: "Knowledge Review", description: "Approve AI-discovered business knowledge", dirty: !!dirtyMap.knowledge_review, icon: SearchCheck },
      { key: "channels", label: "Channels", description: "Instagram, WhatsApp, Messenger", dirty: !!dirtyMap.channels, icon: Waypoints },
      { key: "agents", label: "Agents", description: "Agent status, model, enable/disable", dirty: !!dirtyMap.agents, icon: Bot },
      { key: "team", label: "Team", description: "Workspace users, roles, access", dirty: !!dirtyMap.team, icon: Users },
      { key: "notifications", label: "Notifications", description: "Push subscription and browser status", dirty: !!dirtyMap.notifications, icon: BellRing },
    ],
    [dirtyMap]
  );

  useEffect(() => {
    getNotificationPermission().then(setPerm).catch(() => setPerm("default"));

    if (env.DEBUG_PUSH === "1") {
      console.log("[push][env] VITE_API_BASE =", env.API_BASE || "(empty)");
      console.log("[push][env] VITE_VAPID_PUBLIC_KEY present =", Boolean(env.VAPID));
      console.log("[push][env] VITE_VAPID_PUBLIC_KEY len =", env.VAPID ? env.VAPID.length : 0);
    }
  }, [env.API_BASE, env.DEBUG_PUSH, env.VAPID]);

  useEffect(() => {
    let mounted = true;

    async function loadAll() {
      setLoading(true);
      setAgentsLoading(true);
      setMessage("");

      try {
        const base = await loadWorkspaceBase();
        if (!mounted) return;
        await Promise.all([
          refreshBusinessBrain(),
          refreshSourceIntelligence(base.tenantKey),
        ]);
      } catch (e) {
        if (!mounted) return;
        setMessage(String(e?.message || e));
      } finally {
        if (!mounted) return;
        setLoading(false);
        setAgentsLoading(false);
      }
    }

    loadAll();
    return () => {
      mounted = false;
    };
  }, [loadWorkspaceBase, refreshBusinessBrain, refreshSourceIntelligence, setAgentsLoading, setLoading]);

  function handleResetWorkspace() {
    const reset = onResetWorkspace();
    setBusinessFacts(Array.isArray(reset?.businessFacts) ? reset.businessFacts : []);
    setChannelPolicies(Array.isArray(reset?.channelPolicies) ? reset.channelPolicies : []);
    setLocations(Array.isArray(reset?.locations) ? reset.locations : []);
    setContacts(Array.isArray(reset?.contacts) ? reset.contacts : []);
    setSources(Array.isArray(reset?.sources) ? reset.sources : []);
    setKnowledgeReview(Array.isArray(reset?.knowledgeReview) ? reset.knowledgeReview : []);
  }

  async function enableNotifications() {
    setPushBusy(true);
    setPushMessage("");

    try {
      const p = await askPermission();
      setPerm(p);

      if (p !== "granted") {
        setPushMessage("Notification icaz?si verilm?di. Browser settings-d?n icaz? ver.");
        return;
      }

      if (!env.VAPID) {
        setPushMessage("VITE_VAPID_PUBLIC_KEY yoxdur. .env.local yoxla v? Vite restart et.");
        return;
      }

      const res = await subscribePush({ vapidPublicKey: env.VAPID, recipient: "ceo" });

      if (!res?.ok) {
        const err = res?.json?.error || res?.error || res?.status || "unknown";
        setPushMessage(`Subscription u?ursuz oldu: ${err}`);
        return;
      }

      setPushMessage("? Push notifications aktiv edildi.");
    } catch (e) {
      setPushMessage(String(e?.message || e));
    } finally {
      setPushBusy(false);
    }
  }

  function renderSection() {
    switch (activeSection) {
      case "general":
        return <GeneralSection tenantKey={workspace.tenantKey} tenant={workspace.tenant} patchTenant={patchTenant} canManage={canManageSettings} />;
      case "brand":
        return <BrandSection profile={workspace.profile} patchProfile={patchProfile} canManage={canManageSettings} />;
      case "ai_policy":
        return (
          <AiPolicySection
            aiPolicy={workspace.aiPolicy}
            patchAi={patchAi}
            canManage={canManageSettings}
            autoContent={
              <AutoContentSection
                aiPolicy={workspace.aiPolicy}
                patchAi={patchAi}
                canManage={canManageSettings}
              />
            }
          />
        );
      case "business_facts":
        return (
          <BusinessFactsSection
            items={businessFacts}
            canManage={canManageSettings}
            onCreate={() => {
              const next = [createNewBusinessFact(), ...businessFacts];
              setBusinessFacts(next);
              setWorkspace((prev) => ({ ...prev, businessFacts: next }));
            }}
            onSave={handleSaveBusinessFact}
            onDelete={handleDeleteBusinessFact}
          />
        );
      case "channel_policies":
        return (
          <ChannelPoliciesSection
            items={channelPolicies}
            canManage={canManageSettings}
            onCreate={() => {
              const next = [createNewChannelPolicy(), ...channelPolicies];
              setChannelPolicies(next);
              setWorkspace((prev) => ({ ...prev, channelPolicies: next }));
            }}
            onSave={handleSaveChannelPolicy}
            onDelete={handleDeleteChannelPolicy}
          />
        );
      case "locations":
        return (
          <LocationsSection
            items={locations}
            canManage={canManageSettings}
            onCreate={() => {
              const next = [createNewLocation(), ...locations];
              setLocations(next);
              setWorkspace((prev) => ({ ...prev, locations: next }));
            }}
            onSave={handleSaveLocation}
            onDelete={handleDeleteLocation}
          />
        );
      case "contacts":
        return (
          <ContactsSection
            items={contacts}
            canManage={canManageSettings}
            onCreate={() => {
              const next = [createNewContact(), ...contacts];
              setContacts(next);
              setWorkspace((prev) => ({ ...prev, contacts: next }));
            }}
            onSave={handleSaveContact}
            onDelete={handleDeleteContact}
          />
        );
      case "sources":
        return (
          <SourcesSection>
            <SourcesPanel
              items={sources}
              canManage={canManageSettings}
              onCreate={() => {
                const next = [createNewSource(), ...sources];
                setSources(next);
                setWorkspace((prev) => ({ ...prev, sources: next }));
              }}
              onSave={handleSaveSource}
              onStartSync={handleStartSourceSync}
              onViewSyncRuns={handleViewSourceSyncRuns}
              trustSummary={trustSummary}
              trustRecentRuns={trustRecentRuns}
              trustStatus={trustStatus}
            />
          </SourcesSection>
        );
      case "knowledge_review":
        return (
          <KnowledgeReviewSection>
            <KnowledgeReviewPanel
              items={knowledgeReview}
              canManage={canManageSettings}
              onApprove={handleApproveKnowledge}
              onReject={handleRejectKnowledge}
              trustAudit={trustAudit}
              trustStatus={trustStatus}
            />
          </KnowledgeReviewSection>
        );
      case "channels":
        return <ChannelsPanel canManage={canManageSettings} />;
      case "agents":
        return <AgentsPanel agents={agents} loading={agentsLoading} canManage={canManageSettings} onSaveAgent={saveAgent} />;
      case "team":
        return <TeamPanel canManage={canManageSettings} />;
      case "notifications":
        return (
          <NotificationsSection
            perm={perm}
            pushBusy={pushBusy}
            pushMessage={pushMessage}
            env={env}
            enableNotifications={enableNotifications}
          />
        );
      default:
        return null;
    }
  }

  const saveWorkspaceWithSlices = () =>
    onSaveWorkspace({
      businessFacts,
      channelPolicies,
      locations,
      contacts,
      sources,
      knowledgeReview,
    });

  return (
    <>
      <SettingsShell
        title="Settings"
        subtitle="Workspace, brand, AI policy, business brain, team v? integrations idar?si."
        items={navItems}
        activeKey={activeSection}
        onChange={setActiveSection}
      >
        <div className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={canManageSettings ? "success" : "warn"} variant="subtle" dot={canManageSettings}>
                {canManageSettings ? "Owner / Admin Access" : "Read Only Access"}
              </Badge>
              <Badge tone={dirty ? "info" : "neutral"} variant="subtle" dot={dirty}>
                {dirty ? "Unsaved Workspace Edits" : "Workspace Synced"}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => window.location.reload()} leftIcon={<RefreshCw className="h-4 w-4" />}>
                Refresh
              </Button>
              <Button onClick={saveWorkspaceWithSlices} disabled={loading || saving || !canManageSettings}>
                {saving ? "Saving..." : "Save Workspace"}
              </Button>
            </div>
          </div>

          {!canManageSettings ? (
            <div className="rounded-[24px] border border-amber-200/80 bg-amber-50/90 px-4 py-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
              Bu workspace-d? settings d?yi?m?k s?lahiyy?ti yaln?z owner/admin ???nd?r.
            </div>
          ) : null}

          {message ? (
            <div className="rounded-[24px] border border-slate-200/80 bg-white/80 px-4 py-4 text-sm text-slate-700 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300">
              {message}
            </div>
          ) : null}

          {renderSection()}

          <SettingsSaveBar
            dirty={dirty && canManageSettings}
            saving={saving}
            message={message}
            onReset={handleResetWorkspace}
            onSave={saveWorkspaceWithSlices}
          />
        </div>
      </SettingsShell>

      <SyncRunsModal
        open={syncRunsOpen}
        source={syncRunsSource}
        items={syncRunsItems}
        onClose={() => {
          setSyncRunsOpen(false);
        }}
      />
    </>
  );
}

