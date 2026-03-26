import { useCallback, useEffect, useMemo, useState } from "react";

import {
  listTeam,
  createTeamUser,
  updateTeamUser,
  setTeamUserStatus,
  deleteTeamUser,
} from "../../../api/team.js";
import { useSettingsSurfaceState } from "../../../pages/Settings/hooks/useSettingsSurfaceState.js";

export const EMPTY_TEAM_FORM = {
  user_email: "",
  full_name: "",
  role: "member",
  status: "invited",
  password: "",
};

function normalizeTeamResponseUser(payload) {
  if (!payload) return null;
  if (payload?.user) return payload.user;
  return payload;
}

export function useTeamSurface({ canManage = false }) {
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState(EMPTY_TEAM_FORM);
  const [pendingAction, setPendingAction] = useState("");
  const {
    data: items,
    surface,
    beginRefresh,
    succeedRefresh,
    failRefresh,
    beginSave,
    succeedSave,
    failSave,
    clearSaveState,
  } = useSettingsSurfaceState({
    initialData: () => [],
    initialLoading: true,
  });

  const refreshTeam = useCallback(async () => {
    beginRefresh();
    try {
      const users = await listTeam({
        role: roleFilter || undefined,
        status: statusFilter || undefined,
      });
      return succeedRefresh(Array.isArray(users) ? users : []);
    } catch (error) {
      return failRefresh(error, {
        fallbackData: [],
      });
    }
  }, [beginRefresh, failRefresh, roleFilter, statusFilter, succeedRefresh]);

  useEffect(() => {
    refreshTeam();
  }, [refreshTeam]);

  const filtered = useMemo(() => {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) return items;

    return items.filter((user) => {
      const haystack =
        `${user?.full_name || ""} ${user?.user_email || ""} ${user?.role || ""} ${user?.status || ""}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [items, query]);

  const selected = useMemo(
    () =>
      filtered.find((user) => user.id === selectedId) ||
      items.find((user) => user.id === selectedId) ||
      null,
    [filtered, items, selectedId]
  );

  useEffect(() => {
    if (selected?.id) {
      setForm({
        user_email: selected.user_email || "",
        full_name: selected.full_name || "",
        role: selected.role || "member",
        status: selected.status || "invited",
        password: "",
      });
    } else {
      setForm(EMPTY_TEAM_FORM);
    }
  }, [selected?.id]);

  useEffect(() => {
    if (selectedId && !items.some((user) => user.id === selectedId)) {
      setSelectedId(filtered[0]?.id || "");
      return;
    }

    if (!selectedId && filtered[0]?.id) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, items, selectedId]);

  const dirty = useMemo(() => {
    if (!selected) {
      return JSON.stringify(form) !== JSON.stringify(EMPTY_TEAM_FORM);
    }

    const base = {
      user_email: selected.user_email || "",
      full_name: selected.full_name || "",
      role: selected.role || "member",
      status: selected.status || "invited",
      password: "",
    };

    return JSON.stringify(form) !== JSON.stringify(base);
  }, [form, selected]);

  const resetCreateForm = useCallback(() => {
    setSelectedId("");
    setForm(EMPTY_TEAM_FORM);
    clearSaveState();
  }, [clearSaveState]);

  const runMutation = useCallback(
    async (actionKey, mutation, successMessage, onSuccess) => {
      if (!canManage) {
        failSave("Team management is limited to owner/admin access.");
        return null;
      }

      setPendingAction(actionKey);
      beginSave();

      try {
        const result = await mutation();
        await refreshTeam();
        onSuccess?.(result);
        succeedSave({ message: successMessage });
        return result;
      } catch (error) {
        failSave(error);
        throw error;
      } finally {
        setPendingAction("");
      }
    },
    [beginSave, canManage, failSave, refreshTeam, succeedSave]
  );

  const createUser = useCallback(async () => {
    const payload = {
      user_email: form.user_email,
      full_name: form.full_name,
      role: form.role,
      status: form.status,
    };

    if (String(form.password || "").trim()) {
      payload.password = String(form.password || "").trim();
    }

    return runMutation(
      "create",
      async () => {
        const result = await createTeamUser(payload);
        const user = normalizeTeamResponseUser(result);
        if (!user?.id) throw new Error("User was not created");
        return user;
      },
      "Team user created.",
      (user) => {
        if (user?.id) setSelectedId(user.id);
      }
    );
  }, [form, runMutation]);

  const saveSelectedUser = useCallback(async () => {
    if (!selected?.id) return null;

    return runMutation(
      "save",
      async () => {
        const result = await updateTeamUser(selected.id, {
          user_email: form.user_email,
          full_name: form.full_name,
          role: form.role,
          status: form.status,
        });
        const user = normalizeTeamResponseUser(result);
        if (!user?.id) throw new Error("User was not updated");
        return user;
      },
      "Team user updated.",
      (user) => {
        if (user?.id) setSelectedId(user.id);
      }
    );
  }, [form, runMutation, selected?.id]);

  const updateSelectedStatus = useCallback(
    async (status) => {
      if (!selected?.id) return null;

      return runMutation(
        `status:${status}`,
        async () => {
          const result = await setTeamUserStatus(selected.id, status);
          const user = normalizeTeamResponseUser(result);
          if (!user?.id) throw new Error("Status was not updated");
          return user;
        },
        "Team user status updated.",
        (user) => {
          if (user?.id) setSelectedId(user.id);
        }
      );
    },
    [runMutation, selected?.id]
  );

  const deleteSelectedUser = useCallback(async () => {
    if (!selected?.id) return null;

    return runMutation(
      "delete",
      async () => {
        const result = await deleteTeamUser(selected.id);
        const deletedOk = !!(result?.deleted || result?.ok || result === true);
        if (!deletedOk) throw new Error("Delete failed");
        return result;
      },
      "Team user deleted.",
      () => {
        setSelectedId("");
      }
    );
  }, [runMutation, selected?.id]);

  return {
    items,
    filtered,
    selected,
    selectedId,
    setSelectedId,
    query,
    setQuery,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    form,
    setForm,
    dirty,
    pendingAction,
    surface: {
      ...surface,
      refresh: refreshTeam,
      clearSaveState,
    },
    resetCreateForm,
    createUser,
    saveSelectedUser,
    updateSelectedStatus,
    deleteSelectedUser,
  };
}
