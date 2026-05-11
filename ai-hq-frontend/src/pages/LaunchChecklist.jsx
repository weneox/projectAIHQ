import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  DatabaseZap,
  Globe2,
  Inbox,
  MessageSquare,
  RefreshCw,
  Rocket,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { getLaunchPosture } from "../api/launch.js";
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

const CHANNEL_ORDER = ["website", "instagram", "telegram"];

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

function normalizeStatus(value = "") {
  const safe = lower(value);

  if (["ready", "active", "connected", "ok", "complete"].includes(safe)) {
    return "ready";
  }

  if (["attention", "review", "degraded", "testing_only", "queued", "pending"].includes(safe)) {
    return "review";
  }

  if (["blocked", "unavailable", "failed", "error", "needs_connection", "connected_blocked"].includes(safe)) {
    return "blocked";
  }

  return safe || "unknown";
}

function statusTone(status = "") {
  const safe = normalizeStatus(status);

  if (safe === "ready") return "success";
  if (safe === "review") return "warning";
  if (safe === "blocked") return "danger";

  return "neutral";
}

function statusLabel(status = "") {
  const safe = normalizeStatus(status);

  if (safe === "review") return "Needs review";
  return titleize(safe);
}

function stageStatus(stage = {}) {
  const checks = arr(stage.checks);

  if (checks.some((check) => normalizeStatus(check.status) === "blocked")) {
    return "blocked";
  }

  if (checks.some((check) => normalizeStatus(check.status) === "review")) {
    return "review";
  }

  if (checks.length && checks.every((check) => normalizeStatus(check.status) === "ready")) {
    return "ready";
  }

  return normalizeStatus(stage.status || "unknown");
}

function stageSummary(stage = {}) {
  const checks = arr(stage.checks);
  const ready = checks.filter((check) => normalizeStatus(check.status) === "ready").length;

  return checks.length ? `${ready}/${checks.length} ready` : statusLabel(stageStatus(stage));
}

function pickBlockers(payload = {}, surface = "") {
  return arr(payload.blockers).filter((blocker) => {
    if (!surface) return true;
    return lower(blocker.surface) === lower(surface);
  });
}

function buildCheck({ title, description, status, icon, reasonCode = "", message = "" }) {
  return {
    title,
    description,
    status: normalizeStatus(status),
    icon,
    reasonCode,
    message,
  };
}

function channelLabel(id = "") {
  if (id === "website") return "Website chat";
  if (id === "instagram") return "Instagram DM";
  if (id === "telegram") return "Telegram bot";
  return titleize(id);
}

