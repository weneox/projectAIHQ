import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import FloatingAiWidget from "../../../components/layout/FloatingAiWidget.jsx";

function createAssistant(overrides = {}) {
  return {
    mode: "onboarding",
    title: "Telegram is connected. Start the first structured business draft.",
    statusLabel: "Start onboarding",
    summary: "Capture the website first. Nothing in this batch goes live automatically.",
    primaryAction: {
      label: "Start AI onboarding",
      path: "/home?assistant=setup",
    },
    secondaryAction: {
      label: "Open truth",
      path: "/truth",
    },
    messages: [
      {
        id: "assistant-start",
        role: "assistant",
        title: "Start with the website.",
        body: "Capture the business website first and keep it in a draft-only onboarding lane.",
      },
    ],
    review: {
      message:
        "Draft answers remain isolated from approved truth and runtime until a later approval step is added.",
    },
    launchPosture: "onboarding_needed",
    onboardingNeeded: true,
    session: {},
    draft: {
      businessProfile: {},
      services: [],
      contacts: [],
      hours: [],
      pricingPosture: {},
      handoffRules: {},
      version: 0,
      updatedAt: null,
    },
    websitePrefill: {
      supported: true,
      status: "awaiting_input",
      websiteUrl: "",
    },
    launchChannel: {
      connected: true,
    },
    truthRuntime: {
      ready: false,
    },
    ...overrides,
  };
}

function renderWidget(assistant = createAssistant()) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const navigate = vi.fn();

  function Harness() {
    const [open, setOpen] = useState(false);

    return (
      <QueryClientProvider client={queryClient}>
        <FloatingAiWidget
          open={open}
          onOpenChange={setOpen}
          onNavigate={navigate}
          assistant={assistant}
        />
      </QueryClientProvider>
    );
  }

  return {
    navigate,
    ...render(<Harness />),
  };
}

describe("FloatingAiWidget", () => {
  it("opens and closes the onboarding panel manually", () => {
    renderWidget();

    fireEvent.click(screen.getByRole("button", { name: "Open AI onboarding assistant" }));

    expect(
      screen.getByRole("dialog", { name: "AI onboarding assistant" })
    ).toBeInTheDocument();
    expect(screen.getByText("Conversation")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Close AI onboarding assistant" })
    );

    expect(
      screen.queryByRole("dialog", { name: "AI onboarding assistant" })
    ).not.toBeInTheDocument();
  });

  it("shows the review placeholder view when switched from conversation", () => {
    renderWidget();

    fireEvent.click(screen.getByRole("button", { name: "Open AI onboarding assistant" }));
    fireEvent.click(screen.getByRole("button", { name: "Draft review" }));

    expect(screen.getByText("Review placeholder")).toBeInTheDocument();
    expect(screen.getByText("Final review stays intentionally gated.")).toBeInTheDocument();
  });
});
