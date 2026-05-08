import { useEffect, useState } from "react";
import { ArrowRight, Building2, User2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Button from "../components/ui/Button.jsx";
import Input from "../components/ui/Input.jsx";
import Card from "../components/ui/Card.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
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
  return String(value ?? fallback).trim() || fallback;
}

function ignoreError() {
  return undefined;
}

function WelcomeField({ icon: Icon, label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-text-muted">
        <Icon className="h-4 w-4 text-text-subtle" strokeWidth={2.05} />
        {label}
      </div>

      <Input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        appearance="quiet"
      />
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
      } catch {
        ignoreError();
      }

      navigate("/home", { replace: true });
    } catch {
      setError("We could not save your workspace identity right now.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PageCanvas className="max-w-[780px] py-3">
        <LoadingSurface
          title="Preparing workspace"
          description="Loading the identity step."
        />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas className="max-w-[820px] py-3">
      <Card padded={false} clip className="shadow-[0_28px_80px_-64px_rgba(15,23,42,0.55)]">
        <div className="px-6 py-6">
          <div className="text-[12px] font-semibold text-brand">
            Welcome
          </div>

          <h1 className="mt-2 text-[22px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
            Set up your workspace identity
          </h1>

          <p className="mt-2 max-w-[620px] text-[13.5px] font-medium leading-6 text-text-muted">
            Add the basic identity used inside the workspace. Business details can be refined later.
          </p>
        </div>

        <form className="border-t border-line-soft px-6 py-6" onSubmit={handleSubmit}>
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

          <div className="mt-4">
            <WelcomeField
              icon={Building2}
              label="Company"
              value={form.companyName}
              onChange={(event) => patchField("companyName", event.target.value)}
              placeholder="Company name"
            />
          </div>

          {error ? (
            <div className="mt-4">
              <InlineNotice tone="danger" description={error} compact />
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-end border-t border-line-soft pt-5">
            <Button
              type="submit"
              size="md"
              disabled={saving}
              loading={saving}
              rightIcon={
                !saving ? <ArrowRight className="h-4 w-4" strokeWidth={2.1} /> : undefined
              }
            >
              {saving ? "Continuing..." : "Enter workspace"}
            </Button>
          </div>
        </form>
      </Card>
    </PageCanvas>
  );
}