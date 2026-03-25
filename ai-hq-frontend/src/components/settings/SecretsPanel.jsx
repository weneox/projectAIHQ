import { useEffect, useMemo, useState } from "react";
import Card from "../ui/Card.jsx";
import Button from "../ui/Button.jsx";
import Input from "../ui/Input.jsx";
import {
  getAdminSecrets,
  saveAdminSecret,
  deleteAdminSecret,
} from "../../api/adminSecrets.js";

const PROVIDER_PRESETS = {
  meta: ["page_access_token", "page_id", "ig_user_id", "app_secret"],
  cloudinary: ["cloud_name", "api_key", "api_secret", "folder"],
  together: ["api_key", "image_model"],
  openai: ["api_key", "model"],
  twilio: ["account_sid", "auth_token", "api_key", "api_secret", "phone_number"],
};

function clean(x) {
  return String(x || "").trim();
}

function lower(x) {
  return clean(x).toLowerCase();
}

export default function SecretsPanel({ canManage = false }) {
  const [provider, setProvider] = useState("meta");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [secrets, setSecrets] = useState([]);

  const [secretKey, setSecretKey] = useState("");
  const [secretValue, setSecretValue] = useState("");

  const presetKeys = useMemo(() => {
    return PROVIDER_PRESETS[provider] || [];
  }, [provider]);

  async function loadSecrets(nextProvider = provider) {
    setLoading(true);
    setMessage("");
    try {
      const rows = await getAdminSecrets(nextProvider);
      setSecrets(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setMessage(String(e?.message || e));
      setSecrets([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSecrets(provider);
  }, [provider]);

  async function onSave() {
    if (!canManage) {
      setMessage("Secrets yalnız owner/admin tərəfindən idarə oluna bilər.");
      return;
    }

    const p = lower(provider);
    const k = lower(secretKey);
    const v = clean(secretValue);

    if (!p) {
      setMessage("Provider seçilməlidir.");
      return;
    }

    if (!k) {
      setMessage("Secret key tələb olunur.");
      return;
    }

    if (!v) {
      setMessage("Secret value tələb olunur.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      await saveAdminSecret(p, k, v);
      setSecretValue("");
      setSecretKey("");
      await loadSecrets(p);
      setMessage(`✅ ${p}.${k} yadda saxlanıldı.`);
    } catch (e) {
      setMessage(String(e?.message || e));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(k) {
    if (!canManage) {
      setMessage("Secrets yalnız owner/admin tərəfindən idarə oluna bilər.");
      return;
    }

    const p = lower(provider);
    const key = lower(k);
    if (!p || !key) return;

    try {
      await deleteAdminSecret(p, key);
      await loadSecrets(p);
      setMessage(`🗑️ ${p}.${key} silindi.`);
    } catch (e) {
      setMessage(String(e?.message || e));
    }
  }

  return (
    <Card className="p-6">
      <div className="space-y-6">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
            Provider Secrets
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Tenant-ə məxsus gizli provider məlumatları burada saxlanılır. Dəyərlər maskalanmış görünür.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Provider
            </label>
            <select
              value={provider}
              onChange={(e) => {
                const p = lower(e.target.value);
                setProvider(p);
                setSecretKey("");
                setSecretValue("");
              }}
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
              onChange={(e) => setSecretKey(lower(e.target.value))}
              placeholder={presetKeys[0] || "api_key"}
            />
            {presetKeys.length ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {presetKeys.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSecretKey(k)}
                    className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:border-white/20 dark:hover:text-white"
                  >
                    {k}
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
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={onSave} disabled={!canManage || saving}>
            {saving ? "Saving..." : "Save Secret"}
          </Button>

          <Button variant="secondary" onClick={() => loadSecrets(provider)} disabled={loading}>
            Refresh
          </Button>

          {message ? (
            <div className="text-sm text-slate-500 dark:text-slate-400">{message}</div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-white/10">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 dark:border-white/10 dark:text-slate-200">
            Saved secrets: {provider}
          </div>

          {loading ? (
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
                    >
                      Use Key
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onDelete(row.secret_key)}
                      disabled={!canManage}
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