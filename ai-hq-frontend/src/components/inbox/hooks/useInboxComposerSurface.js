function noop() {}

function s(value = "") {
  return String(value ?? "").trim();
}

export function useInboxComposerSurface({
  selectedThread,
  actionState,
  surface,
  sendOperatorReply,
  releaseHandoff,
}) {
  const selectedThreadId = s(selectedThread?.id);

  async function handleSend(nextText = "") {
    if (!selectedThreadId) return false;

    const trimmed = s(nextText);
    if (!trimmed) return false;

    const ok = await sendOperatorReply(selectedThreadId, trimmed);
    return ok !== false;
  }

  function handleRelease() {
    if (!selectedThreadId) return null;
    return releaseHandoff(selectedThreadId);
  }

  return {
    /**
     * Intentionally undefined.
     *
     * The draft text now lives inside InboxComposer, not in Inbox.jsx.
     * This prevents every keystroke from rerendering the whole Inbox page,
     * thread list, detail panel, and all message bubbles.
     */
    replyText: undefined,
    setReplyText: undefined,

    composerSurface: {
      loading: false,
      error: "",
      unavailable: false,
      ready: Boolean(selectedThreadId),
      saving: Boolean(surface?.saving),
      saveError: surface?.saveError || "",
      saveSuccess: surface?.saveSuccess || "",
      refresh: noop,
      clearSaveState: surface?.clearSaveState || noop,
    },

    actionState,
    handleSend,
    handleRelease,
  };
}