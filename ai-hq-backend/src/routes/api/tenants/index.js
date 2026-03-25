// src/routes/api/tenants/index.js
// FINAL FIXED — tenant admin guard only for /tenants/* routes

import express from "express";
import { createTenantsHandlers } from "./handlers.js";
import { tenantInternalRoutes } from "./internal.js";

export function tenantsRoutes({ db }) {
  const router = express.Router();
  const tenantAdminRouter = express.Router();
  const h = createTenantsHandlers({ db });

  // public/internal tenant routes
  // məsələn: /tenants/resolve-channel
  router.use("/", tenantInternalRoutes({ db }));

  // only /tenants* routes must require admin
  tenantAdminRouter.use(h.requireAdmin);

  tenantAdminRouter.get("/", h.listTenants);
  tenantAdminRouter.post("/", h.createTenant);

  tenantAdminRouter.get("/:key", h.getTenant);
  tenantAdminRouter.patch("/:key", h.patchTenant);

  tenantAdminRouter.get("/:key/users", h.listTenantUsers);
  tenantAdminRouter.get("/:key/users/:id", h.getTenantUser);
  tenantAdminRouter.post("/:key/users", h.createTenantUser);
  tenantAdminRouter.patch("/:key/users/:id", h.updateTenantUser);
  tenantAdminRouter.post("/:key/users/:id/status", h.updateTenantUserStatus);
  tenantAdminRouter.post("/:key/users/:id/password", h.updateTenantUserPassword);
  tenantAdminRouter.delete("/:key/users/:id", h.deleteTenantUser);

  tenantAdminRouter.get("/:key/export", h.exportTenantJson);
  tenantAdminRouter.get("/:key/export/csv", h.exportTenantCsv);
  tenantAdminRouter.get("/:key/export/zip", h.exportTenantZip);

  router.use("/tenants", tenantAdminRouter);

  return router;
}