import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getWebsiteWidgetStatus = vi.fn();
const saveWebsiteWidgetConfig = vi.fn();
const getWebsiteDomainVerificationStatus = vi.fn();
const createWebsiteDomainVerificationChallenge = vi.fn();
const checkWebsiteDomainVerification = vi.fn();
const createWebsiteWidgetGtmInstallHandoff = vi.fn();
const createWebsiteWidgetInstallHandoff = vi.fn();
const createWebsiteWidgetWordpressInstallHandoff = vi.fn();
const useWorkspaceTenantKey = vi.fn();

vi.mock("../../api/channelConnect.js", () => ({
  checkWebsiteDomainVerification: (...args) =>
    checkWebsiteDomainVerification(...args),
  createWebsiteDomainVerificationChallenge: (...args) =>
    createWebsiteDomainVerificationChallenge(...args),
  createWebsiteWidgetGtmInstallHandoff: (...args) =>
    createWebsiteWidgetGtmInstallHandoff(...args),
  createWebsiteWidgetInstallHandoff: (...args) =>
    createWebsiteWidgetInstallHandoff(...args),
  createWebsiteWidgetWordpressInstallHandoff: (...args) =>
    createWebsiteWidgetWordpressInstallHandoff(...args),
  getWebsiteDomainVerificationStatus: (...args) =>
    getWebsiteDomainVerificationStatus(...args),
  getWebsiteWidgetStatus: (...args) => getWebsiteWidgetStatus(...args),
  saveWebsiteWidgetConfig: (...args) => saveWebsiteWidgetConfig(...args),
}));

vi.mock("../../hooks/useWorkspaceTenantKey.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: (...args) => useWorkspaceTenantKey(...args),
    useWorkspaceTenantKey: (...args) => useWorkspaceTenantKey(...args),
    buildWorkspaceScopedQueryKey: (baseKey, tenantKey) => [
      ...(Array.isArray(baseKey) ? baseKey : [baseKey]),
      "workspace",
      String(tenantKey || "").trim().toLowerCase(),
    ],
  };
});

import WebsiteWidgetDetailDrawer from "../../components/channels/WebsiteWidgetDetailDrawer.jsx";

function buildDomainVerificationPayload({
  state = "unverified",
  verified = false,
  message,
  challenge = null,
  verifiedAt = null,
  lastCheckedAt = null,
} = {}) {
  const defaultMessage =
    state === "verified"
      ? "DNS TXT ownership has been verified for this domain."
      : "Create and verify a DNS TXT challenge for this domain before Website Chat can be installed on the public website.";

  return {
    state,
    verified,
    method: "dns_txt",
    domain: verified ? "acme.example" : "",
    candidateDomain: "acme.example",
    candidateDomains: ["acme.example", "www.acme.example"],
    challengeVersion: challenge ? 1 : 0,
    challenge,
    lastCheckedAt,
    verifiedAt,
    reasonCode:
      state === "verified"
        ? "dns_txt_verified"
        : "website_domain_verification_missing",
    message: message || defaultMessage,
    readiness: {
      productionInstall: verified ? "ready" : "verification_required",
      productionInstallReady: verified,
      enforcementActive: true,
      message: message || defaultMessage,
    },
  };
}

