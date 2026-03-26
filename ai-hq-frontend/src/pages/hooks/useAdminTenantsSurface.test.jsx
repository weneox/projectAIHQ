import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/tenants.js", () => ({
  listTenants: vi.fn(),
  createTenant: vi.fn(),
  exportTenantJson: vi.fn(),
  exportTenantCsvBundle: vi.fn(),
  downloadTenantZip: vi.fn(),
}));

import { createTenant, listTenants } from "../../api/tenants.js";
import { useAdminTenantsSurface } from "./useAdminTenantsSurface.js";

describe("useAdminTenantsSurface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes the shared surface contract on refresh", async () => {
    listTenants.mockResolvedValue([{ tenant_key: "tenant-a", company_name: "Tenant A" }]);

    const { result } = renderHook(() => useAdminTenantsSurface());

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
    });

    expect(result.current.items).toHaveLength(1);
    expect(typeof result.current.surface.refresh).toBe("function");
  });

  it("uses shared save-state vocabulary for tenant creation", async () => {
    listTenants.mockResolvedValue([]);
    createTenant.mockResolvedValue({
      tenant: {
        tenant_key: "tenant-a",
      },
    });

    const { result } = renderHook(() => useAdminTenantsSurface());

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
    });

    act(() => {
      result.current.patchForm("tenant_key", "tenant-a");
      result.current.patchForm("company_name", "Tenant A");
      result.current.patchForm("owner_email", "owner@example.com");
      result.current.patchForm("owner_password", "password123");
    });

    await result.current.createTenantRecord();

    await waitFor(() => {
      expect(result.current.surface.saveSuccess).toMatch(/tenant-a tenant created/i);
    });
  });
});
