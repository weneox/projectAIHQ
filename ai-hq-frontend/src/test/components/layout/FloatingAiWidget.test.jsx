import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FloatingAiWidget from "../../../components/layout/FloatingAiWidget.jsx";
import {
  analyzeSetupIntake,
  getCurrentSetupAssistantSession,
  getCurrentSetupReview,
  importGoogleMapsForSetup,
  importWebsiteForSetup,
  startSetupAssistantSession,
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
      id: "session-1",
      draftVersion: 1,
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
      version: 1,
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
    <QueryClientProvider client={client}>
      <FloatingAiWidget
        open
        onOpenChange={vi.fn()}
        assistant={assistant}
      />
    </QueryClientProvider>
  );
}

describe("FloatingAiWidget source intake", () => {
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
    vi.mocked(startSetupAssistantSession).mockResolvedValue({
      ok: true,
      session: { id: "session-1", draftVersion: 1 },
      setup: { draft: {} },
    });
    vi.mocked(importWebsiteForSetup).mockResolvedValue({ ok: true });
    vi.mocked(importGoogleMapsForSetup).mockResolvedValue({ ok: true });
    vi.mocked(updateCurrentSetupAssistantDraft).mockResolvedValue({
      ok: true,
      session: { id: "session-1", draftVersion: 2 },
      setup: {
        draft: {
          sourceMetadata: {},
        },
      },
    });
    vi.mocked(analyzeSetupIntake).mockResolvedValue({ ok: true });
  });

  it("routes website intake through the website import path", async () => {
    renderWidget();

    fireEvent.change(screen.getByPlaceholderText("Website və ya source link yaz"), {
      target: { value: "lunasmile.az" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(importWebsiteForSetup).toHaveBeenCalledWith({
        url: "https://lunasmile.az",
        allowSessionReuse: true,
        waitForCompletion: true,
      })
    );

    expect(importGoogleMapsForSetup).not.toHaveBeenCalled();
    expect(updateCurrentSetupAssistantDraft).not.toHaveBeenCalled();
    expect(analyzeSetupIntake).not.toHaveBeenCalled();
  });

  it("routes google maps intake through the maps import path", async () => {
    renderWidget();

    fireEvent.change(screen.getByPlaceholderText("Website və ya source link yaz"), {
      target: { value: "https://maps.google.com/?cid=123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(importGoogleMapsForSetup).toHaveBeenCalledWith({
        url: "https://maps.google.com/?cid=123",
        allowSessionReuse: true,
        waitForCompletion: true,
      })
    );

    expect(importWebsiteForSetup).not.toHaveBeenCalled();
    expect(updateCurrentSetupAssistantDraft).not.toHaveBeenCalled();
    expect(analyzeSetupIntake).not.toHaveBeenCalled();
  });

  it("keeps instagram handles out of the website import path", async () => {
    renderWidget();

    fireEvent.change(screen.getByPlaceholderText("Website və ya source link yaz"), {
      target: { value: "@lunasmile" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

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

    expect(importWebsiteForSetup).not.toHaveBeenCalled();
    expect(importGoogleMapsForSetup).not.toHaveBeenCalled();
  });

  it("keeps facebook links out of the website import path", async () => {
    renderWidget();

    fireEvent.change(screen.getByPlaceholderText("Website və ya source link yaz"), {
      target: { value: "https://facebook.com/lunasmileclinic" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(updateCurrentSetupAssistantDraft).toHaveBeenCalledWith({
        sourceMetadata: {
          primarySourceType: "facebook",
          primarySourceUrl: "https://facebook.com/lunasmileclinic",
          sourceLabels: ["Facebook"],
          evidenceSummary: ["Facebook supplied by operator"],
        },
      })
    );

    await waitFor(() =>
      expect(analyzeSetupIntake).toHaveBeenCalledWith({
        manualText: "Facebook: https://facebook.com/lunasmileclinic",
        answers: {
          facebookUrl: "https://facebook.com/lunasmileclinic",
        },
        note: "facebook source",
      })
    );

    expect(importWebsiteForSetup).not.toHaveBeenCalled();
    expect(importGoogleMapsForSetup).not.toHaveBeenCalled();
  });

  it("keeps manual notes in the fallback analyze path", async () => {
    renderWidget();

    fireEvent.change(screen.getByPlaceholderText("Website və ya source link yaz"), {
      target: {
        value: "Premium dental clinic in Baku with WhatsApp bookings and cosmetic care.",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(updateCurrentSetupAssistantDraft).toHaveBeenCalledWith({
        sourceMetadata: {
          primarySourceType: "manual",
          primarySourceUrl: "",
          sourceLabels: ["Manual note"],
          evidenceSummary: ["Manual note captured"],
        },
      })
    );

    await waitFor(() =>
      expect(analyzeSetupIntake).toHaveBeenCalledWith({
        manualText:
          "Premium dental clinic in Baku with WhatsApp bookings and cosmetic care.",
        note: "manual business note",
      })
    );

    expect(importWebsiteForSetup).not.toHaveBeenCalled();
    expect(importGoogleMapsForSetup).not.toHaveBeenCalled();
  });
});
