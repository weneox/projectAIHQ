import Card from "../components/ui/Card.jsx";
import SecretsPanel from "../components/settings/SecretsPanel.jsx";

export default function AdminSecrets() {
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

      <SecretsPanel canManage />
    </div>
  );
}