function buildStatusPayload({
  verified = false,
  unverifiedHandoffsAllowed = false,
} = {}) {
  const domainVerification = buildDomainVerificationPayload({ verified, state: verified ? "verified" : "unverified" });
  const handoffReady = verified === true || unverifiedHandoffsAllowed;
  const handoffMessage = verified
    ? "Website Chat is ready for developer, GTM, and WordPress install handoffs."
    : unverifiedHandoffsAllowed
      ? "Developer, GTM, and WordPress install handoffs are available for local/dev/test only. DNS TXT verification is still required before public launch."
      : domainVerification.message;
  const embedSnippet = verified
    ? '<script src="https://widget.example.test/website-widget-loader.js" data-widget-id="ww_acme_widget" data-api-base="https://api.example.test/api" async></script>'
    : "";

  return {
    ok: true,
    state: verified ? "connected" : "blocked",
    permissions: {
      saveAllowed: true,
      requiredRoles: ["owner", "admin"],
      message: "",
    },
    widget: {
      enabled: true,
      publicWidgetId: "ww_acme_widget",
      websiteUrl: "https://acme.example",
      allowedOrigins: ["https://www.acme.example"],
      allowedDomains: ["acme.example"],
      title: "Acme Clinic",
      subtitle: "Ask a question or leave a message for the team.",
      accentColor: "#0f172a",
      initialPrompts: ["What services do you offer?"],
    },
    install: {
      scriptUrl: "https://widget.example.test/website-widget-loader.js",
      apiBase: "https://api.example.test/api",
      embedSnippet,
      productionBlocked: verified !== true,
      productionInstallReady: verified === true,
      blockReasonCode: verified ? "" : "website_domain_verification_missing",
      blockMessage: verified
        ? ""
        : domainVerification.message,
      unverifiedHandoffsAllowed,
      handoffReady,
      developerHandoffReady: handoffReady,
      gtmHandoffReady: handoffReady,
      wordpressHandoffReady: handoffReady,
      handoffTestingOnly: verified !== true && handoffReady,
      handoffProductionReady: verified === true,
      handoffTargetDomain: "acme.example",
      handoffVerificationState: verified ? "verified" : "unverified",
      handoffBlockReasonCode: handoffReady
        ? ""
        : "website_domain_verification_missing",
      handoffMessage,
      verificationRequiredForProduction: true,
    },
    readiness: {
      status: verified ? "ready" : "blocked",
      message: verified
        ? "Website chat is configured with a publishable install ID, trusted origin controls, and verified domain ownership."
        : domainVerification.message,
      blockers: verified
        ? []
        : [
            {
              reasonCode: "website_domain_verification_missing",
              title:
                "Website chat production install is blocked until domain ownership is verified.",
              subtitle: domainVerification.message,
            },
          ],
    },
    domainVerification,
  };
}

function buildInstallHandoffPayload({
  verified = true,
  testingOnly = verified !== true,
  verificationState = verified ? "verified" : "unverified",
} = {}) {
  const verifiedDomain = verified ? "acme.example" : "";
  const readinessMessage = testingOnly
    ? "Developer, GTM, and WordPress install handoffs are available for local/dev/test only. DNS TXT verification is still required before public launch."
    : "Website chat is configured with a publishable install ID, trusted origin controls, and verified domain ownership.";
  const warning = testingOnly
    ? "This package is for local/dev/test only. DNS TXT verification is still required before public launch."
    : "";

  return {
    ready: true,
    generatedAt: "2026-04-10T11:00:00.000Z",
    audience: "developer",
    packageType: "developer",
    packageTitle: "Website Chat developer install handoff",
    targetDomain: "acme.example",
    verifiedDomain,
    widgetId: "ww_acme_widget",
    loaderScriptUrl: "https://widget.example.test/website-widget-loader.js",
    apiBase: "https://api.example.test/api",
    embedSnippet:
      '<script src="https://widget.example.test/website-widget-loader.js" data-widget-id="ww_acme_widget" data-api-base="https://api.example.test/api" async></script>',
    productionReady: testingOnly !== true,
    testingOnly,
    verificationState,
    verificationRequiredForProduction: true,
    unverifiedHandoffsAllowed: testingOnly === true,
    warning,
    message: readinessMessage,
    instructions: [
      ...(testingOnly
        ? [
            "This install handoff is for local/dev/test only while DNS TXT verification is still pending for production launch.",
          ]
        : []),
      "Add the loader snippet once before the closing </body> tag on pages served from acme.example.",
      "Keep the data-widget-id and data-api-base values exactly as provided.",
    ],
    readiness: {
      status: testingOnly ? "testing_only" : "ready",
      message: readinessMessage,
      productionInstallReady: testingOnly !== true,
      productionReady: testingOnly !== true,
      testingOnly,
      verificationState,
      verifiedAt: verified ? "2026-04-10T10:30:00.000Z" : null,
      targetDomain: "acme.example",
      verifiedDomain,
      verificationRequiredForProduction: true,
      unverifiedHandoffsAllowed: testingOnly === true,
      warning,
    },
    packageText: [
      "Website Chat developer install handoff",
      "",
      `${testingOnly ? "Target domain" : "Verified domain"}: acme.example`,
      "Widget ID: ww_acme_widget",
      "Loader script URL: https://widget.example.test/website-widget-loader.js",
      "API base: https://api.example.test/api",
      `Production ready: ${testingOnly ? "No" : "Yes"}`,
      `Testing only: ${testingOnly ? "Yes" : "No"}`,
      ...(warning ? [`Warning: ${warning}`] : []),
    ].join("\n"),
  };
}

