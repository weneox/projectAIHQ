import { describe, expect, it } from "vitest";

import {
  executionFromProposal,
  executionRetryLabel,
  publishConfirmationLabel,
} from "../../../features/proposals/proposal.selectors.js";

describe("proposal execution selectors", () => {
  it("keeps retry lineage and publish confirmation separate from proposal lifecycle state", () => {
    const proposal = {
      id: "proposal-1",
      status: "approved",
      latest_execution: {
        id: "exec-1",
        status: "queued",
        attempt_count: 2,
        max_attempts: 5,
        output: {
          published: false,
        },
      },
    };

    const execution = executionFromProposal(proposal);

    expect(execution?.status).toBe("queued");
    expect(executionRetryLabel(execution)).toBe("retry 2 of 5");
    expect(publishConfirmationLabel(proposal, execution)).toBe("not confirmed");
  });

  it("uses execution output confirmation when publish is confirmed before proposal status catches up", () => {
    const proposal = {
      id: "proposal-2",
      status: "approved",
      latest_execution: {
        id: "exec-2",
        status: "completed",
        output: {
          published: true,
        },
      },
    };

    const execution = executionFromProposal(proposal);

    expect(publishConfirmationLabel(proposal, execution)).toBe("confirmed");
  });
});
