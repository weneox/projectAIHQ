// src/pages/usecases/_ucShared.tsx
import React, { memo, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle } from "lucide-react";

/* tiny helper */
export function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/* langs */
export const LANGS = ["az", "tr", "en", "ru", "es"] as const;
export type Lang = (typeof LANGS)[number];

export function getLangFromPath(pathname: string): Lang {
  const seg = (pathname || "/").split("/")[1] || "az";
  return (LANGS as readonly string[]).includes(seg as any) ? (seg as Lang) : "az";
}

export function withLang(path: string, lang: Lang) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `/${lang}${p}`;
}

/* motion pref */
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = () => setReduced(!!mq.matches);
    on();
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on);
    };
  }, []);
  return reduced;
}

/* media query */
export function useMedia(query: string, initial = false) {
  const [v, setV] = useState(initial);
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    const on = () => setV(!!mq.matches);
    on();
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on);
    };
  }, [query]);
  return v;
}

/* Reveal: scoped + batched (FPS safe) */
export function useRevealScopedBatched(
  rootRef: React.RefObject<HTMLElement>,
  opts?: { rootMargin?: string; batchSize?: number; batchDelayMs?: number }
) {
  const { rootMargin = "0px 0px -18% 0px", batchSize = 3, batchDelayMs = 90 } = opts || {};

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    root.classList.add("uc-io");
    const els = Array.from(root.querySelectorAll<HTMLElement>(".uc-reveal"));
    if (!els.length) return;

    const revealNow = (el: HTMLElement) => el.classList.add("is-in");

    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (prefersReduced || typeof IntersectionObserver === "undefined") {
      els.forEach(revealNow);
      return;
    }

    const queue = new Set<HTMLElement>();
    let flushing = false;
    let timer: number | null = null;

    const flush = () => {
      flushing = true;
      timer = window.setTimeout(() => {
        let n = 0;
        for (const el of queue) {
          revealNow(el);
          queue.delete(el);
          n++;
          if (n >= batchSize) break;
        }
        flushing = false;
        if (queue.size) flush();
      }, batchDelayMs);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          io.unobserve(el);
          queue.add(el);
        }
        if (queue.size && !flushing) flush();
      },
      { threshold: 0.12, rootMargin }
    );

    els.forEach((el) => io.observe(el));

    const fallback = window.setTimeout(() => {
      els.forEach(revealNow);
      io.disconnect();
    }, 2400);

    return () => {
      window.clearTimeout(fallback);
      if (timer) window.clearTimeout(timer);
      io.disconnect();
    };
  }, [rootRef, rootMargin, batchSize, batchDelayMs]);
}

/* SEO */
export function useSeo(opts: { title: string; description: string; canonicalPath: string; ogImage?: string }) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = opts.title;

    const ensureMeta = (selector: string, create: () => HTMLMetaElement) => {
      let el = document.head.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = create();
        document.head.appendChild(el);
      }
      return el;
    };
    const ensureLink = (selector: string, create: () => HTMLLinkElement) => {
      let el = document.head.querySelector(selector) as HTMLLinkElement | null;
      if (!el) {
        el = create();
        document.head.appendChild(el);
      }
      return el;
    };

    const setMetaName = (name: string, content: string) => {
      const el = ensureMeta(`meta[name="${name}"]`, () => {
        const m = document.createElement("meta");
        m.setAttribute("name", name);
        return m;
      });
      el.setAttribute("content", content);
    };

    const setMetaProp = (property: string, content: string) => {
      const el = ensureMeta(`meta[property="${property}"]`, () => {
        const m = document.createElement("meta");
        m.setAttribute("property", property);
        return m;
      });
      el.setAttribute("content", content);
    };

    const base = window.location.origin;
    const canonicalUrl = base + opts.canonicalPath;

    const canonical = ensureLink(`link[rel="canonical"]`, () => {
      const l = document.createElement("link");
      l.setAttribute("rel", "canonical");
      return l;
    });
    canonical.setAttribute("href", canonicalUrl);

    setMetaName("description", opts.description);

    setMetaProp("og:type", "website");
    setMetaProp("og:title", opts.title);
    setMetaProp("og:description", opts.description);
    setMetaProp("og:url", canonicalUrl);
    if (opts.ogImage) setMetaProp("og:image", base + opts.ogImage);

    setMetaName("twitter:card", "summary_large_image");
    setMetaName("twitter:title", opts.title);
    setMetaName("twitter:description", opts.description);
    if (opts.ogImage) setMetaName("twitter:image", base + opts.ogImage);

    return () => {
      document.title = prevTitle;
    };
  }, [opts.title, opts.description, opts.canonicalPath, opts.ogImage]);
}