function buildStages(payload = {}) {
  const overall = obj(payload.overall);
  const truth = obj(payload.truth);
  const runtime = obj(payload.runtime);
  const inbox = obj(payload.inbox);
  const channels = obj(payload.channels);
  const channelSummary = obj(payload.channelSummary);
  const blockers = arr(payload.blockers);

  const channelChecks = CHANNEL_ORDER.map((id) => {
    const channel = obj(channels[id]);
    const status = channel.deliveryReady
      ? "ready"
      : channel.connected
        ? "review"
        : "blocked";

    return buildCheck({
      title: channel.label || channelLabel(id),
      description:
        channel.readiness?.message ||
        channel.message ||
        channel.reasonCode ||
        "Channel posture was returned by backend.",
      status,
      icon: MessageSquare,
      reasonCode: channel.reasonCode,
      message: channel.readiness?.message || channel.message,
    });
  });

  const inboxAvailable = inbox.available === true;
  const inboxPressure =
    n(inbox.unreadCount) +
    n(inbox.openCount) +
    n(inbox.handoffCount) +
    n(inbox.pendingOutboundCount) +
    n(inbox.failedOutboundCount) +
    n(inbox.retryingOutboundCount);

  return [
    {
      id: "truth",
      number: "1",
      title: "Business Info",
      subtitle: truth.ready
        ? "Approved business info is available."
        : "Business info approval is required.",
      description:
        truth.message ||
        "Launch depends on approved business facts, profile, and customer-facing truth.",
      icon: ShieldCheck,
      status: truth.status,
      action: { label: "Open Business Info", path: "/truth" },
      blockers: pickBlockers(payload, "truth"),
      checks: [
        buildCheck({
          title: "Approved truth",
          description: truth.message || "Approved business information must exist.",
          status: truth.ready ? "ready" : truth.status || "blocked",
          icon: ShieldCheck,
          reasonCode: truth.reasonCode,
          message: truth.message,
        }),
        buildCheck({
          title: "Latest version",
          description: truth.latestVersionId
            ? `Version ${truth.latestVersionId}`
            : "No approved version id is exposed.",
          status: truth.latestVersionId ? "ready" : "review",
          icon: CheckCircle2,
        }),
      ],
    },
    {
      id: "runtime",
      number: "2",
      title: "Runtime authority",
      subtitle: runtime.ready
        ? "Runtime authority is ready."
        : "Runtime authority is not ready.",
      description:
        runtime.message ||
        "Approved runtime authority must be available before live automation can be trusted.",
      icon: DatabaseZap,
      status: runtime.status,
      action: { label: "Open setup review", path: "/home?assistant=setup" },
      blockers: pickBlockers(payload, "runtime"),
      checks: [
        buildCheck({
          title: "Runtime authority",
          description: runtime.message || "Runtime authority status is provided by backend.",
          status: runtime.ready ? "ready" : runtime.status || "blocked",
          icon: DatabaseZap,
          reasonCode: runtime.reasonCode,
          message: runtime.message,
        }),
      ],
    },
    {
      id: "channels",
      number: "3",
      title: "Launch channels",
      subtitle:
        channelSummary.readyCount > 0
          ? `${channelSummary.readyCount} delivery-ready channel(s).`
          : "No launch channel is delivery-ready.",
      description:
        "Website chat, Instagram DM, or Telegram private bot chat must be delivery-ready before launch.",
      icon: Globe2,
      status: channelSummary.readyCount > 0 ? "ready" : "blocked",
      action: { label: "Open Channels", path: "/channels" },
      blockers: blockers.filter((blocker) =>
        ["channels", "website", "instagram", "telegram"].includes(lower(blocker.surface))
      ),
      checks: channelChecks,
    },
    {
      id: "inbox",
      number: "4",
      title: "Inbox pressure",
      subtitle: inboxAvailable
        ? inboxPressure > 0
          ? "Inbox is available and needs attention."
          : "Inbox is available."
        : "Inbox posture is unavailable.",
      description:
        "Launch should know whether unread, open, handoff, or failed outbound work is waiting.",
      icon: Inbox,
      status: inboxAvailable ? (inboxPressure > 0 ? "review" : "ready") : "blocked",
      action: { label: "Open Inbox", path: "/inbox" },
      blockers: pickBlockers(payload, "inbox"),
      checks: [
        buildCheck({
          title: "Inbox available",
          description: inboxAvailable
            ? "Inbox pressure summary is available."
            : "Inbox pressure summary could not be loaded.",
          status: inboxAvailable ? "ready" : "blocked",
          icon: Inbox,
        }),
        buildCheck({
          title: "Unread messages",
          description: `${n(inbox.unreadCount)} unread · ${n(inbox.openCount)} open · ${n(inbox.handoffCount)} handoff`,
          status: n(inbox.unreadCount) > 0 ? "review" : "ready",
          icon: MessageSquare,
        }),
        buildCheck({
          title: "Outbound health",
          description: `${n(inbox.pendingOutboundCount)} pending · ${n(inbox.failedOutboundCount)} failed · ${n(inbox.retryingOutboundCount)} retrying`,
          status: n(inbox.failedOutboundCount) > 0 ? "blocked" : "ready",
          icon: CircleAlert,
        }),
      ],
    },
    {
      id: "overall",
      number: "5",
      title: "Go-live decision",
      subtitle: overall.title || "Launch posture decision.",
      description:
        overall.message ||
        "The final decision is calculated from business info, runtime authority, channels, and inbox posture.",
      icon: Rocket,
      status: overall.status,
      action: overall.primaryAction || { label: "Open Inbox", path: "/inbox" },
      blockers,
      checks: [
        buildCheck({
          title: "Launch ready",
          description: overall.message || "Backend calculated the final launch posture.",
          status: overall.launchReady ? "ready" : overall.status || "blocked",
          icon: Rocket,
        }),
        buildCheck({
          title: "Repair actions",
          description: arr(payload.repairActions).length
            ? `${arr(payload.repairActions).length} repair action(s) available.`
            : "No repair actions are required.",
          status: arr(payload.repairActions).length ? "review" : "ready",
          icon: Sparkles,
        }),
      ],
    },
  ];
}

function StageDots({ checks = [] }) {
  return (
    <div className="flex items-center gap-1.5">
      {checks.map((check) => (
        <span
          key={check.title}
          className={cx(
            "h-2.5 w-2.5 rounded-full border",
            normalizeStatus(check.status) === "ready"
              ? "border-success bg-success"
              : normalizeStatus(check.status) === "blocked"
                ? "border-danger bg-danger"
                : "border-warning bg-warning"
          )}
        />
      ))}
    </div>
  );
}

