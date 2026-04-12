import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getWebsiteWidgetStatus = vi.fn();
const saveWebsiteWidgetConfig = vi.fn();
const getWebsiteDomainVerificationStatus = vi.fn();
const createWebsiteDomainVerificationChallenge = vi.fn();
const checkWebsiteDomainVerification = vi.fn();
const createWebsiteWidgetInstallHandoff = vi.fn();
const createWebsiteWidgetGtmInstallHandoff = vi.fn();
const createWebsiteWidgetWordpressInstallHandoff = vi.fn();
const emitLaunchSliceRefresh = vi.fn();
const useWorkspaceTenantKey = vi.fn();

vi.mock("../../../api/channelConnect.js", () => ({
  getWebsiteWidgetStatus: (...args) => getWebsiteWidgetStatus(...args),
  saveWebsiteWidgetConfig: (...args) => saveWebsiteWidgetConfig(...args),
  getWebsiteDomainVerificationStatus: (...args) =>
    getWebsiteDomainVerificationStatus(...args),
  createWebsiteDomainVerificationChallenge: (...args) =>
    createWebsiteDomainVerificationChallenge(...args),
  checkWebsiteDomainVerification: (...args) =>
    checkWebsiteDomainVerification(...args),
  createWebsiteWidgetInstallHandoff: (...args) =>
    createWebsiteWidgetInstallHandoff(...args),
  createWebsiteWidgetGtmInstallHandoff: (...args) =>
    createWebsiteWidgetGtmInstallHandoff(...args),
  createWebsiteWidgetWordpressInstallHandoff: (...args) =>
    createWebsiteWidgetWordpressInstallHandoff(...args),
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

vi.mock("../../../lib/launchSliceRefresh.js", () => ({
  emitLaunchSliceRefresh: (...args) => emitLaunchSliceRefresh(...args),
}));

import WebsiteWidgetDetailDrawer from "../../../components/channels/WebsiteWidgetDetailDrawer.jsx";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function renderDrawer({
  payload,
  channel = { id: "website", name: "Website chat" },
  open = true,
} = {}) {
  const client = createQueryClient();

  getWebsiteWidgetStatus.mockResolvedValue(payload);

  return render(
    <QueryClientProvider client={client}>
      <WebsiteWidgetDetailDrawer channel={channel} open={open} onClose={vi.fn()} />
    </QueryClientProvider>
  );
}

function createBlockedPayload(overrides = {}) {
  return {
    state: "blocked",
    viewerRole: "owner",
    permissions: {
      saveAllowed: true,
      requiredRoles: ["owner", "admin"],
      message: "",
    },
    widget: {
      enabled: true,
      publicWidgetId: "ww_acme_widget",
      allowedOrigins: ["https://www.acme.test"],
      allowedDomains: ["acme.test"],
      title: "Website chat",
      subtitle: "Ask a question.",
      accentColor: "#0f172a",
      initialPrompts: ["What services do you offer?"],
      websiteUrl: "https://www.acme.test",
      channelStatus: "connected",
      updatedAt: "2026-04-13T10:00:00.000Z",
    },
    install: {
      scriptUrl: "https://app.example.test/widget.js",
      apiBase: "https://app.example.test/api",
      embedSnippet:
        '<script src="https://app.example.test/widget.js" data-widget-id="ww_acme_widget" data-api-base="https://app.example.test/api" async></script>',
      productionInstallReady: false,
      productionBlocked: true,
      blockReasonCode: "website_domain_verification_required",
      blockMessage: "Verify DNS TXT ownership before public install.",
      unverifiedHandoffsAllowed: false,
      handoffReady: false,
      developerHandoffReady: false,
      gtmHandoffReady: false,
      wordpressHandoffReady: false,
      handoffTestingOnly: false,
      handoffProductionReady: false,
      handoffTargetDomain: "acme.test",
      handoffVerificationState: "pending",
      handoffBlockReasonCode: "website_domain_verification_required",
      handoffMessage: "Verify DNS TXT ownership before install packages unlock.",
      verificationRequiredForProduction: true,
    },
    domainVerification: {
      state: "pending",
      domain: "acme.test",
      candidateDomain: "acme.test",
      candidateDomains: ["acme.test", "www.acme.test"],
      reasonCode: "dns_txt_pending",
      message: "DNS TXT ownership is still pending.",
      lastCheckedAt: "2026-04-13T10:15:00.000Z",
      verifiedAt: null,
      challenge: {
        name: "_openai-challenge.acme.test",
        value: "acme-verification-token",
      },
      readiness: {
        enforcementActive: true,
        productionInstallReady: false,
      },
    },
    readiness: {
      status: "blocked",
      message: "Website chat is blocked for public install until domain ownership is verified.",
      blockers: [
        {
          reasonCode: "website_domain_verification_required",
          title: "Website chat production install is blocked until domain ownership is verified.",
          subtitle:
            "Create and verify a DNS TXT challenge for this domain before Website Chat can launch publicly.",
        },
      ],
    },
    ...overrides,
  };
}

function createReadyPayload(overrides = {}) {
  return {
    state: "connected",
    viewerRole: "owner",
    permissions: {
      saveAllowed: true,
      requiredRoles: ["owner", "admin"],
      message: "",
    },
    widget: {
      enabled: true,
      publicWidgetId: "ww_acme_widget",
      allowedOrigins: ["https://www.acme.test"],
      allowedDomains: ["acme.test"],
      title: "Website chat",
      subtitle: "Ask a question.",
      accentColor: "#0f172a",
      initialPrompts: ["What services do you offer?"],
      websiteUrl: "https://www.acme.test",
      channelStatus: "connected",
      updatedAt: "2026-04-13T10:00:00.000Z",
    },
    install: {
      scriptUrl: "https://app.example.test/widget.js",
      apiBase: "https://app.example.test/api",
      embedSnippet:
        '<script src="https://app.example.test/widget.js" data-widget-id="ww_acme_widget" data-api-base="https://app.example.test/api" async></script>',
      productionInstallReady: true,
      productionBlocked: false,
      blockReasonCode: "",
      blockMessage: "",
      unverifiedHandoffsAllowed: false,
      handoffReady: true,
      developerHandoffReady: true,
      gtmHandoffReady: true,
      wordpressHandoffReady: true,
      handoffTestingOnly: false,
      handoffProductionReady: true,
      handoffTargetDomain: "acme.test",
      handoffVerificationState: "verified",
      handoffBlockReasonCode: "",
      handoffMessage: "Website Chat is ready for install packages.",
      verificationRequiredForProduction: true,
    },
    domainVerification: {
      state: "verified",
      domain: "acme.test",
      candidateDomain: "acme.test",
      candidateDomains: ["acme.test"],
      reasonCode: "",
      message: "Domain ownership verified.",
      lastCheckedAt: "2026-04-13T10:15:00.000Z",
      verifiedAt: "2026-04-13T10:16:00.000Z",
      challenge: {
        name: "_openai-challenge.acme.test",
        value: "acme-verification-token",
      },
      readiness: {
        enforcementActive: true,
        productionInstallReady: true,
      },
    },
    readiness: {
      status: "ready",
      message: "Website chat is configured with a publishable install ID and trusted origin controls.",
      blockers: [],
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  useWorkspaceTenantKey.mockReturnValue({
    tenantKey: "acme",
    loading: false,
    ready: true,
  });

  saveWebsiteWidgetConfig.mockResolvedValue(createReadyPayload());
  getWebsiteDomainVerificationStatus.mockResolvedValue(
    createBlockedPayload().domainVerification
  );
  createWebsiteDomainVerificationChallenge.mockResolvedValue(
    createBlockedPayload().domainVerification
  );
  checkWebsiteDomainVerification.mockResolvedValue(
    createReadyPayload().domainVerification
  );
  createWebsiteWidgetInstallHandoff.mockResolvedValue({
    packageType: "developer",
    packageTitle: "Website Chat developer install handoff",
    packageText: "developer-package-body",
    targetDomain: "acme.test",
    verifiedDomain: "acme.test",
    generatedAt: "2026-04-13T10:17:00.000Z",
    productionReady: true,
    testingOnly: false,
    readiness: {
      productionReady: true,
      testingOnly: false,
    },
  });
  createWebsiteWidgetGtmInstallHandoff.mockResolvedValue({
    packageType: "gtm",
    packageTitle: "Website Chat GTM install handoff",
    packageText: "gtm-package-body",
    targetDomain: "acme.test",
    verifiedDomain: "acme.test",
    generatedAt: "2026-04-13T10:17:00.000Z",
    productionReady: true,
    testingOnly: false,
    readiness: {
      productionReady: true,
      testingOnly: false,
    },
  });
  createWebsiteWidgetWordpressInstallHandoff.mockResolvedValue({
    packageType: "wordpress",
    packageTitle: "Website Chat WordPress install package",
    packageText: "wordpress-package-body",
    targetDomain: "acme.test",
    verifiedDomain: "acme.test",
    generatedAt: "2026-04-13T10:17:00.000Z",
    productionReady: true,
    testingOnly: false,
    readiness: {
      productionReady: true,
      testingOnly: false,
    },
  });
});

afterEach(() => {
  cleanup();
});

describe("WebsiteWidgetDetailDrawer", () => {
  it("renders the blocked posture first when production install is still gated by domain verification", async () => {
    renderDrawer({
      payload: createBlockedPayload(),
    });

    expect(
      await screen.findByText(/public install is blocked/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/next: verify domain/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /domain/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /go live/i })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/verify dns txt ownership before public install/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /copy snippet/i })
    ).toBeDisabled();

    expect(
      screen.getByRole("button", { name: /developer package/i })
    ).toBeDisabled();
  });

  it("renders the ready posture and enables install actions when the domain is verified", async () => {
    renderDrawer({
      payload: createReadyPayload(),
    });

    expect(
      await screen.findByText(/ready to install/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/next: copy snippet or package/i)
    ).toBeInTheDocument();

    expect(
      screen.getByDisplayValue(/widget\.js/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /copy snippet/i })
    ).toBeEnabled();

    expect(
      screen.getByRole("button", { name: /developer package/i })
    ).toBeEnabled();

    expect(
      screen.getByRole("button", { name: /gtm package/i })
    ).toBeEnabled();

    expect(
      screen.getByRole("button", { name: /wordpress package/i })
    ).toBeEnabled();
  });

  it("creates and shows the developer package body from the install section", async () => {
    renderDrawer({
      payload: createReadyPayload(),
    });

    fireEvent.click(
      await screen.findByRole("button", { name: /developer package/i })
    );

    await waitFor(() => {
      expect(createWebsiteWidgetInstallHandoff).toHaveBeenCalledTimes(1);
    });

    expect(
      await screen.findByDisplayValue(/developer-package-body/i)
    ).toBeInTheDocument();

    expect(
      screen.getByText(/developer package prepared/i)
    ).toBeInTheDocument();
  });

  it("saves widget settings and emits a launch refresh event", async () => {
    renderDrawer({
      payload: createReadyPayload(),
    });

    const titleInput = await screen.findByDisplayValue("Website chat");
    fireEvent.change(titleInput, {
      target: { value: "Acme support" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(saveWebsiteWidgetConfig).toHaveBeenCalledTimes(1);
    });

    expect(saveWebsiteWidgetConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Acme support",
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(emitLaunchSliceRefresh).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantKey: "acme",
          reason: "website-widget-saved",
        })
      );
    });
  });

  it("shows the permission warning and disables save when the viewer cannot manage settings", async () => {
    renderDrawer({
      payload: createReadyPayload({
        permissions: {
          saveAllowed: false,
          requiredRoles: ["owner", "admin"],
          message: "Only owner/admin can change Website Chat settings.",
        },
      }),
    });

    expect(
      await screen.findByText(/only owner\/admin can change website chat settings/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /^save$/i })
    ).toBeDisabled();
  });
});