import {
  CalendarClock,
  Loader2,
  Mail,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  KeyRound,
} from "lucide-react";

import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";
import SettingsSection from "./SettingsSection.jsx";
import SettingsSurfaceBanner from "./SettingsSurfaceBanner.jsx";
import { cx } from "../../lib/cx.js";
import { useTeamSurface } from "./hooks/useTeamSurface.js";

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

function roleTone(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "owner") return "danger";
  if (normalized === "admin") return "info";
  if (normalized === "operator") return "success";
  if (normalized === "marketer") return "warn";
  if (normalized === "analyst") return "neutral";
  return "neutral";
}

function statusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active") return "success";
  if (normalized === "invited") return "warn";
  if (normalized === "disabled") return "danger";
  if (normalized === "removed") return "neutral";
  return "neutral";
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

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export default function TeamPanel({ canManage = false }) {
  const {
    items,
    filtered,
    selected,
    selectedId,
    setSelectedId,
    query,
    setQuery,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    form,
    setForm,
    dirty,
    pendingAction,
    surface,
    resetCreateForm,
    createUser,
    saveSelectedUser,
    updateSelectedStatus,
    deleteSelectedUser,
  } = useTeamSurface({ canManage });

  const activeCount = items.filter((item) => String(item?.status).toLowerCase() === "active").length;
  const invitedCount = items.filter((item) => String(item?.status).toLowerCase() === "invited").length;
  const uniqueRoleCount = [...new Set(items.map((item) => item?.role).filter(Boolean))].length;

  async function handleDelete() {
    if (!selected?.id) return;

    const confirmed = window.confirm(
      `${selected.full_name || selected.user_email} should be deleted?`
    );
    if (!confirmed) return;

    await deleteSelectedUser();
  }

  return (
    <SettingsSection
      eyebrow="Team"
      title="Team"
      subtitle="Workspace users, roles, and status are managed here."
      tone="default"
    >
      <div className="space-y-6">
        <SettingsSurfaceBanner
          surface={surface}
          unavailableMessage="Team management is temporarily unavailable."
          refreshLabel="Refresh Team"
        />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <Card variant="surface" padded="lg" className="rounded-[28px]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="inline-flex flex-wrap items-center gap-2">
                  <Badge tone="info" variant="subtle" dot>
                    Workspace Team
                  </Badge>
                  <Badge
                    tone={activeCount > 0 ? "success" : "neutral"}
                    variant="subtle"
                    dot={activeCount > 0}
                  >
                    {activeCount} active
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[26px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                    Team Access Control
                  </div>
                  <div className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    Workspace members, role assignment, and status changes are managed from this panel.
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px]">
                <StatTile label="Members" value={items.length} hint="Total users" tone="info" />
                <StatTile
                  label="Active"
                  value={activeCount}
                  hint="Enabled members"
                  tone={activeCount > 0 ? "success" : "neutral"}
                />
                <StatTile
                  label="Invited"
                  value={invitedCount}
                  hint="Pending access"
                  tone={invitedCount > 0 ? "warn" : "neutral"}
                />
              </div>
            </div>
          </Card>

          <Card variant="subtle" padded="lg" className="rounded-[28px]">
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  Access State
                </div>
                <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                  Management Access
                </div>
                <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Team changes remain restricted to permitted operators.
                </div>
              </div>

              {canManage ? (
                <div className="rounded-[24px] border border-emerald-200/80 bg-emerald-50/90 px-4 py-4 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
                  Owner/admin access is active. You can create users and update roles.
                </div>
              ) : (
                <div className="rounded-[24px] border border-amber-200/80 bg-amber-50/90 px-4 py-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
                  This team surface is read-only for your role.
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <StatTile
                  label="Permission"
                  value={canManage ? "Write" : "Read Only"}
                  hint="Current operator mode"
                  tone={canManage ? "success" : "warn"}
                />
                <StatTile
                  label="Roles"
                  value={uniqueRoleCount}
                  hint="Unique role types"
                  tone="info"
                />
                <StatTile
                  label="Directory"
                  value={items.length ? "Ready" : "Empty"}
                  hint="Team registry state"
                  tone={items.length ? "neutral" : "warn"}
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card variant="surface" padded="lg" className="rounded-[28px]">
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                    Team Directory
                  </div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Search, filter, and select users.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge tone="neutral" variant="subtle">
                    {items.length} people
                  </Badge>

                  {canManage ? (
                    <Button
                      variant="secondary"
                      onClick={resetCreateForm}
                      leftIcon={<UserPlus className="h-4 w-4" />}
                    >
                      New
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, email, role..."
                  leftIcon={<Search className="h-4 w-4" />}
                />

                <div className="grid grid-cols-2 gap-3">
                  <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                    <option value="">All roles</option>
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="operator">Operator</option>
                    <option value="marketer">Marketer</option>
                    <option value="analyst">Analyst</option>
                    <option value="member">Member</option>
                  </Select>

                  <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="invited">Invited</option>
                    <option value="disabled">Disabled</option>
                    <option value="removed">Removed</option>
                  </Select>
                </div>
              </div>

              <div className="max-h-[620px] space-y-2 overflow-auto pr-1">
                {surface.loading ? (
                  <Card variant="subtle" padded="md" className="rounded-[22px]">
                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading team...
                    </div>
                  </Card>
                ) : filtered.length ? (
                  filtered.map((user) => {
                    const active = user.id === selectedId;
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => setSelectedId(user.id)}
                        className={cx(
                          "w-full rounded-[22px] border p-3.5 text-left transition-all duration-200",
                          active
                            ? "border-sky-300/80 bg-sky-50/90 shadow-[0_12px_28px_rgba(14,165,233,0.08)] dark:border-sky-400/20 dark:bg-sky-400/10"
                            : "border-slate-200/80 bg-white/70 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                              {user.full_name || "Unnamed user"}
                            </div>
                            <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                              {user.user_email}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <Badge tone={roleTone(user.role)} variant="subtle" size="sm">
                              {user.role}
                            </Badge>
                            <Badge tone={statusTone(user.status)} variant="subtle" size="sm" dot>
                              {user.status}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <Card variant="subtle" padded="md" className="rounded-[22px]">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      No users matched the current filters.
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </Card>

          <Card variant="surface" padded="lg" className="rounded-[28px]">
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                    {selected ? "User Detail" : "New Team User"}
                  </div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Manage roles, update status, or create a new user.
                  </div>
                </div>

                {!canManage ? (
                  <Badge tone="warn" variant="subtle">
                    Read Only
                  </Badge>
                ) : null}
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                <Card variant="subtle" padded="lg" className="rounded-[24px]">
                  <div className="space-y-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200/80 bg-white/80 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                        <Users className="h-[18px] w-[18px]" strokeWidth={1.9} />
                      </div>

                      <div className="space-y-1">
                        <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                          Identity & Role
                        </div>
                        <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                          User identity and workspace access values.
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <Field label="Email" hint="Unique workspace email.">
                          <Input
                            value={form.user_email}
                            onChange={(e) =>
                              setForm((state) => ({ ...state, user_email: e.target.value }))
                            }
                            placeholder="owner@neox.az"
                            disabled={!canManage || !!selected}
                            leftIcon={<Mail className="h-4 w-4" />}
                          />
                        </Field>
                      </div>

                      <div className="md:col-span-2">
                        <Field label="Full Name" hint="Visible workspace identity.">
                          <Input
                            value={form.full_name}
                            onChange={(e) =>
                              setForm((state) => ({ ...state, full_name: e.target.value }))
                            }
                            placeholder="NEOX Operator"
                            disabled={!canManage}
                          />
                        </Field>
                      </div>

                      {!selected ? (
                        <div className="md:col-span-2">
                          <Field label="Password" hint="Optional. Can be set for local login access.">
                            <Input
                              type="password"
                              value={form.password}
                              onChange={(e) =>
                                setForm((state) => ({ ...state, password: e.target.value }))
                              }
                              placeholder="********"
                              disabled={!canManage}
                              leftIcon={<KeyRound className="h-4 w-4" />}
                            />
                          </Field>
                        </div>
                      ) : null}

                      <Field label="Role" hint="Assigned permission scope.">
                        <Select
                          value={form.role}
                          onChange={(e) =>
                            setForm((state) => ({ ...state, role: e.target.value }))
                          }
                          disabled={!canManage}
                        >
                          <option value="owner">owner</option>
                          <option value="admin">admin</option>
                          <option value="operator">operator</option>
                          <option value="marketer">marketer</option>
                          <option value="analyst">analyst</option>
                          <option value="member">member</option>
                        </Select>
                      </Field>

                      <Field label="Status" hint="Current membership state.">
                        <Select
                          value={form.status}
                          onChange={(e) =>
                            setForm((state) => ({ ...state, status: e.target.value }))
                          }
                          disabled={!canManage}
                        >
                          <option value="invited">invited</option>
                          <option value="active">active</option>
                          <option value="disabled">disabled</option>
                          <option value="removed">removed</option>
                        </Select>
                      </Field>
                    </div>
                  </div>
                </Card>

                <Card variant="subtle" padded="lg" className="rounded-[24px]">
                  <div className="space-y-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-slate-200/80 bg-white/80 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200">
                        <Shield className="h-[18px] w-[18px]" strokeWidth={1.9} />
                      </div>

                      <div className="space-y-1">
                        <div className="text-lg font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                          Access Snapshot
                        </div>
                        <div className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                          Status and time metadata for the selected user.
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                      <StatTile
                        label="Mode"
                        value={selected ? "Edit" : "Create"}
                        hint="Current form context"
                        tone={selected ? "info" : "success"}
                      />
                      <StatTile
                        label="Role"
                        value={form.role || "member"}
                        hint="Permission assignment"
                        tone={roleTone(form.role)}
                      />
                      <StatTile
                        label="Status"
                        value={form.status || "invited"}
                        hint="Membership lifecycle"
                        tone={statusTone(form.status)}
                      />
                    </div>

                    {selected ? (
                      <div className="grid gap-3">
                        <div className="rounded-[22px] border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                            <CalendarClock className="h-3.5 w-3.5" />
                            Created
                          </div>
                          <div className="mt-2 text-sm text-slate-800 dark:text-slate-200">
                            {formatDate(selected.created_at)}
                          </div>
                        </div>

                        <div className="rounded-[22px] border border-slate-200/80 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                            <CalendarClock className="h-3.5 w-3.5" />
                            Last Seen
                          </div>
                          <div className="mt-2 text-sm text-slate-800 dark:text-slate-200">
                            {formatDate(selected.last_seen_at)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-[22px] border border-dashed border-slate-200/80 bg-white/60 p-4 text-sm text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-400">
                        Select a user from the directory or create a new one.
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              <div className="flex flex-wrap gap-3 border-t border-slate-200/70 pt-5 dark:border-white/10">
                {!selected ? (
                  <Button
                    onClick={createUser}
                    disabled={!canManage || surface.saving || !form.user_email}
                    leftIcon={<UserPlus className="h-4 w-4" />}
                  >
                    {pendingAction === "create" ? "Creating..." : "Create User"}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={saveSelectedUser}
                      disabled={!canManage || surface.saving || !dirty}
                    >
                      {pendingAction === "save" ? "Saving..." : "Save Changes"}
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => updateSelectedStatus("active")}
                      disabled={!canManage || surface.saving}
                    >
                      Activate
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => updateSelectedStatus("disabled")}
                      disabled={!canManage || surface.saving}
                    >
                      Disable
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={() => updateSelectedStatus("removed")}
                      disabled={!canManage || surface.saving}
                    >
                      Remove
                    </Button>

                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={!canManage || surface.saving}
                      leftIcon={<Trash2 className="h-4 w-4" />}
                      className="ml-auto"
                    >
                      Delete
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </SettingsSection>
  );
}
