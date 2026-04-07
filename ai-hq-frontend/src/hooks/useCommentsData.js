import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../api/client.js";
import { useActionState } from "./useActionState.js";
import { mapCommentToUi, s } from "../features/comments/comment-utils.js";
import { getAppSessionContext } from "../lib/appSession.js";
import { useAsyncSurfaceState } from "./useAsyncSurfaceState.js";

function firstText(...values) {
  for (const value of values) {
    const text = s(value);
    if (text) return text;
  }
  return "";
}

function toMs(value) {
  const date = new Date(value);
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function readPath(source, path) {
  const steps = String(path || "")
    .split(".")
    .filter(Boolean);

  let current = source;
  for (const step of steps) {
    if (!current || typeof current !== "object") return "";
    current = current[step];
  }

  return current;
}

const MEDIA_URL_PATHS = [
  "media_url",
  "mediaUrl",
  "image_url",
  "imageUrl",
  "thumbnail_url",
  "thumbnailUrl",
  "cover_url",
  "coverUrl",
  "preview_url",
  "previewUrl",
  "raw.media_url",
  "raw.thumbnail_url",
  "raw.image_url",
  "post.media_url",
  "post.thumbnail_url",
  "post.image_url",
  "media.media_url",
  "media.thumbnail_url",
  "media.image_url",
  "instagram.media_url",
  "instagram.thumbnail_url",
];

const PERMALINK_PATHS = [
  "permalink",
  "permalink_url",
  "permalinkUrl",
  "instagram_permalink",
  "instagramPermalink",
  "post.permalink",
  "media.permalink",
  "raw.permalink",
];

const CAPTION_PATHS = [
  "caption",
  "message",
  "text",
  "post.caption",
  "post.message",
  "media.caption",
  "raw.caption",
  "raw.message",
  "raw.text",
];

const POST_ID_PATHS = [
  "externalPostId",
  "external_post_id",
  "post_id",
  "media_id",
  "raw.post_id",
  "raw.media_id",
  "post.id",
  "media.id",
];

function extractMediaMeta(item = {}) {
  const sources = [
    item,
    item.raw,
    item.original,
    item.original?.raw,
    item.raw?.post,
    item.raw?.media,
    item.original?.raw?.post,
    item.original?.raw?.media,
  ].filter(Boolean);

  const coverUrl = firstText(
    ...sources.flatMap((source) =>
      MEDIA_URL_PATHS.map((path) => readPath(source, path))
    )
  );

  const permalink = firstText(
    ...sources.flatMap((source) =>
      PERMALINK_PATHS.map((path) => readPath(source, path))
    )
  );

  const caption = firstText(
    ...sources.flatMap((source) =>
      CAPTION_PATHS.map((path) => readPath(source, path))
    )
  );

  const externalPostId = firstText(
    item.externalPostId,
    ...sources.flatMap((source) =>
      POST_ID_PATHS.map((path) => readPath(source, path))
    )
  );

  return {
    coverUrl,
    permalink,
    caption,
    externalPostId,
  };
}

function buildPostKey(item = {}) {
  const media = extractMediaMeta(item);
  const postId = firstText(media.externalPostId, item.externalPostId);
  if (postId) return `post:${postId}`;

  const title = s(item.postTitle);
  if (title && title.toLowerCase() !== "post") {
    return `title:${title}`;
  }

  return `comment:${item.id}`;
}

function buildPostTitle(item = {}) {
  const media = extractMediaMeta(item);
  const explicitTitle = s(item.postTitle);

  if (explicitTitle && explicitTitle.toLowerCase() !== "post") {
    return explicitTitle;
  }

  if (media.caption) {
    return media.caption.length > 68
      ? `${media.caption.slice(0, 68).trim()}…`
      : media.caption;
  }

  if (media.externalPostId) {
    return `Post ${media.externalPostId.slice(0, 8)}`;
  }

  return "Untitled post";
}

function sortCommentsDesc(a, b) {
  return toMs(b.createdAt) - toMs(a.createdAt);
}

function groupCommentsToPosts(items = []) {
  const groups = new Map();

  for (const item of items) {
    const key = buildPostKey(item);
    const media = extractMediaMeta(item);
    const current = groups.get(key);

    if (!current) {
      groups.set(key, {
        id: key,
        platform: s(item.platform || "instagram"),
        title: buildPostTitle(item),
        externalPostId: firstText(media.externalPostId, item.externalPostId),
        coverUrl: media.coverUrl,
        permalink: media.permalink,
        caption: media.caption,
        totalComments: 1,
        pendingCount:
          item.status === "pending" || item.status === "manual_review" ? 1 : 0,
        latestActivityAt: item.createdAt,
        latestActivityMs: toMs(item.createdAt),
        comments: [item],
      });
      continue;
    }

    current.totalComments += 1;
    current.comments.push(item);

    if (item.status === "pending" || item.status === "manual_review") {
      current.pendingCount += 1;
    }

    const itemMs = toMs(item.createdAt);
    if (itemMs > current.latestActivityMs) {
      current.latestActivityMs = itemMs;
      current.latestActivityAt = item.createdAt;
    }

    if (!current.coverUrl && media.coverUrl) current.coverUrl = media.coverUrl;
    if (!current.permalink && media.permalink) current.permalink = media.permalink;
    if (!current.caption && media.caption) current.caption = media.caption;
    if (!current.externalPostId && media.externalPostId) {
      current.externalPostId = media.externalPostId;
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      comments: [...group.comments].sort(sortCommentsDesc),
    }))
    .sort((a, b) => b.latestActivityMs - a.latestActivityMs);
}

