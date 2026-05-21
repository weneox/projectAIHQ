import { cleanup, render, screen } from "@testing-library/react";
import { Outlet } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAppAuthContextMock,
  getAppBootstrapContextMock,
  getAppSessionContextMock,
  peekAppAuthContextMock,
  peekAppBootstrapContextMock,
} = vi.hoisted(() => ({
  getAppAuthContextMock: vi.fn(),
  getAppBootstrapContextMock: vi.fn(),
  getAppSessionContextMock: vi.fn(async () => ({
    user: { id: "user-1" },
    workspace: { tenantKey: "acme" },
  })),
  peekAppAuthContextMock: vi.fn(),
  peekAppBootstrapContextMock: vi.fn(),
}));

vi.mock("../lib/appSession.js", () => ({
  getAppAuthContext: getAppAuthContextMock,
  getAppBootstrapContext: getAppBootstrapContextMock,
  getAppSessionContext: getAppSessionContextMock,
  peekAppAuthContext: peekAppAuthContextMock,
  peekAppBootstrapContext: peekAppBootstrapContextMock,
}));

vi.mock("../lib/appEntry.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isLocalWorkspaceEntryEnabled: () => false,
  };
});

vi.mock("../components/layout/Shell.jsx", () => ({
  default: function ShellMock() {
    return (
      <div data-testid="shell-layout">
        <Outlet />
      </div>
    );
  },
}));

vi.mock("../components/admin/AdminShell.jsx", () => ({
  default: function AdminShellMock() {
    return (
      <div data-testid="admin-shell">
        <Outlet />
      </div>
    );
  },
}));

vi.mock("../components/admin/AdminRouteGuard.jsx", () => ({
  default: function AdminRouteGuardMock({ children }) {
    return children;
  },
}));

vi.mock("../components/auth/UserRouteGuard.jsx", () => ({
  default: function UserRouteGuardMock({ children }) {
    return children;
  },
}));

vi.mock("../components/auth/OperatorRouteGuard.jsx", () => ({
  default: function OperatorRouteGuardMock({ children }) {
    return children;
  },
}));

vi.mock("../components/auth/AppEntryRedirect.jsx", () => ({
  default: () => <div>App Entry Redirect</div>,
}));

vi.mock("../pages/Login.jsx", () => ({
  default: () => <div>Login Page</div>,
}));

vi.mock("../pages/AdminLogin.jsx", () => ({
  default: () => <div>Admin Login Page</div>,
}));

vi.mock("../pages/SelectWorkspace.jsx", () => ({
  default: () => <div>Select Workspace Page</div>,
}));

vi.mock("../surfaces/home/ProductHomePage.jsx", () => ({
  default: () => <div>Home Page</div>,
}));


vi.mock("../pages/Inbox.jsx", () => ({
  default: () => <div>Inbox Page</div>,
}));

vi.mock("../pages/ChannelCatalog.jsx", () => ({
  default: () => <div>Channels Page</div>,
}));

vi.mock("../pages/VoiceLab.jsx", () => ({
  default: () => <div>Browser voice call</div>,
}));

vi.mock("../pages/VoiceChannels.jsx", () => ({
  default: () => <div>Voice Channels Page</div>,
}));

vi.mock("../pages/Truth/TruthViewerPage.jsx", () => ({
  default: () => <div>Truth Page</div>,
}));

import App from "../App.jsx";

const ROUTE_RENDER_TIMEOUT_MS = 5000;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("App shell smoke", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");

    peekAppAuthContextMock.mockReturnValue(null);
    peekAppBootstrapContextMock.mockReturnValue(null);

    getAppAuthContextMock.mockResolvedValue({
      authenticated: false,
      resolved: true,
      transientFailure: false,
      unavailable: false,
    });
    getAppBootstrapContextMock.mockResolvedValue({
      ok: true,
      features: {
        channels: { voice: true },
      },
    });
  });

  it("renders the root app entry surface", async () => {
    render(<App />);
    expect(await screen.findByText("App Entry Redirect")).toBeInTheDocument();
  });

  it.each([
    ["/login", "Login Page"],
    ["/admin/login", "App Entry Redirect"],
    ["/select-workspace", "Select Workspace Page"],
    ["/welcome", "Home Page"],
  ])("renders %s from the top-level route tree", async (path, text) => {
    window.history.replaceState({}, "", path);
    render(<App />);
    expect(
      await screen.findByText(text, {}, { timeout: ROUTE_RENDER_TIMEOUT_MS })
    ).toBeInTheDocument();
  });

  it.each([
    ["/voice-lab", "Browser voice call"],
    ["/voice-channels", "Voice Channels Page"],
  ])("renders %s when the voice feature is enabled", async (path, text) => {
    window.history.replaceState({}, "", path);
    render(<App />);
    expect(
      await screen.findByText(text, {}, { timeout: ROUTE_RENDER_TIMEOUT_MS })
    ).toBeInTheDocument();
  });

  it("keeps Browser Call reachable for browser testing when backend voice channels are frozen", async () => {
    getAppBootstrapContextMock.mockResolvedValue({
      ok: true,
      features: {
        channels: { voice: false },
      },
    });

    window.history.replaceState({}, "", "/voice-lab");
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Browser voice call" }, { timeout: ROUTE_RENDER_TIMEOUT_MS })
    ).toBeInTheDocument();
  });
});
