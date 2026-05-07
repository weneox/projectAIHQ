import { useEffect, useState } from "react";
import { ArrowRight, Building2, User2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Button from "../components/ui/Button.jsx";
import Input from "../components/ui/Input.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";
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
  return String(value ?? fallback).trim();
}

function ignoreError() {
  return undefined;
}

function WelcomeField({ icon: Icon, label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
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

function StepCard({ label, value, hint, tone = "neutral" }) {
  return (
    <Card padded="sm" tone={tone}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
        {label}
      </div>

      <div className="mt-2 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
        {value}
      </div>

      {hint ? (
        <div className="mt-1 text-[13px] font-medium leading-5 text-text-muted">
          {hint}
        </div>
      ) : null}
    </Card>
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
      <PageCanvas className="max-w-[920px]">
        <LoadingSurface
          title="Preparing welcome"
          description="Loading the workspace identity step."
        />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas className="max-w-[1040px] space-y-5">
      <section className="border-b border-line-soft pb-5">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0 max-w-[760px]">
            <Badge tone="brand" size="sm">
              Welcome
            </Badge>

            <h1 className="mt-4 font-display text-[32px] font-semibold leading-[1.02] tracking-[var(--tracking-tight-xl)] text-text md:text-[38px]">
              A quick identity pass.
            </h1>

            <p className="mt-3 max-w-[620px] text-[15px] font-medium leading-7 tracking-[var(--tracking-tight-sm)] text-text-muted">
              Just the essentials, then into the launch lane.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-[420px]">
            <StepCard
              label="Step"
              value="Identity"
              tone="brand"
              hint="One small pass."
            />
            <StepCard
              label="Next"
              value="Launch lane"
              hint="Then straight into the product."
            />
          </div>
        </div>
      </section>

      <Card padded="lg" className="max-w-[760px]">
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
            <InlineNotice tone="danger" description={error} compact />
          ) : null}

          <div className="flex items-center justify-end border-t border-line-soft pt-5">
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