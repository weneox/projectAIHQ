import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  Crown,
  Headphones,
  Mail,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";

import {
  createTeamUser,
  getTeam,
  updateTeamUserStatus,
} from "../api/team.js";
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

function userId(user = {}) {
  return s(user.id || user.user_id);
}

function userEmail(user = {}) {
  return s(user.user_email || user.email);
}

function userName(user = {}) {
  return s(user.full_name || user.fullName || user.name || user.display_name || userEmail(user) || "Team member");
}

function userRole(user = {}) {
  return lower(user.role || "operator");
}

function userStatus(user = {}) {
  return lower(user.status || "active");
}

function toneForRole(role = "") {
  const safe = lower(role);
  if (safe === "owner") return "brand";
  if (safe === "admin") return "success";
  return "neutral";
}

function toneForStatus(status = "") {
  const safe = lower(status);
  if (["active", "enabled"].includes(safe)) return "success";
  if (["invited", "pending"].includes(safe)) return "warning";
  if (["disabled", "blocked", "inactive"].includes(safe)) return "danger";
  return "neutral";
}

function roleIcon(role = "") {
  const safe = lower(role);
  if (safe === "owner") return Crown;
  if (safe === "admin") return ShieldCheck;
  return Headphones;
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

function StatusPill({ tone = "neutral", children }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-line-soft bg-surface px-2.5 py-1 text-[12px] font-semibold">
      <span className={cx("h-1.5 w-1.5 rounded-full", toneDotClass(tone))} />
      <span className={toneTextClass(tone)}>{children}</span>
    </span>
  );
}

