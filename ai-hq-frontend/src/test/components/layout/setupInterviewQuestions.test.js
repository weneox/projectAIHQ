import { describe, expect, it } from "vitest";

import { SETUP_INTERVIEW_QUESTIONS } from "../../../components/layout/setupInterviewQuestions.js";

describe("setupInterviewQuestions", () => {
  it("keeps the primary setup scope limited to launch-critical questions", () => {
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
