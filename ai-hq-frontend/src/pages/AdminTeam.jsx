import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Building2,
  Mail,
  User2,
  KeyRound,
  Search,
  ChevronRight,
  ShieldCheck,
  Users,
  UserPlus,
  PencilLine,
} from "lucide-react";
import {
  listTenants,
  listTenantUsers,
  createTenantUser,
  updateTenantUser,
  setTenantUserStatus,
  setTenantUserPassword,
  deleteTenantUser,
} from "../api/tenants.js";

function cx(...arr) {
  return arr.filter(Boolean).join(" ");
}

function Surface({ className = "", children }) {
  return (
    <section
      className={cx(
        "overflow-hidden rounded-[32px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(10,14,24,0.82),rgba(5,8,16,0.94))] shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-2xl",
        className
      )}
    >
      {children}
    </section>
  );
}

function Banner({ type = "success", children }) {
  const tone =
    type === "success"
      ? "border-emerald-400/16 bg-emerald-500/10 text-emerald-200"
      : "border-rose-400/16 bg-rose-500/10 text-rose-200";
  const Icon = type === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div className={cx("flex items-center gap-3 rounded-[24px] border px-5 py-4 text-sm", tone)}>
      <Icon className="h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function Label({ children }) {
  return (
    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
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
          "w-full rounded-[22px] border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 text-[15px] text-white outline-none transition",
          "placeholder:text-slate-500",
          "focus:border-cyan-400/30 focus:bg-white/[0.05] focus:ring-4 focus:ring-cyan-500/10",
          props.disabled && "cursor-not-allowed bg-white/[0.02] text-slate-500",
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
        "w-full rounded-[22px] border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 text-[15px] text-white outline-none transition",
        "focus:border-cyan-400/30 focus:bg-white/[0.05] focus:ring-4 focus:ring-cyan-500/10",
        props.disabled && "cursor-not-allowed bg-white/[0.02] text-slate-500",
        className
      )}
    />
  );
}

function Btn({ children, variant = "secondary", className = "", ...props }) {
  const tone =
    variant === "primary"
      ? "border border-cyan-400/24 bg-cyan-400 text-slate-950 hover:brightness-110"
      : variant === "danger"
      ? "border border-rose-400/16 bg-rose-500/16 text-rose-200 hover:bg-rose-500/22"
      : variant === "ghost"
      ? "border border-transparent bg-transparent text-slate-400 hover:bg-white/[0.04] hover:text-white"
      : "border border-white/[0.08] bg-white/[0.04] text-slate-200 hover:bg-white/[0.07]";

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
  const r = String(role || "").toLowerCase();
  if (r === "owner") return "border-violet-400/16 bg-violet-400/10 text-violet-200";
  if (r === "admin") return "border-sky-400/16 bg-sky-400/10 text-sky-200";
  if (r === "operator") return "border-emerald-400/16 bg-emerald-400/10 text-emerald-200";
  if (r === "marketer") return "border-fuchsia-400/16 bg-fuchsia-400/10 text-fuchsia-200";
  if (r === "analyst") return "border-amber-400/16 bg-amber-400/10 text-amber-200";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "active") return "border-emerald-400/16 bg-emerald-400/10 text-emerald-200";
  if (s === "invited") return "border-amber-400/16 bg-amber-400/10 text-amber-200";
  if (s === "disabled") return "border-rose-400/16 bg-rose-400/10 text-rose-200";
  if (s === "removed") return "border-slate-400/16 bg-slate-400/10 text-slate-300";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}

function roleLabel(role) {
  const r = String(role || "").toLowerCase();
  if (r === "owner") return "Owner";
  if (r === "admin") return "Administrator";
  if (r === "operator") return "Operator";
  if (r === "marketer") return "Marketing";
  if (r === "analyst") return "Analyst";
  return "Team member";
}

function statusLabel(status) {
  const s = String(status || "").toLowerCase();
  if (s === "active") return "Active";
  if (s === "invited") return "Pending setup";
  if (s === "disabled") return "Disabled";
  if (s === "removed") return "Removed";
  return "Unknown";
}

