import { describe, expect, it } from "vitest";

import {
  classifySetupSourceInput,
  normalizeSetupSourceValue,
  resolveSetupSourceInput,
} from "../../../components/setup/setupSourceIntake.js";
import { SETUP_INTERVIEW_QUESTIONS } from "../../../components/setup/setupInterviewQuestions.js";

describe("setupSourceIntake", () => {
  it("classifies supported source inputs without treating social links as websites", () => {
    expect(classifySetupSourceInput("https://acme.az")).toBe("website");
    expect(classifySetupSourceInput("maps.google.com/?cid=1")).toBe("google_maps");
    expect(classifySetupSourceInput("@acmeclinic")).toBe("instagram");
    expect(classifySetupSourceInput("https://instagram.com/acmeclinic")).toBe(
      "instagram"
    );
    expect(classifySetupSourceInput("https://facebook.com/acmeclinic")).toBe(
      "facebook"
    );
    expect(classifySetupSourceInput("Cosmetic clinic in Baku")).toBe("manual");
  });

  it("normalizes instagram handles and website domains for routing", () => {
    expect(normalizeSetupSourceValue("instagram", "@acmeclinic")).toBe(
      "https://instagram.com/acmeclinic"
    );
    expect(normalizeSetupSourceValue("website", "acme.az")).toBe(
      "https://acme.az"
    );
    expect(resolveSetupSourceInput("maps.google.com/?cid=1")).toEqual({
      type: "google_maps",
      value: "https://maps.google.com/?cid=1",
      isImportedSource: true,
    });
  });
});

describe("setupInterviewQuestions", () => {
  it("keeps the primary operator flow limited to the launch-critical questions", () => {
    expect(SETUP_INTERVIEW_QUESTIONS.map((item) => item.key)).toEqual([
      "company",
      "description",
      "website",
      "services",
      "hours",
      "pricing",
      "contacts",
      "handoff",
    ]);
  });
});
