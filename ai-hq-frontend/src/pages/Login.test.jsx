import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
const loginUser = vi.fn();
const selectWorkspaceUser = vi.fn();
const getAppAuthContext = vi.fn();
const logoutUser = vi.fn();
const clearAppSessionContext = vi.fn();

vi.mock("framer-motion", () => ({
  motion: {
    button: ({ children, ...props }) => <button {...props}>{children}</button>,
  },
}));

vi.mock("../api/auth.js", () => ({
  loginUser: (...args) => loginUser(...args),
  selectWorkspaceUser: (...args) => selectWorkspaceUser(...args),
  logoutUser: (...args) => logoutUser(...args),
}));

vi.mock("../lib/appSession.js", () => ({
  getAppAuthContext: (...args) => getAppAuthContext(...args),
  clearAppSessionContext: (...args) => clearAppSessionContext(...args),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

import Login from "./Login.jsx";

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Login />
    </MemoryRouter>
  );
}

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAppAuthContext.mockResolvedValue({ authenticated: false });
    loginUser.mockResolvedValue({
      ok: true,
      authenticated: true,
      destination: { path: "/workspace" },
    });
    selectWorkspaceUser.mockResolvedValue({
      ok: true,
      authenticated: true,
      destination: { path: "/workspace" },
    });
    logoutUser.mockResolvedValue({ ok: true });
    clearAppSessionContext.mockImplementation(() => {});
  });

  it("renders canonical email and password sign-in fields", async () => {
    renderLogin();

    expect(await screen.findByPlaceholderText("Enter email address")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter password")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("company-name")).not.toBeInTheDocument();
  });

  it("keeps an anonymous visitor on the login page after auth context settles", async () => {
    getAppAuthContext.mockResolvedValueOnce({ authenticated: false });

    renderLogin();

    expect(await screen.findByPlaceholderText("Enter email address")).toBeInTheDocument();

    await waitFor(() => {
      expect(getAppAuthContext).toHaveBeenCalled();
    });

    expect(navigate).not.toHaveBeenCalledWith("/setup/studio", { replace: true });
    expect(navigate).not.toHaveBeenCalledWith("/workspace", { replace: true });
  });

  it("auto-lands a genuinely authenticated user on the setup route from the workspace contract", async () => {
    getAppAuthContext.mockResolvedValueOnce({
      authenticated: true,
      workspace: {
        setupCompleted: false,
        setupRequired: true,
        workspaceReady: false,
        routeHint: "/setup/studio",
        nextSetupRoute: "/setup/studio",
        destination: { path: "/setup/studio" },
      },
    });

    renderLogin();

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/setup/studio", { replace: true });
    });
  });

  it("shows workspace selection on ambiguity and resubmits with the chosen membership token", async () => {
    loginUser.mockRejectedValueOnce(
      Object.assign(new Error("Multiple workspaces"), {
        code: "multiple_memberships",
        payload: {
          code: "multiple_memberships",
          memberships: [
            {
              selectionToken: "token-acme",
              tenantKey: "acme",
              companyName: "Acme Clinic",
              role: "owner",
              workspaceReady: true,
              setupRequired: false,
            },
            {
              selectionToken: "token-globex",
              tenantKey: "globex",
              companyName: "Globex",
              role: "operator",
              workspaceReady: false,
              setupRequired: true,
            },
          ],
        },
      })
    );
    selectWorkspaceUser.mockResolvedValueOnce({
      ok: true,
      authenticated: true,
      destination: { path: "/setup/studio" },
    });

    renderLogin();

    fireEvent.change(await screen.findByPlaceholderText("Enter email address"), {
      target: { name: "email", value: "shared@company.test" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter password"), {
      target: { name: "password", value: "secret-pass" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Select your workspace to continue.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /globex/i }));
    fireEvent.click(screen.getByRole("button", { name: /open selected workspace/i }));

    await waitFor(() => {
      expect(selectWorkspaceUser).toHaveBeenLastCalledWith({
        email: "shared@company.test",
        password: "secret-pass",
        tenantKey: undefined,
        accountSelectionToken: "token-globex",
      });
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/setup/studio", { replace: true });
    });
  });

  it("routes a ready single-workspace login to the backend destination", async () => {
    getAppAuthContext
      .mockResolvedValueOnce({ authenticated: false })
      .mockResolvedValueOnce({
        authenticated: true,
        workspace: {
          setupCompleted: true,
          setupRequired: false,
          workspaceReady: true,
          routeHint: "/workspace",
          destination: { path: "/workspace" },
        },
      });
    loginUser.mockResolvedValueOnce({
      ok: true,
      authenticated: true,
      workspace: {
        setupCompleted: true,
        setupRequired: false,
        workspaceReady: true,
        routeHint: "/workspace",
        destination: { path: "/workspace" },
      },
      destination: { path: "/workspace" },
    });

    renderLogin();

    fireEvent.change(await screen.findByPlaceholderText("Enter email address"), {
      target: { name: "email", value: "owner@company.test" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter password"), {
      target: { name: "password", value: "secret-pass" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/workspace", { replace: true });
    });
  });

  it("sends users to signup from the footer action", async () => {
    renderLogin();

    fireEvent.click(await screen.findByRole("button", { name: "Sign up" }));

    expect(navigate).toHaveBeenCalledWith("/signup");
  });
});