function buildGtmInstallHandoffPayload({
  verified = true,
  testingOnly = verified !== true,
  verificationState = verified ? "verified" : "unverified",
} = {}) {
  const verifiedDomain = verified ? "acme.example" : "";
  const readinessMessage = testingOnly
    ? "Developer, GTM, and WordPress install handoffs are available for local/dev/test only. DNS TXT verification is still required before public launch."
    : "Website chat is configured with a publishable install ID, trusted origin controls, and verified domain ownership.";
  const warning = testingOnly
    ? "This package is for local/dev/test only. DNS TXT verification is still required before public launch."
    : "";

  return {
    ready: true,
    generatedAt: "2026-04-10T11:05:00.000Z",
    audience: "developer",
    packageType: "gtm",
    packageTitle: "Website Chat GTM install handoff",
    targetDomain: "acme.example",
    verifiedDomain,
    widgetId: "ww_acme_widget",
    loaderScriptUrl: "https://widget.example.test/website-widget-loader.js",
    apiBase: "https://api.example.test/api",
    embedSnippet:
      '<script src="https://widget.example.test/website-widget-loader.js" data-widget-id="ww_acme_widget" data-api-base="https://api.example.test/api" async></script>',
    productionReady: testingOnly !== true,
    testingOnly,
    verificationState,
    verificationRequiredForProduction: true,
    unverifiedHandoffsAllowed: testingOnly === true,
    warning,
    message: readinessMessage,
    gtmCustomHtmlSnippet: [
      "<!-- Website Chat GTM Custom HTML tag -->",
      '<script src="https://widget.example.test/website-widget-loader.js" data-widget-id="ww_acme_widget" data-api-base="https://api.example.test/api" async></script>',
    ].join("\n"),
    packageSnippet: [
      "<!-- Website Chat GTM Custom HTML tag -->",
      '<script src="https://widget.example.test/website-widget-loader.js" data-widget-id="ww_acme_widget" data-api-base="https://api.example.test/api" async></script>',
    ].join("\n"),
    snippetLabel: "GTM Custom HTML tag",
    instructions: [
      ...(testingOnly
        ? [
            "This GTM handoff is for local/dev/test only while DNS TXT verification is still pending for production launch.",
          ]
        : []),
      "In Google Tag Manager, create a new Custom HTML tag for pages served from acme.example.",
      "Paste the GTM Custom HTML block exactly as provided below and keep the widget ID plus API base unchanged.",
    ],
    readiness: {
      status: testingOnly ? "testing_only" : "ready",
      message: readinessMessage,
      productionInstallReady: testingOnly !== true,
      productionReady: testingOnly !== true,
      testingOnly,
      verificationState,
      verifiedAt: verified ? "2026-04-10T10:30:00.000Z" : null,
      targetDomain: "acme.example",
      verifiedDomain,
      verificationRequiredForProduction: true,
      unverifiedHandoffsAllowed: testingOnly === true,
      warning,
    },
    packageText: [
      "Website Chat GTM install handoff",
      "",
      `${testingOnly ? "Target domain" : "Verified domain"}: acme.example`,
      "Widget ID: ww_acme_widget",
      "Loader script URL: https://widget.example.test/website-widget-loader.js",
      "API base: https://api.example.test/api",
      "",
      "GTM Custom HTML tag:",
      "<!-- Website Chat GTM Custom HTML tag -->",
    ].join("\n"),
  };
}

