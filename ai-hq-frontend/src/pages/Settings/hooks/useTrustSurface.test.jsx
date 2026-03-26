import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../api/trust.js", () => ({
  getSettingsTrustView: vi.fn(),
}));

import { getSettingsTrustView } from "../../../api/trust.js";
import { useTrustSurface } from "./useTrustSurface.js";

describe("useTrustSurface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads normalized trust view and exposes ready state", async () => {
    getSettingsTrustView.mockResolvedValue({
      summary: {
        readiness: {
          status: "ready",
          blockers: [],
        },
      },
      recentRuns: [],
      audit: [],
    });

    const { result } = renderHook(() => useTrustSurface({ tenantKey: "tenant-a" }));
    await result.current.refreshTrust();

    await waitFor(() => {
      expect(result.current.trust.status).toBe("ready");
    });

    expect(getSettingsTrustView).toHaveBeenCalledWith({
      tenantKey: "tenant-a",
      limit: 8,
    });
    expect(result.current.trust.view.summary.readiness.status).toBe("ready");
    expect(result.current.trust.error).toBe("");
    expect(typeof result.current.trust.surface.refresh).toBe("function");
  });

  it("fails closed with unavailable state when trust loading errors", async () => {
    getSettingsTrustView.mockRejectedValue(new Error("trust route unavailable"));

    const { result } = renderHook(() => useTrustSurface({ tenantKey: "tenant-a" }));
    await result.current.refreshTrust();

    await waitFor(() => {
      expect(result.current.trust.status).toBe("unavailable");
    });

    expect(result.current.trust.unavailable).toBe(true);
    expect(result.current.trust.error).toMatch(/trust route unavailable/i);
    expect(result.current.trust.view.audit).toEqual([]);
  });
});
