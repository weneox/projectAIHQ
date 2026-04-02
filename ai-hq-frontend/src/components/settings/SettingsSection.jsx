// src/components/settings/SettingsSection.jsx
// PREMIUM v2.0 — section surface

import React from "react";
import { cx } from "../../lib/cx.js";

export default function SettingsSection({
  title,
  subtitle,
  actions = null,
  children,
  eyebrow = "Section",
  tone = "default",
  padded = true,
  contentClassName = "",
}) {
  return (
    <section
      className={cx(
        "group relative border-t transition-all duration-300",
        tone === "default" &&
          "border-slate-200/75 bg-transparent dark:border-white/10 dark:bg-transparent",
        tone === "soft" &&
          "border-slate-200/70 bg-transparent dark:border-white/10 dark:bg-transparent",
        tone === "accent" &&
          "border-blue-200/60 bg-transparent dark:border-blue-400/20 dark:bg-transparent"
      )}
    >
      <div className="relative">
        <div className="flex flex-col gap-4 border-b border-slate-200/70 px-6 py-5 dark:border-white/10 sm:px-7">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
                {eyebrow}
              </div>

              <div className="space-y-1.5">
                <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
                  {title}
                </h2>

                {subtitle ? (
                  <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>

            {actions ? (
              <div className="shrink-0 self-start lg:self-center">{actions}</div>
            ) : null}
          </div>
        </div>

        <div
          className={cx(
            padded ? "px-6 py-6 sm:px-7 sm:py-7" : "",
            contentClassName
          )}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
