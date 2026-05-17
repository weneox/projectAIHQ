import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FloatingAiWidget from "../../../components/layout/FloatingAiWidget.jsx";
import {
  discardCurrentSetupReview,
  finalizeSetupAssistantSession,
  getCurrentSetupAssistantSession,
  getCurrentSetupReview,
  sendSetupAssistantMessage,
  startSetupAssistantSession,
} from "../../../api/setup.js";

const useWorkspaceTenantKey = vi.fn();

vi.mock("../../../api/setup.js", () => ({
  discardCurrentSetupReview: vi.fn(),
  finalizeSetupAssistantSession: vi.fn(),
  getCurrentSetupAssistantSession: vi.fn(),
  getCurrentSetupReview: vi.fn(),
  sendSetupAssistantMessage: vi.fn(),
  startSetupAssistantSession: vi.fn(),
}));

vi.mock("../../../hooks/useWorkspaceTenantKey.js", () => ({
  useWorkspaceTenantKey: (...args) => useWorkspaceTenantKey(...args),
  buildWorkspaceScopedQueryKey: (baseKey, tenantKey) => [
    ...(Array.isArray(baseKey) ? baseKey : [baseKey]),
    "workspace",
    String(tenantKey || "").trim().toLowerCase(),
  ],
}));

function createAssistant(overrides = {}) {
  return {
    mode: "setup",
    title: "Setup studio",
    summary: "Start from sources, then confirm only the important fields.",
    primaryAction: { label: "Open setup", path: "/home?assistant=setup" },
    secondaryAction: null,
    review: {
      message: "Draft work stays separate from approved truth until finalize.",
      readyForReview: false,
      finalizeAvailable: false,
    },
    websitePrefill: {
      supported: true,
      status: "awaiting_input",
      websiteUrl: "",
    },
    session: {
      id: "",
      draftVersion: 0,
    },
    setupSummary: {},
    draft: {
      businessProfile: {},
      services: [],
      contacts: [],
      hours: [],
      pricingPosture: {},
      handoffRules: {},
      sourceMetadata: {},
      assistantState: {},
      progress: {},
      version: 0,
      updatedAt: null,
    },
    assistant: {
      nextQuestion: {},
      confirmationBlockers: [],
      sections: [],
      completion: {
        ready: false,
        action: null,
        message: "",
      },
      servicesCatalog: {
        items: [],
        packs: [],
        suggestedServices: [],
      },
      sourceInsights: [],
    },
    launchPosture: "setup_needed",
    setupNeeded: true,
    launchChannel: { connected: true },
    truthRuntime: { ready: false },
    statusLabel: "In progress",
    ...overrides,
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderWidget(assistant = createAssistant()) {
  const client = createQueryClient();

  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <FloatingAiWidget open onOpenChange={vi.fn()} assistant={assistant} />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe("FloatingAiWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollTo = vi.fn();

    useWorkspaceTenantKey.mockReturnValue({
      tenantKey: "acme",
      loading: false,
      ready: true,
    });

    vi.mocked(getCurrentSetupAssistantSession).mockResolvedValue(null);
    vi.mocked(getCurrentSetupReview).mockResolvedValue({ review: {} });
    vi.mocked(discardCurrentSetupReview).mockResolvedValue({ ok: true });
    vi.mocked(finalizeSetupAssistantSession).mockResolvedValue({ ok: true });
  });

  it("starts a setup session from the welcome state", async () => {
    vi.mocked(startSetupAssistantSession).mockResolvedValue({
      ok: true,
      session: { id: "session-1", draftVersion: 1 },
      setup: {
        draft: {},
      },
      assistant: {
        nextQuestion: {
          key: "company",
          step: "company",
          prompt: "What is your company name?",
        },
        readyForApproval: false,
      },
    });

    renderWidget();

    fireEvent.click(screen.getByRole("button", { name: "Start setup" }));

    await waitFor(() => {
      expect(startSetupAssistantSession).toHaveBeenCalledTimes(1);
    });
  });

  it("does not render legacy assistant behavior draft data", async () => {
    renderWidget(
      createAssistant({
        session: { id: "session-legacy", draftVersion: 1 },
        draft: {
          businessProfile: {
            companyName: "Luna Smile",
          },
          services: [],
          contacts: [],
          hours: [],
          pricingPosture: {},
          handoffRules: {},
          sourceMetadata: {},
          assistantBehaviorDraft: {
            greetingPolicy: {
              openingLine: "LEGACY GREETING SHOULD NOT RENDER",
            },
          },
          assistantState: {},
          progress: {},
          version: 1,
        },
        assistant: {
          nextQuestion: {
            key: "services",
            step: "services",
            prompt: "List the services.",
          },
          sections: [],
          timeline: [],
          readyForApproval: false,
        },
      })
    );

    expect(document.body).not.toHaveTextContent("LEGACY GREETING SHOULD NOT RENDER");
  });

  it("routes submitted answers through sendSetupAssistantMessage for the active step", async () => {
    vi.mocked(sendSetupAssistantMessage).mockResolvedValue({
      ok: true,
      session: { id: "session-1", draftVersion: 2 },
      setup: {
        draft: {},
      },
      assistant: {
        nextQuestion: {
          key: "description",
          step: "description",
          prompt: "What does the business do?",
        },
        readyForApproval: false,
      },
    });

    renderWidget(
      createAssistant({
        session: { id: "session-1", draftVersion: 1 },
        assistant: {
          nextQuestion: {
            key: "company",
            step: "company",
            prompt: "What is your company name?",
            phase: "business_truth",
            phaseLabel: "Business truth",
          },
          confirmationBlockers: [],
          sections: [],
          completion: {
            ready: false,
            action: null,
            message: "",
          },
          servicesCatalog: {
            items: [],
            packs: [],
            suggestedServices: [],
          },
          sourceInsights: [],
        },
      })
    );

    const composer = await screen.findByRole("textbox");

    fireEvent.change(composer, {
      target: { value: "Luna Smile" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(sendSetupAssistantMessage).toHaveBeenCalledWith({
        step: "company",
        answer: "Luna Smile",
      });
    });
  });
});