function PermissionNode({ icon: Icon, title, description, tone = "neutral" }) {
  return (
    <div className="rounded-[20px] border border-line-soft bg-surface px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-line-soft bg-surface-subtle">
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

function OperatorFlow() {
  return (
    <Card padded={false} clip>
      <div className="border-b border-line-soft px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
              Operator model
            </div>
            <div className="mt-1 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
              Human control before automation
            </div>
          </div>

          <StatusPill tone="brand">Manual-first SaaS</StatusPill>
        </div>
      </div>

      <div className="grid gap-3 px-4 py-4 lg:grid-cols-4">
        <PermissionNode
          icon={Crown}
          title="Owner"
          description="Controls workspace, security, channels, and team."
          tone="brand"
        />
        <PermissionNode
          icon={ShieldCheck}
          title="Admin"
          description="Manages setup, Business Info, and operators."
          tone="success"
        />
        <PermissionNode
          icon={Headphones}
          title="Operator"
          description="Handles Inbox conversations and customer handoff."
          tone="neutral"
        />
        <PermissionNode
          icon={Bot}
          title="AI"
          description="Replies only inside approved guardrails."
          tone="warning"
        />
      </div>
    </Card>
  );
}

function TeamRow({ user, busyId, onToggleStatus }) {
  const id = userId(user);
  const role = userRole(user);
  const status = userStatus(user);
  const RoleIcon = roleIcon(role);
  const active = ["active", "enabled"].includes(status);
  const busy = busyId === id;

  return (
    <Card padded={false} clip>
      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_180px_170px_auto] lg:items-center">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] border border-line-soft bg-surface-subtle">
            <RoleIcon className={cx("h-5 w-5", toneTextClass(toneForRole(role)))} strokeWidth={2.1} />
          </span>

          <div className="min-w-0">
            <div className="truncate text-[15.5px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              {userName(user)}
            </div>
            <div className="mt-1 flex min-w-0 items-center gap-2 truncate text-[13px] font-medium text-text-muted">
              <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={2.1} />
              <span className="truncate">{userEmail(user) || "No email"}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge tone={toneForRole(role)} size="sm">
            {titleize(role)}
          </Badge>
          <Badge tone={toneForStatus(status)} size="sm">
            {titleize(status)}
          </Badge>
        </div>

        <div className="text-[12.5px] font-medium leading-5 text-text-muted">
          <div className="font-semibold text-text">Updated</div>
          {formatWhen(user.updated_at || user.created_at)}
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={busy}
          disabled={!id || role === "owner"}
          onClick={() => onToggleStatus(user)}
        >
          {active ? "Disable" : "Activate"}
        </Button>
      </div>
    </Card>
  );
}

export default function Team() {
  const [state, setState] = useState({
    loading: true,
    refreshing: false,
    error: "",
    users: [],
    viewerRole: "",
  });
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [invite, setInvite] = useState({
    email: "",
    fullName: "",
    role: "operator",
  });

  async function load({ refreshing = false } = {}) {
    setState((current) => ({
      ...current,
      loading: !refreshing,
      refreshing,
      error: "",
    }));

    try {
      const payload = await getTeam();

      setState({
        loading: false,
        refreshing: false,
        error: "",
        users: arr(payload?.users),
        viewerRole: lower(payload?.viewerRole || ""),
      });
    } catch (error) {
      setState({
        loading: false,
        refreshing: false,
        error:
          s(error?.payload?.error || error?.payload?.message || error?.message) ||
          "Team could not be loaded.",
        users: [],
        viewerRole: "",
      });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const metrics = useMemo(() => {
    const users = arr(state.users);
    return {
      total: users.length,
      active: users.filter((user) => ["active", "enabled"].includes(userStatus(user))).length,
      owners: users.filter((user) => userRole(user) === "owner").length,
      operators: users.filter((user) => userRole(user) === "operator").length,
    };
  }, [state.users]);

  const canManage = ["owner", "admin"].includes(lower(state.viewerRole));

  async function handleInvite(event) {
    event?.preventDefault?.();

    const email = s(invite.email).toLowerCase();
    if (!email) {
      setNotice({
        tone: "danger",
        title: "Email required",
        description: "Enter an operator email before adding a team member.",
      });
      return;
    }

    try {
      setBusyId("invite");
      setNotice(null);

      await createTeamUser({
        user_email: email,
        full_name: s(invite.fullName),
        role: s(invite.role, "operator"),
        status: "active",
      });

      setNotice({
        tone: "success",
        title: "Team member added",
        description: "The operator profile was created for this workspace.",
      });

      setInvite({
        email: "",
        fullName: "",
        role: "operator",
      });

      await load({ refreshing: true });
    } catch (error) {
      setNotice({
        tone: "danger",
        title: "Could not add team member",
        description:
          s(error?.payload?.error || error?.payload?.message || error?.message) ||
          "Check permissions and try again.",
      });
    } finally {
      setBusyId("");
    }
  }

  async function handleToggleStatus(user) {
    const id = userId(user);
    if (!id || busyId) return;

    const nextStatus = ["active", "enabled"].includes(userStatus(user))
      ? "disabled"
      : "active";

    try {
      setBusyId(id);
      setNotice(null);

      await updateTeamUserStatus(id, nextStatus);

      setNotice({
        tone: "success",
        title: "Team member updated",
        description: `Status changed to ${nextStatus}.`,
      });

      await load({ refreshing: true });
    } catch (error) {
      setNotice({
        tone: "danger",
        title: "Could not update team member",
        description:
          s(error?.payload?.error || error?.payload?.message || error?.message) ||
          "Check permissions and try again.",
      });
    } finally {
      setBusyId("");
    }
  }

  if (state.loading) {
    return (
      <PageCanvas className="max-w-[1240px] py-2">
        <LoadingSurface title="Loading team" />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas className="max-w-[1240px] space-y-4 py-2">
      {state.error ? (
        <InlineNotice
          tone="danger"
          title="Team unavailable"
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
              <UsersRound className="h-4 w-4" strokeWidth={2.1} />
              Team
            </div>

            <h1 className="mt-3 max-w-[840px] font-display text-[34px] font-semibold leading-[1.02] tracking-[var(--tracking-tight-xl)] text-text md:text-[44px]">
              Operators, owners, and AI handoff control
            </h1>

            <p className="mt-3 max-w-[780px] text-[14.5px] font-medium leading-6 text-text-muted">
              Manage who can operate the Inbox, review Business Info, and control sensitive omnichannel workspace settings.
            </p>
          </div>

          <div className="rounded-[22px] border border-line-soft bg-surface-subtle px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
              Viewer role
            </div>
            <div className="mt-2 text-[24px] font-semibold leading-none tracking-[var(--tracking-tight-xl)] text-text">
              {titleize(state.viewerRole || "member")}
            </div>
            <div className="mt-3">
              <StatusPill tone={canManage ? "success" : "warning"}>
                {canManage ? "Can manage team" : "Read-only access"}
              </StatusPill>
            </div>
          </div>
        </section>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Members" value={metrics.total} caption="Workspace users" icon={UsersRound} tone="brand" />
        <StatCard label="Active" value={metrics.active} caption="Can access workspace" icon={CheckCircle2} tone="success" />
        <StatCard label="Owners" value={metrics.owners} caption="Full control" icon={Crown} tone="brand" />
        <StatCard label="Operators" value={metrics.operators} caption="Inbox handoff" icon={Headphones} tone="neutral" />
      </div>

      <OperatorFlow />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-3">
          {arr(state.users).length ? (
            arr(state.users).map((user) => (
              <TeamRow
                key={userId(user) || userEmail(user)}
                user={user}
                busyId={busyId}
                onToggleStatus={handleToggleStatus}
              />
            ))
          ) : (
            <Card padded="lg" className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[18px] border border-line-soft bg-surface-subtle">
                <UsersRound className="h-6 w-6 text-text-muted" strokeWidth={2.1} />
              </div>

              <h2 className="mt-4 text-[22px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                No team members yet
              </h2>

              <p className="mx-auto mt-2 max-w-[520px] text-[14px] font-medium leading-6 text-text-muted">
                Add operators when you are ready to hand off customer conversations.
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card padded={false} clip>
            <div className="border-b border-line-soft px-4 py-3.5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                Add operator
              </div>
              <div className="mt-1 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                Team access
              </div>
            </div>

            <form className="grid gap-3 px-4 py-4" onSubmit={handleInvite}>
              <label className="grid gap-1.5">
                <span className="text-[12px] font-semibold text-text-muted">Email</span>
                <input
                  value={invite.email}
                  onChange={(event) => setInvite((current) => ({ ...current, email: event.target.value }))}
                  placeholder="operator@company.com"
                  disabled={!canManage}
                  className="h-10 rounded-[14px] border border-line bg-white px-3 text-[13.5px] font-medium text-text outline-none transition-colors duration-base ease-premium placeholder:text-text-subtle focus:border-brand disabled:bg-surface-subtle"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[12px] font-semibold text-text-muted">Name</span>
                <input
                  value={invite.fullName}
                  onChange={(event) => setInvite((current) => ({ ...current, fullName: event.target.value }))}
                  placeholder="Optional"
                  disabled={!canManage}
                  className="h-10 rounded-[14px] border border-line bg-white px-3 text-[13.5px] font-medium text-text outline-none transition-colors duration-base ease-premium placeholder:text-text-subtle focus:border-brand disabled:bg-surface-subtle"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-[12px] font-semibold text-text-muted">Role</span>
                <select
                  value={invite.role}
                  onChange={(event) => setInvite((current) => ({ ...current, role: event.target.value }))}
                  disabled={!canManage}
                  className="h-10 rounded-[14px] border border-line bg-white px-3 text-[13.5px] font-semibold text-text outline-none transition-colors duration-base ease-premium focus:border-brand disabled:bg-surface-subtle"
                >
                  <option value="operator">Operator</option>
                  <option value="admin">Admin</option>
                </select>
              </label>

              <Button
                type="submit"
                fullWidth
                disabled={!canManage}
                loading={busyId === "invite"}
                leftIcon={busyId !== "invite" ? <Plus className="h-4 w-4" strokeWidth={2.1} /> : undefined}
              >
                Add team member
              </Button>

              {!canManage ? (
                <InlineNotice
                  tone="warning"
                  compact
                  description="Only owner or admin users can manage team access."
                />
              ) : null}
            </form>
          </Card>

          <Card padded="md">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-line-soft bg-brand-soft">
                <CircleAlert className="h-5 w-5 text-brand" strokeWidth={2.1} />
              </span>

              <div>
                <div className="text-[15px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                  Production note
                </div>
                <div className="mt-1 text-[13.5px] font-medium leading-6 text-text-muted">
                  This surface manages existing tenant users. Full email invitations can be added after the core launch flow is stable.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={state.refreshing}
          onClick={() => load({ refreshing: true })}
          leftIcon={!state.refreshing ? <RefreshCw className="h-4 w-4" strokeWidth={2.1} /> : undefined}
        >
          Refresh team
        </Button>
      </div>
    </PageCanvas>
  );
}
