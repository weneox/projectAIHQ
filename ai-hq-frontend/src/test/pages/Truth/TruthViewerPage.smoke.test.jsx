/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const useWorkspaceTenantKey = vi.fn();

vi.mock("../../../api/truth.js", () => ({
  getCanonicalTruthSnapshot: vi.fn().mockResolvedValue({
    fields: [
      {
        key: "companyName",
        label: "Company name",
        value: "North Clinic",
        provenance: "Website, https://north.example/about - Authority 1",
      },
      {
        key: "description",
        label: "Summary",
        value: "Cosmetic dentistry and consultation-led care.",
        provenance: "Website, https://north.example/about - Authority 1",
      },
      {
        key: "primaryPhone",
        label: "Phone",
        value: "+15551112222",
        provenance: "Website, https://north.example/contact - Authority 1",
      },
      {
        key: "websiteUrl",
        label: "Website",
        value: "https://north.example",
        provenance: "Website, https://north.example - Authority 1",
      },
    ],
    approval: {
      approvedAt: "2026-03-25T10:00:00.000Z",
      approvedBy: "reviewer@aihq.test",
      version: "v3",
    },
    history: [
      {
        id: "v3",
        version: "v3",
        versionLabel: "Truth version v3",
        previousVersionId: "v2",
        profileStatus: "approved",
        approvedAt: "2026-03-24T09:00:00.000Z",
        approvedBy: "owner@aihq.test",
        sourceSummary: "Website - https://north.example/about",
        diffSummary: "companyName changed",
      },
    ],
    notices: [],
    hasProvenance: true,
    approvedTruthUnavailable: false,
    readiness: {
      status: "ready",
      blockers: [],
    },
    sourceSummary: {
      latestImport: {
        sourceType: "website",
        sourceUrl: "https://north.example/about",
      },
    },
    metadata: {},
    governance: {},
    finalizeImpact: {},
  }),
  getTruthReviewWorkbench: vi.fn().mockResolvedValue({
    summary: {
      total: 1,
      pending: 0,
    },
    items: [],
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
    currentVersion: {
      id: "v4",
      version: "v4",
      versionLabel: "Truth version v4",
      approvedAt: "2026-03-26T11:00:00.000Z",
      approvedBy: "reviewer@aihq.test",
    },
    behavior: {
      selected: {
        summary: "Clinic · Book your consultation · Warm Reassuring",
        rows: [
          { key: "businessType", label: "Business type", value: "Clinic" },
          { key: "primaryCta", label: "Primary CTA", value: "Book your consultation" },
          { key: "toneProfile", label: "Tone profile", value: "Warm Reassuring" },
        ],
      },
      compared: {
        summary: "Clinic · Contact the team · Professional",
        rows: [
          { key: "businessType", label: "Business type", value: "Clinic" },
          { key: "primaryCta", label: "Primary CTA", value: "Contact the team" },
          { key: "toneProfile", label: "Tone profile", value: "Professional" },
        ],
      },
      changes: [
        {
          key: "behavior.primaryCta",
          label: "Primary CTA",
          beforeSummary: "Contact the team",
          afterSummary: "Book your consultation",
        },
      ],
    },
    changedFields: [{ key: "companyName", label: "Company name" }],
    fieldChanges: [
      {
        key: "companyName",
        label: "Company name",
        beforeSummary: "Old Clinic",
        afterSummary: "North Clinic",
      },
    ],
    sectionChanges: [],
    versionDiff: {
      canonicalAreasChanged: ["business_profile"],
      canonicalPathsChanged: ["profile.companyName"],
      runtimeAreasLikelyAffected: ["tenant_profile"],
      affectedSurfaces: ["inbox"],
      autonomyImpact: "follow_up_required",
      valueSummary: {
        changed: 1,
      },
      summaryExplanation: "1 canonical field change spans 1 governed area.",
    },
    rollbackPreview: {
      currentApprovedVersion: {
        id: "v4",
        version: "v4",
        versionLabel: "Truth version v4",
      },
      targetRollbackVersion: {
        id: "v3",
        version: "v3",
        versionLabel: "Truth version v3",
      },
      canonicalAreasChangedBack: ["business_profile"],
      canonicalPathsChangedBack: ["profile.companyName"],
      runtimeAreasLikelyAffected: ["tenant_profile"],
      affectedSurfaces: ["inbox"],
      postureImpact: {
        autonomyDelta: "reviewable",
      },
      readinessImplications: [
        "Runtime projection refresh will be required before governed runtime reflects the rollback.",
      ],
      rollbackDisposition: "follow_up_required",
      summaryExplanation:
        "Rolling back to v3 would revert 1 canonical field and trigger runtime follow-up.",
      action: {
        actionType: "execute_safe_rollback",
        label: "Execute governed rollback",
        allowed: true,
        reason:
          "Rollback is allowed, but runtime verification and follow-up will still be required.",
      },
    },
    diffSummary: "companyName changed",
    hasStructuredDiff: true,
  }),
  rollbackTruthVersion: vi.fn().mockResolvedValue({
    ok: true,
    rollbackReceipt: {
      rollbackActionResult: "executed",
      rollbackStatus: "follow_up_required",
      sourceCurrentVersion: {
        id: "v4",
        version: "v4",
        versionLabel: "Truth version v4",
      },
      targetRollbackVersion: {
        id: "v3",
        version: "v3",
        versionLabel: "Truth version v3",
      },
      resultingTruthVersion: {
        id: "v5",
        version: "v5",
        versionLabel: "Truth version v5",
      },
      resultingTruthVersionId: "v5",
      runtimeProjectionId: "runtime-projection-rollback",
      runtimeRefreshResult: "refreshed",
      actual: {
        canonical: {
          areas: ["business_profile"],
          paths: ["profile.companyName"],
        },
        runtime: {
          areas: ["tenant_profile"],
          paths: ["profile.companyName"],
        },
        channels: {
          affectedSurfaces: ["inbox"],
        },
        policy: {
          autonomyDelta: "reviewable",
          executionPostureDelta: "unknown",
          riskDelta: "unknown",
        },
      },
      previewComparison: { status: "matched" },
      verification: {
        truthVersionCreated: true,
        runtimeProjectionRefreshed: true,
        runtimeControlWarnings: [],
        repairRecommendation: "",
      },
      actor: "owner@aihq.test",
      timestamp: "2026-03-28T10:20:00.000Z",
      summaryExplanation:
        "Rollback committed, but follow-up is required before the governed revert path is fully clean.",
    },
  }),
}));

