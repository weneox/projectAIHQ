import { useEffect, useState } from "react";
import { ArrowRight, Building2, User2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Button from "../components/ui/Button.jsx";
import Input from "../components/ui/Input.jsx";
import {
  LoadingSurface,
  PageCanvas,
  PageHeader,
  Surface,
} from "../components/ui/AppShellPrimitives.jsx";
import { saveBusinessProfile } from "../api/setup.js";
import {
  clearAppBootstrapContext,
  getAppAuthContext,
  getAppBootstrapContext,
} from "../lib/appSession.js";
import {
  isWelcomeIdentityComplete,
  resolveWelcomeIdentitySeed,
  writeWelcomeIdentity,
} from "../lib/welcomeIdentity.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function WelcomeField({ icon: Icon, label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-text">
        <Icon className="h-4 w-4 text-text-subtle" />
        {label}
      </div>
      <Input value={value} onChange={onChange} placeholder={placeholder} appearance="product" />
    </label>
  );
}

export default function Welcome() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    companyName: "",
  });

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const auth = await getAppAuthContext();
        if (!alive) return;

        if (!auth?.authenticated) {
          navigate("/login", { replace: true });
          return;
        }

        const bootstrap = await getAppBootstrapContext().catch(() => ({}));
        if (!alive) return;

        if (isWelcomeIdentityComplete({ auth, bootstrap })) {
          navigate("/home", { replace: true });
          return;
        }

        setForm(resolveWelcomeIdentitySeed({ auth, bootstrap }));
        setLoading(false);
      } catch {
        if (!alive) return;
        setLoading(false);
        setError("We could not prepare your workspace welcome right now.");
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [navigate]);

  function patchField(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    if (error) setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    const payload = {
      firstName: s(form.firstName),
      lastName: s(form.lastName),
      companyName: s(form.companyName),
    };

    if (!payload.firstName || !payload.lastName || !payload.companyName) {
      setError("Add your name and company to continue.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      writeWelcomeIdentity(payload);

      try {
        await saveBusinessProfile({
          companyName: payload.companyName,
          displayName: payload.companyName,
          name: payload.companyName,
        });
        clearAppBootstrapContext();
      } catch {}

      navigate("/home", { replace: true });
    } catch {
      setError("We could not save your workspace identity right now.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PageCanvas className="px-4 py-5 md:px-6 md:py-7 xl:px-0">
        <LoadingSurface
          title="Preparing welcome"
          description="Loading the workspace identity step."
        />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas className="space-y-6 px-4 py-5 md:px-6 md:py-7 xl:px-0">
      <PageHeader
        eyebrow="Welcome"
        title="A quick identity pass."
        description="Just the essentials, then the real product."
      />

      <div className="mx-auto max-w-[760px]">
        <Surface
          shadow="sm"
          className="rounded-[30px] bg-[linear-gradient(180deg,rgba(var(--color-surface),0.98),rgba(var(--color-surface-muted),0.96))] p-6 sm:p-8"
        >
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <WelcomeField
                icon={User2}
                label="First name"
                value={form.firstName}
                onChange={(event) => patchField("firstName", event.target.value)}
                placeholder="First name"
              />
              <WelcomeField
                icon={User2}
                label="Last name"
                value={form.lastName}
                onChange={(event) => patchField("lastName", event.target.value)}
                placeholder="Last name"
              />
            </div>

            <WelcomeField
              icon={Building2}
              label="Company"
              value={form.companyName}
              onChange={(event) => patchField("companyName", event.target.value)}
              placeholder="Company name"
            />

            {error ? (
              <div className="rounded-soft border border-danger bg-danger-soft px-4 py-3 text-sm text-danger">
                {error}
              </div>
            ) : null}

            <div className="flex items-center justify-end border-t border-line-soft pt-5">
              <Button
                type="submit"
                size="hero"
                disabled={saving}
                rightIcon={!saving ? <ArrowRight className="h-4 w-4" /> : undefined}
              >
                {saving ? "Continuing..." : "Enter workspace"}
              </Button>
            </div>
          </form>
        </Surface>
      </div>
    </PageCanvas>
  );
}
