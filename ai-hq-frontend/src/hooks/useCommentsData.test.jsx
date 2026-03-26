import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
const apiPost = vi.fn();
const getAppSessionContext = vi.fn();

vi.mock("../api/client.js", () => ({
  apiGet: (...args) => apiGet(...args),
  apiPost: (...args) => apiPost(...args),
}));

vi.mock("../lib/appSession.js", () => ({
  getAppSessionContext: (...args) => getAppSessionContext(...args),
}));

import { useCommentsData } from "./useCommentsData.js";

describe("useCommentsData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAppSessionContext.mockResolvedValue({ tenantKey: "acme", actorName: "operator" });
    apiGet.mockResolvedValue({
      comments: [
        {
          id: "comment-1",
          author: "Ada",
          text: "hello",
          postTitle: "Post",
          category: "question",
          status: "pending",
          sentiment: "positive",
          priority: "medium",
          suggestedReply: "Hi",
          createdAt: "2026-03-26T10:00:00.000Z",
        },
      ],
    });
    apiPost.mockResolvedValue({ ok: true });
  });

  it("exposes the shared surface contract and save success state", async () => {
    const { result } = renderHook(() => useCommentsData());

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
      expect(result.current.filtered).toHaveLength(1);
    });

    await act(async () => {
      await result.current.handleReview("reviewed");
    });

    expect(result.current.surface.saveSuccess).toMatch(/review updated/i);
    expect(result.current.actionLoading).toBe("");
  });
});
