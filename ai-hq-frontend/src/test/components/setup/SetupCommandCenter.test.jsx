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
  importSourceForSetup: vi.fn(),
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
        reviewRoom: {
          brain: {
            version: 5,
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
              label: "Mənbə və ya məlumat əlavə et",
              enabled: true,
            },
          },
          issues: [],
        },
      },
    });

    api.startSetupAssistantSession.mockResolvedValue({
      session: { id: "session-1" },
      assistant: {},
      setup: { draft: {} },
    });

    api.importSourceForSetup.mockResolvedValue({
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
    });

    api.sendSetupAssistantMessage.mockResolvedValue({
      session: { id: "session-1" },
      assistant: {},
      setup: { draft: {} },
    });
  });

  it("routes website input through source import instead of chat message", async () => {
    renderCenter();

    await screen.findByText(/biznesini ai üçün tanıdaq/i);

    fireEvent.change(screen.getByPlaceholderText("https://medhouse.az"), {
      target: { value: "https://medhouse.az" },
    });

    fireEvent.click(screen.getByRole("button", { name: /oxumağa başla/i }));

    await waitFor(() => {
      expect(api.importSourceForSetup).toHaveBeenCalledWith(
        expect.objectContaining({
          primarySource: expect.objectContaining({
            type: "website",
            sourceType: "website",
            value: "https://medhouse.az",
            url: "https://medhouse.az",
            sourceUrl: "https://medhouse.az",
          }),
          allowSessionReuse: true,
          waitForCompletion: true,
        })
      );
    });

    expect(api.sendSetupAssistantMessage).not.toHaveBeenCalled();
  });

  it("routes manual brief through setup assistant message", async () => {
    renderCenter();

    await screen.findByText(/biznesini ai üçün tanıdaq/i);

    fireEvent.click(screen.getByRole("button", { name: "Manual brief" }));

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

    expect(api.importSourceForSetup).not.toHaveBeenCalled();
  });
});
