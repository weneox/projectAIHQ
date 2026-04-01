import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
const apiPost = vi.fn();

vi.mock("../api/client.js", () => ({
  apiGet: (...args) => apiGet(...args),
  apiPost: (...args) => apiPost(...args),
}));

import { useInboxData } from "./useInboxData.js";

describe("useInboxData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiGet.mockImplementation((path) => {
      if (String(path) === "/api/inbox/threads") {
        return Promise.resolve({
          threads: [{ id: "thread-1", status: "open", handoff_active: false, unread_count: 1 }],
          dbDisabled: false,
        });
      }
      if (String(path).startsWith("/api/inbox/threads/thread-1/messages")) {
        return Promise.resolve({ messages: [] });
      }
      if (String(path) === "/api/leads/by-thread/thread-1") {
        return Promise.resolve({ lead: { id: "lead-1", inbox_thread_id: "thread-1" } });
      }
      if (String(path) === "/api/inbox/threads/thread-1") {
        return Promise.resolve({ thread: { id: "thread-1", status: "open", handoff_active: false } });
      }
      return Promise.resolve({});
    });
    apiPost.mockResolvedValue({ ok: true });
  });

  it("exposes the shared surface contract and reply success state", async () => {
    const { result } = renderHook(() => useInboxData({ filter: "all", operatorName: "operator", navigate: vi.fn() }));

    await act(async () => {
      await result.current.loadThreads();
    });

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
      expect(result.current.threads).toHaveLength(1);
      expect(result.current.detailSurface).toBeDefined();
      expect(result.current.leadSurface).toBeDefined();
    });

    await act(async () => {
      result.current.setSelectedThread({ id: "thread-1", handoff_active: true });
    });

    await act(async () => {
      await result.current.loadRelatedLead("thread-1");
    });

    await act(async () => {
      await result.current.sendOperatorReply("thread-1", "hello");
    });

    expect(apiGet).toHaveBeenCalledWith("/api/leads/by-thread/thread-1");
    expect(result.current.relatedLead?.id).toBe("lead-1");
    expect(result.current.surface.saveSuccess).toMatch(/reply accepted/i);
    expect(result.current.surface.saveSuccess).toMatch(
      /waiting for outbound attempt status/i
    );
    expect(result.current.actionState.pendingAction).toBe("");
  });
});
