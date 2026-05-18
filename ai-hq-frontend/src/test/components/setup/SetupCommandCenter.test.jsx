/* @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SetupCommandCenter from "../../../components/setup/SetupCommandCenter.jsx";

const api = vi.hoisted(() => ({
  discardCurrentSetupReview: vi.fn(),
  finalizeSetupAssistantSession: vi.fn(),
  getCurrentSetupAssistantSession: vi.fn(),
  getCurrentSetupReview: vi.fn(),
  importGoogleMapsForSetup: vi.fn(),
  importSourceForSetup: vi.fn(),
  importWebsiteForSetup: vi.fn(),
  sendSetupAssistantMessage: vi.fn(),
  startSetupAssistantSession: vi.fn(),
}));

vi.mock("../../../api/setup.js", () => api);

vi.mock("../../../hooks/useWorkspaceTenantKey.js", () => ({
  buildWorkspaceScopedQueryKey: (key, tenantKey) => [...key, tenantKey],
  useWorkspaceTenantKey: () => ({
    ready: true,
    tenantKey: "tenant-test",
  }),
}));

vi.mock("../../../lib/launchSliceRefresh.js", () => ({
  emitLaunchSliceRefresh: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

function renderCenter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SetupCommandCenter />
    </QueryClientProvider>
  );
}

function emptyReviewRoom() {
  return {
    brain: {
      version: 0,
      sourceIntelligence: { quality: "missing", evidenceCount: 0 },
      sectionCompletion: { percent: 0 },
      missingFactsPlan: { required: true, missingSections: [] },
      conflictPlan: { hasConflicts: false },
      decisionPlan: { operatorDecision: "add_business_input" },
      runtimeSimulation: { canActivateAfterApproval: false },
    },
    sections: [],
    runtimeConsumers: { consumers: [] },
    actions: {
      primary: {
        id: "add_business_input",
        label: "Mənbə əlavə et",
        enabled: true,
      },
    },
    issues: [],
  };
}

describe("SetupCommandCenter", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    api.getCurrentSetupAssistantSession.mockResolvedValue({
      session: { id: "session-1" },
      assistant: {},
      setup: {
        draft: {},
      },
    });

    api.getCurrentSetupReview.mockResolvedValue({
      ok: true,
      setup: {
        reviewRoom: emptyReviewRoom(),
      },
    });

    api.startSetupAssistantSession.mockResolvedValue({
      session: { id: "session-1" },
      assistant: {},
      setup: { draft: {} },
    });

    const importResponse = {
      ok: true,
      setup: {
        reviewRoom: {
          brain: {
            version: 5,
            sourceIntelligence: { quality: "strong", evidenceCount: 2 },
            sectionCompletion: { percent: 60 },
            missingFactsPlan: { required: true, missingSections: ["hours"] },
            conflictPlan: { hasConflicts: false },
            decisionPlan: { operatorDecision: "answer_missing_facts" },
            runtimeSimulation: { canActivateAfterApproval: false },
          },
          sectionDetails: [
            {
              key: "profile",
              title: "Profil",
              status: "complete",
              sourceBacked: true,
              facts: [
                {
                  key: "companyName",
                  label: "Biznes adı",
                  value: "Medhouse Klinika",
                },
              ],
              items: [],
            },
          ],
          sections: [],
          runtimeConsumers: { consumers: [] },
          actions: {
            primary: {
              id: "answer_missing_required_facts",
              label: "Tamamla",
              enabled: true,
            },
          },
          issues: [],
        },
      },
    };

    api.importWebsiteForSetup.mockResolvedValue(importResponse);
    api.importGoogleMapsForSetup.mockResolvedValue(importResponse);
    api.importSourceForSetup.mockResolvedValue(importResponse);

    api.sendSetupAssistantMessage.mockResolvedValue({
      session: { id: "session-1" },
      assistant: {},
      setup: { draft: {} },
    });
  });

  it("shows only the progressive source input before analysis", async () => {
    renderCenter();

    await screen.findByText(/biznesini ai üçün tanıdaq/i);

    expect(screen.getByPlaceholderText("medhouse.az")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oxu" })).toBeDisabled();
    expect(screen.queryByText(/0%/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not ready/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tapılan faktlar/i)).not.toBeInTheDocument();
  });

  it("routes bare website domain through source import with normalized https URL", async () => {
    renderCenter();

    await screen.findByText(/biznesini ai üçün tanıdaq/i);

    fireEvent.change(screen.getByPlaceholderText("medhouse.az"), {
      target: { value: "medhouse.az" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Oxu" }));

    await waitFor(() => {
      expect(api.importWebsiteForSetup).toHaveBeenCalledWith(
        expect.objectContaining({
          primarySource: expect.objectContaining({
            type: "website",
            sourceType: "website",
            value: "https://medhouse.az",
            url: "https://medhouse.az",
            sourceUrl: "https://medhouse.az",
          }),
          sources: [
            expect.objectContaining({
              type: "website",
              sourceType: "website",
              value: "https://medhouse.az",
              url: "https://medhouse.az",
              sourceUrl: "https://medhouse.az",
            }),
          ],
          note: "medhouse.az",
          allowSessionReuse: true,
          waitForCompletion: true,
        })
      );
    });

    expect(api.importSourceForSetup).not.toHaveBeenCalled();
    expect(api.importGoogleMapsForSetup).not.toHaveBeenCalled();
    expect(api.sendSetupAssistantMessage).not.toHaveBeenCalled();
  });

  it("routes manual brief through setup assistant message", async () => {
    renderCenter();

    await screen.findByText(/biznesini ai üçün tanıdaq/i);

    fireEvent.click(screen.getByRole("button", { name: "Qısa izah" }));

    fireEvent.change(screen.getByPlaceholderText(/biznes nə edir/i), {
      target: { value: "Həftə içi 09:00-18:00 işləyirik." },
    });

    fireEvent.click(screen.getByRole("button", { name: /əlavə et/i }));

    await waitFor(() => {
      expect(api.sendSetupAssistantMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          step: expect.any(String),
          answer: "Həftə içi 09:00-18:00 işləyirik.",
        })
      );
    });

    expect(api.importWebsiteForSetup).not.toHaveBeenCalled();
    expect(api.importGoogleMapsForSetup).not.toHaveBeenCalled();
    expect(api.importSourceForSetup).not.toHaveBeenCalled();
  });

  it("routes Google Maps source through the Google Maps import endpoint", async () => {
    renderCenter();

    await screen.findByText(/biznesini ai üçün tanıdaq/i);

    fireEvent.click(screen.getByRole("button", { name: "Google Maps" }));

    fireEvent.change(screen.getByPlaceholderText(/google maps/i), {
      target: { value: "https://maps.google.com/maps?q=medhouse" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Oxu" }));

    await waitFor(() => {
      expect(api.importGoogleMapsForSetup).toHaveBeenCalledWith(
        expect.objectContaining({
          primarySource: expect.objectContaining({
            type: "google_maps",
            sourceType: "google_maps",
            value: "https://maps.google.com/maps?q=medhouse",
          }),
          allowSessionReuse: true,
          waitForCompletion: true,
        })
      );
    });

    expect(api.importWebsiteForSetup).not.toHaveBeenCalled();
    expect(api.importSourceForSetup).not.toHaveBeenCalled();
    expect(api.sendSetupAssistantMessage).not.toHaveBeenCalled();
  });
});
