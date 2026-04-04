import { cleanup, render, screen } from "@testing-library/react";
import { Outlet } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import App from "../App.jsx";

afterEach(() => {
  cleanup();
});

describe("App shell smoke", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("renders the root app entry surface", async () => {
    render(<App />);
    expect(await screen.findByText("App Entry Redirect")).toBeInTheDocument();
  });

  it.each([
    ["/login", "Login Page"],
    ["/admin/login", "Admin Login Page"],
    ["/select-workspace", "Select Workspace Page"],
  ])("renders %s from the top-level route tree", async (path, text) => {
    window.history.replaceState({}, "", path);
    render(<App />);
    expect(await screen.findByText(text)).toBeInTheDocument();
  });
});
