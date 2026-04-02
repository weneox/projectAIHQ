/* @vitest-environment jsdom */

import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  getSetupStudioHasManualInput,
  getSetupStudioScanningView,
  getSetupStudioSourceLabel,
  useSetupStudioSceneView,
} from "./useSetupStudioSceneView.js";

describe("useSetupStudioSceneView", () => {
  it("shapes source labels and scanning view for the simplified flow", () => {
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
        currentReview: {},
        businessForm: {
          companyName: "Acme Bakery",
        },
        manualSections: {
          servicesText: "Custom Cakes",
        },
      })
    );

    expect(result.current.sourceLabel).toBe("Website");
    expect(result.current.discoveryWarnings).toEqual(["http_403"]);
    expect(result.current.scanningView).toMatchObject({
      sourceType: "website",
      hasSourceInput: true,
      hasManualInput: true,
      scanLines: ["Scanning homepage", "Extracting profile"],
      scanLineIndex: 1,
    });
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
      getSetupStudioScanningView({
        discoveryState: {
          analysisSteps: ["Step 1"],
          analysisStepIndex: 0,
          lastSourceType: "website",
        },
        discoveryForm: { websiteUrl: "https://acme.example" },
        currentReview: {},
      })
    ).toMatchObject({
      sourceType: "website",
      hasSourceInput: true,
      scanLines: ["Step 1"],
      scanLineIndex: 0,
    });
  });
});
