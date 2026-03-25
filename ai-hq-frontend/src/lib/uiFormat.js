// src/lib/uiFormat.js (FINAL — robust payload + draft pack parsing)
// ✅ Fix: parsePayload reads many shapes (payload/proposal/data/draft/execution/job)
// ✅ Fix: title/summary fallback to caption/text/contentPack
// ✅ Fix: rowsForOverview works for both proposal payload and draft content pack
// ✅ Safe for nulls, strings, objects

export function shortId(x) {
  const s = String(x || "");
  if (!s) return "";
  if (s.includes("-")) return s.split("-")[0];
  if (s.length > 10) return s.slice(0, 10);
  return s;
}

export function relTime(iso) {
  const t = iso ? new Date(iso).getTime() : Date.now();
  const now = Date.now();
  const sec = Math.max(0, Math.floor((now - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export function safeText(x, max = 120) {
  const s = String(x || "").replace(/\s+/g, " ").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

export function safeJson(x) {
  try {
    if (typeof x === "string") return JSON.parse(x);
    return x ?? null;
  } catch {
    return null;
  }
}

export function pretty(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

/**
 * Extracts a "content pack" from many possible wrappers
 * (content_items, jobs/executions, notifications, n8n callback shapes)
 */
export function pickContentPack(any) {
  const d = safeJson(any) || any;
  if (!d || typeof d !== "object") return null;

  const pack =
    d.content_pack ||
    d.contentPack ||
    d.result?.contentPack ||
    d.result?.content_pack ||
    d.output?.contentPack ||
    d.output?.content_pack ||
    d.payload?.contentPack ||
    d.payload?.content_pack ||
    d.pack ||
    d.content ||
    null;

  return safeJson(pack) || pack || null;
}

/**
 * Robust proposal payload parsing:
 * tries to return the most "CEO-readable" object:
 * - proposal payload (title/summary/goal)
 * - or content pack (caption/hashtags/visualPlan)
 */
export function parsePayload(p) {
  if (!p) return null;

  // 1) direct payload/proposal
  const raw =
    p?.payload ??
    p?.proposal ??
    p?.data ??
    p?.content ??
    null;

  const a = safeJson(raw) || raw;

  // unwrap nested payloads
  const a2 =
    (a && typeof a === "object" && (a.payload || a.proposal || a.data)) ? (a.payload || a.proposal || a.data) : a;

  // 2) drafts/executions/jobs (frontend-only best effort)
  const draftCandidate =
    p?.latestDraft ||
    p?.latest_draft ||
    p?.draft ||
    p?.contentDraft ||
    p?.latest_execution ||
    p?.lastExecution ||
    p?.latestExecution ||
    p?.execution ||
    p?.job ||
    (Array.isArray(p?.jobs) ? p.jobs[0] : null) ||
    null;

  const d = safeJson(draftCandidate) || draftCandidate;

  // If we already have a good object with title/summary/goal — return it.
  if (a2 && typeof a2 === "object") {
    const hasCore =
      a2.title || a2.summary || a2.goal || a2.objective || a2.problem || a2.context || a2.caption || a2.text;
    if (hasCore) return a2;
  }

  // Otherwise try to return content pack (more useful for UI)
  const pack = pickContentPack(d) || pickContentPack(a2);
  if (pack && typeof pack === "object") return pack;

  // String fallback
  if (typeof a2 === "string") return a2;
  if (typeof d === "string") return d;

  return a2 || d || null;
}

export function titleOf(p) {
  const payload = parsePayload(p);
  if (!payload) return `Proposal`;
  if (typeof payload === "string") return safeText(payload, 80);

  // prefer title-like
  const t =
    payload.title ||
    payload.name ||
    payload.topic ||
    payload.summary ||
    payload.goal ||
    payload.objective ||
    "";

  if (t) return safeText(t, 90);

  // fallback to caption/text
  const c = payload.caption || payload.postCaption || payload.text || "";
  if (c) return safeText(c, 90);

  return `Proposal`;
}

export function summaryOf(p) {
  const payload = parsePayload(p);
  if (!payload) return "";
  if (typeof payload === "string") return safeText(payload, 120);

  const s =
    payload.summary ||
    payload.goal ||
    payload.objective ||
    payload.problem ||
    payload.context ||
    payload.description ||
    "";

  if (s) return safeText(s, 140);

  // fallback caption/text
  const c = payload.caption || payload.postCaption || payload.text || "";
  return safeText(c, 140);
}

function normalizeHashtags(h) {
  if (!h) return [];
  if (Array.isArray(h)) return h.map(String).map((x) => x.trim()).filter(Boolean);
  if (typeof h === "string") {
    return h
      .split(/[\s,]+/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  return [];
}

export function rowsForOverview(payload) {
  if (!payload) return [];
  if (typeof payload === "string") return [{ k: "text", label: "Text", v: payload }];

  if (typeof payload !== "object") return [];

  const rows = [];
  const pick = (k, label = k) => {
    const v = payload[k];
    if (v == null) return;
    rows.push({ k, label, v });
  };

  // Proposal-like fields
  pick("title", "Title");
  pick("goal", "Goal");
  pick("summary", "Summary");
  pick("objective", "Objective");
  pick("problem", "Problem");
  pick("context", "Context");
  pick("kpis", "KPIs");
  pick("channel", "Channel");
  pick("budget", "Budget");
  pick("dueDate", "Due date");
  pick("assignees", "Assignees");
  pick("priority", "Priority");

  // Content-pack fields
  pick("platform", "Platform");
  pick("postType", "Post type");
  pick("type", "Type");
  pick("caption", "Caption");
  pick("postCaption", "Caption");
  pick("hashtags", "Hashtags");
  pick("tags", "Tags");
  pick("visualPlan", "Visual plan");
  pick("reel_script", "Reel script");
  pick("reelScript", "Reel script");
  pick("image_prompt", "Image prompt");
  pick("imagePrompt", "Image prompt");
  pick("post_time", "Post time");
  pick("postTime", "Post time");
  pick("assetUrls", "Asset URLs");

  // normalize hashtags if present
  const h = payload.hashtags ?? payload.tags ?? null;
  const hh = normalizeHashtags(h);
  if (hh.length) {
    // remove old hashtag row (if string)
    const idx = rows.findIndex((r) => r.k === "hashtags" || r.k === "tags");
    if (idx >= 0) rows[idx] = { k: "hashtags", label: "Hashtags", v: hh.slice(0, 24).join(" ") };
    else rows.push({ k: "hashtags", label: "Hashtags", v: hh.slice(0, 24).join(" ") });
  }

  // if nothing picked, show keys
  if (!rows.length) {
    const keys = Object.keys(payload).slice(0, 12);
    if (keys.length) rows.push({ k: "keys", label: "Payload keys", v: keys.join(", ") });
  }

  return rows.slice(0, 10);
}