/* @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import SetupReviewRoomPreview from "../../../components/setup/SetupReviewRoomPreview.jsx";

afterEach(() => {
  cleanup();
});

describe("SetupReviewRoomPreview", () => {
  it("renders review room header, sections, runtime consumers and primary action", () => {
    render(
      <SetupReviewRoomPreview
        reviewRoom={{
          primaryExperience: "review_room",
          mainSurface: "business_truth_review",
          chatRole: "input_method",
          draftAuthority: "not_runtime_authority",
          runtimeAuthority: "approved_truth",
          readyForApproval: true,
          header: {
            status: "ready_for_approval",
            title: "Business truth is ready to approve",
            subtitle: "Approving will publish runtime authority.",
            statusLabel: "Ready for approval",
            badgeTone: "success",
            primaryMessage: "Approve to make this truth live.",
            trustNote:
              "Draft data is not runtime authority. Only approved truth can power customer-facing AI.",
          },
          sections: [
            {
              key: "profile",
              label: "Business profile",
              status: "complete",
              itemCount: 2,
              sourceBacked: true,
              action: "review_profile",
            },
            {
              key: "services",
              label: "Services",
              status: "complete",
              itemCount: 1,
              sourceBacked: true,
              action: "review_services",
            },
          ],
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
          runtimeConsumers: {
            authority: "approved_truth",
            consumers: [
              {
                key: "public_widget",
                label: "Public website widget",
                description: "Customer-facing widget replies from approved truth only.",
                currentState: "ready_after_approval",
                requiresApprovedTruth: true,
              },
              {
                key: "voice_assistant",
                label: "Voice assistant",
                description: "Voice answers must use approved truth.",
                currentState: "ready_after_approval",
                requiresApprovedTruth: true,
              },
            ],
          },
          issues: [],
        }}
      />
    );

    expect(
      screen.getByRole("region", { name: /ai setup review room/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/business truth is ready to approve/i)).toBeInTheDocument();
    expect(screen.getByText(/draft data is not runtime authority/i)).toBeInTheDocument();
    expect(screen.getByText(/business profile/i)).toBeInTheDocument();
    expect(screen.getByText(/services/i)).toBeInTheDocument();
    expect(screen.getByText(/public website widget/i)).toBeInTheDocument();
    expect(screen.getByText(/voice assistant/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /approve and make live/i })
    ).toBeEnabled();
  });

  it("shows blocking issues when approval is not ready", () => {
    render(
      <SetupReviewRoomPreview
        reviewRoom={{
          header: {
            status: "missing_required_facts",
            title: "Complete missing business facts",
            subtitle: "Some required sections must be completed.",
            statusLabel: "Missing facts",
            badgeTone: "warning",
            primaryMessage: "1 required section needs attention.",
          },
          actions: {
            primary: {
              id: "answer_missing_required_facts",
              label: "Complete missing facts",
              intent: "answer_missing_facts",
              enabled: true,
            },
            approval: {
              enabled: false,
              missingSections: ["services"],
            },
          },
          sections: [
            {
              key: "services",
              label: "Services",
              status: "missing",
              itemCount: 0,
            },
          ],
          runtimeConsumers: {
            consumers: [
              {
                key: "inbox_ai",
                label: "Inbox AI replies",
                currentState: "blocked_pending_approved_truth",
              },
            ],
          },
          issues: [
            {
              id: "missing_services",
              type: "missing_required_fact",
              severity: "blocking",
              section: "services",
              message: "Services is required before approval.",
            },
          ],
        }}
      />
    );

    expect(screen.getByText(/complete missing business facts/i)).toBeInTheDocument();
    expect(screen.getByText(/needs attention/i)).toBeInTheDocument();
    expect(screen.getByText(/services is required before approval/i)).toBeInTheDocument();
    expect(screen.getByText(/blocked pending approved truth/i)).toBeInTheDocument();
  });
});
