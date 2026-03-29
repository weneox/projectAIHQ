import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { NavLink } from "react-router-dom";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  ChevronRight,
  FolderCog,
  ShieldCheck,
  SlidersHorizontal,
  X,
  MessageSquareText,
  ScrollText,
} from "lucide-react";
import OperationsPanel from "./OperationsPanel.jsx";

const ExecutiveMark3D = lazy(() => import("./ExecutiveMark3D.jsx"));

const NAV_ITEMS = [
  { label: "Setup Studio", icon: BriefcaseBusiness, to: "/setup/studio" },
  { label: "Business Truth", icon: ScrollText, to: "/truth" },
  { label: "Inbox", icon: MessageSquareText, to: "/inbox", badgeKey: "inboxUnread" },
  { label: "Settings", icon: SlidersHorizontal, to: "/settings" },
];

const COLLAPSED_W = 88;
const EXPANDED_W = 286;
const ICON_COL_W = 82;
const ITEM_H = 58;
const BRAND_H = 118;
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
          ? "border-cyan-300/20 bg-cyan-300/90 text-slate-900"
          : "border-white/10 bg-white/[0.06] text-white/82"
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
        "rounded-full border border-white/18 bg-[radial-gradient(circle,rgba(255,255,255,0.22),rgba(255,255,255,0.05)_52%,transparent_74%)] shadow-[0_0_24px_rgba(125,211,252,0.12)]",
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
            "linear-gradient(180deg, rgba(4,10,20,0.96) 0%, rgba(3,8,18,0.985) 38%, rgba(2,6,15,0.995) 72%, rgba(1,5,12,0.998) 100%)",
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          ...railRadiusStyle(),
          backdropFilter: expanded ? "blur(16px)" : "blur(12px)",
          WebkitBackdropFilter: expanded ? "blur(16px)" : "blur(12px)",
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          ...railRadiusStyle(),
          background: expanded
            ? `
              radial-gradient(340px circle at 0% 0%, rgba(114, 233, 255, 0.08), transparent 34%),
              radial-gradient(280px circle at 18% 22%, rgba(76, 139, 255, 0.06), transparent 40%),
              radial-gradient(260px circle at 100% 12%, rgba(255,255,255,0.035), transparent 26%),
              linear-gradient(180deg, rgba(255,255,255,0.024), transparent 22%)
            `
            : `
              radial-gradient(280px circle at 0% 0%, rgba(114, 233, 255, 0.06), transparent 34%),
              radial-gradient(220px circle at 18% 22%, rgba(76, 139, 255, 0.045), transparent 40%),
              radial-gradient(220px circle at 100% 12%, rgba(255,255,255,0.028), transparent 24%),
              linear-gradient(180deg, rgba(255,255,255,0.016), transparent 20%)
            `,
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.085]"
        style={{
          ...railRadiusStyle(),
          backgroundImage: `
            repeating-linear-gradient(
              180deg,
              rgba(255,255,255,0.08) 0px,
              rgba(255,255,255,0.08) 1px,
              transparent 1px,
              transparent 4px
            )
          `,
          mixBlendMode: "soft-light",
        }}
      />

      <div
        className="absolute inset-0 ring-1 ring-white/[0.05]"
        style={railRadiusStyle()}
      />

      <div
        className="absolute inset-0"
        style={{
          ...railRadiusStyle(),
          boxShadow:
            "0 24px 80px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.045), inset -1px 0 0 rgba(255,255,255,0.04)",
        }}
      />

      <div className="pointer-events-none absolute left-0 top-0 h-full w-px bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.035),transparent)]" />

      <div className="pointer-events-none absolute right-0 top-[14px] h-[160px] w-px bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.015),transparent)]" />

      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 transition-all duration-300",
          expanded ? "w-[68px]" : "w-[42px]"
        )}
        style={{
          ...railRadiusStyle(),
          background: expanded
            ? "linear-gradient(270deg, rgba(255,255,255,0.065) 0%, rgba(105,235,255,0.024) 18%, rgba(255,255,255,0.012) 34%, transparent 82%)"
            : "linear-gradient(270deg, rgba(255,255,255,0.05) 0%, rgba(105,235,255,0.02) 16%, rgba(255,255,255,0.008) 30%, transparent 80%)",
        }}
      />

      <div
        className={cn(
          "pointer-events-none absolute right-[-18px] top-[76px] transition-all duration-300",
          expanded ? "h-[220px] w-[92px]" : "h-[160px] w-[56px]"
        )}
        style={{
          background:
            "radial-gradient(circle at 0% 50%, rgba(111, 238, 255, 0.08), rgba(111, 238, 255, 0.02) 34%, transparent 70%)",
          filter: "blur(18px)",
        }}
      />

      <div
        className="pointer-events-none absolute inset-y-0 -right-10 w-16"
        style={{
          background:
            "linear-gradient(90deg, rgba(4,9,18,0.0), rgba(4,9,18,0.22) 35%, rgba(4,9,18,0.0) 100%)",
          filter: "blur(10px)",
        }}
      />
    </>
  );
}

