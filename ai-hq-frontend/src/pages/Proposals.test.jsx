import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listProposals = vi.fn();
const requestDraftChanges = vi.fn();
const approveDraft = vi.fn();
const rejectDraft = vi.fn();
const publishDraft = vi.fn();
const analyzeDraft = vi.fn();

vi.mock("../api/proposals.js", () => ({
  listProposals: (...args) => listProposals(...args),
  requestDraftChanges: (...args) => requestDraftChanges(...args),
  approveDraft: (...args) => approveDraft(...args),
  rejectDraft: (...args) => rejectDraft(...args),
  publishDraft: (...args) => publishDraft(...args),
  analyzeDraft: (...args) => analyzeDraft(...args),
}));

vi.mock("../lib/realtime/realtimeStore.js", () => ({
  realtimeStore: {
    subscribeStatus: () => () => {},
    subscribeEvents: () => () => {},
    canUseWs: () => false,
  },
}));

vi.mock("../components/ProposalCanvas.jsx", () => ({
  default: ({
    status,
    toast,
    onApprove,
    onPublish,
  }) => (
    <div>
      <div>canvas-status:{status}</div>
      <div>{toast}</div>
      <button
        type="button"
        onClick={() =>
          onApprove(
            { id: "proposal-1", latestContent: { id: "content-1" } },
            { id: "content-1" }
          )
        }
      >
        approve
      </button>
      <button
        type="button"
        onClick={() =>
          onPublish(
            { id: "proposal-1", latestContent: { id: "content-1" } },
            { id: "content-1" }
          )
        }
      >
        publish
      </button>
    </div>
  ),
}));

import ProposalsPage from "./Proposals.jsx";

function makeListProposalsMock({ publishedItems = [] } = {}) {
  return vi.fn(async (status) => {
    if (status === "draft") {
      return [{ id: "proposal-1", status: "draft", latestContent: { id: "content-1" } }];
    }
    if (status === "published") {
      return publishedItems;
    }
    return [];
  });
}

describe("ProposalsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestDraftChanges.mockResolvedValue({ ok: true });
    approveDraft.mockResolvedValue({ ok: true, jobId: "job-approve-1" });
    rejectDraft.mockResolvedValue({ ok: true });
    publishDraft.mockResolvedValue({ ok: true, jobId: "job-publish-1" });
    analyzeDraft.mockResolvedValue({ ok: true });
  });

  it("keeps publish acceptance separate from terminal published state", async () => {
    listProposals.mockImplementation(makeListProposalsMock({ publishedItems: [] }));

    render(<ProposalsPage />);

    await screen.findByText(/canvas-status:draft/i);

    fireEvent.click(screen.getByRole("button", { name: /publish/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/publish accepted\. job job-publish-1 is now carrying the work\./i)
      ).toBeInTheDocument();
    });

    expect(screen.queryByText(/^published$/i)).not.toBeInTheDocument();
  });

  it("uses accepted approval messaging instead of implying asset success", async () => {
    listProposals.mockImplementation(makeListProposalsMock({ publishedItems: [] }));

    render(<ProposalsPage />);

    await screen.findByText(/canvas-status:draft/i);

    fireEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/approval accepted\. job job-approve-1 is now carrying the work\./i)
      ).toBeInTheDocument();
    });

    expect(screen.queryByText(/asset generation started/i)).not.toBeInTheDocument();
  });
});
