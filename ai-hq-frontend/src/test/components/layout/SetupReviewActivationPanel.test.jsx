import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import SetupReviewActivationPanel from "../../../components/layout/SetupReviewActivationPanel.jsx";

function createReviewPayload() {
  return {
    review: {
      draft: {
        businessProfile: {
          primaryPhone: "+994 50 555 12 12",
          primaryEmail: "hello@lunasmile.az",
          primaryAddress: "14 Nizami Street, Baku",
          hours: ["Mon-Fri 09:00-18:00"],
          pricingPolicy: "Consultation-first pricing with quoted treatment plans.",
        },
        knowledgeItems: [
          {
            category: "faq",
            title: "Do you offer weekend appointments?",
          },
        ],
      },
      fieldProvenance: {
        primaryPhone: {
          sourceType: "website",
          sourceUrl: "https://lunasmile.az/contact",
        },
        services: {
          sourceType: "website",
          sourceUrl: "https://lunasmile.az/services",
        },
      },
      reviewDebug: {
        websiteKnowledge: {
          finalUrl: "https://lunasmile.az",
          pageCount: 4,
          artifactCount: 5,
          siteQuality: {
            score: 82,
            band: "strong",
          },
          chunkCount: 24,
          pageTypeCounts: {
            home: 1,
            services: 1,
            pricing: 1,
            contact: 1,
          },
          coverage: {
            pagesRequested: 6,
            pagesSucceeded: 4,
            pagesKept: 4,
          },
          signalCounts: {
            services: 4,
            faqItems: 1,
            pricingHints: 1,
            policies: 1,
            contactSignals: 3,
          },
          draftSections: {
            summaryShort:
              "Luna Smile Studio is a Baku dental clinic focused on cosmetic dentistry, implants, whitening, and family care.",
            servicesDraft: [
              "Smile design",
              "Dental implants",
              "Teeth whitening",
            ],
            faqQuestions: ["Do you offer weekend appointments?"],
            policyHighlights: [
              "Please notify us 24 hours in advance for treatment changes.",
            ],
            pricingHints: ["Consultation from 30 AZN."],
          },
          topPages: [
            {
              url: "https://lunasmile.az/services",
              title: "Services",
              pageType: "services",
              serviceHintCount: 4,
            },
            {
              url: "https://lunasmile.az/pricing",
              title: "Pricing",
              pageType: "pricing",
              pricingHintCount: 2,
            },
            {
              url: "https://lunasmile.az/contact",
              title: "Contact",
              pageType: "contact",
              contactSignalCount: 3,
              hourCount: 1,
            },
          ],
          pageAdmissions: [{ url: "https://lunasmile.az/contact", admitted: true }],
        },
      },
    },
    reviewDraftSummary: {
      websitePageCount: 4,
      websiteArtifactCount: 5,
    },
    permissions: {
      setupReviewFinalize: {
        allowed: true,
      },
    },
    setup: {
      review: {
        finalizeAvailable: true,
      },
    },
  };
}

describe("SetupReviewActivationPanel", () => {
  it("renders a compact website review summary, sections, and top pages", () => {
    const onFinalize = vi.fn();

    render(
      <SetupReviewActivationPanel
        reviewPayload={createReviewPayload()}
        onFinalize={onFinalize}
      />
    );

    expect(
      screen.getByRole("region", { name: "Website knowledge review" })
    ).toBeInTheDocument();
    expect(screen.getByText("Website draft")).toBeInTheDocument();
    expect(screen.getByText("What the site seems to mean")).toBeInTheDocument();
    expect(screen.getByText("Strong")).toBeInTheDocument();
    expect(screen.getByText("Draft sections")).toBeInTheDocument();
    expect(screen.getByText("Top pages")).toBeInTheDocument();
    expect(screen.getByText(/Smile design/i)).toBeInTheDocument();
    expect(screen.getByText(/Do you offer weekend appointments/i)).toBeInTheDocument();
    expect(screen.getAllByText("Services").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pricing").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Contact").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Finish setup" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Finish setup" }));
    expect(onFinalize).toHaveBeenCalledTimes(1);
  });

  it("stays hidden when website-derived review data is absent", () => {
    const { container } = render(
      <SetupReviewActivationPanel
        reviewPayload={{
          review: {
            reviewDebug: {},
          },
        }}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("does not dump raw debug keys into the operator view", () => {
    render(<SetupReviewActivationPanel reviewPayload={createReviewPayload()} />);

    expect(screen.queryByText(/pageAdmissions/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/chunkCount/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/signalCounts/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/reviewDebug/i)).not.toBeInTheDocument();
  });

  it("uses the existing setup review state for finalize readiness", () => {
    const reviewPayload = createReviewPayload();
    delete reviewPayload.setup;
    delete reviewPayload.permissions;

    render(
      <SetupReviewActivationPanel
        reviewPayload={reviewPayload}
        assistantReview={{ finalizeAvailable: true }}
        onFinalize={() => {}}
      />
    );

    expect(
      screen.getByRole("button", { name: "Finish setup" })
    ).toBeInTheDocument();
  });
});
