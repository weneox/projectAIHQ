export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function statusMeta(status) {
  const s = String(status || "").toLowerCase();

  if (s === "in_progress") {
    return {
      label: "In Progress",
      badge: "border-sky-200 bg-sky-50 text-sky-700",
      tone: "text-sky-700",
      panel: "border-sky-200 bg-sky-50",
    };
  }

  if (s === "retryable") {
    return {
      label: "Retryable",
      badge: "border-amber-200 bg-amber-50 text-amber-700",
      tone: "text-amber-700",
      panel: "border-amber-200 bg-amber-50",
    };
  }

  if (s === "dead_lettered") {
    return {
      label: "Dead Lettered",
      badge: "border-rose-200 bg-rose-50 text-rose-700",
      tone: "text-rose-700",
      panel: "border-rose-200 bg-rose-50",
    };
  }

  if (s === "terminal") {
    return {
      label: "Terminal",
      badge: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
      tone: "text-fuchsia-700",
      panel: "border-fuchsia-200 bg-fuchsia-50",
    };
  }

  if (s === "succeeded") {
    return {
      label: "Succeeded",
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
      tone: "text-emerald-700",
      panel: "border-emerald-200 bg-emerald-50",
    };
  }

  return {
    label: "Pending",
    badge: "border-line bg-surface-muted text-text-muted",
    tone: "text-text-muted",
    panel: "border-line bg-surface-muted",
  };
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export function formatRelative(value) {
  if (!value) return "—";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return String(value);
  const diffSec = Math.round((Date.now() - time) / 1000);
  const abs = Math.abs(diffSec);

  if (abs < 60) return `${abs}s ${diffSec >= 0 ? "ago" : "from now"}`;
  if (abs < 3600) return `${Math.floor(abs / 60)}m ${diffSec >= 0 ? "ago" : "from now"}`;
  if (abs < 86400) return `${Math.floor(abs / 3600)}h ${diffSec >= 0 ? "ago" : "from now"}`;
  return `${Math.floor(abs / 86400)}d ${diffSec >= 0 ? "ago" : "from now"}`;
}

export function displayValue(value, fallback = "—") {
  if (value == null || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return value.length ? `${value.length} items` : fallback;
  if (typeof value === "object") {
    if (typeof value.label === "string") return value.label;
    if (typeof value.name === "string") return value.name;
    if (typeof value.id === "string") return value.id;
    return `Object · ${Object.keys(value).length} keys`;
  }
  return String(value);
}

export function pretty(value) {
  try {
    if (value == null) return "";
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
      }
      return value;
    }
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

export function extractSummary(value, limit = 8) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value)
    .slice(0, limit)
    .map(([key, item]) => ({
      key,
      value: displayValue(item),
    }));
}

export function queueLabel(status) {
  const s = String(status || "").toLowerCase();
  if (s === "retryable") return "Retry Queue";
  if (s === "dead_lettered") return "Dead Letter Queue";
  if (s === "terminal") return "Terminal";
  if (s === "in_progress") return "Active Lease";
  if (s === "pending") return "Pending";
  if (s === "succeeded") return "Succeeded";
  return "All";
}