function buildWordpressInstallHandoffPayload({
  verified = true,
  testingOnly = verified !== true,
  verificationState = verified ? "verified" : "unverified",
} = {}) {
  const verifiedDomain = verified ? "acme.example" : "";
  const readinessMessage = testingOnly
    ? "Developer, GTM, and WordPress install handoffs are available for local/dev/test only. DNS TXT verification is still required before public launch."
    : "Website chat is configured with a publishable install ID, trusted origin controls, and verified domain ownership.";
  const warning = testingOnly
    ? "This package is for local/dev/test only. DNS TXT verification is still required before public launch."
    : "";
  const packageJson = JSON.stringify(
    {
      packageType: "wordpress",
      packageTitle: "Website Chat WordPress install package",
      ready: true,
      targetDomain: "acme.example",
      verifiedDomain,
      widgetId: "ww_acme_widget",
      loaderScriptUrl: "https://widget.example.test/website-widget-loader.js",
      apiBase: "https://api.example.test/api",
      testingOnly,
      productionReady: testingOnly !== true,
      verificationState,
      verificationRequiredForProduction: true,
      warning,
      message: readinessMessage,
      readiness: {
        status: testingOnly ? "testing_only" : "ready",
        message: readinessMessage,
        productionInstallReady: testingOnly !== true,
        productionReady: testingOnly !== true,
        testingOnly,
        verificationState,
        verifiedAt: verified ? "2026-04-10T10:30:00.000Z" : null,
        targetDomain: "acme.example",
        verifiedDomain,
        verificationRequiredForProduction: true,
        unverifiedHandoffsAllowed: testingOnly === true,
        warning,
      },
      instructions: [
        ...(testingOnly
          ? [
              "This WordPress package is for local/dev/test only while DNS TXT verification is still pending for production launch.",
            ]
          : []),
        "Upload and activate the private AIHQ Website Chat WordPress plugin on the target WordPress site.",
        "Open Settings > AIHQ Website Chat in WordPress admin.",
      ],
      wordpressPlugin: {
        slug: "aihq-website-chat",
        pluginDirectory: "integrations/wordpress/aihq-website-chat",
        mainFile: "aihq-website-chat.php",
      },
    },
    null,
    2
  );

  return {
    ready: true,
    generatedAt: "2026-04-10T11:10:00.000Z",
    audience: "developer",
    packageType: "wordpress",
    packageTitle: "Website Chat WordPress install package",
    targetDomain: "acme.example",
    verifiedDomain,
    widgetId: "ww_acme_widget",
    loaderScriptUrl: "https://widget.example.test/website-widget-loader.js",
    apiBase: "https://api.example.test/api",
    embedSnippet:
      '<script src="https://widget.example.test/website-widget-loader.js" data-widget-id="ww_acme_widget" data-api-base="https://api.example.test/api" async></script>',
    productionReady: testingOnly !== true,
    testingOnly,
    verificationState,
    verificationRequiredForProduction: true,
    unverifiedHandoffsAllowed: testingOnly === true,
    warning,
    message: readinessMessage,
    wordpressConfig: JSON.parse(packageJson),
    packageSnippet: packageJson,
    snippetLabel: "WordPress plugin package JSON",
    instructions: [
      ...(testingOnly
        ? [
            "This WordPress package is for local/dev/test only while DNS TXT verification is still pending for production launch.",
          ]
        : []),
      "Upload and activate the private AIHQ Website Chat WordPress plugin on the target WordPress site.",
      "Open Settings > AIHQ Website Chat in WordPress admin.",
    ],
    readiness: {
      status: testingOnly ? "testing_only" : "ready",
      message: readinessMessage,
      productionInstallReady: testingOnly !== true,
      productionReady: testingOnly !== true,
      testingOnly,
      verificationState,
      verifiedAt: verified ? "2026-04-10T10:30:00.000Z" : null,
      targetDomain: "acme.example",
      verifiedDomain,
      verificationRequiredForProduction: true,
      unverifiedHandoffsAllowed: testingOnly === true,
      warning,
    },
    packageText: packageJson,
  };
}

