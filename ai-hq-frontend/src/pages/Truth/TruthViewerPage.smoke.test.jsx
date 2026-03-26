import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dispatchRepairAction = vi.fn();

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
    readiness: {
      status: "ready",
      blockers: [],
    },
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

vi.mock("../../components/readiness/dispatchRepairAction.js", () => ({
  dispatchRepairAction: (...args) => dispatchRepairAction(...args),
}));

import TruthViewerPage from "./TruthViewerPage.jsx";
import {
  getCanonicalTruthSnapshot,
} from "../../api/truth.js";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  dispatchRepairAction.mockReset();
  dispatchRepairAction.mockResolvedValue({ ok: true });
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

  it("shows an explicit approved truth unavailable state without fallback data", async () => {
    getCanonicalTruthSnapshot.mockResolvedValueOnce({
      fields: [],
      approval: { approvedAt: "", approvedBy: "", version: "" },
      history: [],
      notices: [
        "Approved truth is unavailable. No non-approved fallback data is being shown.",
      ],
      hasProvenance: false,
      approvedTruthUnavailable: true,
      readiness: {
        status: "blocked",
        reasonCode: "approved_truth_unavailable",
        intentionallyUnavailable: true,
        blockers: [
          {
            blocked: true,
            category: "truth",
            dependencyType: "approved_truth",
            reasonCode: "approved_truth_unavailable",
            title: "Approved truth blocker",
            subtitle: "No approved truth is being shown.",
            missing: ["approved_truth"],
            suggestedRepairActionId: "open_setup_route",
            nextAction: {
              id: "open_setup_route",
              kind: "route",
              label: "Open setup",
              requiredRole: "operator",
              allowed: true,
              target: {
                path: "/setup/studio",
              },
            },
          },
        ],
      },
    });

    render(<TruthViewerPage />);

    expect(
      await screen.findByText(/approved truth is currently unavailable/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/approved truth blocker/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open setup/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /open setup/i }));
    expect(dispatchRepairAction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "open_setup_route",
        kind: "route",
        target: { path: "/setup/studio" },
      })
    );
    expect(
      screen.getByText(/no non-approved fallback data is being shown/i)
    ).toBeInTheDocument();
  });
});
