import {
  Building2,
  ChevronRight,
  KeyRound,
  Mail,
  PencilLine,
  Search,
  ShieldCheck,
  User2,
  UserPlus,
  Users,
} from "lucide-react";

import SurfaceBanner from "../components/feedback/SurfaceBanner.jsx";
import { cx } from "../lib/cx.js";
import { useAdminTeamSurface } from "./hooks/useAdminTeamSurface.js";

function Surface({ className = "", children }) {
  return (
    <section
      className={cx(
        "overflow-hidden rounded-[32px] border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] shadow-panel",
        className
      )}
    >
      {children}
    </section>
  );
}

function Label({ children }) {
  return (
    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-text-subtle">
      {children}
    </label>
  );
}

function Field({ icon: Icon, className = "", ...props }) {
  return (
    <div className={cx("relative", className)}>
      {Icon ? (
        <Icon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      ) : null}
      <input
        {...props}
        className={cx(
          "w-full rounded-[22px] border border-line bg-surface px-4 py-3.5 text-[15px] text-text outline-none transition",
          "placeholder:text-text-subtle",
          "focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10",
          props.disabled && "cursor-not-allowed bg-surface-subtle text-text-subtle",
          Icon && "pl-11"
        )}
      />
    </div>
  );
}

function Select({ className = "", ...props }) {
  return (
    <select
      {...props}
      className={cx(
        "w-full rounded-[22px] border border-line bg-surface px-4 py-3.5 text-[15px] text-text outline-none transition",
        "focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10",
        props.disabled && "cursor-not-allowed bg-surface-subtle text-text-subtle",
        className
      )}
    />
  );
}

function Btn({ children, variant = "secondary", className = "", ...props }) {
  const tone =
    variant === "primary"
      ? "border border-brand bg-brand text-white hover:border-brand-strong hover:bg-brand-strong"
      : variant === "danger"
        ? "border border-danger/20 bg-danger-soft text-danger hover:border-danger/30"
        : variant === "ghost"
          ? "border border-transparent bg-transparent text-text-muted hover:bg-surface-muted hover:text-text"
          : "border border-line bg-surface text-text hover:border-line-strong hover:bg-surface-muted";

  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center rounded-[16px] px-4 py-2.5 text-sm font-medium transition-all duration-150",
        "focus:outline-none focus:ring-4 focus:ring-cyan-500/10",
        "disabled:cursor-not-allowed disabled:opacity-50",
        tone,
        className
      )}
    >
      {children}
    </button>
  );
}

function Chip({ children, className = "" }) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

function roleTone(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "owner") return "border-violet-200 bg-violet-50 text-violet-700";
  if (normalized === "admin") return "border-sky-200 bg-sky-50 text-sky-700";
  if (normalized === "operator") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "marketer") return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700";
  if (normalized === "analyst") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-line bg-surface-muted text-text-muted";
}

function statusTone(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (normalized === "invited") return "border-amber-200 bg-amber-50 text-amber-700";
  if (normalized === "disabled") return "border-rose-200 bg-rose-50 text-rose-700";
  if (normalized === "removed") return "border-slate-200 bg-slate-100 text-slate-600";
  return "border-line bg-surface-muted text-text-muted";
}

function roleLabel(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "owner") return "Owner";
  if (normalized === "admin") return "Administrator";
  if (normalized === "operator") return "Operator";
  if (normalized === "marketer") return "Marketing";
  if (normalized === "analyst") return "Analyst";
  return "Team member";
}

function statusLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "active") return "Active";
  if (normalized === "invited") return "Pending setup";
  if (normalized === "disabled") return "Disabled";
  if (normalized === "removed") return "Removed";
  return "Unknown";
}

