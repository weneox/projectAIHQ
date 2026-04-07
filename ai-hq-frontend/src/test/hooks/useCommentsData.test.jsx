import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
const apiPost = vi.fn();
const getAppSessionContext = vi.fn();

vi.mock("../../api/client.js", () => ({
  apiGet: (...args) => apiGet(...args),
  apiPost: (...args) => apiPost(...args),
}));

vi.mock("../../lib/appSession.js", () => ({
  getAppSessionContext: (...args) => getAppSessionContext(...args),
}));

import { useCommentsData } from "../../hooks/useCommentsData.js";

describe("useCommentsData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAppSessionContext.mockResolvedValue({
      tenantKey: "acme",
      actorName: "operator",
    });
    apiGet.mockResolvedValue({
      comments: [
        {
          id: "comment-1",
          channel: "instagram",
          customer_name: "Ada",
          text: "hello",
          external_post_id: "post-1",
          created_at: "2026-03-26T10:00:00.000Z",
          classification: {
            category: "question",
            sentiment: "positive",
            priority: "medium",
            moderation: {
              status: "pending",
            },
            reply: {
              text: "Hi",
            },
          },
        },
      ],
    });
    apiPost.mockResolvedValue({ ok: true });
  });

  it("groups comments into posts and preserves save success state", async () => {
    const { result } = renderHook(() => useCommentsData());

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
      expect(result.current.posts).toHaveLength(1);
      expect(result.current.selectedPost?.externalPostId).toBe("post-1");
      expect(result.current.postComments).toHaveLength(1);
      expect(result.current.selected?.id).toBe("comment-1");
      expect(result.current.replyDraft).toBe("Hi");
    });

    await act(async () => {
      await result.current.handleReview("reviewed");
    });

    expect(result.current.surface.saveSuccess).toMatch(/review updated/i);
    expect(result.current.actionLoading).toBe("");
  });
});
