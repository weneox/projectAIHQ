import React from "react";
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
  eyebrow = "Settings",
  title = "Settings",
  subtitle = "Workspace, brand, AI policy and advanced configuration.",
  navTitle = "Navigation",
  navSubtitle = "Settings sections",
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

  const activeStatus = activeItem?.status || "";

  return (
    <div className="space-y-8">
      <header className="relative overflow-hidden rounded-[36px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,248,250,0.92))] px-6 py-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(15,23,42,0.74))] dark:shadow-[0_24px_70px_rgba(0,0,0,0.3)] sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-14 top-0 h-32 w-32 rounded-full bg-sky-200/30 blur-3xl dark:bg-sky-400/10" />
          <div className="absolute right-0 top-6 h-24 w-24 rounded-full bg-amber-200/30 blur-3xl dark:bg-amber-300/10" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/20" />
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
              {eyebrow}
            </div>

            <div className="space-y-2">
              <h1 className="text-[30px] font-semibold tracking-[-0.04em] text-slate-950 dark:text-white sm:text-[36px]">
                {title}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[340px] lg:max-w-[380px]">
            <div className="rounded-[24px] border border-slate-200/80 bg-white/78 px-4 py-3.5 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                Active
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                {activeLabel}
              </div>
              <div className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
                {activeDescription}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200/80 bg-white/78 px-4 py-3.5 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                State
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                {activeStatus || "Available"}
              </div>
              <div className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
                {navSubtitle}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="min-w-0 self-start xl:sticky xl:top-6">
          <div className="rounded-[30px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,250,252,0.88))] p-4 shadow-[0_18px_48px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.76),rgba(2,6,23,0.7))]">
            <div className="pb-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
                {navTitle}
              </div>
              <div className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                {navSubtitle}
              </div>
            </div>

            <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
              <SettingsNav items={items} activeKey={activeKey} onChange={onChange} />
            </div>
          </div>
        </aside>

        <section className="min-w-0 rounded-[34px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(250,250,251,0.94))] px-5 py-5 shadow-[0_24px_70px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(2,6,23,0.76))] dark:shadow-[0_24px_70px_rgba(0,0,0,0.3)] sm:px-6 sm:py-6">
          {children}
        </section>
      </div>
    </div>
  );
}
