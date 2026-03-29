import { Suspense, lazy, useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { NavLink } from "react-router-dom";
import {
  ChevronRight,
  LayoutDashboard,
  Megaphone,
  ShieldCheck,
  SlidersHorizontal,
  X,
  MessageSquareText,
} from "lucide-react";

const ExecutiveMark3D = lazy(() => import("./ExecutiveMark3D.jsx"));

const NAV_ITEMS = [
  { label: "İdarə Mərkəzi", icon: LayoutDashboard, to: "/workspace" },
  { label: "Yazışmalar", icon: MessageSquareText, to: "/inbox", badgeKey: "inboxUnread" },
  { label: "Yayım Mərkəzi", icon: Megaphone, to: "/publish" },
  { label: "Dərin İdarə", icon: SlidersHorizontal, to: "/expert" },
];

const COLLAPSED_W = 88;
const EXPANDED_W = 286;
const ICON_COL_W = 82;
const ITEM_H = 58;
const BRAND_H = 124;
const SIDEBAR_RADIUS = 32;

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function railRadiusStyle() {
  return {
    borderTopRightRadius: `${SIDEBAR_RADIUS}px`,
    borderBottomRightRadius: `${SIDEBAR_RADIUS}px`,
  };
}

function CountBadge({ count, active = false }) {
  if (typeof count !== "number" || count <= 0) return null;

  return (
    <span
      className={cn(
        "inline-flex min-w-[20px] items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none",
        active
          ? "border-[#ddc8a2] bg-[#ead8b7] text-stone-900"
          : "border-[#e5dac7] bg-[#fffaf2] text-stone-600"
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function BrandMarkFallback({ className = "" }) {
  return (
    <div
      className={cn(
        "rounded-full border border-[#ece2d2] bg-[radial-gradient(circle,rgba(255,255,255,0.92),rgba(248,243,235,0.88)_52%,transparent_74%)] shadow-[0_0_24px_rgba(186,163,120,0.12)]",
        className
      )}
      aria-hidden="true"
    />
  );
}

function SidebarSurface({ expanded }) {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{
          ...railRadiusStyle(),
          background:
            "linear-gradient(180deg, rgba(255,252,247,0.96) 0%, rgba(251,247,239,0.985) 40%, rgba(246,240,230,0.995) 100%)",
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          ...railRadiusStyle(),
          backdropFilter: expanded ? "blur(18px)" : "blur(14px)",
          WebkitBackdropFilter: expanded ? "blur(18px)" : "blur(14px)",
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          ...railRadiusStyle(),
          background: expanded
            ? `
              radial-gradient(340px circle at 0% 0%, rgba(225,208,176,0.35), transparent 36%),
              radial-gradient(260px circle at 100% 10%, rgba(255,255,255,0.6), transparent 28%),
              linear-gradient(180deg, rgba(255,255,255,0.32), transparent 28%)
            `
            : `
              radial-gradient(280px circle at 0% 0%, rgba(225,208,176,0.24), transparent 36%),
              radial-gradient(220px circle at 100% 12%, rgba(255,255,255,0.42), transparent 26%),
              linear-gradient(180deg, rgba(255,255,255,0.22), transparent 26%)
            `,
        }}
      />

      <div
        className="absolute inset-0 ring-1 ring-[#eadfcf]"
        style={railRadiusStyle()}
      />

      <div
        className="absolute inset-0"
        style={{
          ...railRadiusStyle(),
          boxShadow:
            "0 24px 60px rgba(120,102,73,0.10), inset 0 1px 0 rgba(255,255,255,0.72), inset -1px 0 0 rgba(226,213,193,0.5)",
        }}
      />

      <div className="pointer-events-none absolute left-0 top-0 h-full w-px bg-[linear-gradient(180deg,transparent,rgba(194,177,151,0.22),transparent)]" />
      <div className="pointer-events-none absolute right-0 top-[18px] h-[160px] w-px bg-[linear-gradient(180deg,rgba(194,177,151,0.24),rgba(194,177,151,0.05),transparent)]" />
    </>
  );
}

function ItemGlow({ isActive }) {
  return (
    <>
      <div
        className={cn(
          "pointer-events-none absolute left-[12px] top-1/2 h-[30px] w-[3px] -translate-y-1/2 rounded-full transition-all duration-300",
          isActive ? "opacity-100" : "opacity-0"
        )}
        style={{
          background: isActive
            ? "linear-gradient(180deg, rgba(214,188,143,0) 0%, rgba(214,188,143,0.95) 46%, rgba(214,188,143,0) 100%)"
            : "transparent",
          boxShadow: isActive ? "0 0 16px rgba(214,188,143,0.18)" : "none",
        }}
      />

      <div
        className={cn(
          "pointer-events-none absolute inset-y-[8px] left-[12px] right-[12px] rounded-[18px] transition-all duration-300",
          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        style={{
          background: isActive
            ? "linear-gradient(90deg, rgba(255,255,255,0.64) 0%, rgba(248,242,233,0.94) 42%, rgba(255,255,255,0.0) 100%)"
            : "linear-gradient(90deg, rgba(255,255,255,0.40) 0%, rgba(248,242,233,0.54) 42%, rgba(255,255,255,0.0) 100%)",
        }}
      />
    </>
  );
}

function BrandDock({ expanded }) {
  return (
    <div className="relative" style={{ height: BRAND_H }}>
      <div className="pointer-events-none absolute bottom-0 left-[14px] right-[16px] h-px bg-[linear-gradient(90deg,transparent,rgba(199,181,153,0.34),transparent)]" />

      <div className="relative flex h-full items-center overflow-hidden">
        <div
          className="relative z-[2] flex h-full shrink-0 items-center justify-center"
          style={{ width: ICON_COL_W }}
        >
          <div className="relative flex items-center justify-center">
            <div className="absolute h-[64px] w-[64px] rounded-full bg-[radial-gradient(circle,rgba(228,212,182,0.28),rgba(228,212,182,0.06)_48%,transparent_72%)] blur-[10px]" />
            <Suspense
              fallback={<BrandMarkFallback className="relative h-[38px] w-[38px]" />}
            >
              <ExecutiveMark3D className="relative h-[38px] w-[38px]" />
            </Suspense>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, x: -10, filter: "blur(8px)" }}
              animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, x: -10, filter: "blur(8px)" }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-[2] -ml-[2px] min-w-0 flex-1 pr-4"
            >
              <div className="min-w-0">
                <div className="truncate text-[9px] font-semibold uppercase tracking-[0.34em] text-stone-400">
                  AI HEADQUARTERS
                </div>

                <div className="mt-[7px] truncate text-[17px] font-semibold tracking-[-0.05em] text-stone-900">
                  İdarə Mərkəzi
                </div>

                <div className="mt-[11px] flex items-center gap-2.5">
                  <span className="h-[5px] w-[5px] rounded-full bg-amber-500/80 shadow-[0_0_12px_rgba(217,188,132,0.30)]" />
                  <span className="truncate text-[10px] font-medium tracking-[0.02em] text-stone-500">
                    Əsas iş səthləri və dərin idarə
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function shellCount(item, shellStats = {}) {
  if (!item.badgeKey) return null;
  const rawBadgeCount = shellStats?.[item.badgeKey];
  return typeof rawBadgeCount === "number" ? rawBadgeCount : null;
}

function NavItem({ item, expanded, onNavigate, shellStats = {} }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      onClick={onNavigate}
      className="group relative block"
    >
      {({ isActive }) => (
        <div className="relative flex items-center overflow-hidden" style={{ height: ITEM_H }}>
          <ItemGlow isActive={isActive} />

          <div
            className="relative z-[2] flex h-full shrink-0 items-center justify-center"
            style={{ width: ICON_COL_W }}
          >
            <Icon
              className={cn(
                "relative z-[2] transition-all duration-300",
                isActive
                  ? "h-[17px] w-[17px] text-stone-900"
                  : "h-[16px] w-[16px] text-stone-400 group-hover:text-stone-700"
              )}
              strokeWidth={1.9}
            />
          </div>

          <div
            className={cn(
              "relative z-[2] min-w-0 flex-1 pr-3 transition-all duration-300",
              expanded
                ? "pointer-events-auto translate-x-0 opacity-100"
                : "pointer-events-none -translate-x-2 opacity-0"
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <span
                className={cn(
                  "truncate text-[13px] font-medium tracking-[-0.015em] transition-colors duration-300",
                  isActive
                    ? "text-stone-900"
                    : "text-stone-600 group-hover:text-stone-900"
                )}
              >
                {item.label}
              </span>

              <div className="flex items-center gap-2">
                <CountBadge count={shellCount(item, shellStats)} active={isActive} />
                <ChevronRight
                  className={cn(
                    "h-[12px] w-[12px] shrink-0 transition-all duration-300",
                    isActive
                      ? "translate-x-[1px] text-stone-300"
                      : "text-stone-300 group-hover:translate-x-0.5 group-hover:text-stone-500"
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </NavLink>
  );
}

function RailNav({
  expanded,
  onNavigate,
  shellStats = {},
}) {
  return (
    <nav className="px-0 pt-5">
      <div className="space-y-1.5">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.to}
            item={item}
            expanded={expanded}
            onNavigate={onNavigate}
            shellStats={shellStats}
          />
        ))}
      </div>
    </nav>
  );
}

function RailFooter({ expanded }) {
  return (
    <div className="px-0 pb-6 pt-6">
      <div className="mx-[14px] mb-2 h-px bg-[linear-gradient(90deg,transparent,rgba(199,181,153,0.34),transparent)]" />

      <div className="relative flex h-[60px] items-center overflow-hidden">
        <div
          className="relative z-[2] flex h-full shrink-0 items-center justify-center"
          style={{ width: ICON_COL_W }}
        >
          <div className="relative flex items-center justify-center">
            <div className="absolute h-[34px] w-[34px] rounded-full bg-[radial-gradient(circle,rgba(199,223,196,0.28),rgba(199,223,196,0.08)_50%,transparent_72%)] blur-[8px]" />
            <ShieldCheck
              className="relative z-[2] h-[15px] w-[15px] text-stone-600"
              strokeWidth={1.9}
            />
            <span className="absolute right-[-4px] top-[-2px] z-[3] h-[6px] w-[6px] rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(110,231,183,0.50)]" />
          </div>
        </div>

        <div
          className={cn(
            "relative z-[2] min-w-0 flex-1 pr-3 transition-all duration-300",
            expanded
              ? "pointer-events-auto translate-x-0 opacity-100"
              : "pointer-events-none -translate-x-2 opacity-0"
          )}
        >
          <div className="truncate text-[9.5px] uppercase tracking-[0.24em] text-stone-400">
            Core Product
          </div>
          <div className="truncate pt-0.5 text-[10.5px] text-stone-500">
            Dörd əsas iş səthi
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopSidebar({
  expanded,
  setExpanded,
  shellStats = {},
}) {
  const shouldReduceMotion = useReducedMotion();
  const openTimer = useRef(null);
  const closeTimer = useRef(null);

  useEffect(() => {
    return () => {
      clearTimeout(openTimer.current);
      clearTimeout(closeTimer.current);
    };
  }, []);

  const handleEnter = () => {
    clearTimeout(closeTimer.current);
    openTimer.current = setTimeout(() => setExpanded(true), 40);
  };

  const handleLeave = () => {
    clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => setExpanded(false), 110);
  };

  return (
    <aside
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className="fixed left-0 top-0 z-[130] hidden md:block"
      style={{
        height: "100vh",
        ...railRadiusStyle(),
      }}
    >
      <motion.div
        animate={{ width: expanded ? EXPANDED_W : COLLAPSED_W }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { duration: 0.34, ease: [0.22, 1, 0.36, 1] }
        }
        className="relative h-full overflow-hidden transform-gpu"
        style={{
          width: COLLAPSED_W,
          willChange: "width",
          ...railRadiusStyle(),
        }}
      >
        <SidebarSurface expanded={expanded} />

        <div className="relative flex h-full flex-col">
          <BrandDock expanded={expanded} />
          <RailNav
            expanded={expanded}
            onNavigate={() => {}}
            shellStats={shellStats}
          />
          <div className="mt-auto">
            <RailFooter expanded={expanded} />
          </div>
        </div>
      </motion.div>
    </aside>
  );
}

function MobileNavItem({ item, onNavigate, shellStats = {} }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      onClick={onNavigate}
      className="group relative block"
    >
      {({ isActive }) => (
        <div className="relative flex h-[58px] items-center overflow-hidden">
          <ItemGlow isActive={isActive} />

          <div
            className="relative z-[2] flex h-full shrink-0 items-center justify-center"
            style={{ width: ICON_COL_W }}
          >
            <Icon
              className={cn(
                "relative z-[2] transition-all duration-300",
                isActive
                  ? "h-[17px] w-[17px] text-stone-900"
                  : "h-[16px] w-[16px] text-stone-400 group-hover:text-stone-700"
              )}
              strokeWidth={1.9}
            />
          </div>

          <div className="relative z-[2] min-w-0 flex-1 pr-3">
            <div className="flex items-center justify-between gap-3">
              <span
                className={cn(
                  "truncate text-[13px] font-medium tracking-[-0.015em] transition-colors duration-300",
                  isActive
                    ? "text-stone-900"
                    : "text-stone-600 group-hover:text-stone-900"
                )}
              >
                {item.label}
              </span>

              <div className="flex items-center gap-2">
                <CountBadge count={shellCount(item, shellStats)} active={isActive} />
                <ChevronRight
                  className={cn(
                    "h-[12px] w-[12px] shrink-0 transition-all duration-300",
                    isActive
                      ? "translate-x-[1px] text-stone-300"
                      : "text-stone-300 group-hover:translate-x-0.5 group-hover:text-stone-500"
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </NavLink>
  );
}

function MobileSidebar({
  setMobileOpen,
  shellStats = {},
}) {
  return (
    <motion.aside
      initial={{ x: -300 }}
      animate={{ x: 0 }}
      exit={{ x: -300 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className="fixed inset-y-0 left-0 z-[160] w-[286px] md:hidden"
      style={railRadiusStyle()}
    >
      <div className="relative h-full overflow-hidden" style={railRadiusStyle()}>
        <SidebarSurface expanded />

        <div className="relative flex items-center justify-end px-4 pb-2 pt-4">
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar"
            className="flex h-9 w-9 items-center justify-center rounded-[12px] text-stone-600 transition hover:bg-white/70 hover:text-stone-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative flex h-[calc(100%-60px)] flex-col">
          <BrandDock expanded />
          <nav className="px-0 pt-3">
            <div className="space-y-1.5">
              {NAV_ITEMS.map((item) => (
                <MobileNavItem
                  key={item.to}
                  item={item}
                  onNavigate={() => setMobileOpen(false)}
                  shellStats={shellStats}
                />
              ))}
            </div>
          </nav>
          <div className="mt-auto">
            <RailFooter expanded />
          </div>
        </div>
      </div>
    </motion.aside>
  );
}

export default function Sidebar({
  expanded,
  setExpanded,
  mobileOpen,
  setMobileOpen,
  shellStats = {},
}) {
  return (
    <>
      <DesktopSidebar
        expanded={expanded}
        setExpanded={setExpanded}
        shellStats={shellStats}
      />

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-[150] bg-stone-900/18 backdrop-blur-[4px] md:hidden"
            />
            <MobileSidebar
              setMobileOpen={setMobileOpen}
              shellStats={shellStats}
            />
          </>
        )}
      </AnimatePresence>
    </>
  );
}
