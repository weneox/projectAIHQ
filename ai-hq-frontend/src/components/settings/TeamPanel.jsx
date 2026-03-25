// src/components/settings/TeamPanel.jsx
// PREMIUM v4.0 — editorial team management panel (backend-aligned)

import { useEffect, useMemo, useState } from "react";
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

import {
  listTeam,
  createTeamUser,
  updateTeamUser,
  setTeamUserStatus,
  deleteTeamUser,
} from "../../api/team.js";

import Card from "../ui/Card.jsx";
import Input from "../ui/Input.jsx";
import Button from "../ui/Button.jsx";
import Badge from "../ui/Badge.jsx";
import SettingsSection from "./SettingsSection.jsx";
import { cx } from "../../lib/cx.js";

const EMPTY_FORM = {
  user_email: "",
  full_name: "",
  role: "member",
  status: "invited",
  password: "",
};

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
  const r = String(role || "").toLowerCase();
  if (r === "owner") return "danger";
  if (r === "admin") return "info";
  if (r === "operator") return "success";
  if (r === "marketer") return "warn";
  if (r === "analyst") return "neutral";
  return "neutral";
}

function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "active") return "success";
  if (s === "invited") return "warn";
  if (s === "disabled") return "danger";
  if (s === "removed") return "neutral";
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

function formatDate(v) {
  if (!v) return "-";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v);
  }
}

function normalizeTeamResponseUser(payload) {
  if (!payload) return null;
  if (payload?.user) return payload.user;
  return payload;
}

