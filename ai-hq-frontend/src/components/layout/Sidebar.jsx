import { AnimatePresence, motion } from "framer-motion";
import { NavLink, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import {
  PRIMARY_SECTIONS,
  UTILITY_SECTIONS,
  getActiveContextItem,
  getActiveShellSection,
} from "./shellNavigation.js";

const PRIMARY_RAIL_WIDTH = 72;
const CONTEXT_RAIL_WIDTH = 248;

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatBadgeCount(count) {
  if (typeof count !== "number" || count <= 0) return null;
  return count > 99 ? "99+" : String(count);
}

function SectionIconButton({ item, shellStats = {}, onNavigate }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      aria-label={item.label}
      onClick={onNavigate}
      className="group relative block"
    >
      {({ isActive }) => {
        const badgeCount = formatBadgeCount(shellStats?.[item.badgeKey]);

        return (
          <>
            <div
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-2xl border transition-all duration-200",
                isActive
                  ? "border-white/12 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_10px_30px_rgba(0,0,0,0.28)]"
                  : "border-transparent text-slate-400 hover:border-white/8 hover:bg-white/6 hover:text-slate-100"
              )}
            >
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
            </div>

            {badgeCount ? (
              <span className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#f3f5f7] px-1 text-[10px] font-semibold leading-none text-slate-900 shadow-[0_6px_18px_rgba(0,0,0,0.28)]">
                {badgeCount}
              </span>
            ) : null}

            <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-xl bg-[#0b1119] px-2.5 py-1.5 text-[11px] font-medium tracking-[0.02em] text-slate-100 shadow-[0_12px_28px_rgba(2,6,23,0.42)] md:group-hover:block">
              {item.label}
            </span>
          </>
        );
      }}
    </NavLink>
  );
}

function ContextNavItem({ item, onNavigate }) {
  if (!item.to) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-[13px] text-slate-500">
        <span>{item.label}</span>
        {item.hint ? (
          <span className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
            Soon
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <NavLink to={item.to} onClick={onNavigate} className="block">
      {({ isActive }) => (
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-[13px] transition-colors duration-200",
            isActive
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-900/[0.04] hover:text-slate-900"
          )}
        >
          <span>{item.label}</span>
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-opacity duration-200",
              isActive ? "bg-white opacity-100" : "bg-slate-300 opacity-0"
            )}
          />
        </div>
      )}
    </NavLink>
  );
}

function ContextRailContent({ section, pathname, onNavigate }) {
  const activeItem = getActiveContextItem(section, pathname);

  return (
    <>
      <div className="border-b border-slate-200/80 px-5 py-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          {section.kicker}
        </div>
        <h2 className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-slate-950">
          {section.label}
        </h2>
        <p className="mt-2 max-w-[24ch] text-[13px] leading-6 text-slate-500">
          {section.description}
        </p>
        {activeItem?.label ? (
          <div className="mt-4 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium tracking-[0.08em] text-slate-500">
            Active view: {activeItem.label}
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-5">
          {(section.contextGroups || []).map((group) => (
            <section key={group.title}>
              <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {group.title}
              </div>
              <div className="space-y-1">
                {(group.items || []).map((item) => (
                  <ContextNavItem
                    key={`${group.title}-${item.label}`}
                    item={item}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}

function ContextRail({ section, pathname, onNavigate }) {
  return (
    <div className="hidden h-screen w-[248px] flex-col border-r border-slate-200/80 bg-[#f7f8fa] md:flex">
      <ContextRailContent
        section={section}
        pathname={pathname}
        onNavigate={onNavigate}
      />
    </div>
  );
}

function DesktopShellSidebar({ shellStats = {}, pathname }) {
  const activeSection = getActiveShellSection(pathname);

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden md:flex"
      style={{ width: PRIMARY_RAIL_WIDTH + CONTEXT_RAIL_WIDTH }}
    >
      <div className="flex h-screen w-[72px] flex-col justify-between bg-[#0b1119] px-3 py-4 text-slate-100">
        <div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-[13px] font-semibold tracking-[0.2em] text-white">
            AI
          </div>

          <div className="mt-8 space-y-2">
            {PRIMARY_SECTIONS.map((item) => (
              <SectionIconButton
                key={item.id}
                item={item}
                shellStats={shellStats}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2 border-t border-white/8 pt-4">
          {UTILITY_SECTIONS.map((item) => (
            <SectionIconButton
              key={item.id}
              item={item}
              shellStats={shellStats}
            />
          ))}
        </div>
      </div>

      <ContextRail section={activeSection} pathname={pathname} />
    </aside>
  );
}

function MobileDrawer({ pathname, setMobileOpen, shellStats = {} }) {
  const activeSection = getActiveShellSection(pathname);

  return (
    <motion.aside
      initial={{ x: -360 }}
      animate={{ x: 0 }}
      exit={{ x: -360 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-y-0 left-0 z-[70] flex w-[320px] border-r border-slate-800 bg-[#0b1119] text-slate-100 md:hidden"
    >
      <div className="flex w-[72px] flex-col justify-between border-r border-white/8 px-3 py-4">
        <div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-[13px] font-semibold tracking-[0.2em] text-white">
            AI
          </div>
          <div className="mt-6 space-y-2">
            {PRIMARY_SECTIONS.map((item) => (
              <SectionIconButton
                key={item.id}
                item={item}
                shellStats={shellStats}
                onNavigate={() => setMobileOpen(false)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-2 border-t border-white/8 pt-4">
          {UTILITY_SECTIONS.map((item) => (
            <SectionIconButton
              key={item.id}
              item={item}
              shellStats={shellStats}
              onNavigate={() => setMobileOpen(false)}
            />
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-[#f7f8fa] text-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {activeSection.kicker}
            </div>
            <div className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
              {activeSection.label}
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

        <div className="flex min-h-0 flex-1 flex-col">
          <ContextRailContent
            section={activeSection}
            pathname={pathname}
            onNavigate={() => setMobileOpen(false)}
          />
        </div>
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
      <DesktopShellSidebar shellStats={shellStats} pathname={pathname} />

      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-[60] bg-slate-950/50 backdrop-blur-[2px] md:hidden"
              aria-label="Close navigation overlay"
            />
            <MobileDrawer
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

export { CONTEXT_RAIL_WIDTH, PRIMARY_RAIL_WIDTH };