export default function AdminTeam() {
  const {
    tenants,
    users,
    tenantKey,
    setTenantKey,
    filteredUsers,
    selectedWorkspace,
    query,
    setQuery,
    createForm,
    patchCreate,
    editForm,
    patchEdit,
    passwordUserId,
    setPasswordUserId,
    newPassword,
    setNewPassword,
    surface,
    actionState,
    startEdit,
    createUser,
    saveEdit,
    updateQuickStatus,
    updatePassword,
    removeUser,
  } = useAdminTeamSurface();

  async function handleDelete(userId) {
    await removeUser(userId);
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[440px_minmax(0,1fr)]">
      <div className="space-y-8">
        <SurfaceBanner
          surface={surface}
          unavailableMessage="Admin team management is temporarily unavailable."
          refreshLabel="Refresh Team Admin"
        />

        <Surface className="sticky top-5">
          <div className="px-7 py-7">
            <div className="mb-8 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[24px] border border-line bg-brand-soft text-brand">
                <UserPlus className="h-6 w-6" />
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.20em] text-text-subtle">
                  Access studio
                </div>
                <div className="mt-1 text-[30px] font-semibold tracking-[-0.04em] text-text">
                  Identity control
                </div>
                <div className="mt-3 text-[15px] leading-7 text-text-muted">
                  Create workspace logins, update access, and assign credentials from one place.
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <Label>Workspace</Label>

                {surface.loading ? (
                  <div className="rounded-[22px] border border-line bg-surface-muted px-4 py-3.5 text-sm text-text-muted">
                    Loading workspaces...
                  </div>
                ) : (
                  <Select value={tenantKey} onChange={(e) => setTenantKey(e.target.value)}>
                    <option value="">Select workspace</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.tenant_key} value={tenant.tenant_key}>
                        {tenant.company_name || tenant.tenant_key} ({tenant.tenant_key})
                      </option>
                    ))}
                  </Select>
                )}

                {selectedWorkspace ? (
                  <div className="rounded-[24px] border border-line bg-surface-muted px-5 py-4">
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-subtle">
                      <Building2 className="h-3.5 w-3.5" />
                      Active workspace
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-base font-semibold text-text">
                        {selectedWorkspace.company_name || selectedWorkspace.tenant_key}
                      </div>
                      <Chip className="border-brand/15 bg-brand-soft text-brand">
                        {selectedWorkspace.tenant_key}
                      </Chip>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="h-px bg-line-soft" />

              <div className="space-y-4">
                <Label>Create user access</Label>

                <Field
                  icon={Mail}
                  value={createForm.email}
                  onChange={(e) => patchCreate("email", e.target.value)}
                  placeholder="Email address"
                />

                <Field
                  icon={User2}
                  value={createForm.full_name}
                  onChange={(e) => patchCreate("full_name", e.target.value)}
                  placeholder="Full name"
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <Select
                    value={createForm.role}
                    onChange={(e) => patchCreate("role", e.target.value)}
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Administrator</option>
                    <option value="operator">Operator</option>
                    <option value="member">Team member</option>
                    <option value="marketer">Marketing</option>
                    <option value="analyst">Analyst</option>
                  </Select>

                  <Select
                    value={createForm.status}
                    onChange={(e) => patchCreate("status", e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="invited">Pending setup</option>
                    <option value="disabled">Disabled</option>
                  </Select>
                </div>

                <Field
                  icon={KeyRound}
                  type="password"
                  value={createForm.password}
                  onChange={(e) => patchCreate("password", e.target.value)}
                  placeholder="Initial login password"
                />

                <div className="flex justify-end">
                  <Btn
                    variant="primary"
                    onClick={createUser}
                    disabled={surface.saving || !tenantKey}
                  >
                    {actionState.isActionPending("create-user") ? "Creating..." : "Create user"}
                  </Btn>
                </div>
              </div>

              <div className="h-px bg-white/[0.08]" />

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-subtle">
                  <PencilLine className="h-3.5 w-3.5" />
                  Edit access
                </div>

                <Field
                  icon={Mail}
                  value={editForm.email}
                  onChange={(e) => patchEdit("email", e.target.value)}
                  placeholder="Email address"
                  disabled={!editForm.id}
                />

                <Field
                  icon={User2}
                  value={editForm.full_name}
                  onChange={(e) => patchEdit("full_name", e.target.value)}
                  placeholder="Full name"
                  disabled={!editForm.id}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <Select
                    value={editForm.role}
                    onChange={(e) => patchEdit("role", e.target.value)}
                    disabled={!editForm.id}
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Administrator</option>
                    <option value="operator">Operator</option>
                    <option value="member">Team member</option>
                    <option value="marketer">Marketing</option>
                    <option value="analyst">Analyst</option>
                  </Select>

                  <Select
                    value={editForm.status}
                    onChange={(e) => patchEdit("status", e.target.value)}
                    disabled={!editForm.id}
                  >
                    <option value="invited">Pending setup</option>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                    <option value="removed">Removed</option>
                  </Select>
                </div>

                <div className="flex justify-end">
                  <Btn
                    variant="secondary"
                    onClick={saveEdit}
                    disabled={surface.saving || !editForm.id}
                  >
                    {actionState.isActionPending("save-edit") ? "Saving..." : "Save changes"}
                  </Btn>
                </div>
              </div>

              <div className="h-px bg-line-soft" />

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-subtle">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Password reset
                </div>

                <Select
                  value={passwordUserId}
                  onChange={(e) => setPasswordUserId(e.target.value)}
                >
                  <option value="">Select user</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.user_email} ({user.user_email})
                    </option>
                  ))}
                </Select>

                <Field
                  icon={KeyRound}
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New login password"
                />

                <div className="flex justify-end">
                  <Btn
                    variant="secondary"
                    onClick={updatePassword}
                    disabled={surface.saving || !tenantKey}
                  >
                    {actionState.isActionPending("password") ? "Updating..." : "Update password"}
                  </Btn>
                </div>
              </div>
            </div>
          </div>
        </Surface>
      </div>

      <Surface>
        <div className="border-b border-line-soft px-7 py-7">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[24px] border border-line bg-brand-soft text-brand">
              <Users className="h-6 w-6" />
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.20em] text-text-subtle">
                Member wall
              </div>
              <div className="mt-1 text-[30px] font-semibold tracking-[-0.04em] text-text">
                Team members
              </div>
              <div className="mt-3 text-[15px] leading-7 text-text-muted">
                {selectedWorkspace
                  ? `Users in ${selectedWorkspace.company_name || selectedWorkspace.tenant_key}`
                  : "Select a workspace to view and manage members"}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative max-w-xl flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by email, name, role, or status"
                className="w-full rounded-[22px] border border-line bg-surface py-3.5 pl-11 pr-4 text-[15px] text-text outline-none transition placeholder:text-text-subtle focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10"
              />
            </div>

            <Chip className="border-line bg-surface text-text-muted">
              {users.length} total
            </Chip>
          </div>
        </div>

        <div className="px-7 py-7">
          <div className="space-y-4">
            {surface.loading ? (
                <div className="rounded-[24px] border border-line bg-surface-muted px-5 py-5 text-sm text-text-muted">
                  Loading users...
                </div>
              ) : !tenantKey ? (
                <div className="rounded-[24px] border border-dashed border-line bg-surface-muted px-5 py-5 text-sm text-text-muted">
                  Select a workspace to view users.
                </div>
              ) : filteredUsers.length ? (
              filteredUsers.map((user) => {
                const activeEdit = editForm.id === user.id;
                const activePassword = passwordUserId === user.id;

                return (
                  <div
                    key={user.id}
                    className={cx(
                      "rounded-[30px] border px-5 py-5 transition-all duration-300",
                      activeEdit || activePassword
                        ? "border-brand/15 bg-brand-soft shadow-[0_18px_40px_-28px_rgba(37,99,235,0.18)]"
                        : "border-line bg-surface hover:border-line-strong hover:bg-surface-muted"
                    )}
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] border border-line bg-surface-muted text-base font-semibold text-text">
                            {(user.full_name || user.user_email || "U").trim().charAt(0).toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-[22px] font-semibold tracking-[-0.04em] text-text">
                              {user.full_name || "-"}
                            </div>
                            <div className="mt-1 truncate text-[15px] text-text-muted">
                              {user.user_email}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <Chip className={roleTone(user.role)}>{roleLabel(user.role)}</Chip>
                              <Chip className={statusTone(user.status)}>{statusLabel(user.status)}</Chip>
                            </div>

                            <div className="mt-4 text-sm text-text-subtle">
                              Created on{" "}
                              {user.created_at ? new Date(user.created_at).toLocaleString() : "-"}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 xl:max-w-[460px] xl:justify-end">
                        <Btn variant="ghost" onClick={() => startEdit(user)}>
                          Edit
                        </Btn>

                        <Btn
                          variant="secondary"
                          onClick={() => {
                            setPasswordUserId(user.id);
                            setNewPassword("");
                          }}
                        >
                          Password
                        </Btn>

                        {user.status !== "active" ? (
                          <Btn
                            variant="secondary"
                            onClick={() => updateQuickStatus(user.id, "active")}
                            disabled={surface.saving}
                          >
                            {actionState.isActionPending(`status:${user.id}:active`) ? "Activating..." : "Activate"}
                          </Btn>
                        ) : null}

                        {user.status !== "disabled" ? (
                          <Btn
                            variant="secondary"
                            onClick={() => updateQuickStatus(user.id, "disabled")}
                            disabled={surface.saving}
                          >
                            {actionState.isActionPending(`status:${user.id}:disabled`) ? "Disabling..." : "Disable"}
                          </Btn>
                        ) : null}

                        <Btn
                          variant="danger"
                          onClick={() => handleDelete(user.id)}
                          disabled={surface.saving}
                        >
                          {actionState.isActionPending(`delete:${user.id}`) ? "Deleting..." : "Delete"}
                        </Btn>
                      </div>
                    </div>

                    {activeEdit || activePassword ? (
                      <div className="mt-5 flex items-center gap-2 border-t border-line-soft pt-4 text-sm text-brand">
                        <ChevronRight className="h-4 w-4" />
                        {activeEdit
                          ? "This member is selected for editing."
                          : "This member is selected for password update."}
                      </div>
                    ) : null}
                  </div>
                );
              })
            ) : (
                <div className="rounded-[24px] border border-dashed border-line bg-surface-muted px-5 py-5 text-sm text-text-muted">
                  No users found.
                </div>
              )}
          </div>
        </div>
      </Surface>
    </div>
  );
}
