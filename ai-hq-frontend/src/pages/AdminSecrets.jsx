import { useEffect, useState } from "react";

import ProviderSecretsPanel from "../components/admin/ProviderSecretsPanel.jsx";
import { PageCanvas, PageHeader } from "../components/ui/AppShellPrimitives.jsx";
import { getAppSessionContext } from "../lib/appSession.js";
import { getControlPlanePermissions } from "../lib/controlPlanePermissions.js";

export default function AdminSecrets() {
  const [viewerRole, setViewerRole] = useState("member");

  useEffect(() => {
    let mounted = true;

    getAppSessionContext()
      .then((session) => {
        if (mounted) setViewerRole(session?.viewerRole || "member");
      })
      .catch(() => {
        if (mounted) setViewerRole("member");
      });

    return () => {
      mounted = false;
    };
  }, []);

  const permissionState = getControlPlanePermissions({ viewerRole });

  return (
    <PageCanvas className="space-y-6">
      <PageHeader
        eyebrow="Admin workspace"
        title="Provider secrets"
        description="Manage tenant provider credentials inside the same light operations system as the rest of the product."
      />

      <ProviderSecretsPanel
        canManage={permissionState.providerSecretsMutation.allowed}
        permissionMessage={permissionState.providerSecretsMutation.message}
      />
    </PageCanvas>
  );
}
