import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import Input from "../ui/Input.jsx";
import SettingsSurfaceBanner from "./SettingsSurfaceBanner.jsx";
import { useSecretsSurface } from "./hooks/useSecretsSurface.js";

export default function SecretsPanel({ canManage = false, permissionMessage = "" }) {
  const {
    provider,
    setProvider,
    presetKeys,
    secretKey,
    setSecretKey,
    secretValue,
    setSecretValue,
    secrets,
    surface,
    saveSecret,
    removeSecret,
  } = useSecretsSurface({ canManage });

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Provider Secrets
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Tenant-specific provider secrets are managed here. Values stay masked and never appear in standard operator payloads.
          </p>
        </div>

        <SettingsSurfaceBanner
          surface={surface}
          unavailableMessage="Secret management is temporarily unavailable."
          refreshLabel="Refresh Secrets"
        />

        {!canManage ? (
          <div className="rounded-[20px] border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
            {permissionMessage || "Provider secret changes stay behind owner/admin access."}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Provider
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              disabled={!canManage}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none ring-0 transition focus:border-slate-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
            >
              <option value="meta">Meta</option>
              <option value="cloudinary">Cloudinary</option>
              <option value="together">Together</option>
              <option value="openai">OpenAI</option>
              <option value="twilio">Twilio</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Secret Key
            </label>
            <Input
              value={secretKey}
              onChange={(e) => setSecretKey(String(e.target.value || "").trim().toLowerCase())}
              placeholder={presetKeys[0] || "api_key"}
              disabled={!canManage}
            />
            {presetKeys.length ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {presetKeys.map((keyName) => (
                  <button
                    key={keyName}
                    type="button"
                    onClick={() => setSecretKey(keyName)}
                    disabled={!canManage}
                    className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white"
                  >
                    {keyName}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Secret Value
            </label>
            <Input
              value={secretValue}
              onChange={(e) => setSecretValue(e.target.value)}
              placeholder="Enter secret value"
              type="password"
              disabled={!canManage}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={saveSecret} disabled={!canManage || surface.saving}>
            {surface.saving ? "Saving..." : "Save Secret"}
          </Button>

          <Button variant="secondary" onClick={surface.refresh} disabled={surface.loading || surface.saving}>
            Refresh
          </Button>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-white/10">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 dark:border-white/10 dark:text-slate-200">
            Saved secrets: {provider}
          </div>

          {surface.loading ? (
            <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
              Loading secrets...
            </div>
          ) : secrets.length === 0 ? (
            <div className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">
              No saved secrets for this provider yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-white/10">
              {secrets.map((row) => (
                <div
                  key={`${row.provider}:${row.secret_key}:${row.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 dark:text-white">
                      {row.secret_key}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {row.masked_value || "***"} · v{row.version || 1}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSecretKey(row.secret_key)}
                      disabled={!canManage}
                    >
                      Use Key
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeSecret(row.secret_key)}
                      disabled={!canManage || surface.saving}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
