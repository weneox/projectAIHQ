import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../api/team.js", () => ({
  listTeam: vi.fn(),
  createTeamUser: vi.fn(),
  updateTeamUser: vi.fn(),
  setTeamUserStatus: vi.fn(),
  deleteTeamUser: vi.fn(),
}));

import { createTeamUser, listTeam } from "../../../api/team.js";
import { useTeamSurface } from "./useTeamSurface.js";

describe("useTeamSurface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes the shared surface contract while loading team data", async () => {
    listTeam.mockResolvedValue([{ id: "user-1", user_email: "owner@example.com", status: "active" }]);

    const { result } = renderHook(() => useTeamSurface({ canManage: true }));

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
    });

    expect(result.current.items).toHaveLength(1);
    expect(typeof result.current.surface.refresh).toBe("function");
  });

  it("uses shared save-state vocabulary for team user creation", async () => {
    listTeam.mockResolvedValue([]);
    createTeamUser.mockResolvedValue({
      id: "user-2",
      user_email: "operator@example.com",
      full_name: "Operator",
      role: "operator",
      status: "invited",
    });

    const { result } = renderHook(() => useTeamSurface({ canManage: true }));

    await waitFor(() => {
      expect(result.current.surface.ready).toBe(true);
    });

    act(() => {
      result.current.setForm((state) => ({
        ...state,
        user_email: "operator@example.com",
        full_name: "Operator",
        role: "operator",
        status: "invited",
      }));
    });

    await result.current.createUser();

    await waitFor(() => {
      expect(result.current.surface.saveSuccess).toMatch(/team user created/i);
    });
  });
});
