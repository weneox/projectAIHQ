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

  return (
    <div className="space-y-7">
      <header className="border-b border-[#e8ddcd] pb-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-stone-500">
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

          <div className="max-w-full border-l border-[#ece2d3] pl-5 lg:min-w-[260px]">
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
          <div className="border-r border-[#ece2d3] pr-4">
            <div className="pb-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-stone-400">
                {navTitle}
              </div>
              <div className="mt-2 text-sm font-medium text-stone-600">
                {navSubtitle}
              </div>
            </div>

            <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
              <SettingsNav items={items} activeKey={activeKey} onChange={onChange} />
            </div>
          </div>
        </aside>

        <section className="min-w-0 space-y-6">{children}</section>
      </div>
    </div>
  );
}
