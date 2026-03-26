import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listDurableExecutions = vi.fn();
const getDurableExecutionSummary = vi.fn();
const getDurableExecution = vi.fn();
const retryDurableExecution = vi.fn();

vi.mock("../../api/executions.js", () => ({
  listDurableExecutions: (...args) => listDurableExecutions(...args),
  getDurableExecutionSummary: (...args) => getDurableExecutionSummary(...args),
  getDurableExecution: (...args) => getDurableExecution(...args),
  retryDurableExecution: (...args) => retryDurableExecution(...args),
}));

import { useExecutionsSurface } from "./useExecutionsSurface.js";

describe("useExecutionsSurface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listDurableExecutions.mockResolvedValue([
      {
        id: "exec-1",
        tenant_key: "acme",
        provider: "meta",
        channel: "instagram",
        action_type: "meta.outbound.send",
        status: "retryable",
      },
    ]);
    getDurableExecutionSummary.mockResolvedValue({ counts: { retryable: 1 } });
    getDurableExecution.mockResolvedValue({
      execution: { id: "exec-1", status: "retryable", action_type: "meta.outbound.send" },
      attempts: [],
      auditTrail: [],
    });
    retryDurableExecution.mockResolvedValue({
      execution: { id: "exec-1", status: "pending" },
      auditTrail: [],
    });
  });

  it("exposes the shared surface contract and retry success state", async () => {
    const { result } = renderHook(() => useExecutionsSurface());

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
    });

    await act(async () => {
      await result.current.openExecution("exec-1");
    });

    await act(async () => {
      await result.current.retrySelectedExecution();
    });

    expect(result.current.surface.saveSuccess).toMatch(/manual retry requested/i);
    expect(retryDurableExecution).toHaveBeenCalledWith("exec-1");
    expect(result.current.actionState.pendingAction).toBe("");
  });
});
