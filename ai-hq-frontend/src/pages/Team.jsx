import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";

import {
  createTeamUser,
  getTeam,
  updateTeamUserStatus,
} from "../api/team.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
} from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
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
  if (!raw) return "";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function userId(user = {}) {
  return s(user.id || user.user_id);
}

function userEmail(user = {}) {
  return s(user.user_email || user.email);
}

function userName(user = {}) {
  return s(
    user.full_name ||
      user.fullName ||
      user.name ||
      user.display_name ||
      userEmail(user) ||
      "Team member"
  );
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

function StatusText({ tone = "neutral", children }) {
  return (
    <span className={cx("inline-flex items-center gap-2 text-[12px] font-semibold", toneText(tone))}>
      <span className={cx("h-1.5 w-1.5 rounded-full", toneDot(tone))} />
      {children}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[360px] items-center justify-center px-6 py-12 text-center">
      <div className="max-w-[520px]">
        <div className="mx-auto h-1.5 w-14 rounded-full bg-line-strong" />
        <h2 className="mt-6 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
          No team members yet
        </h2>
        <p className="mt-2 text-[13.5px] font-medium leading-6 text-text-muted">
          Add operators when someone else should help manage customer conversations.
        </p>
      </div>
    </div>
  );
}

function TeamRow({ user, busyId, canManage, onToggleStatus }) {
  const id = userId(user);
  const role = userRole(user);
  const status = userStatus(user);
  const active = ["active", "enabled"].includes(status);
  const owner = role === "owner";
  const busy = busyId === id;
  const updated = formatWhen(user.updated_at || user.updatedAt || user.created_at || user.createdAt);

  return (
    <div className="grid gap-3 border-t border-line-soft px-5 py-4 lg:grid-cols-[minmax(0,1.2fr)_160px_150px_auto] lg:items-center">
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
          {userName(user)}
        </div>
        <div className="mt-1 truncate text-[12.5px] font-medium text-text-muted">
          {userEmail(user) || "No email"}
        </div>
      </div>

      <StatusText tone={toneForRole(role)}>{titleize(role)}</StatusText>

      <StatusText tone={toneForStatus(status)}>{titleize(status)}</StatusText>

      {canManage && !owner ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={busy}
          disabled={!id || busy}
          onClick={() => onToggleStatus(user)}
        >
          {active ? "Disable" : "Activate"}
        </Button>
      ) : (
        <span className="text-right text-[12px] font-medium text-text-subtle">
          {updated || "—"}
        </span>
      )}
    </div>
  );
}

function AddMemberForm({
  canManage,
  invite,
  setInvite,
  busy,
  onSubmit,
}) {
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <label className="grid gap-1.5">
        <span className="text-[12px] font-semibold text-text-muted">Email</span>
        <input
          value={invite.email}
          onChange={(event) =>
            setInvite((current) => ({ ...current, email: event.target.value }))
          }
          placeholder="operator@company.com"
          disabled={!canManage}
          className="h-10 rounded-full border border-line bg-white px-3 text-[13.5px] font-medium text-text outline-none transition-colors duration-base ease-premium placeholder:text-text-subtle focus:border-brand disabled:bg-surface-subtle"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-[12px] font-semibold text-text-muted">Name</span>
        <input
          value={invite.fullName}
          onChange={(event) =>
            setInvite((current) => ({ ...current, fullName: event.target.value }))
          }
          placeholder="Optional"
          disabled={!canManage}
          className="h-10 rounded-full border border-line bg-white px-3 text-[13.5px] font-medium text-text outline-none transition-colors duration-base ease-premium placeholder:text-text-subtle focus:border-brand disabled:bg-surface-subtle"
        />
      </label>

      <label className="grid gap-1.5">
        <span className="text-[12px] font-semibold text-text-muted">Role</span>
        <select
          value={invite.role}
          onChange={(event) =>
            setInvite((current) => ({ ...current, role: event.target.value }))
          }
          disabled={!canManage}
          className="h-10 rounded-full border border-line bg-white px-3 text-[13.5px] font-semibold text-text outline-none transition-colors duration-base ease-premium focus:border-brand disabled:bg-surface-subtle"
        >
          <option value="operator">Operator</option>
          <option value="admin">Admin</option>
        </select>
      </label>

      <Button
        type="submit"
        fullWidth
        disabled={!canManage}
        loading={busy}
        leftIcon={!busy ? <Plus className="h-4 w-4" strokeWidth={2.1} /> : undefined}
      >
        Add member
      </Button>

      {!canManage ? (
        <div className="text-[12.5px] font-medium leading-5 text-text-muted">
          Only owners or admins can change team access.
        </div>
      ) : null}
    </form>
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

  const load = useCallback(async ({ refreshing = false } = {}) => {
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
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const canManage = useMemo(
    () => ["owner", "admin"].includes(lower(state.viewerRole)),
    [state.viewerRole]
  );

  async function handleInvite(event) {
    event?.preventDefault?.();

    const email = s(invite.email).toLowerCase();

    if (!email) {
      setNotice({
        tone: "danger",
        title: "Email required",
        description: "Enter an email before adding a team member.",
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
        description: "The workspace access list was updated.",
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
        title: "Could not add member",
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
        title: "Could not update member",
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
      <PageCanvas className="max-w-[1180px] py-3">
        <LoadingSurface title="Loading team" />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas className="max-w-[1180px] space-y-4 py-3">
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

      <Card padded={false} clip className="shadow-[0_28px_80px_-64px_rgba(15,23,42,0.55)]">
        <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-brand">Team</div>
            <h1 className="mt-1 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
              Workspace members
            </h1>
            <p className="mt-2 max-w-[720px] text-[13.5px] font-medium leading-6 text-text-muted">
              People who can access this workspace and handle customer operations.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <span className="text-[12.5px] font-semibold text-text-muted">
              {arr(state.users).length} member{arr(state.users).length === 1 ? "" : "s"}
            </span>

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

        <div className="grid border-t border-line-soft lg:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            {arr(state.users).length ? (
              <>
                <div className="hidden px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle lg:grid lg:grid-cols-[minmax(0,1.2fr)_160px_150px_auto]">
                  <span>Member</span>
                  <span>Role</span>
                  <span>Status</span>
                  <span className="text-right">Action</span>
                </div>

                {arr(state.users).map((user) => (
                  <TeamRow
                    key={userId(user) || userEmail(user)}
                    user={user}
                    busyId={busyId}
                    canManage={canManage}
                    onToggleStatus={handleToggleStatus}
                  />
                ))}
              </>
            ) : (
              <EmptyState />
            )}
          </div>

          <aside className="border-t border-line-soft px-5 py-5 lg:border-l lg:border-t-0">
            <div className="text-[14px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
              Add member
            </div>
            <p className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
              Give another person access when they should help with operations.
            </p>

            <div className="mt-4">
              <AddMemberForm
                canManage={canManage}
                invite={invite}
                setInvite={setInvite}
                busy={busyId === "invite"}
                onSubmit={handleInvite}
              />
            </div>
          </aside>
        </div>
      </Card>
    </PageCanvas>
  );
}