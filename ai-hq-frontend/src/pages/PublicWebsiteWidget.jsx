import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  Loader2,
  MessageCircle,
  Send,
} from "lucide-react";

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
    origin: s(
      params.get("origin") ||
        window.location.ancestorOrigins?.[0] ||
        document.referrer ||
        window.location.origin
    ),
  };
}

function buildBootstrapUrl({ tenantKey = "", widgetId = "", origin = "" } = {}) {
  const query = new URLSearchParams();

  if (tenantKey) query.set("tenantKey", tenantKey);
  if (widgetId) query.set("widgetId", widgetId);
  if (origin) query.set("origin", origin);

  return apiUrl("/api/channels/webchat/bootstrap?" + query.toString());
}

function buildMessageUrl() {
  return apiUrl("/api/channels/webchat/message");
}

function normalizeWidgetReply(payload = {}) {
  const root = obj(payload);
  const assistant = obj(root.assistant);

  return {
    ok: root.ok === true,
    received: root.received === true,
    reasonCode: s(root.reasonCode),
    message: s(root.message || root.error),
    sessionId: s(root.sessionId),
    threadId: s(root.threadId),
    messageId: s(root.messageId),
    assistant: {
      mode: s(assistant.mode, "manual_first"),
      text: s(
        assistant.text,
        root.received === true
          ? "Thanks — your message was received. Our team can review it and reply shortly."
          : "Website chat is temporarily unavailable."
      ),
      source: obj(assistant.source, null),
      guard: obj(assistant.guard, null),
    },
  };
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
      statusLabel: s(
        assistant.statusLabel,
        root.live === true ? "Live" : "Setup required"
      ),
      initialPrompts: arr(assistant.initialPrompts)
        .map((item) => s(item))
        .filter(Boolean),
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
  const title = s(assistant.title, brand + " chat");
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

function LiveWidgetShell({ payload, params = {}, brand = "Website" }) {
  const assistant = obj(payload.assistant);
  const prompts = arr(assistant.initialPrompts).slice(0, 4);
  const accentColor = s(assistant.accentColor, "#0f172a");
  const title = s(assistant.title, brand + " chat");
  const subtitle = s(
    assistant.subtitle,
    "Ask a question and our team will help you."
  );

  const [messageDraft, setMessageDraft] = useState("");
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      text: "Salam! Mən yalnız təsdiqlənmiş biznes məlumatlarına əsasən kömək edə bilərəm.",
    },
  ]);
  const [sending, setSending] = useState(false);

  async function sendMessage() {
    const text = s(messageDraft);
    if (!text || sending) return;

    setMessages((items) => [
      ...items,
      {
        id: "local-" + Date.now(),
        role: "visitor",
        text,
      },
    ]);
    setMessageDraft("");
    setSending(true);

    try {
      const response = await fetch(buildMessageUrl(), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json; charset=utf-8",
        },
        credentials: "omit",
        body: JSON.stringify({
          tenantKey: params.tenantKey || payload.tenantKey,
          widgetId: params.widgetId || payload.widgetId,
          origin: params.origin || payload.origin,
          text,
        }),
      });

      const reply = normalizeWidgetReply(await response.json().catch(() => ({})));

      setMessages((items) => [
        ...items,
        {
          id: reply.messageId || "reply-" + Date.now(),
          role: reply.received ? "assistant" : "system",
          text: reply.assistant.text || reply.message,
          mode: reply.assistant.mode,
          source: reply.assistant.source,
          guard: reply.assistant.guard,
        },
      ]);
    } catch (error) {
      setMessages((items) => [
        ...items,
        {
          id: "error-" + Date.now(),
          role: "system",
          text: s(error?.message, "Website chat is temporarily unavailable."),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleComposerKeyDown(event) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    sendMessage();
  }

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

      <div className="flex-1 space-y-3 bg-slate-50 px-4 py-4">
        {messages.map((message) => {
          const visitor = message.role === "visitor";
          const system = message.role === "system";

          return (
            <div
              key={message.id}
              className={
                visitor
                  ? "ml-auto max-w-[84%] rounded-[20px] bg-slate-950 px-4 py-3 text-[13px] leading-6 text-white shadow-sm"
                  : system
                    ? "mx-auto max-w-[92%] rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-center text-[12.5px] font-medium leading-6 text-amber-800"
                    : "mr-auto max-w-[86%] rounded-[20px] bg-white px-4 py-3 text-[13px] leading-6 text-slate-800 shadow-sm ring-1 ring-slate-200"
              }
            >
              {message.text}

              {message.role === "assistant" &&
              message.mode === "approved_truth_answer" ? (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.10em] text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.1} />
                  Approved business info
                </div>
              ) : null}

              {message.role === "assistant" &&
              message.mode === "approved_truth_answer" &&
              s(message.source?.title) ? (
                <div className="mt-1 text-[10.5px] font-medium leading-4 text-slate-400">
                  Source: {s(message.source.title)}
                </div>
              ) : null}
            </div>
          );
        })}

        <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12.5px] font-medium leading-6 text-emerald-800">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.1} />
            <span>
              {payload.controls?.publicAnswering
                ? "Public answers are limited to approved business information."
                : "Messages are captured safely. Public AI answers stay manual-first until approved runtime answering is enabled."}
            </span>
          </div>
        </div>

        {prompts.length ? (
          <div className="flex flex-wrap gap-2">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setMessageDraft(prompt)}
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
            value={messageDraft}
            onChange={(event) => setMessageDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            disabled={sending}
            placeholder={sending ? "Sending..." : "Write your message"}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] font-medium text-slate-700 outline-none placeholder:text-slate-400 disabled:text-slate-400"
          />
          <button
            type="button"
            disabled={sending || !s(messageDraft)}
            onClick={sendMessage}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-white transition-opacity disabled:cursor-not-allowed disabled:bg-slate-300"
            aria-label="Send message"
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
        title: params.brand + " chat",
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
              title: params.brand + " chat",
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
          <LiveWidgetShell
            payload={payload}
            params={params}
            brand={params.brand}
          />
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
