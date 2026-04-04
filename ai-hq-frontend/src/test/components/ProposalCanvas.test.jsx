import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ProposalCanvas from "../../components/ProposalCanvas.jsx";

describe("ProposalCanvas", () => {
  it("shows queue breakdown and exact backend queue states", () => {
    render(
      <ProposalCanvas
        proposals={[
          { id: "proposal-1", status: "draft", title: "Draft item" },
          { id: "proposal-2", status: "in_progress", title: "In progress item" },
          { id: "proposal-3", status: "pending", title: "Pending item" },
        ]}
        stats={{
          draft: 3,
          in_progress: 1,
          pending: 1,
          approved: 0,
          published: 0,
          rejected: 0,
        }}
        status="draft"
        setStatus={vi.fn()}
        search=""
        setSearch={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onPublish={vi.fn()}
        onAnalyze={vi.fn()}
        onRequestChanges={vi.fn()}
        onRefresh={vi.fn()}
        toast=""
        wsStatus={{ state: "off" }}
        busy={false}
      />
    );

    expect(screen.getAllByText(/^queue$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/drafting/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/needs approval/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/acceptance is not terminal success/i)
    ).toBeInTheDocument();
  });
});
