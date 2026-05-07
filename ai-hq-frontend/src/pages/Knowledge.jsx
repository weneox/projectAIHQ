import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";

import {
  approveKnowledgeCandidate,
  listKnowledgeCandidates,
  rejectKnowledgeCandidate,
} from "../api/knowledge.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
} from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";

const FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function titleize(value = "") {
  return s(value || "pending")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function candidateId(item = {}) {
  return s(item.id || item.candidateId || item.candidate_id);
}

function candidateStatus(item = {}) {
  return lower(item.status || item.review_status || item.state || "pending");
}

function candidateTitle(item = {}) {
  return s(
    item.title ||
      item.label ||
      item.fieldLabel ||
      item.field_label ||
      item.key ||
      item.candidateKey ||
      "Knowledge item"
  );
}

function candidateValue(item = {}) {
  return s(
    item.valueText ||
      item.value_text ||
      item.normalizedText ||
      item.normalized_text ||
      item.value ||
      item.text ||
      item.content ||
      item.summary ||
      ""
  );
}

function sourceLabel(item = {}) {
  const source = obj(item.source || item.sourceSummary || item.source_summary);

  return s(
    source.label ||
      source.sourceLabel ||
      source.sourceType ||
      item.sourceLabel ||
      item.source_type ||
      item.sourceType ||
      "Workspace source"
  );
}

function formatWhen(value = "") {
  const raw = s(value);
  if (!raw) return "";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function toneForStatus(status = "") {
  const safe = lower(status);

  if (["approved", "accepted", "published"].includes(safe)) return "success";
  if (["rejected", "discarded", "blocked"].includes(safe)) return "danger";
  if (["conflicting", "quarantined", "review_required"].includes(safe)) {
    return "warning";
  }

  return "brand";
}

function toneText(tone = "neutral") {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "brand") return "text-brand";
  return "text-text-muted";
}

function toneDot(tone = "neutral") {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "brand") return "bg-brand";
  return "bg-[rgb(var(--color-text-soft))]";
}

function itemsFromPayload(payload = {}) {
  return arr(payload.items).length
    ? arr(payload.items)
    : arr(payload.candidates);
}

function canReview(item = {}) {
  const status = candidateStatus(item);

  return [
    "",
    "pending",
    "review",
    "awaiting_review",
    "conflicting",
    "quarantined",
    "review_required",
  ].includes(status);
}

function Status({ status }) {
  const tone = toneForStatus(status);

  return (
    <span className={cx("inline-flex items-center gap-2 text-[12px] font-semibold", toneText(tone))}>
      <span className={cx("h-1.5 w-1.5 rounded-full", toneDot(tone))} />
      {titleize(status)}
    </span>
  );
}

