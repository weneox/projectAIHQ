import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../pages/hooks/useAdminTeamSurface.js", () => ({
  useAdminTeamSurface: () => ({
    tenants: [],
    users: [],
    tenantKey: "",
    setTenantKey: vi.fn(),
    filteredUsers: [],
    selectedWorkspace: null,
    query: "",
    setQuery: vi.fn(),
    createForm: {
      email: "",
      full_name: "",
      role: "member",
      status: "active",
      password: "",
    },
    patchCreate: vi.fn(),
    editForm: {
      id: "",
      email: "",
      full_name: "",
      role: "member",
      status: "invited",
    },
    patchEdit: vi.fn(),
    passwordUserId: "",
    setPasswordUserId: vi.fn(),
    newPassword: "",
    setNewPassword: vi.fn(),
    surface: {
      loading: false,
      error: "",
      unavailable: true,
      ready: false,
      saving: false,
      saveError: "",
      saveSuccess: "User has been deleted.",
      refresh: vi.fn(),
      clearSaveState: vi.fn(),
    },
    actionState: {
      pendingAction: "",
      isActionPending: vi.fn().mockReturnValue(false),
    },
    startEdit: vi.fn(),
    createUser: vi.fn(),
    saveEdit: vi.fn(),
    updateQuickStatus: vi.fn(),
    updatePassword: vi.fn(),
    removeUser: vi.fn(),
  }),
}));

import AdminTeam from "../../pages/AdminTeam.jsx";

afterEach(() => {
  cleanup();
});

describe("AdminTeam", () => {
  it("renders shared surface banner feedback", () => {
    render(<AdminTeam />);

    expect(screen.getByText(/^User has been deleted$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Team unavailable$/i)).toBeInTheDocument();
  });
});
