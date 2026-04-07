export function s(v) {
  return String(v ?? "").trim();
}

export function labelizeToken(value) {
  const text = s(value).replace(/[_-]+/g, " ");
  if (!text) return "—";
  return text.charAt(0).toUpperCase() + text.slice(1);
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

  if (c.includes("instagram")) {
    return "border-[#f6d0e2] bg-[#fdf2f8] text-[#b4236b]";
  }

  if (c.includes("facebook")) {
    return "border-[#c7d7fe] bg-[#eff4ff] text-[#175cd3]";
  }

  if (c.includes("messenger")) {
    return "border-[#b8e6f7] bg-[#ecfdff] text-[#0e7490]";
  }

  return "border-line bg-surface-subtle text-text-muted";
}

export function statusTone(status) {
  const x = String(status || "").toLowerCase();

  if (x === "replied" || x === "approved" || x === "reviewed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (x === "pending" || x === "manual_review") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (x === "flagged" || x === "ignored") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-line bg-surface-subtle text-text-muted";
}

export function sentimentTone(sentiment) {
  const x = String(sentiment || "").toLowerCase();

  if (x === "positive") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (x === "negative") return "border-rose-200 bg-rose-50 text-rose-700";
  if (x === "mixed") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-line bg-surface-subtle text-text-muted";
}

export function priorityTone(priority) {
  const x = String(priority || "").toLowerCase();

  if (x === "urgent") return "border-rose-300 bg-rose-50 text-rose-800";
  if (x === "high") return "border-rose-200 bg-rose-50 text-rose-700";
  if (x === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-line bg-surface-subtle text-text-muted";
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
    assignedTo: classification?.requiresHuman ? "Manual review" : "AI copilot",
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