function FilterTabs({ value, onChange }) {
  return (
    <div className="flex rounded-full border border-line-soft bg-white p-1">
      {FILTERS.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={cx(
            "h-8 rounded-full px-3.5 text-[12px] font-semibold transition-all duration-base ease-premium",
            value === item.key
              ? "bg-surface-subtle text-text"
              : "text-text-muted hover:text-text"
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ filter }) {
  const title =
    filter === "pending"
      ? "No knowledge waiting for review"
      : filter === "approved"
        ? "No approved knowledge yet"
        : filter === "rejected"
          ? "No rejected knowledge"
          : "No knowledge items yet";

  const body =
    filter === "pending"
      ? "When the system discovers a new fact, FAQ, service, price, or policy, it will wait here before AI can use it."
      : "Knowledge history will appear here when review activity starts.";

  return (
    <div className="flex min-h-[420px] items-center justify-center px-6 py-12 text-center">
      <div className="max-w-[560px]">
        <div className="mx-auto h-1.5 w-14 rounded-full bg-line-strong" />
        <h2 className="mt-6 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
          {title}
        </h2>
        <p className="mt-2 text-[13.5px] font-medium leading-6 text-text-muted">
          {body}
        </p>
      </div>
    </div>
  );
}

function CandidateRow({ item, busyId, onApprove, onReject }) {
  const id = candidateId(item);
  const status = candidateStatus(item);
  const value = candidateValue(item);
  const reviewable = canReview(item);
  const busy = busyId === id;
  const when = formatWhen(item.created_at || item.createdAt || item.updated_at || item.updatedAt);

  return (
    <div className="grid gap-4 rounded-[18px] border border-line-soft bg-white px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="truncate text-[14.5px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
            {candidateTitle(item)}
          </div>
          <Status status={status} />
        </div>

        <div className="mt-2 text-[13.5px] font-medium leading-6 text-text-muted">
          {value || "No preview text returned for this item."}
        </div>

        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] font-medium text-text-subtle">
          <span>{sourceLabel(item)}</span>
          {when ? <span>{when}</span> : null}
        </div>
      </div>

      {reviewable ? (
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            loading={busy}
            onClick={() => onReject(id)}
            leftIcon={!busy ? <X className="h-4 w-4" strokeWidth={2.1} /> : undefined}
          >
            Reject
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={busy}
            loading={busy}
            onClick={() => onApprove(id)}
            leftIcon={!busy ? <Check className="h-4 w-4" strokeWidth={2.1} /> : undefined}
          >
            Approve
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export default function Knowledge() {
  const [filter, setFilter] = useState("pending");
  const [state, setState] = useState({
    loading: true,
    refreshing: false,
    error: "",
    items: [],
  });
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async ({ refreshing = false } = {}) => {
    setState((current) => ({
      ...current,
      loading: !refreshing,
      refreshing,
      error: "",
    }));

    try {
      const payload = await listKnowledgeCandidates({
        status: filter === "all" ? "" : filter,
        limit: 150,
      });

      setState({
        loading: false,
        refreshing: false,
        error: "",
        items: itemsFromPayload(payload),
      });
    } catch (error) {
      setState({
        loading: false,
        refreshing: false,
        error:
          s(error?.payload?.reason || error?.payload?.error || error?.message) ||
          "Knowledge could not be loaded.",
        items: [],
      });
    }
  }, [filter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const visibleItems = useMemo(() => {
    const items = arr(state.items);
    if (filter === "all") return items;
    return items.filter((item) => candidateStatus(item) === filter);
  }, [state.items, filter]);

  async function handleApprove(id) {
    if (!id || busyId) return;

    try {
      setBusyId(id);
      setNotice(null);
      await approveKnowledgeCandidate(id);
      setNotice({
        tone: "success",
        title: "Approved",
        description: "This item can now move through the governed knowledge path.",
      });
      await load({ refreshing: true });
    } catch (error) {
      setNotice({
        tone: "danger",
        title: "Approve failed",
        description:
          s(error?.payload?.reason || error?.payload?.error || error?.message) ||
          "This item could not be approved.",
      });
    } finally {
      setBusyId("");
    }
  }

  async function handleReject(id) {
    if (!id || busyId) return;

    try {
      setBusyId(id);
      setNotice(null);
      await rejectKnowledgeCandidate(id, {
        reason: "Rejected from Knowledge review",
      });
      setNotice({
        tone: "success",
        title: "Rejected",
        description: "This item will not affect AI replies.",
      });
      await load({ refreshing: true });
    } catch (error) {
      setNotice({
        tone: "danger",
        title: "Reject failed",
        description:
          s(error?.payload?.reason || error?.payload?.error || error?.message) ||
          "This item could not be rejected.",
      });
    } finally {
      setBusyId("");
    }
  }

  if (state.loading) {
    return (
      <PageCanvas className="max-w-[1180px] py-3">
        <LoadingSurface title="Loading knowledge" />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas className="max-w-[1180px] space-y-4 py-3">
      {state.error ? (
        <InlineNotice
          tone="danger"
          title="Knowledge unavailable"
          description={state.error}
          compact
        />
      ) : null}

      {notice ? (
        <InlineNotice
          tone={notice.tone}
          title={notice.title}
          description={notice.description}
          compact
        />
      ) : null}

      <Card padded={false} clip className="shadow-[0_28px_80px_-64px_rgba(15,23,42,0.55)]">
        <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="mt-1 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
              Review what AI is allowed to learn
            </h1>
            <p className="mt-2 max-w-[720px] text-[13.5px] font-medium leading-6 text-text-muted">
              New facts stay here until they are approved or rejected. Nothing in this queue should affect live replies by itself.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <FilterTabs value={filter} onChange={setFilter} />

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

        <div className="border-t border-line-soft">
          {visibleItems.length ? (
            <>
              <div className="px-5 py-3 text-[12.5px] font-medium text-text-muted">
                {visibleItems.length} item{visibleItems.length === 1 ? "" : "s"} shown
              </div>

              <div className="grid gap-3 px-4 pb-4">
                {visibleItems.map((item, index) => (
                  <CandidateRow
                    key={candidateId(item) || `${candidateTitle(item)}-${index}`}
                    item={item}
                    busyId={busyId}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))}
              </div>
            </>
          ) : (
            <EmptyState filter={filter} />
          )}
        </div>
      </Card>
    </PageCanvas>
  );
}