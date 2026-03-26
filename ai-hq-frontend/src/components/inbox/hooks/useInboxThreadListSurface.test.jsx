import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useInboxThreadListSurface } from "./useInboxThreadListSurface.js";

describe("useInboxThreadListSurface", () => {
  it("derives list stats, filters, and deep-link hydration", async () => {
    const setSelectedThread = vi.fn((updater) => {
      if (typeof updater === "function") {
        updater({ id: "thread-2" });
      }
    });
    const loadThreads = vi.fn().mockResolvedValue(undefined);
    const loadThreadDetail = vi.fn().mockResolvedValue(undefined);
    const loadMessages = vi.fn().mockResolvedValue(undefined);
    const loadRelatedLead = vi.fn().mockResolvedValue(undefined);

    const { result, rerender } = renderHook(
      ({ threads, requestedThreadId, selectedThread, loading }) =>
        useInboxThreadListSurface({
          requestedThreadId,
          threads,
          selectedThread,
          setSelectedThread,
          surface: { loading, error: "", unavailable: false, ready: true, refresh: vi.fn() },
          loadThreads,
          loadThreadDetail,
          loadMessages,
          loadRelatedLead,
        }),
      {
        initialProps: {
          threads: [],
          requestedThreadId: "thread-2",
          selectedThread: null,
          loading: false,
        },
      }
    );

    await waitFor(() => {
      expect(loadThreads).toHaveBeenCalledWith("thread-2");
    });

    await waitFor(() => {
      expect(loadThreadDetail).toHaveBeenCalledWith("thread-2");
      expect(loadMessages).toHaveBeenCalledWith("thread-2");
      expect(loadRelatedLead).toHaveBeenCalledWith("thread-2");
    });

    rerender({
      threads: [
        { id: "thread-1", status: "open", handoff_active: false, unread_count: 2 },
        { id: "thread-2", status: "resolved", handoff_active: false },
      ],
      requestedThreadId: "",
      selectedThread: { id: "thread-2" },
      loading: false,
    });

    expect(result.current.stats.open).toBe(1);
    expect(result.current.stats.resolved).toBe(1);

    act(() => {
      result.current.setFilter("resolved");
    });

    expect(result.current.filteredThreads).toHaveLength(1);
    expect(result.current.filteredThreads[0].id).toBe("thread-2");
  });
});
