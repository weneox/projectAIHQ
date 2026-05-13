import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listContacts = vi.fn();
const listLeads = vi.fn();
const createLead = vi.fn();
const updateLeadStage = vi.fn();
const updateLeadStatus = vi.fn();
const updateLeadOwner = vi.fn();
const updateLeadFollowup = vi.fn();
const appendLeadNote = vi.fn();
const getReportsOverview = vi.fn();
const listKnowledgeSources = vi.fn();
const syncKnowledgeSource = vi.fn();
const getWorkspaceSettings = vi.fn();
const getOperationalSettings = vi.fn();
const saveWorkspaceAiPolicy = vi.fn();
const getTeam = vi.fn();
const createTeamUser = vi.fn();
const updateTeamUser = vi.fn();
const updateTeamUserStatus = vi.fn();

vi.mock("../../api/leads.js", () => ({
  listContacts: (...args) => listContacts(...args),
  listLeads: (...args) => listLeads(...args),
  createLead: (...args) => createLead(...args),
  updateLeadStage: (...args) => updateLeadStage(...args),
  updateLeadStatus: (...args) => updateLeadStatus(...args),
  updateLeadOwner: (...args) => updateLeadOwner(...args),
  updateLeadFollowup: (...args) => updateLeadFollowup(...args),
  appendLeadNote: (...args) => appendLeadNote(...args),
}));

vi.mock("../../api/reports.js", () => ({
  getReportsOverview: (...args) => getReportsOverview(...args),
}));

vi.mock("../../api/knowledge.js", () => ({
  listKnowledgeSources: (...args) => listKnowledgeSources(...args),
  syncKnowledgeSource: (...args) => syncKnowledgeSource(...args),
}));

vi.mock("../../api/settings.js", () => ({
  getWorkspaceSettings: (...args) => getWorkspaceSettings(...args),
  getOperationalSettings: (...args) => getOperationalSettings(...args),
  saveWorkspaceAiPolicy: (...args) => saveWorkspaceAiPolicy(...args),
}));

vi.mock("../../api/team.js", () => ({
  getTeam: (...args) => getTeam(...args),
  createTeamUser: (...args) => createTeamUser(...args),
  updateTeamUser: (...args) => updateTeamUser(...args),
  updateTeamUserStatus: (...args) => updateTeamUserStatus(...args),
}));

import Customers from "../../pages/Customers.jsx";
import Leads from "../../pages/Leads.jsx";
import Reports from "../../pages/Reports.jsx";
import Knowledge from "../../pages/Knowledge.jsx";
import Settings from "../../pages/Settings.jsx";
import Team from "../../pages/Team.jsx";

