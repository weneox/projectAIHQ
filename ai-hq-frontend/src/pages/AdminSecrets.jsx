import { useEffect, useState } from "react";

import Card from "../components/ui/Card.jsx";
import SecretsPanel from "../components/settings/SecretsPanel.jsx";
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
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-1">
          <div className="text-xl font-semibold text-slate-900 dark:text-white">
            Admin · Secrets
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Tenant provider secret-lərini ayrıca admin zonasında idarə et.
          </div>
        </div>
      </Card>

      <SecretsPanel
        canManage={permissionState.providerSecretsMutation.allowed}
        permissionMessage={permissionState.providerSecretsMutation.message}
      />
    </div>
  );
}
