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
    assistant: {
      nextQuestion: {
        key: "website",
        prompt: "Saytin var?",
        placeholder: "https://yourbusiness.com",
      },
      conversation: [
        {
          id: "q:website",
          role: "assistant",
          step: "website",
          text: "Saytin var?",
        },
      ],
      composer: {
        step: "website",
        placeholder: "https://yourbusiness.com",
      },
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
    expect(screen.getByText("Saytin var?")).toBeInTheDocument();

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
