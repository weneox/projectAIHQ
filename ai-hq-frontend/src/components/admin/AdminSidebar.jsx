import { NavLink } from "react-router-dom";
import {
  ShieldCheck,
  Building2,
  Users,
  KeyRound,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { cx } from "../../lib/cx.js";
import { logoutAdminAuth } from "../../api/adminAuth.js";

function navItemClass(active) {
  return cx(
    "group relative flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition-all duration-200",
    active
      ? "bg-white/[0.07] text-white"
      : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
  );
}

function navIconClass(active) {
  return cx(
    "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200",
    active
      ? "bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/20"
      : "bg-white/[0.04] text-slate-400 group-hover:bg-white/[0.07] group-hover:text-slate-200"
  );
}

function AdminNavItem({ to, icon: Icon, label, hint }) {
  return (
    <NavLink to={to}>
      {({ isActive }) => (
        <div className={navItemClass(isActive)}>
          {isActive ? (
            <div className="absolute left-0 top-2 bottom-2 w-px rounded-full bg-cyan-300/80" />
          ) : null}

          <div className={navIconClass(isActive)}>
            <Icon className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{label}</div>
            {hint ? (
              <div className="mt-0.5 truncate text-xs text-slate-500 group-hover:text-slate-400">
                {hint}
              </div>
            ) : null}
          </div>

          <ChevronRight
            className={cx(
              "h-4 w-4 transition-all duration-200",
              isActive
                ? "translate-x-0 text-cyan-200"
                : "translate-x-[-2px] text-slate-600 group-hover:translate-x-0 group-hover:text-slate-400"
            )}
          />
        </div>
      )}
    </NavLink>
  );
}

export default function AdminSidebar() {
  return (
    <aside className="hidden xl:flex xl:w-[292px] xl:shrink-0 xl:flex-col">
      <div className="m-4 flex h-[calc(100vh-32px)] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03] shadow-[0_10px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/20 via-cyan-300/10 to-transparent ring-1 ring-white/10">
              <ShieldCheck className="h-5 w-5 text-cyan-200" />
            </div>

            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Administration
              </div>
              <div className="mt-1 text-base font-semibold text-white">
                Platform Control
              </div>
              <div className="mt-1 text-sm text-slate-400">
                Manage workspaces, users, and security settings.
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 px-3 py-4">
          <div className="px-2 pb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Workspace Settings
          </div>

          <div className="space-y-1.5">
            <AdminNavItem
              to="/admin/tenants"
              icon={Building2}
              label="Workspaces"
              hint="Create and manage company access"
            />

            <AdminNavItem
              to="/admin/team"
              icon={Users}
              label="Team Access"
              hint="Manage users, roles, and passwords"
            />

            <AdminNavItem
              to="/admin/secrets"
              icon={KeyRound}
              label="Security"
              hint="Protect keys and internal settings"
            />
          </div>
        </div>

        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() =>
              logoutAdminAuth()
                .then(() => {
                  window.location.href = "/admin/login";
                })
                .catch((e) => alert(String(e?.message || e)))
            }
            className="group flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium text-slate-400 transition-all duration-200 hover:bg-white/[0.04] hover:text-white"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] text-slate-400 transition-all duration-200 group-hover:bg-white/[0.07] group-hover:text-slate-200">
              <LogOut className="h-4 w-4" />
            </div>

            <div className="flex-1 text-left">
              <div className="text-sm font-medium">Sign out</div>
              <div className="text-xs text-slate-500 group-hover:text-slate-400">
                End current admin session
              </div>
            </div>
          </button>
        </div>
      </div>
    </aside>
  );
}