/* ---------------- types ---------------- */
export type Tint = "cyan" | "violet" | "pink" | "amber";

export type CaseItem = {
  icon: LucideIcon;
  sektor: string;
  basliq: string;
  hekayə: string;
  maddeler: string[];
  neticeler: Array<{ k: string; v: string; sub: string }>;
  tint: Tint;
};

/* ======================================================================================
   LIGHT THEME SYSTEM (per-page vibe)
   - <main className="uc-page" data-uc="healthcare"> ... </main>
   - later: data-uc="finance" | "logistics" | "retail" | "hotels"
====================================================================================== */

export type UcThemeKey = "healthcare" | "finance" | "logistics" | "retail" | "hotels";

export function useUcTheme(theme: UcThemeKey) {
  useEffect(() => {
    // optional: let header switch to light mode later if needed
    document.documentElement.setAttribute("data-uc-theme", theme);
    return () => {
      document.documentElement.removeAttribute("data-uc-theme");
    };
  }, [theme]);
}

/* ---------------- styles ---------------- */
export const UC_STYLES = `
/* ====== reset / base ====== */
html, body{
  margin:0;
  padding:0;
  width:100%;
  overflow-x: clip;
  overscroll-behavior-x: none;
}
#root{ width:100%; overflow-x: clip; }

.uc-page{
  /* Light base */
  --uc-bg: #f6faf9;
  --uc-ink: rgba(10,18,24,.92);
  --uc-muted: rgba(10,18,24,.64);
  --uc-line: rgba(10,18,24,.10);
  --uc-card: rgba(255,255,255,.72);
  --uc-card2: rgba(255,255,255,.56);
  --uc-shadow: 0 18px 55px rgba(10,18,24,.10);

  /* Accent default */
  --uc-a: #22c55e;      /* green */
  --uc-a2: #06b6d4;     /* cyan */
  --uc-glow: rgba(34,197,94,.18);

  background: var(--uc-bg);
  color: var(--uc-ink);
  min-height: 100vh;
  width: 100%;
  overflow-x: clip;
  overscroll-behavior-x: none;
  isolation: isolate;
  text-rendering: geometricPrecision;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* while this page is mounted, softly set body bg to match it */
body{ background: var(--uc-bg); transition: background .25s ease; }

.uc-page *{ min-width:0; max-width:100%; box-sizing: border-box; }

/* ====== theme: Healthcare (mint clinic vibe) ====== */
.uc-page[data-uc="healthcare"]{
  --uc-bg: #f3fbf8;
  --uc-a: #22c55e;
  --uc-a2: #14b8a6;
  --uc-glow: rgba(20,184,166,.16);
}

/* ====== typography helpers ====== */
.uc-grad{
  background: linear-gradient(90deg, var(--uc-a) 0%, var(--uc-a2) 55%, #2563eb 110%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.uc-contain{ contain: layout paint style; transform: translateZ(0); backface-visibility: hidden; }

/* enter (hero only) */
.uc-enter{
  opacity: 0;
  transform: translate3d(0, 12px, 0);
  filter: blur(7px);
  transition: opacity .60s ease, transform .60s ease, filter .60s ease;
  transition-delay: var(--d, 0ms);
  will-change: opacity, transform, filter;
}
.uc-enter.uc-in{ opacity:1; transform: translate3d(0,0,0); filter: blur(0px); }

/* Reveal (scroll only) */
.uc-reveal{ opacity: 1; transform: none; }
.uc-page.uc-io .uc-reveal{
  opacity: 0;
  transform: translate3d(var(--rx, 0px), var(--ry, 14px), 0);
  transition: opacity .45s ease, transform .45s ease;
  will-change: transform, opacity;
}
.uc-page.uc-io .uc-reveal.is-in{ opacity: 1; transform: translate3d(0,0,0); }
.reveal-left{ --rx: -18px; --ry: 0px; }
.reveal-right{ --rx: 18px; --ry: 0px; }
.reveal-bottom{ --rx: 0px; --ry: 14px; }

/* ====== section container ====== */
.uc-wrap{
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 18px;
}

/* ====== hero ====== */
.uc-hero{
  position: relative;
  padding: 92px 0 26px;
  overflow: hidden;
}
@media (max-width: 560px){
  .uc-hero{ padding-top: 86px; }
}

/* header overlap fix */
.uc-safeTop{
  padding-top: calc(var(--ucHeaderH, 82px) + 14px);
}
@media (max-width: 560px){
  .uc-safeTop{ padding-top: calc(var(--ucHeaderH, 92px) + 10px); }
}

.uc-heroBG{
  pointer-events:none;
  position:absolute;
  inset:0;
}
.uc-heroBG:before{
  content:"";
  position:absolute;
  inset:-14% -14%;
  background:
    radial-gradient(800px 420px at 18% 0%, var(--uc-glow), transparent 62%),
    radial-gradient(820px 420px at 82% 0%, rgba(37,99,235,.10), transparent 64%),
    radial-gradient(1000px 560px at 50% 18%, rgba(255,255,255,.88), transparent 70%);
  opacity: 1;
}
.uc-heroBG:after{
  content:"";
  position:absolute;
  inset:0;
  background: linear-gradient(180deg, rgba(255,255,255,.55), rgba(243,251,248,.90) 42%, rgba(243,251,248,1));
}

.uc-grid{
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: 1.05fr .95fr;
  gap: 26px;
  align-items: start;
}
@media (max-width: 980px){
  .uc-grid{ grid-template-columns: 1fr; gap: 16px; }
}

.uc-kicker{
  display:inline-flex;
  align-items:center;
  gap:10px;
  border: 1px solid var(--uc-line);
  background: rgba(255,255,255,.58);
  padding: 10px 14px;
  border-radius: 999px;
  box-shadow: 0 10px 22px rgba(10,18,24,.06);
}
.uc-kDot{
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--uc-a2);
  box-shadow: 0 0 0 4px rgba(20,184,166,.14), 0 0 18px rgba(20,184,166,.22);
  flex: 0 0 auto;
}
.uc-kText{
  font-size: 12px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(10,18,24,.62);
  white-space: nowrap;
}

.uc-h1{
  margin-top: 18px;
  font-size: clamp(38px, 4.6vw, 64px);
  line-height: 1.02;
  font-weight: 900;
  letter-spacing: -0.02em;
  color: rgba(10,18,24,.92);
}
.uc-sub{
  margin-top: 12px;
  font-size: 18px;
  line-height: 1.75;
  color: var(--uc-muted);
  max-width: 58ch;
}

.uc-bullets{
  margin-top: 16px;
  display: grid;
  gap: 10px;
}
.uc-bul{
  display:flex;
  align-items:flex-start;
  gap: 10px;
  color: rgba(10,18,24,.70);
  line-height: 1.65;
}
.uc-bIco{
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  margin-top: 3px;
  color: var(--uc-a2);
}

.uc-cta{
  margin-top: 18px;
  display:flex;
  gap: 10px;
  flex-wrap: wrap;
}

/* buttons (light) */
.uc-btn{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:10px;
  padding:12px 18px;
  border-radius:999px;
  font-weight:800;
  font-size:14px;
  letter-spacing:-.01em;
  border:1px solid rgba(20,184,166,.28);
  color: rgba(10,18,24,.92);
  background:
    radial-gradient(140px 70px at 30% 30%, rgba(20,184,166,.14), transparent 62%),
    linear-gradient(180deg, rgba(255,255,255,.92), rgba(255,255,255,.70));
  box-shadow: 0 12px 28px rgba(10,18,24,.10), 0 0 0 1px rgba(255,255,255,.55) inset;
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
  will-change: transform;
}
.uc-btn:hover{
  transform: translate3d(0,-2px,0);
  border-color: rgba(20,184,166,.44);
  box-shadow: 0 16px 34px rgba(10,18,24,.12);
}
.uc-btn:active{ transform: translate3d(0,-1px,0); }

.uc-btnGhost{
  border-color: rgba(10,18,24,.12);
  background: rgba(255,255,255,.55);
}
.uc-btnGhost:hover{
  border-color: rgba(20,184,166,.30);
}

/* ====== hero visual (no video yet) ====== */
.uc-visual{
  border-radius: 26px;
  border: 1px solid var(--uc-line);
  background: linear-gradient(180deg, rgba(255,255,255,.80), rgba(255,255,255,.58));
  box-shadow: var(--uc-shadow);
  overflow: hidden;
  position: relative;
}
.uc-visual:before{
  content:"";
  position:absolute;
  inset:-35% -35%;
  background:
    radial-gradient(420px 240px at 24% 34%, rgba(20,184,166,.22), transparent 60%),
    radial-gradient(420px 240px at 78% 24%, rgba(34,197,94,.16), transparent 62%),
    radial-gradient(520px 280px at 56% 86%, rgba(37,99,235,.10), transparent 64%);
  filter: blur(0px);
  opacity: 1;
}
.uc-visualInner{
  position: relative;
  padding: 16px;
  display: grid;
  gap: 12px;
}
.uc-miniTop{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 10px;
}
.uc-miniPill{
  display:inline-flex;
  align-items:center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid rgba(10,18,24,.10);
  background: rgba(255,255,255,.62);
  color: rgba(10,18,24,.70);
  font-size: 12px;
  font-weight: 800;
}
.uc-miniBadge{
  width: 10px; height: 10px; border-radius: 999px;
  background: var(--uc-a2);
  box-shadow: 0 0 0 4px rgba(20,184,166,.12);
}
.uc-miniCard{
  border-radius: 18px;
  border: 1px solid rgba(10,18,24,.10);
  background: rgba(255,255,255,.64);
  padding: 14px;
}
.uc-miniRow{
  display:flex;
  align-items:flex-start;
  gap: 10px;
  color: rgba(10,18,24,.70);
  line-height: 1.55;
}
.uc-miniDot{
  width: 8px; height: 8px; border-radius: 999px;
  margin-top: 7px;
  background: rgba(10,18,24,.26);
}

/* divider */
.uc-divider{
  height: 1px;
  width: 100%;
  max-width: 980px;
  margin: 26px auto 0;
  background: linear-gradient(90deg, transparent, rgba(20,184,166,.26), rgba(10,18,24,.10), rgba(37,99,235,.18), transparent);
  opacity: .95;
}

/* ====== sections ====== */
.uc-section{
  padding: 34px 0;
}
.uc-sectionTitle{
  font-size: 28px;
  font-weight: 950;
  letter-spacing: -0.02em;
  color: rgba(10,18,24,.92);
  line-height: 1.12;
}
.uc-sectionDesc{
  margin-top: 10px;
  color: rgba(10,18,24,.66);
  line-height: 1.75;
  max-width: 80ch;
}

/* cards grid */
.uc-cards{
  margin-top: 16px;
  display:grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 980px){
  .uc-cards{ grid-template-columns: 1fr; }
}
.uc-card{
  border-radius: 22px;
  border: 1px solid rgba(10,18,24,.10);
  background: rgba(255,255,255,.66);
  box-shadow: 0 14px 34px rgba(10,18,24,.08);
  overflow:hidden;
}
.uc-cardIn{
  padding: 16px;
}
.uc-cardK{
  font-size: 12px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(10,18,24,.55);
  font-weight: 900;
}
.uc-cardH{
  margin-top: 10px;
  font-size: 18px;
  font-weight: 950;
  color: rgba(10,18,24,.92);
  line-height: 1.2;
}
.uc-cardP{
  margin-top: 8px;
  color: rgba(10,18,24,.66);
  line-height: 1.7;
}

/* timeline */
.uc-steps{
  margin-top: 16px;
  display:grid;
  gap: 12px;
}
.uc-step{
  border-radius: 22px;
  border: 1px solid rgba(10,18,24,.10);
  background: rgba(255,255,255,.66);
  box-shadow: 0 14px 34px rgba(10,18,24,.08);
  overflow: hidden;
}
.uc-stepIn{
  display:grid;
  grid-template-columns: 86px 1fr;
  gap: 14px;
  padding: 16px;
  align-items: start;
}
@media (max-width: 720px){
  .uc-stepIn{ grid-template-columns: 1fr; }
}
.uc-stepNo{
  font-size: 34px;
  font-weight: 950;
  letter-spacing: -0.02em;
  color: rgba(10,18,24,.84);
  line-height: 1;
}
.uc-stepPill{
  display:inline-flex;
  align-items:center;
  gap: 8px;
  border: 1px solid rgba(10,18,24,.10);
  background: rgba(255,255,255,.62);
  padding: 8px 12px;
  border-radius: 999px;
  width: fit-content;
  max-width: 100%;
  margin-top: 10px;
}
.uc-stepPillDot{
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--uc-a2);
  box-shadow: 0 0 0 4px rgba(20,184,166,.12);
}
.uc-stepPillText{
  font-size: 12px;
  letter-spacing: .14em;
  text-transform: uppercase;
  color: rgba(10,18,24,.58);
  font-weight: 900;
}
.uc-stepTitle{
  font-size: 18px;
  font-weight: 950;
  color: rgba(10,18,24,.92);
  line-height: 1.18;
}
.uc-stepDesc{
  margin-top: 8px;
  color: rgba(10,18,24,.66);
  line-height: 1.75;
  max-width: 86ch;
}
.uc-miniList{
  margin-top: 10px;
  display: grid;
  gap: 8px;
}
.uc-miniItem{
  display:flex;
  gap: 10px;
  align-items:flex-start;
  color: rgba(10,18,24,.70);
  line-height: 1.6;
}
.uc-miniIc{
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
  margin-top: 3px;
  color: var(--uc-a2);
}

/* FAQ */
.uc-faq{
  margin-top: 14px;
  display:grid;
  gap: 10px;
}
.uc-q{
  border-radius: 18px;
  border: 1px solid rgba(10,18,24,.10);
  background: rgba(255,255,255,.66);
  box-shadow: 0 12px 26px rgba(10,18,24,.06);
  padding: 14px;
}
.uc-qh{
  font-weight: 950;
  color: rgba(10,18,24,.90);
}
.uc-qa{
  margin-top: 8px;
  color: rgba(10,18,24,.66);
  line-height: 1.75;
}

/* Bottom CTA band */
.uc-band{
  margin-top: 16px;
  border-radius: 26px;
  border: 1px solid rgba(10,18,24,.10);
  background:
    radial-gradient(520px 260px at 24% 20%, rgba(20,184,166,.16), transparent 60%),
    radial-gradient(520px 260px at 82% 30%, rgba(37,99,235,.10), transparent 62%),
    linear-gradient(180deg, rgba(255,255,255,.80), rgba(255,255,255,.58));
  box-shadow: var(--uc-shadow);
  overflow:hidden;
}
.uc-bandIn{
  padding: 18px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 14px;
  flex-wrap: wrap;
}
.uc-bandTitle{
  font-size: 18px;
  font-weight: 950;
  color: rgba(10,18,24,.92);
}
.uc-bandSub{
  margin-top: 6px;
  color: rgba(10,18,24,.66);
  line-height: 1.65;
  max-width: 70ch;
}

/* reduced motion */
@media (prefers-reduced-motion: reduce){
  .uc-enter{ opacity:1 !important; transform:none !important; filter:none !important; transition:none !important; }
  .uc-page.uc-io .uc-reveal{ opacity:1; transform:none; transition:none; }
  .uc-btn{ transition:none !important; }
}
`;

