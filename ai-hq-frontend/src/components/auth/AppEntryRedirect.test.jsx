import { MemoryRouter } from "react-router-dom";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
const getAppBootstrapContext = vi.fn();
const isLocalWorkspaceEntryEnabled = vi.fn();
const resolveAuthenticatedLanding = vi.fn();

vi.mock("../../lib/appSession.js", () => ({
  getAppBootstrapContext: (...args) => getAppBootstrapContext(...args),
}));

vi.mock("../../lib/appEntry.js", () => ({
  isLocalWorkspaceEntryEnabled: (...args) => isLocalWorkspaceEntryEnabled(...args),
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
    isLocalWorkspaceEntryEnabled.mockReturnValue(false);
    resolveAuthenticatedLanding.mockReturnValue("/workspace");
  });

  it("uses shared bootstrap context to resolve the authenticated landing route", async () => {
    getAppBootstrapContext.mockResolvedValue({
      workspace: { setupCompleted: true, nextRoute: "/workspace" },
    });

    render(
      <MemoryRouter>
        <AppEntryRedirect />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith("/workspace", { replace: true });
    });

    expect(getAppBootstrapContext).toHaveBeenCalledTimes(1);
    expect(resolveAuthenticatedLanding).toHaveBeenCalledTimes(1);
  });
});
