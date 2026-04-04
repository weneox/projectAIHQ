import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../api/tenants.js", () => ({
  listTenants: vi.fn(),
  listTenantUsers: vi.fn(),
  createTenantUser: vi.fn(),
  updateTenantUser: vi.fn(),
  setTenantUserStatus: vi.fn(),
  setTenantUserPassword: vi.fn(),
  deleteTenantUser: vi.fn(),
}));

import { createTenantUser, listTenantUsers, listTenants } from "../../../api/tenants.js";
import { useAdminTeamSurface } from "../../../pages/hooks/useAdminTeamSurface.js";

describe("useAdminTeamSurface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes the shared surface contract on refresh", async () => {
    listTenants.mockResolvedValue([{ tenant_key: "tenant-a", company_name: "Tenant A" }]);
    listTenantUsers.mockResolvedValue([{ id: "user-1", user_email: "owner@example.com" }]);

    const { result } = renderHook(() => useAdminTeamSurface());

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
    });

    expect(result.current.tenants).toHaveLength(1);
    expect(result.current.users).toHaveLength(1);
    expect(typeof result.current.surface.refresh).toBe("function");
  });

  it("uses shared save-state vocabulary for admin team user creation", async () => {
    listTenants.mockResolvedValue([{ tenant_key: "tenant-a", company_name: "Tenant A" }]);
    listTenantUsers.mockResolvedValue([]);
    createTenantUser.mockResolvedValue({
      user: {
        id: "user-2",
        user_email: "operator@example.com",
      },
    });

    const { result } = renderHook(() => useAdminTeamSurface());

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
    });

    act(() => {
      result.current.patchCreate("email", "operator@example.com");
      result.current.patchCreate("full_name", "Operator");
    });

    await result.current.createUser();

    await waitFor(() => {
      expect(result.current.surface.saveSuccess).toMatch(/operator@example.com has been created/i);
    });
  });
});
