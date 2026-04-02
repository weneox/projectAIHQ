import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Sparkles,
  Building2,
  Users,
  Shield,
  Activity,
  LogOut,
} from "lucide-react";
import { getAdminAuthMe, logoutAdminAuth } from "../../api/adminAuth.js";
import { cx } from "../../lib/cx.js";

function NavPill({ to, icon: Icon, label }) {
  return (
    <NavLink to={to}>
      {({ isActive }) => (
        <div
          className={cx(
            "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
            isActive
              ? "bg-white/12 text-white ring-1 ring-cyan-400/20"
              : "bg-white/[0.04] text-slate-400 ring-1 ring-white/[0.06] hover:bg-white/[0.07] hover:text-white"
          )}
        >
          <Icon className={cx("h-4 w-4", isActive ? "text-cyan-300" : "text-slate-500")} />
          <span>{label}</span>
        </div>
      )}
    </NavLink>
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
    <div className="min-h-screen bg-[#05070d] text-white">
      <div className="pointer-events-none fixed inset-0 -z-[100] bg-[linear-gradient(180deg,#04060b_0%,#070b12_38%,#05070d_100%)]" />
      <div className="pointer-events-none fixed inset-0 -z-[90] bg-[radial-gradient(1200px_circle_at_0%_0%,rgba(34,211,238,0.09),transparent_24%),radial-gradient(900px_circle_at_100%_0%,rgba(99,102,241,0.08),transparent_24%),radial-gradient(1100px_circle_at_50%_100%,rgba(8,145,178,0.05),transparent_28%)]" />

      <div className="mx-auto max-w-[1860px] px-4 py-5 md:px-6 xl:px-8">
        <header className="mb-8 border-b border-white/[0.08] bg-transparent">
          <div>
            <div className="flex flex-col gap-6 px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-7">
              <div className="flex min-w-0 items-center gap-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.03] text-cyan-300">
                  <Sparkles className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Admin area
                  </div>
                  <div className="mt-1 text-[28px] font-semibold tracking-[-0.04em] text-white md:text-[34px]">
                    Administration
                  </div>
                </div>
              </div>

              <nav className="flex flex-wrap items-center gap-2">
                <NavPill to="/admin/tenants" icon={Building2} label="Workspaces" />
                <NavPill to="/admin/team" icon={Users} label="Team Access" />
                <NavPill to="/admin/secrets" icon={Shield} label="Security" />
              </nav>

              <div className="flex flex-wrap items-center gap-3">
                <div
                  className={cx(
                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1",
                    status === "active"
                      ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/20"
                      : "bg-white/[0.04] text-slate-300 ring-white/[0.08]"
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

                <button
                  type="button"
                  onClick={onLogout}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-4 py-2 text-sm font-medium text-slate-300 ring-1 ring-white/[0.08] transition-all duration-200 hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{busy ? "Signing out..." : "Sign out"}</span>
                </button>
              </div>
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
