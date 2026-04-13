// src/pages/Contact.tsx
// FULL — ALL panels removed (no glass cards / no ct-panel anywhere).
// Premium clean layout:
// - Slide 1 = text + CTAs on left (no panel), robot image on right.
// - Slide 2 = human image on left, clean form on right (no panel), with simple top-right back button.
// - Fixed spacing + max widths, no weird empty blocks.
// - Backend untouched.
//
// ✅ Update:
// - "Söz olan yer" (Slide 1 left) + "form olan yer" (Slide 2 right) background = grey image you gave
// - Page opening reveal animation like ResourcesFaq (H1, P, CTAs step-by-step)

import React, { FormEvent, memo, useEffect, useMemo, useRef, useState } from "react";
import { Mail, Send, CheckCircle, CalendarDays, Copy, AlertTriangle, ArrowLeft } from "lucide-react";
import { useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

type Status = "idle" | "loading" | "success" | "error";
type SignalPhase = "off" | "enter" | "play" | "fade" | "text";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

function usePrefersReducedMotion() {
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

/* ---------------- SEO ---------------- */
function useSeo(opts: { title: string; description: string; canonicalPath: string; ogImage?: string }) {
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

/* ========= BG ========= */
const BG_IMG =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1771148314/Untitled_design_23_r9rdpq.jpg";

/* ✅ New: text + form background */
const SIDE_BG_IMG =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1771215237/chantelleceecee-grey-370125_1280_wib88e.png";

/* ================= CSS ================= */
const CONTACT_CSS = `
  :root{
    --pad: clamp(16px, 3vw, 44px);
    --maxLeft: 640px;
    --maxRight: 740px;
  }

  .ct-page{
    background:#000;
    color: rgba(255,255,255,.92);
    width:100%;
    overflow-x:hidden;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  .ct-page *{ box-sizing:border-box; }

  .ct-gradient{
    background: linear-gradient(90deg, #ffffff 0%, rgba(170,225,255,.98) 35%, rgba(47,184,255,.92) 70%, rgba(42,125,255,.92) 100%);
    -webkit-background-clip:text;
    background-clip:text;
    color:transparent;
  }

  .ct-btn{
    display:inline-flex; align-items:center; justify-content:center; gap:10px;
    padding: 12px 16px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,.14);
    background: rgba(255,255,255,.04);
    color: rgba(255,255,255,.92);
    transition: transform .14s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease, opacity .16s ease;
    cursor:pointer;
    user-select:none;
    white-space: nowrap;
  }
  .ct-btn:hover{
    transform: translate3d(0,-2px,0);
    border-color: rgba(47,184,255,.26);
    background: rgba(255,255,255,.06);
    box-shadow: 0 16px 52px rgba(0,0,0,.55);
  }
  .ct-btn:disabled{ opacity:.5; pointer-events:none; transform:none; box-shadow:none; }
  .ct-btn:focus-visible{
    outline:none;
    box-shadow: 0 0 0 4px rgba(47,184,255,.14), 0 16px 52px rgba(0,0,0,.55);
  }
  .ct-btn--primary{
    border-color: rgba(47,184,255,.30);
    background: linear-gradient(180deg, rgba(47,184,255,.18), rgba(42,125,255,.10));
  }

  .ct-input{
    width:100%;
    border-radius:14px;
    border:1px solid rgba(255,255,255,.12);
    background: rgba(0,0,0,.40);
    padding:12px 14px;
    color: rgba(255,255,255,.90);
    outline:none;
    transition: border-color .16s ease, box-shadow .16s ease, background .16s ease;
  }
  .ct-input:focus{
    border-color: rgba(47,184,255,.30);
    box-shadow: 0 0 0 4px rgba(47,184,255,.10);
    background: rgba(0,0,0,.48);
  }
  .ct-input--bad{ border-color: rgba(248,113,113,.55) !important; }

  .ct-meter{
    height: 8px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,.10);
    background: rgba(255,255,255,.03);
    overflow:hidden;
  }
  .ct-meter > i{
    display:block;
    height:100%;
    width: var(--w, 0%);
    background: linear-gradient(90deg, rgba(170,225,255,.92), rgba(47,184,255,.90), rgba(42,125,255,.90));
    opacity:.78;
  }

  /* ===== Slider ===== */
  .ct-sliderRoot{
    position:relative;
    height:100dvh;
    min-height:100vh;
    overflow:hidden;
    background:#000;
  }
  .ct-sliderTrack{
    display:flex;
    width:200vw;
    height:100%;
    will-change: transform;
    transform: translate3d(var(--x, 0px), 0, 0);
    transition: transform 520ms cubic-bezier(.2,1,.2,1);
    touch-action: pan-y;
  }
  .ct-sliderTrack.is-dragging{ transition:none !important; cursor: grabbing; }
  .ct-slide{ width:100vw; height:100%; }

  .ct-split{
    width:100%;
    height:100%;
    display:grid;
    grid-template-columns: 1fr 1fr;
  }

  /* Visual halves */
  .ct-visual{
    position:relative;
    height:100%;
    overflow:hidden;
    background:#000;
  }
  .ct-visual::before{
    content:"";
    position:absolute;
    inset:0;
    background-image: url(${BG_IMG});
    background-repeat:no-repeat;
    background-size:200% 100%;
    background-position: var(--pos, 0% 50%);
    filter: saturate(1.05) contrast(1.02);
  }
  .ct-visual::after{
    content:"";
    position:absolute;
    inset:0;
    background:
      radial-gradient(900px 520px at 55% 25%, rgba(47,184,255,.10), transparent 62%),
      radial-gradient(1200px 800px at 50% 65%, rgba(0,0,0,.08), rgba(0,0,0,.86));
    pointer-events:none;
  }
  .ct-diagVisualLeft{ clip-path: polygon(0 0, 100% 0, 92% 100%, 0 100%); }
  .ct-diagVisualRight{ clip-path: polygon(8% 0, 100% 0, 100% 100%, 0 100%); }

  /* Content sides (NO panels) */
  .ct-side{
    position:relative;
    height:100%;
    padding: var(--pad);
    display:flex;
    align-items:center;
    justify-content:center;
    background:#000;
    overflow:hidden;
  }

  /* ✅ Grey background for text+form sides */
  .ct-side::before{
    content:"";
    position:absolute;
    inset:0;
    background-image: url(${SIDE_BG_IMG});
    background-size: cover;
    background-position: 50% 50%;
    opacity: .22;
    filter: grayscale(1) contrast(1.08) brightness(.78);
    transform: scale(1.02);
  }
  .ct-side::after{
    content:"";
    position:absolute;
    inset:0;
    background:
      radial-gradient(900px 520px at 35% 18%, rgba(47,184,255,.09), transparent 60%),
      radial-gradient(1200px 800px at 60% 65%, rgba(0,0,0,.18), rgba(0,0,0,.90));
    pointer-events:none;
  }
  .ct-sideContent{
    position:relative;
    z-index:2;
    width:100%;
    display:block;
  }

  /* Slide 1 left content */
  .ct-left{
    width:100%;
    max-width: var(--maxLeft);
  }
  .ct-pill{
    display:inline-flex;
    align-items:center;
    gap:10px;
    border:1px solid rgba(255,255,255,.12);
    background: rgba(255,255,255,.04);
    padding:10px 14px;
    border-radius:999px;
    margin-bottom:16px;
  }
  .ct-pillDot{
    width:8px; height:8px; border-radius:999px;
    background: rgba(47,184,255,1);
    box-shadow: 0 0 0 4px rgba(47,184,255,.14);
  }
  .ct-pillText{
    font-size:12px;
    letter-spacing:.14em;
    text-transform:uppercase;
    color: rgba(255,255,255,.70);
    white-space:nowrap;
  }
  .ct-h1{
    font-size: clamp(30px, 3.4vw, 54px);
    line-height:1.06;
    font-weight:820;
    margin:0;
  }
  .ct-p{
    margin-top:10px;
    color: rgba(255,255,255,.70);
    line-height:1.7;
    max-width: 520px;
  }

  /* Slide 2 right content: TOP aligned + internal scroll if needed */
  .ct-sideForm{
    align-items:flex-start;
    justify-content:flex-start;
    overflow:hidden;
    padding-top: max(14px, env(safe-area-inset-top));
    padding-bottom: max(14px, env(safe-area-inset-bottom));
  }
  .ct-formWrap{
    width:100%;
    max-width: var(--maxRight);
    display:flex;
    flex-direction: column;
    gap: 14px;
  }
  .ct-formTopRow{
    display:flex;
    justify-content:flex-end;
    align-items:center;
  }
  .ct-formBox{
    width:100%;
    max-height: calc(100dvh - (var(--pad) * 2) - 56px);
    overflow:auto;
    -webkit-overflow-scrolling: touch;
    padding-right: 6px; /* keeps scrollbar away */
  }
  .ct-formBox::-webkit-scrollbar{ width: 10px; }
  .ct-formBox::-webkit-scrollbar-thumb{ background: rgba(255,255,255,.12); border-radius: 999px; border: 3px solid rgba(0,0,0,0); background-clip: content-box; }
  .ct-formBox::-webkit-scrollbar-track{ background: transparent; }

  .ct-status{
    border: 1px solid rgba(255,255,255,.12);
    background: rgba(255,255,255,.04);
    border-radius: 16px;
    padding: 12px 14px;
  }

  /* ✅ Reveal like ResourcesFaq */
  .ct-reveal{
    opacity: 0;
    transform: translateY(8px);
    transition: opacity .55s ease, transform .55s ease;
    will-change: opacity, transform;
  }
  .ct-revealOn{
    opacity: 1;
    transform: translateY(0);
  }

  /* Mobile */
  @media (max-width: 560px){
    .ct-split{ grid-template-columns: 1fr; }
    .ct-visual{ height: 44vh; clip-path:none !important; }
    .ct-side{ height: 56vh; padding: 16px; }
    .ct-formBox{ max-height: none; padding-right: 0; }
  }

  @media (prefers-reduced-motion: reduce){
    .ct-sliderTrack{ transition:none !important; }
    .ct-reveal{ transition:none !important; transform:none !important; opacity:1 !important; }
  }

  /* ===== Signal overlay (kept) ===== */
  .ct-signal{
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: #000;
    display: grid;
    place-items: center;
    overflow: hidden;
  }
  .ct-signalVideoWrap{
    position:absolute; inset:0;
    will-change: opacity, transform, filter;
    transition: opacity 900ms ease, filter 900ms ease, transform 900ms ease;
    opacity:1; filter: contrast(1.05) saturate(1.15); transform: scale(1.01);
  }
  .ct-signal.is-enter .ct-signalVideoWrap{ opacity:0; filter: blur(18px) contrast(1.1) saturate(1.12); transform: scale(1.06); }
  .ct-signal.is-fade .ct-signalVideoWrap{ opacity:0; filter: blur(10px) contrast(1.2) saturate(1.2); transform: scale(1.06); }
  .ct-signalVideo{ width:100%; height:100%; object-fit: cover; }
  .ct-signalVignette{
    position:absolute; inset:0; pointer-events:none;
    background:
      radial-gradient(900px 520px at 50% 20%, rgba(47,184,255,.10), transparent 62%),
      radial-gradient(1200px 800px at 50% 60%, rgba(0,0,0,.10), rgba(0,0,0,.88));
    opacity:.95;
  }
  .ct-signalScan{
    position:absolute; inset:-20%;
    pointer-events:none; opacity:.16;
    background: repeating-linear-gradient(to bottom, rgba(255,255,255,.06) 0px, rgba(255,255,255,.06) 1px, transparent 2px, transparent 6px);
    mix-blend-mode: overlay;
    animation: ctScan 2.2s linear infinite;
  }
  @keyframes ctScan{ 0%{ transform: translate3d(0,-6%,0);} 100%{ transform: translate3d(0,6%,0);} }

  .ct-signalText{
    position:relative; z-index:2;
    text-align:center;
    padding:20px;
    max-width:880px;
    opacity:0;
    transform: translate3d(0,10px,0);
    transition: opacity 600ms ease, transform 700ms cubic-bezier(.14,1,.22,1);
  }
  .ct-signal.is-text .ct-signalText{ opacity:1; transform: translate3d(0,0,0); }
  .ct-signalHeadline{
    font-size: clamp(22px, 4vw, 46px);
    line-height:1.08;
    font-weight:820;
    text-shadow: 0 0 22px rgba(47,184,255,.16), 0 10px 50px rgba(0,0,0,.60);
  }
  .ct-signalSub{
    margin-top: 12px;
    font-size: clamp(13px, 1.8vw, 16px);
    color: rgba(255,255,255,.68);
    letter-spacing: .06em;
    text-transform: uppercase;
  }
  @media (prefers-reduced-motion: reduce){
    .ct-signalVideoWrap{ transition:none !important; }
    .ct-signalText{ transition:none !important; }
    .ct-signalScan{ animation:none !important; }
  }
`;

const BreadcrumbPill = memo(function BreadcrumbPill({ text }: { text: string }) {
  return (
    <div className="ct-pill">
      <span className="ct-pillDot" aria-hidden="true" />
      <span className="ct-pillText">{text}</span>
    </div>
  );
});

/* ===================== API BASE ===================== */
const PROD_BACKEND_FALLBACK = "https://neox-backend-production.up.railway.app";
const API_BASE_RAW =
  ((globalThis as any)?.__NEOX_API__ as string | undefined) ||
  (import.meta as any)?.env?.VITE_API_BASE ||
  PROD_BACKEND_FALLBACK;
const API_BASE = String(API_BASE_RAW || "").replace(/\/+$/, "");

export default function Contact() {
  const { t, i18n } = useTranslation();
  const { lang } = useParams<{ lang?: string }>();
  const { pathname, search } = useLocation();

  const reduced = usePrefersReducedMotion();
  const langPrefix = (lang || i18n.language || "az").toLowerCase();

  useSeo({
    title: t("contact.seo.title"),
    description: t("contact.seo.description"),
    canonicalPath: `/${langPrefix}/contact`,
  });

  const isDemo = useMemo(() => new URLSearchParams(search).get("demo") === "1", [search]);

  const safeT = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  /* ===================== SLIDER STATE ===================== */
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [page, setPage] = useState<0 | 1>(0);

  const dragRef = useRef({ dragging: false, startX: 0, baseX: 0, width: 1 });
  const getW = () => (typeof window !== "undefined" ? window.innerWidth : 1);

  const setTrackX = (px: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.setProperty("--x", `${px}px`);
  };

  const snapTo = (p: 0 | 1) => {
    setPage(p);
    setTrackX(-p * getW());
  };

  useEffect(() => {
    const onResize = () => setTrackX(-page * getW());
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [page]);

  const shouldIgnoreDrag = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    return !!el.closest("input,textarea,button,a,select,label,[role='button'],.ct-formBox");
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (shouldIgnoreDrag(e.target)) return;
    const el = trackRef.current;
    if (!el) return;

    dragRef.current.dragging = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.width = getW();
    dragRef.current.baseX = -page * dragRef.current.width;

    el.classList.add("is-dragging");
    try {
      (e.target as any)?.setPointerCapture?.(e.pointerId);
    } catch {}
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el || !dragRef.current.dragging) return;

    const dx = e.clientX - dragRef.current.startX;
    const w = dragRef.current.width || getW();

    const minX = -1 * w - w * 0.12;
    const maxX = 0 + w * 0.12;

    setTrackX(clamp(dragRef.current.baseX + dx, minX, maxX));
  };

  const onPointerUp = () => {
    const el = trackRef.current;
    if (el) el.classList.remove("is-dragging");
    if (!dragRef.current.dragging) return;

    dragRef.current.dragging = false;

    const w = dragRef.current.width || getW();
    const raw = trackRef.current?.style.getPropertyValue("--x") || `${-page * w}px`;
    const currentX = parseFloat(raw.replace("px", "")) || -page * w;

    const threshold = w * 0.18;
    const target = currentX < -threshold ? 1 : 0;
    snapTo(target as 0 | 1);
  };

  /* ===================== HERO REVEAL (like ResourcesFaq) ===================== */
  const revealTimerRef = useRef<number | null>(null);
  const [revealCount, setRevealCount] = useState(0);

  const stopRevealTimer = () => {
    if (revealTimerRef.current) {
      window.clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  };

  const startReveal = () => {
    stopRevealTimer();
    setRevealCount(0);
    let i = 0;
    revealTimerRef.current = window.setInterval(() => {
      i += 1;
      setRevealCount(i);
      if (i >= 4) stopRevealTimer();
    }, 260);
  };

  useEffect(() => {
    // first open + when you come back to slide 1
    if (page === 0) startReveal();
    return () => stopRevealTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const showPill = revealCount >= 1;
  const showH1 = revealCount >= 2;
  const showP = revealCount >= 3;
  const showActions = revealCount >= 4;

  /* ===================== FORM STATE ===================== */
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    message: "",
    website: "",
  });

  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [touched, setTouched] = useState<{ [k: string]: boolean }>({});
  const [copiedEmail, setCopiedEmail] = useState(false);

  const email = "info@weneox.com";
  const WHATSAPP_NUMBER = "994518005577";
  const WA_TEXT = useMemo(() => encodeURIComponent(t("contact.whatsapp.text")), [t]);
  const WHATSAPP_LINK = useMemo(() => `https://wa.me/${WHATSAPP_NUMBER}?text=${WA_TEXT}`, [WA_TEXT]);

  useEffect(() => {
    if (isDemo && !formData.message) setFormData((p) => ({ ...p, message: t("contact.form.demo_prefill") }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const markTouched = (name: string) => setTouched((p) => ({ ...p, [name]: true }));
  const markRequiredTouched = () => setTouched((p) => ({ ...p, name: true, email: true, message: true }));

  const nameOk = clean(formData.name).length >= 2;
  const emailOk = isValidEmail(clean(formData.email));
  const msgOk = clean(formData.message).length >= 10;

  const msgLen = clean(formData.message).length;
  const msgPct = clamp(Math.round((msgLen / 500) * 100), 0, 100);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      window.setTimeout(() => setCopiedEmail(false), 1500);
    } catch {}
  };

  const canSubmit = status !== "loading" && nameOk && emailOk && msgOk;

  /* ===================== SIGNAL FLOW ===================== */
  const SIGNAL_VIDEO_URL =
    "https://res.cloudinary.com/dppoomunj/video/upload/v1771125203/228243_small_fglmkn.mp4";

  const [signalPhase, setSignalPhase] = useState<SignalPhase>("off");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timersRef = useRef<number[]>([]);

  const clearSignalTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  const stopSignal = () => {
    clearSignalTimers();
    setSignalPhase("off");
    const v = videoRef.current;
    if (v) {
      try {
        v.pause();
        v.currentTime = 0;
      } catch {}
    }
  };

  const startSignal = () => {
    clearSignalTimers();
    setErrorMessage("");
    setSignalPhase("enter");

    timersRef.current.push(
      window.setTimeout(() => {
        setSignalPhase("play");
        timersRef.current.push(
          window.setTimeout(() => {
            setSignalPhase("fade");
            timersRef.current.push(
              window.setTimeout(() => {
                setSignalPhase("text");
                timersRef.current.push(window.setTimeout(() => stopSignal(), reduced ? 2200 : 3200));
              }, reduced ? 0 : 1200)
            );
          }, 4000)
        );
      }, reduced ? 0 : 80)
    );
  };

  useEffect(() => {
    if (signalPhase !== "play") return;

    let raf1 = 0;
    let raf2 = 0;

    const tryPlay = async () => {
      const v = videoRef.current;
      if (!v) return;
      try {
        v.currentTime = 0;
        v.muted = true;
        v.playsInline = true;
        const p = v.play();
        if (p && typeof (p as any).catch === "function") (p as any).catch(() => {});
      } catch {}
    };

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => tryPlay());
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [signalPhase]);

  useEffect(() => {
    if (signalPhase === "off") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stopSignal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalPhase]);

  const overlayOn = signalPhase !== "off";
  useEffect(() => {
    if (!overlayOn) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [overlayOn]);

  useEffect(() => () => clearSignalTimers(), []);

  /* ===================== SUBMIT (backend preserved) ===================== */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (formData.website) {
      setFormData({ name: "", email: "", company: "", phone: "", message: "", website: "" });
      setTouched({});
      startSignal();
      return;
    }

    if (!canSubmit) {
      markRequiredTouched();
      setStatus("error");
      setErrorMessage(t("contact.form.errors.fill_required"));
      return;
    }

    setStatus("loading");

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);

    try {
      const payload = {
        name: clean(formData.name),
        email: clean(formData.email),
        company: clean(formData.company),
        phone: clean(formData.phone),
        message: formData.message.trim(),
        source: isDemo ? "demo" : "contact",
        page: pathname || `/${langPrefix}/contact`,
        lang: langPrefix,
        meta: { referrer: document.referrer || "", userAgent: navigator.userAgent, ts: Date.now() },
      };

      const res = await fetch(`${API_BASE}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {}

      if (!res.ok) {
        const msg = (data && (data.error || data.message)) || t("contact.form.errors.send_failed");
        throw new Error(msg);
      }

      setFormData({ name: "", email: "", company: "", phone: "", message: "", website: "" });
      setTouched({});
      setStatus("success");
      startSignal();
      window.setTimeout(() => setStatus("idle"), 4200);
    } catch (err: any) {
      const isAbort = err?.name === "AbortError";
      const msg = isAbort ? t("contact.form.errors.send_failed") : err?.message || t("contact.form.errors.send_failed");
      setStatus("error");
      setErrorMessage(msg);
    } finally {
      window.clearTimeout(timeout);
    }
  };

  const overlayFade = signalPhase === "fade" || signalPhase === "text";
  const overlayText = signalPhase === "text";
  const overlayEnter = signalPhase === "enter";

  const weirdLine = "SİQNAL GÖNDƏRİLDİ ✓";
  const weirdSub = "Orbit kanalı açıldı · cavab gözlənilir";

  return (
    <main className="ct-page">
      <style>{CONTACT_CSS}</style>

      {/* SIGNAL OVERLAY */}
      {overlayOn && (
        <div className={cx("ct-signal", overlayEnter && "is-enter", overlayFade && "is-fade", overlayText && "is-text")} role="dialog" aria-modal="true">
          <div className="ct-signalVideoWrap" aria-hidden={overlayText}>
            <video ref={videoRef} className="ct-signalVideo" src={SIGNAL_VIDEO_URL} autoPlay muted playsInline preload="auto" />
            <div className="ct-signalVignette" />
          </div>
          <div className="ct-signalScan" aria-hidden="true" />
          <div className="ct-signalText">
            <div className="ct-signalHeadline">
              <span className="ct-gradient">{weirdLine}</span>
            </div>
            <div className="ct-signalSub">{weirdSub}</div>
          </div>
        </div>
      )}

      <div style={{ display: overlayOn ? "none" : "block" }}>
        <section className="ct-sliderRoot" aria-label="Contact slider">
          <div
            ref={trackRef}
            className="ct-sliderTrack"
            style={{ ["--x" as any]: `${-page * (typeof window !== "undefined" ? window.innerWidth : 0)}px` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* SLIDE 1 */}
            <div className="ct-slide">
              <div className="ct-split">
                <div className="ct-side">
                  <div className="ct-sideContent">
                    <div className="ct-left">
                      <div className={cx("ct-reveal", showPill && "ct-revealOn")}>
                        <BreadcrumbPill text={safeT("contact.hero.breadcrumb", "NEOX / ƏLAQƏ")} />
                      </div>

                      <h1 className={cx("ct-h1", "ct-reveal", showH1 && "ct-revealOn")}>
                        Bizimlə əlaqə saxlamaq üçün <span className="ct-gradient">sürüşdürün</span> →
                      </h1>

                      <p className={cx("ct-p", "ct-reveal", showP && "ct-revealOn")}>
                        {safeT("contact.hero.sub", "Sağa sürüşdürəndə form açılacaq.")}
                      </p>

                      <div className={cx("ct-reveal", showActions && "ct-revealOn")} style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button type="button" className="ct-btn ct-btn--primary" onClick={() => snapTo(1)}>
                          {safeT("contact.hero.cta_form", "Form-a keç")} →
                        </button>

                        <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="ct-btn" aria-label="WhatsApp">
                          <CalendarDays className="h-5 w-5" />
                          {safeT("contact.hero.cta_whatsapp", "Demo üçün yaz")}
                        </a>

                        <button type="button" onClick={copyEmail} className="ct-btn" aria-label="Copy email">
                          <Mail className="h-5 w-5 opacity-80" />
                          {copiedEmail ? safeT("contact.common.copied", "Kopyalandı") : email}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className={cx("ct-visual", "ct-diagVisualRight")} style={{ ["--pos" as any]: "0% 50%" } as any} aria-hidden="true" />
              </div>
            </div>

            {/* SLIDE 2 */}
            <div className="ct-slide">
              <div className="ct-split">
                <div className={cx("ct-visual", "ct-diagVisualLeft")} style={{ ["--pos" as any]: "100% 50%" } as any} aria-hidden="true" />

                <div className={cx("ct-side", "ct-sideForm")}>
                  <div className="ct-sideContent">
                    <div className="ct-formWrap">
                      <div className="ct-formTopRow">
                        <button type="button" className="ct-btn" onClick={() => snapTo(0)} aria-label="Geri">
                          <ArrowLeft className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="ct-formBox">
                        {status !== "idle" && (
                          <div className="ct-status mb-4 flex items-start gap-3">
                            {status === "success" ? (
                              <>
                                <CheckCircle className="h-5 w-5 text-emerald-300 mt-[2px]" />
                                <div className="min-w-0">
                                  <div className="text-emerald-200 font-semibold">{safeT("contact.form.status.success_title", "Göndərildi")}</div>
                                </div>
                              </>
                            ) : status === "error" ? (
                              <>
                                <AlertTriangle className="h-5 w-5 text-red-300 mt-[2px]" />
                                <div className="min-w-0">
                                  <div className="text-red-200 font-semibold">{safeT("contact.form.status.error_title", "Xəta")}</div>
                                  <div className="text-red-200/85 text-sm">{errorMessage || safeT("contact.form.errors.send_failed", "Göndərmək mümkün olmadı")}</div>
                                </div>
                              </>
                            ) : (
                              <>
                                <div
                                  className="h-5 w-5 rounded-full border border-white/15"
                                  style={{
                                    background:
                                      "conic-gradient(from 90deg, rgba(47,184,255,.85), rgba(42,125,255,.75), rgba(170,225,255,.80), rgba(47,184,255,.85))",
                                    maskImage: "radial-gradient(circle at 50% 50%, transparent 58%, black 60%)",
                                    WebkitMaskImage: "radial-gradient(circle at 50% 50%, transparent 58%, black 60%)",
                                  }}
                                />
                                <div className="min-w-0">
                                  <div className="text-white font-semibold">{safeT("contact.form.status.loading_title", "Göndərilir...")}</div>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                          <input tabIndex={-1} autoComplete="off" name="website" value={formData.website} onChange={handleChange} className="hidden" />

                          <div className="grid sm:grid-cols-2 gap-4">
                            <div className="min-w-0">
                              <label className="block text-sm text-white/70 mb-2">{safeT("contact.form.fields.name.label", "Ad *")}</label>
                              <input
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                onBlur={() => markTouched("name")}
                                className={cx("ct-input", touched.name && !nameOk && "ct-input--bad")}
                                placeholder={safeT("contact.form.fields.name.placeholder", "Ad Soyad")}
                              />
                              {touched.name && !nameOk && <div className="mt-1 text-xs text-red-200/90">{safeT("contact.form.errors.name_short", "Ad çox qısadır")}</div>}
                            </div>

                            <div className="min-w-0">
                              <label className="block text-sm text-white/70 mb-2">{safeT("contact.form.fields.email.label", "Email *")}</label>
                              <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                onBlur={() => markTouched("email")}
                                className={cx("ct-input", touched.email && !emailOk && "ct-input--bad")}
                                placeholder={safeT("contact.form.fields.email.placeholder", "email@company.com")}
                              />
                              {touched.email && !emailOk && <div className="mt-1 text-xs text-red-200/90">{safeT("contact.form.errors.email_bad", "Email düzgün deyil")}</div>}
                            </div>
                          </div>

                          <div className="grid sm:grid-cols-2 gap-4">
                            <div className="min-w-0">
                              <label className="block text-sm text-white/70 mb-2">{safeT("contact.form.fields.company.label", "Şirkət")}</label>
                              <input
                                name="company"
                                value={formData.company}
                                onChange={handleChange}
                                className="ct-input"
                                placeholder={safeT("contact.form.fields.company.placeholder", "Şirkət adı")}
                              />
                            </div>

                            <div className="min-w-0">
                              <label className="block text-sm text-white/70 mb-2">{safeT("contact.form.fields.phone.label", "Telefon")}</label>
                              <input
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="ct-input"
                                placeholder={safeT("contact.form.fields.phone.placeholder", "+994 ...")}
                              />
                            </div>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-end justify-between gap-3">
                              <label className="block text-sm text-white/70 mb-2">{safeT("contact.form.fields.message.label", "Mesaj *")}</label>
                              <div className="text-xs text-white/45 mb-2">{msgLen}/500</div>
                            </div>

                            <textarea
                              name="message"
                              value={formData.message}
                              onChange={handleChange}
                              onBlur={() => markTouched("message")}
                              rows={6}
                              className={cx("ct-input", touched.message && !msgOk && "ct-input--bad")}
                              style={{ resize: "none" }}
                              placeholder={safeT("contact.form.fields.message.placeholder", "Mes: WhatsApp/Instagram lead-ləri CRM-ə düşsün, follow-up avtomatik olsun...")}
                            />

                            <div className="mt-2 flex items-center justify-end gap-3">
                              <div className="w-[160px] ct-meter" aria-label="Message meter">
                                <i style={{ ["--w" as any]: `${msgPct}%` }} />
                              </div>
                            </div>

                            {touched.message && !msgOk && <div className="mt-1 text-xs text-red-200/90">{safeT("contact.form.errors.message_short", "Mesaj çox qısadır")}</div>}
                          </div>

                          <button
                            type="submit"
                            disabled={!canSubmit}
                            className={cx("ct-btn ct-btn--primary w-full")}
                            aria-label={safeT("contact.form.submit_aria", "Submit")}
                            onClick={() => {
                              if (!canSubmit) markRequiredTouched();
                            }}
                          >
                            {status === "loading" ? (
                              safeT("contact.form.submit_loading", "Göndərilir...")
                            ) : (
                              <>
                                {safeT("contact.form.submit_signal", "Siqnal göndər")}
                                <Send className="h-5 w-5" />
                              </>
                            )}
                          </button>

                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            <button type="button" onClick={copyEmail} className="ct-btn" aria-label="Copy email">
                              <Copy className="h-4 w-4" />
                              {copiedEmail ? safeT("contact.common.copied", "Kopyalandı") : email}
                            </button>

                            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="ct-btn" aria-label="WhatsApp">
                              <CalendarDays className="h-5 w-5" />
                              {safeT("contact.hero.cta_whatsapp_alt", "WhatsApp")}
                            </a>
                          </div>

                          <div style={{ height: 6 }} />
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
