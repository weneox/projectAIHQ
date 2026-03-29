import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const listComments = vi.fn();
const listProposals = vi.fn();
const getSettingsTrustView = vi.fn();

vi.mock("../api/comments.js", () => ({
  listComments: (...args) => listComments(...args),
}));

vi.mock("../api/proposals.js", () => ({
  listProposals: (...args) => listProposals(...args),
}));

vi.mock("../api/trust.js", () => ({
  getSettingsTrustView: (...args) => getSettingsTrustView(...args),
}));

import PublishPage from "./Publish.jsx";

describe("PublishPage", () => {
  it("renders the primary outgoing-work surface", async () => {
    listComments.mockResolvedValue({
      comments: [{ id: "c1", status: "pending", text: "Need review" }],
    });
    listProposals.mockResolvedValue([]);
    getSettingsTrustView.mockResolvedValue({ summary: {} });

    render(
      <MemoryRouter>
        <PublishPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: /publish workspace/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/what is waiting now/i)).toBeInTheDocument();
    expect(screen.getByText(/publishing posture/i)).toBeInTheDocument();
  });
});
