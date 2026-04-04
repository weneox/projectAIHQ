import { useCallback, useEffect, useMemo, useState } from "react";

import {
  listTenants,
  listTenantUsers,
  createTenantUser,
  updateTenantUser,
  setTenantUserStatus,
  setTenantUserPassword,
  deleteTenantUser,
} from "../../api/tenants.js";
import { useAsyncSurfaceState } from "../../hooks/useAsyncSurfaceState.js";
import { useActionState } from "../../hooks/useActionState.js";

const EMPTY_CREATE = {
  email: "",
  full_name: "",
  role: "member",
  status: "active",
  password: "",
};

const EMPTY_EDIT = {
  id: "",
  email: "",
  full_name: "",
  role: "member",
  status: "invited",
};

function createEmptyData() {
  return {
    tenants: [],
    users: [],
  };
}

export function useAdminTeamSurface() {
  const [tenantKey, setTenantKey] = useState("");
  const [query, setQuery] = useState("");
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [passwordUserId, setPasswordUserId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const {
    data,
    setData,
    surface,
    beginRefresh,
    succeedRefresh,
    failRefresh,
    beginSave,
    succeedSave,
    failSave,
    clearSaveState,
  } = useAsyncSurfaceState({
    initialData: createEmptyData,
    initialLoading: true,
  });
  const actionState = useActionState();

  const tenants = data.tenants || [];
  const users = data.users || [];

  const refreshAdminTeam = useCallback(async (overrideTenantKey = tenantKey) => {
    beginRefresh();
    try {
      const rows = await listTenants();
      const nextTenants = Array.isArray(rows) ? rows : [];
      const resolvedTenantKey =
        String(overrideTenantKey || nextTenants[0]?.tenant_key || "").trim();
      const nextUsers = resolvedTenantKey ? await listTenantUsers(resolvedTenantKey) : [];

      const nextData = {
        tenants: nextTenants,
        users: Array.isArray(nextUsers) ? nextUsers : [],
      };

      if (!tenantKey && resolvedTenantKey) {
        setTenantKey(resolvedTenantKey);
      }

      return succeedRefresh(nextData);
    } catch (error) {
      return failRefresh(error, {
        fallbackData: createEmptyData(),
      });
    }
  }, [beginRefresh, failRefresh, succeedRefresh, tenantKey]);

  useEffect(() => {
    refreshAdminTeam();
  }, [refreshAdminTeam]);

  useEffect(() => {
    if (!tenantKey) return;
    refreshAdminTeam(tenantKey);
    setEditForm(EMPTY_EDIT);
    setPasswordUserId("");
    setNewPassword("");
  }, [tenantKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredUsers = useMemo(() => {
    const normalizedQuery = String(query || "").trim().toLowerCase();
    if (!normalizedQuery) return users;

    return users.filter((user) => {
      const haystack = [user?.user_email, user?.full_name, user?.role, user?.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [query, users]);

  const selectedWorkspace = useMemo(
    () => tenants.find((tenant) => tenant.tenant_key === tenantKey) || null,
    [tenantKey, tenants]
  );

  const patchCreate = useCallback((key, value) => {
    setCreateForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const patchEdit = useCallback((key, value) => {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const startEdit = useCallback((user) => {
    setEditForm({
      id: String(user?.id || ""),
      email: String(user?.user_email || ""),
      full_name: String(user?.full_name || ""),
      role: String(user?.role || "member"),
      status: String(user?.status || "invited"),
    });
  }, []);

  const createUser = useCallback(async () => {
    beginSave();
    return actionState.runAction("create-user", async () => {
      try {
        if (!tenantKey) throw new Error("Please select a workspace");
        if (!createForm.email.trim()) throw new Error("Email address is required");
        if (!createForm.full_name.trim()) throw new Error("Full name is required");

        const result = await createTenantUser(tenantKey, {
          user_email: createForm.email.trim().toLowerCase(),
          full_name: createForm.full_name.trim(),
          role: createForm.role,
          status: createForm.status,
          password: createForm.password || undefined,
        });

        setCreateForm(EMPTY_CREATE);
        await refreshAdminTeam(tenantKey);
        succeedSave({
          message: `${result?.user?.user_email || "User"} has been created.`,
        });
        return result;
      } catch (error) {
        failSave(error);
        throw error;
      }
    });
  }, [actionState, beginSave, createForm, failSave, refreshAdminTeam, succeedSave, tenantKey]);

  const saveEdit = useCallback(async () => {
    beginSave();
    return actionState.runAction("save-edit", async () => {
      try {
        if (!tenantKey) throw new Error("Please select a workspace");
        if (!editForm.id) throw new Error("Please select a user");

        const result = await updateTenantUser(tenantKey, editForm.id, {
          user_email: editForm.email.trim().toLowerCase(),
          full_name: editForm.full_name.trim(),
          role: editForm.role,
          status: editForm.status,
        });

        await refreshAdminTeam(tenantKey);
        succeedSave({
          message: `${result?.user?.user_email || "User"} has been updated.`,
        });
        return result;
      } catch (error) {
        failSave(error);
        throw error;
      }
    });
  }, [actionState, beginSave, editForm, failSave, refreshAdminTeam, succeedSave, tenantKey]);

  const updateQuickStatus = useCallback(async (userId, status) => {
    beginSave();
    return actionState.runAction(`status:${userId}:${status}`, async () => {
      try {
        if (!tenantKey) throw new Error("Please select a workspace");
        const result = await setTenantUserStatus(tenantKey, userId, status);
        await refreshAdminTeam(tenantKey);
        succeedSave({
          message: `${result?.user?.user_email || "User"} status has been updated.`,
        });
        return result;
      } catch (error) {
        failSave(error);
        throw error;
      }
    });
  }, [actionState, beginSave, failSave, refreshAdminTeam, succeedSave, tenantKey]);

  const updatePassword = useCallback(async () => {
    beginSave();
    return actionState.runAction("password", async () => {
      try {
        if (!tenantKey) throw new Error("Please select a workspace");
        if (!passwordUserId) throw new Error("Please select a user");
        if (!newPassword) throw new Error("A new password is required");
        if (newPassword.length < 8) throw new Error("Password must be at least 8 characters");

        const result = await setTenantUserPassword(tenantKey, passwordUserId, newPassword);
        setNewPassword("");
        await refreshAdminTeam(tenantKey);
        succeedSave({
          message: `${result?.user?.user_email || "User"} password has been updated.`,
        });
        return result;
      } catch (error) {
        failSave(error);
        throw error;
      }
    });
  }, [actionState, beginSave, failSave, newPassword, passwordUserId, refreshAdminTeam, succeedSave, tenantKey]);

  const removeUser = useCallback(async (userId) => {
    beginSave();
    return actionState.runAction(`delete:${userId}`, async () => {
      try {
        if (!tenantKey) throw new Error("Please select a workspace");
        await deleteTenantUser(tenantKey, userId);

        if (editForm.id === userId) setEditForm(EMPTY_EDIT);
        if (passwordUserId === userId) {
          setPasswordUserId("");
          setNewPassword("");
        }

        await refreshAdminTeam(tenantKey);
        succeedSave({
          message: "User has been deleted.",
        });
        return true;
      } catch (error) {
        failSave(error);
        throw error;
      }
    });
  }, [actionState, beginSave, editForm.id, failSave, passwordUserId, refreshAdminTeam, succeedSave, tenantKey]);

  return {
    tenants,
    users,
    tenantKey,
    setTenantKey,
    filteredUsers,
    selectedWorkspace,
    query,
    setQuery,
    createForm,
    patchCreate,
    editForm,
    patchEdit,
    passwordUserId,
    setPasswordUserId,
    newPassword,
    setNewPassword,
    surface: {
      ...surface,
      refresh: () => refreshAdminTeam(tenantKey),
      clearSaveState,
    },
    actionState,
    startEdit,
    createUser,
    saveEdit,
    updateQuickStatus,
    updatePassword,
    removeUser,
  };
}
