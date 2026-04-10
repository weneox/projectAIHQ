import { useEffect, useRef, useState } from "react";
import {
  LoaderCircle,
  MessageSquareText,
  SendHorizontal,
  ShieldAlert,
} from "lucide-react";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeApiBase(raw = "") {
  const clean = s(raw).replace(/\/+$/, "");
  if (!clean) return "/api";
  return /\/api$/i.test(clean) ? clean : `${clean}/api`;
}

function buildApiUrl(apiBase, path) {
  const cleanPath = s(path).startsWith("/") ? s(path) : `/${s(path)}`;
  return `${normalizeApiBase(apiBase)}${cleanPath}`;
}

function storageKeyForWidget(widgetId = "") {
  return `aihq:website-widget:${s(widgetId).toLowerCase() || "default"}`;
}

function readStoredSession(widgetId = "") {
  if (typeof window === "undefined") return "";
  try {
    return s(window.localStorage.getItem(storageKeyForWidget(widgetId)));
  } catch {
    return "";
  }
}

function writeStoredSession(widgetId = "", token = "") {
  if (typeof window === "undefined") return;
  try {
    const key = storageKeyForWidget(widgetId);
    if (token) {
      window.localStorage.setItem(key, token);
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage failures.
  }
}

async function postWidget(apiBase, path, body) {
  const response = await fetch(buildApiUrl(apiBase, path), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json; charset=utf-8",
    },
    cache: "no-store",
    credentials: "omit",
    body: JSON.stringify(body ?? {}),
  });

  const payload = await response.json().catch(() => ({
    ok: false,
    error: "invalid_response",
  }));

  if (!response.ok || payload?.ok === false) {
    const code = s(payload?.error || "request_failed");
    const error = new Error(
      buildPublicErrorMessage(code, s(payload?.details?.message))
    );
    error.code = code;
    error.payload = payload;
    error.status = response.status;
    throw error;
  }

  return payload;
}

function buildPublicErrorMessage(errorCode = "", fallback = "") {
  const safeFallback = s(fallback);

  switch (lower(errorCode)) {
    case "db disabled":
      return safeFallback || "Website chat is temporarily unavailable right now.";
    case "widgetid required":
      return safeFallback || "Website chat could not start because the widget install ID is missing.";
    case "bootstraptoken required":
      return safeFallback || "Website chat needs a fresh launch token. Reload the website page and open chat again.";
    case "website_widget_bootstrap_invalid":
      return safeFallback || "Website chat could not verify this launch request. Reload the website page and try again.";
    case "website_widget_bootstrap_expired":
      return safeFallback || "This website chat launch token expired. Reload the website page and open chat again.";
    case "website_widget_session_missing":
      return safeFallback || "Website chat session is missing. Reload the website page to start a new chat.";
    case "website_widget_session_invalid":
      return safeFallback || "This website chat session is no longer valid. Reload the website page and try again.";
    case "website_widget_session_expired":
      return safeFallback || "This website chat session expired. Reload the website page to continue.";
    case "website_widget_install_mismatch":
      return safeFallback || "This website chat launch request no longer matches the current widget installation.";
    case "website_widget_not_found":
    case "tenant not found":
      return safeFallback || "This website chat install is no longer active.";
    case "website_widget_disabled":
      return safeFallback || "Website chat is currently disabled.";
    case "website_widget_unconfigured":
      return safeFallback || "Website chat is not configured yet.";
    case "website_request_context_missing":
    case "website_request_context_mismatch":
    case "website_origin_mismatch":
      return safeFallback || "This website chat install request could not be verified for this page.";
    case "message required":
      return safeFallback || "Write a message before sending.";
    default:
      return safeFallback || "Website chat is temporarily unavailable right now.";
  }
}

function toRequestErrorMessage(error) {
  const code = s(error?.code || obj(error?.payload).error);
  const fallback = s(error?.message || error);

  if (!code && (error instanceof TypeError || /fetch|network/i.test(fallback))) {
    return "Website chat could not reach the server. Check your connection and try again.";
  }

  return buildPublicErrorMessage(code, fallback);
}

function statusTone(mode = "") {
  if (mode === "assistant_available") return "bg-emerald-50 text-emerald-700";
  if (mode === "blocked_until_repair" || mode === "blocked") {
    return "bg-rose-50 text-rose-700";
  }
  return "bg-amber-50 text-amber-700";
}

function statusLabel(mode = "") {
  if (mode === "assistant_available") return "AI available";
  if (mode === "handoff_required") return "Operator handoff";
  if (mode === "blocked_until_repair") return "AI unavailable";
  if (mode === "blocked") return "Replies blocked";
  return "Operator reply";
}

