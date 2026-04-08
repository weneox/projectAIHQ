import { useState } from "react";

function noop() {}

export function useInboxComposerSurface({
  selectedThread,
  actionState,
  surface,
  sendOperatorReply,
  releaseHandoff,
}) {
  const selectedThreadId = String(selectedThread?.id || "").trim();
  const [composerState, setComposerState] = useState({
    threadId: "",
    text: "",
  });

  const replyText =
    composerState.threadId === selectedThreadId ? composerState.text : "";

  function setReplyText(nextValue) {
    const threadId = selectedThreadId;

    setComposerState((prev) => {
      const previousText = prev.threadId === threadId ? prev.text : "";
      const resolvedText =
        typeof nextValue === "function" ? nextValue(previousText) : nextValue;

      return {
        threadId,
        text: String(resolvedText ?? ""),
      };
    });
  }

  async function handleSend() {
    if (!selectedThreadId) return;

    const trimmed = replyText.trim();
    if (!trimmed) return;

    const ok = await sendOperatorReply(selectedThreadId, trimmed);
    if (ok !== false) {
      setComposerState({
        threadId: selectedThreadId,
        text: "",
      });
    }
  }

  function handleRelease() {
    if (!selectedThreadId) return;
    return releaseHandoff(selectedThreadId);
  }

  return {
    replyText,
    setReplyText,
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