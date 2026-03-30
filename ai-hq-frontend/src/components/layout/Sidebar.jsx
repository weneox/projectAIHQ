import { AnimatePresence, motion } from "framer-motion";
import { NavLink, useLocation } from "react-router-dom";
import { Moon, Settings2, X } from "lucide-react";
import { PRIMARY_SECTIONS, UTILITY_SECTIONS } from "./shellNavigation.js";

const SIDEBAR_WIDTH = 184;

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatBadgeCount(count) {
  if (typeof count !== "number" || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-4 py-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#7dd3fc_0%,#fca5a5_45%,#c4b5fd_100%)] shadow-[0_8px_20px_rgba(15,23,42,0.12)]">
        <div className="h-6 w-6 rounded-md border border-white/80 bg-white/90" />
      </div>
      <div className="text-[18px] font-semibold tracking-[-0.04em] text-slate-950">
        AI-HQ
      </div>
    </div>
  );
}

function NavItem({ item, shellStats = {}, onNavigate }) {
  const Icon = item.icon;
  const badgeCount = formatBadgeCount(shellStats?.[item.badgeKey]);

  return (
    <NavLink to={item.to} onClick={onNavigate} className="block">
      {({ isActive }) => (
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-[15px] transition",
            isActive
              ? "bg-[#eef0f3] text-slate-950"
              : "text-slate-600 hover:bg-[#f5f6f8] hover:text-slate-950"
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <Icon className="h-[17px] w-[17px] shrink-0" strokeWidth={1.85} />
            <span className="truncate">{item.label}</span>
          </div>

          {badgeCount ? (
            <span className="inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-slate-900 px-1.5 text-[10px] font-semibold text-white">
              {badgeCount}
            </span>
          ) : null}
        </div>
      )}
    </NavLink>
  );
}

function DesktopSidebar({ shellStats }) {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden border-r border-slate-200/80 bg-[#f8f8f9] md:flex md:flex-col"
      style={{ width: SIDEBAR_WIDTH }}
    >
      <Brand />

      <div className="flex-1 px-3 pb-4 pt-2">
        <div className="space-y-1">
          {PRIMARY_SECTIONS.map((item) => (
            <NavItem key={item.id} item={item} shellStats={shellStats} />
          ))}
        </div>
      </div>

      <div className="border-t border-slate-200/80 px-3 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
            N
          </div>

          <div className="flex items-center gap-1">
            {UTILITY_SECTIONS.slice(0, 1).map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.id}
                  to={item.to}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-[#f0f2f5] hover:text-slate-950"
                >
                  <Icon className="h-4 w-4" strokeWidth={1.85} />
                </NavLink>
              );
            })}

            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-[#f0f2f5] hover:text-slate-950"
            >
              <Moon className="h-4 w-4" strokeWidth={1.85} />
            </button>

            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-[#f0f2f5] hover:text-slate-950"
            >
              <Settings2 className="h-4 w-4" strokeWidth={1.85} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function MobileSidebar({ pathname, setMobileOpen, shellStats = {} }) {
  return (
    <motion.aside
      initial={{ x: -260 }}
      animate={{ x: 0 }}
      exit={{ x: -260 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-y-0 left-0 z-[70] flex w-[280px] flex-col border-r border-slate-200/80 bg-[#f8f8f9] md:hidden"
    >
      <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#7dd3fc_0%,#fca5a5_45%,#c4b5fd_100%)]">
            <div className="h-5 w-5 rounded-md border border-white/80 bg-white/90" />
          </div>
          <div className="text-[18px] font-semibold tracking-[-0.04em] text-slate-950">
            AI-HQ
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 px-3 py-4">
        <div className="space-y-1">
          {PRIMARY_SECTIONS.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              shellStats={shellStats}
              onNavigate={() => setMobileOpen(false)}
            />
          ))}
        </div>
      </div>

      <div className="border-t border-slate-200/80 px-3 py-4">
        <div className="text-xs text-slate-400">{pathname}</div>
      </div>
    </motion.aside>
  );
}

export default function Sidebar({
  mobileOpen,
  setMobileOpen,
  shellStats = {},
}) {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <>
      <DesktopSidebar shellStats={shellStats} />

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-[60] bg-slate-950/30 backdrop-blur-[2px] md:hidden"
              aria-label="Close navigation overlay"
            />
            <MobileSidebar
              pathname={pathname}
              setMobileOpen={setMobileOpen}
              shellStats={shellStats}
            />
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

export { SIDEBAR_WIDTH };