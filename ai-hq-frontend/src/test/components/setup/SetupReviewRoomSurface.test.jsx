/* @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SetupReviewRoomSurface from "../../../components/setup/SetupReviewRoomSurface.jsx";

afterEach(() => {
  cleanup();
});

describe("SetupReviewRoomSurface", () => {
  it("renders review room header, sections, runtime consumers and primary action", () => {
    render(
      <SetupReviewRoomSurface
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

  it("renders section details with facts and items", () => {
    render(
      <SetupReviewRoomSurface
        reviewRoom={{
          header: {
            title: "Review the AI-prepared business draft",
            subtitle: "Check each section before approval.",
            statusLabel: "Draft ready",
            badgeTone: "info",
            trustNote: "Draft data is not runtime authority.",
          },
          sections: [],
          sectionDetails: [
            {
              key: "profile",
              title: "Business profile",
              status: "complete",
              action: "review_profile",
              sourceBacked: true,
              facts: [
                {
                  key: "companyName",
                  label: "Business name",
                  value: "Acme Clinic",
                  kind: "text",
                },
                {
                  key: "description",
                  label: "Description",
                  value: "Dental clinic in Baku.",
                  kind: "text",
                },
              ],
              items: [],
            },
            {
              key: "services",
              title: "Services",
              status: "complete",
              action: "review_services",
              sourceBacked: true,
              facts: [],
              items: ["Consultation", "Cleaning"],
            },
          ],
          actions: {
            primary: {
              id: "continue_review",
              label: "Continue review",
              enabled: true,
            },
          },
          runtimeConsumers: {
            consumers: [],
          },
          issues: [],
        }}
      />
    );

    expect(screen.getByText(/review details/i)).toBeInTheDocument();
    expect(screen.getByText(/business profile/i)).toBeInTheDocument();
    expect(screen.getByText(/business name/i)).toBeInTheDocument();
    expect(screen.getByText(/acme clinic/i)).toBeInTheDocument();
    expect(screen.getByText(/description/i)).toBeInTheDocument();
    expect(screen.getByText(/dental clinic in baku/i)).toBeInTheDocument();
    expect(screen.getByText(/consultation/i)).toBeInTheDocument();
    expect(screen.getByText(/cleaning/i)).toBeInTheDocument();
    expect(screen.getAllByText(/source backed/i).length).toBeGreaterThan(0);
  });

  it("renders intake options and approval preview", () => {
    render(
      <SetupReviewRoomSurface
        reviewRoom={{
          header: {
            title: "Business truth is ready to approve",
            subtitle: "Approval will publish runtime truth.",
            statusLabel: "Ready for approval",
            badgeTone: "success",
            trustNote: "Draft data is not runtime authority.",
          },
          sections: [],
          actions: {
            primary: {
              id: "approve_and_publish_truth",
              label: "Approve truth",
              enabled: true,
            },
          },
          intake: {
            primaryExperience: "review_room",
            options: [
              {
                id: "website_source",
                label: "Website",
                description: "Use public website evidence.",
                enabled: true,
                status: "captured",
              },
              {
                id: "manual_brief",
                label: "Manual brief",
                description: "Write a short business description.",
                enabled: true,
                status: "available",
              },
              {
                id: "document_upload",
                label: "Document upload",
                description: "Upload menus or documents.",
                enabled: false,
                status: "planned",
              },
            ],
          },
          approvalPreview: {
            canApprove: true,
            publishes: [
              {
                key: "profile",
                label: "Business profile",
                summary: "Acme Clinic — dental clinic.",
              },
              {
                key: "services",
                label: "Services",
                summary: "Consultation, cleaning.",
              },
            ],
            excludedFromTruth: [
              "assistant_style_profile",
              "raw_source_evidence",
              "transient_chat_turns",
            ],
          },
          runtimeConsumers: {
            consumers: [],
          },
          issues: [],
        }}
      />
    );

    expect(screen.getByText(/input sources/i)).toBeInTheDocument();
    expect(screen.getByText(/website/i)).toBeInTheDocument();
    expect(screen.getByText(/manual brief/i)).toBeInTheDocument();
    expect(screen.getByText(/document upload/i)).toBeInTheDocument();
    expect(screen.getByText(/approval preview/i)).toBeInTheDocument();
    expect(screen.getByText(/business profile/i)).toBeInTheDocument();
    expect(screen.getByText(/services/i)).toBeInTheDocument();
    expect(screen.getByText(/not published as truth/i)).toBeInTheDocument();
    expect(screen.getByText(/assistant style profile/i)).toBeInTheDocument();
    expect(screen.getByText(/raw source evidence/i)).toBeInTheDocument();
  });

  it("calls onAction when the primary action is clicked", () => {
    const onAction = vi.fn();

    render(
      <SetupReviewRoomSurface
        onAction={onAction}
        reviewRoom={{
          header: {
            title: "Business truth is ready to approve",
            subtitle: "Approval will publish runtime truth.",
            statusLabel: "Ready for approval",
            badgeTone: "success",
            trustNote: "Draft data is not runtime authority.",
          },
          sections: [],
          actions: {
            primary: {
              id: "approve_and_publish_truth",
              label: "Approve truth",
              intent: "finalize_review",
              enabled: true,
            },
          },
          runtimeConsumers: {
            consumers: [],
          },
          issues: [],
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /approve truth/i }));

    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "approve_and_publish_truth",
        intent: "finalize_review",
      })
    );
  });

  it("shows blocking issues when approval is not ready", () => {
    render(
      <SetupReviewRoomSurface
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
