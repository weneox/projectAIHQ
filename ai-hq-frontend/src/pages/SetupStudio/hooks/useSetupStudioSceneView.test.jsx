import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  buildSetupStudioReviewWorkspaceDialogProps,
  getSetupStudioHasManualInput,
  getSetupStudioHasVoiceInput,
  getSetupStudioScanningView,
  getSetupStudioSourceLabel,
  useSetupStudioSceneView,
} from "./useSetupStudioSceneView.js";

describe("useSetupStudioSceneView", () => {
  it("shapes source labels, scanning view, and dialog props", () => {
    const onSetBusinessField = vi.fn();
    const onSetManualSection = vi.fn();
    const onSaveBusiness = vi.fn();
    const onReloadReviewDraft = vi.fn();
    const onToggleRefine = vi.fn();

    const { result } = renderHook(() =>
      useSetupStudioSceneView({
        discoveryState: {
          sourceLabel: "Website",
          lastSourceType: "website",
          lastUrl: "https://acme.example",
          warnings: ["http_403"],
          progressLines: ["Scanning homepage", "Extracting profile"],
          progressIndex: 1,
        },
        discoveryModeLabel: () => "Draft flow",
        discoveryForm: {
          sourceType: "website",
          sourceValue: "https://acme.example",
          note: "Bakery with daily specials.",
        },
        reviewDraft: {},
        businessForm: {
          companyName: "Acme Bakery",
        },
        manualSections: {
          servicesText: "Custom Cakes",
        },
        showRefine: true,
        savingBusiness: false,
        discoveryProfileRows: [{ key: "companyName" }],
        onSetBusinessField,
        onSetManualSection,
        onSaveBusiness,
        onReloadReviewDraft,
        onToggleRefine,
        reviewSources: [{ id: "source-1" }],
        reviewSyncState: { level: "ready" },
      })
    );

    expect(result.current.sourceLabel).toBe("Website");
    expect(result.current.discoveryWarnings).toEqual(["http_403"]);
    expect(result.current.scanningView).toMatchObject({
      sourceType: "website",
      hasSourceInput: true,
      hasManualInput: true,
      hasVoiceInput: false,
      scanLines: ["Scanning homepage", "Extracting profile"],
      scanLineIndex: 1,
    });
    expect(result.current.reviewWorkspaceDialogProps.open).toBe(true);
    expect(result.current.reviewWorkspaceDialogProps.onClose).toBe(onToggleRefine);
  });

  it("supports the pure helper functions directly", () => {
    expect(
      getSetupStudioSourceLabel(
        { lastSourceType: "website" },
        (type) => (type === "website" ? "Website" : "Draft flow")
      )
    ).toBe("Website");

    expect(
      getSetupStudioHasManualInput({
        businessForm: { companyName: "Acme Bakery" },
      })
    ).toBe(true);

    expect(
      getSetupStudioHasVoiceInput({
        discoveryForm: { voiceTranscript: "Hello there" },
      })
    ).toBe(true);

    expect(
      getSetupStudioScanningView({
        discoveryState: {
          analysisSteps: ["Step 1"],
          analysisStepIndex: 0,
          lastSourceType: "website",
        },
        discoveryForm: { websiteUrl: "https://acme.example" },
      })
    ).toMatchObject({
      sourceType: "website",
      hasSourceInput: true,
      scanLines: ["Step 1"],
      scanLineIndex: 0,
    });

    const dialogProps = buildSetupStudioReviewWorkspaceDialogProps({
      showRefine: true,
      savingBusiness: false,
      businessForm: {},
      discoveryProfileRows: [],
      manualSections: {},
      onSetBusinessField: vi.fn(),
      onSetManualSection: vi.fn(),
      onSaveBusiness: vi.fn(),
      onReloadReviewDraft: vi.fn(),
      onToggleRefine: vi.fn(),
      reviewDraft: {},
      reviewSources: [],
      reviewSyncState: {},
    });

    expect(dialogProps.open).toBe(true);
    expect(typeof dialogProps.onClose).toBe("function");
  });
});
