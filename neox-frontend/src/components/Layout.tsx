// src/components/Layout.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
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

function applySeoLinks(pathname: string) {
  const base = "https://weneox.com";
  const lang = getLangFromPath(pathname);
  const restPath = stripLang(pathname);
  const canonical = `${base}${pathname}`;

  document.documentElement.lang = lang;

  document
    .querySelectorAll<HTMLLinkElement>('link[data-neox-seo="true"]')
    .forEach((el) => el.remove());

  const makeLink = (attrs: Record<string, string>) => {
    const link = document.createElement("link");
    Object.entries(attrs).forEach(([key, value]) => link.setAttribute(key, value));
    link.setAttribute("data-neox-seo", "true");
    document.head.appendChild(link);
  };

  makeLink({
    rel: "canonical",
    href: canonical,
  });

  LANGS.forEach((l) => {
    makeLink({
      rel: "alternate",
      hrefLang: l,
      href: buildLocalizedUrl(base, l, restPath),
    });
  });

  makeLink({
    rel: "alternate",
    hrefLang: "x-default",
    href: `${base}/`,
  });
}

function findFirstAfterHero() {
  const preferredIds = ["inside-1", "inside-2", "inside-2b", "inside-3"];

  for (const id of preferredIds) {
    const el = document.getElementById(id);
    if (el) return el;
  }

  const hero = document.getElementById("top");
  if (!hero) return null;

  let next = hero.nextElementSibling as HTMLElement | null;
  while (next) {
    const rect = next.getBoundingClientRect();
    if (rect.height > 120) return next;
    next = next.nextElementSibling as HTMLElement | null;
  }

  return null;
}

function isHomeHeroZone(pathname: string) {
  const clean = pathname.replace(/^\/(az|en|tr|ru|es)(?=\/|$)/, "") || "/";
  return clean === "/";
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const heroWheelLockRef = useRef(false);

  const isAdminRoute = useMemo(() => {
    const p = location.pathname || "";
    return /^\/(az|en|tr|ru|es)\/admin(\/|$)/.test(p);
  }, [location.pathname]);

  const isHomeRoute = useMemo(() => isHomeHeroZone(location.pathname || ""), [location.pathname]);

  const [enterKey, setEnterKey] = useState(0);
  const [entering, setEntering] = useState(false);

  useEffect(() => {
    applySeoLinks(location.pathname || "/");
  }, [location.pathname]);

  useEffect(() => {
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

  useEffect(() => {
    if (isAdminRoute || !isHomeRoute) return undefined;

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) return;
      if (event.defaultPrevented) return;
      if (Math.abs(event.deltaY) < 8) return;
      if (event.deltaY <= 0) return;

      const target = event.target instanceof Element ? event.target : null;

      if (
        target?.closest(
          ".neox-ai, .neox-ai-modal, .neoMOv, .neoSheet, input, textarea, select, [data-native-scroll], [data-scroll-lock]"
        )
      ) {
        return;
      }

      const hero = document.getElementById("top");
      if (!hero) return;

      const heroRect = hero.getBoundingClientRect();
      const viewportH = window.innerHeight || document.documentElement.clientHeight || 1;

      const insideHero =
        heroRect.top <= 8 &&
        heroRect.bottom > viewportH * 0.42 &&
        window.scrollY < viewportH * 0.82;

      if (!insideHero) return;

      const firstAfterHero = findFirstAfterHero();
      if (!firstAfterHero) return;

      event.preventDefault();
      event.stopPropagation();

      if (typeof event.stopImmediatePropagation === "function") {
        event.stopImmediatePropagation();
      }

      if (heroWheelLockRef.current) return;
      heroWheelLockRef.current = true;

      const headerOffset = 76;
      const top = Math.max(0, firstAfterHero.getBoundingClientRect().top + window.scrollY - headerOffset);

      const previousScrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = "auto";

      window.scrollTo({
        top,
        left: 0,
        behavior: "smooth",
      });

      window.setTimeout(() => {
        document.documentElement.style.scrollBehavior = previousScrollBehavior || "";
        heroWheelLockRef.current = false;
      }, 680);
    };

    window.addEventListener("wheel", onWheel, { capture: true, passive: false });

    return () => {
      window.removeEventListener("wheel", onWheel, { capture: true } as AddEventListenerOptions);
      heroWheelLockRef.current = false;
    };
  }, [isAdminRoute, isHomeRoute, location.pathname]);

  return (
    <div ref={shellRef} className="app-shell">
      <SmoothWheelScroll enabled={!isAdminRoute} locationKey={location.pathname} />

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

      {!isAdminRoute && <NeoxAIWidget />}

      <Footer />
    </div>
  );
}