export function useCommentsData() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPostId, setSelectedPostId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [sessionContext, setSessionContext] = useState({
    tenantKey: "",
    actorName: "operator",
  });

  const actionState = useActionState();
  const {
    data: items,
    setData: setItems,
    surface,
    beginRefresh,
    succeedRefresh,
    failRefresh,
    beginSave,
    succeedSave,
    failSave,
    clearSaveState,
  } = useAsyncSurfaceState({
    initialData: [],
  });

  useEffect(() => {
    let alive = true;

    getAppSessionContext()
      .then((next) => {
        if (!alive) return;
        setSessionContext({
          tenantKey: s(next?.tenantKey).toLowerCase(),
          actorName: s(next?.actorName || "operator"),
        });
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
  }, []);

  const loadComments = useCallback(async () => {
    try {
      beginRefresh();

      const params = new URLSearchParams();
      params.set("limit", "100");
      if (sessionContext.tenantKey) {
        params.set("tenantKey", sessionContext.tenantKey);
      }

      const response = await apiGet(`/api/comments?${params.toString()}`);
      const mapped = Array.isArray(response?.comments)
        ? response.comments.map(mapCommentToUi)
        : [];

      return succeedRefresh(mapped);
    } catch (e) {
      return failRefresh(String(e?.message || e || "Failed to load comments"), {
        fallbackData: [],
        unavailable: true,
      });
    }
  }, [beginRefresh, failRefresh, sessionContext.tenantKey, succeedRefresh]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      const okStatus =
        statusFilter === "all" || s(item.status).toLowerCase() === statusFilter;

      const q = s(search).toLowerCase();
      const okSearch =
        !q ||
        s(item.author).toLowerCase().includes(q) ||
        s(item.text).toLowerCase().includes(q) ||
        s(item.postTitle).toLowerCase().includes(q) ||
        s(item.category).toLowerCase().includes(q) ||
        s(item.status).toLowerCase().includes(q) ||
        s(item.externalPostId).toLowerCase().includes(q);

      return okStatus && okSearch;
    });
  }, [items, search, statusFilter]);

  const posts = useMemo(() => groupCommentsToPosts(visibleItems), [visibleItems]);

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedPostId) || null,
    [posts, selectedPostId]
  );

  const postComments = selectedPost?.comments || [];

  const selected = useMemo(
    () => postComments.find((comment) => comment.id === selectedId) || null,
    [postComments, selectedId]
  );

  useEffect(() => {
    if (!posts.length) {
      setSelectedPostId("");
      return;
    }

    if (!selectedPostId) {
      setSelectedPostId(posts[0].id);
      return;
    }

    const exists = posts.some((post) => post.id === selectedPostId);
    if (!exists) {
      setSelectedPostId(posts[0].id);
    }
  }, [posts, selectedPostId]);

  useEffect(() => {
    if (!postComments.length) {
      setSelectedId("");
      return;
    }

    if (!selectedId) {
      setSelectedId(postComments[0].id);
      return;
    }

    const exists = postComments.some((comment) => comment.id === selectedId);
    if (!exists) {
      setSelectedId(postComments[0].id);
    }
  }, [postComments, selectedId]);

  useEffect(() => {
    setReplyDraft(selected?.suggestedReply || "");
  }, [selected?.id, selected?.suggestedReply]);

  async function handleReview(status) {
    if (!selected?.id) return;

    try {
      beginSave();
      const j = await actionState.runAction(`review:${status}`, () =>
        apiPost(`/api/comments/${selected.id}/review`, {
          status,
          actor: sessionContext.actorName || "operator",
          note: status === "manual_review" ? "Sent to manual review" : "",
        })
      );

      if (j?.ok === false) {
        throw new Error(
          j?.error || j?.details?.message || "Failed to review comment"
        );
      }

      await loadComments();
      succeedSave({
        message:
          status === "manual_review"
            ? "Comment sent to manual review."
            : "Comment review updated.",
      });
    } catch (e) {
      failSave(String(e?.message || e || "Failed to review comment"));
    }
  }

  async function handleReplySave() {
    if (!selected?.id) return;

    const replyText = s(replyDraft);
    if (!replyText) {
      failSave("Reply text is required");
      return;
    }

    try {
      beginSave();
      const j = await actionState.runAction("reply", () =>
        apiPost(`/api/comments/${selected.id}/reply`, {
          replyText,
          actor: sessionContext.actorName || "operator",
          approved: true,
        })
      );

      if (j?.ok === false) {
        throw new Error(
          j?.error || j?.details?.message || "Failed to save reply"
        );
      }

      await loadComments();
      succeedSave({ message: "Reply saved." });
    } catch (e) {
      failSave(String(e?.message || e || "Failed to save reply"));
    }
  }

  async function handleIgnore() {
    if (!selected?.id) return;

    try {
      beginSave();
      const j = await actionState.runAction("ignore", () =>
        apiPost(`/api/comments/${selected.id}/ignore`, {
          actor: sessionContext.actorName || "operator",
          note: "Ignored from comments panel",
        })
      );

      if (j?.ok === false) {
        throw new Error(
          j?.error || j?.details?.message || "Failed to ignore comment"
        );
      }

      await loadComments();
      succeedSave({ message: "Comment ignored." });
    } catch (e) {
      failSave(String(e?.message || e || "Failed to ignore comment"));
    }
  }

  const stats = useMemo(() => {
    let pending = 0;
    let replied = 0;
    let flagged = 0;

    for (const item of items) {
      if (item.status === "pending" || item.status === "manual_review") {
        pending += 1;
      }
      if (
        item.status === "replied" ||
        item.status === "approved" ||
        item.status === "reviewed"
      ) {
        replied += 1;
      }
      if (item.status === "flagged" || item.status === "ignored") {
        flagged += 1;
      }
    }

    return {
      total: items.length,
      pending,
      replied,
      flagged,
    };
  }, [items]);

  return {
    items,
    posts,
    postComments,
    stats,
    statusFilter,
    setStatusFilter,
    selectedPostId,
    setSelectedPostId,
    selectedId,
    setSelectedId,
    selectedPost,
    selected,
    search,
    setSearch,
    replyDraft,
    setReplyDraft,
    visibleCommentCount: visibleItems.length,
    loadComments,
    surface: {
      ...surface,
      refresh: loadComments,
      clearSaveState,
    },
    actionState,
    actionLoading: actionState.pendingAction,
    handleReview,
    handleReplySave,
    handleIgnore,
  };
}