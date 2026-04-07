import {
  Instagram,
  Facebook,
  MessageSquareText,
  Globe,
} from "lucide-react";
import { cx } from "../../lib/cx.js";
import {
  channelIcon,
  fmtRelative,
  labelizeToken,
} from "../../features/comments/comment-utils.js";

function statusDotClass(status = "") {
  const value = String(status || "").toLowerCase();

  if (value === "replied" || value === "reviewed" || value === "approved") {
    return "bg-emerald-500";
  }

  if (value === "pending" || value === "manual_review") {
    return "bg-amber-500";
  }

  if (value === "flagged" || value === "ignored") {
    return "bg-rose-500";
  }

  return "bg-slate-300";
}

function channelMarkClass(platform = "") {
  const value = String(platform || "").toLowerCase();

  if (value.includes("instagram")) return "text-[#b4236b]";
  if (value.includes("facebook")) return "text-[#175cd3]";
  if (value.includes("messenger")) return "text-[#0e7490]";
  return "text-text-subtle";
}

function buildMetaLine(item) {
  const bits = [
    labelizeToken(item.status),
    labelizeToken(item.sentiment),
    labelizeToken(item.priority),
  ].filter(Boolean);

  return bits.join(" / ");
}

function initial(text = "") {
  const value = String(text || "").trim();
  return value ? value.charAt(0).toUpperCase() : "?";
}

export default function CommentRow({ item, selected, onSelect }) {
  const Icon = channelIcon(item.platform, {
    Instagram,
    Facebook,
    MessageSquareText,
    Globe,
  });

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={cx(
        "group w-full rounded-[16px] px-3 py-3 text-left transition-[background-color,color,box-shadow] duration-200 ease-premium",
        selected
          ? "bg-[rgba(var(--color-brand),0.055)]"
          : "hover:bg-surface-subtle"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-[13px] font-semibold tracking-[-0.02em] text-text">
          {initial(item.author)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className="truncate text-[14px] font-semibold tracking-[-0.02em] text-text">
              {item.author}
            </div>
            <div className="text-[12px] font-medium text-text-subtle">
              {fmtRelative(item.createdAt)}
            </div>
          </div>

          <div className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-6 text-text">
            {item.text || "No comment text"}
          </div>

          <div className="mt-1.5 flex min-w-0 items-center gap-2 text-[12px] font-medium text-text-subtle">
            <span
              className={cx(
                "h-1.5 w-1.5 rounded-full",
                statusDotClass(item.status)
              )}
            />
            <span className="truncate">{buildMetaLine(item)}</span>
            {item.suggestedReply ? (
              <>
                <span className="text-[11px] text-text-subtle">/</span>
                <span className="truncate text-brand">AI draft ready</span>
              </>
            ) : null}
          </div>
        </div>

        <span
          className={cx(
            "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center",
            channelMarkClass(item.platform)
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </button>
  );
}
