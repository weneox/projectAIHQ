import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
const loginUser = vi.fn();
const selectWorkspaceUser = vi.fn();
const signupUser = vi.fn();
const getAppAuthContext = vi.fn();
const getAppBootstrapContext = vi.fn();
const clearAppSessionContext = vi.fn();
const hasMultipleWorkspaceChoices = vi.fn();
const resolveAuthenticatedLanding = vi.fn();
const isWelcomeIdentityComplete = vi.fn();

vi.mock("../api/auth.js", () => ({
  loginUser: (...args) => loginUser(...args),
  selectWorkspaceUser: (...args) => selectWorkspaceUser(...args),
  signupUser: (...args) => signupUser(...args),
}));

vi.mock("../lib/appSession.js", () => ({
  getAppAuthContext: (...args) => getAppAuthContext(...args),
  getAppBootstrapContext: (...args) => getAppBootstrapContext(...args),
  clearAppSessionContext: (...args) => clearAppSessionContext(...args),
}));

vi.mock("../lib/appEntry.js", () => ({
  PRODUCT_HOME_ROUTE: "/home",
  WORKSPACE_SELECTION_ROUTE: "/select-workspace",
  hasMultipleWorkspaceChoices: (...args) => hasMultipleWorkspaceChoices(...args),
  resolveAuthenticatedLanding: (...args) => resolveAuthenticatedLanding(...args),
}));

vi.mock("../lib/welcomeIdentity.js", () => ({
  isWelcomeIdentityComplete: (...args) => isWelcomeIdentityComplete(...args),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

import Login from "./Login.jsx";

function renderRoute(path = "/login") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Login />
    </MemoryRouter>
  );
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("Login auth entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAppAuthContext.mockResolvedValue({ authenticated: false });
    hasMultipleWorkspaceChoices.mockReturnValue(false);
    resolveAuthenticatedLanding.mockReturnValue("/home");
    isWelcomeIdentityComplete.mockReturnValue(true);
    clearAppSessionContext.mockImplementation(() => {});
    getAppBootstrapContext.mockResolvedValue({
      workspace: { setupCompleted: true, workspaceReady: true },
    });
  });

  it("shows a session check before rendering the auth form", async () => {
    const authCheck = createDeferred();
    getAppAuthContext.mockReturnValueOnce(authCheck.promise);

    renderRoute("/login");

    expect(screen.getByText("Checking account")).toBeInTheDocument();

    authCheck.resolve({ authenticated: false });

    expect(
      await screen.findByRole("heading", {
        name: "Log in",
      })
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter email address")).toBeInTheDocument();
  });

  it("redirects an existing authenticated user without welcome identity to the welcome step", async () => {
    getAppAuthContext.mockResolvedValue({ authenticated: true });
    getAppBootstrapContext.mockResolvedValue({
      workspace: { setupCompleted: false, workspaceReady: false },
    });
    isWelcomeIdentityComplete.mockReturnValue(false);

    renderRoute("/login");

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/welcome", { replace: true });
    });
  });

  it("shows workspace selection after an ambiguous login and continues with the chosen account", async () => {
    getAppAuthContext.mockResolvedValue({ authenticated: false });
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
            },
            {
              selectionToken: "token-globex",
              tenantKey: "globex",
              companyName: "Globex",
              role: "operator",
            },
          ],
        },
      })
    );
    selectWorkspaceUser.mockResolvedValueOnce({
      ok: true,
      destination: { path: "/home?assistant=setup" },
    });

    renderRoute("/login");

    fireEvent.change(await screen.findByPlaceholderText("Enter email address"), {
      target: { name: "email", value: "shared@company.test" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter password"), {
      target: { name: "password", value: "secret-pass" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(await screen.findByText("Choose workspace")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /globex/i }));
    fireEvent.click(screen.getByRole("button", { name: /open selected workspace/i }));

    await waitFor(() => {
      expect(selectWorkspaceUser).toHaveBeenCalledWith({
        email: "shared@company.test",
        password: "secret-pass",
        tenantKey: undefined,
        accountSelectionToken: "token-globex",
      });
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/home", { replace: true });
    });
  });

  it("sends a newly authenticated user to welcome before home when welcome identity is incomplete", async () => {
    getAppAuthContext.mockResolvedValue({ authenticated: false });
    loginUser.mockResolvedValueOnce({ ok: true });
    getAppAuthContext.mockResolvedValueOnce({ authenticated: false });
    getAppAuthContext.mockResolvedValueOnce({
      authenticated: true,
      user: { email: "owner@acme.com" },
    });
    getAppBootstrapContext.mockResolvedValueOnce({
      workspace: { setupCompleted: false, workspaceReady: false },
    });
    isWelcomeIdentityComplete.mockReturnValue(false);

    renderRoute("/login");

    fireEvent.change(await screen.findByPlaceholderText("Enter email address"), {
      target: { name: "email", value: "owner@acme.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter password"), {
      target: { name: "password", value: "secret-pass" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/welcome", { replace: true });
    });
  });

  it("creates an account from the signup route and sends the user to verify email", async () => {
    getAppAuthContext.mockResolvedValue({ authenticated: false });
    signupUser.mockResolvedValue({ ok: true });

    renderRoute("/signup");

    fireEvent.change(await screen.findByPlaceholderText("Full name"), {
      target: { name: "fullName", value: "Jane Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("Workspace name"), {
      target: { name: "companyName", value: "Acme Clinic" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter email address"), {
      target: { name: "email", value: "owner@acme.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter password"), {
      target: { name: "password", value: "secret-pass" },
    });

    const submitButton = screen.getByRole("button", { name: "Create workspace" });

    await waitFor(() => {
      expect(submitButton).not.toBeDisabled();
    });

    fireEvent.submit(submitButton.closest("form"));

    await waitFor(() => {
      expect(signupUser).toHaveBeenCalledWith({
        fullName: "Jane Doe",
        companyName: "Acme Clinic",
        email: "owner@acme.com",
        password: "secret-pass",
      });
    });

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/verify-email", {
        replace: true,
        state: { email: "owner@acme.com" },
      });
    });
  });
});
