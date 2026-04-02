import { cleanup, render, screen } from "@testing-library/react";
import { Outlet } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const isLocalWorkspaceEntryEnabled = vi.fn();

vi.mock("./lib/appEntry.js", () => ({
  INTERNAL_ONLY_APP_ROUTES: ["/command-demo", "/analytics", "/agents", "/threads"],
  isLocalWorkspaceEntryEnabled: (...args) => isLocalWorkspaceEntryEnabled(...args),
}));

vi.mock("./components/layout/Shell.jsx", () => ({
  default: function ShellMock() {
    return (
      <div data-testid="shell-layout">
        <Outlet />
      </div>
    );
  },
}));

vi.mock("./components/admin/AdminShell.jsx", () => ({
  default: function AdminShellMock() {
    return (
      <div data-testid="admin-shell">
        <Outlet />
      </div>
    );
  },
}));

vi.mock("./components/admin/AdminRouteGuard.jsx", () => ({
  default: function AdminRouteGuardMock({ children }) {
    return children;
  },
}));

vi.mock("./components/auth/UserRouteGuard.jsx", () => ({
  default: function UserRouteGuardMock({ children }) {
    return children;
  },
}));

vi.mock("./components/auth/OperatorRouteGuard.jsx", () => ({
  default: function OperatorRouteGuardMock({ children }) {
    return children;
  },
}));

vi.mock("./components/guards/GuestRouteGuard.jsx", () => ({
  default: function GuestRouteGuardMock({ children }) {
    return children;
  },
}));

vi.mock("./components/auth/AppEntryRedirect.jsx", () => ({
  default: () => <div>App Entry Redirect</div>,
}));

vi.mock("./pages/Proposals.jsx", () => ({
  default: () => <div>Proposals Page</div>,
}));
vi.mock("./pages/Publish.jsx", () => ({
  default: () => <div>Publish Page</div>,
}));
vi.mock("./pages/Executions.jsx", () => ({
  default: () => <div>Executions Page</div>,
}));
vi.mock("./pages/Expert.jsx", () => ({
  default: () => <div>Expert Page</div>,
}));
vi.mock("./pages/Settings.jsx", () => ({
  default: () => <div>Settings Page</div>,
}));
vi.mock("./pages/Inbox.jsx", () => ({
  default: () => <div>Inbox Page</div>,
}));
vi.mock("./surfaces/workspace/WorkspacePage.jsx", () => ({
  default: () => <div>Workspace Page</div>,
}));
vi.mock("./pages/Leads.jsx", () => ({
  default: () => <div>Leads Page</div>,
}));
vi.mock("./pages/Comments.jsx", () => ({
  default: () => <div>Comments Page</div>,
}));
vi.mock("./pages/Incidents.jsx", () => ({
  default: () => <div>Incidents Page</div>,
}));
vi.mock("./pages/Voice.jsx", () => ({
  default: () => <div>Voice Page</div>,
}));
vi.mock("./pages/Login.jsx", () => ({
  default: () => <div>Login Page</div>,
}));
vi.mock("./pages/Truth/TruthViewerPage.jsx", () => ({
  default: () => <div>Truth Page</div>,
}));
vi.mock("./pages/AdminLogin.jsx", () => ({
  default: () => <div>Admin Login Page</div>,
}));
vi.mock("./pages/AdminTenants.jsx", () => ({
  default: () => <div>Admin Tenants Page</div>,
}));
vi.mock("./pages/AdminTeam.jsx", () => ({
  default: () => <div>Admin Team Page</div>,
}));
vi.mock("./pages/AdminSecrets.jsx", () => ({
  default: () => <div>Admin Secrets Page</div>,
}));
vi.mock("./pages/SetupStudio/index.jsx", () => ({
  default: () => <div>Setup Studio Route</div>,
}));

import App from "./App.jsx";

afterEach(() => {
  cleanup();
});

describe("App primary product route smoke", () => {
  beforeEach(() => {
    isLocalWorkspaceEntryEnabled.mockReturnValue(false);
  });

  it.each([
    ["/", "App Entry Redirect"],
    ["/workspace", "Workspace Page"],
    ["/inbox", "Inbox Page"],
    ["/publish", "Publish Page"],
    ["/expert", "Expert Page"],
  ])("loads %s through the authenticated shell", async (path, text) => {
    window.history.pushState({}, "", path);
    render(<App />);
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it.each([
    ["/truth", "Truth Page"],
    ["/settings", "Settings Page"],
    ["/comments", "Comments Page"],
    ["/proposals", "Proposals Page"],
    ["/setup", "Setup Studio Route"],
  ])("keeps legacy route %s available", async (path, text) => {
    window.history.pushState({}, "", path);
    render(<App />);
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it.each([
    ["/command-demo"],
    ["/analytics"],
    ["/agents"],
    ["/threads"],
  ])("redirects internal-only route %s back to workspace", async (path) => {
    window.history.pushState({}, "", path);
    render(<App />);
    expect(await screen.findByText("Workspace Page")).toBeInTheDocument();
  });

  it("keeps setup studio reachable when local workspace entry is enabled", async () => {
    isLocalWorkspaceEntryEnabled.mockReturnValue(true);
    window.history.pushState({}, "", "/setup");

    render(<App />);

    expect(await screen.findByText("Setup Studio Route")).toBeInTheDocument();
  });
});

