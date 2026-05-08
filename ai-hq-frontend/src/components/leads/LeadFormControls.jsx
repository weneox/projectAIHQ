import Input, { Select, Textarea } from "../ui/Input.jsx";

export function LeadField({ label, children }) {
  return (
    <label className="grid gap-2">
      <div className="text-[12px] font-semibold text-text-muted">
        {label}
      </div>
      {children}
    </label>
  );
}

export function LeadInput({ value, onChange, placeholder = "", type = "text" }) {
  return (
    <Input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      appearance="quiet"
    />
  );
}

export function LeadSelect({ value, onChange, children }) {
  return (
    <Select value={value} onChange={onChange} appearance="quiet">
      {children}
    </Select>
  );
}

export function LeadTextArea({ value, onChange, rows = 4, placeholder = "" }) {
  return (
    <Textarea
      rows={rows}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      appearance="quiet"
    />
  );
}