/* ---------------- UI bits ---------------- */
export const BreadcrumbPill = memo(function BreadcrumbPill({
  text,
  enter,
  delayMs,
}: {
  text: string;
  enter: boolean;
  delayMs: number;
}) {
  return (
    <div className={cx("uc-kicker uc-enter", enter && "uc-in")} style={{ ["--d" as any]: `${delayMs}ms` }} aria-label="Breadcrumb">
      <span className="uc-kDot" aria-hidden="true" />
      <span className="uc-kText">{text}</span>
    </div>
  );
});

export const Bullet = memo(function Bullet({ text }: { text: string }) {
  return (
    <div className="uc-miniItem">
      <CheckCircle className="uc-miniIc" />
      <span style={{ minWidth: 0 }}>{text}</span>
    </div>
  );
});

/* ======================================================================================
   Legacy CaseRow — saxlanır (dark style idi) → indi light tokenlərə uyğun yumşaldılıb.
   (Sındırılmasın deyə API eyni qalır.)
====================================================================================== */

export const CaseRow = memo(function CaseRow({
  c,
  flip,
  tRealScenario,
  toContact,
  toServices,
  ctaPrimary,
  ctaSecondary,
  videoUrl,
}: {
  c: CaseItem;
  flip?: boolean;
  tRealScenario: string;
  toContact: string;
  toServices: string;
  ctaPrimary: string;
  ctaSecondary: string;
  videoUrl?: string;
}) {
  const Icon = c.icon;
  const v = videoUrl || "";
  const leftFirst = !flip;

  return (
    <section
      className="uc-reveal reveal-bottom"
      style={{
        borderRadius: 26,
        border: "1px solid rgba(10,18,24,.10)",
        background: "rgba(255,255,255,.66)",
        boxShadow: "0 18px 55px rgba(10,18,24,.10)",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, padding: 18, alignItems: "stretch" }}>
        <div style={{ order: leftFirst ? 1 : 2, minWidth: 0 }}>
          <div className="uc-kicker">
            <span aria-hidden="true" className="uc-kDot" />
            <span className="uc-kText">{tRealScenario}</span>
          </div>

          <h2 style={{ marginTop: 14, fontSize: 34, lineHeight: 1.05, fontWeight: 950, color: "rgba(10,18,24,.92)" }}>
            {c.basliq}
          </h2>

          <p style={{ marginTop: 10, color: "rgba(10,18,24,.66)", lineHeight: 1.75 }}>{c.hekayə}</p>

          <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
            {c.maddeler.slice(0, 4).map((m) => (
              <div key={m} className="uc-miniItem">
                <CheckCircle className="uc-miniIc" />
                <span>{m}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a className="uc-btn" href={toContact}>
              {ctaPrimary} <span aria-hidden="true">→</span>
            </a>
            <a className="uc-btn uc-btnGhost" href={toServices}>
              {ctaSecondary}
            </a>
          </div>
        </div>

        <div style={{ order: leftFirst ? 2 : 1, minWidth: 0 }}>
          <div className="uc-visual uc-contain">
            <div className="uc-visualInner">
              <div className="uc-miniTop">
                <div className="uc-miniPill">
                  <span className="uc-miniBadge" aria-hidden="true" />
                  Klinik axını (preview)
                </div>
                <div className="uc-miniPill">Triage • Randevu • Xatırlatma</div>
              </div>

              <div className="uc-miniCard">
                <div className="uc-miniRow">
                  <span className="uc-miniDot" aria-hidden="true" />
                  <div>
                    <div style={{ fontWeight: 950, color: "rgba(10,18,24,.90)" }}>Sual: “Qiymətlər necədir?”</div>
                    <div style={{ marginTop: 6, color: "rgba(10,18,24,.66)" }}>
                      Cavab: xidmət paketləri + həkim seçimi + uyğun vaxtlar (CTA: randevu).
                    </div>
                  </div>
                </div>
              </div>

              <div className="uc-miniCard">
                <div className="uc-miniRow">
                  <span className="uc-miniDot" aria-hidden="true" />
                  <div>
                    <div style={{ fontWeight: 950, color: "rgba(10,18,24,.90)" }}>Həssas sorğu</div>
                    <div style={{ marginTop: 6, color: "rgba(10,18,24,.66)" }}>
                      Operator handoff + qısa xülasə ilə təhlükəsiz ötürmə.
                    </div>
                  </div>
                </div>
              </div>

              {v ? (
                <div className="uc-miniCard">
                  <div style={{ fontWeight: 900, color: "rgba(10,18,24,.80)" }}>Video sonradan əlavə olunacaq</div>
                </div>
              ) : null}
            </div>
          </div>

          <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            {c.neticeler.slice(0, 4).map((r) => (
              <div
                key={r.v}
                style={{
                  borderRadius: 18,
                  border: "1px solid rgba(10,18,24,.10)",
                  background: "rgba(255,255,255,.58)",
                  padding: 14,
                  boxShadow: "0 12px 26px rgba(10,18,24,.06)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 14,
                      display: "grid",
                      placeItems: "center",
                      border: "1px solid rgba(10,18,24,.10)",
                      background: "rgba(255,255,255,.70)",
                    }}
                  >
                    <Icon style={{ width: 18, height: 18, color: "rgba(20,184,166,.95)" }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 950, fontSize: 18, color: "rgba(10,18,24,.92)" }}>{r.k}</div>
                    <div style={{ fontWeight: 850, color: "rgba(10,18,24,.74)" }}>{r.v}</div>
                  </div>
                </div>
                <div style={{ marginTop: 8, color: "rgba(10,18,24,.62)", lineHeight: 1.55 }}>{r.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px){
          .uc-page section > div{ grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
});

/* ---------------- After sections (new light components) ---------------- */
export type AfterHeroBlock = {
  no: string;
  pill: string;
  title: string;
  desc: string;
  bullets?: string[];
};

export const AfterHeroSteps = memo(function AfterHeroSteps({
  blocks,
  className,
}: {
  blocks: AfterHeroBlock[];
  className?: string;
}) {
  return (
    <section className={cx("uc-section", className)}>
      <div className="uc-wrap">
        <div className="uc-steps">
          {blocks.slice(0, 3).map((b) => (
            <div key={b.no} className="uc-step uc-reveal reveal-bottom">
              <div className="uc-stepIn">
                <div>
                  <div className="uc-stepNo">{b.no}</div>
                  <div className="uc-stepPill">
                    <span className="uc-stepPillDot" aria-hidden="true" />
                    <span className="uc-stepPillText">{b.pill}</span>
                  </div>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div className="uc-stepTitle">{b.title}</div>
                  <div className="uc-stepDesc">{b.desc}</div>

                  {!!b.bullets?.length && (
                    <div className="uc-miniList">
                      {b.bullets.slice(0, 4).map((t) => (
                        <div key={t} className="uc-miniItem">
                          <CheckCircle className="uc-miniIc" />
                          <span style={{ minWidth: 0 }}>{t}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

export type Card3 = { k: string; h: string; p: string };

export const AfterHeroCards3 = memo(function AfterHeroCards3({
  title,
  desc,
  cards,
  className,
}: {
  title: string;
  desc: string;
  cards: Card3[];
  className?: string;
}) {
  return (
    <section className={cx("uc-section", className)}>
      <div className="uc-wrap">
        <div className="uc-reveal reveal-bottom">
          <h2 className="uc-sectionTitle">{title}</h2>
          <p className="uc-sectionDesc">{desc}</p>
        </div>

        <div className="uc-cards">
          {cards.slice(0, 3).map((c) => (
            <div key={c.h} className="uc-card uc-reveal reveal-bottom">
              <div className="uc-cardIn">
                <div className="uc-cardK">{c.k}</div>
                <div className="uc-cardH">{c.h}</div>
                <div className="uc-cardP">{c.p}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

/* ---------------- Simple FAQ (reusable) ---------------- */
export type FaqItem = { q: string; a: string };

export const UcFaq = memo(function UcFaq({
  title,
  desc,
  items,
  className,
}: {
  title: string;
  desc?: string;
  items: FaqItem[];
  className?: string;
}) {
  return (
    <section className={cx("uc-section", className)}>
      <div className="uc-wrap">
        <div className="uc-reveal reveal-bottom">
          <h2 className="uc-sectionTitle">{title}</h2>
          {desc ? <p className="uc-sectionDesc">{desc}</p> : null}
        </div>

        <div className="uc-faq">
          {items.slice(0, 6).map((it) => (
            <div key={it.q} className="uc-q uc-reveal reveal-bottom">
              <div className="uc-qh">{it.q}</div>
              <div className="uc-qa">{it.a}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

/* ---------------- CTA Band (reusable) ---------------- */
export const UcCtaBand = memo(function UcCtaBand({
  title,
  sub,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  className,
}: {
  title: string;
  sub: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  className?: string;
}) {
  return (
    <section className={cx("uc-section", className)}>
      <div className="uc-wrap">
        <div className="uc-band uc-reveal reveal-bottom">
          <div className="uc-bandIn">
            <div style={{ minWidth: 0 }}>
              <div className="uc-bandTitle">{title}</div>
              <div className="uc-bandSub">{sub}</div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a className="uc-btn" href={primaryHref}>
                {primaryLabel} <span aria-hidden="true">→</span>
              </a>
              <a className="uc-btn uc-btnGhost" href={secondaryHref}>
                {secondaryLabel}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
