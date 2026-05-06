import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Inbox,
  RefreshCw,
  Search,
  UserRound,
  Users,
} from "lucide-react";

import { listLeads } from "../api/leads.js";
import Badge from "../components/ui/Badge.jsx";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
} from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function formatWhen(value = "") {
  const raw = s(value);
  if (!raw) return "Not available";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleString();
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
  return [
    s(lead.email),
    s(lead.phone),
    s(lead.username),
  ].filter(Boolean).join(" · ");
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

function statusTone(status = "") {
  const safe = lower(status);
  if (["open", "new", "active"].includes(safe)) return "success";
  if (["closed", "archived"].includes(safe)) return "neutral";
  if (["blocked", "lost"].includes(safe)) return "danger";
  return "warning";
}

function titleize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function StatCard({ label, value, icon: Icon, tone = "neutral" }) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "danger"
          ? "text-danger"
          : tone === "brand"
            ? "text-brand"
            : "text-text-muted";

  return (
    <Card padded="sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-text-subtle">
            {label}
          </div>
          <div className="mt-1 text-[26px] font-semibold leading-none tracking-[var(--tracking-tight-xl)] text-text">
            {value}
          </div>
        </div>

        <span className="inline-flex h-10 w-10 items-center justify-center rounded-[16px] border border-line-soft bg-surface">
          <Icon className={cx("h-5 w-5", toneClass)} strokeWidth={2.1} />
        </span>
      </div>
    </Card>
  );
}

function CustomerRow({ lead, onOpenInbox }) {
  const name = pickName(lead);
  const contact = pickContact(lead);
  const stage = leadStage(lead);
  const status = leadStatus(lead);
  const threadId = s(lead.inbox_thread_id || lead.inboxThreadId);

  return (
    <Card padded={false} clip>
      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_180px_170px_auto] lg:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] border border-line-soft bg-surface-subtle">
            <UserRound className="h-5 w-5 text-text-muted" strokeWidth={2.1} />
          </span>

          <div className="min-w-0">
            <div className="truncate text-[15.5px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              {name}
            </div>
            <div className="mt-1 truncate text-[13px] font-medium text-text-muted">
              {contact || "No contact details yet"}
            </div>
            {s(lead.interest) ? (
              <div className="mt-2 line-clamp-1 text-[12.5px] font-medium text-text-subtle">
                Interest: {s(lead.interest)}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge tone={toneForStage(stage)} size="sm">
            {titleize(stage || "new")}
          </Badge>
          <Badge tone={statusTone(status)} size="sm">
            {titleize(status || "open")}
          </Badge>
        </div>

        <div className="text-[12.5px] font-medium leading-5 text-text-muted">
          <div className="font-semibold text-text">Last activity</div>
          {formatWhen(lead.updated_at || lead.created_at)}
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!threadId}
          onClick={() => onOpenInbox(threadId)}
          rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
        >
          Inbox
        </Button>
      </div>
    </Card>
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

  const stats = useMemo(() => {
    const leads = arr(state.leads);
    return {
      total: leads.length,
      open: leads.filter((lead) => ["open", "new", "active"].includes(leadStatus(lead))).length,
      qualified: leads.filter((lead) => ["qualified", "proposal", "negotiation"].includes(leadStage(lead))).length,
      won: leads.filter((lead) => ["won", "converted", "customer"].includes(leadStage(lead))).length,
    };
  }, [state.leads]);

  function handleSubmit(event) {
    event?.preventDefault?.();
    load({ refreshing: true });
  }

  function openInbox(threadId = "") {
    const safeThreadId = s(threadId);
    if (!safeThreadId) return;
    navigate(`/inbox?threadId=${encodeURIComponent(safeThreadId)}`);
  }

  if (state.loading) {
    return (
      <PageCanvas className="max-w-[1240px] py-2">
        <LoadingSurface title="Loading customers" />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas className="max-w-[1240px] space-y-4 py-2">
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
          title="Customers schema unavailable"
          description="The Customers surface is ready, but the backend lead table is not available in this environment yet."
          compact
        />
      ) : null}

      <Card padded={false} clip>
        <section className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
              <Users className="h-4 w-4" strokeWidth={2.1} />
              Customers
            </div>

            <h1 className="mt-3 max-w-[820px] font-display text-[34px] font-semibold leading-[1.02] tracking-[var(--tracking-tight-xl)] text-text md:text-[44px]">
              Customer profiles from every channel
            </h1>

            <p className="mt-3 max-w-[760px] text-[14.5px] font-medium leading-6 text-text-muted">
              Turn Website Chat, Instagram, and Telegram conversations into customer records,
              lead stages, ownership, and follow-up context.
            </p>
          </div>

          <div className="rounded-[22px] border border-line-soft bg-surface-subtle px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
              Customer records
            </div>
            <div className="mt-2 text-[34px] font-semibold leading-none tracking-[var(--tracking-tight-xl)] text-text">
              {stats.total}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="success" size="sm">{stats.open} open</Badge>
              <Badge tone="brand" size="sm">{stats.qualified} qualified</Badge>
            </div>
          </div>
        </section>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Total" value={stats.total} icon={Users} tone="brand" />
        <StatCard label="Open" value={stats.open} icon={Inbox} tone="success" />
        <StatCard label="Qualified" value={stats.qualified} icon={Building2} tone="brand" />
        <StatCard label="Won" value={stats.won} icon={UserRound} tone="success" />
      </div>

      <Card padded={false} clip>
        <form onSubmit={handleSubmit} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" strokeWidth={2.1} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search customers, email, phone, username..."
              className="h-10 w-full rounded-[14px] border border-line bg-white pl-9 pr-3 text-[13.5px] font-medium text-text outline-none transition-colors duration-base ease-premium placeholder:text-text-subtle focus:border-brand"
            />
          </label>

          <select
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value)}
            className="h-10 rounded-[14px] border border-line bg-white px-3 text-[13.5px] font-semibold text-text outline-none transition-colors duration-base ease-premium focus:border-brand"
          >
            <option value="all">All stages</option>
            <option value="new">New</option>
            <option value="qualified">Qualified</option>
            <option value="proposal">Proposal</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>

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
      </Card>

      {filteredLeads.length ? (
        <div className="grid gap-3">
          {filteredLeads.map((lead) => (
            <CustomerRow
              key={s(lead.id || lead.inbox_thread_id || lead.email || lead.username)}
              lead={lead}
              onOpenInbox={openInbox}
            />
          ))}
        </div>
      ) : (
        <Card padded="lg" className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[18px] border border-line-soft bg-surface-subtle">
            <Users className="h-6 w-6 text-text-muted" strokeWidth={2.1} />
          </div>

          <h2 className="mt-4 text-[22px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
            No customers yet
          </h2>

          <p className="mx-auto mt-2 max-w-[520px] text-[14px] font-medium leading-6 text-text-muted">
            Customer records will appear here as conversations and leads are created from Inbox channels.
          </p>

          <div className="mt-5 flex justify-center">
            <Button
              type="button"
              onClick={() => navigate("/inbox")}
              rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
            >
              Open Inbox
            </Button>
          </div>
        </Card>
      )}
    </PageCanvas>
  );
}
