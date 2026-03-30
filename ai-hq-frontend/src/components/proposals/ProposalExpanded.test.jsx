import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../api/client.js", () => ({
  getApiBase: () => "http://localhost:3000",
}));

vi.mock("../../features/proposals/proposal.api.js", () => ({
  fetchLatestDraft: vi.fn(),
}));

import ProposalExpanded from "./ProposalExpanded.jsx";

describe("ProposalExpanded", () => {
  it("renders execution truth without narrating queued publish work as published", () => {
    render(
      <ProposalExpanded
        item={{
          id: "proposal-1",
          status: "approved",
          title: "Queued publish",
          latestContent: {
            id: "content-1",
            status: "asset.ready",
            version: 3,
            content_pack: {
              caption: "Operator-facing caption",
              platform: "instagram",
              format: "image",
            },
          },
          latest_execution: {
            id: "exec-1",
            status: "queued",
            attempt_count: 2,
            max_attempts: 5,
            output: {
              published: false,
            },
          },
        }}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onPublish={vi.fn()}
        onAnalyze={vi.fn()}
        onRequestChanges={vi.fn()}
        busy={false}
      />
    );

    expect(screen.getByText(/execution queued/i)).toBeInTheDocument();
    expect(screen.getAllByText(/retry 2 of 5/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/publish not confirmed/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/latest execution is queued\. publish has not been confirmed\./i)
    ).toBeInTheDocument();
  });
});
