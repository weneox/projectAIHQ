import React from "react";

export function LeadField({ label, children }) {
  return (
    <label className="block">
      <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/32">
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
      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-white/24 focus:border-cyan-400/20"
    />
  );
}

export function LeadSelect({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/20"
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
      className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/24 focus:border-cyan-400/20"
    />
  );
}