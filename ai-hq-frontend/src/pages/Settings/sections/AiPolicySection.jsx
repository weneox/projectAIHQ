import AiPolicyForm from "../../../components/settings/AiPolicyForm.jsx";

export default function AiPolicySection({
  aiPolicy,
  patchAi,
  canManage,
  autoContent,
}) {
  return (
    <div className="space-y-6">
      <AiPolicyForm
        aiPolicy={aiPolicy}
        patchAi={patchAi}
        canManage={canManage}
      />
      {autoContent}
    </div>
  );
}
