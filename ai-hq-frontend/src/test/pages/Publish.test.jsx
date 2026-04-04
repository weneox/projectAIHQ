import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const listComments = vi.fn();
const listProposals = vi.fn();
const getSettingsTrustView = vi.fn();

vi.mock("../../api/comments.js", () => ({
  listComments: (...args) => listComments(...args),
}));

vi.mock("../../api/proposals.js", () => ({
  listProposals: (...args) => listProposals(...args),
}));

vi.mock("../../api/trust.js", () => ({
  getSettingsTrustView: (...args) => getSettingsTrustView(...args),
}));

import PublishPage from "../../pages/Publish.jsx";

describe("PublishPage", () => {
  it("renders execution-aware publish outcome state without narrating accepted work as published", async () => {
    listComments.mockResolvedValue({
      comments: [{ id: "c1", status: "pending", text: "Need review" }],
    });
    listProposals.mockImplementation(async (status) => {
      if (status === "approved") {
        return [
          {
            id: "p-queued",
            status: "approved",
            title: "Queued publish",
            latest_execution: {
              id: "exec-1",
              status: "queued",
            },
          },
          {
            id: "p-retrying",
            status: "approved",
            title: "Retrying publish",
            latest_execution: {
              id: "exec-2",
              status: "retrying",
              attempt_count: 2,
              max_attempts: 5,
            },
          },
          {
            id: "p-failed",
            status: "approved",
            title: "Failed publish",
            latest_execution: {
              id: "exec-3",
              status: "failed",
            },
          },
          {
            id: "p-unconfirmed",
            status: "approved",
            title: "Unconfirmed publish",
            latest_execution: {
              id: "exec-4",
              status: "completed",
              output: {
                published: false,
              },
            },
          },
        ];
      }

      if (status === "published") {
        return [
          {
            id: "p-confirmed",
            status: "published",
            title: "Confirmed publish",
            latest_execution: {
              id: "exec-5",
              status: "completed",
              output: {
                published: true,
              },
            },
          },
        ];
      }

      return [];
    });
    getSettingsTrustView.mockResolvedValue({ summary: {} });

    render(
      <MemoryRouter>
        <PublishPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/publish workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/what is waiting now/i)).toBeInTheDocument();
    expect(screen.getAllByText(/publishing posture/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^needs intervention$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/queued publish/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/^retry lineage$/i)).toBeInTheDocument();
    expect(screen.getByText(/failed or unconfirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/^in-flight publish$/i)).toBeInTheDocument();
    expect(screen.getByText(/publish was accepted and queued\. it is not confirmed yet\./i)).toBeInTheDocument();
    expect(screen.getByText(/publish retry lineage is active as retry 2 of 5\. it is not confirmed yet\./i)).toBeInTheDocument();
    expect(screen.getByText(/latest publish execution failed\. this record is not published\./i)).toBeInTheDocument();
    expect(screen.getByText(/latest publish execution completed without publish confirmation on this record\./i)).toBeInTheDocument();
    expect(screen.getByText(/^confirmed publish$/i)).toBeInTheDocument();
    expect(screen.queryByText(/this item was already published/i)).not.toBeInTheDocument();

    const publishStateSection = screen.getByText(/recent publish state/i).closest("section");
    expect(publishStateSection).toBeTruthy();

    const publishRows = Array.from(
      publishStateSection.querySelectorAll(".text-\\[16px\\]")
    ).map((node) => node.textContent);
    expect(publishRows.slice(0, 4)).toEqual([
      "Failed publish",
      "Unconfirmed publish",
      "Retrying publish",
      "Queued publish",
    ]);

    expect(screen.getAllByText(/needs intervention/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/retrying/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/queued/i).length).toBeGreaterThan(0);
  });
});
