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
        "group relative overflow-hidden rounded-[28px] border transition-all duration-300",
        tone === "default" &&
          "border-slate-200/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0.38))] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))]",
        tone === "soft" &&
          "border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.88),rgba(255,255,255,0.4))] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))]",
        tone === "accent" &&
          "border-blue-200/60 bg-[linear-gradient(180deg,rgba(239,246,255,0.78),rgba(255,255,255,0.38))] dark:border-blue-400/20 dark:bg-[linear-gradient(180deg,rgba(59,130,246,0.08),rgba(255,255,255,0.01))]"
      )}
    >
      <div className="relative">
        <div className="flex flex-col gap-4 border-b border-slate-200/70 px-5 py-5 dark:border-white/10 sm:px-6">
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
            padded ? "px-5 py-5 sm:px-6 sm:py-6" : "",
            contentClassName
          )}
        >
          {children}
        </div>
      </div>
    </section>
  );
}
