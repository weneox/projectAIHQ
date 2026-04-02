import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import TruthVersionComparePanel from "./TruthVersionComparePanel.jsx";

const detail = {
  selectedVersion: {
    id: "v3",
    version: "v3",
    versionLabel: "Truth version v3",
    approvedAt: "2026-03-25T10:00:00.000Z",
    approvedBy: "reviewer@aihq.test",
    sourceSummary: "Website - https://north.example/about",
    behavior: {
      businessType: "clinic",
    },
  },
  comparedVersion: {
    id: "v2",
    version: "v2",
    versionLabel: "Truth version v2",
    approvedAt: "2026-03-24T09:00:00.000Z",
    approvedBy: "owner@aihq.test",
    behavior: {
      businessType: "clinic",
    },
  },
  currentVersion: {
    id: "v4",
    version: "v4",
    versionLabel: "Truth version v4",
    approvedAt: "2026-03-26T12:00:00.000Z",
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
  changedFields: [{ key: "profile.companyName", label: "profile.companyName" }],
  fieldChanges: [
    {
      key: "companyName",
      label: "Company name",
      beforeSummary: "Old Clinic",
      afterSummary: "North Clinic",
    },
  ],
  sectionChanges: [
    {
      key: "identity",
      label: "Identity",
      summary: "Core business identity was refreshed.",
    },
  ],
  versionDiff: {
    canonicalAreasChanged: ["business_profile"],
    canonicalPathsChanged: ["profile.companyName", "profile.websiteUrl"],
    runtimeAreasLikelyAffected: ["tenant_profile", "contact_channels"],
    affectedSurfaces: ["inbox", "voice"],
    autonomyImpact: "follow_up_required",
    valueSummary: {
      added: 0,
      removed: 0,
      changed: 2,
    },
    summaryExplanation: "2 canonical field changes span 1 governed area.",
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
    summaryExplanation: "Rolling back to v3 would revert 1 canonical field and trigger runtime follow-up.",
    action: {
      actionType: "execute_safe_rollback",
      label: "Execute governed rollback",
      allowed: false,
      reason: "This rollback will require runtime follow-up, so operator execution is not permitted.",
    },
  },
  hasStructuredDiff: true,
};

describe("TruthVersionComparePanel", () => {
  it("renders version diff and rollback preview", () => {
    render(
      <TruthVersionComparePanel
        open
        detail={detail}
        versions={[detail.selectedVersion, detail.currentVersion]}
      />
    );

    expect(screen.getByText(/version details and rollback preview/i)).toBeInTheDocument();
    expect(screen.getByText(/selected version behavior/i)).toBeInTheDocument();
    expect(screen.getByText(/compared version behavior/i)).toBeInTheDocument();
    expect(screen.getByText(/behavior changes/i)).toBeInTheDocument();
    expect(screen.getAllByText(/book your consultation/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/version diff/i)).toBeInTheDocument();
    expect(screen.getAllByText(/rollback preview/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/2 canonical field changes span 1 governed area/i)).toBeInTheDocument();
    expect(screen.getByText(/rolling back to v3 would revert 1 canonical field/i)).toBeInTheDocument();
    expect(screen.getByText(/runtime projection refresh will be required before governed runtime reflects the rollback/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /execute governed rollback/i })).toBeDisabled();
  });

  it("lets operators pick a recent version from inside the compare surface", () => {
    const onSelectVersion = vi.fn();

    render(
      <TruthVersionComparePanel
        open
        detail={detail}
        versions={[
          detail.selectedVersion,
          {
            id: "v2",
            version: "v2",
            versionLabel: "Truth version v2",
          },
        ]}
        onSelectVersion={onSelectVersion}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /truth version v2/i }));
    expect(onSelectVersion).toHaveBeenCalledWith(
      expect.objectContaining({ id: "v2" })
    );
  });

  it("renders partial diff data safely as unavailable", () => {
    render(
      <TruthVersionComparePanel
        open
        detail={{
          selectedVersion: {},
          comparedVersion: {},
          currentVersion: {},
          versionDiff: {},
          rollbackPreview: {},
          changedFields: [],
          fieldChanges: [],
          sectionChanges: [],
          hasStructuredDiff: false,
        }}
      />
    );

    expect(screen.getByText(/structured version-diff guidance is unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/no explicit behavior delta was returned/i)).toBeInTheDocument();
    expect(screen.getByText(/rollback preview telemetry is unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/no rollback field changes were exposed/i)).toBeInTheDocument();
    expect(screen.getByText(/the backend did not return structured diff detail/i)).toBeInTheDocument();
  });

  it("executes rollback when allowed and renders a receipt", () => {
    const onRollback = vi.fn();

    render(
      <TruthVersionComparePanel
        open
        detail={{
          ...detail,
          rollbackAction: {
            actionType: "execute_safe_rollback",
            label: "Execute governed rollback",
            allowed: true,
            reason: "Rollback is allowed inside the governed truth workflow.",
          },
        }}
        rollbackSurface={{
          saving: false,
          error: "",
          saveSuccess: "Governed rollback completed and verification is now available.",
          rollbackReceipt: {
            rollbackStatus: "success",
            summaryExplanation: "Rollback completed and verification matched the governed revert path.",
            sourceCurrentVersion: { id: "v4", version: "v4", versionLabel: "Truth version v4" },
            targetRollbackVersion: { id: "v3", version: "v3", versionLabel: "Truth version v3" },
            resultingTruthVersion: { id: "v5", version: "v5", versionLabel: "Truth version v5" },
            resultingTruthVersionId: "v5",
            runtimeRefreshResult: "refreshed",
            actual: {
              canonical: { areas: ["business_profile"], paths: ["profile.companyName"] },
              runtime: { areas: ["tenant_profile"], paths: ["profile.companyName"] },
              channels: { affectedSurfaces: ["inbox"] },
            },
            previewComparison: { status: "matched" },
            verification: { runtimeControlWarnings: [], repairRecommendation: "" },
          },
        }}
        onRollback={onRollback}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /execute governed rollback/i }));
    expect(onRollback).toHaveBeenCalled();
    expect(screen.getAllByText(/rollback receipt/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/rollback completed and verification matched the governed revert path/i)).toBeInTheDocument();
    expect(screen.getAllByText(/truth version v5/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/preview vs actual/i)).toBeInTheDocument();
  });
});
