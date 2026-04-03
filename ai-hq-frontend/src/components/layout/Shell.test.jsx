import { render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../../test/vitest.setup.js";

const apiGet = vi.fn();
let pathname = "/inbox";

vi.mock("react-router-dom", () => ({
  Outlet: () => <div>outlet</div>,
  useLocation: () => ({ pathname }),
}));

vi.mock("../../hooks/useNotificationsSurface.js", () => ({
  useNotificationsSurface: () => ({
    open: false,
    setOpen: vi.fn(),
    notifications: [],
    unreadCount: 0,
  }),
}));

vi.mock("../../api/client.js", () => ({
  apiGet: (...args) => apiGet(...args),
}));

vi.mock("./Sidebar.jsx", () => ({
  default: function SidebarMock() {
    return <div>sidebar</div>;
  },
  SIDEBAR_WIDTH: 52,
  SHELL_TOPBAR_HEIGHT: 52,
}));

vi.mock("./Header.jsx", () => ({
  default: function HeaderMock() {
    return <div>header</div>;
  },
}));

vi.mock("./AskAIWidget.jsx", () => ({
  default: function AskAIWidgetMock() {
    return <div>ask-ai-widget</div>;
  },
}));

vi.mock("../../lib/realtime/realtimeStore.js", () => ({
  realtimeStore: {
    subscribeStatus: () => () => {},
    subscribeEvents: () => () => {},
    canUseWs: () => false,
  },
}));

import Shell from "./Shell.jsx";

describe("Shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("mounts the ask ai widget inside the shell", async () => {
    pathname = "/workspace";
    apiGet.mockResolvedValueOnce({ threads: [] }).mockResolvedValueOnce({ leads: [] });

    const view = render(<Shell />);

    await waitFor(() => {
      expect(view.getByText("ask-ai-widget")).toBeInTheDocument();
    });
  });
});
