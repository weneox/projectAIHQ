import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getWebsiteWidgetStatus = vi.fn();
const saveWebsiteWidgetConfig = vi.fn();

vi.mock("../../api/channelConnect.js", () => ({
  getWebsiteWidgetStatus: (...args) => getWebsiteWidgetStatus(...args),
  saveWebsiteWidgetConfig: (...args) => saveWebsiteWidgetConfig(...args),
}));

import WebsiteWidgetDetailDrawer from "../../components/channels/WebsiteWidgetDetailDrawer.jsx";

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
    getWebsiteWidgetStatus.mockResolvedValue({
      ok: true,
      state: "connected",
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
        embedSnippet:
          '<script src="https://widget.example.test/website-widget-loader.js" data-widget-id="ww_acme_widget" data-api-base="https://api.example.test/api" async></script>',
      },
      readiness: {
        status: "ready",
        message:
          "Website chat is configured with a publishable install ID and trusted origin controls.",
        blockers: [],
      },
    });
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
  });

  it("loads the trusted install config and shows the public embed details", async () => {
    renderDrawer();

    expect(await screen.findByText("Install-safe website chat")).toBeInTheDocument();
    expect(
      await screen.findByDisplayValue(/data-widget-id="ww_acme_widget"/i)
    ).toBeInTheDocument();
    expect(screen.getByText("Public widget ID")).toBeInTheDocument();
    expect(screen.getAllByText("ww_acme_widget").length).toBeGreaterThan(0);
    expect(screen.getByText(/loader-signed install token/i)).toBeInTheDocument();
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
});
