import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Loader2, MessageCircle, Send } from "lucide-react";

import { apiUrl } from "../api/client.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function getWidgetParams() {
  if (typeof window === "undefined") {
    return {
      tenantKey: "",
      widgetId: "",
      brand: "Website",
      origin: "",
    };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    tenantKey: s(
      params.get("tenantKey") ||
        params.get("workspace") ||
        params.get("tenant")
    ),
    widgetId: s(params.get("widgetId") || params.get("id") || params.get("w")),
    brand: s(
      params.get("brand") ||
        params.get("workspace") ||
        params.get("tenant"),
      "Website"
    ),
    origin: s(params.get("origin") || window.location.ancestorOrigins?.[0] || document.referrer || window.location.origin),
  };
}

function buildBootstrapUrl({ tenantKey = "", widgetId = "", origin = "" } = {}) {
  const query = new URLSearchParams();

  if (tenantKey) query.set("tenantKey", tenantKey);
  if (widgetId) query.set("widgetId", widgetId);
  if (origin) query.set("origin", origin);

  return apiUrl(`/api/channels/webchat/bootstrap?${query.toString()}`);
}

function normalizeBootstrapPayload(payload = {}) {
  const root = obj(payload);
  const assistant = obj(root.assistant);
  const controls = obj(root.controls);

  return {
    ok: root.ok === true,
    live: root.live === true,
    reasonCode: s(root.reasonCode),
    message: s(root.message),
    widgetId: s(root.widgetId),
    tenantKey: s(root.tenantKey),
    origin: s(root.origin),
    assistant: {
      title: s(assistant.title, "Website chat"),
      subtitle: s(
        assistant.subtitle,
        "Ask a question and our team will help you."
      ),
      accentColor: s(assistant.accentColor, "#0f172a"),
      statusLabel: s(assistant.statusLabel, root.live === true ? "Live" : "Setup required"),
      initialPrompts: arr(assistant.initialPrompts).map((item) => s(item)).filter(Boolean),
    },
    controls: {
      manualFirst: controls.manualFirst !== false,
      approvedTruthOnly: controls.approvedTruthOnly !== false,
      publicAnswering: controls.publicAnswering === true,
      messageCaptureReady: controls.messageCaptureReady === true,
    },
  };
}

