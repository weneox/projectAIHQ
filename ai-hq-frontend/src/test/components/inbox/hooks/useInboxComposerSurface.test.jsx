import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useInboxComposerSurface } from "../../../../components/inbox/hooks/useInboxComposerSurface.js";

describe("useInboxComposerSurface", () => {
  it("keeps reply draft local and clears it after successful send", async () => {
    const sendOperatorReply = vi.fn().mockResolvedValue(true);
    const releaseHandoff = vi.fn();

    const { result } = renderHook(() =>
      useInboxComposerSurface({
        selectedThread: { id: "thread-1", handoff_active: true },
        actionState: { isActionPending: vi.fn().mockReturnValue(false) },
        surface: {
          saving: false,
          saveError: "",
          saveSuccess: "",
          clearSaveState: vi.fn(),
        },
        sendOperatorReply,
        releaseHandoff,
      })
    );

    await act(async () => {
      result.current.setReplyText("hello");
    });

    await act(async () => {
      await result.current.handleSend();
    });

    expect(sendOperatorReply).toHaveBeenCalledWith("thread-1", "hello");
    expect(result.current.replyText).toBe("");
  });
});