export default function TeamPanel({ canManage = false }) {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const users = await listTeam({
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      });
      setItems(Array.isArray(users) ? users : []);
    } catch (e) {
      setError(String(e?.message || e || "Failed to load team"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [roleFilter, statusFilter]);

  const filtered = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return items;

    return items.filter((u) => {
      const hay =
        `${u?.full_name || ""} ${u?.user_email || ""} ${u?.role || ""} ${u?.status || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, query]);

  const selected = useMemo(
    () =>
      filtered.find((x) => x.id === selectedId) ||
      items.find((x) => x.id === selectedId) ||
      null,
    [filtered, items, selectedId]
  );

  useEffect(() => {
    if (selected?.id) {
      setForm({
        user_email: selected.user_email || "",
        full_name: selected.full_name || "",
        role: selected.role || "member",
        status: selected.status || "invited",
        password: "",
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [selected?.id]);

  useEffect(() => {
    if (selectedId && !items.some((x) => x.id === selectedId)) {
      setSelectedId(filtered[0]?.id || "");
      return;
    }

    if (!selectedId && filtered[0]?.id) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, items, selectedId]);

  const dirty = useMemo(() => {
    if (!selected) {
      return JSON.stringify(form) !== JSON.stringify(EMPTY_FORM);
    }

    const base = {
      user_email: selected.user_email || "",
      full_name: selected.full_name || "",
      role: selected.role || "member",
      status: selected.status || "invited",
      password: "",
    };

    return JSON.stringify(form) !== JSON.stringify(base);
  }, [form, selected]);

  function resetCreateForm() {
    setSelectedId("");
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
  }

  async function handleCreate() {
    setCreating(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        user_email: form.user_email,
        full_name: form.full_name,
        role: form.role,
        status: form.status,
      };

      if (String(form.password || "").trim()) {
        payload.password = String(form.password || "").trim();
      }

      const res = await createTeamUser(payload);
      const user = normalizeTeamResponseUser(res);

      if (!user?.id) throw new Error("User was not created");

      setSuccess("Team user yaradıldı");
      await load();
      setSelectedId(user.id);
    } catch (e) {
      setError(String(e?.message || e || "Failed to create user"));
    } finally {
      setCreating(false);
    }
  }

  async function handleSave() {
    if (!selected?.id) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        user_email: form.user_email,
        full_name: form.full_name,
        role: form.role,
        status: form.status,
      };

      const res = await updateTeamUser(selected.id, payload);
      const user = normalizeTeamResponseUser(res);

      if (!user?.id) throw new Error("User was not updated");

      setSuccess("Team user yeniləndi");
      await load();
      setSelectedId(user.id);
    } catch (e) {
      setError(String(e?.message || e || "Failed to update user"));
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(status) {
    if (!selected?.id) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await setTeamUserStatus(selected.id, status);
      const user = normalizeTeamResponseUser(res);

      if (!user?.id) throw new Error("Status was not updated");

      setSuccess("Status yeniləndi");
      await load();
      setSelectedId(user.id);
    } catch (e) {
      setError(String(e?.message || e || "Failed to update status"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected?.id) return;

    const yes = window.confirm(
      `${selected.full_name || selected.user_email} silinsin?`
    );
    if (!yes) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await deleteTeamUser(selected.id);
      const deletedOk = !!(res?.deleted || res?.ok || res === true);

      if (!deletedOk) throw new Error("Delete failed");

      setSuccess("User silindi");
      setSelectedId("");
      await load();
    } catch (e) {
      setError(String(e?.message || e || "Failed to delete user"));
    } finally {
      setSaving(false);
    }
  }

  const activeCount = items.filter((x) => String(x?.status).toLowerCase() === "active").length;
  const invitedCount = items.filter((x) => String(x?.status).toLowerCase() === "invited").length;

  return (
    <SettingsSection
      eyebrow="Team"
      title="Team"
      subtitle="Workspace user-ları, rollar və status idarəsi bu hissədə saxlanılır."
      tone="default"
    >
      <div className="space-y-6">
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
                    Workspace üzvləri, rol paylanması və status idarəsi bu
                    paneldən aparılır.
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 lg:w-[360px]">
                <StatTile
                  label="Members"
                  value={items.length}
                  hint="Total users"
                  tone="info"
                />
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
                  Team dəyişiklikləri yalnız icazəli istifadəçilər tərəfindən aparılmalıdır.
                </div>
              </div>

              {canManage ? (
                <div className="rounded-[24px] border border-emerald-200/80 bg-emerald-50/90 px-4 py-4 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
                  Owner/Admin icazəsi aktivdir. Yeni user yaratmaq və rolları yeniləmək olar.
                </div>
              ) : (
                <div className="rounded-[24px] border border-amber-200/80 bg-amber-50/90 px-4 py-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
                  Read-only görünüşdür. Team dəyişiklikləri yalnız owner/admin üçündür.
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
                  value={[...new Set(items.map((x) => x?.role).filter(Boolean))].length}
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
                    Axtar, filtrlə və user seç.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge tone="neutral" variant="subtle">
                    {items.length} nəfər
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
                  placeholder="Axtar: ad, email, rol..."
                  leftIcon={<Search className="h-4 w-4" />}
                />

                <div className="grid grid-cols-2 gap-3">
                  <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                    <option value="">Bütün rollar</option>
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="operator">Operator</option>
                    <option value="marketer">Marketer</option>
                    <option value="analyst">Analyst</option>
                    <option value="member">Member</option>
                  </Select>

                  <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                    <option value="">Bütün statuslar</option>
                    <option value="active">Active</option>
                    <option value="invited">Invited</option>
                    <option value="disabled">Disabled</option>
                    <option value="removed">Removed</option>
                  </Select>
                </div>
              </div>

              <div className="max-h-[620px] space-y-2 overflow-auto pr-1">
                {loading ? (
                  <Card variant="subtle" padded="md" className="rounded-[22px]">
                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Yüklənir...
                    </div>
                  </Card>
                ) : filtered.length ? (
                  filtered.map((u) => {
                    const active = u.id === selectedId;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setSelectedId(u.id)}
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
                              {u.full_name || "Adsız user"}
                            </div>
                            <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                              {u.user_email}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <Badge tone={roleTone(u.role)} variant="subtle" size="sm">
                              {u.role}
                            </Badge>
                            <Badge tone={statusTone(u.status)} variant="subtle" size="sm" dot>
                              {u.status}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <Card variant="subtle" padded="md" className="rounded-[22px]">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      User tapılmadı
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
                    {selected ? "User Detail" : "Yeni Team User"}
                  </div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Rolları idarə et, statusu dəyiş və ya yeni user yarat.
                  </div>
                </div>

                {!canManage ? (
                  <Badge tone="warn" variant="subtle">
                    Read Only
                  </Badge>
                ) : null}
              </div>

              {error ? (
                <div className="rounded-[22px] border border-rose-200/80 bg-rose-50/90 px-4 py-3 text-sm text-rose-800 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200">
                  {error}
                </div>
              ) : null}

              {success ? (
                <div className="rounded-[22px] border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
                  {success}
                </div>
              ) : null}

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
                          User identity və workspace access dəyərləri.
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <Field label="Email" hint="Unique workspace email.">
                          <Input
                            value={form.user_email}
                            onChange={(e) =>
                              setForm((s) => ({ ...s, user_email: e.target.value }))
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
                              setForm((s) => ({ ...s, full_name: e.target.value }))
                            }
                            placeholder="NEOX Operator"
                            disabled={!canManage}
                          />
                        </Field>
                      </div>

                      {!selected ? (
                        <div className="md:col-span-2">
                          <Field label="Password" hint="İstəyə bağlıdır. Local login üçün təyin oluna bilər.">
                            <Input
                              type="password"
                              value={form.password}
                              onChange={(e) =>
                                setForm((s) => ({ ...s, password: e.target.value }))
                              }
                              placeholder="••••••••"
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
                            setForm((s) => ({ ...s, role: e.target.value }))
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
                            setForm((s) => ({ ...s, status: e.target.value }))
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
                          Seçilmiş user üçün status və zaman metadatası.
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
                        Soldakı siyahıdan user seç və ya yeni user yarat.
                      </div>
                    )}
                  </div>
                </Card>
              </div>

              <div className="flex flex-wrap gap-3 border-t border-slate-200/70 pt-5 dark:border-white/10">
                {!selected ? (
                  <Button
                    onClick={handleCreate}
                    disabled={!canManage || creating || !form.user_email}
                    leftIcon={<UserPlus className="h-4 w-4" />}
                  >
                    {creating ? "Yaradılır..." : "User yarat"}
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handleSave}
                      disabled={!canManage || saving || !dirty}
                    >
                      {saving ? "Yadda saxlanır..." : "Dəyişiklikləri saxla"}
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => handleStatus("active")}
                      disabled={!canManage || saving}
                    >
                      Activate
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => handleStatus("disabled")}
                      disabled={!canManage || saving}
                    >
                      Disable
                    </Button>

                    <Button
                      variant="ghost"
                      onClick={() => handleStatus("removed")}
                      disabled={!canManage || saving}
                    >
                      Remove
                    </Button>

                    <Button
                      variant="destructive"
                      onClick={handleDelete}
                      disabled={!canManage || saving}
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