import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../../setup/vitest.setup.js";

const apiGet = vi.fn();
const useProductHome = vi.fn();
let pathname = "/inbox";
let search = "";

vi.mock("react-router-dom", () => ({
  Outlet: () => <div>outlet</div>,
  useLocation: () => ({ pathname, search }),
  useNavigate: () => vi.fn(),
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
  default: function SidebarMock() {
    return <div>sidebar</div>;
  },
  SIDEBAR_WIDTH: 52,
  SHELL_TOPBAR_HEIGHT: 52,
}));

vi.mock("../../../components/layout/Header.jsx", () => ({
  default: function HeaderMock() {
    return <div>header</div>;
  },
}));

vi.mock("../../../view-models/useProductHome.js", () => ({
  default: (...args) => useProductHome(...args),
}));

vi.mock("../../../components/layout/FloatingAiWidget.jsx", () => ({
  default: function FloatingAiWidgetMock({ open = false, assistant = {} }) {
    return (
      <div data-testid="floating-ai-widget" data-open={open ? "true" : "false"}>
        {assistant?.title || "widget"}
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

describe("Shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pathname = "/inbox";
    search = "";
    useProductHome.mockReturnValue({
      loading: false,
      assistant: {
        title: "AI setup lives on Home",
      },
    });
  });

  it("loads shared stats while the inbox route is active", async () => {
    pathname = "/inbox";
    apiGet.mockResolvedValueOnce({ threads: [] }).mockResolvedValueOnce({ leads: [] });
    render(<Shell />);

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith("/api/inbox/threads");
      expect(apiGet).toHaveBeenCalledWith("/api/leads");
    });
  });

  it("loads shared stats on non-inbox routes", async () => {
    pathname = "/truth";
    apiGet.mockResolvedValueOnce({ threads: [] }).mockResolvedValueOnce({ leads: [] });

    render(<Shell />);

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith("/api/inbox/threads");
      expect(apiGet).toHaveBeenCalledWith("/api/leads");
    });
  });

  it("passes the Home assistant model through to the widget", async () => {
    pathname = "/home";
    useProductHome.mockReturnValue({
      loading: false,
      assistant: {
        title: "Telegram is connected. Start the first structured business draft.",
      },
    });
    apiGet.mockResolvedValueOnce({ threads: [] }).mockResolvedValueOnce({ leads: [] });

    render(<Shell />);

    expect(
      screen.getByText("Telegram is connected. Start the first structured business draft.")
    ).toBeInTheDocument();
  });

  it("opens the global widget from the assistant query param", async () => {
    pathname = "/home";
    search = "?assistant=setup";
    apiGet.mockResolvedValueOnce({ threads: [] }).mockResolvedValueOnce({ leads: [] });

    render(<Shell />);

    await waitFor(() => {
      expect(screen.getByTestId("floating-ai-widget")).toHaveAttribute(
        "data-open",
        "true"
      );
    });

    expect(useProductHome).toHaveBeenCalledWith({ enabled: true });
  });
});
