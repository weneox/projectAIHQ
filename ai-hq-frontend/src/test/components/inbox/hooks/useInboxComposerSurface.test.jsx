import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useInboxComposerSurface } from "../../../../components/inbox/hooks/useInboxComposerSurface.js";

describe("useInboxComposerSurface", () => {
  it("keeps draft text out of the hook and sends explicit composer text", async () => {
    const sendOperatorReply = vi.fn().mockResolvedValue(true);
    const releaseHandoff = vi.fn();
    const clearSaveState = vi.fn();

    const { result } = renderHook(() =>
      useInboxComposerSurface({
        selectedThread: { id: "thread-1", handoff_active: true },
        actionState: { isActionPending: vi.fn().mockReturnValue(false) },
        surface: {
          saving: false,
          saveError: "",
          saveSuccess: "",
          clearSaveState,
        },
        sendOperatorReply,
        releaseHandoff,
      })
    );

    expect(result.current.replyText).toBeUndefined();
    expect(result.current.setReplyText).toBeUndefined();
    expect(result.current.composerSurface.ready).toBe(true);

    await act(async () => {
      const ok = await result.current.handleSend("hello");
      expect(ok).toBe(true);
    });

    expect(sendOperatorReply).toHaveBeenCalledTimes(1);
    expect(sendOperatorReply).toHaveBeenCalledWith("thread-1", "hello");
  });

  it("does not send empty text", async () => {
    const sendOperatorReply = vi.fn().mockResolvedValue(true);

    const { result } = renderHook(() =>
      useInboxComposerSurface({
        selectedThread: { id: "thread-1" },
        actionState: { isActionPending: vi.fn().mockReturnValue(false) },
        surface: {
          saving: false,
          saveError: "",
          saveSuccess: "",
          clearSaveState: vi.fn(),
        },
        sendOperatorReply,
        releaseHandoff: vi.fn(),
      })
    );

    await act(async () => {
      const ok = await result.current.handleSend("   ");
      expect(ok).toBe(false);
    });

    expect(sendOperatorReply).not.toHaveBeenCalled();
  });

  it("releases handoff for the selected thread", () => {
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
        sendOperatorReply: vi.fn(),
        releaseHandoff,
      })
    );

    result.current.handleRelease();

    expect(releaseHandoff).toHaveBeenCalledTimes(1);
    expect(releaseHandoff).toHaveBeenCalledWith("thread-1");
  });
});