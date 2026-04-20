import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAppSessionContext = vi.fn();
const clearAppSessionContext = vi.fn();
const logoutUser = vi.fn();

vi.mock("../../../lib/appSession.js", () => ({
  getAppSessionContext: (...args) => getAppSessionContext(...args),
  clearAppSessionContext: (...args) => clearAppSessionContext(...args),
}));

vi.mock("../../../api/auth.js", () => ({
  logoutUser: (...args) => logoutUser(...args),
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
      <Header
        notifications={{ open: false, setOpen, unreadCount: 2, notifications: [] }}
        workspaceMeta={{}}
      />
    );

    await waitFor(() => {
      expect(getAppSessionContext).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByRole("button", { name: /open ask ai/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open notifications/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /dental hq/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /open ask ai/i }));
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "aihq:open-assistant" })
    );

    fireEvent.click(screen.getByRole("button", { name: /open notifications/i }));
    expect(setOpen).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole("button", { name: /dental hq/i }));

    expect(await screen.findByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
    expect(screen.getByText("Dr. Avery")).toBeInTheDocument();
  });
});

