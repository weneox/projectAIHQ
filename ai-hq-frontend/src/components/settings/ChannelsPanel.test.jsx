import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./hooks/useChannelsSurface.js", () => ({
  useChannelsSurface: () => ({
    meta: {
      connected: false,
      channel: null,
      hasToken: false,
      readiness: {},
    },
    surface: {
      loading: false,
      error: "Meta status unavailable.",
      unavailable: true,
      ready: false,
      saving: false,
      saveError: "",
      saveSuccess: "Instagram connection removed.",
      refresh: vi.fn(),
      clearSaveState: vi.fn(),
    },
    refreshChannels: vi.fn(),
    startMetaConnect: vi.fn(),
    disconnectChannel: vi.fn(),
    runRepairAction: vi.fn(),
  }),
}));

import ChannelsPanel from "./ChannelsPanel.jsx";

afterEach(() => {
  cleanup();
});

describe("ChannelsPanel", () => {
  it("renders shared surface banner feedback for channel async state", () => {
    render(<ChannelsPanel canManage />);

    expect(screen.getByText(/instagram connection removed/i)).toBeInTheDocument();
    expect(screen.getByText(/meta channel status is temporarily unavailable/i)).toBeInTheDocument();
  });
});
