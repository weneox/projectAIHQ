import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../api/settings.js", () => ({
  getMetaChannelStatus: vi.fn(),
  getMetaConnectUrl: vi.fn(),
  disconnectMetaChannel: vi.fn(),
}));

vi.mock("../../readiness/dispatchRepairAction.js", () => ({
  dispatchRepairAction: vi.fn(),
}));

import {
  disconnectMetaChannel,
  getMetaChannelStatus,
} from "../../../api/settings.js";
import { dispatchRepairAction } from "../../readiness/dispatchRepairAction.js";
import { useChannelsSurface } from "./useChannelsSurface.js";

describe("useChannelsSurface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/settings");
  });

  it("exposes the shared surface contract on refresh", async () => {
    getMetaChannelStatus.mockResolvedValue({
      connected: true,
      channel: { external_username: "northclinic" },
      hasToken: true,
      readiness: { status: "ready", blockers: [] },
    });

    const { result } = renderHook(() => useChannelsSurface({ canManage: true }));

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
    });

    expect(result.current.meta.connected).toBe(true);
    expect(typeof result.current.surface.refresh).toBe("function");
  });

  it("uses shared save-state vocabulary for disconnect and blocked repair actions", async () => {
    getMetaChannelStatus.mockResolvedValue({
      connected: true,
      channel: {},
      hasToken: true,
      readiness: { status: "ready", blockers: [] },
    });
    disconnectMetaChannel.mockResolvedValue({ ok: true });
    dispatchRepairAction.mockResolvedValueOnce({ ok: false, reason: "blocked" });

    const { result } = renderHook(() => useChannelsSurface({ canManage: true }));

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
    });

    await result.current.disconnectChannel();

    await waitFor(() => {
      expect(result.current.surface.saveSuccess).toMatch(/instagram connection removed/i);
    });

    await result.current.runRepairAction({
      kind: "admin_route",
      allowed: false,
      target: { path: "/admin/secrets" },
    });

    await waitFor(() => {
      expect(result.current.surface.saveError).toMatch(/requires elevated access/i);
    });
  });
});
