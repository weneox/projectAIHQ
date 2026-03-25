export function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function statusMeta(status) {
  const s = String(status || "").toLowerCase();

  if (s === "in_progress") {
    return {
      label: "In Progress",
      badge: "border-cyan-400/20 bg-cyan-400/10 text-cyan-100",
      tone: "text-cyan-100/80",
      panel: "border-cyan-400/12 bg-cyan-400/[0.06]",
    };
  }

  if (s === "retryable") {
    return {
      label: "Retryable",
      badge: "border-amber-400/20 bg-amber-400/10 text-amber-100",
      tone: "text-amber-100/80",
      panel: "border-amber-400/12 bg-amber-400/[0.06]",
    };
  }

  if (s === "dead_lettered") {
    return {
      label: "Dead Lettered",
      badge: "border-rose-400/20 bg-rose-400/10 text-rose-100",
      tone: "text-rose-100/80",
      panel: "border-rose-400/12 bg-rose-400/[0.06]",
    };
  }

  if (s === "terminal") {
    return {
      label: "Terminal",
      badge: "border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-100",
      tone: "text-fuchsia-100/80",
      panel: "border-fuchsia-400/12 bg-fuchsia-400/[0.06]",
    };
  }

  if (s === "succeeded") {
    return {
      label: "Succeeded",
      badge: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
      tone: "text-emerald-100/80",
      panel: "border-emerald-400/12 bg-emerald-400/[0.06]",
    };
  }

  return {
    label: "Pending",
    badge: "border-white/12 bg-white/[0.05] text-white/86",
    tone: "text-white/70",
    panel: "border-white/10 bg-white/[0.04]",
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
