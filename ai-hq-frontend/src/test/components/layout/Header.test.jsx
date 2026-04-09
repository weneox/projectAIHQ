import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigate = vi.fn();
const getAppAuthContext = vi.fn();
const clearAppSessionContext = vi.fn();
const logoutUser = vi.fn();
const switchWorkspaceUser = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("../../../lib/appSession.js", () => ({
  getAppAuthContext: (...args) => getAppAuthContext(...args),
  clearAppSessionContext: (...args) => clearAppSessionContext(...args),
}));

vi.mock("../../../api/auth.js", () => ({
  logoutUser: (...args) => logoutUser(...args),
  switchWorkspaceUser: (...args) => switchWorkspaceUser(...args),
}));

vi.mock("../../../components/layout/NotificationsPanel.jsx", () => ({
  default: function NotificationsPanelMock() {
    return <div>notifications-panel</div>;
  },
}));

import Header from "../../../components/layout/Header.jsx";

describe("Header workspace switcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAppAuthContext.mockResolvedValue({
      workspace: {
        membershipId: "membership-1",
        tenantKey: "dental",
        companyName: "Dental HQ",
        active: true,
      },
      workspaces: [
        {
          membershipId: "membership-1",
          tenantKey: "dental",
          companyName: "Dental HQ",
          role: "owner",
          active: true,
          workspaceReady: true,
          switchToken: "token-1",
        },
        {
          membershipId: "membership-2",
          tenantKey: "hotel",
          companyName: "Hotel HQ",
          role: "member",
          active: false,
          setupRequired: true,
          switchToken: "token-2",
        },
      ],
    });
  });

  it("renders available workspaces and switches using the canonical switch endpoint", async () => {
    switchWorkspaceUser.mockResolvedValue({
      destination: { path: "/home?assistant=setup" },
      workspace: { routeHint: "/home?assistant=setup" },
    });

    const view = render(
      <Header
        notifications={{ open: false, setOpen: vi.fn(), unreadCount: 0, notifications: [] }}
        shellSection={{ label: "Workspace" }}
        activeContextItem={{ label: "AI HQ" }}
      />
    );

    await waitFor(() => {
      expect(getAppAuthContext).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(view.getByRole("button", { name: /dental hq/i }));

    expect(view.getByText("Switch workspace")).toBeInTheDocument();
    expect(view.getByText("Current")).toBeInTheDocument();
    expect(view.getByText("Setup required")).toBeInTheDocument();

    fireEvent.click(view.getByRole("button", { name: /hotel hq/i }));

    await waitFor(() => {
      expect(switchWorkspaceUser).toHaveBeenCalledWith({ switchToken: "token-2" });
    });

    expect(clearAppSessionContext).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/home?assistant=setup", { replace: true });
  });
});

