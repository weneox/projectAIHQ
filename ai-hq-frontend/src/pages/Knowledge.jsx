import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  CircleAlert,
  DatabaseZap,
  FileSearch,
  Filter,
  GitBranch,
  Globe2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";

import {
  approveKnowledgeCandidate,
  listKnowledgeCandidates,
  rejectKnowledgeCandidate,
} from "../api/knowledge.js";
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

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function n(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function titleize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatWhen(value = "") {
  const raw = s(value);
  if (!raw) return "Not available";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleString();
}

function candidateId(item = {}) {
  return s(item.id || item.candidateId || item.candidate_id);
}

function candidateStatus(item = {}) {
  return lower(item.status || item.review_status || item.state || "pending");
}

function candidateCategory(item = {}) {
  return lower(item.category || item.kind || item.type || "business_fact");
}

function candidateTitle(item = {}) {
  return s(
    item.title ||
      item.label ||
      item.fieldLabel ||
      item.field_label ||
      item.key ||
      item.candidateKey ||
      "Knowledge candidate"
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

function toneForStatus(status = "") {
  const safe = lower(status);
  if (["approved", "accepted", "published"].includes(safe)) return "success";
  if (["rejected", "discarded", "blocked"].includes(safe)) return "danger";
  if (["conflicting", "quarantined", "review_required"].includes(safe)) return "warning";
  return "brand";
}

function toneTextClass(tone = "neutral") {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "brand" || tone === "info") return "text-brand";
  return "text-text-muted";
}

function toneDotClass(tone = "neutral") {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "brand" || tone === "info") return "bg-brand";
  return "bg-[rgb(var(--color-text-soft))]";
}

function StatusPill({ tone = "neutral", children }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-surface px-2.5 py-1 text-[12px] font-semibold">
      <span className={cx("h-1.5 w-1.5 rounded-full", toneDotClass(tone))} />
      <span className={toneTextClass(tone)}>{children}</span>
    </span>
  );
}

function StatCard({ label, value, caption, icon: Icon, tone = "neutral" }) {
  return (
    <Card padded="sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.13em] text-text-subtle">
            {label}
          </div>
          <div className="mt-1 text-[30px] font-semibold leading-none tracking-[var(--tracking-tight-xl)] text-text">
            {value}
          </div>
          {caption ? (
            <div className="mt-2 text-[12.5px] font-medium leading-5 text-text-muted">
              {caption}
            </div>
          ) : null}
        </div>

        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] border border-line-soft bg-surface-subtle">
          <Icon className={cx("h-5 w-5", toneTextClass(tone))} strokeWidth={2.1} />
        </span>
      </div>
    </Card>
  );
}

