import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listThreadOutboundAttempts = vi.fn();
const resendOutboundAttempt = vi.fn();
const markOutboundAttemptDead = vi.fn();

vi.mock("../../../api/inbox.js", () => ({
  listThreadOutboundAttempts: (...args) => listThreadOutboundAttempts(...args),
  resendOutboundAttempt: (...args) => resendOutboundAttempt(...args),
  markOutboundAttemptDead: (...args) => markOutboundAttemptDead(...args),
}));

import { useThreadOutboundAttemptsSurface } from "./useThreadOutboundAttemptsSurface.js";

describe("useThreadOutboundAttemptsSurface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listThreadOutboundAttempts.mockResolvedValue({
      attempts: [{ id: "attempt-1", status: "failed", attempt_count: 1, max_attempts: 3 }],
    });
    resendOutboundAttempt.mockResolvedValue({ ok: true });
    markOutboundAttemptDead.mockResolvedValue({ ok: true });
  });

  it("exposes shared surface state and mark-dead success feedback", async () => {
    const { result } = renderHook(() =>
      useThreadOutboundAttemptsSurface({ threadId: "thread-1", actor: "operator" })
    );

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
      expect(result.current.attempts).toHaveLength(1);
    });

    await act(async () => {
      await result.current.handleMarkDead("attempt-1");
    });

    expect(result.current.surface.saveSuccess).toMatch(/marked dead/i);
    expect(result.current.actionState.pendingAction).toBe("");
  });

  it("uses accepted retry feedback instead of implying delivery", async () => {
    const { result } = renderHook(() =>
      useThreadOutboundAttemptsSurface({ threadId: "thread-1", actor: "operator" })
    );

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
    });

    await act(async () => {
      await result.current.handleResend("attempt-1");
    });

    expect(result.current.surface.saveSuccess).toMatch(/retry accepted/i);
    expect(result.current.surface.saveSuccess).toMatch(
      /waiting for outbound attempt status to move/i
    );
  });
});
