import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
const getAppAuthContext = vi.fn();
const getAppBootstrapContext = vi.fn();
const hasMultipleWorkspaceChoices = vi.fn();
const resolveAuthenticatedLanding = vi.fn();

vi.mock("../../lib/appSession.js", () => ({
  getAppAuthContext: (...args) => getAppAuthContext(...args),
  getAppBootstrapContext: (...args) => getAppBootstrapContext(...args),
}));

vi.mock("../../lib/appEntry.js", () => ({
  WORKSPACE_SELECTION_ROUTE: "/select-workspace",
  hasMultipleWorkspaceChoices: (...args) => hasMultipleWorkspaceChoices(...args),
  resolveAuthenticatedLanding: (...args) => resolveAuthenticatedLanding(...args),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

import AppEntryRedirect from "./AppEntryRedirect.jsx";

describe("AppEntryRedirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasMultipleWorkspaceChoices.mockReturnValue(false);
    resolveAuthenticatedLanding.mockReturnValue("/home");
  });

  it("sends an unauthenticated user to login", async () => {
    getAppAuthContext.mockResolvedValue({ authenticated: false });

    render(
      <MemoryRouter>
        <AppEntryRedirect />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/login", { replace: true });
    });
  });

  it("sends a multi-workspace user to workspace selection", async () => {
    getAppAuthContext.mockResolvedValue({ authenticated: true });
    hasMultipleWorkspaceChoices.mockReturnValue(true);

    render(
      <MemoryRouter>
        <AppEntryRedirect />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/select-workspace", { replace: true });
    });
  });

  it("uses shared auth and bootstrap context to resolve the authenticated landing route", async () => {
    getAppAuthContext.mockResolvedValue({ authenticated: true });
    getAppBootstrapContext.mockResolvedValue({
      workspace: { setupCompleted: true, workspaceReady: true },
    });

    render(
      <MemoryRouter>
        <AppEntryRedirect />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/home", { replace: true });
    });

    expect(resolveAuthenticatedLanding).toHaveBeenCalledTimes(1);
  });

  it("shows a controlled unavailable surface on load failure", async () => {
    getAppAuthContext.mockRejectedValue(new Error("auth offline"));

    render(
      <MemoryRouter>
        <AppEntryRedirect />
      </MemoryRouter>
    );

    expect(
      await screen.findByText((content) => content.includes("Account unavailable"))
    ).toBeInTheDocument();
  });

  it("does not send an authenticated user to login when bootstrap fails", async () => {
    getAppAuthContext.mockResolvedValue({ authenticated: true });
    getAppBootstrapContext.mockRejectedValue(new Error("bootstrap offline"));

    render(
      <MemoryRouter>
        <AppEntryRedirect />
      </MemoryRouter>
    );

    expect(
      await screen.findByText((content) => content.includes("Account unavailable"))
    ).toBeInTheDocument();

    expect(navigate).not.toHaveBeenCalledWith("/login", { replace: true });
  });
});
