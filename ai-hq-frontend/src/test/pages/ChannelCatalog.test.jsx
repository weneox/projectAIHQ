import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import ChannelCatalog from "../../pages/ChannelCatalog.jsx";

vi.mock("../../api/channelConnect.js", () => ({
  checkWebsiteDomainVerification: vi.fn(async () => ({ ok: true })),
  connectTelegramChannel: vi.fn(async () => ({ ok: true })),
  createWebsiteDomainVerificationChallenge: vi.fn(async () => ({ ok: true })),
  createWebsiteWidgetGtmInstallHandoff: vi.fn(async () => ({ ok: true })),
  createWebsiteWidgetInstallHandoff: vi.fn(async () => ({ ok: true })),
  createWebsiteWidgetTestMessage: vi.fn(async () => ({ ok: true })),
  createWebsiteWidgetWordpressInstallHandoff: vi.fn(async () => ({ ok: true })),
  disconnectMetaChannel: vi.fn(async () => ({ ok: true })),
  disconnectTelegramChannel: vi.fn(async () => ({ ok: true })),
  getMetaChannelStatus: vi.fn(async () => ({
    ok: true,
    connected: false,
    status: "blocked",
    readiness: {
      status: "blocked",
      message: "Instagram DM automation is blocked until prerequisites are repaired.",
    },
  })),
  getMetaConnectUrl: vi.fn(async () => ({
    ok: true,
    url: "https://example.com/meta-connect",
  })),
  getTelegramChannelStatus: vi.fn(async () => ({
    ok: false,
    error: "Not found",
    code: "surface_frozen",
    surface: "telegram",
  })),
  getWebsiteDomainVerificationStatus: vi.fn(async () => ({ ok: true })),
  getWebsiteWidgetStatus: vi.fn(async () => ({
    ok: true,
    connected: true,
    deliveryReady: true,
    status: "ready",
    widget: {
      enabled: true,
      publicWidgetId: "test-widget",
      title: "Website chat",
      subtitle: "Ask a question or leave a message for the team.",
      allowedOrigins: ["https://example.com"],
      allowedDomains: ["example.com"],
      initialPrompts: ["How can you help me?"],
    },
    websiteUrl: "https://example.com",
    launchReadiness: {
      status: "production_ready",
      productionReady: true,
      productionLaunchAllowed: true,
      targetDomain: "example.com",
      message: "Website chat is ready.",
    },
    domainVerification: {
      domain: "example.com",
      state: "verified",
      verified: true,
    },
  })),
  saveWebsiteWidgetConfig: vi.fn(async () => ({ ok: true })),
  selectMetaChannelCandidate: vi.fn(async () => ({ ok: true })),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ChannelCatalog", () => {
  function renderPage() {
    return render(
      <MemoryRouter initialEntries={["/channels"]}>
        <ChannelCatalog />
      </MemoryRouter>
    );
  }

  it("renders the current v1 channel catalog", async () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: /^channel catalog$/i })
    ).toBeInTheDocument();

    expect(document.body).toHaveTextContent(/website chat/i);
    expect(document.body).toHaveTextContent(/instagram/i);
    expect(document.body).toHaveTextContent(/facebook/i);
    expect(document.body).toHaveTextContent(/telegram/i);
    expect(document.body).toHaveTextContent(/whatsapp/i);
    expect(document.body).toHaveTextContent(/email/i);

    await waitFor(() => {
      expect(document.body).toHaveTextContent(/backend readiness/i);
    });
  });

  it("opens the channel connect modal from a channel card", async () => {
    renderPage();

    const websiteCardTitle = await screen.findByRole("heading", {
      name: /^website chat$/i,
    });

    fireEvent.click(websiteCardTitle.closest("article"));

    expect(document.body).toHaveTextContent(/channel connect/i);
    expect(document.body).toHaveTextContent(/backend truth/i);
    expect(document.body).toHaveTextContent(/widget configuration/i);
    expect(document.body).toHaveTextContent(/domain verification/i);
    expect(document.body).toHaveTextContent(/install handoffs/i);
    expect(screen.getByRole("button", { name: /^close$/i })).toBeInTheDocument();
  });
});
