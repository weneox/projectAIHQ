// src/pages/Admin/AdminLayout.tsx
import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useParams } from "react-router-dom";
import { AdminProvider, useAdmin } from "./adminContext";

type Lang = "az" | "en" | "tr" | "ru" | "es";
const LANGS: Lang[] = ["az", "en", "tr", "ru", "es"];

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function getLangFromPath(minPathname: string): Lang {
  const seg = (minPathname.split("/")[1] || "").toLowerCase();
  return (LANGS as string[]).includes(seg) ? (seg as Lang) : "az";
}

function withLang(path: string, lang: Lang) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `/${lang}${p}`;
}

function normalizeBase(v: any) {
  return String(v || "").trim().replace(/\/+$/, "");
}

/**
 * ✅ IMPORTANT:
 * Cloudflare Pages-də bəzən build zamanı VITE_API_BASE boş gələ bilər.
 * Bu halda API_BASE "" olur və app same-origin (/api/...) çağırır,
 * Pages isə HTML qaytarır -> JSON parse partlayır.
 *
 * Fix:
 * - Əgər VITE_API_BASE varsa -> onu istifadə et
 * - Əgər yoxdursa:
 *    - localhost-da -> local dev API
 *    - prod domenlərdə -> Railway prod API
 */
const ENV_API_BASE = normalizeBase((import.meta as any)?.env?.VITE_API_BASE || "");
const PROD_API = "https://neox-backend-production.up.railway.app";
const DEV_API = "http://localhost:5050";

const API_BASE =
  ENV_API_BASE ||
  (typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
    ? DEV_API
    : PROD_API);

