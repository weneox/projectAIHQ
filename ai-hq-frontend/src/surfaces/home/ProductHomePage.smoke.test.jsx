import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
const useProductHome = vi.fn();

vi.mock("../../view-models/useProductHome.js", () => ({
  default: (...args) => useProductHome(...args),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

import ProductHomePage from "./ProductHomePage.jsx";

describe("ProductHomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useProductHome.mockReturnValue({
      loading: false,
      isFetching: false,
      refetch: vi.fn(),
      actorName: "Owner",
      companyName: "Acme Clinic",
      availabilityNote: null,
      currentStatus: {
        title: "The inbox is the next place that needs an operator.",
        summary: "3 unread messages are waiting across 2 open conversations.",
        action: { label: "Open inbox", path: "/inbox" },
        secondaryAction: { label: "Open comments", path: "/comments" },
      },
      heroStats: [
        {
          id: "setup",
          label: "Sources and setup",
          status: "In progress",
          summary: "Pricing and service details are still missing.",
          action: { label: "Continue setup", path: "/setup" },
        },
        {
          id: "memory",
          label: "Business memory",
          status: "Review waiting",
          summary: "2 proposed business changes need confirmation.",
          action: { label: "Review business changes", path: "/truth" },
        },
        {
          id: "inbox",
          label: "Launch activity",
          status: "Needs attention",
          summary: "3 unread messages are waiting across 2 open conversations.",
          action: { label: "Open inbox", path: "/inbox" },
        },
      ],
      supportingStatus: [
        {
          id: "setup-support",
          label: "Setup",
          status: "In progress",
          summary: "Pricing and service details are still missing.",
          action: { label: "Continue setup", path: "/setup" },
        },
      ],
      entryPoints: [
        {
          id: "inbox",
          title: "Social Inbox",
          status: "Start here",
          summary: "Handle Meta messaging, queue pressure, and operator follow-up in one place.",
          detail: "3 unread messages are waiting across 2 open conversations.",
          action: { label: "Open inbox", path: "/inbox" },
        },
        {
          id: "comments",
          title: "Comments",
          status: "Launch now",
          summary: "Review Meta comments, approve or intervene on replies, and keep moderation work moving.",
          detail: "Comments is one of the real launch loops and should stay in the front row of the product.",
          action: { label: "Open comments", path: "/comments" },
        },
        {
          id: "voice",
          title: "Voice Receptionist",
          status: "Launch now",
          summary: "Run the live Twilio receptionist loop from one call control surface.",
          detail: "Voice is part of the actual launch slice and should read that way across the product.",
          action: { label: "Open voice", path: "/voice" },
        },
      ],
      entryPointGroups: {
        featured: [
          {
            id: "inbox",
            title: "Social Inbox",
            status: "Start here",
            summary: "Handle Meta messaging, queue pressure, and operator follow-up in one place.",
            detail: "3 unread messages are waiting across 2 open conversations.",
            action: { label: "Open inbox", path: "/inbox" },
          },
          {
            id: "comments",
            title: "Comments",
            status: "Launch now",
            summary: "Review Meta comments, approve or intervene on replies, and keep moderation work moving.",
            detail: "Comments is one of the real launch loops and should stay in the front row of the product.",
            action: { label: "Open comments", path: "/comments" },
          },
          {
            id: "voice",
            title: "Voice Receptionist",
            status: "Launch now",
            summary: "Run the live Twilio receptionist loop from one call control surface.",
            detail: "Voice is part of the actual launch slice and should read that way across the product.",
            action: { label: "Open voice", path: "/voice" },
          },
        ],
        secondary: [],
      },
      benefits: [
        {
          id: "sources",
          title: "Faster setup from real sources",
          summary: "Bring source intake, review, and setup completion into one controlled path instead of stitching the business together by hand.",
        },
      ],
      finalActions: [
        { label: "Open inbox", path: "/inbox" },
        { label: "Open comments", path: "/comments" },
      ],
    });
  });

  it("renders a real product home and routes CTAs into the app", () => {
    render(
      <MemoryRouter>
        <ProductHomePage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", {
        name: "Run social inbox, auto-comment, and voice receptionist from one operator product.",
      })
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Open inbox" })[0]);

    expect(navigate).toHaveBeenCalledWith("/inbox");
  });
});