function FlowNode({ icon: Icon, title, description, tone = "neutral", active = false }) {
  return (
    <div
      className={cx(
        "rounded-[22px] border px-4 py-4 shadow-[0_18px_48px_-42px_rgba(15,23,42,0.55)]",
        active
          ? "border-[rgba(var(--color-brand),0.35)] bg-brand-soft"
          : "border-line-soft bg-surface"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-line-soft bg-white">
          <Icon className={cx("h-5 w-5", toneTextClass(tone))} strokeWidth={2.1} />
        </span>

        <div>
          <div className="text-[14px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
            {title}
          </div>
          <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
            {description}
          </div>
        </div>
      </div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="hidden items-center justify-center lg:flex">
      <ArrowRight className="h-5 w-5 text-text-subtle" strokeWidth={2.1} />
    </div>
  );
}

function KnowledgeFlow() {
  return (
    <Card padded={false} clip>
      <div className="border-b border-line-soft px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
              Flowchart
            </div>
            <div className="mt-1 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
              AI training governance flow
            </div>
          </div>

          <StatusPill tone="brand">Human-approved learning</StatusPill>
        </div>
      </div>

      <div className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_36px_minmax(0,1fr)_36px_minmax(0,1fr)_36px_minmax(0,1fr)]">
        <FlowNode
          icon={Globe2}
          title="Sources"
          description="Website, manual notes, imports, and customer conversations create candidate knowledge."
          tone="brand"
          active
        />
        <FlowArrow />
        <FlowNode
          icon={FileSearch}
          title="Review Queue"
          description="New facts wait for operator approval before they can affect replies."
          tone="warning"
          active
        />
        <FlowArrow />
        <FlowNode
          icon={ShieldCheck}
          title="Business Info"
          description="Approved facts become governed Business Info with provenance and history."
          tone="success"
        />
        <FlowArrow />
        <FlowNode
          icon={Bot}
          title="AI Runtime"
          description="AI replies only use approved runtime authority, never raw unreviewed text."
          tone="success"
        />
      </div>
    </Card>
  );
}

function CandidateCard({ item, busyId, onApprove, onReject }) {
  const id = candidateId(item);
  const status = candidateStatus(item);
  const category = candidateCategory(item);
  const tone = toneForStatus(status);
  const value = candidateValue(item);
  const busy = busyId === id;
  const canReview = ["pending", "review", "awaiting_review", "conflicting", "quarantined", ""].includes(status);

  return (
    <Card padded={false} clip>
      <div className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_220px_auto] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate text-[15.5px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              {candidateTitle(item)}
            </div>

            <Badge tone={tone} size="sm">
              {titleize(status || "pending")}
            </Badge>

            <Badge tone="neutral" size="sm">
              {titleize(category)}
            </Badge>
          </div>

          <div className="mt-2 line-clamp-2 text-[13.5px] font-medium leading-6 text-text-muted">
            {value || "No preview text returned for this candidate."}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-semibold text-text-subtle">
            <span>Source: {sourceLabel(item)}</span>
            <span>·</span>
            <span>{formatWhen(item.created_at || item.createdAt || item.updated_at || item.updatedAt)}</span>
          </div>
        </div>

        <div className="rounded-[16px] border border-line-soft bg-surface-subtle px-3 py-3">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-text-subtle">
            Governance
          </div>
          <div className="mt-1 text-[13px] font-semibold text-text">
            {canReview ? "Needs human review" : "Reviewed"}
          </div>
          <div className="mt-1 text-[12px] font-medium leading-5 text-text-muted">
            Candidate facts do not update AI runtime until approved.
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={!canReview || busy}
            loading={busy}
            onClick={() => onReject(id)}
            leftIcon={!busy ? <XCircle className="h-4 w-4" strokeWidth={2.1} /> : undefined}
          >
            Reject
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={!canReview || busy}
            loading={busy}
            onClick={() => onApprove(id)}
            leftIcon={!busy ? <CheckCircle2 className="h-4 w-4" strokeWidth={2.1} /> : undefined}
          >
            Approve
          </Button>
        </div>
      </div>
    </Card>
  );
}

function CategoryPanel({ items = [] }) {
  const total = items.length;
  const categories = [
    "business_fact",
    "service",
    "pricing",
    "faq",
    "policy",
    "contact",
  ].map((category) => ({
    category,
    value: items.filter((item) => candidateCategory(item) === category).length,
  }));

  return (
    <Card padded={false} clip>
      <div className="border-b border-line-soft px-4 py-3.5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
          Training map
        </div>
        <div className="mt-1 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
          Candidate categories
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {categories.map((row) => {
          const width = total > 0 ? Math.max(6, Math.round((row.value / total) * 100)) : 0;

          return (
            <div key={row.category}>
              <div className="flex items-center justify-between gap-3">
                <div className="text-[13px] font-semibold text-text">
                  {titleize(row.category)}
                </div>
                <div className="text-[12.5px] font-semibold text-text-muted">
                  {row.value}
                </div>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-subtle">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-base ease-premium"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}

        {!total ? (
          <InlineNotice
            tone="info"
            compact
            description="Categories will populate when imported or discovered knowledge candidates exist."
          />
        ) : null}
      </div>
    </Card>
  );
}

export default function Knowledge() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("all");
  const [state, setState] = useState({
    loading: true,
    refreshing: false,
    error: "",
    items: [],
    count: 0,
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
        status: statusFilter === "all" ? "" : statusFilter,
        limit: 150,
      });

      setState({
        loading: false,
        refreshing: false,
        error: "",
        items: arr(payload?.items),
        count: n(payload?.count, arr(payload?.items).length),
      });
    } catch (error) {
      setState({
        loading: false,
        refreshing: false,
        error:
          s(error?.payload?.reason || error?.payload?.error || error?.message) ||
          "Knowledge candidates could not be loaded.",
        items: [],
        count: 0,
      });
    }
  }, [statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const metrics = useMemo(() => {
    const items = arr(state.items);
    return {
      total: items.length,
      pending: items.filter((item) =>
        ["", "pending", "review", "awaiting_review"].includes(candidateStatus(item))
      ).length,
      approved: items.filter((item) =>
        ["approved", "accepted", "published"].includes(candidateStatus(item))
      ).length,
      risky: items.filter((item) =>
        ["conflicting", "quarantined", "blocked"].includes(candidateStatus(item))
      ).length,
    };
  }, [state.items]);

  const filteredItems = useMemo(() => {
    const items = arr(state.items);
    if (statusFilter === "all") return items;
    return items.filter((item) => candidateStatus(item) === statusFilter);
  }, [state.items, statusFilter]);

  async function handleRefresh() {
    await load({ refreshing: true });
  }

  async function handleApprove(id) {
    if (!id || busyId) return;

    try {
      setBusyId(id);
      setNotice(null);
      await approveKnowledgeCandidate(id);
      setNotice({
        tone: "success",
        title: "Candidate approved",
        description: "The candidate was moved into the governed review path.",
      });
      await load({ refreshing: true });
    } catch (error) {
      setNotice({
        tone: "danger",
        title: "Approve failed",
        description:
          s(error?.payload?.reason || error?.payload?.error || error?.message) ||
          "Candidate could not be approved.",
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
        reason: "Rejected from Knowledge review surface",
      });
      setNotice({
        tone: "success",
        title: "Candidate rejected",
        description: "The candidate was rejected and will not affect AI runtime.",
      });
      await load({ refreshing: true });
    } catch (error) {
      setNotice({
        tone: "danger",
        title: "Reject failed",
        description:
          s(error?.payload?.reason || error?.payload?.error || error?.message) ||
          "Candidate could not be rejected.",
      });
    } finally {
      setBusyId("");
    }
  }

  if (state.loading) {
    return (
      <PageCanvas className="max-w-[1280px] py-2">
        <LoadingSurface title="Loading Knowledge" />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas className="max-w-[1280px] space-y-4 py-2">
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

      <Card padded={false} clip>
        <section className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
              <BookOpenCheck className="h-4 w-4" strokeWidth={2.1} />
              Knowledge
            </div>

            <h1 className="mt-3 max-w-[860px] font-display text-[34px] font-semibold leading-[1.02] tracking-[var(--tracking-tight-xl)] text-text md:text-[44px]">
              AI Training with human approval
            </h1>

            <p className="mt-3 max-w-[780px] text-[14.5px] font-medium leading-6 text-text-muted">
              Review new facts, FAQs, services, pricing, and policies before they become approved Business Info for live AI replies.
            </p>
          </div>

          <div className="rounded-[22px] border border-line-soft bg-surface-subtle px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
              Review queue
            </div>
            <div className="mt-2 text-[34px] font-semibold leading-none tracking-[var(--tracking-tight-xl)] text-text">
              {metrics.pending}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="brand" size="sm">{metrics.total} total</Badge>
              <Badge tone={metrics.risky ? "warning" : "success"} size="sm">{metrics.risky} risky</Badge>
            </div>
          </div>
        </section>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Total" value={metrics.total} caption="All candidates" icon={DatabaseZap} tone="brand" />
        <StatCard label="Pending" value={metrics.pending} caption="Needs review" icon={FileSearch} tone="warning" />
        <StatCard label="Approved" value={metrics.approved} caption="Safe learning path" icon={CheckCircle2} tone="success" />
        <StatCard label="Risky" value={metrics.risky} caption="Conflict or quarantine" icon={CircleAlert} tone={metrics.risky ? "warning" : "success"} />
      </div>

      <KnowledgeFlow />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <Card padded={false} clip>
            <div className="grid gap-3 px-4 py-4 lg:grid-cols-[180px_minmax(0,1fr)_auto] lg:items-center">
              <label className="grid gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.13em] text-text-subtle">
                  Status
                </span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-10 rounded-[14px] border border-line bg-white px-3 text-[13.5px] font-semibold text-text outline-none transition-colors duration-base ease-premium focus:border-brand"
                >
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="conflicting">Conflicting</option>
                  <option value="quarantined">Quarantined</option>
                </select>
              </label>

              <div className="flex items-center gap-2 text-[13px] font-medium text-text-muted">
                <Filter className="h-4 w-4" strokeWidth={2.1} />
                Showing {filteredItems.length} candidate(s)
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={state.refreshing}
                onClick={handleRefresh}
                leftIcon={!state.refreshing ? <RefreshCw className="h-4 w-4" strokeWidth={2.1} /> : undefined}
              >
                Refresh
              </Button>
            </div>
          </Card>

          {filteredItems.length ? (
            <div className="grid gap-3">
              {filteredItems.map((item, index) => (
                <CandidateCard
                  key={candidateId(item) || `${candidateTitle(item)}-${index}`}
                  item={item}
                  busyId={busyId}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              ))}
            </div>
          ) : (
            <Card padded="lg" className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[18px] border border-line-soft bg-surface-subtle">
                <Sparkles className="h-6 w-6 text-text-muted" strokeWidth={2.1} />
              </div>

              <h2 className="mt-4 text-[22px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                No candidates yet
              </h2>

              <p className="mx-auto mt-2 max-w-[560px] text-[14px] font-medium leading-6 text-text-muted">
                Import website data, complete setup, or capture customer conversations to generate AI training candidates.
              </p>

              <div className="mt-5 flex justify-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate("/home?assistant=setup")}
                  rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
                >
                  Open setup
                </Button>

                <Button
                  type="button"
                  onClick={() => navigate("/truth")}
                  rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
                >
                  Business Info
                </Button>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <CategoryPanel items={state.items} />

          <Card padded="md">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-line-soft bg-brand-soft">
                <GitBranch className="h-5 w-5 text-brand" strokeWidth={2.1} />
              </span>

              <div>
                <div className="text-[15px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                  Difference from Business Info
                </div>
                <div className="mt-1 text-[13.5px] font-medium leading-6 text-text-muted">
                  Knowledge is the review queue. Business Info is the approved source of truth.
                  AI runtime should only use approved Business Info, not raw candidates.
                </div>
              </div>
            </div>
          </Card>

          <Card padded="md">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-line-soft bg-surface-subtle">
                <ShieldCheck className="h-5 w-5 text-success" strokeWidth={2.1} />
              </span>

              <div>
                <div className="text-[15px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                  Safety rule
                </div>
                <div className="mt-1 text-[13.5px] font-medium leading-6 text-text-muted">
                  Never let imported website text, customer messages, or AI guesses update live replies without approval.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </PageCanvas>
  );
}
