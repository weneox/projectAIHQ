import { describe, expect, it } from "vitest";

import {
  describeSetupStudioFieldHonesty,
  summarizeSetupStudioHonesty,
} from "./reviewHonesty.js";

describe("reviewHonesty", () => {
  it("summarizes barrier-limited and weak draft state honestly", () => {
    const summary = summarizeSetupStudioHonesty({
      reviewProjection: {
        reviewRequired: true,
        warnings: ["http_403", "partial_website_extraction"],
        fieldConfidence: {
          companyName: { score: 0.92 },
          primaryPhone: { score: 0.22 },
        },
        fieldProvenance: {
          companyName: { sourceType: "website" },
        },
      },
      reviewSources: [{ sourceType: "website", url: "https://acme.example" }],
    });

    expect(summary.title).toBe("Barrier-limited source draft");
    expect(summary.weakFieldCount).toBe(1);
    expect(summary.barrierWarnings).toEqual(["http_403"]);
    expect(summary.partialWarnings).toEqual(["partial_website_extraction"]);
    expect(summary.finalizeMessage).toMatch(/finalize only after/i);
  });

  it("classifies missing and weak field evidence conservatively", () => {
    expect(
      describeSetupStudioFieldHonesty({
        fieldKey: "primaryPhone",
        fieldConfidence: {
          primaryPhone: { score: 0.18 },
        },
        observedValue: "+15550001111",
        evidence: [{ label: "Website" }],
      })
    ).toMatchObject({
      label: "Weak signal",
      provenanceLabel: "Source-derived suggestion",
    });

    expect(
      describeSetupStudioFieldHonesty({
        fieldKey: "primaryEmail",
        fieldConfidence: {},
        observedValue: "",
        evidence: [],
        warnings: ["http_403"],
      })
    ).toMatchObject({
      label: "Barrier-limited",
    });
  });
});
