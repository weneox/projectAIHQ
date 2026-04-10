import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getWebsiteWidgetStatus = vi.fn();
const saveWebsiteWidgetConfig = vi.fn();
const getWebsiteDomainVerificationStatus = vi.fn();
const createWebsiteDomainVerificationChallenge = vi.fn();
const checkWebsiteDomainVerification = vi.fn();
const useWorkspaceTenantKey = vi.fn();

vi.mock("../../api/channelConnect.js", () => ({
  checkWebsiteDomainVerification: (...args) =>
    checkWebsiteDomainVerification(...args),
  createWebsiteDomainVerificationChallenge: (...args) =>
    createWebsiteDomainVerificationChallenge(...args),
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

function buildStatusPayload({ verified = false } = {}) {
  const domainVerification = buildDomainVerificationPayload({ verified, state: verified ? "verified" : "unverified" });
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
});
