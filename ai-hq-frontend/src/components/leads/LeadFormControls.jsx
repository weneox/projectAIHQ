import React from "react";

export function LeadField({ label, children }) {
  return (
    <label className="block">
      <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      {children}
    </label>
  );
}

export function LeadInput({ value, onChange, placeholder = "", type = "text" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="premium-input w-full rounded-2xl px-4 py-3 text-sm outline-none focus:border-sky-300/90"
    />
  );
}

export function LeadSelect({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="premium-select w-full rounded-2xl px-4 py-3 text-sm outline-none focus:border-sky-300/90"
    >
      {children}
    </select>
  );
}

export function LeadTextArea({ value, onChange, rows = 4, placeholder = "" }) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="premium-textarea w-full resize-none rounded-2xl px-4 py-3 text-sm leading-6 outline-none focus:border-sky-300/90"
    />
  );
}
