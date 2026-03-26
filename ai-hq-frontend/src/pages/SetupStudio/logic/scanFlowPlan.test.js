import { describe, expect, it } from "vitest";

import {
  buildSetupStudioRunningScanState,
  createSetupStudioScanPlan,
} from "./scanFlowPlan.js";

describe("createSetupStudioScanPlan", () => {
  it("fails closed when the user provides no source or manual input", () => {
    const plan = createSetupStudioScanPlan({
      input: {},
      discoveryForm: {},
      businessForm: {},
      manualSections: {},
    });

    expect(plan.validationError).toBe(
      "Add a source, manual notes, or a business description before continuing."
    );
    expect(plan.hasImportableSource).toBe(false);
    expect(plan.uiSourceType).toBe("manual");
  });

  it("builds a bundled website import plan when multiple website sources are present", () => {
    const plan = createSetupStudioScanPlan({
      input: {
        sourceType: "website",
        url: "https://acme.example",
        sources: [
          { sourceType: "website", url: "https://acme.example", isPrimary: true },
          { sourceType: "google_maps", url: "https://maps.google.com/?cid=123" },
        ],
        note: "Use official sources first.",
      },
      discoveryForm: {},
      businessForm: {},
      manualSections: {},
    });

    expect(plan.validationError).toBe("");
    expect(plan.hasImportableSource).toBe(true);
    expect(plan.requestedSources).toHaveLength(2);
    expect(plan.shouldUseBundledImport).toBe(true);
    expect(plan.displaySourceType).toBe("website");
    expect(plan.displaySourceUrl).toBe("https://acme.example");
  });

  it("shapes the running scan state for supporting-source-only drafts", () => {
    const plan = createSetupStudioScanPlan({
      input: {
        sources: [{ sourceType: "instagram", url: "@acmebakery" }],
      },
      discoveryForm: { note: "Bakery with daily specials." },
      businessForm: {},
      manualSections: {},
    });

    const runningState = buildSetupStudioRunningScanState(plan);

    expect(runningState.mode).toBe("running");
    expect(runningState.lastSourceType).toBe("manual");
    expect(runningState.message).toMatch(/attached to the temporary draft/i);
  });
});
