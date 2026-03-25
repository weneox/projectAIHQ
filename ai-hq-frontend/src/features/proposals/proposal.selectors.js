function safeText(x) {
  if (typeof x === "string") return x;
  if (x && typeof x === "object") {
    if (typeof x.text === "string") return x.text;
    if (typeof x.value === "string") return x.value;
    if (typeof x.caption === "string") return x.caption;
    if (typeof x.label === "string") return x.label;
    if (typeof x.name === "string") return x.name;
    if (typeof x.title === "string") return x.title;
  }
  return "";
}

function safeJson(x) {
  try {
    if (!x) return null;
    if (typeof x === "string") return JSON.parse(x);
    if (typeof x === "object") return x;
    return null;
  } catch {
    return null;
  }
}

export function pretty(x) {
  try {
    return JSON.stringify(x ?? null, null, 2);
  } catch {
    return String(x ?? "");
  }
}

export function shortId(id) {
  const s = String(id || "");
  return s.length <= 8 ? s : s.slice(0, 8);
}

function normalizeHashtags(h) {
  if (!h) return [];
  if (Array.isArray(h)) return h.map(String).map((x) => x.trim()).filter(Boolean);
  if (typeof h === "string") {
    return h
      .split(/[\s,]+/)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => (x.startsWith("#") ? x : `#${x}`));
  }
  return [];
}

export function relTime(iso) {
  const ms = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(ms)) return "";
  const d = Date.now() - ms;
  const m = Math.round(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  return `${days}d ago`;
}

export function asDisplay(v) {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);

  if (Array.isArray(v)) {
    return v
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "number" || typeof item === "boolean") return String(item);
        if (item && typeof item === "object") {
          return (
            safeText(item) ||
            safeText(item.caption) ||
            safeText(item.text) ||
            safeText(item.value) ||
            pretty(item)
          );
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  if (typeof v === "object") {
    return (
      safeText(v) ||
      safeText(v.caption) ||
      safeText(v.text) ||
      safeText(v.value) ||
      pretty(v)
    );
  }

  return String(v);
}

