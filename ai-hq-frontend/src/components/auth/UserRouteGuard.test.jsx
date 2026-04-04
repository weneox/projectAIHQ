import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAppAuthContext = vi.fn();
const isLocalWorkspaceEntryEnabled = vi.fn();
const isWorkspaceSelectionPath = vi.fn();

vi.mock("../../lib/appSession.js", () => ({
  getAppAuthContext: (...args) => getAppAuthContext(...args),
}));

vi.mock("../../lib/appEntry.js", () => ({
  isLocalWorkspaceEntryEnabled: (...args) => isLocalWorkspaceEntryEnabled(...args),
  isWorkspaceSelectionPath: (...args) => isWorkspaceSelectionPath(...args),
}));

vi.mock("../loading/AppBootSurface.jsx", () => ({
  default: ({ label, detail }) => (
    <div>
      {label}
      {detail}
    </div>
  ),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    Navigate: ({ to }) => <div data-testid="navigate">{to}</div>,
  };
});

import UserRouteGuard from "./UserRouteGuard.jsx";

describe("UserRouteGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isLocalWorkspaceEntryEnabled.mockReturnValue(false);
    isWorkspaceSelectionPath.mockReturnValue(false);
  });

  it("checks shared auth context before rendering children", async () => {
    getAppAuthContext.mockResolvedValue({
      authenticated: true,
      user: { email: "owner@acme.test" },
    });

    render(
      <MemoryRouter initialEntries={["/workspace"]}>
        <UserRouteGuard>
          <div>Protected workspace</div>
        </UserRouteGuard>
      </MemoryRouter>
    );

    expect(screen.getByText(/Preparing workspace/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Protected workspace")).toBeInTheDocument();
    });

    expect(getAppAuthContext).toHaveBeenCalledTimes(1);
  });

  it("keeps setup compatibility routes reachable when local workspace entry mode is enabled", async () => {
    isLocalWorkspaceEntryEnabled.mockReturnValue(true);

    render(
      <MemoryRouter initialEntries={["/setup"]}>
        <UserRouteGuard>
          <div>Local setup route</div>
        </UserRouteGuard>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Local setup route")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
    expect(getAppAuthContext).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users to login", async () => {
    getAppAuthContext.mockResolvedValue({ authenticated: false });

    render(
      <MemoryRouter initialEntries={["/workspace"]}>
        <UserRouteGuard>
          <div>Protected workspace</div>
        </UserRouteGuard>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("navigate")).toHaveTextContent("/login");
    });
  });

  it("shows a controlled unavailable surface on auth loader failure", async () => {
    getAppAuthContext.mockRejectedValue(new Error("auth offline"));

    render(
      <MemoryRouter initialEntries={["/workspace"]}>
        <UserRouteGuard>
          <div>Protected workspace</div>
        </UserRouteGuard>
      </MemoryRouter>
    );

    expect(
      await screen.findByText((content) => content.includes("Workspace unavailable"))
    ).toBeInTheDocument();

    expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
  });

  it("allows the workspace selection route when auth is valid", async () => {
    isWorkspaceSelectionPath.mockReturnValue(true);
    getAppAuthContext.mockResolvedValue({
      authenticated: true,
      user: { email: "owner@acme.test" },
    });

    render(
      <MemoryRouter initialEntries={["/select-workspace"]}>
        <UserRouteGuard>
          <div>Select workspace</div>
        </UserRouteGuard>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Select workspace")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
  });

  it("allows authenticated users through without setup-specific redirects", async () => {
    getAppAuthContext.mockResolvedValue({
      authenticated: true,
      user: { email: "owner@acme.test" },
    });

    render(
      <MemoryRouter initialEntries={["/workspace"]}>
        <UserRouteGuard>
          <div>Protected workspace</div>
        </UserRouteGuard>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Protected workspace")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("navigate")).not.toBeInTheDocument();
  });
});
