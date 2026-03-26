import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getOutboundSummary = vi.fn();
const listFailedOutboundAttempts = vi.fn();
const resendOutboundAttempt = vi.fn();
const markOutboundAttemptDead = vi.fn();

vi.mock("../../../api/inbox.js", () => ({
  getOutboundSummary: (...args) => getOutboundSummary(...args),
  listFailedOutboundAttempts: (...args) => listFailedOutboundAttempts(...args),
  resendOutboundAttempt: (...args) => resendOutboundAttempt(...args),
  markOutboundAttemptDead: (...args) => markOutboundAttemptDead(...args),
}));

import { useRetryQueueSurface } from "./useRetryQueueSurface.js";

describe("useRetryQueueSurface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOutboundSummary.mockResolvedValue({ summary: { failed: 2, retrying: 1 } });
    listFailedOutboundAttempts.mockResolvedValue({
      attempts: [{ id: "attempt-1", status: "failed", attempt_count: 1, max_attempts: 3 }],
    });
    resendOutboundAttempt.mockResolvedValue({ ok: true });
    markOutboundAttemptDead.mockResolvedValue({ ok: true });
  });

  it("exposes shared surface state and retry success feedback", async () => {
    const { result } = renderHook(() => useRetryQueueSurface({ tenantKey: "acme", actor: "operator" }));

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
      expect(result.current.attempts).toHaveLength(1);
    });

    await act(async () => {
      await result.current.handleResend("attempt-1");
    });

    expect(result.current.surface.saveSuccess).toMatch(/retry queued/i);
    expect(result.current.actionState.pendingAction).toBe("");
  });
});