function resolveStatusView(thread = {}, automation = {}) {
  const mode = lower(automation.mode);

  if (mode === "blocked_until_repair" || mode === "blocked") {
    return {
      mode,
      summary: s(automation.summary),
    };
  }

  if (thread?.handoffActive) {
    return {
      mode: "operator_only",
      summary:
        "This conversation has been routed to an operator. Replies may take a little longer.",
    };
  }

  return {
    mode: mode || "operator_only",
    summary: s(automation.summary),
  };
}

function messageBubbleTone(message = {}) {
  if (message.role === "visitor") {
    return "ml-auto bg-slate-950 text-white";
  }

  if (message.role === "operator") {
    return "mr-auto bg-sky-50 text-slate-900 ring-1 ring-sky-100";
  }

  if (message.role === "system") {
    return "mr-auto bg-amber-50 text-slate-800 ring-1 ring-amber-100";
  }

  return "mr-auto bg-white text-slate-900 ring-1 ring-slate-200";
}

export default function PublicWebsiteWidget() {
  const params =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();
  const widgetId = s(params.get("widgetId")).toLowerCase();
  const bootstrapToken = s(params.get("bootstrapToken"));
  const apiBase = s(params.get("apiBase"));
  const accentColor = s(params.get("accent")) || "#0f172a";

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [widget, setWidget] = useState({});
  const [automation, setAutomation] = useState({});
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sessionToken, setSessionToken] = useState("");
  const [draft, setDraft] = useState("");
  const scrollRef = useRef(null);
  const retryEnvelopeRef = useRef(null);
  const pollInFlightRef = useRef(false);

  function applyConversationPayload(payload = {}) {
    setError("");
    if (payload.widget) setWidget(obj(payload.widget));
    if (payload.automation) setAutomation(obj(payload.automation));
    setThread(payload.thread || null);
    setMessages(arr(payload.messages));

    const nextSessionToken = s(payload.sessionToken);
    if (nextSessionToken) {
      setSessionToken(nextSessionToken);
      writeStoredSession(widgetId, nextSessionToken);
    }
  }

  const statusView = resolveStatusView(thread || {}, automation || {});
  const canSend = Boolean(widgetId) && Boolean(sessionToken) && !loading;

  useEffect(() => {
    const storedSessionToken = readStoredSession(widgetId);

    if (!widgetId) {
      setLoading(false);
      setError("Missing widgetId. Add the publishable widget ID to the embed configuration.");
      return;
    }

    if (!bootstrapToken && !storedSessionToken) {
      setLoading(false);
      setError("Missing bootstrap token. Reload the website page and try opening the widget again.");
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError("");

      try {
        const payload = await postWidget(apiBase, "/public/widget/bootstrap", {
          widgetId,
          bootstrapToken,
          sessionToken: storedSessionToken,
        });

        if (cancelled) return;

        applyConversationPayload(payload);
      } catch (requestError) {
        if (cancelled) return;
        if (
          ["website_widget_session_invalid", "website_widget_session_expired"].includes(
            lower(requestError?.code)
          )
        ) {
          writeStoredSession(widgetId, "");
          setSessionToken("");
        }
        setError(toRequestErrorMessage(requestError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [apiBase, bootstrapToken, widgetId]);

  useEffect(() => {
    if (!widgetId || !sessionToken) return undefined;

    let cancelled = false;

    const timer = window.setInterval(async () => {
      if (pollInFlightRef.current || sending) return;

      pollInFlightRef.current = true;

      try {
        const payload = await postWidget(apiBase, "/public/widget/transcript", {
          sessionToken,
        });

        if (cancelled) return;

        applyConversationPayload(payload);
      } catch (requestError) {
        if (
          cancelled ||
          !["website_widget_session_invalid", "website_widget_session_expired"].includes(
            lower(requestError?.code)
          )
        ) {
          return;
        }

        writeStoredSession(widgetId, "");
        setSessionToken("");
        setError(toRequestErrorMessage(requestError));
      } finally {
        pollInFlightRef.current = false;
      }
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [apiBase, sending, sessionToken, widgetId]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, loading, sending]);

  async function handleSend(event) {
    event.preventDefault();
    const text = s(draft);
    if (!text || sending || !widgetId || !sessionToken) return;

    const previousMessages = messages;
    const retryEnvelope = retryEnvelopeRef.current;
    const optimisticId =
      retryEnvelope && retryEnvelope.text === text
        ? retryEnvelope.messageId
        : `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const nextMessages = [
      ...previousMessages,
      {
        id: optimisticId,
        role: "visitor",
        direction: "inbound",
        text,
        createdAt: new Date().toISOString(),
        pending: true,
      },
    ];

    setDraft("");
    setSending(true);
    setError("");
    setMessages(nextMessages);
    retryEnvelopeRef.current = {
      text,
      messageId: optimisticId,
    };

    try {
      const payload = await postWidget(apiBase, "/public/widget/message", {
        sessionToken: sessionToken || readStoredSession(widgetId),
        text,
        messageId: optimisticId,
      });

      retryEnvelopeRef.current = null;
      applyConversationPayload(payload);
    } catch (requestError) {
      setDraft(text);
      setMessages(previousMessages);
      if (
        ["website_widget_session_invalid", "website_widget_session_expired"].includes(
          lower(requestError?.code)
        )
      ) {
        writeStoredSession(widgetId, "");
        setSessionToken("");
      }
      setError(toRequestErrorMessage(requestError));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(148,163,184,0.25),_transparent_40%),linear-gradient(180deg,_#f8fafc_0%,_#e2e8f0_100%)] p-3 text-slate-900">
      <div className="mx-auto flex h-[min(100vh-24px,720px)] w-full max-w-[420px] flex-col overflow-hidden rounded-[30px] border border-white/70 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur">
        <div className="border-b border-slate-200/80 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[18px] font-semibold tracking-[-0.03em]">
                {s(widget.title) || "Website chat"}
              </div>
              <div className="mt-1 text-[13px] leading-5 text-slate-500">
                {s(widget.subtitle) || "Ask a question or leave a message for the team."}
              </div>
            </div>

            <span
              className={[
                "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-medium",
                statusTone(s(statusView.mode)),
              ].join(" ")}
            >
              {statusLabel(s(statusView.mode))}
            </span>
          </div>

          <div
            className="mt-4 h-1.5 rounded-full"
            style={{
              backgroundColor: accentColor,
              opacity: 0.85,
            }}
          />
        </div>

        {!loading && s(statusView.summary) ? (
          <div className="border-b border-slate-200/80 bg-slate-50 px-5 py-3 text-[12px] leading-5 text-slate-600">
            {statusView.summary}
          </div>
        ) : null}

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              Preparing chat
            </div>
          ) : (
            <>
              {error ? (
                <div className="mb-3 rounded-[24px] border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>{error}</div>
                  </div>
                </div>
              ) : null}

              {messages.length ? (
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div key={message.id} className="flex flex-col gap-1">
                      <div
                        className={[
                          "max-w-[86%] rounded-[22px] px-4 py-3 text-[14px] leading-6 shadow-sm",
                          messageBubbleTone(message),
                        ].join(" ")}
                      >
                        {s(message.text) || "No text"}
                      </div>
                      <div className="px-1 text-[11px] text-slate-400">
                        {message.role === "visitor"
                          ? "You"
                          : message.role === "operator"
                            ? "Operator"
                            : message.role === "system"
                              ? "System"
                              : "Assistant"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-5 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    <MessageSquareText className="h-6 w-6" />
                  </div>
                  <div className="mt-4 text-[17px] font-semibold tracking-[-0.03em]">
                    Start the conversation
                  </div>
                  <div className="mt-2 max-w-[260px] text-[13px] leading-6 text-slate-500">
                    {thread?.handoffActive
                      ? "This conversation is waiting for an operator reply."
                      : automation.available
                        ? "Ask about services, availability, or next steps."
                        : "Your message will still reach the team even when AI is unavailable."}
                  </div>

                  {Array.isArray(widget.initialPrompts) && widget.initialPrompts.length ? (
                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                      {widget.initialPrompts.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => setDraft(prompt)}
                          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </>
          )}
        </div>

        <form onSubmit={handleSend} className="border-t border-slate-200/80 bg-white px-4 py-4">
          <div className="flex items-end gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
            <textarea
              value={draft}
              onChange={(event) => {
                const nextValue = event.target.value;
                setDraft(nextValue);

                if (
                  retryEnvelopeRef.current &&
                  s(nextValue) !== retryEnvelopeRef.current.text
                ) {
                  retryEnvelopeRef.current = null;
                }
              }}
              rows={1}
              placeholder="Write your message"
              disabled={!canSend || sending}
              className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-[14px] leading-6 text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={!s(draft) || sending || !canSend}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <SendHorizontal className="h-4 w-4" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
