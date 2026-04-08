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

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function buildPageContext(params) {
  return {
    url: s(params.get("pageUrl")),
    title: s(params.get("pageTitle")),
    referrer: s(params.get("referrer")),
    origin: s(params.get("origin")),
  };
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

function storageKeyForTenant(tenantKey = "") {
  return `aihq:website-widget:${s(tenantKey).toLowerCase() || "default"}`;
}

function readStoredSession(tenantKey = "") {
  if (typeof window === "undefined") return "";
  try {
    return s(window.localStorage.getItem(storageKeyForTenant(tenantKey)));
  } catch {
    return "";
  }
}

function writeStoredSession(tenantKey = "", token = "") {
  if (typeof window === "undefined") return;
  try {
    const key = storageKeyForTenant(tenantKey);
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
    credentials: "omit",
    body: JSON.stringify(body ?? {}),
  });

  const payload = await response.json().catch(() => ({
    ok: false,
    error: "invalid_response",
  }));

  if (!response.ok || payload?.ok === false) {
    const error = new Error(
      s(payload?.details?.message || payload?.error || "Request failed")
    );
    error.payload = payload;
    throw error;
  }

  return payload;
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
  const tenantKey = s(params.get("tenantKey")).toLowerCase();
  const apiBase = s(params.get("apiBase"));
  const pageContext = buildPageContext(params);
  const pageUrl = s(pageContext.url);
  const pageTitle = s(pageContext.title);
  const pageReferrer = s(pageContext.referrer);
  const pageOrigin = s(pageContext.origin);
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

  useEffect(() => {
    if (!tenantKey) {
      setLoading(false);
      setError("Missing tenantKey. Add it to the widget embed configuration.");
      return;
    }

    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError("");

      try {
        const payload = await postWidget(apiBase, "/public/widget/bootstrap", {
          tenantKey,
          sessionToken: readStoredSession(tenantKey),
          page: {
            url: pageUrl,
            title: pageTitle,
            referrer: pageReferrer,
            origin: pageOrigin,
          },
        });

        if (cancelled) return;

        setWidget(obj(payload.widget));
        setAutomation(obj(payload.automation));
        setThread(payload.thread || null);
        setMessages(Array.isArray(payload.messages) ? payload.messages : []);
        setSessionToken(s(payload.sessionToken));
        writeStoredSession(tenantKey, s(payload.sessionToken));
      } catch (requestError) {
        if (cancelled) return;
        setError(s(requestError?.message || requestError));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [apiBase, pageOrigin, pageReferrer, pageTitle, pageUrl, tenantKey]);

  useEffect(() => {
    if (!tenantKey || !sessionToken || !thread?.id) return undefined;

    const timer = window.setInterval(async () => {
      try {
        const payload = await postWidget(apiBase, "/public/widget/transcript", {
          tenantKey,
          sessionToken,
          page: {
            url: pageUrl,
            title: pageTitle,
            referrer: pageReferrer,
            origin: pageOrigin,
          },
        });

        setThread(payload.thread || null);
        setMessages(Array.isArray(payload.messages) ? payload.messages : []);
        if (payload.sessionToken) {
          setSessionToken(s(payload.sessionToken));
          writeStoredSession(tenantKey, s(payload.sessionToken));
        }
      } catch {
        // Keep the last known transcript if polling fails.
      }
    }, 4000);

    return () => window.clearInterval(timer);
  }, [apiBase, pageOrigin, pageReferrer, pageTitle, pageUrl, sessionToken, tenantKey, thread?.id]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, loading, sending]);

  async function handleSend(event) {
    event.preventDefault();
    const text = s(draft);
    if (!text || sending || !tenantKey) return;

    const optimisticId = `local-${Date.now()}`;
    const nextMessages = [
      ...messages,
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

    try {
      const payload = await postWidget(apiBase, "/public/widget/message", {
        tenantKey,
        sessionToken: sessionToken || readStoredSession(tenantKey),
        text,
        messageId: optimisticId,
        page: {
          url: pageUrl,
          title: pageTitle,
          referrer: pageReferrer,
          origin: pageOrigin,
        },
      });

      setWidget(obj(payload.widget));
      setAutomation(obj(payload.automation));
      setThread(payload.thread || null);
      setMessages(Array.isArray(payload.messages) ? payload.messages : []);
      setSessionToken(s(payload.sessionToken));
      writeStoredSession(tenantKey, s(payload.sessionToken));
    } catch (requestError) {
      setDraft(text);
      setMessages(messages);
      setError(s(requestError?.message || requestError));
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
                statusTone(s(automation.mode)),
              ].join(" ")}
            >
              {statusLabel(s(automation.mode))}
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

        {!loading && s(automation.summary) ? (
          <div className="border-b border-slate-200/80 bg-slate-50 px-5 py-3 text-[12px] leading-5 text-slate-600">
            {automation.summary}
          </div>
        ) : null}

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              Preparing chat
            </div>
          ) : error ? (
            <div className="rounded-[24px] border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <div>{error}</div>
              </div>
            </div>
          ) : messages.length ? (
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
                {automation.available
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
        </div>

        <form onSubmit={handleSend} className="border-t border-slate-200/80 bg-white px-4 py-4">
          <div className="flex items-end gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={1}
              placeholder="Write your message"
              className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-[14px] leading-6 text-slate-900 outline-none placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={!s(draft) || sending || loading || !tenantKey}
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
