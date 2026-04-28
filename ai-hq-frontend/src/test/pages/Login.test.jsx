import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
const loginUser = vi.fn();
const selectWorkspaceUser = vi.fn();
const signupUser = vi.fn();
const clearAppSessionContext = vi.fn();

vi.mock("../../api/auth.js", () => ({
  loginUser: (...args) => loginUser(...args),
  selectWorkspaceUser: (...args) => selectWorkspaceUser(...args),
  signupUser: (...args) => signupUser(...args),
}));

vi.mock("../../lib/appSession.js", () => ({
  clearAppSessionContext: (...args) => clearAppSessionContext(...args),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

import Login from "../../pages/Login.jsx";

function renderRoute(path = "/login") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Login />
    </MemoryRouter>
  );
}

describe("Login auth entry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAppSessionContext.mockImplementation(() => {});
  });

  it("renders the current sign-in surface", async () => {
    renderRoute("/login");

    expect(
      await screen.findByRole("heading", { name: /sign in/i })
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/email address/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/^password$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^sign in$/i })
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /^gmail$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^outlook$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^apple$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /forgot your password/i })
    ).not.toBeInTheDocument();
  });

  it("shows workspace selection after an ambiguous login and continues with the chosen account", async () => {
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
    selectWorkspaceUser.mockResolvedValueOnce({ ok: true });

    renderRoute("/login");

    fireEvent.change(await screen.findByPlaceholderText(/email address/i), {
      target: { name: "email", value: "shared@company.test" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^password$/i), {
      target: { name: "password", value: "secret-pass" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(await screen.findByText(/choose workspace/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /globex/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /open selected workspace/i })
    );

    await waitFor(() => {
      expect(selectWorkspaceUser).toHaveBeenCalledWith({
        email: "shared@company.test",
        password: "secret-pass",
        tenantKey: undefined,
        accountSelectionToken: "token-globex",
      });
    });

    expect(clearAppSessionContext).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  it("signs a user in and clears cached session context", async () => {
    loginUser.mockResolvedValueOnce({ ok: true });

    renderRoute("/login");

    fireEvent.change(await screen.findByPlaceholderText(/email address/i), {
      target: { name: "email", value: "owner@acme.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^password$/i), {
      target: { name: "password", value: "secret-pass" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(loginUser).toHaveBeenCalledWith({
        email: "owner@acme.com",
        password: "secret-pass",
        tenantKey: undefined,
        accountSelectionToken: undefined,
      });
    });

    expect(clearAppSessionContext).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/", { replace: true });
    });
  });

  it("shows the current network-friendly auth error copy", async () => {
    loginUser.mockRejectedValueOnce(new Error("Failed to fetch"));

    renderRoute("/login");

    fireEvent.change(await screen.findByPlaceholderText(/email address/i), {
      target: { name: "email", value: "owner@acme.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^password$/i), {
      target: { name: "password", value: "secret-pass" },
    });

    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    expect(
      await screen.findByText(/authentication is temporarily unavailable/i)
    ).toBeInTheDocument();
  });

  it("creates an account from the signup route and sends the user to verify email", async () => {
    signupUser.mockResolvedValueOnce({ ok: true });

    renderRoute("/signup");

    fireEvent.change(await screen.findByPlaceholderText(/full name/i), {
      target: { name: "fullName", value: "Jane Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText(/workspace name/i), {
      target: { name: "companyName", value: "Acme Clinic" },
    });
    fireEvent.change(screen.getByPlaceholderText(/email address/i), {
      target: { name: "email", value: "owner@acme.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^password$/i), {
      target: { name: "password", value: "secret-pass" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create workspace/i }));

    await waitFor(() => {
      expect(signupUser).toHaveBeenCalledWith({
        fullName: "Jane Doe",
        companyName: "Acme Clinic",
        email: "owner@acme.com",
        password: "secret-pass",
      });
    });

    expect(clearAppSessionContext).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/verify-email", {
        replace: true,
        state: { email: "owner@acme.com" },
      });
    });
  });
});
