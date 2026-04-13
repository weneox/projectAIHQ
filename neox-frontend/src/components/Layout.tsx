// src/components/Layout.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Helmet } from "@vuer-ai/react-helmet-async";
import Header from "./Header";
import Footer from "./Footer";
import NeoxAIWidget from "./NeoxAIWidget";
import SmoothWheelScroll from "./SmoothWheelScroll";

const LANGS = ["az", "en", "tr", "ru", "es"] as const;
type Lang = (typeof LANGS)[number];

function getLangFromPath(pathname: string): Lang {
  const seg = (pathname.split("/")[1] || "").toLowerCase();
  return (LANGS as readonly string[]).includes(seg) ? (seg as Lang) : "az";
}

function stripLang(pathname: string) {
  const seg = (pathname.split("/")[1] || "").toLowerCase();
  if ((LANGS as readonly string[]).includes(seg)) {
    const rest = pathname.replace(new RegExp(`^/${seg}`), "");
    return rest || "/";
  }
  return pathname || "/";
}

function buildLocalizedUrl(base: string, lang: Lang, restPath: string) {
  const p = restPath === "/" ? "" : restPath;
  return `${base}/${lang}${p}`;
}

function SeoHreflangCanonical() {
  const { pathname } = useLocation();

  const base = "https://weneox.com";
  const lang = getLangFromPath(pathname);
  const restPath = stripLang(pathname);

  const canonical = `${base}${pathname}`;

  const alternates = useMemo(() => {
    return LANGS.map((l) => ({
      hrefLang: l,
      href: buildLocalizedUrl(base, l, restPath),
    }));
  }, [restPath]);

  return (
    <Helmet>
      <html lang={lang} />
      <link rel="canonical" href={canonical} />

      {alternates.map((a) => (
        <link key={a.hrefLang} rel="alternate" hrefLang={a.hrefLang} href={a.href} />
      ))}

      <link rel="alternate" hrefLang="x-default" href={`${base}/`} />
    </Helmet>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);

  // ✅ admin route detection: /az/admin və /az/admin/...
  const isAdminRoute = useMemo(() => {
    const p = location.pathname || "";
    return /^\/(az|en|tr|ru|es)\/admin(\/|$)/.test(p);
  }, [location.pathname]);

  // ✅ Page enter trigger (mobil üçün kritik)
  const [enterKey, setEnterKey] = useState(0);
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    // native scroll reset (səndəki kimi saxladım)
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (shellRef.current) shellRef.current.scrollTop = 0;

    setEntering(false);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setEnterKey((k) => k + 1);
        setEntering(true);
      });
    });
  }, [location.pathname]);

  return (
    <div ref={shellRef} className="app-shell">
      {/* ✅ Smooth wheel scroll: wrapper DEYİL, children qəbul etmir */}
      {/* ✅ Route dəyişəndə reset üçün locationKey veririk */}
      {/* ✅ Admin səhifələrində söndürürük */}
      <SmoothWheelScroll enabled={!isAdminRoute} locationKey={location.pathname} />

      <SeoHreflangCanonical />

      <Header introReady={true} />

      <main
        ref={mainRef as any}
        key={(location.key || location.pathname) + ":" + enterKey}
        className={`neox-main page-stage ${entering ? "is-entering" : ""}`}
        role="main"
        style={{ overflow: "visible", position: "relative" }}
      >
        {children}
      </main>

      {/* ✅ Admin-də widget TAM söndürülür */}
      {!isAdminRoute && <NeoxAIWidget />}

      <Footer />
    </div>
  );
}
