import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach, vi } from "vitest";

const navigate = vi.fn();
const loginUser = vi.fn();
const selectWorkspaceUser = vi.fn();
const getAppAuthContext = vi.fn();
const logoutUser = vi.fn();
const clearAppSessionContext = vi.fn();

vi.mock("framer-motion", () => ({
  motion: {
    section: ({ children, ...props }) => <section {...props}>{children}</section>,
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
    button: ({ children, ...props }) => <button {...props}>{children}</button>,
  },
  useMotionTemplate: () => "",
  useMotionValue: () => ({ set: vi.fn() }),
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

  it("renders a two-field login without workspace, remember, or reset controls", async () => {
    renderLogin();

    expect(await screen.findByPlaceholderText("name@company.com")).toBeInTheDocument();
    expect(getAppAuthContext).toHaveBeenCalledTimes(1);
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("company-name")).not.toBeInTheDocument();
    expect(screen.queryByText("Remember")).not.toBeInTheDocument();
    expect(screen.queryByText("Reset")).not.toBeInTheDocument();
  });

  it("shows workspace selection on ambiguity and resubmits with the chosen account token", async () => {
    loginUser
      .mockRejectedValueOnce(
        Object.assign(new Error("Multiple accounts"), {
          code: "multiple_memberships",
          payload: {
            code: "multiple_memberships",
            memberships: [
              {
                selectionToken: "token-acme",
                tenantKey: "acme",
                companyName: "Acme Clinic",
                role: "owner",
                authProvider: "local",
                passwordReady: true,
                workspaceReady: true,
                setupRequired: false,
              },
              {
                selectionToken: "token-globex",
                tenantKey: "globex",
                companyName: "Globex",
                role: "operator",
                authProvider: "local",
                passwordReady: true,
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

    fireEvent.change(await screen.findByPlaceholderText("name@company.com"), {
      target: { name: "email", value: "shared@company.test" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { name: "password", value: "secret-pass" },
    });

    fireEvent.click(screen.getByRole("button", { name: /open session/i }));

    expect(await screen.findByText("Select workspace")).toBeInTheDocument();
    expect(screen.getByText("Setup required")).toBeInTheDocument();
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

  it("routes single-workspace setup-incomplete login into setup", async () => {
    loginUser.mockResolvedValueOnce({
      ok: true,
      authenticated: true,
      destination: { path: "/setup/studio" },
      workspace: { setupRequired: true },
    });

    renderLogin();

    fireEvent.change(await screen.findByPlaceholderText("name@company.com"), {
      target: { name: "email", value: "owner@company.test" },
    });
    fireEvent.change(screen.getByPlaceholderText("Password"), {
      target: { name: "password", value: "secret-pass" },
    });

    fireEvent.click(screen.getByRole("button", { name: /open session/i }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/setup/studio", { replace: true });
    });
  });

  it("shows service-unavailable messaging on auth load failure", async () => {
    getAppAuthContext.mockRejectedValueOnce(new Error("Failed to fetch"));

    renderLogin();

    expect(await screen.findByText("Service unavailable")).toBeInTheDocument();
    expect(
      screen.getByText("Authentication is temporarily unavailable. Try again shortly.")
    ).toBeInTheDocument();
  });
});
