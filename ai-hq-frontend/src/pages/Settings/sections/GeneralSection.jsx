import SettingsSurfaceBanner from "../../../components/settings/SettingsSurfaceBanner.jsx";
import WorkspaceGeneralForm from "../../../components/settings/WorkspaceGeneralForm.jsx";

export default function GeneralSection({
  tenantKey,
  tenant,
  patchTenant,
  canManage,
  surface,
}) {
  return (
    <div className="space-y-4">
      <SettingsSurfaceBanner
        surface={surface}
        unavailableMessage="Workspace settings are temporarily unavailable."
      />
      <WorkspaceGeneralForm
        tenantKey={tenantKey}
        tenant={tenant}
        patchTenant={patchTenant}
        canManage={canManage}
      />
    </div>
  );
}
