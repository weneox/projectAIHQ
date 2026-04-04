import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../api/adminSecrets.js", () => ({
  getAdminSecrets: vi.fn(),
  saveAdminSecret: vi.fn(),
  deleteAdminSecret: vi.fn(),
}));

import { getAdminSecrets, saveAdminSecret } from "../../../../api/adminSecrets.js";
import { useProviderSecretsSurface } from "../../../../components/admin/hooks/useProviderSecretsSurface.js";

describe("useProviderSecretsSurface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes the shared surface contract while loading provider secrets", async () => {
    getAdminSecrets.mockResolvedValue([{ id: "secret-1", secret_key: "api_key" }]);

    const { result } = renderHook(() => useProviderSecretsSurface({ canManage: true }));

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
    });

    expect(result.current.secrets).toHaveLength(1);
    expect(typeof result.current.surface.refresh).toBe("function");
  });

  it("uses the shared save-state vocabulary for secret saves", async () => {
    getAdminSecrets.mockResolvedValue([]);
    saveAdminSecret.mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useProviderSecretsSurface({ canManage: true }));

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
    });

    act(() => {
      result.current.setSecretKey("api_key");
      result.current.setSecretValue("secret-value");
    });

    await result.current.saveSecret();

    await waitFor(() => {
      expect(result.current.surface.saveSuccess).toMatch(/meta\.api_key saved/i);
    });
  });
});
