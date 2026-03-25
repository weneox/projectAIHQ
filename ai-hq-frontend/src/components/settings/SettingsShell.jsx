// src/components/settings/SettingsShell.jsx
// PREMIUM v2.1 — editorial settings shell (stable sticky + scroll-safe nav)

import Card from "../ui/Card.jsx";
import SettingsNav from "./SettingsNav.jsx";

function resolveActiveItem(items, activeKey) {
  return (
    items.find(
      (item) =>
        item?.key === activeKey ||
        item?.id === activeKey ||
        item?.value === activeKey
    ) || null
  );
}

export default function SettingsShell({
  title = "Settings",
  subtitle = "Workspace, brand, AI policy və integrations idarəsi.",
  items = [],
  activeKey,
  onChange,
  children,
}) {
  const activeItem = resolveActiveItem(items, activeKey);

  const activeLabel =
    activeItem?.label || activeItem?.title || activeItem?.name || "General";

  const activeDescription =
    activeItem?.description ||
    activeItem?.subtitle ||
    "Selected configuration section";

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] px-6 py-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(2,6,23,0.88))] dark:shadow-[0_24px_80px_rgba(0,0,0,0.34)] sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/80 to-transparent dark:via-sky-400/30" />
          <div className="absolute -right-16 top-0 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl dark:bg-sky-400/10" />
          <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-indigo-500/8 blur-3xl dark:bg-indigo-400/10" />
        </div>

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="inline-flex items-center rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500 backdrop-blur dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400">
              Control Center
            </div>

            <div className="space-y-1.5">
              <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-slate-950 dark:text-white sm:text-[32px]">
                {title}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="relative max-w-full rounded-[24px] border border-slate-200/80 bg-white/75 p-4 backdrop-blur dark:border-white/10 dark:bg-white/[0.04] lg:min-w-[260px]">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
              Active Section
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
              {activeLabel}
            </div>
            <div className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
              {activeDescription}
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="min-w-0 self-start xl:sticky xl:top-6">
          <Card className="overflow-hidden rounded-[28px] border border-slate-200/75 bg-white/82 p-0 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-white/[0.035] dark:shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
            <div className="border-b border-slate-200/70 px-5 py-4 dark:border-white/10">
              <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
                Navigation
              </div>
              <div className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                Settings sections
              </div>
            </div>

            <div className="max-h-[calc(100vh-12rem)] overflow-y-auto p-3">
              <SettingsNav items={items} activeKey={activeKey} onChange={onChange} />
            </div>
          </Card>
        </aside>

        <section className="min-w-0 space-y-6">{children}</section>
      </div>
    </div>
  );
}