function StageNode({ stage, active = false, onOpen }) {
  const Icon = stage.icon || Rocket;
  const status = stageStatus(stage);

  return (
    <button
      type="button"
      onClick={() => onOpen(stage)}
      className={cx(
        "group grid w-full grid-cols-[72px_minmax(0,1fr)_150px] items-center gap-4 rounded-md border bg-white px-4 py-4 text-left transition-[background-color,border-color,box-shadow,transform] duration-base ease-premium",
        active
          ? "border-brand shadow-[inset_3px_0_0_rgb(var(--color-brand)),0_18px_34px_-30px_rgba(37,99,235,0.62)]"
          : "border-line-soft hover:border-line hover:bg-surface-subtle hover:shadow-[0_14px_30px_-28px_rgba(15,23,42,0.42)]"
      )}
    >
      <div className="flex items-center gap-4">
        <div
          className={cx(
            "flex h-14 w-14 items-center justify-center rounded-md border bg-white text-[24px] font-semibold tracking-[var(--tracking-tight-lg)]",
            status === "ready"
              ? "border-success/30 text-success"
              : status === "blocked"
                ? "border-danger/30 text-danger"
                : "border-warning/35 text-warning"
          )}
        >
          {stage.number}
        </div>
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-3">
          <Icon className="h-6 w-6 shrink-0 text-text" strokeWidth={1.9} />

          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="truncate text-[18px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                {stage.title}
              </div>

              <AppTag tone={statusTone(status)} dot>
                {statusLabel(status)}
              </AppTag>
            </div>

            <div className="mt-1 truncate text-[13px] font-medium text-text-muted">
              {stage.subtitle}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        <StageDots checks={stage.checks} />
        <div className="text-[12px] font-semibold text-text-muted">
          {stageSummary(stage)}
        </div>
      </div>
    </button>
  );
}

function Connector({ ready = false }) {
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-4">
      <div className="flex justify-center py-2">
        <div className="flex flex-col items-center gap-2">
          {Array.from({ length: 5 }, (_, index) => (
            <span
              key={`connector-${index}`}
              className={cx("h-1.5 w-1.5 rounded-full", ready ? "bg-success" : "bg-line")}
            />
          ))}
        </div>
      </div>
      <div />
    </div>
  );
}

function CheckRow({ check }) {
  const Icon = check.icon || CheckCircle2;
  const status = normalizeStatus(check.status);

  return (
    <div className="grid gap-3 rounded-md border border-line-soft bg-white p-4 md:grid-cols-[42px_minmax(0,1fr)_124px] md:items-center">
      <div
        className={cx(
          "flex h-10 w-10 items-center justify-center rounded-md border",
          status === "ready"
            ? "border-success/20 bg-success/5 text-success"
            : status === "blocked"
              ? "border-danger/20 bg-danger/5 text-danger"
              : "border-warning/25 bg-warning/5 text-warning"
        )}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.05} />
      </div>

      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-semibold text-text">
          {check.title}
        </div>
        <div className="mt-0.5 text-[12.5px] font-medium leading-5 text-text-muted">
          {check.description}
        </div>
        {check.reasonCode ? (
          <div className="mt-1 text-[11.5px] font-semibold text-text-subtle">
            {check.reasonCode}
          </div>
        ) : null}
      </div>

      <div className="md:text-right">
        <AppTag tone={statusTone(check.status)} dot>
          {statusLabel(check.status)}
        </AppTag>
      </div>
    </div>
  );
}

function BlockerRow({ blocker, onAction }) {
  const action = obj(blocker.nextAction);

  return (
    <div className="rounded-md border border-danger/20 bg-danger-soft px-4 py-3">
      <div className="text-[13px] font-semibold text-text">
        {blocker.title || titleize(blocker.reasonCode)}
      </div>
      <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
        {blocker.message || blocker.reasonCode}
      </div>

      {action.path ? (
        <button
          type="button"
          onClick={() => onAction(action.path)}
          className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand"
        >
          {action.label || "Open repair action"}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.1} />
        </button>
      ) : null}
    </div>
  );
}