function GuardedState({ payload, brand = "Website" }) {
  const assistant = obj(payload.assistant);
  const title = s(assistant.title, `${brand} chat`);
  const message = s(
    payload.message,
    "This widget is guarded until setup is complete."
  );

  return (
    <>
      <header className="border-b border-slate-200/80 bg-[linear-gradient(180deg,#FFFFFF_0%,#F7F9FC_100%)] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
            <MessageCircle className="h-5 w-5" strokeWidth={2.05} />
          </div>

          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold tracking-[-0.02em] text-slate-950">
              {title}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12px] font-semibold text-amber-700">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              {s(assistant.statusLabel, "Setup required")}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 py-10 text-center">
        <div className="max-w-[280px]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700">
            <CircleAlert className="h-6 w-6" strokeWidth={2.05} />
          </div>

          <h1 className="mt-5 text-[18px] font-semibold tracking-[-0.025em] text-slate-950">
            Website chat is not live yet
          </h1>

          <p className="mt-2 text-[13px] font-medium leading-6 text-slate-600">
            {message}
          </p>

          {payload.reasonCode ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {payload.reasonCode}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function LiveWidgetShell({ payload, brand = "Website" }) {
  const assistant = obj(payload.assistant);
  const prompts = arr(assistant.initialPrompts).slice(0, 4);
  const accentColor = s(assistant.accentColor, "#0f172a");
  const title = s(assistant.title, `${brand} chat`);
  const subtitle = s(
    assistant.subtitle,
    "Ask a question and our team will help you."
  );

  return (
    <>
      <header className="border-b border-slate-200/80 bg-[linear-gradient(180deg,#FFFFFF_0%,#F7F9FC_100%)] px-5 py-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]"
            style={{ backgroundColor: accentColor }}
          >
            <MessageCircle className="h-5 w-5" strokeWidth={2.05} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold tracking-[-0.02em] text-slate-950">
              {title}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {s(assistant.statusLabel, "Live")}
            </div>
            <div className="mt-1 line-clamp-2 text-[12px] font-medium leading-5 text-slate-500">
              {subtitle}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 bg-slate-50 px-4 py-4">
        <div className="mr-auto max-w-[86%] rounded-[20px] bg-white px-4 py-3 text-[13px] leading-6 text-slate-800 shadow-sm ring-1 ring-slate-200">
          Salam! Mən yalnız təsdiqlənmiş biznes məlumatlarına əsasən kömək edə bilərəm.
        </div>

        <div className="mt-3 rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12.5px] font-medium leading-6 text-emerald-800">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.1} />
            <span>
              Website Chat live shell is ready. Message capture is the next runtime step.
            </span>
          </div>
        </div>

        {prompts.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11.5px] font-semibold text-slate-600 shadow-sm"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <footer className="border-t border-slate-200/80 bg-white px-4 py-3">
        <div className="flex items-center gap-2 rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-2">
          <input
            disabled
            placeholder="Message flow is being prepared"
            className="min-w-0 flex-1 bg-transparent text-[12.5px] font-medium text-slate-500 outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            disabled
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-300 text-white"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={2.1} />
          </button>
        </div>
      </footer>
    </>
  );
}

export default function PublicWebsiteWidget() {
  const params = useMemo(() => getWidgetParams(), []);
  const [state, setState] = useState({
    loading: true,
    payload: normalizeBootstrapPayload({
      ok: false,
      live: false,
      message: "Loading Website Chat...",
      assistant: {
        title: `${params.brand} chat`,
        statusLabel: "Loading",
      },
    }),
  });

  useEffect(() => {
    let active = true;

    async function loadBootstrap() {
      try {
        const response = await fetch(
          buildBootstrapUrl({
            tenantKey: params.tenantKey,
            widgetId: params.widgetId,
            origin: params.origin,
          }),
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            credentials: "omit",
          }
        );

        const payload = await response.json().catch(() => ({}));

        if (!active) return;

        setState({
          loading: false,
          payload: normalizeBootstrapPayload(payload),
        });
      } catch (error) {
        if (!active) return;

        setState({
          loading: false,
          payload: normalizeBootstrapPayload({
            ok: false,
            live: false,
            reasonCode: "website_widget_bootstrap_network_error",
            message: s(error?.message, "Website chat is temporarily unavailable."),
            assistant: {
              title: `${params.brand} chat`,
              statusLabel: "Unavailable",
            },
          }),
        });
      }
    }

    loadBootstrap();

    return () => {
      active = false;
    };
  }, [params]);

  const payload = state.payload;

  return (
    <main className="min-h-screen bg-transparent p-3 font-sans text-slate-950 antialiased">
      <section className="mx-auto flex min-h-[420px] w-full max-w-[380px] flex-col overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_28px_80px_-52px_rgba(15,23,42,0.85)]">
        {state.loading ? (
          <div className="flex flex-1 items-center justify-center px-6 py-10 text-center">
            <div>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600">
                <Loader2 className="h-6 w-6 animate-spin" strokeWidth={2.05} />
              </div>
              <div className="mt-4 text-[14px] font-semibold text-slate-800">
                Loading Website Chat
              </div>
            </div>
          </div>
        ) : payload.live ? (
          <LiveWidgetShell payload={payload} brand={params.brand} />
        ) : (
          <GuardedState payload={payload} brand={params.brand} />
        )}

        <div className="border-t border-slate-200/80 bg-slate-50 px-5 py-3">
          <div className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Powered by AIHQ
          </div>
        </div>
      </section>
    </main>
  );
}
