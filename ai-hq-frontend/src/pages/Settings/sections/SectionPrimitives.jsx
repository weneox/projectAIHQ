import Button from "../../../components/ui/Button.jsx";
import Badge from "../../../components/ui/Badge.jsx";
import Input from "../../../components/ui/Input.jsx";
import { cx } from "../../../lib/cx.js";

export function Select({ className = "", children, ...props }) {
  return (
    <div
      className={cx(
        "relative w-full min-w-0 overflow-hidden border-t",
        "border-slate-200/80 bg-transparent",
        "transition-[border-color,box-shadow,background-color] duration-200",
        "focus-within:border-sky-300/90 focus-within:ring-4 focus-within:ring-sky-100/70",
        "dark:border-white/10 dark:bg-transparent dark:focus-within:ring-sky-400/10",
        className
      )}
    >
      <select
        {...props}
        className="relative z-10 h-12 w-full appearance-none bg-transparent px-4 text-[14px] text-slate-900 outline-none dark:text-slate-100"
      >
        {children}
      </select>
    </div>
  );
}

export function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all duration-200",
        checked
          ? "border-sky-400/40 bg-[linear-gradient(180deg,rgba(14,165,233,0.92),rgba(37,99,235,0.92))] shadow-[0_10px_24px_rgba(37,99,235,0.24)]"
          : "border-slate-300/80 bg-slate-200/85 dark:border-white/10 dark:bg-white/[0.08]",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      )}
    >
      <span
        className={cx(
          "inline-block h-5 w-5 rounded-full bg-white shadow-[0_4px_10px_rgba(15,23,42,0.18)] transition-all duration-200",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block space-y-2.5">
      <div className="space-y-1">
        <div className="text-[13px] font-semibold tracking-[-0.01em] text-slate-800 dark:text-slate-100">
          {label}
        </div>
        {hint ? (
          <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            {hint}
          </div>
        ) : null}
      </div>
      {children}
    </label>
  );
}

export function StatTile({ label, value, hint, tone = "neutral" }) {
  return (
    <div className="border-t border-slate-200/80 px-1 py-4">
      <div className="space-y-1.5">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          {label}
        </div>
        <div className="text-[20px] font-semibold tracking-[-0.02em] text-slate-950 dark:text-white">
          {value}
        </div>
        {hint ? (
          <div className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            {hint}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function FeatureToggleCard({
  title,
  subtitle,
  checked,
  onChange,
  disabled = false,
}) {
  return (
    <div className="border-t border-slate-200/80 px-1 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {title}
            </div>
            <Badge
              tone={checked ? "success" : "neutral"}
              variant="subtle"
              size="sm"
              dot={checked}
            >
              {checked ? "On" : "Off"}
            </Badge>
          </div>

          <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {subtitle}
          </div>
        </div>

        <Toggle checked={checked} onChange={onChange} disabled={disabled} />
      </div>
    </div>
  );
}

export function RowActions({ onSave, onDelete, saving, deleting, canManage }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onSave} disabled={!canManage || saving}>
        {saving ? "Saving..." : "Save"}
      </Button>
      <Button
        variant="secondary"
        onClick={onDelete}
        disabled={!canManage || deleting}
      >
        {deleting ? "Deleting..." : "Delete"}
      </Button>
    </div>
  );
}

export function EmptyState({
  title,
  subtitle,
  actionLabel,
  onAction,
  disabled = false,
}) {
  return (
    <div className="border-t border-slate-200/80 px-1 py-5">
      <div className="space-y-4">
        <div>
          <div className="text-base font-semibold text-slate-900 dark:text-white">
            {title}
          </div>
          <div className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {subtitle}
          </div>
        </div>
        {actionLabel ? (
          <div>
            <Button onClick={onAction} disabled={disabled}>
              {actionLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export { Input };
