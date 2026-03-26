import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../api/settings.js", () => ({
  getOperationalSettings: vi.fn(),
  saveOperationalChannelSettings: vi.fn(),
  saveOperationalVoiceSettings: vi.fn(),
}));

import { getOperationalSettings, saveOperationalVoiceSettings } from "../../../api/settings.js";
import { useOperationalSettings } from "./useOperationalSettings.js";

describe("useOperationalSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes the unified surface contract on successful refresh", async () => {
    getOperationalSettings.mockResolvedValue({
      tenant: { tenantKey: "tenant-a" },
      voice: { settings: null, operational: {}, missingFields: [] },
      channels: { items: [], meta: { operational: {}, missingFields: [], providerSecrets: {} } },
      operationalChannels: {},
      viewerRole: "operator",
    });

    const { result } = renderHook(() =>
      useOperationalSettings({ tenantKey: "tenant-a", setMessage: vi.fn() })
    );

    await result.current.refreshOperationalSettings();

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
    });

    expect(result.current.surface.loading).toBe(false);
    expect(result.current.surface.unavailable).toBe(false);
    expect(typeof result.current.surface.refresh).toBe("function");
  });

  it("uses the shared save-state vocabulary for voice saves", async () => {
    saveOperationalVoiceSettings.mockResolvedValue({
      tenant: { tenantKey: "tenant-a" },
      voice: { settings: {}, operational: {}, missingFields: [] },
      channels: { items: [], meta: { operational: {}, missingFields: [], providerSecrets: {} } },
      operationalChannels: {},
      viewerRole: "operator",
    });

    const { result } = renderHook(() =>
      useOperationalSettings({ tenantKey: "tenant-a", setMessage: vi.fn() })
    );

    await result.current.saveVoiceSettings({});

    await waitFor(() => {
      expect(result.current.surface.saveSuccess).toMatch(/voice settings saved/i);
    });
  });
});
