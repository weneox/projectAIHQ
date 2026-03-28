import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../api/settings.js", () => ({
  getWorkspaceSettings: vi.fn(),
  saveWorkspaceSettings: vi.fn(),
  getWorkspaceAgents: vi.fn(),
  saveWorkspaceAgent: vi.fn(),
}));

import {
  getWorkspaceAgents,
  getWorkspaceSettings,
  saveWorkspaceAgent,
  saveWorkspaceSettings,
} from "../../../api/settings.js";
import { useSettingsWorkspace } from "./useSettingsWorkspace.js";

describe("useSettingsWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes the unified surface contract on refresh", async () => {
    getWorkspaceSettings.mockResolvedValue({
      tenantKey: "tenant-a",
      viewerRole: "owner",
      tenant: { tenant_key: "tenant-a" },
      profile: {},
      aiPolicy: {},
      entitlements: {
        plan: { key: "starter", normalizedKey: "starter", managed: true },
        capabilities: {
          metaChannelConnect: { allowed: false },
        },
      },
    });
    getWorkspaceAgents.mockResolvedValue([{ agent_key: "closer", enabled: true }]);

    const { result } = renderHook(() => useSettingsWorkspace());

    await result.current.refreshWorkspace();

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
    });

    expect(result.current.workspace.tenantKey).toBe("tenant-a");
    expect(result.current.workspace.entitlements.plan.managed).toBe(true);
    expect(result.current.workspace.entitlements.capabilities.metaChannelConnect.allowed).toBe(
      false
    );
    expect(result.current.agents).toHaveLength(1);
    expect(typeof result.current.surface.refresh).toBe("function");
  });

  it("uses the shared save-state vocabulary for workspace saves and agent saves", async () => {
    saveWorkspaceSettings.mockResolvedValue({
      tenantKey: "tenant-a",
      viewerRole: "owner",
      tenant: { tenant_key: "tenant-a" },
      profile: {},
      aiPolicy: {},
    });
    saveWorkspaceAgent.mockResolvedValue({ ok: true });
    getWorkspaceAgents.mockResolvedValue([{ agent_key: "closer", enabled: true }]);

    const { result } = renderHook(() => useSettingsWorkspace());

    await result.current.onSaveWorkspace();

    await waitFor(() => {
      expect(result.current.surface.saveSuccess).toMatch(/workspace settings saved/i);
    });

    await result.current.saveAgent("closer", {
      display_name: "Closer",
      role_summary: "Sales follow-up",
      enabled: true,
      model: "gpt-5",
    });

    await waitFor(() => {
      expect(result.current.surface.saveSuccess).toMatch(/closer agent updated/i);
    });
  });
});
