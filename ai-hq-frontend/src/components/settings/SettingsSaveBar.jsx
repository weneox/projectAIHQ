// src/components/settings/SettingsSaveBar.jsx
// PREMIUM v2.0 — floating command save bar

import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Save } from "lucide-react";
import Button from "../ui/Button.jsx";
import { cx } from "../../lib/cx.js";

export default function SettingsSaveBar({
  dirty = false,
  surface = null,
  onReset,
  onSave,
}) {
  const saving = !!surface?.saving;
  const message = String(surface?.saveError || surface?.saveSuccess || "").trim();

  if (!dirty && !message) return null;

  const isSuccess = !dirty && !!surface?.saveSuccess && !surface?.saveError;
  const isError = !!surface?.saveError;
  const isWarning = dirty;

  return (
    <div className="sticky bottom-4 z-30 pt-2">
      <div className="relative overflow-hidden rounded-[26px] border border-slate-200/80 bg-white/92 shadow-[0_24px_80px_rgba(15,23,42,0.14)] backdrop-blur-xl dark:border-white/10 dark:bg-[rgba(2,6,23,0.82)] dark:shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-sky-300/70 to-transparent dark:via-sky-400/20" />
          <div className="absolute -left-12 top-0 h-24 w-24 rounded-full bg-amber-400/10 blur-3xl dark:bg-amber-300/10" />
          <div className="absolute -right-10 bottom-0 h-24 w-24 rounded-full bg-blue-500/10 blur-3xl dark:bg-blue-400/10" />
        </div>

        <div className="relative flex flex-col gap-4 px-5 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex items-start gap-3">
            <div
              className={cx(
                "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border",
                isWarning &&
                  "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300",
                isSuccess &&
                  "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-300",
                isError &&
                  "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-300",
                saving &&
                  "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-300"
              )}
            >
              {saving ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin" strokeWidth={2} />
              ) : isSuccess ? (
                <CheckCircle2 className="h-4.5 w-4.5" strokeWidth={2} />
              ) : isError ? (
                <AlertCircle className="h-4.5 w-4.5" strokeWidth={2} />
              ) : (
                <AlertCircle className="h-4.5 w-4.5" strokeWidth={2} />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold tracking-[-0.01em] text-slate-950 dark:text-white">
                  {saving
                    ? "Saving changes"
                    : dirty
                    ? "Unsaved changes"
                    : isError
                    ? "Save failed"
                    : "Workspace updated"}
                </div>

                {dirty ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300">
                    Pending
                  </span>
                ) : null}
              </div>

              <div className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {message ||
                  (dirty
                    ? "You have unpublished workspace edits. Review and save when ready."
                    : "All workspace settings are in sync.")}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-end lg:self-auto">
            {dirty ? (
              <Button
                variant="secondary"
                onClick={onReset}
                disabled={saving}
                className="min-w-[112px]"
              >
                <span className="inline-flex items-center gap-2">
                  <RotateCcw className="h-4 w-4" strokeWidth={1.9} />
                  Reset
                </span>
              </Button>
            ) : null}

            {dirty ? (
              <Button onClick={onSave} disabled={saving} className="min-w-[148px]">
                <span className="inline-flex items-center gap-2">
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.9} />
                  ) : (
                    <Save className="h-4 w-4" strokeWidth={1.9} />
                  )}
                  {saving ? "Saving..." : "Save Changes"}
                </span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
