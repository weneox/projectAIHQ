import React from "react";

export function LeadField({ label, children }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-text-muted">
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
      className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-text outline-none transition focus:border-brand"
    />
  );
}

export function LeadSelect({ value, onChange, children }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-text outline-none transition focus:border-brand"
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
      className="w-full resize-none rounded-md border border-line bg-surface px-3 py-3 text-sm leading-6 text-text outline-none transition focus:border-brand"
    />
  );
}