function StageDialog({ stage, onClose }) {
  const navigate = useNavigate();

  if (!stage) return null;

  const Icon = stage.icon || Rocket;
  const status = stageStatus(stage);

  function go(path = "") {
    if (!path) return;
    navigate(path);
    onClose();
  }

  return (
    <AppModal open={Boolean(stage)} onClose={onClose} maxWidth="max-w-[760px]">
      <AppModalHeader>
        <div className="flex min-w-0 items-start gap-5">
          <div
            className={cx(
              "flex h-16 w-16 shrink-0 items-center justify-center rounded-md border bg-white text-[26px] font-semibold",
              status === "ready"
                ? "border-success/30 text-success"
                : status === "blocked"
                  ? "border-danger/30 text-danger"
                  : "border-warning/35 text-warning"
            )}
          >
            {stage.number}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Icon className="h-6 w-6 text-text" strokeWidth={1.9} />
              <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand">
                Live launch posture
              </div>
            </div>

            <h2 className="mt-2 text-[24px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
              {stage.title}
            </h2>

            <p className="mt-2 max-w-[580px] text-[13.5px] font-medium leading-6 text-text-muted">
              {stage.description}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <AppTag tone={statusTone(status)} dot>
                {statusLabel(status)}
              </AppTag>
              <AppTag tone="neutral">{stageSummary(stage)}</AppTag>
            </div>
          </div>
        </div>

        <AppModalCloseButton onClick={onClose} label="Close launch stage" />
      </AppModalHeader>

      <AppModalBody className="grid gap-3 bg-surface-subtle p-5">
        {stage.checks.map((check) => (
          <CheckRow key={check.title} check={check} />
        ))}

        {arr(stage.blockers).length ? (
          <div className="mt-2 grid gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Backend blockers
            </div>
            {arr(stage.blockers).map((blocker, index) => (
              <BlockerRow
                key={blocker.id || blocker.reasonCode || index}
                blocker={blocker}
                onAction={go}
              />
            ))}
          </div>
        ) : null}
      </AppModalBody>

      <AppModalFooter className="bg-white">
        <Button type="button" variant="secondary" size="md" onClick={onClose}>
          Close
        </Button>

        <Button
          type="button"
          size="md"
          variant={status === "blocked" ? "primary" : "secondary"}
          onClick={() => go(stage.action?.path)}
          rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
        >
          {stage.action?.label || "Open"}
        </Button>
      </AppModalFooter>
    </AppModal>
  );
}

function SummaryCard({ payload, stages }) {
  const overall = obj(payload.overall);
  const ready = stages.filter((stage) => stageStatus(stage) === "ready").length;
  const review = stages.filter((stage) => stageStatus(stage) === "review").length;
  const blocked = stages.filter((stage) => stageStatus(stage) === "blocked").length;

  return (
    <Card padded={false} clip>
      <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
        <div>
          <div className="text-[17px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
            {overall.title || "Launch posture"}
          </div>
          <div className="mt-1 text-[13.5px] font-medium leading-6 text-text-muted">
            {overall.message || "Live readiness calculated by backend launch posture."}
          </div>
          <div className="mt-2 text-[12px] font-semibold text-text-subtle">
            Generated: {formatWhen(payload.generatedAt)}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <AppTag tone={statusTone(overall.status)} dot>
            {statusLabel(overall.status)}
          </AppTag>
          <AppTag tone="success" dot>
            {ready} ready
          </AppTag>
          <AppTag tone="warning" dot>
            {review} review
          </AppTag>
          <AppTag tone="danger" dot>
            {blocked} blocked
          </AppTag>
        </div>
      </div>
    </Card>
  );
}

export default function LaunchChecklist() {
  const [payload, setPayload] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const next = await getLaunchPosture();
      setPayload(next || null);
    } catch (err) {
      setPayload(null);
      setError(
        s(err?.payload?.error || err?.payload?.reason || err?.payload?.message || err?.message) ||
          "Launch posture could not be loaded."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stages = useMemo(() => buildStages(payload || {}), [payload]);

  if (loading) {
    return (
      <PageCanvas>
        <LoadingSurface
          title="Loading launch posture"
          description="Reading live launch readiness from backend."
          rows={5}
        />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas>
      <PageHeader
        title="Launch command"
        description="Backend-backed launch readiness for Business Info, runtime authority, channels, and inbox posture."
        actions={
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
        }
      />

      {error ? (
        <InlineNotice tone="danger" title="Launch posture unavailable" description={error} />
      ) : null}

      {payload ? (
        <>
          <SummaryCard payload={payload} stages={stages} />

          <div className="grid w-full gap-0">
            {stages.map((stage, index) => {
              const status = stageStatus(stage);
              const isLast = index === stages.length - 1;

              return (
                <div key={stage.id}>
                  <StageNode
                    stage={stage}
                    active={selectedStage?.id === stage.id}
                    onOpen={setSelectedStage}
                  />

                  {!isLast ? <Connector ready={status === "ready"} /> : null}
                </div>
              );
            })}
          </div>

          <StageDialog stage={selectedStage} onClose={() => setSelectedStage(null)} />
        </>
      ) : !error ? (
        <InlineNotice
          tone="warning"
          title="No launch payload"
          description="The launch posture request completed but did not return a usable payload."
        />
      ) : null}
    </PageCanvas>
  );
}
