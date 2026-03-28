/* @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

globalThis.React = React;

vi.mock("../../api/settings.js", async () => {
  const actual = await vi.importActual("../../api/settings.js");
  return {
    ...actual,
    getMetaConnectUrl: vi.fn().mockResolvedValue("https://meta.example.test/connect"),
  };
});

vi.mock("../../lib/pushClient.js", () => ({
  askPermission: vi.fn(),
  getNotificationPermission: vi.fn().mockResolvedValue("default"),
  subscribePush: vi.fn(),
}));

vi.mock("./hooks/useSettingsWorkspace.js", () => ({
  useSettingsWorkspace: () => ({
    surface: {
      loading: false,
      error: "",
      unavailable: false,
      ready: true,
      saving: false,
      saveError: "",
      saveSuccess: "Workspace settings saved.",
      refresh: vi.fn().mockResolvedValue({ tenantKey: "tenant-a" }),
      clearSaveState: vi.fn(),
    },
    workspace: {
      tenantKey: "tenant-a",
      viewerRole: "operator",
      tenant: {},
      profile: {},
      aiPolicy: {},
    },
    setWorkspace: vi.fn(),
    agents: [],
    dirty: false,
    dirtyMap: {},
    canManageSettings: true,
    tenantKey: "tenant-a",
    patchTenant: vi.fn(),
    patchProfile: vi.fn(),
    patchAi: vi.fn(),
    refreshWorkspace: vi.fn().mockResolvedValue({ tenantKey: "tenant-a" }),
    onSaveWorkspace: vi.fn(),
    onResetWorkspace: vi.fn().mockReturnValue({}),
    saveAgent: vi.fn(),
    setInitialWorkspace: vi.fn(),
  }),
}));

vi.mock("./hooks/useBusinessBrain.js", () => ({
  useBusinessBrain: () => ({
    surface: {
      loading: false,
      error: "",
      unavailable: false,
      ready: true,
      saving: false,
      saveError: "",
      saveSuccess: "Business fact saved.",
      refresh: vi.fn().mockResolvedValue({}),
      clearSaveState: vi.fn(),
    },
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

vi.mock("./hooks/useOperationalSettings.js", () => ({
  useOperationalSettings: () => ({
    loading: false,
    surface: {
      loading: false,
      error: "",
      unavailable: false,
      ready: true,
      saving: false,
      saveError: "",
      saveSuccess: "",
      refresh: vi.fn().mockResolvedValue({}),
    },
    savingVoice: false,
    savingChannel: false,
    operationalData: {
      capabilities: {
        canManageOperationalSettings: false,
        canManageProviderSecrets: false,
        operationalSettingsWrite: {
          allowed: false,
          requiredRoles: ["owner", "admin"],
          message: "Only owner/admin can manage operational voice and channel settings.",
        },
        providerSecretsMutation: {
          allowed: false,
          requiredRoles: ["owner", "admin"],
          message: "Only owner/admin can manage provider secrets.",
        },
      },
      readiness: {
        status: "blocked",
        reasonCode: "voice_phone_number_missing",
        blockers: {
          items: [
            {
              blocked: true,
              category: "voice",
              dependencyType: "voice_phone_number",
              reasonCode: "voice_phone_number_missing",
              title: "Voice operational blocker",
              subtitle: "Production voice traffic stays fail-closed until persisted tenant voice settings are complete.",
              missing: ["twilio_phone_number"],
              suggestedRepairActionId: "repair_voice_phone_number",
              repairAction: {
                id: "repair_voice_phone_number",
                kind: "focus",
                label: "Add voice phone number",
                requiredRole: "admin",
                allowed: false,
                target: {
                  panel: "voice",
                  field: "twilioPhoneNumber",
                },
              },
            },
            {
              blocked: true,
              category: "meta",
              dependencyType: "provider_secret",
              reasonCode: "provider_secret_missing",
              title: "Meta provider secret blocker",
              subtitle: "Meta delivery stays fail-closed until provider secret coverage is complete.",
              missing: ["page_access_token"],
              suggestedRepairActionId: "open_provider_secrets",
              repairAction: {
                id: "open_provider_secrets",
                kind: "admin_route",
                label: "Open secure secrets",
                requiredRole: "admin",
                allowed: false,
                target: {
                  path: "/admin/secrets",
                  provider: "meta",
                },
              },
            },
          ],
        },
      },
      voice: {
        settings: {
          enabled: true,
          defaultLanguage: "en",
          supportedLanguages: ["en", "az"],
          twilioPhoneNumber: "+15550001111",
          operatorPhone: "+15550002222",
          twilioConfig: {
            callerId: "+15550003333",
          },
          meta: {
            realtimeModel: "gpt-4o-realtime-preview",
            realtimeVoice: "alloy",
          },
        },
        operational: {
          ready: false,
          reasonCode: "voice_phone_number_missing",
        },
        missingFields: ["twilio_phone_number"],
        repair: {
          blocked: true,
          category: "voice",
          dependencyType: "voice_phone_number",
          reasonCode: "voice_phone_number_missing",
          title: "Voice operational blocker",
          subtitle: "Production voice traffic stays fail-closed until persisted tenant voice settings are complete.",
          missing: ["twilio_phone_number"],
          suggestedRepairActionId: "repair_voice_phone_number",
            nextAction: {
              id: "repair_voice_phone_number",
              kind: "focus",
              label: "Add voice phone number",
              requiredRole: "admin",
              allowed: false,
              target: {
                panel: "voice",
                field: "twilioPhoneNumber",
            },
          },
        },
      },
      channels: {
        meta: {
          channel: {
            channel_type: "instagram",
            provider: "meta",
            status: "connected",
            external_page_id: "",
            external_user_id: "ig-1",
            secrets_ref: "meta",
          },
          operational: {
            ready: false,
            reasonCode: "channel_identifiers_missing",
          },
          missingFields: ["external_page_id_or_external_user_id"],
          repair: {
            blocked: true,
            category: "meta",
            dependencyType: "channel_identifier",
            reasonCode: "channel_identifiers_missing",
            title: "Meta operational blocker",
            subtitle: "Meta delivery stays fail-closed until the connected channel, identifiers, and required secret coverage are aligned.",
            missing: ["external_page_id_or_external_user_id"],
            suggestedRepairActionId: "repair_channel_identifiers",
            nextAction: {
              id: "repair_channel_identifiers",
              kind: "focus",
              label: "Add channel identifiers",
              requiredRole: "admin",
              allowed: false,
              target: {
                panel: "meta",
                field: "externalPageId",
              },
            },
          },
          providerSecrets: {
            ready: false,
            presentSecretKeys: [],
            missingSecretKeys: ["page_access_token"],
          },
        },
      },
    },
    operationalMessage: "Production traffic is blocked until operational records are complete.",
    refreshOperationalSettings: vi.fn().mockResolvedValue({}),
    saveVoiceSettings: vi.fn().mockResolvedValue({}),
    saveChannelSettings: vi.fn().mockResolvedValue({}),
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
    surface: {
      loading: false,
      error: "",
      unavailable: false,
      ready: true,
      saving: false,
      saveError: "",
      saveSuccess: "",
      refresh: vi.fn().mockResolvedValue({}),
    },
    refreshSourceIntelligence: vi.fn().mockResolvedValue({}),
    handleSaveSource: vi.fn(),
    handleStartSourceSync: vi.fn(),
    handleViewSourceSyncRuns: vi.fn(),
    handleApproveKnowledge: vi.fn(),
    handleRejectKnowledge: vi.fn(),
  }),
}));

vi.mock("./hooks/useTrustSurface.js", () => ({
  useTrustSurface: () => ({
    trust: {
      status: "ready",
      loading: false,
      error: "",
      unavailable: false,
      surface: {
        loading: false,
        error: "",
        unavailable: false,
        ready: true,
        refresh: vi.fn().mockResolvedValue({}),
        saving: false,
        saveError: "",
        saveSuccess: "",
      },
      view: {
        summary: {
          readiness: {
            status: "blocked",
            blockers: [
              {
                blocked: true,
                category: "runtime",
                dependencyType: "runtime_projection",
                reasonCode: "runtime_projection_missing",
                title: "Runtime projection blocker",
                subtitle: "No approved runtime projection is currently available for trust-controlled runtime surfaces.",
                missing: ["runtime_projection"],
                nextAction: {
                  id: "open_setup_route",
                  kind: "route",
                  label: "Open runtime setup",
                  requiredRole: "operator",
                  allowed: true,
                  target: {
                    path: "/setup/runtime",
                  },
                },
              },
            ],
          },
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
            readiness: {
              status: "blocked",
              blockers: [
                {
                  blocked: true,
                  category: "runtime",
                  dependencyType: "runtime_projection",
                  reasonCode: "runtime_projection_missing",
                  title: "Runtime projection blocker",
                  subtitle: "No approved runtime projection is currently available for trust-controlled runtime surfaces.",
                  missing: ["runtime_projection"],
                  nextAction: {
                    id: "open_setup_route",
                    kind: "route",
                    label: "Open runtime setup",
                    requiredRole: "operator",
                    allowed: true,
                    target: {
                      path: "/setup/runtime",
                    },
                  },
                },
              ],
            },
          },
          truth: {
            latestVersionId: "truth-v1",
            approvedAt: "2026-03-25T10:06:00.000Z",
            readiness: {
              status: "ready",
              blockers: [],
            },
          },
          setupReview: {
            active: false,
            readiness: {
              status: "ready",
              blockers: [],
            },
          },
          reviewQueue: {
            pending: 1,
            conflicts: 0,
          },
        },
        recentRuns: [
          {
            id: "run-1",
            sourceDisplayName: "Main Website",
            status: "completed",
            startedAt: "2026-03-25T10:00:00.000Z",
            finishedAt: "2026-03-25T10:02:00.000Z",
            reviewRequired: true,
          },
        ],
        audit: [
          {
            id: "audit-1",
            action: "settings.source.sync.requested",
            actor: "owner@example.com",
            createdAt: "2026-03-25T10:01:00.000Z",
          },
        ],
      },
    },
    surface: {
      loading: false,
      error: "",
      unavailable: false,
      ready: true,
      saving: false,
      saveError: "",
      saveSuccess: "",
      refresh: vi.fn().mockResolvedValue({}),
    },
    refreshTrust: vi.fn().mockResolvedValue({}),
  }),
}));

vi.mock("./hooks/useAuditHistory.js", () => ({
  useAuditHistory: () => ({
    auditHistory: {
      viewerRole: "operator",
      permissions: {
        auditHistoryRead: {
          allowed: false,
          message: "Only owner/admin/analyst can read control-plane audit history.",
        },
      },
      filters: {
        availableAreas: [],
        availableOutcomes: [],
      },
      summary: {
        total: 0,
        outcomes: {
          succeeded: 0,
          blocked: 0,
          failed: 0,
        },
        areaItems: [],
      },
      items: [],
    },
    surface: {
      loading: false,
      error: "",
      unavailable: false,
      ready: true,
      saving: false,
      saveError: "",
      saveSuccess: "",
      refresh: vi.fn().mockResolvedValue({}),
    },
    refreshAuditHistory: vi.fn().mockResolvedValue({}),
  }),
}));

import SettingsController from "./SettingsController.jsx";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn());
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("Settings truth-maintenance smoke", () => {
  it("renders workspace and business-brain sections through the shared async surface language", async () => {
    render(<SettingsController />);

    expect(await screen.findByText(/governed operations/i)).toBeTruthy();
    expect((await screen.findAllByText(/workspace settings saved/i)).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /change history/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /business facts/i }));
    expect(await screen.findByText(/business fact saved/i)).toBeTruthy();
  });

  it("renders source sync and knowledge review truth-maintenance messaging", async () => {
    render(<SettingsController />);

      fireEvent.click(await screen.findByRole("button", { name: /truth governance/i }));
      expect(
        await screen.findByText(/refresh evidence, review what is weak or conflicting/i)
      ).toBeTruthy();
      expect(screen.getByText(/operator governance cockpit/i)).toBeTruthy();
      expect(screen.getByText(/latest approved change footprint/i)).toBeTruthy();
      expect(screen.getByText(/trust repair hub/i)).toBeTruthy();
      expect(screen.getAllByText(/runtime projection blocker/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /open runtime setup/i }).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/source sync refreshes evidence only/i)
    ).toBeTruthy();
    expect(
      screen.getByText(/new source evidence created candidate changes/i)
    ).toBeTruthy();
    expect(screen.getAllByText(/main website/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/recent evidence refreshes/i)).toBeTruthy();
    expect(screen.getAllByText(/runtime projection/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: /review queue/i })[0]);
    expect(
      await screen.findByText(/candidates from source sync and source evidence land here/i)
    ).toBeTruthy();
    expect(
      screen.getByText(/this is source evidence under review, not approved truth yet/i)
    ).toBeTruthy();
    expect(screen.getByText(/recent trust activity/i)).toBeTruthy();
  });

  it("renders operational readiness fail states honestly", async () => {
    render(<SettingsController />);

    fireEvent.click((await screen.findAllByRole("button", { name: /runtime operations/i }))[0]);
    expect(screen.getByText(/operational repair hub/i)).toBeTruthy();
    expect(
      await screen.findByText(/production traffic stays fail-closed until the persisted operational contract and provider dependencies converge/i)
    ).toBeTruthy();
    expect(screen.getByText(/voice operational settings/i)).toBeTruthy();
    expect(screen.getAllByText(/missing: twilio_phone_number/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/open secure secrets/i)).toBeTruthy();
    expect(screen.getByText(/provider secret readiness/i)).toBeTruthy();
    expect(screen.getByText(/missing required: page_access_token/i)).toBeTruthy();
    expect(screen.getAllByText(/requires admin access/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/only owner\/admin can manage operational voice and channel settings/i)
    ).toBeTruthy();
    expect(
      screen.getByText(/only owner\/admin can manage provider secrets/i)
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /save voice settings/i }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: /save channel identifiers/i }).disabled).toBe(true);
    expect(
      screen.getByText(/production traffic is fail-closed while operational rows or required provider readiness are incomplete/i)
    ).toBeTruthy();
  });
});
