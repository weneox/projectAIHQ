import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import SetupReviewActivationPanel from "../../../components/setup/SetupReviewActivationPanel.jsx";

function createReviewPayload() {
  return {
    review: {
      draft: {
        businessProfile: {
          companyName: "Luna Smile Studio",
          description:
            "Cosmetic dentistry, implants, whitening, and family care in Baku.",
          websiteUrl: "https://lunasmile.az",
          primaryPhone: "+994 50 555 12 12",
          primaryEmail: "hello@lunasmile.az",
          primaryAddress: "14 Nizami Street, Baku",
          hours: ["Mon-Fri 09:00-18:00"],
          pricingPolicy:
            "Consultation from 30 AZN. Exact treatment pricing requires a quote.",
        },
        services: [
          { title: "Smile design" },
          { title: "Dental implants" },
          { title: "Teeth whitening" },
        ],
        sourceSummary: {
          primarySourceType: "website",
          primarySourceUrl: "https://lunasmile.az",
        },
      },
      fieldProvenance: {
        companyName: {
          sourceType: "website",
          label: "Website",
          observedValue: "Luna Smile Studio",
        },
        primaryPhone: {
          sourceType: "website",
          label: "Website",
          observedValue: "+994 50 555 12 12",
        },
      },
      reviewDebug: {
        websiteKnowledge: {
          pageCount: 4,
          topPages: [
            {
              url: "https://lunasmile.az/services",
              title: "Services",
              pageType: "services",
            },
            {
              url: "https://lunasmile.az/contact",
              title: "Contact",
              pageType: "contact",
            },
          ],
        },
      },
    },
    bundleSources: [
      {
        sourceId: "source-1",
        sourceType: "website",
        role: "primary",
        label: "Main website",
        sourceUrl: "https://lunasmile.az",
        observationCount: 18,
      },
    ],
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
  it("renders a serious business truth review with sources, fields, and evidence", () => {
    const onFinalize = vi.fn();

    render(
      <SetupReviewActivationPanel
        reviewPayload={createReviewPayload()}
        onFinalize={onFinalize}
      />
    );

    expect(
      screen.getByRole("region", { name: "Business truth review" })
    ).toBeInTheDocument();
    expect(screen.getByText("Approve business truth")).toBeInTheDocument();
    expect(screen.getByText("Main website")).toBeInTheDocument();
    expect(screen.getByText("Business name")).toBeInTheDocument();
    expect(screen.getAllByText(/Luna Smile Studio/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Sources used")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Approve truth" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Approve truth" }));
    expect(onFinalize).toHaveBeenCalledTimes(1);
  });

  it("stays hidden when review material is absent", () => {
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

  it("supports non-website review payloads as long as truth rows exist", () => {
    render(
      <SetupReviewActivationPanel
        reviewPayload={{
          review: {
            draft: {
              businessProfile: {
                companyName: "Manual Clinic",
                description: "Walk-in care and appointments.",
              },
              sourceSummary: {
                primarySourceType: "manual",
              },
            },
          },
        }}
      />
    );

    expect(
      screen.getByRole("region", { name: "Business truth review" })
    ).toBeInTheDocument();
    expect(screen.getByText("Manual Clinic")).toBeInTheDocument();
    expect(screen.getByText("Walk-in care and appointments.")).toBeInTheDocument();
    expect(screen.queryByText("Sources used")).not.toBeInTheDocument();
  });

  it("does not dump raw debug keys into the operator view", () => {
    render(<SetupReviewActivationPanel reviewPayload={createReviewPayload()} />);

    expect(screen.queryByText(/reviewDebug/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pageCount/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/topPages/i)).not.toBeInTheDocument();
  });
});
