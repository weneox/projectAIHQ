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
      governance: {
        directWorkspaceWritesBlocked: true,
        governedSections: ["tenant", "profile"],
        directlyEditableSections: ["aiPolicy"],
      },
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
    expect(result.current.canDirectEditGovernedWorkspace).toBe(false);
    expect(typeof result.current.surface.refresh).toBe("function");
  });

  it("saves only operational workspace settings directly and keeps governed profile fields blocked", async () => {
    saveWorkspaceSettings.mockResolvedValue({
      tenantKey: "tenant-a",
      viewerRole: "owner",
      tenant: { tenant_key: "tenant-a" },
      profile: {},
      aiPolicy: {},
      governance: {
        directWorkspaceWritesBlocked: true,
        governedSections: ["tenant", "profile"],
        directlyEditableSections: ["aiPolicy"],
      },
    });
    saveWorkspaceAgent.mockResolvedValue({ ok: true });
    getWorkspaceAgents.mockResolvedValue([{ agent_key: "closer", enabled: true }]);

    const { result } = renderHook(() => useSettingsWorkspace());

    result.current.patchTenant("company_name", "Blocked company");
    expect(result.current.workspace.tenant.company_name || "").toBe("");

    await result.current.onSaveWorkspace();

    await waitFor(() => {
      expect(result.current.surface.saveSuccess).toMatch(/operational settings saved/i);
    });

    expect(saveWorkspaceSettings).toHaveBeenCalledWith({
      aiPolicy: expect.any(Object),
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