function ItemGlow({ isActive }) {
  return (
    <>
      <div
        className={cn(
          "pointer-events-none absolute left-[12px] top-1/2 h-[30px] w-[3px] -translate-y-1/2 rounded-full transition-all duration-300",
          isActive
            ? "opacity-100 shadow-[0_0_16px_rgba(110,241,255,0.16)]"
            : "opacity-0"
        )}
        style={{
          background: isActive
            ? "linear-gradient(180deg, rgba(155,243,255,0) 0%, rgba(155,243,255,0.96) 44%, rgba(124,211,252,0.42) 78%, rgba(155,243,255,0) 100%)"
            : "transparent",
        }}
      />

      <div
        className={cn(
          "pointer-events-none absolute left-[18px] top-1/2 h-[44px] w-[44px] -translate-y-1/2 rounded-full transition-all duration-300",
          isActive
            ? "opacity-100 blur-[8px]"
            : "opacity-0 group-hover:opacity-100 group-hover:blur-[7px]"
        )}
        style={{
          background: isActive
            ? "radial-gradient(circle, rgba(110,241,255,0.12), rgba(110,241,255,0.03) 46%, transparent 76%)"
            : "radial-gradient(circle, rgba(255,255,255,0.05), rgba(255,255,255,0.014) 46%, transparent 76%)",
        }}
      />

      <div
        className={cn(
          "pointer-events-none absolute inset-y-[8px] left-[12px] right-[12px] rounded-[18px] transition-all duration-300",
          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
        style={{
          background: isActive
            ? "linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.012) 34%, rgba(255,255,255,0.0) 80%)"
            : "linear-gradient(90deg, rgba(255,255,255,0.014) 0%, rgba(255,255,255,0.006) 34%, rgba(255,255,255,0.0) 82%)",
        }}
      />
    </>
  );
}

function BrandDock({ expanded }) {
  return (
    <div className="relative" style={{ height: BRAND_H }}>
      <div className="pointer-events-none absolute bottom-0 left-[14px] right-[16px] h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)]" />

      <div className="relative flex h-full items-center overflow-hidden">
        <div
          className="relative z-[2] flex h-full shrink-0 items-center justify-center"
          style={{ width: ICON_COL_W }}
        >
          <div className="relative flex items-center justify-center">
            <div className="absolute h-[64px] w-[64px] rounded-full bg-[radial-gradient(circle,rgba(110,241,255,0.05),rgba(110,241,255,0.014)_46%,transparent_72%)] blur-[10px]" />
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
                <div className="truncate text-[9px] font-semibold uppercase tracking-[0.34em] text-white/42">
                  AI HEADQUARTERS
                </div>

                <div className="mt-[7px] truncate text-[17px] font-semibold tracking-[-0.05em] text-white/96">
                  Truth Control Plane
                </div>

                <div className="mt-[11px] flex items-center gap-2.5">
                  <span className="h-[5px] w-[5px] rounded-full bg-cyan-200/80 shadow-[0_0_12px_rgba(165,243,252,0.28)]" />
                  <span className="truncate text-[10px] font-medium tracking-[0.02em] text-white/54">
                    Approved truth and operator workflows
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
                  ? "h-[17px] w-[17px] text-white"
                  : "h-[16px] w-[16px] text-white/54 group-hover:text-white/82"
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
                    ? "text-white/96"
                    : "text-white/68 group-hover:text-white/86"
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
                      ? "translate-x-[1px] text-white/18"
                      : "text-white/10 group-hover:translate-x-0.5 group-hover:text-white/18"
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

function shellCount(item, shellStats = {}) {
  if (!item.badgeKey) return null;
  const rawBadgeCount = shellStats?.[item.badgeKey];
  return typeof rawBadgeCount === "number" ? rawBadgeCount : null;
}

function OperationsLauncher({ expanded, onOpen, leadCount = null }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block w-full text-left"
    >
      <div className="relative flex items-center overflow-hidden" style={{ height: ITEM_H }}>
        <ItemGlow isActive={false} />

        <div
          className="relative z-[2] flex h-full shrink-0 items-center justify-center"
          style={{ width: ICON_COL_W }}
        >
          <FolderCog
            className="h-[16px] w-[16px] text-white/54 transition-all duration-300 group-hover:text-white/82"
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
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium tracking-[-0.015em] text-white/68 group-hover:text-white/86">
                Operations
              </div>
              <div className="truncate pt-1 text-[11px] text-white/36">
                Secondary operator tools
              </div>
            </div>

            <div className="flex items-center gap-2">
              <CountBadge count={leadCount} />
              <ArrowUpRight className="h-[12px] w-[12px] text-white/12 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-white/20" />
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

function RailNav({
  expanded,
  onNavigate,
  onOpenOperations,
  shellStats = {},
}) {
  return (
    <nav className="px-0 pt-4">
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

      <div className="mx-[14px] pt-2">
        <div className="h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.05),transparent)]" />
      </div>

      <div className="pt-2">
        <OperationsLauncher
          expanded={expanded}
          onOpen={onOpenOperations}
          leadCount={shellStats?.leadsOpen}
        />
      </div>
    </nav>
  );
}

function RailFooter({ expanded }) {
  return (
    <div className="px-0 pb-5 pt-5">
      <div className="mx-[14px] mb-2 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.05),transparent)]" />

      <div className="relative flex h-[60px] items-center overflow-hidden">
        <div
          className="relative z-[2] flex h-full shrink-0 items-center justify-center"
          style={{ width: ICON_COL_W }}
        >
          <div className="relative flex items-center justify-center">
            <div className="absolute h-[34px] w-[34px] rounded-full bg-[radial-gradient(circle,rgba(110,231,183,0.08),rgba(110,231,183,0.02)_50%,transparent_72%)] blur-[8px]" />
            <ShieldCheck
              className="relative z-[2] h-[15px] w-[15px] text-white/74"
              strokeWidth={1.9}
            />
            <span className="absolute right-[-4px] top-[-2px] z-[3] h-[6px] w-[6px] rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.56)]" />
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
          <div className="truncate text-[9.5px] uppercase tracking-[0.24em] text-white/34">
            Core Product
          </div>
          <div className="truncate pt-0.5 text-[10.5px] text-white/56">
            Truth-governed workspace
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
  onOpenOperations,
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
            onOpenOperations={onOpenOperations}
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
                  ? "h-[17px] w-[17px] text-white"
                  : "h-[16px] w-[16px] text-white/54 group-hover:text-white/82"
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
                    ? "text-white/96"
                    : "text-white/68 group-hover:text-white/86"
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
                      ? "translate-x-[1px] text-white/18"
                      : "text-white/10 group-hover:translate-x-0.5 group-hover:text-white/18"
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
  onOpenOperations,
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
            className="flex h-9 w-9 items-center justify-center rounded-[12px] text-white/78 transition hover:bg-white/[0.05] hover:text-white"
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
              <div className="mx-[14px] pt-2">
                <div className="h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.05),transparent)]" />
              </div>
              <OperationsLauncher
                expanded
                onOpen={() => {
                  setMobileOpen(false);
                  onOpenOperations();
                }}
                leadCount={shellStats?.leadsOpen}
              />
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
  const [operationsOpen, setOperationsOpen] = useState(false);

  return (
    <>
      <DesktopSidebar
        expanded={expanded}
        setExpanded={setExpanded}
        shellStats={shellStats}
        onOpenOperations={() => setOperationsOpen(true)}
      />

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-[6px] md:hidden"
            />
            <MobileSidebar
              setMobileOpen={setMobileOpen}
              shellStats={shellStats}
              onOpenOperations={() => setOperationsOpen(true)}
            />
          </>
        )}
      </AnimatePresence>

      <OperationsPanel
        open={operationsOpen}
        onClose={() => setOperationsOpen(false)}
        onNavigate={() => setOperationsOpen(false)}
      />
    </>
  );
}
