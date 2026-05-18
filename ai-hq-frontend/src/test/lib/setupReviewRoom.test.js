import { describe, expect, it } from "vitest";

import {
  normalizeSetupReviewRoom,
  setupReviewRoomHasLegacyTokens,
} from "../../lib/setupReviewRoom.js";

describe("setup review room frontend adapter", () => {
  it("normalizes backend review room payload for frontend surfaces", () => {
    const room = normalizeSetupReviewRoom({
      primaryExperience: "review_room",
      mainSurface: "business_truth_review",
      chatRole: "input_method",
      draftAuthority: "not_runtime_authority",
      runtimeAuthority: "approved_truth",
      readyForApproval: true,
      recommendedNextAction: "approve_and_publish_truth",
      header: {
        status: "ready_for_approval",
        title: "Business truth is ready to approve",
        badgeTone: "success",
      },
      sections: [
        {
          key: "profile",
          label: "Business profile",
          status: "complete",
          required: true,
          itemCount: 2,
          sourceBacked: true,
          action: "review_profile",
        },
      ],
      sectionDetails: [
        {
          key: "profile",
          title: "Business profile",
          status: "complete",
          facts: [
            {
              key: "companyName",
              label: "Business name",
              value: "Acme Clinic",
              kind: "text",
            },
          ],
        },
      ],
      actions: {
        primary: {
          id: "approve_and_publish_truth",
          label: "Approve and make live",
          intent: "finalize_review",
          enabled: true,
        },
        secondary: [
          {
            id: "customize_assistant_style",
            label: "Customize assistant style",
            intent: "customize_style",
            enabled: true,
            setupBlocking: false,
          },
        ],
        approval: {
          enabled: true,
          runtimeAuthorityAfterApproval: "approved_truth",
        },
      },
      issues: [],
      runtimeConsumers: {
        authority: "approved_truth",
        blockedCount: 0,
        readyAfterApprovalCount: 5,
        activeCount: 0,
        consumers: [
          {
            key: "voice_assistant",
            label: "Voice assistant",
            currentState: "ready_after_approval",
            requiresApprovedTruth: true,
          },
        ],
      },
      intake: {
        purpose: "collect_business_truth_inputs",
        websiteIsInputNotSetupModel: true,
        chatIsInputNotMainExperience: true,
        primaryExperience: "review_room",
        options: [
          {
            id: "manual_brief",
            label: "Manual brief",
            enabled: true,
            status: "recommended",
            action: "add_manual_brief",
          },
        ],
      },
    });

    expect(room.primaryExperience).toBe("review_room");
    expect(room.mainSurface).toBe("business_truth_review");
    expect(room.chatRole).toBe("input_method");
    expect(room.draftAuthority).toBe("not_runtime_authority");
    expect(room.runtimeAuthority).toBe("approved_truth");
    expect(room.readyForApproval).toBe(true);
    expect(room.header.status).toBe("ready_for_approval");
    expect(room.header.badgeTone).toBe("success");
    expect(room.sections[0].key).toBe("profile");
    expect(room.sectionDetails[0].facts[0].value).toBe("Acme Clinic");
    expect(room.actions.primary.id).toBe("approve_and_publish_truth");
    expect(room.actions.approval.enabled).toBe(true);
    expect(room.runtimeConsumers.consumers[0].key).toBe("voice_assistant");
    expect(room.intake.websiteIsInputNotSetupModel).toBe(true);
    expect(room.intake.options[0].id).toBe("manual_brief");
    expect(room.hasLegacyTokens).toBe(false);
  });

  it("normalizes approval preview", () => {
    const room = normalizeSetupReviewRoom({
      approvalPreview: {
        canApprove: true,
        action: "approve_and_publish_truth",
        title: "Ready to publish approved truth",
        publishes: [
          {
            key: "profile",
            label: "Business profile",
            summary: "Acme Clinic",
          },
        ],
        excludedFromTruth: [
          "assistant_style_profile",
          "raw_source_evidence",
        ],
        notes: ["Approved truth becomes runtime authority."],
      },
    });

    expect(room.approvalPreview.canApprove).toBe(true);
    expect(room.approvalPreview.action).toBe("approve_and_publish_truth");
    expect(room.approvalPreview.publishes[0].key).toBe("profile");
    expect(room.approvalPreview.excludedFromTruth).toContain("assistant_style_profile");
    expect(room.approvalPreview.notes[0]).toMatch(/runtime authority/i);
  });

  it("detects legacy behavior pollution", () => {
    expect(
      setupReviewRoomHasLegacyTokens({
        assistantBehaviorDraft: {
          greetingStyle: "warm",
        },
      })
    ).toBe(true);

    expect(
      setupReviewRoomHasLegacyTokens({
        assistantStyleProfile: {
          toneProfile: "professional",
        },
      })
    ).toBe(false);
  });
});
