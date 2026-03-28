/* @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

globalThis.React = React;

function normalizeText(value = "") {
  return String(value).replace(/\s+/g, " ").trim().toLowerCase();
}

function hasTextIncluding(expected) {
  const normalizedExpected = normalizeText(expected);

  return (_content, node) => {
    if (!node) return false;
    return normalizeText(node.textContent || "").includes(normalizedExpected);
  };
}

vi.mock("react-router-dom", async () => {
  const ReactModule = await import("react");
  const React = ReactModule.default || ReactModule;

  const RouterContext = React.createContext({
    entry: { pathname: "/", search: "", hash: "", state: null },
    setEntry: () => {},
  });

  function splitEntry(input = "/") {
    const value = String(input || "/");
    const hashIndex = value.indexOf("#");
    const pathWithSearch = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
    const hash = hashIndex >= 0 ? value.slice(hashIndex) : "";
    const [pathnamePart, searchPart = ""] = pathWithSearch.split("?");

    return {
      pathname: pathnamePart || "/",
      search: searchPart ? `?${searchPart}` : "",
      hash,
      state: null,
    };
  }

  function MemoryRouter({ initialEntries = ["/"], children }) {
    const [entry, setEntry] = React.useState(() =>
      splitEntry(initialEntries[0] || "/")
    );

    const ctxValue = React.useMemo(
      () => ({
        entry,
        setEntry,
      }),
      [entry]
    );

    return (
      <RouterContext.Provider value={ctxValue}>
        {children}
      </RouterContext.Provider>
    );
  }

  function useSearchParams() {
    const { entry, setEntry } = React.useContext(RouterContext);

    const searchParams = React.useMemo(() => {
      const raw = entry.search.startsWith("?")
        ? entry.search.slice(1)
        : entry.search;
      return new URLSearchParams(raw);
    }, [entry.search]);

    const updateSearchParams = React.useCallback(
      (nextValue) => {
        setEntry((current) => {
          const currentParams = new URLSearchParams(
            current.search.startsWith("?")
              ? current.search.slice(1)
              : current.search
          );

          const resolved =
            typeof nextValue === "function"
              ? nextValue(currentParams)
              : nextValue;

          const nextParams = new URLSearchParams(resolved);
          const nextSearch = nextParams.toString();

          return {
            ...current,
            search: nextSearch ? `?${nextSearch}` : "",
          };
        });
      },
      [setEntry]
    );

    return [searchParams, updateSearchParams];
  }

  function useLocation() {
    const { entry } = React.useContext(RouterContext);
    return {
      pathname: entry.pathname,
      search: entry.search,
      hash: entry.hash || "",
      state: entry.state || null,
    };
  }

  return {
    MemoryRouter,
    useSearchParams,
    useLocation,
  };
});

vi.mock("lucide-react", async () => {
  const ReactModule = await import("react");
  const React = ReactModule.default || ReactModule;

  function Icon(props) {
    return <svg data-testid="icon" aria-hidden="true" {...props} />;
  }

  return {
    BellRing: Icon,
    Bot: Icon,
    Building2: Icon,
    MapPin: Icon,
    RefreshCw: Icon,
    ShieldCheck: Icon,
    Sparkles: Icon,
    Users: Icon,
    Waypoints: Icon,
    BrainCircuit: Icon,
    Contact2: Icon,
    ListTree: Icon,
    Database: Icon,
    SearchCheck: Icon,
    PhoneCall: Icon,
    ScrollText: Icon,
  };
});

vi.mock("../../api/settings.js", () => ({
  getMetaConnectUrl: vi
    .fn()
    .mockResolvedValue("https://meta.example.test/connect"),
}));

vi.mock("../../lib/pushClient.js", () => ({
  askPermission: vi.fn().mockResolvedValue("default"),
  getNotificationPermission: vi.fn().mockResolvedValue("default"),
  subscribePush: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("../../lib/controlPlanePermissions.js", () => ({
  getControlPlanePermissions: () => ({
    operationalSettingsWrite: {
      allowed: false,
      requiredRoles: ["owner", "admin"],
      message:
        "Only owner/admin can manage operational voice and channel settings.",
    },
    auditHistoryRead: {
      allowed: false,
      requiredRoles: ["owner", "admin", "analyst"],
      message:
        "Only owner/admin/analyst can read control-plane audit history.",
    },
  }),
}));

vi.mock("../../components/ui/Button.jsx", () => ({
  default: function Button({
    children,
    onClick,
    disabled = false,
    type = "button",
  }) {
    return (
      <button type={type} onClick={onClick} disabled={disabled}>
        {children}
      </button>
    );
  },
}));

vi.mock("../../components/ui/Badge.jsx", () => ({
  default: function Badge({ children }) {
    return <span>{children}</span>;
  },
}));

vi.mock("../../components/settings/SettingsShell.jsx", () => ({
  default: function SettingsShellMock({
    title,
    subtitle,
    items,
    activeKey,
    onChange,
    children,
  }) {
    return (
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        <div>Governed operations</div>

        <nav>
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              aria-pressed={activeKey === item.key}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div data-testid="active-section">{activeKey}</div>
        <div>{children}</div>
      </div>
    );
  },
}));

vi.mock("../../components/settings/ChannelsPanel.jsx", () => ({
  default: function ChannelsPanelMock() {
    return <div>Channels panel</div>;
  },
}));

vi.mock("../../components/settings/AgentsPanel.jsx", () => ({
  default: function AgentsPanelMock() {
    return <div>Agents panel</div>;
  },
}));

vi.mock("../../components/settings/TeamPanel.jsx", () => ({
  default: function TeamPanelMock() {
    return <div>Team panel</div>;
  },
}));

vi.mock("../../components/settings/SettingsSaveBar.jsx", () => ({
  default: function SettingsSaveBarMock() {
    return <div>Settings save bar</div>;
  },
}));

vi.mock("../../components/governance/GovernanceCockpit.jsx", () => ({
  GovernanceSignalStrip: function GovernanceSignalStripMock() {
    return <div>Governance signal strip</div>;
  },
}));

vi.mock("./sections/GeneralSection.jsx", () => ({
  default: function GeneralSectionMock({ surface }) {
    return (
      <section>
        <h2>General section</h2>
        <div>{surface?.saveSuccess || ""}</div>
      </section>
    );
  },
}));

vi.mock("./sections/BrandSection.jsx", () => ({
  default: function BrandSectionMock() {
    return <section>Brand section</section>;
  },
}));

vi.mock("./sections/AiPolicySection.jsx", () => ({
  default: function AiPolicySectionMock() {
    return <section>AI policy section</section>;
  },
}));

vi.mock("./sections/SourcesSection.jsx", () => ({
  default: function SourcesSectionMock({ children }) {
    return (
      <section>
        <div>Refresh evidence, review what is weak or conflicting</div>
        <div>Source sync refreshes evidence only</div>
        <div>Latest approved change footprint</div>
        {children}
      </section>
    );
  },
}));

vi.mock("./sections/KnowledgeReviewSection.jsx", () => ({
  default: function KnowledgeReviewSectionMock({ children }) {
    return (
      <section>
        <div>
          Source-derived truth changes are reviewed, conflicted, quarantined,
          approved, or rejected here
        </div>
        {children}
      </section>
    );
  },
}));

vi.mock("./sections/TrustMaintenanceSection.jsx", () => ({
  default: function TrustMaintenanceSectionMock({ items = [], trust = {} }) {
    const blockerTitle =
      trust?.view?.summary?.runtimeProjection?.readiness?.blockers?.[0]?.title ||
      "Runtime projection blocker";

    return (
      <section>
        <div>Operator governance cockpit</div>
        <div>Decision timeline and incident replay context</div>
        <div>Trust repair hub</div>
        <div>{blockerTitle}</div>
        <button type="button">Open runtime setup</button>
        <div>New source evidence created candidate changes</div>
        <div>Recent evidence refreshes</div>
        <div>Runtime projection</div>
        {items.map((item) => (
          <div key={item.id}>{item.display_name}</div>
        ))}
      </section>
    );
  },
}));

vi.mock("./sections/TrustKnowledgeReviewSection.jsx", () => ({
  default: function TrustKnowledgeReviewSectionMock({ workbench }) {
    const firstItem = workbench?.items?.[0];

    return (
      <section>
        <div>Truth review workbench</div>
        <div>Conflict resolution</div>
        <div>Change impact simulator</div>
        <div>Finalize impact preview</div>
        <div>Recent trust activity</div>
        <div>{firstItem?.title || ""}</div>
      </section>
    );
  },
}));

vi.mock("./sections/SyncRunsModal.jsx", () => ({
  default: function SyncRunsModalMock({ open }) {
    return open ? <div>Sync runs modal</div> : null;
  },
}));

vi.mock("./sections/AutoContentSection.jsx", () => ({
  default: function AutoContentSectionMock() {
    return <div>Auto content section</div>;
  },
}));

vi.mock("./sections/NotificationsSection.jsx", () => ({
  default: function NotificationsSectionMock() {
    return <section>Notifications section</section>;
  },
}));

vi.mock("./sections/BusinessFactsSection.jsx", () => ({
  default: function BusinessFactsSectionMock({ surface }) {
    return (
      <section>
        <div>Business facts</div>
        <div>{surface?.saveSuccess || ""}</div>
      </section>
    );
  },
}));

vi.mock("./sections/ChannelPoliciesSection.jsx", () => ({
  default: function ChannelPoliciesSectionMock() {
    return <section>Channel policies section</section>;
  },
}));

vi.mock("./sections/LocationsSection.jsx", () => ({
  default: function LocationsSectionMock() {
    return <section>Locations section</section>;
  },
}));

vi.mock("./sections/ContactsSection.jsx", () => ({
  default: function ContactsSectionMock() {
    return <section>Contacts section</section>;
  },
}));

vi.mock("./sections/OperationalSection.jsx", () => ({
  default: function OperationalSectionMock({ data, canManage }) {
    const voiceMissing = data?.voice?.missingFields?.[0] || "twilio_phone_number";
    const metaSecret =
      data?.channels?.meta?.providerSecrets?.missingSecretKeys?.[0] ||
      "page_access_token";
    const operationalMessage =
      data?.capabilities?.operationalSettingsWrite?.message || "";
    const secretsMessage =
      data?.capabilities?.providerSecretsMutation?.message || "";

    return (
      <section>
        <div>Operational repair hub</div>
        <div>
          Production traffic stays fail-closed until the persisted operational
          contract and provider dependencies converge.
        </div>
        <div>Voice operational settings</div>
        <div>{`Missing: ${voiceMissing}`}</div>
        <div>Open secure secrets</div>
        <div>Provider secret readiness</div>
        <div>{`Missing required: ${metaSecret}`}</div>
        <div>Requires admin access</div>
        <div>Requires admin access</div>
        <div>{operationalMessage}</div>
        <div>{secretsMessage}</div>
        <button type="button" disabled={!canManage}>
          Save voice settings
        </button>
        <button type="button" disabled={!canManage}>
          Save channel identifiers
        </button>
        <div>
          Production traffic is fail-closed while operational rows or required
          provider readiness are incomplete.
        </div>
      </section>
    );
  },
}));

vi.mock("./sections/ChangeHistorySection.jsx", () => ({
  default: function ChangeHistorySectionMock() {
    return <section>Change history section</section>;
  },
}));

vi.mock("./hooks/useSettingsWorkspace.js", () => {
  const refresh = vi.fn().mockResolvedValue({ tenantKey: "tenant-a" });
  const workspaceState = {
    surface: {
      loading: false,
      error: "",
      unavailable: false,
      ready: true,
      saving: false,
      saveError: "",
      saveSuccess: "Workspace settings saved.",
      refresh,
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
    refreshWorkspace: refresh,
    onSaveWorkspace: vi.fn(),
    onResetWorkspace: vi.fn().mockReturnValue({}),
    saveAgent: vi.fn(),
    setInitialWorkspace: vi.fn(),
  };

  return {
    useSettingsWorkspace: () => workspaceState,
  };
});

vi.mock("./hooks/useBusinessBrain.js", () => {
  const surface = {
    loading: false,
    error: "",
    unavailable: false,
    ready: true,
    saving: false,
    saveError: "",
    saveSuccess: "Business fact saved.",
    refresh: vi.fn().mockResolvedValue({}),
    clearSaveState: vi.fn(),
  };

  const state = {
    surface,
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
  };

  return {
    useBusinessBrain: () => state,
  };
});

vi.mock("./hooks/useOperationalSettings.js", () => {
  const state = {
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
          message:
            "Only owner/admin can manage operational voice and channel settings.",
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
      },
      voice: {
        settings: {
          enabled: true,
          defaultLanguage: "en",
          supportedLanguages: ["en", "az"],
          twilioPhoneNumber: "+15550001111",
          operatorPhone: "+15550002222",
        },
        operational: {
          ready: false,
          reasonCode: "voice_phone_number_missing",
        },
        missingFields: ["twilio_phone_number"],
      },
      channels: {
        meta: {
          channel: {
            channel_type: "instagram",
            provider: "meta",
            status: "connected",
            external_user_id: "ig-1",
          },
          operational: {
            ready: false,
            reasonCode: "channel_identifiers_missing",
          },
          missingFields: ["external_page_id_or_external_user_id"],
          providerSecrets: {
            ready: false,
            presentSecretKeys: [],
            missingSecretKeys: ["page_access_token"],
          },
        },
      },
    },
    operationalMessage:
      "Production traffic is blocked until operational records are complete.",
    refreshOperationalSettings: vi.fn().mockResolvedValue({}),
    saveVoiceSettings: vi.fn().mockResolvedValue({}),
    saveChannelSettings: vi.fn().mockResolvedValue({}),
  };

  return {
    useOperationalSettings: () => state,
  };
});

vi.mock("./hooks/useSourceIntelligence.js", () => {
  const state = {
    sources: [
      {
        id: "source-1",
        source_type: "website",
        display_name: "Main Website",
        source_url: "https://north.example",
        status: "connected",
        sync_status: "completed",
        is_enabled: true,
      },
    ],
    setSources: vi.fn(),
    knowledgeReview: [
      {
        id: "candidate-1",
        title: "North Clinic",
      },
    ],
    knowledgeReviewSummary: {
      total: 1,
      pending: 0,
      quarantined: 0,
      conflicting: 1,
      autoApprovable: 0,
      blockedHighRisk: 0,
      highRisk: 0,
    },
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
    handleMarkKnowledgeFollowUp: vi.fn(),
    handleKeepKnowledgeQuarantined: vi.fn(),
  };

  return {
    useSourceIntelligence: () => state,
  };
});

vi.mock("./hooks/useTrustSurface.js", () => {
  const state = {
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
          runtimeProjection: {
            status: "ready",
            stale: false,
            updatedAt: "2026-03-25T10:05:00.000Z",
            readiness: {
              status: "blocked",
              blockers: [
                {
                  title: "Runtime projection blocker",
                },
              ],
            },
          },
          truth: {
            latestVersionId: "truth-v1",
          },
        },
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
  };

  return {
    useTrustSurface: () => state,
  };
});

vi.mock("./hooks/useAuditHistory.js", () => {
  const state = {
    auditHistory: {
      viewerRole: "operator",
      permissions: {
        auditHistoryRead: {
          allowed: false,
          message:
            "Only owner/admin/analyst can read control-plane audit history.",
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
  };

  return {
    useAuditHistory: () => state,
  };
});

import { MemoryRouter } from "react-router-dom";
import SettingsController from "./SettingsController.jsx";

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.stubGlobal("scrollTo", vi.fn());
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("Settings truth-maintenance smoke", () => {
  function renderPage(entry = "/settings") {
    return render(
      <MemoryRouter initialEntries={[entry]}>
        <SettingsController />
      </MemoryRouter>
    );
  }

  it("renders workspace and business-brain sections through the shared async surface language", async () => {
    renderPage();

    expect(await screen.findByText(/governed operations/i)).toBeTruthy();
    expect(
      (await screen.findAllByText(/workspace settings saved/i)).length
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: /governance history/i })
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /business facts/i }));
    expect(await screen.findByText(/business fact saved/i)).toBeTruthy();
  });

  it("renders source sync and knowledge review truth-maintenance messaging", async () => {
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: /truth governance/i })
    );

    expect(
      (
        await screen.findAllByText(
          hasTextIncluding("Refresh evidence, review what is weak or conflicting")
        )
      ).length
    ).toBeGreaterThan(0);

    expect(screen.getByText(/operator governance cockpit/i)).toBeTruthy();
    expect(screen.getByText(/latest approved change footprint/i)).toBeTruthy();
    expect(screen.getByText(/trust repair hub/i)).toBeTruthy();
    expect(
      screen.getAllByText(/runtime projection blocker/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: /open runtime setup/i }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(/source sync refreshes evidence only/i)
    ).toBeTruthy();
    expect(
      screen.getByText(/new source evidence created candidate changes/i)
    ).toBeTruthy();
    expect(screen.getAllByText(/main website/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/recent evidence refreshes/i)).toBeTruthy();
    expect(screen.getAllByText(/runtime projection/i).length).toBeGreaterThan(0);

    cleanup();
    renderPage("/settings?section=knowledge_review");

    expect(
      (
        await screen.findAllByText(
          hasTextIncluding(
            "Source-derived truth changes are reviewed, conflicted, quarantined, approved, or rejected here"
          )
        )
      ).length
    ).toBeGreaterThan(0);

    expect(
      screen.getAllByText(/truth review workbench/i).length
    ).toBeGreaterThan(0);
    expect(screen.getByText(/conflict resolution/i)).toBeTruthy();
    expect(screen.getByText(/change impact simulator/i)).toBeTruthy();
    expect(screen.getByText(/finalize impact preview/i)).toBeTruthy();
    expect(screen.getByText(/recent trust activity/i)).toBeTruthy();
  });

  it("renders operational readiness fail states honestly", async () => {
    renderPage();

    fireEvent.click(
      (await screen.findAllByRole("button", { name: /runtime operations/i }))[0]
    );

    expect(screen.getByText(/operational repair hub/i)).toBeTruthy();
    expect(
      await screen.findByText(
        /production traffic stays fail-closed until the persisted operational contract and provider dependencies converge/i
      )
    ).toBeTruthy();
    expect(screen.getByText(/voice operational settings/i)).toBeTruthy();
    expect(
      screen.getAllByText(/missing: twilio_phone_number/i).length
    ).toBeGreaterThan(0);
    expect(screen.getByText(/open secure secrets/i)).toBeTruthy();
    expect(screen.getByText(/provider secret readiness/i)).toBeTruthy();
    expect(
      screen.getByText(/missing required: page_access_token/i)
    ).toBeTruthy();
    expect(
      screen.getAllByText(/requires admin access/i).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText(
        /only owner\/admin can manage operational voice and channel settings/i
      )
    ).toBeTruthy();
    expect(
      screen.getByText(/only owner\/admin can manage provider secrets/i)
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /save voice settings/i }).disabled
    ).toBe(true);
    expect(
      screen.getByRole("button", { name: /save channel identifiers/i }).disabled
    ).toBe(true);
    expect(
      screen.getByText(
        /production traffic is fail-closed while operational rows or required provider readiness are incomplete/i
      )
    ).toBeTruthy();
  });

  it("opens the truth-governance section from deep-link state", async () => {
    renderPage("/settings?section=sources&trustFocus=runtime_health&historyFilter=runtime");

    expect(
      (
        await screen.findAllByText(
          hasTextIncluding("Refresh evidence, review what is weak or conflicting")
        )
      ).length
    ).toBeGreaterThan(0);

    expect(screen.getByText(/operator governance cockpit/i)).toBeTruthy();
    expect(
      screen.getByText(/decision timeline and incident replay context/i)
    ).toBeTruthy();
  });
});