import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, beforeEach, vi } from "vitest";

import FloatingAiWidget from "../../../components/layout/FloatingAiWidget.jsx";
import {
  getCurrentSetupAssistantSession,
  getCurrentSetupReview,
  importWebsiteForSetup,
} from "../../../api/setup.js";

const useWorkspaceTenantKey = vi.fn();

vi.mock("../../../api/setup.js", () => ({
  finalizeSetupAssistantSession: vi.fn(),
  getCurrentSetupAssistantSession: vi.fn(),
  getCurrentSetupReview: vi.fn(),
  importWebsiteForSetup: vi.fn(),
  sendSetupAssistantMessage: vi.fn(),
  startSetupAssistantSession: vi.fn(),
  updateCurrentSetupAssistantDraft: vi.fn(),
}));

vi.mock("../../../hooks/useWorkspaceTenantKey.js", () => ({
  default: (...args) => useWorkspaceTenantKey(...args),
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
    title: "Structured setup",
    statusLabel: "In progress",
    summary: "Confirm the draft before anything reaches approved truth.",
    primaryAction: {
      label: "Open AI setup",
      path: "/home?assistant=setup",
    },
    secondaryAction: {
      label: "Open truth",
      path: "/truth",
    },
    review: {
      message: "Draft work stays separate from approved truth until review.",
      readyForReview: true,
      finalizeAvailable: true,
    },
    launchPosture: "setup_needed",
    setupNeeded: true,
    session: {
      id: "session-1",
    },
    draft: {
      businessProfile: {},
      services: [],
      contacts: [],
      hours: [],
      pricingPosture: {},
      handoffRules: {},
      sourceMetadata: {
        primarySourceType: "website",
      },
      assistantState: {
        activeSection: "profile",
      },
      version: 2,
      updatedAt: null,
    },
    websitePrefill: {
      supported: true,
      status: "captured",
      websiteUrl: "https://lunasmile.az",
    },
    assistant: {
      nextQuestion: {
        key: "profile",
      },
      confirmationBlockers: [],
      sections: [],
      completion: {
        ready: true,
      },
      servicesCatalog: {
        items: [],
        packs: [],
        suggestedServices: [],
      },
      sourceInsights: [],
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

function createWebsiteReviewPayload() {
  return {
    review: {
      draft: {
        businessProfile: {
          primaryPhone: "+994 50 555 12 12",
          primaryEmail: "hello@lunasmile.az",
          primaryAddress: "14 Nizami Street, Baku",
          hours: ["Mon-Fri 09:00-18:00"],
        },
      },
      reviewDebug: {
        websiteKnowledge: {
          finalUrl: "https://lunasmile.az",
          pageCount: 4,
          artifactCount: 5,
          coverage: {
            pagesRequested: 6,
            pagesSucceeded: 4,
            pagesKept: 4,
          },
          siteQuality: {
            score: 82,
            band: "strong",
          },
          pageTypeCounts: {
            home: 1,
            services: 1,
            pricing: 1,
            contact: 1,
          },
          draftSections: {
            summaryShort:
              "Luna Smile Studio is a Baku dental clinic focused on cosmetic dentistry, implants, whitening, and family care.",
            servicesDraft: ["Smile design", "Dental implants"],
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
              url: "https://lunasmile.az/contact",
              title: "Contact",
              pageType: "contact",
              contactSignalCount: 3,
              hourCount: 1,
            },
          ],
        },
      },
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

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderControlledWidget(
  assistant = createAssistant(),
  { queryClient = null, open = true } = {}
) {
  const client = queryClient || createQueryClient();
  const navigate = vi.fn();
  const onOpenChange = vi.fn();
  const view = render(
    <QueryClientProvider client={client}>
      <FloatingAiWidget
        open={open}
        onOpenChange={onOpenChange}
        onNavigate={navigate}
        assistant={assistant}
      />
    </QueryClientProvider>
  );

  return {
    client,
    navigate,
    onOpenChange,
    rerenderWidget(nextAssistant = assistant, nextOptions = {}) {
      view.rerender(
        <QueryClientProvider client={client}>
          <FloatingAiWidget
            open={nextOptions.open ?? open}
            onOpenChange={onOpenChange}
            onNavigate={navigate}
            assistant={nextAssistant}
          />
        </QueryClientProvider>
      );
    },
    ...view,
  };
}

function renderWidget(assistant = createAssistant(), { queryClient = null } = {}) {
  const client = queryClient || createQueryClient();
  const navigate = vi.fn();

  function Harness() {
    const [open, setOpen] = useState(false);

    return (
      <QueryClientProvider client={client}>
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
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceTenantKey.mockReturnValue({
      tenantKey: "acme",
      loading: false,
      ready: true,
    });
    vi.mocked(getCurrentSetupAssistantSession).mockResolvedValue(null);
    vi.mocked(getCurrentSetupReview).mockResolvedValue({
      review: {
        reviewDebug: {},
      },
    });
    vi.mocked(importWebsiteForSetup).mockResolvedValue({ ok: true });
  });

  it("opens the assistant and loads the website review scene when review data exists", async () => {
    vi.mocked(getCurrentSetupReview).mockResolvedValue(createWebsiteReviewPayload());

    renderWidget();

    fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));

    expect(
      screen.getByRole("dialog", { name: "AI assistant" })
    ).toBeInTheDocument();

    expect(
      await screen.findByRole("region", { name: "Website knowledge review" })
    ).toBeInTheDocument();
    expect(screen.getByText("What the site seems to mean")).toBeInTheDocument();
    expect(screen.getByText("Top pages")).toBeInTheDocument();
    expect(screen.getAllByText("Services").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Close AI assistant" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "AI assistant" })
      ).not.toBeInTheDocument();
    });
  });

  it("keeps the website review scene hidden when no website knowledge is available", async () => {
    renderWidget();

    fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));

    await waitFor(() => {
      expect(getCurrentSetupReview).toHaveBeenCalled();
    });

    expect(
      screen.queryByRole("region", { name: "Website knowledge review" })
    ).not.toBeInTheDocument();
  });

  it("scans the website from the setup widget and refreshes the review payload", async () => {
    vi.mocked(getCurrentSetupReview)
      .mockResolvedValueOnce({
        review: {
          reviewDebug: {},
        },
      })
      .mockResolvedValue(createWebsiteReviewPayload());

    renderWidget();

    fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));

    expect(
      await screen.findByRole("button", { name: "Scan website" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Scan website" }));

    await waitFor(() =>
      expect(importWebsiteForSetup).toHaveBeenCalledWith({
        websiteUrl: "https://lunasmile.az",
        allowSessionReuse: true,
        waitForCompletion: true,
      })
    );

    expect(
      await screen.findByRole("region", { name: "Website knowledge review" })
    ).toBeInTheDocument();
  });

  it("does not reuse setup-review cache across workspaces", async () => {
    const queryClient = createQueryClient();

    useWorkspaceTenantKey.mockReturnValue({
      tenantKey: "acme",
      loading: false,
      ready: true,
    });
    vi.mocked(getCurrentSetupReview).mockResolvedValueOnce({
      review: {
        reviewDebug: {},
      },
    });

    const first = renderWidget(createAssistant(), { queryClient });
    fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));

    await waitFor(() => {
      expect(getCurrentSetupReview).toHaveBeenCalledTimes(1);
    });

    first.unmount();

    useWorkspaceTenantKey.mockReturnValue({
      tenantKey: "globex",
      loading: false,
      ready: true,
    });
    vi.mocked(getCurrentSetupReview).mockResolvedValueOnce({
      review: {
        reviewDebug: {},
      },
    });

    renderWidget(createAssistant(), { queryClient });
    fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));

    await waitFor(() => {
      expect(getCurrentSetupReview).toHaveBeenCalledTimes(2);
    });
  });

  it("does not reuse setup-session cache across workspaces", async () => {
    const queryClient = createQueryClient();

    useWorkspaceTenantKey.mockReturnValue({
      tenantKey: "acme",
      loading: false,
      ready: true,
    });
    vi.mocked(getCurrentSetupAssistantSession).mockResolvedValueOnce({
      session: {
        id: "session-acme",
      },
      setup: {
        websitePrefill: {
          websiteUrl: "https://lunasmile.az",
        },
      },
    });

    const first = renderControlledWidget(createAssistant(), {
      queryClient,
      open: true,
    });

    await waitFor(() => {
      expect(getCurrentSetupAssistantSession).toHaveBeenCalledTimes(1);
    });

    first.unmount();

    useWorkspaceTenantKey.mockReturnValue({
      tenantKey: "globex",
      loading: false,
      ready: true,
    });
    vi.mocked(getCurrentSetupAssistantSession).mockResolvedValueOnce({
      session: {
        id: "session-globex",
      },
      setup: {
        websitePrefill: {
          websiteUrl: "https://globex.example",
        },
      },
    });

    renderControlledWidget(createAssistant(), {
      queryClient,
      open: true,
    });

    await waitFor(() => {
      expect(getCurrentSetupAssistantSession).toHaveBeenCalledTimes(2);
    });
  });

  it("drops stale setup review content while the widget switches tenants", async () => {
    const queryClient = createQueryClient();
    const nextSessionPromise = new Promise(() => {});
    const nextReviewPromise = new Promise(() => {});

    vi.mocked(getCurrentSetupAssistantSession).mockResolvedValueOnce({
      session: {
        id: "session-acme",
      },
      setup: {
        websitePrefill: {
          websiteUrl: "https://lunasmile.az",
        },
      },
    });
    vi.mocked(getCurrentSetupReview).mockResolvedValueOnce(
      createWebsiteReviewPayload()
    );

    const view = renderControlledWidget(createAssistant(), {
      queryClient,
      open: true,
    });

    expect(
      await screen.findByRole("region", { name: "Website knowledge review" })
    ).toBeInTheDocument();

    useWorkspaceTenantKey.mockReturnValue({
      tenantKey: "globex",
      loading: false,
      ready: true,
    });
    vi.mocked(getCurrentSetupAssistantSession).mockImplementationOnce(
      () => nextSessionPromise
    );
    vi.mocked(getCurrentSetupReview).mockImplementationOnce(() => nextReviewPromise);

    view.rerenderWidget(
      createAssistant({
        title: "Loading AI setup",
        statusLabel: "Loading",
        summary: "Loading the current workspace setup state.",
        session: {},
        draft: {
          businessProfile: {},
          services: [],
          contacts: [],
          hours: [],
          pricingPosture: {},
          handoffRules: {},
          sourceMetadata: {},
          assistantState: {},
          version: 0,
          updatedAt: null,
        },
        websitePrefill: {
          supported: true,
          status: "awaiting_input",
          websiteUrl: "",
        },
      }),
      { open: true }
    );

    await waitFor(() => {
      expect(getCurrentSetupAssistantSession).toHaveBeenCalledTimes(2);
    });

    expect(
      screen.queryByRole("region", { name: "Website knowledge review" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("https://lunasmile.az")).not.toBeInTheDocument();
  });
});
