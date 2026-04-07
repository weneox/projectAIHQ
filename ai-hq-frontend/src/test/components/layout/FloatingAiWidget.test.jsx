import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";

import FloatingAiWidget from "../../../components/layout/FloatingAiWidget.jsx";

function createAssistant(overrides = {}) {
  return {
    mode: "setup",
    title: "Telegram is connected. Start the first structured business draft.",
    statusLabel: "Start setup",
    summary: "Capture the website first. Nothing in this batch goes live automatically.",
    primaryAction: {
      label: "Start AI setup",
      path: "/home?assistant=setup",
    },
    secondaryAction: {
      label: "Open truth",
      path: "/truth",
    },
    review: {
      message:
        "Draft answers remain isolated from approved truth and runtime until a later approval step is added.",
    },
    launchPosture: "setup_needed",
    setupNeeded: true,
    session: {},
    draft: {
      businessProfile: {},
      services: [],
      contacts: [],
      hours: [
        { day: "monday", enabled: false, closed: true },
        { day: "tuesday", enabled: false, closed: true },
        { day: "wednesday", enabled: false, closed: true },
        { day: "thursday", enabled: false, closed: true },
        { day: "friday", enabled: false, closed: true },
        { day: "saturday", enabled: false, closed: true },
        { day: "sunday", enabled: false, closed: true },
      ],
      pricingPosture: {},
      handoffRules: {},
      sourceMetadata: {
        primarySourceType: "website",
      },
      assistantState: {
        activeSection: "profile",
      },
      version: 0,
      updatedAt: null,
    },
    websitePrefill: {
      supported: true,
      status: "awaiting_input",
      websiteUrl: "",
    },
    assistant: {
      nextQuestion: {
        key: "profile",
        prompt: "Confirm the business profile first.",
        placeholder: "https://yourbusiness.com",
      },
      confirmationBlockers: [
        {
          key: "profile",
          title: "Confirm who the business is",
          reason: "Website, name, and summary still need confirmation.",
          severity: "high",
        },
      ],
      sections: [
        {
          key: "profile",
          label: "Business profile",
          title: "Confirm who the business is",
          summary: "Add the core business identity.",
        },
      ],
      servicesCatalog: {
        items: [],
        packs: [],
        suggestedServices: [],
      },
      sourceInsights: ["Primary source: https://acme.test"],
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
  it("opens and closes the setup panel manually", () => {
    renderWidget();

    fireEvent.click(screen.getByRole("button", { name: "Open AI setup" }));

    expect(screen.getByRole("dialog", { name: "AI setup" })).toBeInTheDocument();
    expect(screen.getByText("Telegram is connected. Start the first structured business draft.")).toBeInTheDocument();
    expect(screen.getAllByText("Confirm who the business is").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Save section" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close AI setup" }));

    expect(
      screen.queryByRole("dialog", { name: "AI setup" })
    ).not.toBeInTheDocument();
  });

  it("uses the shortcut mode CTA to navigate back into Home setup", () => {
    const { navigate } = renderWidget(
      createAssistant({
        mode: "shortcut",
        title: "Setup",
      })
    );

    fireEvent.click(screen.getByRole("button", { name: "Open setup shortcut" }));
    fireEvent.click(screen.getByRole("button", { name: "Start AI setup" }));

    expect(navigate).toHaveBeenCalledWith("/home?assistant=setup");
  });
});
