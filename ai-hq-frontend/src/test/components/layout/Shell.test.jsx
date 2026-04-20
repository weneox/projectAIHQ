import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../../setup/vitest.setup.js";

const apiGet = vi.fn();
let pathname = "/inbox";
let search = "";
const navigate = vi.fn();

vi.mock("react-router-dom", () => ({
  Outlet: () => <div>outlet</div>,
  useLocation: () => ({ pathname, search }),
  useNavigate: () => navigate,
}));

vi.mock("../../../hooks/useNotificationsSurface.js", () => ({
  useNotificationsSurface: () => ({
    open: false,
    setOpen: vi.fn(),
    notifications: [],
    unreadCount: 0,
  }),
}));

vi.mock("../../../api/client.js", () => ({
  apiGet: (...args) => apiGet(...args),
}));

vi.mock("../../../components/layout/Sidebar.jsx", () => ({
  default: function SidebarMock({
    shellStats = {},
    collapsed = false,
    topOffset = 0,
  }) {
    return (
      <div
        data-testid="sidebar"
        data-inbox-unread={String(shellStats.inboxUnread ?? "")}
        data-leads-open={String(shellStats.leadsOpen ?? "")}
        data-collapsed={collapsed ? "true" : "false"}
        data-top-offset={String(topOffset)}
      >
        sidebar
      </div>
    );
  },
  SIDEBAR_WIDTH: 52,
  SIDEBAR_COLLAPSED_WIDTH: 20,
}));

vi.mock("../../../components/layout/Header.jsx", () => ({
  default: function HeaderMock({ workspaceMeta = {}, shellStats = {} }) {
    return (
      <div
        data-testid="header"
        data-workspace={workspaceMeta.workspaceName || ""}
        data-inbox-unread={String(shellStats.inboxUnread ?? "")}
      >
        header
      </div>
    );
  },
  HEADER_HEIGHT: 52,
}));

vi.mock("../../../components/layout/FloatingAiWidget.jsx", () => ({
  default: function FloatingAiWidgetMock({ open = false, onOpenChange }) {
    return (
      <div>
        <div data-testid="floating-ai-widget" data-open={open ? "true" : "false"}>
          widget
        </div>
        <button type="button" onClick={() => onOpenChange?.(false)}>
          close widget
        </button>
      </div>
    );
  },
}));

vi.mock("../../../lib/realtime/realtimeStore.js", () => ({
  realtimeStore: {
    subscribeStatus: () => () => {},
    subscribeEvents: () => () => {},
    canUseWs: () => false,
  },
}));

import Shell from "../../../components/layout/Shell.jsx";

function mockShellApis() {
  apiGet.mockImplementation((path) => {
    if (path === "/api/app/bootstrap") {
      return Promise.resolve({
        workspace: { companyName: "Dental HQ", tenantKey: "dental" },
        user: { name: "Dr. Avery" },
      });
    }

    if (path === "/api/inbox/threads") {
      return Promise.resolve({
        threads: [{ unread_count: 2 }, { unread_count: 3 }],
      });
    }

    if (path === "/api/leads") {
      return Promise.resolve({
        leads: [{ status: "open" }, { status: "won" }],
      });
    }

    return Promise.reject(new Error(`Unexpected apiGet path: ${path}`));
  });
}

describe("Shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = "/inbox";
    search = "";
    mockShellApis();
  });

  it("loads bootstrap and shared stats while the inbox route is active", async () => {
    render(<Shell />);

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith("/api/app/bootstrap");
      expect(apiGet).toHaveBeenCalledWith("/api/inbox/threads");
      expect(apiGet).toHaveBeenCalledWith("/api/leads");
    });

    await waitFor(() => {
      expect(screen.getByTestId("sidebar")).toHaveAttribute("data-inbox-unread", "5");
      expect(screen.getByTestId("sidebar")).toHaveAttribute("data-leads-open", "1");
      expect(screen.getByTestId("header")).toHaveAttribute("data-workspace", "Dental HQ");
    });
  });

  it("still refreshes shared stats on non-inbox routes", async () => {
    pathname = "/truth";

    render(<Shell />);

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith("/api/inbox/threads");
      expect(apiGet).toHaveBeenCalledWith("/api/leads");
    });

    expect(screen.getByText("outlet")).toBeInTheDocument();
  });

  it("opens the global widget from the assistant query param and clears it on close", async () => {
    pathname = "/home";
    search = "?assistant=setup";

    render(<Shell />);

    await waitFor(() => {
      expect(screen.getByTestId("floating-ai-widget")).toHaveAttribute(
        "data-open",
        "true"
      );
    });

    screen.getByRole("button", { name: /close widget/i }).click();

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(
        {
          pathname: "/home",
          search: "",
        },
        { replace: true }
      );
    });
  });
});
