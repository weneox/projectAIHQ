import React, { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import NeoxAIWidget from "./NeoxAIWidget";

const LANGS = ["az", "en", "tr", "ru", "es"] as const;
type Lang = (typeof LANGS)[number];

const SEO_MARK = "data-neox-seo";

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

function addSeoLink(attrs: Record<string, string>) {
  const link = document.createElement("link");

  Object.entries(attrs).forEach(([key, value]) => {
    link.setAttribute(key, value);
  });

  link.setAttribute(SEO_MARK, "true");
  document.head.appendChild(link);
}

function useSeo(pathname: string) {
  useEffect(() => {
    const base = "https://weneox.com";
    const lang = getLangFromPath(pathname);
    const restPath = stripLang(pathname);

    document.documentElement.lang = lang;

    document.head
      .querySelectorAll(`link[${SEO_MARK}="true"]`)
      .forEach((node) => node.remove());

    addSeoLink({
      rel: "canonical",
      href: `${base}${pathname}`,
    });

    LANGS.forEach((item) => {
      addSeoLink({
        rel: "alternate",
        hrefLang: item,
        href: buildLocalizedUrl(base, item, restPath),
      });
    });

    addSeoLink({
      rel: "alternate",
      hrefLang: "x-default",
      href: `${base}/`,
    });

    return () => {
      document.head
        .querySelectorAll(`link[${SEO_MARK}="true"]`)
        .forEach((node) => node.remove());
    };
  }, [pathname]);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const previousPathRef = useRef<string | null>(null);

  useSeo(location.pathname);

  const isAdminRoute = /^\/(az|en|tr|ru|es)\/admin(\/|$)/.test(
    location.pathname || "",
  );

  const isHomeRoute = /^\/(az|en|tr|ru|es)\/?$/.test(location.pathname || "");

  useEffect(() => {
    const previousPath = previousPathRef.current;
    const nextPath = location.pathname;

    const previousRestPath = previousPath ? stripLang(previousPath) : null;
    const nextRestPath = stripLang(nextPath);

    const previousLang = previousPath ? getLangFromPath(previousPath) : null;
    const nextLang = getLangFromPath(nextPath);

    const isOnlyLanguageChange =
      Boolean(previousPath) &&
      previousRestPath === nextRestPath &&
      previousLang !== nextLang;

    previousPathRef.current = nextPath;

    if (isOnlyLanguageChange) return;

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    if (shellRef.current) {
      shellRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  return (
    <div ref={shellRef} className="app-shell">
      <Header introReady={true} />

      <main
        ref={mainRef}
        className="neox-main"
        role="main"
        style={{ overflow: "visible", position: "relative" }}
      >
        {children}
      </main>

      {!isAdminRoute && !isHomeRoute ? <NeoxAIWidget /> : null}

      <Footer />
    </div>
  );
}