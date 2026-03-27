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
        "group relative overflow-hidden rounded-[30px] border shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur transition-all duration-300 dark:shadow-[0_24px_80px_rgba(0,0,0,0.28)]",
        tone === "default" &&
          "border-slate-200/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(248,250,252,0.92))] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.72),rgba(2,6,23,0.78))]",
        tone === "soft" &&
          "border-slate-200/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.92))] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.025))]",
        tone === "accent" &&
          "border-blue-200/60 bg-[linear-gradient(180deg,rgba(239,246,255,0.95),rgba(248,250,252,0.92))] dark:border-blue-400/20 dark:bg-[linear-gradient(180deg,rgba(37,99,235,0.12),rgba(15,23,42,0.82))]"
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/80 to-transparent dark:via-white/10" />
        <div className="absolute -right-16 top-0 h-32 w-32 rounded-full bg-sky-400/10 blur-3xl dark:bg-sky-400/10" />
        <div className="absolute -left-12 bottom-0 h-28 w-28 rounded-full bg-indigo-400/8 blur-3xl dark:bg-indigo-400/10" />
      </div>

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
