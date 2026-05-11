import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  Database,
  ExternalLink,
  FileText,
  Globe2,
  LockKeyhole,
  RefreshCw,
  RotateCw,
  ShieldCheck,
} from "lucide-react";

import {
  listKnowledgeSources,
  syncKnowledgeSource,
} from "../api/knowledge.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import AppTag from "../components/ui/AppTag.jsx";
import AppModal, {
  AppModalBody,
  AppModalCloseButton,
  AppModalFooter,
  AppModalHeader,
} from "../components/ui/AppModal.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
  PageHeader,
} from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
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

function titleize(value = "") {
  return s(value || "unknown")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatWhen(value = "") {
  const raw = s(value);
  if (!raw) return "Not available";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceId(source = {}) {
  return s(source.id || source.source_id || source.sourceId);
}

function sourceType(source = {}) {
  return lower(source.source_type || source.sourceType || source.type || "source");
}

function sourceStatus(source = {}) {
  return lower(source.status || source.sync_status || source.syncStatus || "unknown");
}

function syncStatus(source = {}) {
  return lower(source.sync_status || source.syncStatus || source.status || "unknown");
}

function sourceName(source = {}) {
  return (
    s(source.display_name || source.displayName) ||
    s(source.source_key || source.sourceKey) ||
    titleize(sourceType(source))
  );
}

function sourceUrl(source = {}) {
  return s(source.source_url || source.sourceUrl || source.url);
}

function sourceKey(source = {}) {
  return s(source.source_key || source.sourceKey || source.external_account_id || source.externalAccountId);
}

function updatedAt(source = {}) {
  return s(source.updated_at || source.updatedAt || source.last_sync_at || source.lastSyncAt || source.created_at || source.createdAt);
}

function chunkCount(source = {}) {
  const direct = n(
    source.chunk_count ??
      source.chunkCount ??
      source.chunks_count ??
      source.chunksCount,
    NaN
  );

  if (Number.isFinite(direct)) return direct;

  const metadata = obj(source.metadata_json || source.metadataJson || source.metadata);
  const indexed = n(metadata.chunkCount ?? metadata.chunks ?? metadata.indexedChunks, NaN);

  return Number.isFinite(indexed) ? indexed : 0;
}

function statusTone(status = "") {
  const safe = lower(status);

  if (["active", "connected", "ready", "synced", "completed", "approved"].includes(safe)) {
    return "success";
  }

  if (["syncing", "queued", "pending", "needs_review", "review", "stale"].includes(safe)) {
    return "warning";
  }

  if (["failed", "error", "blocked", "disabled", "unavailable"].includes(safe)) {
    return "danger";
  }

  return "neutral";
}

function typeIcon(type = "") {
  const safe = lower(type);

  if (safe.includes("website") || safe.includes("web")) return Globe2;
  if (safe.includes("file") || safe.includes("document") || safe.includes("pdf")) return FileText;
  if (safe.includes("policy")) return ShieldCheck;

  return Database;
}

function sourceEnabled(source = {}) {
  if (typeof source.is_enabled === "boolean") return source.is_enabled;
  if (typeof source.isEnabled === "boolean") return source.isEnabled;
  if (typeof source.enabled === "boolean") return source.enabled;
  return true;
}

function normalizeSource(source = {}) {
  const type = sourceType(source);
  const status = sourceStatus(source);
  const sync = syncStatus(source);

  return {
    raw: source,
    id: sourceId(source),
    name: sourceName(source),
    type,
    typeLabel: titleize(type),
    icon: typeIcon(type),
    status,
    statusLabel: titleize(status),
    syncStatus: sync,
    syncLabel: titleize(sync),
    statusTone: statusTone(status),
    syncTone: statusTone(sync),
    enabled: sourceEnabled(source),
    key: sourceKey(source),
    url: sourceUrl(source),
    chunks: chunkCount(source),
    updated: formatWhen(updatedAt(source)),
    updatedRaw: updatedAt(source),
    authStatus: lower(source.auth_status || source.authStatus || ""),
    connectionMode: lower(source.connection_mode || source.connectionMode || ""),
    accessScope: lower(source.access_scope || source.accessScope || ""),
    isPrimary: source.is_primary === true || source.isPrimary === true,
    metadata: obj(source.metadata_json || source.metadataJson || source.metadata),
    permissions: obj(source.permissions_json || source.permissionsJson || source.permissions),
    settings: obj(source.settings_json || source.settingsJson || source.settings),
  };
}

function SourceStat({ label, value }) {
  return (
    <div className="rounded-md border border-line-soft bg-white px-4 py-3 shadow-[var(--shadow-inset-top)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
        {label}
      </div>
      <div className="mt-1 truncate text-[14px] font-semibold text-text">
        {value || "Not available"}
      </div>
    </div>
  );
}

function EmptyKnowledgeState({ onOpenWebsiteSetup, onOpenBusinessInfo }) {
  return (
    <Card padded={false} clip>
      <div className="flex min-h-[440px] items-center justify-center px-6 py-12 text-center">
        <div className="max-w-[600px]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-md border border-line-soft bg-surface-subtle text-text-muted">
            <BookOpenCheck className="h-8 w-8" strokeWidth={1.9} />
          </div>

          <h2 className="mt-5 text-[22px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
            No knowledge sources yet
          </h2>

          <p className="mt-2 text-[13.5px] font-medium leading-6 text-text-muted">
            No fake FAQ, policy, website, or upload cards are shown. Start with Website setup to scan real public pages,
            then approve the extracted facts in Business Info before the assistant can use them.
          </p>

          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={onOpenWebsiteSetup}
              rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
            >
              Start Website setup
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={onOpenBusinessInfo}
            >
              Open Business Info
            </Button>
          </div>

          <div className="mt-5 rounded-md border border-warning/20 bg-warning-soft px-4 py-3 text-left">
            <div className="text-[13px] font-semibold text-text">
              How AI knowledge works
            </div>
            <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
              The AI should only use information you have connected, reviewed, and approved. Knowledge becomes usable only after real source sync and approval.
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
function SourceCard({ source, selected = false, busy = false, onOpen, onSync }) {
  const Icon = source.icon;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen?.();
        }
      }}
      className={cx(
        "group cursor-pointer rounded-md border bg-white p-5 transition-[background-color,border-color,box-shadow] duration-base ease-premium",
        selected
          ? "border-brand shadow-[inset_3px_0_0_rgb(var(--color-brand)),0_18px_34px_-30px_rgba(37,99,235,0.62)]"
          : "border-line-soft hover:border-line hover:bg-surface-subtle hover:shadow-[0_14px_30px_-28px_rgba(15,23,42,0.45)]"
      )}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_170px] xl:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center text-text">
              <Icon className="h-9 w-9" strokeWidth={1.85} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-[18px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                  {source.name}
                </h3>

                <AppTag tone={source.statusTone} dot>
                  {source.statusLabel}
                </AppTag>

                <AppTag tone={source.enabled ? "success" : "danger"} dot>
                  {source.enabled ? "Enabled" : "Disabled"}
                </AppTag>
              </div>

              <p className="mt-1.5 max-w-[820px] text-[13.5px] font-medium leading-6 text-text-muted">
                {source.url
                  ? source.url
                  : source.key
                    ? source.key
                    : "No public URL or source key is exposed for this source."}
              </p>

              <div className="mt-4 border-t border-line-soft pt-3">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <div className="text-[12.5px] font-semibold text-text-muted">
                    {source.typeLabel}
                  </div>

                  <div className="text-[12.5px] font-medium text-text-muted">
                    {source.chunks} indexed chunks
                  </div>

                  <div className="text-[12.5px] font-medium text-text-muted">
                    Sync: {source.syncLabel}
                  </div>

                  <div className="min-w-0 truncate text-[12.5px] font-medium text-text-muted">
                    Updated: {source.updated}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-start gap-2 xl:justify-end">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={(event) => {
              event.stopPropagation();
              onOpen?.();
            }}
            rightIcon={<ArrowRight className="h-3.5 w-3.5" strokeWidth={2.1} />}
          >
            Details
          </Button>

          <Button
            type="button"
            size="sm"
            loading={busy}
            disabled={!source.id || busy || !source.enabled}
            onClick={(event) => {
              event.stopPropagation();
              onSync?.();
            }}
            rightIcon={!busy ? <RotateCw className="h-3.5 w-3.5" strokeWidth={2.1} /> : undefined}
          >
            Sync
          </Button>
        </div>
      </div>
    </article>
  );
}

