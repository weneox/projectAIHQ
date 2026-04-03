import SettingsSurfaceBanner from "../../../components/settings/SettingsSurfaceBanner.jsx";
import AiPolicyForm from "../../../components/settings/AiPolicyForm.jsx";

export default function AiPolicySection({
  aiPolicy,
  patchAi,
  canManage,
  surface,
}) {
  return (
    <div className="space-y-6">
      <SettingsSurfaceBanner
        surface={surface}
        unavailableMessage="AI policy settings are temporarily unavailable."
      />
      <AiPolicyForm
        aiPolicy={aiPolicy}
        patchAi={patchAi}
        canManage={canManage}
      />
    </div>
  );
}
