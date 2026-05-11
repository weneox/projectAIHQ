import { cleanup, render, screen } from "@testing-library/react";
import { Outlet } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAppAuthContextMock,
  getAppSessionContextMock,
  peekAppAuthContextMock,
} = vi.hoisted(() => ({
  getAppAuthContextMock: vi.fn(),
  getAppSessionContextMock: vi.fn(async () => ({
    user: { id: "user-1" },
    workspace: { tenantKey: "acme" },
  })),
  peekAppAuthContextMock: vi.fn(),
}));

vi.mock("../lib/appSession.js", () => ({
  getAppAuthContext: getAppAuthContextMock,
  getAppSessionContext: getAppSessionContextMock,
  peekAppAuthContext: peekAppAuthContextMock,
}));

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

    getAppAuthContextMock.mockResolvedValue({
      authenticated: false,
      resolved: true,
      transientFailure: false,
      unavailable: false,
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
});