function DetailJsonBlock({ title, value }) {
  const payload = obj(value);
  const hasValue = Object.keys(payload).length > 0;

  return (
    <div className="rounded-md border border-line-soft bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
          {title}
        </div>

        <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-text-subtle">
          <LockKeyhole className="h-3.5 w-3.5" strokeWidth={2.1} />
          Details
        </div>
      </div>

      <pre className="mt-3 max-h-[240px] overflow-auto rounded-md bg-surface-subtle p-3 text-[12px] leading-5 text-text-muted">
        {hasValue ? JSON.stringify(payload, null, 2) : "No additional details available."}
      </pre>
    </div>
  );
}

function SourceDialog({ source, open, busy = false, onClose, onSync }) {
  if (!open || !source) return null;

  const Icon = source.icon;

  return (
    <AppModal open={open} onClose={onClose} maxWidth="max-w-[760px]">
      <AppModalHeader>
        <div className="flex min-w-0 items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center text-text">
            <Icon className="h-11 w-11" strokeWidth={1.78} />
          </div>

          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand">
              Knowledge source
            </div>

            <h2 className="mt-2 text-[24px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
              {source.name}
            </h2>

            <p className="mt-2 max-w-[580px] text-[13.5px] font-medium leading-6 text-text-muted">
              Review the source details, sync status, and indexed content before using it for AI replies.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <AppTag tone={source.statusTone} dot>
                {source.statusLabel}
              </AppTag>
              <AppTag tone={source.syncTone} dot>
                Sync {source.syncLabel}
              </AppTag>
              <AppTag tone={source.enabled ? "success" : "danger"} dot>
                {source.enabled ? "Enabled" : "Disabled"}
              </AppTag>
            </div>
          </div>
        </div>

        <AppModalCloseButton onClick={onClose} label="Close source detail" />
      </AppModalHeader>

      <AppModalBody className="bg-surface-subtle p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <SourceStat label="Type" value={source.typeLabel} />
          <SourceStat label="Chunks" value={String(source.chunks)} />
          <SourceStat label="Primary" value={source.isPrimary ? "Yes" : "No"} />
          <SourceStat label="Auth status" value={titleize(source.authStatus)} />
          <SourceStat label="Connection" value={titleize(source.connectionMode)} />
          <SourceStat label="Access scope" value={titleize(source.accessScope)} />
        </div>

        <Card padded={false} clip>
          <div className="grid gap-3 p-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                Source URL / key
              </div>
              <div className="mt-1 break-all text-[13.5px] font-semibold text-text">
                {source.url || source.key || "Not available"}
              </div>
            </div>

            {source.url ? (
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-2 text-[13px] font-semibold text-brand"
              >
                Open source
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.1} />
              </a>
            ) : null}
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <DetailJsonBlock title="Metadata" value={source.metadata} />
          <DetailJsonBlock title="Settings" value={source.settings} />
        </div>
      </AppModalBody>

      <AppModalFooter className="bg-white">
        <Button type="button" variant="secondary" size="md" onClick={onClose}>
          Close
        </Button>

        <Button
          type="button"
          size="md"
          loading={busy}
          disabled={!source.id || busy || !source.enabled}
          onClick={onSync}
          rightIcon={!busy ? <RotateCw className="h-4 w-4" strokeWidth={2.1} /> : undefined}
        >
          Sync source
        </Button>
      </AppModalFooter>
    </AppModal>
  );
}