/* ------------------ small hooks ------------------ */
function useIsMobile(breakpoint = 900) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width:${breakpoint}px)`).matches;
  });

  useEffect(() => {
    const mq = window.matchMedia(`(max-width:${breakpoint}px)`);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    if ((mq as any).addEventListener) mq.addEventListener("change", onChange);
    else (mq as any).addListener?.(onChange);
    return () => {
      if ((mq as any).removeEventListener) mq.removeEventListener("change", onChange);
      else (mq as any).removeListener?.(onChange);
    };
  }, [breakpoint]);

  return isMobile;
}

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const body = document.body;
    const html = document.documentElement;

    const prevOverflow = body.style.overflow;
    const prevPosition = body.style.position;
    const prevTop = body.style.top;
    const prevWidth = body.style.width;
    const prevOverscroll = (html.style as any).overscrollBehaviorY;

    const scrollY = window.scrollY || 0;

    if (locked) {
      body.style.overflow = "hidden";
      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.width = "100%";
      (html.style as any).overscrollBehaviorY = "none";
    }

    return () => {
      if (!locked) return;
      body.style.overflow = prevOverflow;
      body.style.position = prevPosition;
      body.style.top = prevTop;
      body.style.width = prevWidth;
      (html.style as any).overscrollBehaviorY = prevOverscroll;

      const y = Math.abs(parseInt(body.style.top || "0", 10)) || scrollY;
      window.scrollTo(0, y);
      body.style.top = prevTop;
    };
  }, [locked]);
}

async function fetchWithAuth(url: string, token: string) {
  return fetch(url, {
    headers: {
      "x-admin-token": token,
      Authorization: `Bearer ${token}`,
    },
  });
}

/* ------------------ Login Card ------------------ */
function AdminLoginCard() {
  const { apiBase, token, setToken } = useAdmin();
  const [temp, setTemp] = useState(token);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTemp(token || "");
  }, [token]);

  async function doLogin() {
    const t = temp.trim();
    if (!t) return setErr("Token yaz.");

    setLoading(true);
    setErr(null);

    try {
      const base = normalizeBase(apiBase);
      const tryUrls = [`${base}/api/leads`, `${base}/api/admin/leads`];

      let ok = false;
      let lastStatus = 0;
      let lastText = "";

      for (const url of tryUrls) {
        const r = await fetchWithAuth(url, t);
        lastStatus = r.status;

        if (r.status === 401) {
          ok = false;
          lastText = "Token səhvdir.";
          break;
        }

        if (r.ok) {
          ok = true;
          break;
        }

        lastText = await r.text().catch(() => "");
      }

      if (!ok) {
        if (lastStatus === 401) return setErr("Token səhvdir.");
        return setErr(`Xəta: ${lastStatus} ${String(lastText || "").trim()}`.trim());
      }
    } catch {
      return setErr("Backend-ə qoşulmaq olmur. API_BASE düz deyil?");
    } finally {
      setLoading(false);
    }

    setToken(t);
    setErr(null);
  }

  return (
    <div style={S.page}>
      <div style={S.shellCenter}>
        <div style={S.loginCard}>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={S.brandRow}>
              <div style={S.brandDot} />
              <div style={S.brandText}>NEOX Admin</div>
            </div>

            <div style={S.loginTitle}>Daxil ol</div>
            <div style={S.loginSub}>
              Token-i bir dəfə yaz — yadda qalacaq. (<code style={S.codeMini}>ADMIN_TOKEN</code>)
            </div>

            {err && <div style={S.error}>{err}</div>}

            <input
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
              placeholder="ADMIN TOKEN"
              style={S.input}
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
            />
            <button onClick={doLogin} style={S.btnPrimary} disabled={loading}>
              {loading ? "Yoxlanır..." : "Daxil ol"}
            </button>

            <div style={S.tip}>
              Backend test:{" "}
              <code style={S.codeMini}>{(normalizeBase(apiBase) || "(same-origin)")}/health</code>
              <span style={{ opacity: 0.7 }}> • API_BASE: </span>
              <code style={S.codeMini}>{normalizeBase(apiBase) || "(same-origin)"}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------ Scaffold (Responsive) ------------------ */
function AdminScaffold() {
  const loc = useLocation();
  const params = useParams<{ lang?: string }>();

  const lang = useMemo<Lang>(
    () => (params.lang as Lang) || getLangFromPath(loc.pathname),
    [params.lang, loc.pathname]
  );

  const isMobile = useIsMobile(900);

  const { token, logout, adminLang, setAdminLang, langs, apiBase } = useAdmin();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useBodyScrollLock(Boolean(isMobile && drawerOpen));

  useEffect(() => {
    setDrawerOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    if (!isMobile) setDrawerOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const nav = [
    { to: withLang("/admin/leads", lang), label: "Leads" },
    { to: withLang("/admin/chats", lang), label: "Chats" },
    { to: withLang("/admin/blog", lang), label: "Blog" },
    { to: withLang("/admin/products", lang), label: "Shop" },
    { to: withLang("/admin/media", lang), label: "Media" },
  ];

  if (!token) return <AdminLoginCard />;

  return (
    <div style={S.page}>
      <div style={S.shellWide}>
        {/* Topbar */}
        <div style={S.topbar}>
          <div style={{ minWidth: 0 }}>
            <div style={S.topTitleRow}>
              {isMobile && (
                <button onClick={() => setDrawerOpen(true)} style={S.iconBtn} aria-label="Open menu">
                  ☰
                </button>
              )}
              <div style={S.topTitle}>NEOX Dashboard</div>
            </div>

            <div style={S.topSubWrap}>
              <span>
                Route: <code style={S.codeMini}>{loc.pathname}</code>
              </span>
              <span>
                • Token: <b style={{ color: "rgba(255,255,255,.92)" }}>ON</b>
              </span>
              <span>
                • API: <code style={S.codeMini}>{normalizeBase(apiBase) || "(same-origin)"}</code>
              </span>
            </div>
          </div>

          <div style={S.topActions}>
            <select
              value={adminLang}
              onChange={(e) => setAdminLang(e.target.value as any)}
              style={S.langSelect}
              aria-label="Admin panel dili"
            >
              {langs.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>

            <button onClick={logout} style={S.btnGhost}>
              Çıxış
            </button>
          </div>
        </div>

        {/* Layout */}
        <div style={isMobile ? S.mainStack : S.mainGrid}>
          {!isMobile && (
            <aside style={S.sidebarSticky}>
              <div style={S.sideHead}>ADMIN</div>
              <div style={S.sideList}>
                {nav.map((x) => (
                  <NavLink
                    key={x.to}
                    to={x.to}
                    style={({ isActive }) => ({
                      ...S.sideItem,
                      ...(isActive ? S.sideItemActive : null),
                    })}
                  >
                    <div style={S.sideLabel}>{x.label}</div>
                    <div style={S.sideDot} />
                  </NavLink>
                ))}
              </div>
              <div style={S.sideFoot}>
                headers: <code style={S.codeMini}>x-admin-token</code> /{" "}
                <code style={S.codeMini}>Authorization</code>
                <div style={{ marginTop: 6, opacity: 0.8 }}>
                  admin_lang: <code style={S.codeMini}>{adminLang}</code>
                </div>
              </div>
            </aside>
          )}

          {/* Mobile drawer */}
          {isMobile && (
            <>
              <div
                style={{
                  ...S.drawerOverlay,
                  opacity: drawerOpen ? 1 : 0,
                  pointerEvents: drawerOpen ? "auto" : "none",
                }}
                onClick={() => setDrawerOpen(false)}
              />
              <aside
                style={{
                  ...S.drawer,
                  transform: drawerOpen ? "translateX(0)" : "translateX(-104%)",
                }}
              >
                <div style={S.drawerTop}>
                  <div style={S.drawerBrand}>
                    <div style={S.brandDotSmall} />
                    <div style={S.drawerTitle}>ADMIN</div>
                  </div>
                  <button onClick={() => setDrawerOpen(false)} style={S.iconBtn}>
                    ✕
                  </button>
                </div>

                <div style={S.sideList}>
                  {nav.map((x) => (
                    <NavLink
                      key={x.to}
                      to={x.to}
                      style={({ isActive }) => ({
                        ...S.sideItem,
                        ...(isActive ? S.sideItemActive : null),
                      })}
                    >
                      <div style={S.sideLabel}>{x.label}</div>
                      <div style={S.sideDot} />
                    </NavLink>
                  ))}
                </div>

                <div style={S.sideFoot}>
                  headers: <code style={S.codeMini}>x-admin-token</code> /{" "}
                  <code style={S.codeMini}>Authorization</code>
                  <div style={{ marginTop: 6, opacity: 0.8 }}>
                    admin_lang: <code style={S.codeMini}>{adminLang}</code>
                  </div>
                </div>
              </aside>
            </>
          )}

          <section style={S.content}>
            <Outlet />
          </section>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <AdminProvider apiBase={API_BASE}>
      <AdminScaffold />
    </AdminProvider>
  );
}

/* ------------------ styles ------------------ */
const S: Record<string, any> = {
  page: {
    minHeight: "100dvh",
    paddingTop: "calc(14px + env(safe-area-inset-top))",
    paddingBottom: "calc(14px + env(safe-area-inset-bottom))",
    paddingLeft: "calc(14px + env(safe-area-inset-left))",
    paddingRight: "calc(14px + env(safe-area-inset-right))",
    background:
      "radial-gradient(1200px 600px at 18% 8%, rgba(20,82,199,.22), transparent 58%), radial-gradient(900px 520px at 82% 18%, rgba(122,92,255,.16), transparent 55%), #05070f",
    color: "rgba(255,255,255,.92)",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
    overflowX: "hidden",
  },

  shellCenter: {
    maxWidth: 980,
    margin: "0 auto",
    paddingTop: 30,
    display: "grid",
    placeItems: "center",
  },
  shellWide: { maxWidth: 1240, margin: "0 auto" },

  topbar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,.10)",
    background: "linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.03))",
    boxShadow: "0 18px 60px rgba(0,0,0,.35)",
    marginBottom: 12,
    backdropFilter: "blur(10px)",
    overflow: "hidden",
  },

  topTitleRow: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  topTitle: {
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: ".02em",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  // ✅ mobile wrap + clean
  topSubWrap: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(255,255,255,.65)",
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    rowGap: 6,
    overflow: "hidden",
  },

  topActions: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  langSelect: {
    height: 40,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.04)",
    color: "rgba(255,255,255,.88)",
    cursor: "pointer",
    outline: "none",
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "260px minmax(0, 1fr)",
    gap: 12,
    alignItems: "start",
  },
  mainStack: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 12,
    alignItems: "start",
  },

  sidebarSticky: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.03)",
    boxShadow: "0 18px 60px rgba(0,0,0,.30)",
    overflow: "hidden",
    backdropFilter: "blur(10px)",
    position: "sticky",
    top: 14,
  },

  sideHead: {
    padding: "14px 14px 10px",
    borderBottom: "1px solid rgba(255,255,255,.08)",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: ".18em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,.78)",
    background: "rgba(0,0,0,.14)",
  },

  sideList: { padding: 10, display: "grid", gap: 8 },

  sideItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "13px 12px",
    borderRadius: 14,
    textDecoration: "none",
    color: "rgba(255,255,255,.78)",
    border: "1px solid rgba(255,255,255,.08)",
    background: "rgba(0,0,0,.12)",
    transition: "transform .15s ease, background .15s ease, border-color .15s ease",
  },

  sideItemActive: {
    color: "rgba(255,255,255,.92)",
    borderColor: "rgba(20,82,199,.35)",
    background: "linear-gradient(135deg, rgba(20,82,199,.22), rgba(122,92,255,.14))",
    transform: "translateY(-1px)",
  },

  sideLabel: { fontSize: 14, fontWeight: 900 },
  sideDot: { width: 8, height: 8, borderRadius: 99, background: "rgba(255,255,255,.22)" },

  sideFoot: {
    padding: 12,
    borderTop: "1px solid rgba(255,255,255,.08)",
    fontSize: 12,
    color: "rgba(255,255,255,.55)",
    background: "rgba(0,0,0,.10)",
  },

  content: { minHeight: 200, minWidth: 0, overflowX: "hidden" },

  drawerOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.55)",
    backdropFilter: "blur(6px)",
    transition: "opacity .18s ease",
    zIndex: 2000,
  },

  drawer: {
    position: "fixed",
    top: 0,
    left: 0,
    height: "100dvh",
    width: "min(88vw, 320px)",
    background: "rgba(10,12,22,.92)",
    borderRight: "1px solid rgba(255,255,255,.10)",
    boxShadow: "18px 0 60px rgba(0,0,0,.45)",
    zIndex: 2001,
    paddingTop: "calc(14px + env(safe-area-inset-top))",
    paddingBottom: "calc(14px + env(safe-area-inset-bottom))",
    transition: "transform .18s ease",
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    willChange: "transform",
  },

  drawerTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    padding: "0 12px 10px",
    borderBottom: "1px solid rgba(255,255,255,.08)",
  },

  drawerBrand: { display: "flex", alignItems: "center", gap: 10 },

  drawerTitle: {
    fontSize: 12,
    fontWeight: 950,
    letterSpacing: ".18em",
    textTransform: "uppercase",
    color: "rgba(255,255,255,.78)",
  },

  iconBtn: {
    height: 40,
    minWidth: 40,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.04)",
    color: "rgba(255,255,255,.88)",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },

  loginCard: {
    width: "min(560px, 92vw)",
    borderRadius: 20,
    border: "1px solid rgba(255,255,255,.10)",
    background: "rgba(255,255,255,.05)",
    boxShadow: "0 18px 60px rgba(0,0,0,.45)",
    padding: 18,
    backdropFilter: "blur(10px)",
  },

  brandRow: { display: "flex", alignItems: "center", gap: 10 },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 99,
    background: "linear-gradient(135deg, rgba(20,82,199,1), rgba(122,92,255,1))",
    boxShadow: "0 0 0 6px rgba(20,82,199,.12)",
  },
  brandDotSmall: {
    width: 9,
    height: 9,
    borderRadius: 99,
    background: "linear-gradient(135deg, rgba(20,82,199,1), rgba(122,92,255,1))",
    boxShadow: "0 0 0 5px rgba(20,82,199,.10)",
  },
  brandText: {
    fontWeight: 950,
    letterSpacing: ".08em",
    textTransform: "uppercase",
    fontSize: 12,
    color: "rgba(255,255,255,.78)",
  },

  loginTitle: { marginTop: 6, fontSize: 26, fontWeight: 980, letterSpacing: ".01em" },
  loginSub: { marginTop: 2, fontSize: 13, color: "rgba(255,255,255,.65)" },
  tip: { marginTop: 4, fontSize: 12, color: "rgba(255,255,255,.55)" },

  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "rgba(255,255,255,.04)",
    color: "rgba(255,255,255,.92)",
    outline: "none",
  },

  btnGhost: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.12)",
    background: "transparent",
    color: "rgba(255,255,255,.74)",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },

  btnPrimary: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(20,82,199,.35)",
    background: "linear-gradient(135deg, rgba(20,82,199,.85), rgba(122,92,255,.55))",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },

  error: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,90,90,.28)",
    background: "rgba(255,90,90,.10)",
    color: "rgba(255,255,255,.92)",
  },

  codeMini: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 11,
    padding: "2px 6px",
    borderRadius: 8,
    background: "rgba(255,255,255,.06)",
    border: "1px solid rgba(255,255,255,.10)",
  },
};
