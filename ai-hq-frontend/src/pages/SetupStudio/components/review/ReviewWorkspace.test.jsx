/* @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import ReviewWorkspace from "./ReviewWorkspace.jsx";
import { profilePreviewRowsWithProvenance } from "../../lib/setupStudioHelpers.js";

globalThis.React = React;

afterEach(() => {
  cleanup();
});

describe("ReviewWorkspace", () => {
  it("renders source-derived observed values and provenance from review payload fields", () => {
    render(
      <ReviewWorkspace
        savingBusiness={false}
        businessForm={{
          companyName: "",
          websiteUrl: "",
          primaryPhone: "",
          primaryEmail: "",
          primaryAddress: "",
          language: "",
          description: "",
          behavior: "",
        }}
        discoveryProfileRows={[]}
        manualSections={{ servicesText: "", faqsText: "", policiesText: "" }}
        onSetBusinessField={vi.fn()}
        onSetManualSection={vi.fn()}
        onSaveBusiness={vi.fn()}
        onClose={vi.fn()}
        reviewSources={[
          {
            sourceType: "website",
            label: "Website",
            url: "https://northstar.example",
            role: "primary",
          },
        ]}
        currentReview={{
          draft: {
            businessProfile: {
              companyName: "Northstar Legal",
              websiteUrl: "https://northstar.example",
              primaryPhone: "+442079460958",
              primaryEmail: "hello@northstar.example",
              description: "Commercial advisory for founders and growing teams.",
            },
          },
          fieldProvenance: {
            companyName: {
              sourceType: "website",
              sourceUrl: "https://northstar.example",
              label: "Website",
              observedValue: "Northstar Legal",
              value: "Northstar Legal",
            },
            websiteUrl: {
              sourceType: "website",
              sourceUrl: "https://northstar.example",
              label: "Website",
              observedValue: "https://northstar.example",
              value: "https://northstar.example",
            },
            primaryPhone: {
              sourceType: "website",
              sourceUrl: "https://northstar.example/contact",
              label: "Website",
              observedValue: "+442079460958",
              value: "+442079460958",
            },
          },
          reviewDraftSummary: {
            warnings: [],
            warningCount: 0,
          },
        }}
        reviewSyncState={{}}
      />
    );

    expect(screen.getAllByText("Northstar Legal").length).toBeGreaterThan(1);
    expect(screen.getAllByText("https://northstar.example").length).toBeGreaterThan(1);
    expect(screen.getAllByText("+442079460958").length).toBeGreaterThan(1);
    expect(screen.getByText(/review detected information before saving it to your business profile/i)).toBeTruthy();
    expect(screen.getAllByText(/view source/i).length).toBeGreaterThan(0);
  });

  it("falls back to provenance observed values when overview rows are empty", () => {
    render(
      <ReviewWorkspace
        savingBusiness={false}
        businessForm={{
          companyName: "",
          websiteUrl: "",
          primaryPhone: "",
          primaryEmail: "",
          primaryAddress: "",
          language: "",
          description: "",
          behavior: "",
        }}
        discoveryProfileRows={[]}
        manualSections={{ servicesText: "", faqsText: "", policiesText: "" }}
        onSetBusinessField={vi.fn()}
        onSetManualSection={vi.fn()}
        onSaveBusiness={vi.fn()}
        onClose={vi.fn()}
        reviewSources={[
          {
            sourceType: "website",
            label: "Website",
            url: "https://northstar.example",
            role: "primary",
          },
        ]}
        currentReview={{
          draft: {
            businessProfile: {},
          },
          fieldProvenance: {
            companyName: {
              sourceType: "website",
              sourceUrl: "https://northstar.example",
              label: "Website",
              observed_value: "Northstar Legal",
            },
            primaryPhone: {
              sourceType: "website",
              sourceUrl: "https://northstar.example/contact",
              label: "Website",
              observed_value: "+442079460958",
            },
          },
          reviewDraftSummary: {
            warnings: [],
            warningCount: 0,
          },
        }}
        reviewSyncState={{}}
      />
    );

    expect(screen.getAllByText("Northstar Legal").length).toBeGreaterThan(1);
    expect(screen.getAllByText("+442079460958").length).toBeGreaterThan(1);
  });

  it("uses provenance observed values in discovery profile rows when the profile is weak", () => {
    const rows = profilePreviewRowsWithProvenance(
      {},
      {
        companyName: {
          sourceType: "website",
          sourceUrl: "https://northstar.example",
          label: "Website",
          observedValue: "Northstar Legal",
        },
        primaryEmail: {
          sourceType: "website",
          sourceUrl: "https://northstar.example/contact",
          label: "Website",
          observed_value: "hello@northstar.example",
        },
      }
    );

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "companyName",
          value: "Northstar Legal",
        }),
        expect.objectContaining({
          fieldKey: "primaryEmail",
          value: "hello@northstar.example",
        }),
      ])
    );
  });

  it("keeps field mapping stable when earlier fields are empty", () => {
    const rows = profilePreviewRowsWithProvenance(
      {
        primaryPhone: "+15550001111",
        primaryEmail: "hello@harbor.example",
      },
      {}
    );

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "primaryPhone",
          label: "Phone",
          value: "+15550001111",
        }),
        expect.objectContaining({
          fieldKey: "primaryEmail",
          label: "Email",
          value: "hello@harbor.example",
        }),
      ])
    );
    expect(rows.find((row) => row.fieldKey === "websiteUrl")).toBeUndefined();
  });

  it("keeps provenance attached to the correct field when profile rows are sparse", () => {
    const rows = profilePreviewRowsWithProvenance(
      {},
      {
        primaryPhone: {
          label: "Website",
          observedValue: "+15550001111",
        },
        primaryEmail: {
          label: "Website",
          observedValue: "hello@harbor.example",
        },
      }
    );

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "primaryPhone",
          label: "Phone",
          value: "+15550001111",
        }),
        expect.objectContaining({
          fieldKey: "primaryEmail",
          label: "Email",
          value: "hello@harbor.example",
        }),
      ])
    );
  });

  it("does not render generic duplicate source blocks without field-specific evidence", () => {
    render(
      <ReviewWorkspace
        savingBusiness={false}
        businessForm={{
          companyName: "",
          websiteUrl: "",
          primaryPhone: "",
          primaryEmail: "",
          primaryAddress: "",
          language: "",
          description: "",
          behavior: "",
        }}
        discoveryProfileRows={[]}
        manualSections={{ servicesText: "", faqsText: "", policiesText: "" }}
        onSetBusinessField={vi.fn()}
        onSetManualSection={vi.fn()}
        onSaveBusiness={vi.fn()}
        onClose={vi.fn()}
        reviewSources={[
          {
            sourceType: "website",
            label: "Website",
            url: "https://northstar.example",
            role: "primary",
          },
        ]}
        currentReview={{
          draft: {
            businessProfile: {
              companyName: "Northstar Legal",
            },
          },
          fieldProvenance: {
            companyName: {
              label: "Website",
              url: "https://northstar.example",
            },
          },
        }}
        reviewSyncState={{}}
      />
    );

    expect(screen.queryByText(/view source/i)).toBeNull();
    expect(screen.queryByText(/^source details$/i)).toBeNull();
  });

  it("renders professional copy and confidence labels", () => {
    render(
      <ReviewWorkspace
        savingBusiness={false}
        businessForm={{
          companyName: "",
          websiteUrl: "",
          primaryPhone: "",
          primaryEmail: "",
          primaryAddress: "",
          language: "",
          description: "",
          behavior: "",
        }}
        discoveryProfileRows={[]}
        manualSections={{ servicesText: "", faqsText: "", policiesText: "" }}
        onSetBusinessField={vi.fn()}
        onSetManualSection={vi.fn()}
        onSaveBusiness={vi.fn()}
        onClose={vi.fn()}
        currentReview={{
          draft: {
            businessProfile: {
              primaryPhone: "+15550001111",
            },
          },
          reviewDraftSummary: {
            fieldConfidence: {
              primaryPhone: 0.92,
            },
          },
          fieldProvenance: {
            primaryPhone: {
              label: "Website",
              observedValue: "+15550001111",
              note: "Homepage footer",
            },
          },
        }}
        reviewSyncState={{}}
      />
    );

    expect(screen.getByText(/detected business details/i)).toBeTruthy();
    expect(screen.getAllByText(/your draft/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/detected from source/i).length).toBeGreaterThan(1);
    expect(screen.getByText(/high confidence/i)).toBeTruthy();
    expect(
      screen.getByText(/this value has strong source support, but it should still be confirmed before saving/i)
    ).toBeTruthy();
  });

  it("shows only evidence-backed fields when a weak website scan yields a small useful draft", () => {
    render(
      <ReviewWorkspace
        savingBusiness={false}
        businessForm={{
          companyName: "",
          websiteUrl: "",
          primaryPhone: "",
          primaryEmail: "",
          primaryAddress: "",
          timezone: "Asia/Baku",
          language: "en",
          description: "",
          behavior: "",
        }}
        discoveryProfileRows={[]}
        manualSections={{ servicesText: "", faqsText: "", policiesText: "" }}
        onSetBusinessField={vi.fn()}
        onSetManualSection={vi.fn()}
        onSaveBusiness={vi.fn()}
        onClose={vi.fn()}
        currentReview={{
          draft: {
            businessProfile: {
              companyName: "Harbor Accounting",
              websiteUrl: "https://harbor.example",
              primaryPhone: "+442079460958",
            },
            warnings: [
              "limited_page_coverage",
              "faq_help_content_not_detected",
            ],
          },
          fieldProvenance: {
            companyName: {
              label: "Website",
              observedValue: "Harbor Accounting",
            },
            websiteUrl: {
              label: "Website",
              observedValue: "https://harbor.example",
            },
            primaryPhone: {
              label: "Website",
              observedValue: "+442079460958",
            },
          },
          reviewDraftSummary: {
            warnings: ["limited_page_coverage", "faq_help_content_not_detected"],
            warningCount: 2,
          },
        }}
        reviewSyncState={{}}
      />
    );

    expect(screen.getByText("Company name")).toBeTruthy();
    expect(screen.getByText("Website URL")).toBeTruthy();
    expect(screen.getByText("Primary phone")).toBeTruthy();
    expect(screen.queryByText("Primary email")).toBeNull();
    expect(screen.queryByText("Primary address")).toBeNull();
    expect(screen.queryByText("Timezone")).toBeNull();
    expect(screen.queryByText("Primary language")).toBeNull();
    expect(screen.queryByText("Short business summary")).toBeNull();
    expect(screen.queryByText(/faq\/help content/i)).toBeNull();
  });
});