vi.mock("../../../hooks/useWorkspaceTenantKey.js", () => ({
  default: (...args) => useWorkspaceTenantKey(...args),
  useWorkspaceTenantKey: (...args) => useWorkspaceTenantKey(...args),
}));

import TruthViewerPage from "../../../pages/Truth/TruthViewerPage.jsx";
import {
  getCanonicalTruthSnapshot,
  rollbackTruthVersion,
} from "../../../api/truth.js";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  useWorkspaceTenantKey.mockReturnValue({
    tenantKey: "acme",
    loading: false,
    ready: true,
  });
});

describe("Truth viewer smoke", () => {
  function renderPage(entry = "/truth") {
    return render(
      <MemoryRouter initialEntries={[entry]}>
        <TruthViewerPage />
      </MemoryRouter>
    );
  }

  it("renders the current business truth surface and opens version compare", async () => {
    renderPage();

    expect(
      screen.getByText(/loading approved business truth/i)
    ).toBeInTheDocument();

    expect(
      await screen.findByRole("heading", { name: /business truth/i })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/approved fields and the latest governed snapshot/i)
    ).toBeInTheDocument();
    expect(screen.getByText("North Clinic")).toBeInTheDocument();
    expect(
      screen.getByText(/cosmetic dentistry and consultation-led care/i)
    ).toBeInTheDocument();
    expect(screen.getByText("+15551112222")).toBeInTheDocument();
    expect(screen.getByText("https://north.example")).toBeInTheDocument();
    expect(screen.getByText(/reviewer@aihq\.test/i)).toBeInTheDocument();
    expect(screen.getByText(/^Ready$/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/https:\/\/north\.example\/about/i).length
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /version history/i }));

    expect(
      await screen.findByTestId("truth-version-compare-open")
    ).toBeInTheDocument();

    expect(
      await screen.findByText(/version details and rollback preview/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/selected version behavior/i)).toBeInTheDocument();
    expect(screen.getByText(/compared version behavior/i)).toBeInTheDocument();
    expect(
      screen.getByText(/rolling back to v3 would revert 1 canonical field/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/primary cta/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/old clinic/i)).toBeInTheDocument();
    expect(screen.getAllByText(/north clinic/i).length).toBeGreaterThan(1);
  });

  it("shows an explicit unavailable state without fallback data", async () => {
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
        blockers: [],
      },
      sourceSummary: {},
      metadata: {},
      governance: {},
      finalizeImpact: {},
    });

    renderPage();

    expect(
      await screen.findByRole("heading", { name: /business truth/i })
    ).toBeInTheDocument();

    expect(
      screen.getAllByText(
        /approved truth is unavailable\. no non-approved fallback data is being shown\./i
      ).length
    ).toBeGreaterThan(0);

    expect(
      screen.getByRole("button", { name: /version history/i })
    ).toBeDisabled();

    expect(screen.getByText(/^Unavailable$/i)).toBeInTheDocument();
    expect(screen.getByText(/saved versions/i)).toBeInTheDocument();
    expect(screen.getByText(/pending review/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^0$/i).length).toBeGreaterThanOrEqual(2);
  });

  it("renders safely when metadata is partial", async () => {
    getCanonicalTruthSnapshot.mockResolvedValueOnce({
      fields: [
        {
          key: "companyName",
          label: "Company name",
          value: "North Clinic",
          provenance: "",
        },
      ],
      approval: {
        approvedAt: "",
        approvedBy: "",
        version: "approved",
      },
      history: [],
      notices: [],
      hasProvenance: false,
      approvedTruthUnavailable: false,
      readiness: {
        status: "ready",
        blockers: [],
      },
      sourceSummary: {},
      metadata: {},
      governance: {},
      finalizeImpact: {},
    });

    renderPage();

    expect(
      await screen.findByRole("heading", { name: /business truth/i })
    ).toBeInTheDocument();

    expect(screen.getByText("North Clinic")).toBeInTheDocument();
    expect(screen.getByText(/^Approved$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Ready$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^Not available$/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /version history/i })
    ).toBeDisabled();
  });

  it("opens a deep-linked version from the url", async () => {
    renderPage("/truth?versionId=v3&focus=history");

    expect(
      await screen.findByTestId("truth-version-compare-open")
    ).toBeInTheDocument();

    expect(
      await screen.findByText(/version details and rollback preview/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/old clinic/i)).toBeInTheDocument();
  });

  it("executes governed rollback from compare and shows the receipt", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: /business truth/i })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /version history/i }));

    expect(
      await screen.findByTestId("truth-version-compare-open")
    ).toBeInTheDocument();

    const rollbackButton = await screen.findByRole("button", {
      name: /execute governed rollback/i,
    });

    fireEvent.click(rollbackButton);

    await waitFor(() =>
      expect(rollbackTruthVersion).toHaveBeenCalledWith(
        "v3",
        expect.objectContaining({
          metadataJson: {
            rollbackPreview: expect.objectContaining({
              rollbackDisposition: "follow_up_required",
            }),
          },
        })
      )
    );

    expect(
      (await screen.findAllByText(/rollback receipt/i)).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/rollback committed, but follow-up is required/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/truth version v5/i).length).toBeGreaterThan(0);
  });
});
