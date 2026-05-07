import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, RefreshCw, Search } from "lucide-react";

import { listLeads } from "../api/leads.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
} from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";

const STAGES = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function n(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function titleize(value = "") {
  return s(value || "new")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value = "") {
  const raw = s(value);
  if (!raw) return "";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function pickName(lead = {}) {
  return s(
    lead.full_name ||
      lead.fullName ||
      lead.name ||
      lead.display_name ||
      lead.username ||
      lead.email ||
      lead.phone ||
      "Unknown customer"
  );
}

function pickContact(lead = {}) {
  return [s(lead.email), s(lead.phone), s(lead.username)]
    .filter(Boolean)
    .join(" / ");
}

function leadStage(lead = {}) {
  return lower(lead.stage || "new");
}

function leadStatus(lead = {}) {
  return lower(lead.status || "open");
}

function toneForStage(stage = "") {
  const safe = lower(stage);
  if (["won", "converted", "customer"].includes(safe)) return "success";
  if (["lost", "closed_lost"].includes(safe)) return "danger";
  if (["qualified", "proposal", "negotiation"].includes(safe)) return "brand";
  return "neutral";
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

function StagePill({ stage }) {
  const tone = toneForStage(stage);

  return (
    <span className={cx("inline-flex items-center gap-2 text-[12px] font-semibold", toneText(tone))}>
      <span className={cx("h-1.5 w-1.5 rounded-full", toneDot(tone))} />
      {titleize(stage)}
    </span>
  );
}

function StageTabs({ value, onChange }) {
  return (
    <div className="flex overflow-x-auto rounded-full border border-line-soft bg-white p-1">
      {STAGES.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={cx(
            "h-8 whitespace-nowrap rounded-full px-3.5 text-[12px] font-semibold transition-all duration-base ease-premium",
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

function EmptyState({ hasQuery }) {
  return (
    <div className="flex min-h-[420px] items-center justify-center px-6 py-12 text-center">
      <div className="max-w-[520px]">
        <div className="mx-auto h-1.5 w-14 rounded-full bg-line-strong" />
        <h2 className="mt-6 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
          {hasQuery ? "No matching customers" : "No customers yet"}
        </h2>
        <p className="mt-2 text-[13.5px] font-medium leading-6 text-text-muted">
          {hasQuery
            ? "Try a different name, email, phone, username, or stage."
            : "Customer records will appear here when conversations create leads."}
        </p>
      </div>
    </div>
  );
}

function CustomerRow({ lead, onOpen }) {
  const name = pickName(lead);
  const contact = pickContact(lead);
  const stage = leadStage(lead);
  const status = leadStatus(lead);
  const threadId = s(lead.inbox_thread_id || lead.inboxThreadId);
  const updated = formatDate(lead.updated_at || lead.updatedAt || lead.created_at || lead.createdAt);
  const interest = s(lead.interest || lead.intent || lead.summary);

  return (
    <div className="grid gap-3 border-t border-line-soft px-5 py-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(140px,0.35fr)_minmax(120px,0.25fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
          {name}
        </div>
        <div className="mt-1 truncate text-[12.5px] font-medium text-text-muted">
          {contact || "No contact details"}
        </div>
        {interest ? (
          <div className="mt-1 truncate text-[12px] font-medium text-text-subtle">
            {interest}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <StagePill stage={stage} />
      </div>

      <div className="text-[12.5px] font-medium text-text-muted">
        {updated || titleize(status)}
      </div>

      {threadId ? (
        <button
          type="button"
          onClick={() => onOpen(threadId)}
          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold text-text-muted transition-colors duration-base ease-premium hover:bg-surface-subtle hover:text-text"
        >
          Conversation
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.1} />
        </button>
      ) : (
        <span className="text-[12px] font-medium text-text-subtle">No thread</span>
      )}
    </div>
  );
}

export default function Customers() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [state, setState] = useState({
    loading: true,
    refreshing: false,
    error: "",
    degraded: false,
    reasonCode: "",
    leads: [],
  });

  const load = useCallback(async ({ refreshing = false } = {}) => {
    setState((current) => ({
      ...current,
      loading: !refreshing,
      refreshing,
      error: "",
    }));

    try {
      const payload = await listLeads({
        q: query,
        limit: 150,
      });

      setState({
        loading: false,
        refreshing: false,
        error: "",
        degraded: payload?.degraded === true,
        reasonCode: s(payload?.reasonCode),
        leads: arr(payload?.leads),
      });
    } catch (error) {
      setState({
        loading: false,
        refreshing: false,
        error:
          s(error?.payload?.error || error?.payload?.message || error?.message) ||
          "Customers could not be loaded.",
        degraded: false,
        reasonCode: "",
        leads: [],
      });
    }
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const filteredLeads = useMemo(() => {
    const source = arr(state.leads);
    if (stageFilter === "all") return source;
    return source.filter((lead) => leadStage(lead) === stageFilter);
  }, [stageFilter, state.leads]);

  const summary = useMemo(() => {
    const leads = arr(state.leads);
    const open = leads.filter((lead) =>
      ["open", "new", "active"].includes(leadStatus(lead))
    ).length;
    const qualified = leads.filter((lead) =>
      ["qualified", "proposal", "negotiation"].includes(leadStage(lead))
    ).length;

    return {
      total: leads.length,
      open,
      qualified,
    };
  }, [state.leads]);

  function handleSubmit(event) {
    event?.preventDefault?.();
    load({ refreshing: true });
  }

  function openConversation(threadId = "") {
    const safeThreadId = s(threadId);
    if (!safeThreadId) return;
    navigate(`/inbox?threadId=${encodeURIComponent(safeThreadId)}`);
  }

  if (state.loading) {
    return (
      <PageCanvas className="max-w-[1180px] py-3">
        <LoadingSurface title="Loading customers" />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas className="max-w-[1180px] space-y-4 py-3">
      {state.error ? (
        <InlineNotice
          tone="danger"
          title="Customers unavailable"
          description={state.error}
          compact
        />
      ) : null}

      {state.degraded ? (
        <InlineNotice
          tone="warning"
          title="Customers unavailable in this environment"
          description="The customer surface is ready, but the backend lead table is not available here yet."
          compact
        />
      ) : null}

      <Card padded={false} clip className="shadow-[0_28px_80px_-64px_rgba(15,23,42,0.55)]">
        <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-brand">Customers</div>
            <h1 className="mt-1 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
              Customer records
            </h1>
            <p className="mt-2 max-w-[720px] text-[13.5px] font-medium leading-6 text-text-muted">
              Leads and customer profiles created from conversations.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 text-[12.5px] font-semibold text-text-muted">
            <span>{summary.total} total</span>
            <span>/</span>
            <span>{summary.open} open</span>
            <span>/</span>
            <span>{summary.qualified} qualified</span>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-3 border-t border-line-soft px-5 py-4 lg:grid-cols-[minmax(0,1fr)_auto_auto]"
        >
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" strokeWidth={2.1} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, email, phone, username..."
              className="h-10 w-full rounded-full border border-line bg-white pl-9 pr-3 text-[13.5px] font-medium text-text outline-none transition-colors duration-base ease-premium placeholder:text-text-subtle focus:border-brand"
            />
          </label>

          <StageTabs value={stageFilter} onChange={setStageFilter} />

          <Button
            type="submit"
            variant="secondary"
            size="sm"
            loading={state.refreshing}
            leftIcon={!state.refreshing ? <RefreshCw className="h-4 w-4" strokeWidth={2.1} /> : undefined}
          >
            Refresh
          </Button>
        </form>

        {filteredLeads.length ? (
          <div>
            <div className="hidden border-t border-line-soft px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(140px,0.35fr)_minmax(120px,0.25fr)_auto]">
              <span>Customer</span>
              <span>Stage</span>
              <span>Updated</span>
              <span className="text-right">Thread</span>
            </div>

            {filteredLeads.map((lead, index) => (
              <CustomerRow
                key={s(lead.id || lead.inbox_thread_id || lead.email || lead.username || index)}
                lead={lead}
                onOpen={openConversation}
              />
            ))}
          </div>
        ) : (
          <EmptyState hasQuery={Boolean(s(query) || stageFilter !== "all")} />
        )}
      </Card>
    </PageCanvas>
  );
}