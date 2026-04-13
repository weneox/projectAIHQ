import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, beforeEach, vi } from "vitest";

import FloatingAiWidget from "../../../components/layout/FloatingAiWidget.jsx";
import {
  analyzeSetupIntake,
  getCurrentSetupAssistantSession,
  getCurrentSetupReview,
  importGoogleMapsForSetup,
  importWebsiteForSetup,
  updateCurrentSetupAssistantDraft,
} from "../../../api/setup.js";

const useWorkspaceTenantKey = vi.fn();

vi.mock("../../../api/setup.js", () => ({
  analyzeSetupIntake: vi.fn(),
  finalizeSetupAssistantSession: vi.fn(),
  getCurrentSetupAssistantSession: vi.fn(),
  getCurrentSetupReview: vi.fn(),
  importGoogleMapsForSetup: vi.fn(),
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
    title: "Truth studio",
    statusLabel: "In progress",
    summary: "Approve business truth after source intake and confirmation.",
    primaryAction: {
      label: "Open setup",
      path: "/home?assistant=setup",
    },
    secondaryAction: {
      label: "Open truth",
      path: "/truth",
    },
    review: {
      message: "Draft work stays separate from approved truth until review.",
      readyForReview: false,
      finalizeAvailable: false,
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
        key: "company",
      },
      confirmationBlockers: [
        { label: "Business name" },
        { label: "Short description" },
      ],
      sections: [],
      completion: {
        ready: false,
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
        ],
        sourceSummary: {
          primarySourceType: "website",
          primarySourceUrl: "https://lunasmile.az",
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
          ],
        },
      },
      fieldProvenance: {
        companyName: {
          sourceType: "website",
          label: "Website",
          observedValue: "Luna Smile Studio",
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
    vi.mocked(importGoogleMapsForSetup).mockResolvedValue({ ok: true });
    vi.mocked(analyzeSetupIntake).mockResolvedValue({ ok: true });
    vi.mocked(updateCurrentSetupAssistantDraft).mockResolvedValue({
      session: { id: "session-1" },
      setup: {
        draft: {
          sourceMetadata: {
            primarySourceType: "instagram",
            primarySourceUrl: "https://instagram.com/lunasmile",
          },
        },
      },
    });
  });

  it("opens the assistant and loads the business truth review when review data exists", async () => {
    vi.mocked(getCurrentSetupReview).mockResolvedValue(createWebsiteReviewPayload());

    renderWidget();

    fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));

    expect(
      screen.getByRole("dialog", { name: "AI assistant" })
    ).toBeInTheDocument();

    expect(
      await screen.findByRole("region", { name: "Business truth review" })
    ).toBeInTheDocument();
    expect(screen.getByText("Approve business truth")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve truth" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close AI assistant" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "AI assistant" })
      ).not.toBeInTheDocument();
    });
  });

  it("keeps the review surface hidden when no review material is available", async () => {
    renderWidget(createAssistant({ websitePrefill: { supported: true, status: "awaiting_input", websiteUrl: "" } }));

    fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));

    await waitFor(() => {
      expect(getCurrentSetupReview).toHaveBeenCalled();
    });

    expect(
      screen.queryByRole("region", { name: "Business truth review" })
    ).not.toBeInTheDocument();
  });

  it("pulls the website from the source rail and refreshes the review payload", async () => {
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
      await screen.findByDisplayValue("https://lunasmile.az")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pull website" }));

    await waitFor(() =>
      expect(importWebsiteForSetup).toHaveBeenCalledWith({
        websiteUrl: "https://lunasmile.az",
        allowSessionReuse: true,
        waitForCompletion: true,
      })
    );

    expect(
      await screen.findByRole("region", { name: "Business truth review" })
    ).toBeInTheDocument();
  });

  it("supports google maps as a first source inside the widget", async () => {
    renderWidget();

    fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));
    fireEvent.click(screen.getByRole("button", { name: "Google Maps" }));
    fireEvent.change(screen.getByPlaceholderText("https://maps.google.com/..."), {
      target: { value: "https://maps.google.com/?cid=123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Pull map" }));

    await waitFor(() =>
      expect(importGoogleMapsForSetup).toHaveBeenCalledWith({
        url: "https://maps.google.com/?cid=123",
        allowSessionReuse: true,
        waitForCompletion: true,
      })
    );
  });

  it("captures instagram intake through the existing analyze flow", async () => {
    renderWidget();

    fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));
    fireEvent.click(screen.getByRole("button", { name: "Instagram" }));
    fireEvent.change(
      screen.getByPlaceholderText("https://instagram.com/brand"),
      {
        target: { value: "https://instagram.com/lunasmile" },
      }
    );
    fireEvent.click(screen.getByRole("button", { name: "Use source" }));

    await waitFor(() =>
      expect(updateCurrentSetupAssistantDraft).toHaveBeenCalledWith({
        sourceMetadata: {
          primarySourceType: "instagram",
          primarySourceUrl: "https://instagram.com/lunasmile",
          sourceLabels: ["Instagram"],
          evidenceSummary: ["Instagram supplied by operator"],
        },
      })
    );

    await waitFor(() =>
      expect(analyzeSetupIntake).toHaveBeenCalledWith({
        manualText: "Instagram: https://instagram.com/lunasmile",
        answers: {
          instagramUrl: "https://instagram.com/lunasmile",
        },
        note: "instagram source",
      })
    );
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

  it("drops stale setup content while the widget switches tenants", async () => {
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
    vi.mocked(getCurrentSetupReview).mockResolvedValueOnce({
      review: {
        reviewDebug: {},
      },
    });

    const view = renderControlledWidget(createAssistant(), {
      queryClient,
      open: true,
    });

    expect(await screen.findByDisplayValue("https://lunasmile.az")).toBeInTheDocument();

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
        title: "Loading setup studio",
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
      screen.queryByDisplayValue("https://lunasmile.az")
    ).not.toBeInTheDocument();
  });
});
