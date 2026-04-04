import { describe, expect, it } from "vitest";

import { createReadinessViewModel } from "../../../components/readiness/readinessViewModel.js";

describe("createReadinessViewModel", () => {
  it("normalizes array and nested blocker shapes into one stable model", () => {
    const model = createReadinessViewModel({
      status: "blocked",
      blockers: {
        items: [
          {
            blocked: true,
            category: "runtime",
            dependencyType: "runtime_projection",
            reasonCode: "runtime_projection_missing",
            title: "Runtime projection blocker",
            missing: ["runtime_projection"],
            nextAction: {
              id: "open_setup_route",
              kind: "route",
              label: "Open runtime setup",
              requiredRole: "operator",
              allowed: true,
              target: {
                path: "/setup/runtime",
              },
            },
          },
        ],
      },
    });

    expect(model.status).toBe("blocked");
    expect(model.blockedItems).toHaveLength(1);
    expect(model.blockedItems[0].reasonCode).toBe("runtime_projection_missing");
    expect(model.blockedItems[0].action.kind).toBe("route");
  });
});
