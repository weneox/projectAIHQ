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
    expect(screen.getAllByText(/open source/i).length).toBeGreaterThan(0);
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
});
