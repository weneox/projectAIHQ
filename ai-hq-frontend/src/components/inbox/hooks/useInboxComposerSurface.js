import { useCallback, useEffect, useState } from "react";

function noop() {}

export function useInboxComposerSurface({
  selectedThread,
  actionState,
  surface,
  sendOperatorReply,
  releaseHandoff,
}) {
  const [replyText, setReplyText] = useState("");

  useEffect(() => {
    setReplyText("");
  }, [selectedThread?.id]);

  const handleSend = useCallback(async () => {
    if (!selectedThread?.id) return;
    const ok = await sendOperatorReply(selectedThread.id, replyText.trim());
    if (ok !== false) {
      setReplyText("");
    }
  }, [replyText, selectedThread?.id, sendOperatorReply]);

  const handleRelease = useCallback(() => {
    if (!selectedThread?.id) return;
    return releaseHandoff(selectedThread.id);
  }, [releaseHandoff, selectedThread?.id]);

  return {
    replyText,
    setReplyText,
    composerSurface: {
      loading: false,
      error: "",
      unavailable: false,
      ready: Boolean(selectedThread?.id),
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
