import { describe, expect, it } from "vitest";

import { normalizeReplayTrace } from "../../lib/replayTrace.js";

describe("normalizeReplayTrace", () => {
  it("normalizes replay metadata from mixed backend shapes", () => {
    const normalized = normalizeReplayTrace({
      meta: {
        replay_trace: {
          runtime_reference: {
            reference: "approved-runtime/content-agent",
            version: "2026.03.29",
          },
          behavior_summary: "Answered within approved content posture.",
          prompt_layers: [
            "system-core",
            { label: "content-angle", version: "v3" },
          ],
          channel: "comments",
          use_case: "public_reply",
          cta_decision: {
            summary: "Keep CTA soft",
          },
          qualification_decision: "No lead qualification required",
          qualification_reference: "comment-policy-v1",
          handoff_trigger: "none",
          disallowed_claim_block_reason: "Clinical guarantee claims blocked.",
        },
      },
    });

    expect(normalized.runtimeReference).toBe(
      "approved-runtime/content-agent (2026.03.29)"
    );
    expect(normalized.promptLayers).toEqual([
      "system-core",
      "content-angle (v3)",
    ]);
    expect(normalized.qualificationDecision).toBe(
      "No lead qualification required (comment-policy-v1)"
    );
    expect(normalized.disallowedClaimReason).toBe(
      "Clinical guarantee claims blocked."
    );
    expect(normalized.hasTrace).toBe(true);
  });
});
