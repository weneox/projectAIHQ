export function s(v) {
  return String(v ?? "").trim();
}

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

export function channelIcon(channel, icons) {
  const c = String(channel || "").toLowerCase();
  if (c.includes("instagram")) return icons.Instagram;
  if (c.includes("facebook")) return icons.Facebook;
  if (c.includes("messenger")) return icons.MessageSquareText;
  return icons.Globe;
}

export function channelTone(channel) {
  const c = String(channel || "").toLowerCase();
  if (c.includes("instagram")) return "text-pink-200 border-pink-400/20 bg-pink-400/[0.06]";
  if (c.includes("facebook")) return "text-blue-200 border-blue-400/20 bg-blue-400/[0.06]";
  if (c.includes("messenger")) return "text-cyan-200 border-cyan-400/20 bg-cyan-400/[0.06]";
  return "text-white/80 border-white/10 bg-white/[0.04]";
}

export function statusTone(status) {
  const s = String(status || "").toLowerCase();

  if (s === "replied" || s === "approved" || s === "reviewed") {
    return "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100";
  }

  if (s === "pending" || s === "manual_review") {
    return "border-amber-300/20 bg-amber-300/[0.08] text-amber-100";
  }

  if (s === "flagged" || s === "ignored") {
    return "border-rose-400/20 bg-rose-400/[0.08] text-rose-100";
  }

  return "border-white/10 bg-white/[0.05] text-white/72";
}

export function sentimentTone(sentiment) {
  const x = String(sentiment || "").toLowerCase();
  if (x === "positive") return "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100";
  if (x === "negative") return "border-rose-400/20 bg-rose-400/[0.08] text-rose-100";
  if (x === "mixed") return "border-amber-300/20 bg-amber-300/[0.08] text-amber-100";
  return "border-white/10 bg-white/[0.05] text-white/72";
}

export function priorityTone(priority) {
  const p = String(priority || "").toLowerCase();
  if (p === "urgent") return "border-rose-500/25 bg-rose-500/[0.12] text-rose-100";
  if (p === "high") return "border-rose-400/20 bg-rose-400/[0.08] text-rose-100";
  if (p === "medium") return "border-amber-300/20 bg-amber-300/[0.08] text-amber-100";
  return "border-white/10 bg-white/[0.05] text-white/72";
}

export function categoryToFallbackStatus(category) {
  const c = String(category || "").toLowerCase();
  if (c === "spam" || c === "toxic") return "flagged";
  if (c === "sales" || c === "support") return "pending";
  return "pending";
}

export function pickUiStatus(classification = {}) {
  const moderationStatus = s(classification?.moderation?.status || "").toLowerCase();
  if (moderationStatus) return moderationStatus;
  return categoryToFallbackStatus(classification?.category);
}

export function mapCommentToUi(row) {
  const classification = row?.classification || {};
  const raw = row?.raw || {};
  const moderation = classification?.moderation || {};
  const reply = classification?.reply || {};

  return {
    id: s(row?.id || ""),
    platform: s(row?.channel || "other"),
    author:
      s(row?.customer_name || "") ||
      s(row?.external_username || "") ||
      s(row?.external_user_id || "") ||
      "Unknown user",
    text: s(row?.text || ""),
    postTitle: s(row?.external_post_id || "") || "Post",
    status: pickUiStatus(classification),
    sentiment: s(classification?.sentiment || "neutral").toLowerCase() || "neutral",
    priority: s(classification?.priority || "low").toLowerCase() || "low",
    assignedTo: classification?.requiresHuman ? "Manual Review" : "AI Copilot",
    createdAt: row?.created_at || row?.updated_at || null,
    suggestedReply:
      s(reply?.text || "") ||
      s(classification?.replySuggestion || ""),
    category: s(classification?.category || "unknown").toLowerCase(),
    requiresHuman: Boolean(classification?.requiresHuman),
    shouldCreateLead: Boolean(classification?.shouldCreateLead),
    externalCommentId: s(row?.external_comment_id || ""),
    externalPostId: s(row?.external_post_id || ""),
    externalUsername: s(row?.external_username || ""),
    externalUserId: s(row?.external_user_id || ""),
    source: s(row?.source || ""),
    moderationActor: s(moderation?.actor || ""),
    moderationNote: s(moderation?.note || ""),
    moderationReason: s(moderation?.reason || ""),
    moderationUpdatedAt: moderation?.updatedAt || null,
    replyApproved: Boolean(reply?.approved),
    replySent: Boolean(reply?.sent),
    raw,
    original: row,
  };
}