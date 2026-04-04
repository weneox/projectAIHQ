import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useCommentsData = vi.fn();

vi.mock("../../hooks/useCommentsData.js", () => ({
  useCommentsData: () => useCommentsData(),
}));

import Comments from "../../pages/Comments.jsx";

describe("Comments", () => {
  it("renders shared surface feedback through the page shell", () => {
    useCommentsData.mockReturnValue({
      statusFilter: "all",
      setStatusFilter: vi.fn(),
      setSelectedId: vi.fn(),
      search: "",
      setSearch: vi.fn(),
      replyDraft: "",
      setReplyDraft: vi.fn(),
      surface: {
        loading: false,
        error: "",
        unavailable: true,
        ready: false,
        saving: false,
        saveError: "",
        saveSuccess: "Comment ignored.",
        refresh: vi.fn(),
      },
      actionLoading: "",
      filtered: [],
      selected: null,
      stats: { total: 0, pending: 0, replied: 0, flagged: 0 },
      handleReview: vi.fn(),
      handleReplySave: vi.fn(),
      handleIgnore: vi.fn(),
    });

    render(<Comments />);

    expect(screen.getByRole("heading", { name: "Comments" })).toBeInTheDocument();
    expect(screen.getByText(/^Comment ignored$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Comments unavailable$/i)).toBeInTheDocument();
  });
});
