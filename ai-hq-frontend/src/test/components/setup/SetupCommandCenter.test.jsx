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

function importResponseFor({ name, url, description = "" }) {
  return {
    ok: true,
    startedFreshSession: true,
    reusedActiveSession: false,
    previousSessionDiscarded: true,
    activeSourceKey: `website|${url}`,
    sourceUrl: url,
    setup: {
      draft: {
        sourceMetadata: {
          primarySourceType: "website",
          primarySourceUrl: url,
        },
      },
      assistant: {
        sourceSignals: {
          primarySourceType: "website",
          primarySourceUrl: url,
        },
      },
      reviewRoom: {
        evidence: {
          primarySource: {
            type: "website",
            url,
            label: url,
          },
        },
        polishedTruthDraft: {
          title: name,
          subtitle: "Polished draft",
          source: {
            type: "website",
            url,
            label: url,
          },
          businessIdentity: {
            name,
            description,
            website: url,
            publicSummary: description,
          },
          whatThisBusinessDoes: description,
          services: [{ title: "Consultation", sourceBacked: true }],
          contacts: [{ type: "phone", label: "Phone", value: "+994501112233" }],
          hours: ["monday 09:00-18:00"],
          pricingPosture: "Pricing depends on the service.",
          safeAiBehavior: {
            canSay: [name, description],
            shouldNotSay: ["Do not invent pricing."],
            handoffRules: ["Route uncertain questions to a human."],
          },
          missingQuestions: [],
          approval: {
            canApprove: false,
            missingSections: ["pricing"],
            publishCount: 4,
          },
          evidence: [
            {
              label: "Website",
              text: `${name} website evidence`,
              sourceUrl: url,
            },
          ],
        },
        brain: {
          version: 5,
          sourceIntelligence: { quality: "strong", evidenceCount: 2 },
          sectionCompletion: { percent: 60 },
          missingFactsPlan: { required: true, missingSections: ["pricing"] },
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
                  value: "Atlas Klinika",
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

    await screen.findByText(/biznesini ai/i);

    expect(screen.getByPlaceholderText(/google maps/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oxu" })).toBeDisabled();
    expect(screen.queryByText(/0%/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/not ready/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/yenidən başla/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/missing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/empty answer/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ai biznes truth draft/i)).not.toBeInTheDocument();
  });

  it("routes bare website domain through source import with normalized https URL", async () => {
    renderCenter();

    await screen.findByText(/biznesini ai/i);

    fireEvent.change(screen.getByPlaceholderText(/google maps/i), {
      target: { value: "weneox.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Oxu" }));

    await waitFor(() => {
      expect(api.importWebsiteForSetup).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "website",
          sourceType: "website",
          value: "https://weneox.com",
          url: "https://weneox.com",
          sourceUrl: "https://weneox.com",
          websiteUrl: "https://weneox.com",
          primarySource: expect.objectContaining({
            type: "website",
            sourceType: "website",
            value: "https://weneox.com",
            url: "https://weneox.com",
            sourceUrl: "https://weneox.com",
          }),
          sources: [
            expect.objectContaining({
              type: "website",
              sourceType: "website",
              value: "https://weneox.com",
              url: "https://weneox.com",
              sourceUrl: "https://weneox.com",
            }),
          ],
          note: "weneox.com",
          allowSessionReuse: false,
          replacePrimarySource: true,
          freshSourceImport: true,
          metadataJson: expect.objectContaining({
            setupImportMode: "replace_primary_source",
            nextSourceKey: "website|https://weneox.com",
          }),
          waitForCompletion: true,
        })
      );
    });

    expect(api.importSourceForSetup).not.toHaveBeenCalled();
    expect(api.importGoogleMapsForSetup).not.toHaveBeenCalled();
    expect(api.sendSetupAssistantMessage).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(api.getCurrentSetupReview.mock.calls.length).toBeGreaterThan(1);
      expect(
        api.getCurrentSetupAssistantSession.mock.calls.length
      ).toBeGreaterThan(1);
    });
  });

  it("replaces the visible primary source when a second website is imported", async () => {
    const emptyReview = {
      ok: true,
      setup: {
        reviewRoom: emptyReviewRoom(),
      },
    };
    let activeReview = emptyReview;
    const alpha = importResponseFor({
      name: "Alpha Studio",
      url: "https://alpha.example",
      description: "Alpha source draft.",
    });
    const beta = importResponseFor({
      name: "Beta Clinic",
      url: "https://beta.example",
      description: "Beta source draft.",
    });

    api.getCurrentSetupReview.mockImplementation(async () => activeReview);
    api.importWebsiteForSetup.mockImplementation(async (payload) => {
      activeReview = payload.url.includes("beta") ? beta : alpha;
      return activeReview;
    });

    renderCenter();

    await screen.findByText(/biznesini ai/i);

    fireEvent.change(screen.getByPlaceholderText(/google maps/i), {
      target: { value: "alpha.example" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Oxu" }));

    expect((await screen.findAllByText(/alpha studio/i)).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText(/google maps/i), {
      target: { value: "beta.example" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Oxu" }));

    expect((await screen.findAllByText(/beta clinic/i)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/alpha studio/i)).not.toBeInTheDocument();

    expect(api.importWebsiteForSetup).toHaveBeenLastCalledWith(
      expect.objectContaining({
        allowSessionReuse: false,
        metadataJson: expect.objectContaining({
          setupImportMode: "replace_primary_source",
          previousSourceKey: "website|https://alpha.example",
          nextSourceKey: "website|https://beta.example",
        }),
      })
    );
  });

  it("renders polished truth draft returned by source import", async () => {
    const polished = importResponseFor({
      name: "Polished Clinic",
      url: "https://polished.example",
      description: "Premium clinic draft.",
    });
    api.getCurrentSetupReview.mockResolvedValue(polished);
    api.importWebsiteForSetup.mockResolvedValueOnce(polished);

    renderCenter();

    await screen.findByText(/biznesini ai/i);

    fireEvent.change(screen.getByPlaceholderText(/google maps/i), {
      target: { value: "polished.example" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Oxu" }));

    expect(
      await screen.findByText(/ai biznes truth draftı hazırlandı/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/polished clinic/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/premium clinic draft/i).length).toBeGreaterThan(0);
  });

  it("routes manual brief through setup assistant message", async () => {
    api.sendSetupAssistantMessage.mockResolvedValueOnce({
      session: { id: "session-1" },
      assistant: {
        message: "Bakıda klinika olduğunuzu anladım.",
        assistantMessage: "Bakıda klinika olduğunuzu anladım.",
        nextQuestion: {
          key: "services",
          prompt: "Əsas xidmətləri yazın.",
        },
      },
      setup: { draft: {} },
    });

    renderCenter();

    await screen.findByText(/biznesini ai/i);

    fireEvent.change(screen.getByPlaceholderText(/google maps/i), {
      target: { value: "Həftə içi 09:00-18:00 işləyirik." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Oxu" }));

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
    expect((await screen.findAllByText(/bakıda klinika/i)).length).toBeGreaterThan(0);
    expect(screen.getByText(/əsas xidmətləri yazın/i)).toBeInTheDocument();
  });

  it("routes Google Maps source through the Google Maps import endpoint", async () => {
    renderCenter();

    await screen.findByText(/biznesini ai/i);

    fireEvent.change(screen.getByPlaceholderText(/google maps/i), {
      target: { value: "https://maps.google.com/maps?q=OpenAI+San+Francisco" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Oxu" }));

    await waitFor(() => {
      expect(api.importGoogleMapsForSetup).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "google_maps",
          sourceType: "google_maps",
          value: "https://maps.google.com/maps?q=OpenAI+San+Francisco",
          url: "https://maps.google.com/maps?q=OpenAI+San+Francisco",
          sourceUrl: "https://maps.google.com/maps?q=OpenAI+San+Francisco",
          primarySource: expect.objectContaining({
            type: "google_maps",
            sourceType: "google_maps",
            value: "https://maps.google.com/maps?q=OpenAI+San+Francisco",
          }),
          allowSessionReuse: false,
          replacePrimarySource: true,
          freshSourceImport: true,
          waitForCompletion: true,
        })
      );
    });

    expect(api.importWebsiteForSetup).not.toHaveBeenCalled();
    expect(api.importSourceForSetup).not.toHaveBeenCalled();
    expect(api.sendSetupAssistantMessage).not.toHaveBeenCalled();
  });

  it("shows a clean human message when website import fails", async () => {
    const error = new Error("website import failed (WebsiteImportFailed)");
    error.code = "WebsiteImportFailed";
    api.importWebsiteForSetup.mockRejectedValueOnce(error);

    renderCenter();

    await screen.findByText(/biznesini ai/i);

    fireEvent.change(screen.getByPlaceholderText(/google maps/i), {
      target: { value: "weneox.com" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Oxu" }));

    expect(
      await screen.findByText(/mənbəni oxuya bilmədim/i)
    ).toBeInTheDocument();
    expect(screen.queryByText(/WebsiteImportFailed/i)).not.toBeInTheDocument();
  });
});
