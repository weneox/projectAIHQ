import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Activity,
  Building2,
  LogOut,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { getAdminAuthMe, logoutAdminAuth } from "../../api/adminAuth.js";
import { cx } from "../../lib/cx.js";

function AdminNavItem({ to, icon: Icon, label }) {
  return (
    <NavLink to={to}>
      {({ isActive }) => (
        <div
          className={cx(
            "inline-flex h-10 items-center gap-2 rounded-soft border px-3.5 text-[13px] font-semibold tracking-[-0.01em] transition-[background-color,border-color,color,box-shadow] duration-base ease-premium",
            isActive
              ? "border-[rgba(var(--color-brand),0.18)] bg-brand-soft text-brand shadow-[0_1px_0_rgba(255,255,255,0.86)_inset]"
              : "border-line bg-surface text-text-muted hover:border-line-strong hover:bg-surface-muted hover:text-text"
          )}
        >
          <Icon className="h-4 w-4" />
          <span>{label}</span>
        </div>
      )}
    </NavLink>
  );
}

function StatusChip({ status = "checking" }) {
  const active = status === "active";

  return (
    <div
      className={cx(
        "inline-flex h-10 items-center gap-2 rounded-soft border px-3.5 text-[13px] font-semibold tracking-[-0.01em]",
        active
          ? "border-[rgba(var(--color-success),0.18)] bg-success-soft text-success"
          : "border-line bg-surface text-text-muted"
      )}
    >
      <Activity className="h-4 w-4" />
      <span>
        {status === "checking"
          ? "Checking session"
          : status === "active"
            ? "Session active"
            : status === "guest"
              ? "Not signed in"
              : "Status unavailable"}
      </span>
    </div>
  );
}

export default function AdminShell() {
  const [status, setStatus] = useState("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;

    getAdminAuthMe()
      .then((j) => {
        if (!alive) return;
        setStatus(j?.authenticated ? "active" : "guest");
      })
      .catch(() => {
        if (!alive) return;
        setStatus("unknown");
      });

    return () => {
      alive = false;
    };
  }, []);

  async function onLogout() {
    setBusy(true);
    try {
      await logoutAdminAuth();
      window.location.href = "/admin/login";
    } catch (e) {
      alert(String(e?.message || e));
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-text">
      <div className="pointer-events-none fixed inset-0 -z-[1] overflow-hidden">
        <div className="absolute left-[-10%] top-[-14%] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(46,96,255,0.10)_0%,rgba(46,96,255,0.03)_48%,rgba(46,96,255,0)_72%)] blur-3xl" />
        <div className="absolute right-[-12%] top-[6%] h-[280px] w-[280px] rounded-full bg-[radial-gradient(circle,rgba(15,23,42,0.08)_0%,rgba(15,23,42,0.02)_52%,rgba(15,23,42,0)_74%)] blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-shell-content px-5 py-5 md:px-6">
        <header className="mb-6 border-b border-line-soft pb-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-pill border border-line-soft bg-surface px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
                <Sparkles className="h-3.5 w-3.5 text-brand" />
                <span>Admin</span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h1 className="text-[1.9rem] font-semibold leading-[0.98] tracking-[-0.05em] text-text">
                  Administration
                </h1>

                <StatusChip status={status} />
              </div>

              <p className="mt-2 max-w-[720px] text-[14px] leading-6 text-text-muted">
                Workspace access, team visibility, and security controls.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <AdminNavItem
                to="/admin/tenants"
                icon={Building2}
                label="Workspaces"
              />
              <AdminNavItem
                to="/admin/team"
                icon={Users}
                label="Team Access"
              />
              <AdminNavItem
                to="/admin/secrets"
                icon={Shield}
                label="Security"
              />

              <button
                type="button"
                onClick={onLogout}
                disabled={busy}
                className={cx(
                  "inline-flex h-10 items-center gap-2 rounded-soft border px-3.5 text-[13px] font-semibold tracking-[-0.01em] transition-[background-color,border-color,color] duration-base ease-premium",
                  "border-line bg-surface text-text-muted hover:border-line-strong hover:bg-surface-muted hover:text-text",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                <LogOut className="h-4 w-4" />
                <span>{busy ? "Signing out..." : "Sign out"}</span>
              </button>
            </div>
          </div>
        </header>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}