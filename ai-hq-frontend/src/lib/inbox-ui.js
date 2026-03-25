import {
  Instagram,
  Facebook,
  MessageCircleMore,
  Mail,
  Globe,
} from "lucide-react";

export function fmtRelative(input) {
  if (!input) return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";

  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;

  return d.toLocaleDateString();
}

export function fmtDateTime(input) {
  if (!input) return "—";
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function channelIcon(channel) {
  const c = String(channel || "").toLowerCase();
  if (c === "instagram") return Instagram;
  if (c === "facebook") return Facebook;
  if (c === "whatsapp") return MessageCircleMore;
  if (c === "email") return Mail;
  return Globe;
}

export function channelTone(channel) {
  const c = String(channel || "").toLowerCase();
  if (c === "instagram") return "text-pink-200 border-pink-400/20 bg-pink-400/[0.06]";
  if (c === "facebook") return "text-blue-200 border-blue-400/20 bg-blue-400/[0.06]";
  if (c === "whatsapp") return "text-emerald-200 border-emerald-400/20 bg-emerald-400/[0.06]";
  if (c === "email") return "text-amber-100 border-amber-300/20 bg-amber-300/[0.06]";
  return "text-white/80 border-white/10 bg-white/[0.04]";
}

export function getPriorityTone(priority) {
  const p = String(priority || "").toLowerCase();
  if (p === "urgent") return "border-rose-400/25 bg-rose-400/[0.08] text-rose-100";
  if (p === "high") return "border-amber-300/25 bg-amber-300/[0.08] text-amber-100";
  if (p === "low") return "border-white/10 bg-white/[0.04] text-white/70";
  return "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-100";
}

export function deriveThreadState(thread) {
  const status = String(thread?.status || "open").toLowerCase();
  const unread = Number(thread?.unread_count || 0);
  const assigned = String(thread?.assigned_to || "").trim();
  const handoff = Boolean(thread?.handoff_active);

  if (status === "closed") return "closed";
  if (status === "resolved") return "resolved";
  if (handoff) return "handoff";
  if (assigned) return "assigned";
  if (unread > 0) return "open";
  return "ai_active";
}

export function stateBadgeTone(state) {
  if (state === "handoff") return "border-amber-300/20 bg-amber-300/[0.08] text-amber-100";
  if (state === "assigned") return "border-violet-400/20 bg-violet-400/[0.08] text-violet-100";
  if (state === "resolved") return "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-100";
  if (state === "closed") return "border-rose-400/20 bg-rose-400/[0.08] text-rose-100";
  if (state === "ai_active") return "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-100";
  return "border-white/10 bg-white/[0.05] text-white/78";
}

export function prettyState(state) {
  return String(state || "").replaceAll("_", " ");
}

export function stageTone(stage) {
  const s = String(stage || "").toLowerCase();
  if (s === "contacted") return "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-100";
  if (s === "qualified") return "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100";
  if (s === "won") return "border-yellow-300/20 bg-yellow-300/[0.08] text-yellow-100";
  if (s === "lost") return "border-rose-400/20 bg-rose-400/[0.08] text-rose-100";
  if (s === "proposal") return "border-violet-400/20 bg-violet-400/[0.08] text-violet-100";
  return "border-white/10 bg-white/[0.05] text-white/78";
}

export function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "closed") return "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-100";
  if (s === "spam") return "border-rose-400/20 bg-rose-400/[0.08] text-rose-100";
  if (s === "archived") return "border-white/10 bg-white/[0.05] text-white/62";
  return "border-cyan-400/20 bg-cyan-400/[0.08] text-cyan-100";
}

export function formatMoneyAZN(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return `${new Intl.NumberFormat("en-US").format(n)} ₼`;
}

export function pickLeadValue(lead) {
  const score = Number(lead?.score || 0);
  const extra = lead?.extra && typeof lead.extra === "object" ? lead.extra : {};

  const raw =
    extra.value ??
    extra.pipelineValue ??
    extra.amount ??
    extra.budget ??
    0;

  const val = Number(raw);
  if (Number.isFinite(val) && val > 0) return val;

  if (score >= 90) return 7000;
  if (score >= 80) return 5000;
  if (score >= 60) return 2500;
  if (score >= 40) return 1200;
  return 0;
}

export function scoreBand(score) {
  const s = Number(score || 0);
  if (s >= 85) return "high";
  if (s >= 60) return "medium";
  return "low";
}

export function scoreTone(score) {
  const band = scoreBand(score);
  if (band === "high") return "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-100";
  if (band === "medium") return "border-amber-300/20 bg-amber-300/[0.08] text-amber-100";
  return "border-white/10 bg-white/[0.05] text-white/72";
}

export function leadName(lead) {
  return (
    lead?.full_name ||
    lead?.username ||
    lead?.email ||
    lead?.phone ||
    "Unnamed lead"
  );
}

export function leadHandle(lead) {
  if (lead?.username) return `@${String(lead.username).replace(/^@+/, "")}`;
  return lead?.email || lead?.phone || "lead";
}

export function prettyLeadSource(lead) {
  const source = String(lead?.source || "").toLowerCase();
  const extra = lead?.extra && typeof lead.extra === "object" ? lead.extra : {};
  const channel = String(extra.channel || extra.platform || "").toLowerCase();

  if (channel === "instagram") return "Instagram DM";
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "facebook") return "Facebook";
  if (channel === "email") return "Email";
  if (source === "comment") return "Comment";
  if (source === "manual") return "Manual";
  if (source === "meta") return "Meta Inbox";
  if (source === "inbox") return "Inbox";
  return source || "—";
}