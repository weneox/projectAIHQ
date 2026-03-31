import { AlertTriangle, CheckCircle2 } from "lucide-react";
import React from "react";

import { TinyChip } from "../SetupStudioUi.jsx";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function valueClass(multiline = false, editable = true, needsAttention = false) {
  return cx(
    multiline ? "min-h-[112px] resize-none py-3.5" : "h-11",
    "w-full rounded-[18px] border bg-white/90 px-4 text-[14px] text-slate-950 outline-none transition placeholder:text-slate-400",
    editable
      ? needsAttention
        ? "border-amber-200 focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
        : "border-slate-200 focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
      : "border-slate-200/80 text-slate-700"
  );
}

function FieldValue({
  value,
  placeholder,
  editable = true,
  multiline = false,
  onChange,
  needsAttention = false,
}) {
  const Element = multiline ? "textarea" : "input";

  if (!editable) {
    return (
      <div className={valueClass(multiline, false)}>
        {s(value) || (
          <span className="text-slate-400">{placeholder || "No value observed."}</span>
        )}
      </div>
    );
  }

  return (
    <Element
      value={s(value)}
      onChange={(e) => onChange?.(e.target.value)}
      className={valueClass(multiline, true, needsAttention)}
      placeholder={placeholder}
      autoComplete="off"
    />
  );
}

export default function FieldReviewCard({
  label,
  value,
  observedValue,
  placeholder,
  onChange,
  multiline = false,
  needsAttention = false,
  evidence = [],
  honesty = {},
}) {
  const visibleEvidence = arr(evidence).filter(
    (item) => s(item.label) || s(item.value) || s(item.note)
  );

  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-[rgba(255,255,255,.76)] p-5 shadow-[0_18px_40px_-32px_rgba(15,23,42,.36)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          {label}
        </div>
        {needsAttention ? (
          <TinyChip tone="warn">
            <AlertTriangle className="mr-1 h-3.5 w-3.5" />
            Needs review
          </TinyChip>
        ) : (
          <TinyChip tone="success">
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            Ready
          </TinyChip>
        )}
        {s(honesty.label) ? (
          <TinyChip tone={honesty.tone === "success" ? "success" : honesty.tone === "warn" ? "warn" : "default"}>
            {honesty.label}
          </TinyChip>
        ) : null}
        {s(honesty.provenanceLabel) ? <TinyChip>{honesty.provenanceLabel}</TinyChip> : null}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Your draft
          </div>
          <FieldValue
            value={value}
            placeholder={placeholder}
            editable
            multiline={multiline}
            onChange={onChange}
            needsAttention={needsAttention}
          />
        </div>

        <div className="min-w-0">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Detected from source
          </div>
          <FieldValue
            value={observedValue}
            placeholder="No observed value yet."
            editable={false}
            multiline={multiline}
          />
        </div>
      </div>

      {s(honesty.note) ? (
        <div className="mt-4 rounded-[18px] border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm leading-6 text-amber-900">
          {honesty.note}
        </div>
      ) : null}

      {visibleEvidence.length ? (
        <div className="mt-4 rounded-[22px] border border-slate-200/80 bg-slate-50/70 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Source details
          </div>
          <div className="mt-3 space-y-3">
            {visibleEvidence.map((item, index) => (
              <div
                key={`${label}-evidence-${index}`}
                className="rounded-[18px] border border-slate-200/70 bg-white/82 px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  {s(item.label) ? <TinyChip>{item.label}</TinyChip> : null}
                  {s(item.url) ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-slate-500 transition hover:text-slate-900"
                    >
                      View source
                    </a>
                  ) : null}
                </div>
                {s(item.value) ? (
                  <div className="mt-2 text-sm leading-6 text-slate-700">
                    {item.value}
                  </div>
                ) : null}
                {s(item.note) ? (
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    {item.note}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
