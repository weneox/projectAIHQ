import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/pushClient.js", () => ({
  askPermission: vi.fn(),
  getNotificationPermission: vi.fn().mockResolvedValue("default"),
  subscribePush: vi.fn(),
}));

vi.mock("./hooks/useSettingsWorkspace.js", () => ({
  useSettingsWorkspace: () => ({
    loading: false,
    setLoading: vi.fn(),
    saving: false,
    workspace: {
      tenantKey: "tenant-a",
      tenant: {},
      profile: {},
      aiPolicy: {},
    },
    setWorkspace: vi.fn(),
    agents: [],
    agentsLoading: false,
    setAgentsLoading: vi.fn(),
    dirty: false,
    dirtyMap: {},
    canManageSettings: true,
    tenantKey: "tenant-a",
    patchTenant: vi.fn(),
    patchProfile: vi.fn(),
    patchAi: vi.fn(),
    loadWorkspaceBase: vi.fn().mockResolvedValue({ tenantKey: "tenant-a" }),
    onSaveWorkspace: vi.fn(),
    onResetWorkspace: vi.fn().mockReturnValue({}),
    saveAgent: vi.fn(),
    setInitialWorkspace: vi.fn(),
  }),
}));

vi.mock("./hooks/useBusinessBrain.js", () => ({
  useBusinessBrain: () => ({
    businessFacts: [],
    setBusinessFacts: vi.fn(),
    channelPolicies: [],
    setChannelPolicies: vi.fn(),
    locations: [],
    setLocations: vi.fn(),
    contacts: [],
    setContacts: vi.fn(),
    refreshBusinessBrain: vi.fn().mockResolvedValue({}),
    handleSaveBusinessFact: vi.fn(),
    handleDeleteBusinessFact: vi.fn(),
    handleSaveChannelPolicy: vi.fn(),
    handleDeleteChannelPolicy: vi.fn(),
    handleSaveLocation: vi.fn(),
    handleDeleteLocation: vi.fn(),
    handleSaveContact: vi.fn(),
    handleDeleteContact: vi.fn(),
  }),
}));

vi.mock("./hooks/useSourceIntelligence.js", () => ({
  useSourceIntelligence: () => ({
    sources: [
      {
        id: "source-1",
        source_type: "website",
        display_name: "Main Website",
        source_url: "https://north.example",
        status: "connected",
        sync_status: "completed",
        is_enabled: true,
        review: {
          required: true,
          sessionId: "review-123",
          projectionStatus: "pending_review",
          candidateDraftCount: 2,
          candidateCreatedCount: 1,
          canonicalProjection: "protected",
        },
      },
    ],
    setSources: vi.fn(),
    knowledgeReview: [
      {
        id: "candidate-1",
        category: "general",
        item_key: "company_name",
        confidence_label: "high",
        confidence: 0.92,
        source_type: "website",
        status: "pending",
        title: "North Clinic",
        source_display_name: "Main Website",
        first_seen_at: "2026-03-25T09:00:00.000Z",
        value_text: "North Clinic",
        source_evidence_json: [],
      },
    ],
    setKnowledgeReview: vi.fn(),
    syncRunsOpen: false,
    setSyncRunsOpen: vi.fn(),
    syncRunsSource: null,
    syncRunsItems: [],
    trustSummary: {
      sources: {
        total: 1,
        connected: 1,
        enabled: 1,
        running: 0,
        failed: 0,
        reviewRequired: 1,
        lastRunAt: "2026-03-25T10:00:00.000Z",
      },
      runtimeProjection: {
        status: "ready",
        stale: false,
        updatedAt: "2026-03-25T10:05:00.000Z",
      },
      truth: {
        latestVersionId: "truth-v1",
        approvedAt: "2026-03-25T10:06:00.000Z",
      },
      reviewQueue: {
        pending: 1,
        conflicts: 0,
      },
    },
    trustRecentRuns: [
      {
        id: "run-1",
        sourceDisplayName: "Main Website",
        status: "completed",
        startedAt: "2026-03-25T10:00:00.000Z",
        finishedAt: "2026-03-25T10:02:00.000Z",
        reviewRequired: true,
      },
    ],
    trustAudit: [
      {
        id: "audit-1",
        action: "settings.source.sync.requested",
        actor: "owner@example.com",
        createdAt: "2026-03-25T10:01:00.000Z",
      },
    ],
    trustStatus: "ready",
    refreshSourceIntelligence: vi.fn().mockResolvedValue({}),
    handleSaveSource: vi.fn(),
    handleStartSourceSync: vi.fn(),
    handleViewSourceSyncRuns: vi.fn(),
    handleApproveKnowledge: vi.fn(),
    handleRejectKnowledge: vi.fn(),
  }),
}));

import SettingsController from "./SettingsController.jsx";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn());
  Object.defineProperty(window, "location", {
    writable: true,
    value: {
      ...window.location,
      reload: vi.fn(),
    },
  });
});

describe("Settings truth-maintenance smoke", () => {
  it("renders source sync and knowledge review truth-maintenance messaging", async () => {
    render(<SettingsController />);

    fireEvent.click(await screen.findByRole("button", { name: /sources/i }));
    expect(
      await screen.findByText(/refresh source evidence here, then route anything important into review/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/sync refreshes source evidence only/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/2 review items waiting/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/new source evidence created candidate changes/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/recent sync health/i)).toBeInTheDocument();
    expect(screen.getByText(/runtime projection/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /knowledge review/i }));
    expect(
      await screen.findByText(/candidates from source sync and source evidence land here/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/this is source evidence under review, not approved truth yet/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/recent trust activity/i)).toBeInTheDocument();
  });
});
