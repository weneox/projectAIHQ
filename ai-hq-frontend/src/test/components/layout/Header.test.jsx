import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAppSessionContext = vi.fn();
const clearAppSessionContext = vi.fn();
const logoutUser = vi.fn();
const clearClientAuthState = vi.fn();
const isLoginPath = vi.fn(() => true);

vi.mock("../../../lib/appSession.js", () => ({
  getAppSessionContext: (...args) => getAppSessionContext(...args),
  clearAppSessionContext: (...args) => clearAppSessionContext(...args),
}));

vi.mock("../../../api/auth.js", () => ({
  logoutUser: (...args) => logoutUser(...args),
}));

vi.mock("../../../lib/clientAuthState.js", () => ({
  clearClientAuthState: (...args) => clearClientAuthState(...args),
  isLoginPath: (...args) => isLoginPath(...args),
}));

vi.mock("../../../components/layout/NotificationsPanel.jsx", () => ({
  default: function NotificationsPanelMock() {
    return <div>notifications-panel</div>;
  },
}));

import Header from "../../../components/layout/Header.jsx";

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isLoginPath.mockReturnValue(true);
    getAppSessionContext.mockResolvedValue({
      bootstrap: {
        workspace: {
          companyName: "Dental HQ",
        },
        viewer: {
          full_name: "Dr. Avery",
        },
        viewerRole: "Owner",
      },
    });
  });

  it("loads session workspace chrome and keeps ask-ai plus notification controls wired", async () => {
    const setOpen = vi.fn();
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    render(
      <MemoryRouter>
        <Header
          notifications={{ open: false, setOpen, unreadCount: 2, notifications: [] }}
          workspaceMeta={{}}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getAppSessionContext).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole("button", { name: /köməkçini aç/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bildirişləri aç/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /dental hq/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /köməkçini aç/i }));
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "aihq:open-assistant" })
    );

    fireEvent.click(screen.getByRole("button", { name: /bildirişləri aç/i }));
    expect(setOpen).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: /dental hq/i }));

    expect(await screen.findByText("Bildirişlər")).toBeInTheDocument();
    expect(screen.getByText("Çıxış")).toBeInTheDocument();
    expect(screen.getByText("Dr. Avery")).toBeInTheDocument();
  });

  it("clears client auth state even when backend logout fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    logoutUser.mockRejectedValueOnce(new Error("session already expired"));

    render(
      <MemoryRouter>
        <Header
          notifications={{ open: false, setOpen: vi.fn(), notifications: [] }}
          workspaceMeta={{}}
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /dental hq/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /dental hq/i }));
    fireEvent.click(await screen.findByRole("button", { name: /x/i }));

    await waitFor(() => {
      expect(logoutUser).toHaveBeenCalledTimes(1);
      expect(clearAppSessionContext).toHaveBeenCalledTimes(1);
      expect(clearClientAuthState).toHaveBeenCalledTimes(1);
    });

    expect(consoleError).toHaveBeenCalledWith(
      "Logout failed:",
      expect.any(Error)
    );

    consoleError.mockRestore();
  });
});

