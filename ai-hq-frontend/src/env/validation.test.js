import { describe, expect, it } from "vitest";

import {
  getFrontendEnvIssues,
  isFrontendProductionBuild,
} from "./validation.js";

describe("frontend env validation", () => {
  it("requires production endpoints for CI/prod builds", () => {
    const issues = getFrontendEnvIssues({
      MODE: "production",
      CI: "true",
    });

    const apiIssue = issues.find((item) => item.key === "VITE_API_BASE");
    const wsIssue = issues.find((item) => item.key === "VITE_WS_URL");

    expect(isFrontendProductionBuild({ MODE: "production" })).toBe(true);
    expect(apiIssue?.requirement).toBe("build-required");
    expect(apiIssue?.phase).toBe("build");
    expect(apiIssue?.envKeys).toContain("VITE_API_BASE");
    expect(wsIssue?.envKeys).toContain("VITE_WS_URL");
  });

  it("treats malformed optional flags as explicit build errors", () => {
    const issues = getFrontendEnvIssues({
      MODE: "development",
      VITE_DEBUG_PUSH: "maybe",
    });

    const flagIssue = issues.find((item) => item.key === "VITE_DEBUG_PUSH");
    expect(flagIssue?.level).toBe("error");
    expect(flagIssue?.category).toBe("frontend-flags");
  });
});
