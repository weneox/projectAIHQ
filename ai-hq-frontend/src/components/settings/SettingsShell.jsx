import React from "react";
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
  eyebrow = "Control Center",
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

  return (
    <div className="space-y-7">
      <header className="relative overflow-hidden rounded-[32px] border border-[#e8ddcd] bg-[linear-gradient(180deg,rgba(255,252,246,0.96),rgba(251,247,239,0.96))] px-6 py-6 shadow-[0_18px_50px_rgba(120,102,73,0.10),inset_0_1px_0_rgba(255,255,255,0.82)] sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d8c9b3] to-transparent" />
          <div className="absolute -right-16 top-0 h-40 w-40 rounded-full bg-[#ead7b6]/40 blur-3xl" />
          <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-white/70 blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="inline-flex items-center rounded-full border border-[#e8decf] bg-[#fffaf4] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-stone-500 backdrop-blur">
              {eyebrow}
            </div>

            <div className="space-y-1.5">
              <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-stone-950 sm:text-[32px]">
                {title}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-stone-600">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="relative max-w-full rounded-[24px] border border-[#ece2d3] bg-[#fffdfa] p-4 backdrop-blur lg:min-w-[260px]">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-stone-400">
              Active Section
            </div>
            <div className="mt-2 text-sm font-semibold text-stone-900">
              {activeLabel}
            </div>
            <div className="mt-1 text-sm leading-5 text-stone-500">
              {activeDescription}
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="min-w-0 self-start xl:sticky xl:top-6">
          <Card className="overflow-hidden rounded-[28px] border border-[#ece2d3] bg-[#fffdf9]/92 p-0 shadow-[0_18px_44px_rgba(120,102,73,0.08)] backdrop-blur">
            <div className="border-b border-[#eee4d5] px-5 py-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-stone-400">
                {navTitle}
              </div>
              <div className="mt-2 text-sm font-medium text-stone-600">
                {navSubtitle}
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
