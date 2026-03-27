import React from "react";

import { TinyChip } from "./SetupStudioUi.jsx";

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export default function SetupStudioEvidenceNotice({
  tone = "default",
  title = "",
  body = "",
  chips = [],
  className = "",
}) {
  const toneClass =
    tone === "warn"
      ? "border-amber-200/90 bg-amber-50/88 text-amber-900"
      : tone === "success"
        ? "border-emerald-200/90 bg-emerald-50/88 text-emerald-900"
        : "border-slate-200/80 bg-white/84 text-slate-700";

  return (
    <div className={cx("rounded-[24px] border px-4 py-4", toneClass, className)}>
      {s(title) ? <div className="text-sm font-semibold">{title}</div> : null}
      {s(body) ? <div className="mt-1 text-sm leading-6">{body}</div> : null}
      {arr(chips).length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {arr(chips).map((item, index) => (
            <TinyChip key={`${item.label}-${index}`} tone={item.tone || "default"}>
              {item.label}
            </TinyChip>
          ))}
        </div>
      ) : null}
    </div>
  );
}
