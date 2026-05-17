import { describe, expect, it } from "vitest";

import { __test__ } from "../../api/setup.js";

describe("setup api normalization", () => {
  it("preserves review room model and drops legacy behavior draft fields", () => {
    const normalized = __test__.normalizeSetupAssistantResponse({
      ok: true,
      setup: {
        status: "ready_for_approval",
        lifecycleState: {
          status: "ready_for_approval",
          runtimeAuthority: "approved_truth",
        },
        assistantStyleProfile: {
          profileKey: "default_professional",
          purpose: "style_only",
        },
        reviewRoom: {
          primaryExperience: "review_room",
          mainSurface: "business_truth_review",
          chatRole: "input_method",
          draftAuthority: "not_runtime_authority",
          runtimeAuthority: "approved_truth",
          readyForApproval: true,
          header: {
            status: "ready_for_approval",
            title: "Business truth is ready to approve",
            statusLabel: "Ready for approval",
            badgeTone: "success",
          },
          actions: {
            primary: {
              id: "approve_and_publish_truth",
              label: "Approve and make live",
              intent: "finalize_review",
              enabled: true,
            },
            approval: {
              enabled: true,
              runtimeAuthorityAfterApproval: "approved_truth",
            },
          },
          sections: [
            {
              key: "profile",
              label: "Business profile",
              status: "complete",
              itemCount: 2,
              sourceBacked: true,
            },
          ],
          runtimeConsumers: {
            authority: "approved_truth",
            consumers: [
              {
                key: "voice_assistant",
                label: "Voice assistant",
                currentState: "ready_after_approval",
              },
            ],
          },
        },
        draft: {
          businessProfile: {
            companyName: "Acme Clinic",
          },
          assistantBehaviorDraft: {
            greetingPolicy: {
              openingLine: "hello",
            },
          },
          greetingStyle: "warm",
          afterHoursBehavior: "take message",
        },
      },
    });

    expect(normalized.setup.status).toBe("ready_for_approval");
    expect(normalized.setup.lifecycleState.status).toBe("ready_for_approval");
    expect(normalized.setup.assistantStyleProfile.profileKey).toBe("default_professional");
    expect(normalized.setup.reviewRoom.primaryExperience).toBe("review_room");
    expect(normalized.setup.reviewRoom.header.status).toBe("ready_for_approval");
    expect(normalized.setup.reviewRoom.actions.primary.id).toBe("approve_and_publish_truth");
    expect(normalized.setup.reviewRoom.runtimeConsumers.consumers[0].key).toBe("voice_assistant");

    expect(normalized.setup.draft.businessProfile.companyName).toBe("Acme Clinic");
    expect(normalized.setup.draft.assistantBehaviorDraft).toBeUndefined();
    expect(normalized.setup.draft.greetingStyle).toBeUndefined();
    expect(normalized.setup.draft.afterHoursBehavior).toBeUndefined();

    expect(JSON.stringify(normalized.setup.reviewRoom)).not.toMatch(
      /assistantBehaviorDraft|pricingBehavior|locationBehavior|bookingBehavior|contactBehavior|handoffBehavior|greetingStyle|afterHoursBehavior|local_reasoning/
    );
  });
});