export function normalizeInlineText(v) {
  const raw = asDisplay(v);
  return String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function firstNonEmpty(...vals) {
  for (const v of vals) {
    const s = normalizeInlineText(v);
    if (s) return s;
  }
  return "";
}

export function clip(s, n) {
  const t = String(s || "").trim();
  if (!t) return "";
  return t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`;
}

export function pickPayloadObj(p) {
  const raw =
    p?.payload ??
    p?.proposal ??
    p?.data ??
    p?.content ??
    p?.draft ??
    p?.latestDraft ??
    p?.latest_draft ??
    null;

  const obj = safeJson(raw) || raw;
  if (!obj || typeof obj !== "object") return null;
  if (obj.payload && typeof obj.payload === "object") return obj.payload;
  return obj;
}

export function pickDraftPackFromAnything(p) {
  const sources = [
    p?.latestDraft,
    p?.latest_draft,
    p?.draft,
    p?.contentDraft,
    p?.latest_execution,
    p?.lastExecution,
    p?.latestExecution,
    p?.execution,
    p?.job,
    p?.jobs?.[0],
    p?.latestContent,
  ].filter(Boolean);

  for (const src of sources) {
    const dj = safeJson(src) || src;
    if (!dj) continue;

    const pack =
      dj?.content_pack ||
      dj?.contentPack ||
      dj?.result?.contentPack ||
      dj?.result?.content_pack ||
      dj?.output?.contentPack ||
      dj?.output?.content_pack ||
      dj?.pack ||
      dj?.payload ||
      null;

    const packObj = safeJson(pack) || pack;
    if (packObj && typeof packObj === "object") return packObj;
  }

  return null;
}

export function captionFrom(p) {
  const obj = pickPayloadObj(p);
  if (obj) {
    const c =
      safeText(obj.caption) ||
      safeText(obj.postCaption) ||
      safeText(obj.text) ||
      safeText(obj.description) ||
      "";
    if (c) return c;
  }

  const pack = pickDraftPackFromAnything(p);
  if (pack) {
    const c =
      safeText(pack.caption) ||
      safeText(pack.postCaption) ||
      safeText(pack.text) ||
      "";
    if (c) return c;
  }

  if (typeof p?.payload === "string" && p.payload.trim().length > 10) {
    return p.payload.trim();
  }

  return "";
}

export function titleFrom(p) {
  const obj = pickPayloadObj(p);
  if (obj) {
    const t =
      safeText(obj.title) ||
      safeText(obj.name) ||
      safeText(obj.topic) ||
      safeText(obj.summary) ||
      safeText(obj.goal);
    if (t) return t;
  }

  const cap = captionFrom(p);
  if (cap) return cap.slice(0, 86);

  return `Proposal #${String(p?.id || "").slice(0, 8)}`;
}

export function summaryOf(p) {
  const obj = pickPayloadObj(p);
  if (obj) {
    const s = normalizeInlineText(obj.summary || obj.description || obj.value || "");
    if (s) return s;
    const c = normalizeInlineText(obj.caption || obj.text || "");
    if (c) return c.slice(0, 140);
  }
  return "";
}

export function tagsFrom(p) {
  const obj = pickPayloadObj(p);
  if (obj) {
    const h = normalizeHashtags(obj.hashtags || obj.tags || obj.hashTags);
    if (h.length) return h;
  }

  const pack = pickDraftPackFromAnything(p);
  if (pack) {
    const h = normalizeHashtags(pack.hashtags || pack.tags || pack.hashTags);
    if (h.length) return h;
  }

  return [];
}

export function formatFrom(p) {
  const obj = pickPayloadObj(p);
  const pack = pickDraftPackFromAnything(p);

  const v =
    safeText(obj?.format) ||
    safeText(obj?.post_type) ||
    safeText(obj?.postType) ||
    safeText(pack?.format) ||
    safeText(pack?.post_type) ||
    safeText(pack?.postType) ||
    "";

  const s = String(v || "").toLowerCase();
  if (!s) return "";
  if (s.includes("reel") || s.includes("video")) return "Reel";
  if (s.includes("carousel")) return "Carousel";
  if (s.includes("story")) return "Story";
  if (s.includes("image") || s.includes("post")) return "Image";
  return v;
}

export function ctaFrom(p) {
  const obj = pickPayloadObj(p);
  const pack = pickDraftPackFromAnything(p);
  return (
    safeText(obj?.cta) ||
    safeText(obj?.callToAction) ||
    safeText(pack?.cta) ||
    safeText(pack?.callToAction) ||
    ""
  );
}

export function rawStatusOf(p) {
  return String(
    p?.status ||
      p?.latestContent?.status ||
      p?.latestDraft?.status ||
      p?.latest_draft?.status ||
      ""
  ).toLowerCase();
}

export function stageOf(p) {
  const s = rawStatusOf(p);
  if (s === "pending" || s === "in_progress" || s === "drafting" || s === "draft") return "draft";
  if (s === "approved") return "approved";
  if (s === "published") return "published";
  if (s === "rejected") return "rejected";
  return "draft";
}

export function stageLabel(p) {
  const s = rawStatusOf(p);
  if (s === "pending") return "needs approval";
  if (s === "in_progress") return "drafting";
  if (s === "approved") return "approved";
  if (s === "published") return "published";
  if (s === "rejected") return "rejected";
  if (s.startsWith("asset.")) return s;
  if (s.startsWith("publish.")) return s;
  return s || "";
}

export function stageTone(stage, rawStatus) {
  const st = String(stage || "").toLowerCase();
  const rs = String(rawStatus || "").toLowerCase();

  if (st === "draft") return rs === "pending" ? "warn" : "neutral";
  if (st === "approved") return "success";
  if (st === "published") return "success";
  if (st === "rejected") return "danger";
  return "neutral";
}

export function pickDraftCandidate(proposal) {
  return (
    proposal?.latestContent ||
    proposal?.latestDraft ||
    proposal?.latest_draft ||
    proposal?.draft ||
    proposal?.contentDraft ||
    proposal?.content_item ||
    proposal?.contentItem ||
    proposal?.latest_execution ||
    proposal?.lastExecution ||
    proposal?.latestExecution ||
    proposal?.execution ||
    proposal?.job ||
    (Array.isArray(proposal?.jobs) ? proposal.jobs[0] : null) ||
    null
  );
}

export function normalizeDraft(rawDraft) {
  if (!rawDraft) return null;
  const d = typeof rawDraft === "string" ? safeJson(rawDraft) : rawDraft;
  if (!d) return null;

  const contentPack =
    d.content_pack ||
    d.contentPack ||
    d.result?.contentPack ||
    d.result?.content_pack ||
    d.output?.contentPack ||
    d.output?.content_pack ||
    d.pack ||
    d.payload ||
    null;

  const pack = typeof contentPack === "string" ? safeJson(contentPack) : contentPack;
  const status = d.status || d.draftStatus || d.state || (pack ? "draft.ready" : "") || "";
  const version = Number(d.version || pack?.version || 1) || 1;

  return {
    id: d.id || d.contentItemId || d.content_item_id || d.content_item?.id || null,
    status,
    version,
    updatedAt: d.updated_at || d.updatedAt || null,
    lastFeedback: d.last_feedback || d.lastFeedback || "",
    pack: pack || null,
    raw: d,
  };
}

export function packType(pack) {
  if (!pack) return "";
  return pack.post_type || pack.postType || pack.format || pack.type || pack.assetType || "";
}

export function packCaption(pack) {
  if (!pack) return "";
  return normalizeInlineText(
    pack.caption ||
      pack.postCaption ||
      pack.text ||
      pack.copy ||
      pack.body ||
      pack.lines ||
      ""
  );
}

export function packHashtags(pack) {
  if (!pack) return [];
  return normalizeHashtags(pack.hashtags || pack.tags || pack.hashTags);
}

export function packPostTime(pack) {
  if (!pack) return "";
  return pack.post_time || pack.postTime || pack.suggestedTime || pack.time || "";
}

export function packLanguage(pack) {
  if (!pack) return "";
  return pack.language || pack.lang || "";
}

export function packPlatform(pack) {
  if (!pack) return "instagram";
  return pack.platform || "instagram";
}

export function packCta(pack) {
  if (!pack) return "";
  return normalizeInlineText(pack.cta || pack.call_to_action || pack.callToAction || "");
}

export function packReelScript(pack) {
  if (!pack) return "";
  return normalizeInlineText(pack.reel_script || pack.reelScript || pack.script || pack.voiceover || "");
}

export function packImagePrompt(pack) {
  if (!pack) return "";
  return normalizeInlineText(pack.image_prompt || pack.imagePrompt || pack.visual_prompt || pack.visualPrompt || "");
}

export function packDesign(pack) {
  if (!pack) return "";
  return normalizeInlineText(
    pack.design_instructions ||
      pack.designInstructions ||
      pack.layout_instructions ||
      pack.layoutInstructions ||
      pack.visual_direction ||
      pack.visualDirection ||
      ""
  );
}

export function packStoryboard(pack) {
  if (!pack) return null;
  return pack.storyboard || pack.shot_list || pack.shotList || pack.scenes || null;
}

export function packAssetSpecs(pack) {
  if (!pack) return null;
  return pack.asset_specs || pack.assetSpecs || pack.specs || pack.output_specs || null;
}

export function packHook(pack) {
  if (!pack) return "";
  return normalizeInlineText(pack.hook || pack.opening_line || pack.openingLine || "");
}

export function packKeyPoints(pack) {
  if (!pack) return null;
  return pack.key_points || pack.keyPoints || pack.bullets || null;
}

export function packMusic(pack) {
  if (!pack) return "";
  return normalizeInlineText(pack.music || pack.audio || pack.sound || "");
}

export function packCompliance(pack) {
  if (!pack) return "";
  return normalizeInlineText(pack.compliance_notes || pack.complianceNotes || pack.rules || "");
}

export function packShotDuration(pack) {
  if (!pack) return "";
  return normalizeInlineText(pack.duration || pack.video_duration || pack.videoDuration || "");
}

function addUrl(out, value) {
  const s = String(value || "").trim();
  if (!s) return;
  if (/^https?:\/\//i.test(s)) out.push(s);
}

export function collectUrlsDeep(node, out, depth = 0) {
  if (!node || depth > 6) return;

  if (typeof node === "string") {
    addUrl(out, node);
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) collectUrlsDeep(item, out, depth + 1);
    return;
  }

  if (typeof node !== "object") return;

  addUrl(out, node.url);
  addUrl(out, node.secure_url);
  addUrl(out, node.publicUrl);
  addUrl(out, node.public_url);
  addUrl(out, node.imageUrl);
  addUrl(out, node.image_url);
  addUrl(out, node.videoUrl);
  addUrl(out, node.video_url);
  addUrl(out, node.coverUrl);
  addUrl(out, node.cover_url);
  addUrl(out, node.thumbnailUrl);
  addUrl(out, node.thumbnail_url);
  addUrl(out, node.permalink);

  const likelyChildren = [
    node.assets,
    node.media,
    node.images,
    node.videos,
    node.publish,
    node.result,
    node.output,
    node.contentPack,
    node.content_pack,
    node.payload,
    node.data,
    node.item,
    node.items,
  ];

  for (const child of likelyChildren) {
    collectUrlsDeep(child, out, depth + 1);
  }
}

export function getAssetUrlsFromEverywhere(proposal, resolvedDraft, pack) {
  const out = [];

  collectUrlsDeep(pack, out);
  collectUrlsDeep(resolvedDraft?.raw, out);
  collectUrlsDeep(proposal?.latestContent, out);
  collectUrlsDeep(proposal?.latestDraft, out);
  collectUrlsDeep(proposal?.latest_draft, out);
  collectUrlsDeep(proposal?.draft, out);
  collectUrlsDeep(proposal?.contentDraft, out);
  collectUrlsDeep(proposal?.content_item, out);
  collectUrlsDeep(proposal?.contentItem, out);
  collectUrlsDeep(proposal?.result, out);
  collectUrlsDeep(proposal?.output, out);
  collectUrlsDeep(proposal?.publish, out);
  collectUrlsDeep(proposal?.media, out);
  collectUrlsDeep(proposal?.assets, out);
  collectUrlsDeep(proposal?.payload, out);

  return Array.from(new Set(out));
}

function statusLc(x) {
  return String(x || "").trim().toLowerCase();
}

export function isAssetReadyStatus(s) {
  const v = statusLc(s);
  return (
    v === "asset.ready" ||
    v === "assets.ready" ||
    v === "publish.ready" ||
    v === "approved" ||
    v === "draft.approved" ||
    v === "content.approved"
  );
}