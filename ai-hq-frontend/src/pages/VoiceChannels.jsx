import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Phone, Plus, Radio, ShieldCheck, TestTube2 } from "lucide-react";

import {
  confirmVoiceChannelVerification,
  createVoiceChannel,
  listVoiceChannels,
  startVoiceChannelVerification,
  testVoiceChannelRouting,
} from "../api/voice.js";
import Button from "../components/ui/Button.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
  PageHeader,
} from "../components/ui/AppShellPrimitives.jsx";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function titleize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusLabel(channel = {}) {
  const status = lower(channel.connectionStatus || channel.connection?.status);
  if (status === "live") return "Live";
  if (status === "verify_number") return "Verify number";
  if (status === "connect_routing") return "Connect routing";
  if (status === "provider_pending") return "Provider pending";
  if (status === "number_required") return "Number required";
  if (status === "failed") return "Needs review";
  return titleize(status || "Draft");
}

function statusTone(channel = {}) {
  const status = lower(channel.connectionStatus || channel.connection?.status);
  if (status === "live") return "success";
  if (status === "failed") return "danger";
  if (status === "verify_number" || status === "connect_routing") return "warning";
  return "info";
}

function nextStep(channel = {}) {
  const action = lower(channel.connectionNextAction || channel.connection?.nextAction);
  if (action === "verify_ownership") return "Start verification";
  if (action === "test_call_routing") return "Test routing";
  if (action === "connect_provider") return "Connect provider";
  if (!action) return "Ready";
  return titleize(action);
}

function visibleNumber(value = "") {
  const raw = s(value);
  if (!raw) return "No number";
  if (raw.length <= 6) return raw;
  return `${raw.slice(0, 4)} ••• ${raw.slice(-4)}`;
}

const DEFAULT_FORM = {
  provider: "sip",
  activationMode: "sip_trunk",
  label: "Main voice line",
  externalNumber: "",
  routeKey: "orders",
  defaultLanguage: "az",
};

