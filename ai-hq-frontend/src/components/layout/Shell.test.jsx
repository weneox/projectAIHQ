import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
}));

vi.mock("./Header.jsx", () => ({
  default: function HeaderMock() {
    return <div>header</div>;
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

  it("skips shared inbox stats fetches while the inbox route is active", async () => {
    pathname = "/inbox";
    render(<Shell />);

    await waitFor(() => {
      expect(apiGet).not.toHaveBeenCalled();
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
});
