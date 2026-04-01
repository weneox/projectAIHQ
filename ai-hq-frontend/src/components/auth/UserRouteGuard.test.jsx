import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAppAuthContext = vi.fn();
const getAppBootstrapContext = vi.fn();
const isLocalWorkspaceEntryEnabled = vi.fn();

vi.mock("../../lib/appSession.js", () => ({
  getAppAuthContext: (...args) => getAppAuthContext(...args),
  getAppBootstrapContext: (...args) => getAppBootstrapContext(...args),
}));

vi.mock("../../lib/appEntry.js", () => ({
  isLocalWorkspaceEntryEnabled: (...args) => isLocalWorkspaceEntryEnabled(...args),
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
    getAppBootstrapContext.mockResolvedValue({
      workspace: {
        setupCompleted: true,
        destination: { path: "/workspace" },
      },
    });
  });

  it("checks only shared auth context before rendering children", async () => {
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
    expect(getAppBootstrapContext).toHaveBeenCalledTimes(1);
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

  it("redirects authenticated users into setup when the active workspace is incomplete", async () => {
    getAppAuthContext.mockResolvedValue({
      authenticated: true,
      user: { email: "owner@acme.test" },
    });
    getAppBootstrapContext.mockResolvedValue({
      workspace: {
        setupCompleted: false,
        destination: { path: "/setup/studio" },
      },
    });

    render(
      <MemoryRouter initialEntries={["/workspace"]}>
        <UserRouteGuard>
          <div>Protected workspace</div>
        </UserRouteGuard>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("navigate")).toHaveTextContent("/setup/studio");
    });
  });

  it("redirects ready workspaces away from setup routes", async () => {
    getAppAuthContext.mockResolvedValue({
      authenticated: true,
      user: { email: "owner@acme.test" },
    });
    getAppBootstrapContext.mockResolvedValue({
      workspace: {
        setupCompleted: true,
        destination: { path: "/workspace" },
      },
    });

    render(
      <MemoryRouter initialEntries={["/setup/studio"]}>
        <UserRouteGuard>
          <div>Protected workspace</div>
        </UserRouteGuard>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId("navigate")).toHaveTextContent("/workspace");
    });
  });
});