function SummaryBar({ sources }) {
  const connected = sources.filter((source) =>
    ["active", "connected", "ready", "synced", "completed"].includes(source.status)
  ).length;
  const review = sources.filter((source) =>
    ["needs_review", "review", "pending", "syncing", "queued", "stale"].includes(source.status)
  ).length;
  const disabled = sources.filter((source) => !source.enabled).length;
  const chunks = sources.reduce((total, source) => total + n(source.chunks), 0);

  return (
    <Card padded={false} clip>
      <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
        <div>
          <div className="text-[17px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
            Assistant answer sources
          </div>
          <div className="mt-1 text-[13.5px] font-medium leading-6 text-text-muted">
            Sources your AI can use after review and approval.
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <AppTag tone={connected ? "success" : "neutral"} dot>
            {connected} ready
          </AppTag>
          <AppTag tone={review ? "warning" : "neutral"} dot>
            {review} review
          </AppTag>
          <AppTag tone={disabled ? "danger" : "success"} dot>
            {disabled} disabled
          </AppTag>
          <AppTag tone="neutral">
            {chunks} chunks
          </AppTag>
        </div>
      </div>
    </Card>
  );
}

export default function Knowledge() {
  const navigate = useNavigate();
  const [sources, setSources] = useState([]);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [dialogSourceId, setDialogSourceId] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingId, setSyncingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const normalizedSources = useMemo(
    () => arr(sources).map(normalizeSource).filter((source) => source.id || source.name),
    [sources]
  );

  const selectedSource = useMemo(() => {
    return normalizedSources.find((source) => source.id === selectedSourceId) || null;
  }, [normalizedSources, selectedSourceId]);

  const dialogSource = useMemo(() => {
    return normalizedSources.find((source) => source.id === dialogSourceId) || null;
  }, [dialogSourceId, normalizedSources]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");
    setNotice("");

    try {
      const payload = await listKnowledgeSources({ limit: 100 });
      setSources(arr(payload?.items));
    } catch (err) {
      setSources([]);
      setError(
        s(err?.payload?.error || err?.payload?.message || err?.message) ||
          "Knowledge sources could not be loaded."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function syncSource(source) {
    if (!source?.id) return;

    setSyncingId(source.id);
    setError("");
    setNotice("");

    try {
      const response = await syncKnowledgeSource(source.id);
      setNotice(response?.message || "Source sync accepted.");
      await load({ silent: true });
    } catch (err) {
      setError(
        s(err?.payload?.error || err?.payload?.message || err?.message) ||
          "Source sync could not be started."
      );
    } finally {
      setSyncingId("");
    }
  }

  function openSource(source) {
    setSelectedSourceId(source.id);
    setDialogSourceId(source.id);
  }

  if (loading) {
    return (
      <PageCanvas>
        <LoadingSurface
          title="Loading knowledge sources"
          description="Loading your knowledge sources."
          rows={5}
        />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas>
      <PageHeader
        title="Knowledge library"
        description="Connect and review the information your AI can use when answering customers."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              loading={refreshing}
              onClick={() => load({ silent: true })}
              leftIcon={!refreshing ? <RefreshCw className="h-4 w-4" strokeWidth={2.1} /> : undefined}
            >
              Refresh
            </Button>

            <Button
              type="button"
              size="md"
              variant="secondary"
              onClick={() => navigate("/channels?channel=website")}
              leftIcon={<ShieldCheck className="h-4 w-4" strokeWidth={2.1} />}
            >
              Add from website
            </Button>
          </div>
        }
      />

      {error ? (
        <InlineNotice tone="danger" title="Knowledge unavailable" description={error} />
      ) : null}

      {notice ? (
        <InlineNotice tone="success" title="Sync requested" description={notice} compact />
      ) : null}

      <SummaryBar sources={normalizedSources} />

      {normalizedSources.length ? (
        <div className="grid gap-3">
          {normalizedSources.map((source) => (
            <SourceCard
              key={source.id || source.name}
              source={source}
              selected={selectedSource?.id === source.id}
              busy={syncingId === source.id}
              onOpen={() => openSource(source)}
              onSync={() => syncSource(source)}
            />
          ))}
        </div>
      ) : (
        <EmptyKnowledgeState
          onOpenWebsiteSetup={() => navigate("/channels?channel=website")}
          onOpenBusinessInfo={() => navigate("/truth?source=website&review=business_info")}
        />
      )}

      <SourceDialog
        source={dialogSource}
        open={Boolean(dialogSource)}
        busy={syncingId === dialogSource?.id}
        onClose={() => setDialogSourceId("")}
        onSync={() => syncSource(dialogSource)}
      />
    </PageCanvas>
  );
}
