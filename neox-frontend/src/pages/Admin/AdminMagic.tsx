// src/pages/Admin/AdminMagic.tsx (FINAL)
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

const LS_TOKEN = "neox_admin_token";

// ✅ Set your production backend here (safe fallback when Netlify env fails)
const PROD_BACKEND = "https://neox-backend-production.up.railway.app";

type ConsumeResp = {
  ok?: boolean;
  error?: string;
  message?: string;

  token?: string; // preferred
  admin_token?: string;
  session_token?: string;
  jwt?: string;

  next?: string;
};

function getLangFromParams(lang?: string) {
  return String(lang || "az").toLowerCase();
}

function safeNextPath(nextRaw: string | null | undefined, lang: string) {
  const fallback = `/${lang}/admin/chats?focus=reply`;

  const n = String(nextRaw || "").trim();
  if (!n) return fallback;

  // allow only internal paths
  if (!n.startsWith("/")) return fallback;

  // block protocol-relative //evil.com
  if (n.startsWith("//")) return fallback;

  // ✅ if backend returns langsız /admin/..., auto prefix lang
  if (n.startsWith("/admin")) return `/${lang}${n}`;

  return n;
}

// ✅ resolves API base robustly (env > prod fallback > local)
function resolveApiBase(): string {
  const env = String((import.meta as any)?.env?.VITE_API_BASE || "").trim();
  if (env) return env.replace(/\/+$/, "");

  const host =
    typeof window !== "undefined" && window.location?.hostname ? window.location.hostname : "";

  // If running on production host or netlify preview -> use prod backend
  if (
    host &&
    (host === "weneox.com" ||
      host === "www.weneox.com" ||
      host.endsWith(".netlify.app") ||
      host.includes("netlify"))
  ) {
    return PROD_BACKEND;
  }

  // local dev fallback
  return "http://localhost:5050";
}

export default function AdminMagic() {
  const { lang: langParam } = useParams<{ lang?: string }>();
  const lang = getLangFromParams(langParam);

  const nav = useNavigate();
  const loc = useLocation();

  const qs = useMemo(() => new URLSearchParams(loc.search), [loc.search]);
  const ml = (qs.get("ml") || qs.get("token") || "").trim();
  const next = safeNextPath(qs.get("next"), lang);

  const API_BASE = useMemo(() => resolveApiBase(), []);

  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: any = null;

    async function run() {
      if (!ml) {
        setStatus("error");
        setErr("Magic link token (ml) tapılmadı.");
        return;
      }

      setStatus("loading");
      setErr(null);

      try {
        const r = await fetch(`${API_BASE}/api/admin/magic/consume`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ml }),
        });

        const j: ConsumeResp = await r.json().catch(() => ({} as any));

        if (!r.ok) {
          const msg = j?.error || j?.message || `Magic consume failed (${r.status})`;
          throw new Error(msg);
        }

        const got = (j && (j.token || j.admin_token || j.session_token || j.jwt)) || "";
        const token = String(got || "").trim();
        if (!token) throw new Error("Backend token qaytarmadı.");

        try {
          localStorage.setItem(LS_TOKEN, token);
        } catch {}

        if (!alive) return;
        setStatus("ok");

        timer = setTimeout(() => {
          nav(next, { replace: true });
        }, 80);
      } catch (e: any) {
        if (!alive) return;
        setStatus("error");

        const msg = String(e?.message || "Magic link işləmədi.").trim();

        // helpful hint if it's still pointing to localhost somewhere
        if (msg.toLowerCase().includes("failed to fetch")) {
          setErr(
            msg +
              " — API-yə qoşula bilmədi. Netlify build köhnə ola bilər: Deploy project WITHOUT cache et."
          );
        } else {
          setErr(msg);
        }
      }
    }

    run();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [ml, next, nav, API_BASE]);

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.brandRow}>
          <div style={S.dot} />
          <div style={S.brand}>NEOX ADMIN</div>
        </div>

        <div style={{ marginTop: 10, fontSize: 22, fontWeight: 950 }}>
          {status === "loading" ? "Açılır..." : status === "ok" ? "Hazır ✅" : "Magic link"}
        </div>

        <div style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,.65)" }}>
          {status === "loading" && "Təsdiqlənir və admin sessiyası yaradılır."}
          {status === "ok" && "Yönləndirilirsən..."}
          {status === "error" && "Link vaxtı bitib, səhvdir, ya da artıq istifadə olunub."}
        </div>

        {err && <div style={S.err}>{err}</div>}

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link to={`/${lang}/admin/chats`} style={S.btn}>
            Admin Chats
          </Link>
          <Link to={`/${lang}/admin/leads`} style={S.btnGhost}>
            Admin Leads
          </Link>
        </div>

        <div style={{ marginTop: 14, fontSize: 12, color: "rgba(255,255,255,.55)" }}>
          API: <code style={S.code}>{API_BASE}</code>
        </div>
      </div>
    </div>
  );
}

const S: Record<string, any> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 18,
    background:
      "radial-gradient(1200px 600px at 18% 8%, rgba(20,82,199,.22), transparent 58%), radial-gradient(900px 520px at 82% 18%, rgba(122,92,255,.16), transparent 55%), #05070f",
    color: "rgba(255,255,255,.92)",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
  },
  card: {
    width: "min(620px, 94vw)",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.05)",
    boxShadow: "0 18px 60px rgba(0,0,0,.45)",
    padding: 18,
    backdropFilter: "blur(10px)",
  },
  brandRow: { display: "flex", alignItems: "center", gap: 10 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 99,
    background: "linear-gradient(135deg, rgba(20,82,199,1), rgba(122,92,255,1))",
    boxShadow: "0 0 0 6px rgba(20,82,199,.12)",
  },
  brand: {
    fontWeight: 950,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    fontSize: 12,
    color: "rgba(255,255,255,.78)",
  },
  err: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,90,90,.28)",
    background: "rgba(255,90,90,.10)",
    color: "rgba(255,255,255,.92)",
  },
  btn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.04)",
    color: "rgba(255,255,255,.86)",
    textDecoration: "none",
  },
  btnGhost: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "transparent",
    color: "rgba(255,255,255,.74)",
    textDecoration: "none",
  },
  code: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 11,
    padding: "2px 6px",
    borderRadius: 8,
    background: "rgba(255,255,255,.06)",
    border: "1px solid rgba(255,255,255,.10)",
  },
};
