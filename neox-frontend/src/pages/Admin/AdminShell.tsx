import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function AdminShell() {
  const loc = useLocation();

  const items = [
    { to: "leads", label: "Leads" },
    { to: "chats", label: "AI Chats" },
    { to: "blog", label: "Blog" },
    { to: "shop", label: "Shop" },
    { to: "media", label: "Media" },
    { to: "settings", label: "Settings" },
  ];

  return (
    <div style={S.page}>
      <div style={S.shell}>
        <aside style={S.side}>
          <div style={S.brand}>
            <div style={S.dot} />
            <div>
              <div style={S.brandTop}>NEOX</div>
              <div style={S.brandSub}>Admin Suite</div>
            </div>
          </div>

          <div style={S.nav}>
            {items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end
                style={({ isActive }) => ({
                  ...S.navItem,
                  ...(isActive ? S.navItemActive : null),
                })}
              >
                {it.label}
              </NavLink>
            ))}
          </div>

          <div style={S.sideFoot}>
            <div style={S.footHint}>Route</div>
            <div style={S.footPath}>{loc.pathname}</div>
          </div>
        </aside>

        <main style={S.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const S: Record<string, any> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(1200px 600px at 18% 8%, rgba(20,82,199,.22), transparent 58%), radial-gradient(900px 520px at 82% 18%, rgba(122,92,255,.16), transparent 55%), #05070f",
    color: "rgba(255,255,255,.92)",
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
  },
  shell: { display: "grid", gridTemplateColumns: "260px 1fr", minHeight: "100vh" },
  side: {
    borderRight: "1px solid rgba(255,255,255,.10)",
    background: "rgba(0,0,0,.18)",
    backdropFilter: "blur(12px)",
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },
  brand: { display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 14, border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.04)" },
  dot: { width: 10, height: 10, borderRadius: 99, background: "linear-gradient(135deg, rgba(20,82,199,1), rgba(122,92,255,1))", boxShadow: "0 0 0 6px rgba(20,82,199,.12)" },
  brandTop: { fontWeight: 950, letterSpacing: ".14em", fontSize: 12 },
  brandSub: { marginTop: 2, fontSize: 12, color: "rgba(255,255,255,.62)" },
  nav: { display: "grid", gap: 8, marginTop: 6 },
  navItem: {
    textDecoration: "none",
    color: "rgba(255,255,255,.78)",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,.08)",
    background: "rgba(255,255,255,.02)",
  },
  navItemActive: {
    color: "rgba(255,255,255,.92)",
    border: "1px solid rgba(20,82,199,.28)",
    background: "linear-gradient(135deg, rgba(20,82,199,.22), rgba(122,92,255,.12))",
  },
  sideFoot: { marginTop: "auto", paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.08)" },
  footHint: { fontSize: 11, color: "rgba(255,255,255,.55)", letterSpacing: ".18em", textTransform: "uppercase" },
  footPath: { marginTop: 6, fontSize: 12, color: "rgba(255,255,255,.78)" },
  main: { padding: 18 },
};
