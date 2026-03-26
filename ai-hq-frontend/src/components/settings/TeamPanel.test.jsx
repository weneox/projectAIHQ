import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./hooks/useTeamSurface.js", () => ({
  useTeamSurface: () => ({
    items: [],
    filtered: [],
    selected: null,
    selectedId: "",
    setSelectedId: vi.fn(),
    query: "",
    setQuery: vi.fn(),
    roleFilter: "",
    setRoleFilter: vi.fn(),
    statusFilter: "",
    setStatusFilter: vi.fn(),
    form: {
      user_email: "",
      full_name: "",
      role: "member",
      status: "invited",
      password: "",
    },
    setForm: vi.fn(),
    dirty: false,
    pendingAction: "",
    surface: {
      loading: false,
      error: "",
      unavailable: true,
      ready: false,
      saving: false,
      saveError: "",
      saveSuccess: "Team user created.",
      refresh: vi.fn(),
      clearSaveState: vi.fn(),
    },
    resetCreateForm: vi.fn(),
    createUser: vi.fn(),
    saveSelectedUser: vi.fn(),
    updateSelectedStatus: vi.fn(),
    deleteSelectedUser: vi.fn(),
  }),
}));

let TeamPanel;

beforeEach(async () => {
  vi.resetModules();
  ({ default: TeamPanel } = await import("./TeamPanel.jsx"));
});

afterEach(() => {
  cleanup();
});

describe("TeamPanel", () => {
  it("renders shared surface banner feedback for team async state", () => {
    render(<TeamPanel canManage />);

    expect(screen.getByText(/team user created/i)).toBeInTheDocument();
    expect(screen.getByText(/team management is temporarily unavailable/i)).toBeInTheDocument();
  });
});
