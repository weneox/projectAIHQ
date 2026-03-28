import { cleanup, render, screen } from "@testing-library/react";
import { Outlet } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./lib/appEntry.js", () => ({
  INTERNAL_ONLY_APP_ROUTES: ["/command-demo", "/analytics", "/agents", "/threads"],
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
vi.mock("./pages/Executions.jsx", () => ({
  default: () => <div>Executions Page</div>,
}));
vi.mock("./pages/Settings.jsx", () => ({
  default: () => <div>Settings Page</div>,
}));
vi.mock("./pages/Inbox.jsx", () => ({
  default: () => <div>Inbox Page</div>,
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

describe("App critical route smoke", () => {
  it.each([
    ["/", "App Entry Redirect"],
    ["/setup/studio", "Setup Studio Route"],
    ["/truth", "Truth Page"],
    ["/settings", "Settings Page"],
    ["/inbox", "Inbox Page"],
    ["/incidents", "Incidents Page"],
    ["/leads", "Leads Page"],
    ["/proposals", "Proposals Page"],
  ])("loads %s without a blank screen", async (path, text) => {
    window.history.pushState({}, "", path);
    render(<App />);
    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it.each([
    ["/command-demo"],
    ["/analytics"],
    ["/agents"],
    ["/threads"],
  ])("redirects %s back to the production product surface by default", async (path) => {
    window.history.pushState({}, "", path);
    render(<App />);
    expect(await screen.findByText("Truth Page")).toBeInTheDocument();
  });
});
