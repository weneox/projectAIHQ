import WorkspaceGeneralForm from "../../../components/settings/WorkspaceGeneralForm.jsx";

export default function GeneralSection({
  tenantKey,
  tenant,
  patchTenant,
  canManage,
}) {
  return (
    <WorkspaceGeneralForm
      tenantKey={tenantKey}
      tenant={tenant}
      patchTenant={patchTenant}
      canManage={canManage}
    />
  );
}
