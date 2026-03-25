import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/truth.js", () => ({
  getCanonicalTruthSnapshot: vi.fn().mockResolvedValue({
    fields: [
      {
        key: "companyName",
        label: "Company name",
        value: "North Clinic",
        provenance: "Website, https://north.example/about - Authority 1",
      },
    ],
    approval: {
      approvedAt: "2026-03-25T10:00:00.000Z",
      approvedBy: "reviewer@aihq.test",
      version: "approved",
    },
    history: [
      {
        id: "approval-1",
        version: "v3",
        versionLabel: "Truth version v3",
        previousVersionId: "v2",
        profileStatus: "approved",
        approvedAt: "2026-03-24T09:00:00.000Z",
        approvedBy: "owner@aihq.test",
        sourceSummary: "Website - https://north.example/about - 2 supporting sources",
        diffSummary: "companyName, websiteUrl, services",
      },
    ],
    notices: [],
    hasProvenance: true,
  }),
  getTruthVersionDetail: vi.fn().mockResolvedValue({
    selectedVersion: {
      id: "v3",
      version: "v3",
      versionLabel: "Truth version v3",
      approvedAt: "2026-03-25T10:00:00.000Z",
      approvedBy: "reviewer@aihq.test",
      sourceSummary: "Website - https://north.example/about",
    },
    comparedVersion: {
      id: "v2",
      version: "v2",
      versionLabel: "Truth version v2",
      approvedAt: "2026-03-24T09:00:00.000Z",
      approvedBy: "owner@aihq.test",
    },
    changedFields: [{ key: "companyName", label: "companyName" }],
    fieldChanges: [
      {
        key: "companyName",
        label: "Company name",
        beforeSummary: "Old Clinic",
        afterSummary: "North Clinic",
      },
    ],
    sectionChanges: [],
    diffSummary: "companyName changed",
    hasStructuredDiff: true,
  }),
}));

import TruthViewerPage from "./TruthViewerPage.jsx";

afterEach(() => {
  cleanup();
});

describe("Truth viewer smoke", () => {
  it("renders approved truth metadata, provenance, and history", async () => {
    render(<TruthViewerPage />);

    expect(
      screen.getByText(/loading approved business truth/i)
    ).toBeInTheDocument();

    expect(await screen.findByRole("heading", { name: /business truth/i })).toBeInTheDocument();
    expect(screen.getByText("2026-03-25T10:00:00.000Z")).toBeInTheDocument();
    expect(screen.getByText("reviewer@aihq.test")).toBeInTheDocument();
    expect(screen.getByText("North Clinic")).toBeInTheDocument();
    expect(
      screen.getByText(/field-level provenance is available/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/truth version timeline/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/truth version v3/i)).toBeInTheDocument();
    expect(screen.getByText(/source context:/i)).toBeInTheDocument();
    expect(screen.getByText(/changed fields:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/owner@aihq\.test/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /view compare/i }));
    expect(await screen.findByText(/version detail/i)).toBeInTheDocument();
    expect(screen.getByText(/old clinic/i)).toBeInTheDocument();
    expect(screen.getAllByText(/north clinic/i).length).toBeGreaterThan(1);
  });
});