function renderRoute(element, path) {
  return render(<MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();

  listContacts.mockResolvedValue({
    ok: true,
    customers: [
      {
        id: "customer-1",
        full_name: "Ada Customer",
        email: "ada@example.test",
        source: "website",
        stage: "qualified",
        status: "open",
        value_azn: 1200,
        created_at: "2026-05-01T08:00:00.000Z",
        updated_at: "2026-05-12T08:00:00.000Z",
      },
    ],
  });

  listLeads.mockResolvedValue({
    ok: true,
    leads: [
      {
        id: "lead-1",
        full_name: "Niko Lead",
        email: "niko@example.test",
        source: "instagram",
        stage: "qualified",
        status: "open",
        priority: "high",
        value_azn: 900,
        created_at: "2026-05-01T08:00:00.000Z",
        updated_at: "2026-05-12T08:00:00.000Z",
      },
    ],
  });

  updateLeadStage.mockResolvedValue({ ok: true });
  updateLeadStatus.mockResolvedValue({ ok: true });
  updateLeadOwner.mockResolvedValue({ ok: true });
  updateLeadFollowup.mockResolvedValue({ ok: true });
  appendLeadNote.mockResolvedValue({ ok: true });

  getReportsOverview.mockResolvedValue({
    ok: true,
    range: "7d",
    summary: {
      apiCalls: 12,
      aiUnits: 5,
      messagesIn: 8,
      messagesOut: 6,
      aiReplies: 4,
      webhookEvents: 2,
      leads: 3,
      openThreads: 2,
      unreadMessages: 1,
      handoffs: 0,
    },
    timeseries: [
      {
        date: "2026-05-13",
        apiCalls: 12,
        aiUnits: 5,
        messagesIn: 8,
        messagesOut: 6,
        aiReplies: 4,
        webhookEvents: 2,
        leads: 3,
      },
    ],
    channels: [
      {
        channel: "website",
        messagesIn: 8,
        messagesOut: 6,
        aiReplies: 4,
      },
    ],
    leadStages: [{ stage: "qualified", count: 3 }],
    degraded: [],
  });

  listKnowledgeSources.mockResolvedValue({
    ok: true,
    items: [
      {
        id: "source-1",
        display_name: "Website source",
        source_type: "website",
        source_url: "https://acme.example",
        status: "active",
        sync_status: "completed",
        is_enabled: true,
        chunk_count: 4,
        updated_at: "2026-05-12T08:00:00.000Z",
      },
    ],
  });
  syncKnowledgeSource.mockResolvedValue({ ok: true, message: "Sync accepted." });

  getWorkspaceSettings.mockResolvedValue({
    ok: true,
    tenant: {
      company_name: "ACME Studio",
      legal_name: "ACME LLC",
      tenant_key: "acme",
      plan_key: "starter",
      timezone: "Asia/Baku",
    },
    profile: {
      brand_name: "ACME",
      website_url: "https://acme.example",
      public_email: "hello@acme.example",
      tone_of_voice: "helpful",
    },
    governance: {
      directWorkspaceWritesBlocked: true,
      governedSections: ["business_profile"],
      directlyEditableSections: ["ai_policy"],
    },
    aiPolicy: {
      auto_reply_enabled: true,
      suppress_ai_during_handoff: true,
      mark_seen_enabled: true,
      typing_indicator_enabled: true,
      create_lead_enabled: true,
    },
    channels: [
      {
        id: "channel-1",
        channel_type: "website",
        status: "connected",
        display_name: "Website chat",
        is_primary: true,
      },
    ],
  });

  getOperationalSettings.mockResolvedValue({
    ok: true,
    viewerRole: "owner",
    capabilities: { canManageOperationalSettings: true },
    readiness: {
      status: "ready",
      message: "Operational readiness is healthy.",
      blockers: [],
    },
    voice: { operational: { status: "ready", ready: true, provider: "twilio" } },
    channels: {
      meta: {
        operational: { ready: true },
        providerSecrets: {
          provider: "meta",
          requiredSecretKeys: [],
          missingSecretKeys: [],
        },
      },
    },
    dataGovernance: {
      retention: {
        version: "v1",
        items: [{ key: "messages", label: "Messages", status: "ready" }],
      },
    },
  });

  saveWorkspaceAiPolicy.mockResolvedValue({ ok: true, aiPolicy: {} });

  getTeam.mockResolvedValue({
    ok: true,
    viewerRole: "owner",
    users: [
      {
        id: "user-1",
        user_email: "owner@acme.example",
        full_name: "Owner User",
        role: "owner",
        status: "active",
        updated_at: "2026-05-12T08:00:00.000Z",
      },
    ],
  });
  createTeamUser.mockResolvedValue({ ok: true });
  updateTeamUser.mockResolvedValue({ ok: true });
  updateTeamUserStatus.mockResolvedValue({ ok: true });
});

afterEach(() => {
  cleanup();
});

describe("product sidebar routes", () => {
  it("renders Customers from the customers API surface", async () => {
    renderRoute(<Customers />, "/customers");

    expect(
      await screen.findByRole("heading", { name: /^contacts$/i })
    ).toBeInTheDocument();
    expect(await screen.findByText("Ada Customer")).toBeInTheDocument();
    expect(listContacts).toHaveBeenCalledWith({ limit: 200 });
  });

  it("renders Leads from the leads API surface", async () => {
    renderRoute(<Leads />, "/leads");

    expect(
      await screen.findByRole("heading", { name: /^lead pipeline$/i })
    ).toBeInTheDocument();
    expect(await screen.findByText("Niko Lead")).toBeInTheDocument();
    expect(listLeads).toHaveBeenCalledWith({ limit: 200 });
  });

  it("renders Reports from the reports API surface", async () => {
    renderRoute(<Reports />, "/reports");

    expect(
      await screen.findByRole("heading", { name: /^reports$/i })
    ).toBeInTheDocument();
    expect(await screen.findByText(/performance overview/i)).toBeInTheDocument();
    expect(await screen.findByText(/^website$/i)).toBeInTheDocument();
    expect(getReportsOverview).toHaveBeenCalledWith({ range: "7d" });
  });

  it("renders Knowledge from the source governance API surface", async () => {
    renderRoute(<Knowledge />, "/knowledge");

    expect(
      await screen.findByRole("heading", { name: /^knowledge library$/i })
    ).toBeInTheDocument();
    expect(await screen.findByText("Website source")).toBeInTheDocument();
    expect(listKnowledgeSources).toHaveBeenCalledWith({ limit: 100 });
  });

  it("renders Settings from workspace and operational settings APIs", async () => {
    renderRoute(<Settings />, "/settings");

    expect(
      await screen.findByRole("heading", { name: /^settings$/i })
    ).toBeInTheDocument();
    expect(await screen.findByText("Company profile")).toBeInTheDocument();
    expect(await screen.findByText("ACME Studio")).toBeInTheDocument();
    expect(getWorkspaceSettings).toHaveBeenCalled();
    expect(getOperationalSettings).toHaveBeenCalled();
  });

  it("renders Team from the team API surface", async () => {
    renderRoute(<Team />, "/team");

    expect(
      await screen.findByRole("heading", { name: /^team members$/i })
    ).toBeInTheDocument();
    expect(await screen.findByText("Owner User")).toBeInTheDocument();
    await waitFor(() => expect(getTeam).toHaveBeenCalled());
  });
});