const EMPTY_CREATE = {
  email: "",
  full_name: "",
  role: "member",
  status: "active",
  password: "",
};

const EMPTY_EDIT = {
  id: "",
  email: "",
  full_name: "",
  role: "member",
  status: "invited",
};

export default function AdminTeam() {
  const [tenants, setTenants] = useState([]);
  const [tenantKey, setTenantKey] = useState("");
  const [users, setUsers] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [removingId, setRemovingId] = useState("");
  const [query, setQuery] = useState("");
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [passwordUserId, setPasswordUserId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadTenants() {
    setLoadingTenants(true);
    try {
      const rows = await listTenants();
      setTenants(Array.isArray(rows) ? rows : []);
      if (!tenantKey && rows?.[0]?.tenant_key) {
        setTenantKey(rows[0].tenant_key);
      }
    } catch (e) {
      setError(String(e?.message || e || "Unable to load workspaces"));
      setTenants([]);
    } finally {
      setLoadingTenants(false);
    }
  }

  async function loadUsers(key) {
    if (!key) {
      setUsers([]);
      return;
    }

    setLoadingUsers(true);
    setError("");
    try {
      const rows = await listTenantUsers(key);
      setUsers(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setError(String(e?.message || e || "Unable to load users"));
      setUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    loadTenants();
  }, []);

  useEffect(() => {
    if (tenantKey) {
      loadUsers(tenantKey);
      setEditForm(EMPTY_EDIT);
      setPasswordUserId("");
      setNewPassword("");
    }
  }, [tenantKey]);

  const filteredUsers = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return users;

    return users.filter((u) => {
      const hay = [u?.user_email, u?.full_name, u?.role, u?.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [users, query]);

  const selectedWorkspace = useMemo(
    () => tenants.find((t) => t.tenant_key === tenantKey),
    [tenants, tenantKey]
  );

  function patchCreate(key, value) {
    setCreateForm((p) => ({ ...p, [key]: value }));
  }

  function patchEdit(key, value) {
    setEditForm((p) => ({ ...p, [key]: value }));
  }

  function startEdit(user) {
    setEditForm({
      id: String(user?.id || ""),
      email: String(user?.user_email || ""),
      full_name: String(user?.full_name || ""),
      role: String(user?.role || "member"),
      status: String(user?.status || "invited"),
    });
  }

  async function handleCreateUser() {
    setCreating(true);
    setError("");
    setSuccess("");

    try {
      if (!tenantKey) throw new Error("Please select a workspace");
      if (!createForm.email.trim()) throw new Error("Email address is required");
      if (!createForm.full_name.trim()) throw new Error("Full name is required");

      const res = await createTenantUser(tenantKey, {
        user_email: createForm.email.trim().toLowerCase(),
        full_name: createForm.full_name.trim(),
        role: createForm.role,
        status: createForm.status,
        password: createForm.password || undefined,
      });

      setSuccess(`${res?.user?.user_email || "User"} has been created`);
      setCreateForm(EMPTY_CREATE);
      await loadUsers(tenantKey);
    } catch (e) {
      setError(String(e?.message || e || "Unable to create user"));
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit() {
    setSavingEdit(true);
    setError("");
    setSuccess("");

    try {
      if (!tenantKey) throw new Error("Please select a workspace");
      if (!editForm.id) throw new Error("Please select a user");

      const res = await updateTenantUser(tenantKey, editForm.id, {
        user_email: editForm.email.trim().toLowerCase(),
        full_name: editForm.full_name.trim(),
        role: editForm.role,
        status: editForm.status,
      });

      setSuccess(`${res?.user?.user_email || "User"} has been updated`);
      await loadUsers(tenantKey);
    } catch (e) {
      setError(String(e?.message || e || "Unable to save changes"));
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleQuickStatus(userId, status) {
    setError("");
    setSuccess("");

    try {
      if (!tenantKey) throw new Error("Please select a workspace");
      const res = await setTenantUserStatus(tenantKey, userId, status);
      setSuccess(`${res?.user?.user_email || "User"} status has been updated`);
      await loadUsers(tenantKey);
    } catch (e) {
      setError(String(e?.message || e || "Unable to update status"));
    }
  }

  async function handleSetPassword() {
    setSavingPassword(true);
    setError("");
    setSuccess("");

    try {
      if (!tenantKey) throw new Error("Please select a workspace");
      if (!passwordUserId) throw new Error("Please select a user");
      if (!newPassword) throw new Error("A new password is required");
      if (newPassword.length < 8) throw new Error("Password must be at least 8 characters");

      const res = await setTenantUserPassword(tenantKey, passwordUserId, newPassword);
      setSuccess(`${res?.user?.user_email || "User"} password has been updated`);
      setNewPassword("");
      await loadUsers(tenantKey);
    } catch (e) {
      setError(String(e?.message || e || "Unable to update password"));
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleDelete(userId) {
    setRemovingId(userId);
    setError("");
    setSuccess("");

    try {
      if (!tenantKey) throw new Error("Please select a workspace");
      await deleteTenantUser(tenantKey, userId);
      setSuccess("User has been deleted");

      if (editForm.id === userId) setEditForm(EMPTY_EDIT);
      if (passwordUserId === userId) {
        setPasswordUserId("");
        setNewPassword("");
      }

      await loadUsers(tenantKey);
    } catch (e) {
      setError(String(e?.message || e || "Unable to delete user"));
    } finally {
      setRemovingId("");
    }
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[440px_minmax(0,1fr)]">
      <div className="space-y-8">
        {error ? <Banner type="error">{error}</Banner> : null}
        {success ? <Banner type="success">{success}</Banner> : null}

        <Surface className="sticky top-5">
          <div className="px-7 py-7">
            <div className="mb-8 flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[24px] bg-[linear-gradient(180deg,rgba(18,24,42,0.96),rgba(10,14,28,0.98))] text-cyan-300 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
                <UserPlus className="h-6 w-6" />
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.20em] text-slate-500">
                  Access studio
                </div>
                <div className="mt-1 text-[30px] font-semibold tracking-[-0.04em] text-white">
                  Identity control
                </div>
                <div className="mt-3 text-[15px] leading-7 text-slate-400">
                  Create workspace logins, revise access, and assign credentials from one continuous control surface.
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="space-y-4">
                <Label>Workspace</Label>

                {loadingTenants ? (
                  <div className="rounded-[22px] border border-white/[0.08] bg-white/[0.03] px-4 py-3.5 text-sm text-slate-400">
                    Loading workspaces...
                  </div>
                ) : (
                  <Select value={tenantKey} onChange={(e) => setTenantKey(e.target.value)}>
                    <option value="">Select workspace</option>
                    {tenants.map((t) => (
                      <option key={t.tenant_key} value={t.tenant_key}>
                        {t.company_name || t.tenant_key} ({t.tenant_key})
                      </option>
                    ))}
                  </Select>
                )}

                {selectedWorkspace ? (
                  <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] px-5 py-4">
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <Building2 className="h-3.5 w-3.5" />
                      Active workspace
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-base font-semibold text-white">
                        {selectedWorkspace.company_name || selectedWorkspace.tenant_key}
                      </div>
                      <Chip className="border-cyan-400/16 bg-cyan-400/10 text-cyan-200">
                        {selectedWorkspace.tenant_key}
                      </Chip>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="h-px bg-white/[0.08]" />

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
                    onClick={handleCreateUser}
                    disabled={creating || !tenantKey}
                  >
                    {creating ? "Creating..." : "Create user"}
                  </Btn>
                </div>
              </div>

              <div className="h-px bg-white/[0.08]" />

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
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
                    onClick={handleSaveEdit}
                    disabled={savingEdit || !editForm.id}
                  >
                    {savingEdit ? "Saving..." : "Save changes"}
                  </Btn>
                </div>
              </div>

              <div className="h-px bg-white/[0.08]" />

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Password reset
                </div>

                <Select
                  value={passwordUserId}
                  onChange={(e) => setPasswordUserId(e.target.value)}
                >
                  <option value="">Select user</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.user_email} ({u.user_email})
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
                    onClick={handleSetPassword}
                    disabled={savingPassword || !tenantKey}
                  >
                    {savingPassword ? "Updating..." : "Update password"}
                  </Btn>
                </div>
              </div>
            </div>
          </div>
        </Surface>
      </div>

      <Surface>
        <div className="border-b border-white/[0.08] px-7 py-7">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[24px] bg-[linear-gradient(180deg,rgba(18,24,42,0.96),rgba(10,14,28,0.98))] text-cyan-300 shadow-[0_18px_40px_rgba(0,0,0,0.35)]">
              <Users className="h-6 w-6" />
            </div>

            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.20em] text-slate-500">
                Member wall
              </div>
              <div className="mt-1 text-[30px] font-semibold tracking-[-0.04em] text-white">
                Team members
              </div>
              <div className="mt-3 text-[15px] leading-7 text-slate-400">
                {selectedWorkspace
                  ? `Users in ${selectedWorkspace.company_name || selectedWorkspace.tenant_key}`
                  : "Select a workspace to view and manage members"}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative max-w-xl flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by email, name, role, or status"
                className="w-full rounded-[22px] border border-white/[0.08] bg-white/[0.03] py-3.5 pl-11 pr-4 text-[15px] text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/30 focus:bg-white/[0.05] focus:ring-4 focus:ring-cyan-500/10"
              />
            </div>

            <Chip className="border-white/[0.08] bg-white/[0.03] text-slate-300">
              {users.length} total
            </Chip>
          </div>
        </div>

        <div className="px-7 py-7">
          <div className="space-y-4">
            {loadingUsers ? (
              <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.03] px-5 py-5 text-sm text-slate-400">
                Loading users...
              </div>
            ) : !tenantKey ? (
              <div className="rounded-[24px] border border-dashed border-white/[0.08] bg-white/[0.02] px-5 py-5 text-sm text-slate-400">
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
                        ? "border-cyan-400/20 bg-cyan-500/[0.08] shadow-[0_18px_40px_rgba(8,145,178,0.10)]"
                        : "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05]"
                    )}
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[20px] bg-white/[0.05] text-base font-semibold text-slate-200">
                            {(user.full_name || user.user_email || "U").trim().charAt(0).toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-[22px] font-semibold tracking-[-0.04em] text-white">
                              {user.full_name || "-"}
                            </div>
                            <div className="mt-1 truncate text-[15px] text-slate-400">
                              {user.user_email}
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <Chip className={roleTone(user.role)}>{roleLabel(user.role)}</Chip>
                              <Chip className={statusTone(user.status)}>{statusLabel(user.status)}</Chip>
                            </div>

                            <div className="mt-4 text-sm text-slate-500">
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
                            onClick={() => handleQuickStatus(user.id, "active")}
                          >
                            Activate
                          </Btn>
                        ) : null}

                        {user.status !== "disabled" ? (
                          <Btn
                            variant="secondary"
                            onClick={() => handleQuickStatus(user.id, "disabled")}
                          >
                            Disable
                          </Btn>
                        ) : null}

                        <Btn
                          variant="danger"
                          onClick={() => handleDelete(user.id)}
                          disabled={removingId === user.id}
                        >
                          {removingId === user.id ? "Deleting..." : "Delete"}
                        </Btn>
                      </div>
                    </div>

                    {activeEdit || activePassword ? (
                      <div className="mt-5 flex items-center gap-2 border-t border-white/[0.08] pt-4 text-sm text-cyan-200">
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
              <div className="rounded-[24px] border border-dashed border-white/[0.08] bg-white/[0.02] px-5 py-5 text-sm text-slate-400">
                No users found.
              </div>
            )}
          </div>
        </div>
      </Surface>
    </div>
  );
}