export default function VoiceChannels() {
  const [channels, setChannels] = useState([]);
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setError("");
    setLoading(true);
    try {
      const result = await listVoiceChannels();
      setChannels(arr(result.channels));
      setSettings(result.settings || null);
    } catch (err) {
      setError(s(err?.message || err, "Voice channels yüklənmədi."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    const all = arr(channels);
    return {
      total: all.length,
      live: all.filter((channel) => lower(channel.connectionStatus) === "live").length,
      pending: all.filter((channel) => lower(channel.connectionStatus) !== "live").length,
    };
  }, [channels]);

  async function runAction(label, fn) {
    setError("");
    setNotice("");
    setBusyId(label);
    try {
      const result = await fn();
      if (Array.isArray(result?.channels)) {
        setChannels(result.channels);
      }
      if (result?.settings) {
        setSettings(result.settings);
      }
      setNotice("Voice channel updated.");
    } catch (err) {
      setError(s(err?.message || err, "Voice channel əməliyyatı alınmadı."));
    } finally {
      setBusyId("");
    }
  }

  async function handleCreate(event) {
    event.preventDefault();

    await runAction("create", async () =>
      createVoiceChannel({
        ...form,
        externalNumber: s(form.externalNumber),
      })
    );

    setForm(DEFAULT_FORM);
  }

  function updateForm(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  if (loading) {
    return (
      <PageCanvas>
        <LoadingSurface title="Voice channels yüklənir" />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas>
      <PageHeader
        eyebrow="Omnichannel voice"
        title="Voice Channels"
        description="Biznes nömrələrini əlavə et, ownership təsdiqlə, routing test et və agenti canlıya çıxart."
        actions={
          <Button leftIcon={<Radio className="h-4 w-4" />} onClick={load}>
            Refresh
          </Button>
        }
      />

      {error ? <InlineNotice tone="danger" title="Voice channel error" description={error} /> : null}
      {notice ? <InlineNotice tone="success" title="Saved" description={notice} /> : null}

      <section className="grid gap-4 lg:grid-cols-3">
        {[
          ["Total channels", summary.total],
          ["Live lines", summary.live],
          ["Needs setup", summary.pending],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[28px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text-subtle">{label}</div>
            <div className="mt-3 text-3xl font-semibold text-text">{value}</div>
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="space-y-3">
          {channels.length ? (
            channels.map((channel) => (
              <article key={channel.id} className="rounded-[30px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-line-soft bg-surface-subtle">
                      <Phone className="h-5 w-5 text-text" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-text">{s(channel.label, "Voice number")}</h2>
                        <span className="rounded-full border border-line-soft px-2.5 py-1 text-xs font-semibold text-text-muted">
                          {titleize(channel.provider)}
                        </span>
                        <span className="rounded-full border border-line-soft px-2.5 py-1 text-xs font-semibold text-text-muted">
                          {titleize(channel.activationMode)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-text-muted">
                        {visibleNumber(channel.externalNumber)} · route: {s(channel.routeKey, "default")}
                      </p>
                      <p className="mt-2 text-sm text-text-muted">
                        Next: {nextStep(channel)}
                      </p>
                    </div>
                  </div>

                  <InlineNotice
                    tone={statusTone(channel)}
                    title={statusLabel(channel)}
                    description={
                      lower(channel.connectionStatus) === "live"
                        ? "Bu nömrə agent üçün canlıdır."
                        : "Bu xətt hələ onboarding mərhələsindədir."
                    }
                  />
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-3">
                  <Button
                    variant="secondary"
                    leftIcon={<ShieldCheck className="h-4 w-4" />}
                    loading={busyId === `verify-start:${channel.id}`}
                    onClick={() =>
                      runAction(`verify-start:${channel.id}`, () =>
                        startVoiceChannelVerification(channel.id, { method: "voice_code" })
                      )
                    }
                  >
                    Start verify
                  </Button>
                  <Button
                    variant="secondary"
                    leftIcon={<CheckCircle2 className="h-4 w-4" />}
                    loading={busyId === `verify-confirm:${channel.id}`}
                    onClick={() =>
                      runAction(`verify-confirm:${channel.id}`, () =>
                        confirmVoiceChannelVerification(channel.id, { confirmed: true })
                      )
                    }
                  >
                    Confirm
                  </Button>
                  <Button
                    variant="secondary"
                    leftIcon={<TestTube2 className="h-4 w-4" />}
                    loading={busyId === `routing:${channel.id}`}
                    onClick={() =>
                      runAction(`routing:${channel.id}`, () =>
                        testVoiceChannelRouting(channel.id, {})
                      )
                    }
                  >
                    Test routing
                  </Button>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[30px] border border-dashed border-line-soft bg-white p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-line-soft bg-surface-subtle">
                <Phone className="h-6 w-6 text-text" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-text">No voice channels yet</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-muted">
                İlk restoran, klinika və ya satış nömrəni əlavə et. Sonra ownership və routing statuslarını addım-addım tamamlayacağıq.
              </p>
            </div>
          )}
        </section>

        <aside className="rounded-[30px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-soft bg-surface-subtle">
              <Plus className="h-5 w-5 text-text" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text">Add number</h2>
              <p className="text-sm text-text-muted">SIP, forwarding və ya Twilio xətti əlavə et.</p>
            </div>
          </div>

          <form className="space-y-3" onSubmit={handleCreate}>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">Provider</span>
              <select
                className="w-full rounded-2xl border border-line-soft bg-white px-3 py-2 text-sm text-text outline-none focus:border-text"
                value={form.provider}
                onChange={(event) => updateForm("provider", event.target.value)}
              >
                <option value="sip">Local SIP</option>
                <option value="twilio">Twilio</option>
                <option value="browser_lab">Browser Lab</option>
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">Connect method</span>
              <select
                className="w-full rounded-2xl border border-line-soft bg-white px-3 py-2 text-sm text-text outline-none focus:border-text"
                value={form.activationMode}
                onChange={(event) => updateForm("activationMode", event.target.value)}
              >
                <option value="sip_trunk">SIP trunk</option>
                <option value="call_forwarding">Call forwarding</option>
                <option value="twilio_number">Twilio number</option>
                <option value="browser_lab">Browser lab</option>
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">Label</span>
              <input
                className="w-full rounded-2xl border border-line-soft bg-white px-3 py-2 text-sm text-text outline-none focus:border-text"
                value={form.label}
                onChange={(event) => updateForm("label", event.target.value)}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">Number</span>
              <input
                className="w-full rounded-2xl border border-line-soft bg-white px-3 py-2 text-sm text-text outline-none focus:border-text"
                placeholder="+994..."
                value={form.externalNumber}
                onChange={(event) => updateForm("externalNumber", event.target.value)}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">Route</span>
              <input
                className="w-full rounded-2xl border border-line-soft bg-white px-3 py-2 text-sm text-text outline-none focus:border-text"
                value={form.routeKey}
                onChange={(event) => updateForm("routeKey", event.target.value)}
              />
            </label>

            <Button className="w-full" leftIcon={<Plus className="h-4 w-4" />} loading={busyId === "create"}>
              Add voice channel
            </Button>
          </form>

          <div className="mt-5 rounded-2xl border border-line-soft bg-surface-subtle p-4 text-sm leading-6 text-text-muted">
            Görünən flow rahatdır: nömrəni əlavə et, ownership təsdiqlə, routing test et, sonra live statusuna keç.
          </div>

          {settings ? (
            <div className="mt-3 text-xs text-text-subtle">
              Settings loaded · provider: {s(settings.provider, "voice")}
            </div>
          ) : null}
        </aside>
      </div>
    </PageCanvas>
  );
}