function renderDrawer(props = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <WebsiteWidgetDetailDrawer
        channel={{
          id: "website",
          name: "Website chat",
        }}
        open
        onClose={vi.fn()}
        {...props}
      />
    </QueryClientProvider>
  );
}

describe("WebsiteWidgetDetailDrawer", () => {
  beforeEach(() => {
    useWorkspaceTenantKey.mockReturnValue({
      tenantKey: "acme",
      loading: false,
      ready: true,
    });
    getWebsiteWidgetStatus.mockResolvedValue(buildStatusPayload());
    saveWebsiteWidgetConfig.mockResolvedValue({
      ok: true,
      widget: {
        enabled: true,
        title: "Acme Clinic",
        subtitle: "Chat with Acme support from the website.",
        accentColor: "#0f172a",
        allowedOrigins: ["https://www.acme.example"],
        allowedDomains: ["acme.example"],
        initialPrompts: ["What services do you offer?"],
      },
    });
    createWebsiteDomainVerificationChallenge.mockResolvedValue({
      ok: true,
      state: "pending",
      verified: false,
      method: "dns_txt",
      domain: "acme.example",
      candidateDomain: "acme.example",
      candidateDomains: ["acme.example", "www.acme.example"],
      challengeVersion: 1,
      challenge: {
        type: "TXT",
        name: "_aihq-webchat.acme.example",
        value: "aihq-webchat-verification=test-token",
      },
      lastCheckedAt: null,
      verifiedAt: null,
      reasonCode: "dns_txt_challenge_created",
      message:
        "Publish the TXT record for this domain, then run verification after DNS propagates.",
    });
    checkWebsiteDomainVerification.mockResolvedValue({
      ok: true,
      state: "verified",
      verified: true,
      method: "dns_txt",
      domain: "acme.example",
      candidateDomain: "acme.example",
      candidateDomains: ["acme.example", "www.acme.example"],
      challengeVersion: 1,
      challenge: {
        type: "TXT",
        name: "_aihq-webchat.acme.example",
        value: "aihq-webchat-verification=test-token",
      },
      lastCheckedAt: "2026-04-10T10:30:00.000Z",
      verifiedAt: "2026-04-10T10:30:00.000Z",
      reasonCode: "dns_txt_verified",
      message: "DNS TXT ownership has been verified for this domain.",
    });
    getWebsiteDomainVerificationStatus.mockResolvedValue({
      ...buildDomainVerificationPayload(),
      domain: "acme.example",
    });
    createWebsiteWidgetInstallHandoff.mockResolvedValue(
      buildInstallHandoffPayload()
    );
    createWebsiteWidgetGtmInstallHandoff.mockResolvedValue(
      buildGtmInstallHandoffPayload()
    );
    createWebsiteWidgetWordpressInstallHandoff.mockResolvedValue(
      buildWordpressInstallHandoffPayload()
    );

    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    getWebsiteWidgetStatus.mockReset();
    saveWebsiteWidgetConfig.mockReset();
    getWebsiteDomainVerificationStatus.mockReset();
    createWebsiteDomainVerificationChallenge.mockReset();
    checkWebsiteDomainVerification.mockReset();
    createWebsiteWidgetGtmInstallHandoff.mockReset();
    createWebsiteWidgetInstallHandoff.mockReset();
    createWebsiteWidgetWordpressInstallHandoff.mockReset();
  });

  it("loads the trusted install config and shows the public embed details", async () => {
    getWebsiteWidgetStatus.mockResolvedValueOnce(buildStatusPayload({ verified: true }));
    renderDrawer();

    expect(await screen.findByText("Install-safe website chat")).toBeInTheDocument();
    expect(
      await screen.findByDisplayValue(/data-widget-id="ww_acme_widget"/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Public widget ID")).toBeInTheDocument();
    expect(screen.getAllByText("ww_acme_widget").length).toBeGreaterThan(0);
    expect(screen.getByText(/loader-signed install token/i)).toBeInTheDocument();
    const verificationSection = screen.getByText("DNS TXT ownership").closest("section");
    expect(verificationSection).not.toBeNull();
    expect(
      within(verificationSection).getByDisplayValue("acme.example")
    ).toBeInTheDocument();
  });

  it("blocks production install actions until domain ownership is verified", async () => {
    renderDrawer();

    expect(
      await screen.findByText("Production install blocked")
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "Create and verify a DNS TXT challenge for this domain before Website Chat can be installed on the public website."
      ).length
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: /copy snippet/i })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /prepare developer install/i })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /install with gtm/i })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /install on wordpress/i })
    ).toBeDisabled();
  });

  it("allows testing handoffs while keeping the public snippet blocked when unverified handoffs are allowed", async () => {
    getWebsiteWidgetStatus.mockResolvedValueOnce(
      buildStatusPayload({
        verified: false,
        unverifiedHandoffsAllowed: true,
      })
    );
    createWebsiteWidgetWordpressInstallHandoff.mockResolvedValueOnce(
      buildWordpressInstallHandoffPayload({
        verified: false,
        testingOnly: true,
        verificationState: "unverified",
      })
    );
    renderDrawer();

    const installSection = (
      await screen.findByText("Embed this widget on the public website")
    ).closest("section");
    expect(installSection).not.toBeNull();

    expect(
      screen.getByRole("button", { name: /copy snippet/i })
    ).toBeDisabled();

    const developerButton = within(installSection).getByRole("button", {
      name: /prepare developer install/i,
    });
    const gtmButton = within(installSection).getByRole("button", {
      name: /install with gtm/i,
    });
    const wordpressButton = within(installSection).getByRole("button", {
      name: /install on wordpress/i,
    });

    await waitFor(() => expect(developerButton).toBeEnabled());
    expect(gtmButton).toBeEnabled();
    expect(wordpressButton).toBeEnabled();
    expect(
      within(installSection).getByText(
        /local\/dev\/test only\. dns txt verification is still required before public launch/i
      )
    ).toBeInTheDocument();

    fireEvent.click(wordpressButton);

    await waitFor(() =>
      expect(createWebsiteWidgetWordpressInstallHandoff).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: "acme.example",
        }),
        expect.anything()
      )
    );

    expect(
      await within(installSection).findByText("Testing-only package")
    ).toBeInTheDocument();
    expect(
      within(installSection).getByDisplayValue(/"testingOnly": true/i)
    ).toBeInTheDocument();
  });

  it("saves tenant-managed widget settings without leaving the drawer", async () => {
    renderDrawer();

    const subtitleInput = await screen.findByDisplayValue(
      "Ask a question or leave a message for the team."
    );
    fireEvent.change(subtitleInput, {
      target: {
        value: "Chat with Acme support from the website.",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /save widget config/i }));

    await waitFor(() =>
      expect(saveWebsiteWidgetConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          subtitle: "Chat with Acme support from the website.",
          allowedOrigins: ["https://www.acme.example"],
          allowedDomains: ["acme.example"],
        }),
        expect.anything()
      )
    );
  });

  it("creates and checks website domain verification from the existing drawer", async () => {
    renderDrawer();

    expect(
      (
        await screen.findAllByText(
        "Create and verify a DNS TXT challenge for this domain before Website Chat can be installed on the public website."
        )
      ).length
    ).toBeGreaterThan(0);
    const verificationSection = screen.getByText("DNS TXT ownership").closest("section");
    expect(verificationSection).not.toBeNull();
    const createButton = within(verificationSection).getByRole("button", {
      name: /create challenge/i,
    });
    const verifyButton = within(verificationSection).getByRole("button", {
      name: /verify now/i,
    });

    await waitFor(() => expect(createButton).toBeEnabled());

    fireEvent.click(createButton);

    await waitFor(() =>
      expect(createWebsiteDomainVerificationChallenge).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: "acme.example",
        }),
        expect.anything()
      )
    );

    expect(
      await within(verificationSection).findByDisplayValue(
        "aihq-webchat-verification=test-token"
      )
    ).toBeInTheDocument();

    await waitFor(() => expect(verifyButton).toBeEnabled());
    fireEvent.click(verifyButton);

    await waitFor(() =>
      expect(checkWebsiteDomainVerification).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: "acme.example",
        }),
        expect.anything()
      )
    );

    expect(
      await within(verificationSection).findByText(
        "DNS TXT ownership has been verified for this domain."
      )
    ).toBeInTheDocument();
  });

  it("prepares a developer install package when production install is ready", async () => {
    getWebsiteWidgetStatus.mockResolvedValueOnce(buildStatusPayload({ verified: true }));
    renderDrawer();

    expect(await screen.findByText("Install-safe website chat")).toBeInTheDocument();

    const installSection = screen
      .getByText("Embed this widget on the public website")
      .closest("section");
    expect(installSection).not.toBeNull();

    const prepareButton = within(installSection).getByRole("button", {
      name: /prepare developer install/i,
    });

    await waitFor(() => expect(prepareButton).toBeEnabled());
    fireEvent.click(prepareButton);

    await waitFor(() =>
      expect(createWebsiteWidgetInstallHandoff).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: "acme.example",
        }),
        expect.anything()
      )
    );

    expect(
      await within(installSection).findByDisplayValue(
        /Website Chat developer install handoff/i
      )
    ).toBeInTheDocument();

    fireEvent.click(
      within(installSection).getByRole("button", {
        name: /copy install package/i,
      })
    );

    await waitFor(() =>
      expect(window.navigator.clipboard.writeText).toHaveBeenCalledWith(
        buildInstallHandoffPayload().packageText
      )
    );
  });

  it("prepares a GTM install package when production install is ready", async () => {
    getWebsiteWidgetStatus.mockResolvedValueOnce(buildStatusPayload({ verified: true }));
    renderDrawer();

    const installSection = (
      await screen.findByText("Embed this widget on the public website")
    ).closest("section");
    expect(installSection).not.toBeNull();

    const gtmButton = within(installSection).getByRole("button", {
      name: /install with gtm/i,
    });

    await waitFor(() => expect(gtmButton).toBeEnabled());
    fireEvent.click(gtmButton);

    await waitFor(() =>
      expect(createWebsiteWidgetGtmInstallHandoff).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: "acme.example",
        }),
        expect.anything()
      )
    );

    expect(
      await within(installSection).findByDisplayValue(
        /Website Chat GTM install handoff/i
      )
    ).toBeInTheDocument();

    expect(
      within(installSection).getAllByText("Website Chat GTM install handoff").length
    ).toBeGreaterThan(0);
  });

  it("prepares a WordPress install package when production install is ready", async () => {
    getWebsiteWidgetStatus.mockResolvedValueOnce(buildStatusPayload({ verified: true }));
    renderDrawer();

    const installSection = (
      await screen.findByText("Embed this widget on the public website")
    ).closest("section");
    expect(installSection).not.toBeNull();

    const wordpressButton = within(installSection).getByRole("button", {
      name: /install on wordpress/i,
    });

    await waitFor(() => expect(wordpressButton).toBeEnabled());
    fireEvent.click(wordpressButton);

    await waitFor(() =>
      expect(createWebsiteWidgetWordpressInstallHandoff).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: "acme.example",
        }),
        expect.anything()
      )
    );

    expect(
      await within(installSection).findByDisplayValue(
        /"packageType": "wordpress"/i
      )
    ).toBeInTheDocument();

    expect(
      within(installSection).getAllByText("Website Chat WordPress install package").length
    ).toBeGreaterThan(0);
  });
});
