import {
  ok,
  bad,
  forbidden,
  serverErr,
  safeJsonObj,
  cleanString,
  cleanLower,
  buildUserInput,
} from "./utils.js";
import {
  getAuthRole,
  canReadUsers,
  canWriteUsers,
  requireDb,
  requireTenant,
} from "./permissions.js";
import {
  getTenantOrNull,
  listTenantUsers,
  getTenantUserById,
  getTenantUserByEmail,
  createTenantUser,
  updateTenantUser,
  setTenantUserStatus,
  deleteTenantUser,
  auditSafe,
} from "./repository.js";
import { hashUserPassword } from "../../../utils/adminAuth.js";

export function createTeamHandlers({ db }) {
  async function getTeam(req, res) {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const role = getAuthRole(req);
      if (!canReadUsers(role)) {
        return forbidden(res, "You do not have access to team data");
      }

      const tenant = await getTenantOrNull(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const status = cleanLower(req.query.status || "");
      const userRole = cleanLower(req.query.role || "");

      const users = await listTenantUsers(db, tenant.id, {
        status: status || undefined,
        role: userRole || undefined,
      });

      return ok(res, {
        users,
        viewerRole: role,
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to load team");
    }
  }

  async function getTeamUser(req, res) {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const role = getAuthRole(req);
      if (!canReadUsers(role)) {
        return forbidden(res, "You do not have access to team data");
      }

      const userId = cleanString(req.params.id);
      if (!userId) return bad(res, "user id is required");

      const tenant = await getTenantOrNull(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const user = await getTenantUserById(db, tenant.id, userId);
      if (!user) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      return ok(res, { user, viewerRole: role });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to load user");
    }
  }

  async function postTeamUser(req, res) {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const role = getAuthRole(req);
      if (!canWriteUsers(role)) {
        return forbidden(res, "You do not have permission to manage team");
      }

      const tenant = await getTenantOrNull(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const input = buildUserInput(req.body);
      if (!input.user_email) {
        return bad(res, "user_email is required");
      }

      const existing = await getTenantUserByEmail(db, tenant.id, input.user_email);
      if (existing?.id) {
        return bad(res, "User already exists for this tenant", {
          userId: existing.id,
        });
      }

      const user = await createTenantUser(db, tenant.id, input);

      await auditSafe(db, req, tenant, "team.user.created", "tenant_user", user?.id, {
        user_email: input.user_email,
        role: input.role,
        status: input.status,
      });

      return ok(res, { user });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to create user");
    }
  }

  async function patchTeamUser(req, res) {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const role = getAuthRole(req);
      if (!canWriteUsers(role)) {
        return forbidden(res, "You do not have permission to manage team");
      }

      const userId = cleanString(req.params.id);
      if (!userId) return bad(res, "user id is required");

      const tenant = await getTenantOrNull(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const current = await getTenantUserById(db, tenant.id, userId);
      if (!current?.id) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      const patch = safeJsonObj(req.body, {});
      const merged = {
        ...current,
        ...patch,
      };

      const input = buildUserInput(merged);

      if (input.user_email && input.user_email !== cleanLower(current.user_email)) {
        const existingByEmail = await getTenantUserByEmail(db, tenant.id, input.user_email);
        if (existingByEmail?.id && existingByEmail.id !== current.id) {
          return bad(res, "Another user already exists with this email", {
            userId: existingByEmail.id,
          });
        }
      }

      const user = await updateTenantUser(db, tenant.id, userId, input);

      await auditSafe(db, req, tenant, "team.user.updated", "tenant_user", user?.id, {
        user_email: user?.user_email,
        role: user?.role,
        status: user?.status,
      });

      return ok(res, { user });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to update user");
    }
  }

  async function postTeamUserStatus(req, res) {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const role = getAuthRole(req);
      if (!canWriteUsers(role)) {
        return forbidden(res, "You do not have permission to manage team");
      }

      const userId = cleanString(req.params.id);
      if (!userId) return bad(res, "user id is required");

      const tenant = await getTenantOrNull(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const status = cleanLower(req.body?.status || "");
      if (!status) {
        return bad(res, "status is required");
      }

      const user = await setTenantUserStatus(db, tenant.id, userId, status);
      if (!user?.id) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      await auditSafe(db, req, tenant, "team.user.status.updated", "tenant_user", user.id, {
        status: user.status,
      });

      return ok(res, { user });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to update user status");
    }
  }

  async function postTeamUserPassword(req, res) {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const role = getAuthRole(req);
      if (!canWriteUsers(role)) {
        return forbidden(res, "You do not have permission to manage passwords");
      }

      const userId = cleanString(req.params.id);
      if (!userId) return bad(res, "user id is required");

      const password = cleanString(req.body?.password || "");
      if (!password) {
        return bad(res, "password is required");
      }

      const tenant = await getTenantOrNull(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const current = await getTenantUserById(db, tenant.id, userId);
      if (!current?.id) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      const user = await updateTenantUser(db, tenant.id, userId, {
        ...current,
        password_hash: hashUserPassword(password),
        auth_provider: "local",
        email_verified: true,
      });

      await auditSafe(db, req, tenant, "team.user.password.updated", "tenant_user", user?.id, {
        user_email: user?.user_email,
      });

      return ok(res, {
        user,
        passwordUpdated: true,
      });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to update password");
    }
  }

  async function deleteTeamUser(req, res) {
    try {
      if (!requireDb(res, db)) return;

      const tenantKey = requireTenant(req, res);
      if (!tenantKey) return;

      const role = getAuthRole(req);
      if (!canWriteUsers(role)) {
        return forbidden(res, "You do not have permission to manage team");
      }

      const userId = cleanString(req.params.id);
      if (!userId) return bad(res, "user id is required");

      const tenant = await getTenantOrNull(db, tenantKey);
      if (!tenant?.id) {
        return res.status(404).json({ ok: false, error: "Tenant not found" });
      }

      const current = await getTenantUserById(db, tenant.id, userId);
      if (!current?.id) {
        return res.status(404).json({ ok: false, error: "User not found" });
      }

      const deleted = await deleteTenantUser(db, tenant.id, userId);
      if (!deleted) {
        return bad(res, "Delete failed");
      }

      await auditSafe(db, req, tenant, "team.user.deleted", "tenant_user", current.id, {
        user_email: current.user_email,
      });

      return ok(res, { deleted: true, id: current.id });
    } catch (err) {
      return serverErr(res, err?.message || "Failed to delete user");
    }
  }

  return {
    getTeam,
    getTeamUser,
    postTeamUser,
    patchTeamUser,
    postTeamUserStatus,
    postTeamUserPassword,
    deleteTeamUser,
  };
}