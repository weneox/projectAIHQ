import { describe, expect, it } from "vitest";

import {
  getControlPlanePermissions,
  isOwnerOrAdminRole,
  normalizeViewerRole,
} from "./controlPlanePermissions.js";

describe("controlPlanePermissions", () => {
  it("normalizes unknown roles to member", () => {
    expect(normalizeViewerRole("OWNER")).toBe("owner");
    expect(normalizeViewerRole("mystery")).toBe("member");
  });

  it("treats only internal/owner/admin as sensitive control-plane writers", () => {
    expect(isOwnerOrAdminRole("internal")).toBe(true);
    expect(isOwnerOrAdminRole("owner")).toBe(true);
    expect(isOwnerOrAdminRole("admin")).toBe(true);
    expect(isOwnerOrAdminRole("operator")).toBe(false);
  });

  it("prefers explicit capability flags when present", () => {
    const permissions = getControlPlanePermissions({
      viewerRole: "owner",
      capabilities: {
        canManageOperationalSettings: false,
      },
      permissions: {
        setupReviewFinalize: {
          allowed: false,
          message: "Finalize is temporarily locked.",
        },
      },
    });

    expect(permissions.operationalSettingsWrite.allowed).toBe(false);
    expect(permissions.setupReviewFinalize.allowed).toBe(false);
    expect(permissions.setupReviewFinalize.message).toMatch(/temporarily locked/i);
    expect(permissions.providerSecretsMutation.allowed).toBe(true);
    expect(permissions.auditHistoryRead.allowed).toBe(true);
  });
});
