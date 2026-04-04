import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../api/client.js";
import { useActionState } from "./useActionState.js";
import { mapCommentToUi, s } from "../features/comments/comment-utils.js";
import { getAppSessionContext } from "../lib/appSession.js";
import { useAsyncSurfaceState } from "./useAsyncSurfaceState.js";

export function useCommentsData() {
  const [statusFilter, setStatusFilter] = useState("all");
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

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const okStatus = statusFilter === "all" || item.status === statusFilter;

      const q = search.trim().toLowerCase();
      const okSearch =
        !q ||
        item.author.toLowerCase().includes(q) ||
        item.text.toLowerCase().includes(q) ||
        item.postTitle.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q);

      return okStatus && okSearch;
    });
  }, [items, statusFilter, search]);

  const selected = useMemo(
    () => filtered.find((x) => x.id === selectedId) || null,
    [filtered, selectedId]
  );

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId("");
      return;
    }

    if (!selectedId) {
      setSelectedId(filtered[0].id);
      return;
    }

    const exists = filtered.some((x) => x.id === selectedId);
    if (!exists) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    setReplyDraft(selected?.suggestedReply || "");
  }, [selected?.id, selected?.suggestedReply]);

  const stats = useMemo(() => {
    let pending = 0;
    let replied = 0;
    let flagged = 0;

    for (const item of items) {
      if (item.status === "pending" || item.status === "manual_review") pending += 1;
      if (item.status === "replied" || item.status === "approved" || item.status === "reviewed") replied += 1;
      if (item.status === "flagged" || item.status === "ignored") flagged += 1;
    }

    return {
      total: items.length,
      pending,
      replied,
      flagged,
    };
  }, [items]);

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
        throw new Error(j?.error || j?.details?.message || "Failed to review comment");
      }

      await loadComments();
      succeedSave({ message: status === "manual_review" ? "Comment sent to manual review." : "Comment review updated." });
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
        throw new Error(j?.error || j?.details?.message || "Failed to save reply");
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
        throw new Error(j?.error || j?.details?.message || "Failed to ignore comment");
      }

      await loadComments();
      succeedSave({ message: "Comment ignored." });
    } catch (e) {
      failSave(String(e?.message || e || "Failed to ignore comment"));
    }
  }

  return {
    items,
    statusFilter,
    setStatusFilter,
    selectedId,
    setSelectedId,
    search,
    setSearch,
    replyDraft,
    setReplyDraft,
    loadComments,
    filtered,
    selected,
    stats,
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
