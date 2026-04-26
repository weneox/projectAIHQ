import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { DEFAULT_LANG, type Lang } from "../i18n/lang";

const HERO_BACKGROUND_VIDEO_URL =
  "https://res.cloudinary.com/dppoomunj/video/upload/v1777159382/9150545-hd_1920_1080_24fps_xw2ces.mov";

const BUSINESS_VISUAL_ONE =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1777157607/ChatGPT_Image_Apr_26_2026_02_52_52_AM_k5ua6g.webp";

const BUSINESS_VISUAL_TWO =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1777157641/5d7f54df-d9ff-4af8-8816-961fdfd809a9_vquktq.webp";

const VOICE_VISUAL =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1777157688/f08b0651-fcd9-4134-b27e-681e2cc2af04_v6e5q8.webp";

const CONTENT_VISUAL =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1777157728/7980da92-7475-4408-9c82-3fa23b913176_cyoxq8.webp";

const CHATBOT_VISUAL =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1777157761/857c6bd2-374e-4ca1-85e3-3f62ea93a5a4_itzbj8.webp";

const BRAND_VISUAL =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1777157819/cdc46192-1199-4157-9005-df6655aec353_nl1lmz.webp";

const LANGS: Lang[] = ["az", "tr", "ru", "en", "es"];

function isLang(value: string | undefined | null): value is Lang {
  return Boolean(value && (LANGS as readonly string[]).includes(value));
}

function useSafeLang(): Lang {
  const { lang } = useParams<{ lang?: string }>();
  return isLang(lang) ? lang : DEFAULT_LANG;
}

function withLang(lang: Lang, path: string) {
  if (path === "/") return `/${lang}`;
  return `/${lang}${path.startsWith("/") ? path : `/${path}`}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const heroPhrases = [
  "veb saytlar",
  "brend görünüşü",
  "kontent axınları",
  "səsli assistantlar",
  "biznes workflow-ları",
  "24/7 çatbotlar",
  "Süni İntellekt sistemləri",
  "satış yönümlü axınlar",
];

const stripItems = [
  "VEB SAYTLAR",
  "BREND GÖRÜNÜŞÜ",
  "KONTENT AXINI",
  "SƏSLİ ASSISTANT",
  "BİZNES WORKFLOW",
  "24/7 ÇATBOT",
  "SÜNİ İNTELLEKT",
  "SATIŞ AXINI",
  "MÜŞTƏRİ CAVABLARI",
  "AVTOMATLAŞDIRMA",
];

const serviceCards = [
  {
    title: "Veb saytlar hazırlayırıq",
    text: "Brendinizə uyğun, sürətli, modern və satışa yönəlmiş veb saytlar hazırlayırıq.",
    href: "/services/websites",
    imageUrl: BUSINESS_VISUAL_ONE,
  },
  {
    title: "Biznes iş axınlarını avtomatlaşdırırıq",
    text: "Sifariş, müraciət, qeydiyyat və komanda proseslərini ardıcıl avtomatik axına salırıq.",
    href: "/services/business-workflows",
    imageUrl: BUSINESS_VISUAL_TWO,
  },
  {
    title: "Səsli assistantlar qururuq",
    text: "Zənglərə cavab verən, məlumat toplayan və müştərini düzgün istiqamətə yönləndirən səsli sistemlər qururuq.",
    href: "/services/chatbot-24-7",
    imageUrl: VOICE_VISUAL,
  },
  {
    title: "Kontent axınını qururuq",
    text: "İdeyadan paylaşımadək kontent planı, çəkiliş, təsdiq və paylaşım prosesini sistemləşdiririk.",
    href: "/services/smm-automation",
    imageUrl: CONTENT_VISUAL,
  },
  {
    title: "24/7 çatbotlar qururuq",
    text: "Sosial media və vebsaytlarda müştəriyə gecə-gündüz cavab verən ağıllı çatbotlar qururuq.",
    href: "/services/chatbot-24-7",
    imageUrl: CHATBOT_VISUAL,
  },
  {
    title: "Brend görünüşünü yaradırıq",
    text: "Logo, rəng, tipografiya və vizual üslubu biznesin xarakterinə uyğun premium şəkildə formalaşdırırıq.",
    href: "/services/websites",
    imageUrl: BRAND_VISUAL,
  },
] as const;

const processSteps = [
  {
    number: "01",
    title: "Tanışlıq & Analiz",
    text: "Biznesinizi, hədəflərinizi və mövcud prosesləri anlayırıq.",
  },
  {
    number: "02",
    title: "Strategiya & Plan",
    text: "Uyğun yanaşmanı, sistem xəritəsini və icra planını hazırlayırıq.",
  },
  {
    number: "03",
    title: "İcra & Qurulum",
    text: "Veb, kontent, satış və avtomatlaşdırma hissələrini vahid sistem kimi qururuq.",
  },
  {
    number: "04",
    title: "Test & Təqdimat",
    text: "Nəticəni birlikdə yoxlayır, təkmilləşdirir və təqdim edirik.",
  },
  {
    number: "05",
    title: "Dəstək & Optimallaşdırma",
    text: "Layihədən sonra sistemi izləyir, dəstəkləyir və inkişaf etdiririk.",
  },
] as const;

const HOME_INLINE_CSS = `
  html,
  body,
  #root {
    scroll-snap-type: none !important;
  }

  .neox-home-page,
  .neox-home-page * {
    scroll-snap-align: none !important;
    scroll-snap-stop: normal !important;
  }

  .neox-home-extra {
    --home-section-title: clamp(2.05rem, 3vw, 3.15rem);
    --home-section-title-mobile: clamp(2rem, 8vw, 2.75rem);
    --home-title-line: linear-gradient(
      90deg,
      transparent,
      rgba(36, 71, 198, 0.16),
      rgba(73, 100, 255, 0.72),
      rgba(36, 71, 198, 0.16),
      transparent
    );
    background: #ffffff;
  }

  .neox-home-page .neox-card-section,
  .neox-home-page .neox-process-section,
  .neox-home-page .neox-extra-section-three,
  .neox-home-page .neox-interactive-system-section {
    background: #ffffff !important;
    border: 0 !important;
    box-shadow: none !important;
  }

  .neox-home-page .neox-process-section::before,
  .neox-home-page .neox-extra-section-three::before {
    display: none !important;
  }

  .neox-home-section-head {
    max-width: 780px;
    margin: 0 auto 42px;
    text-align: center;
  }

  .neox-home-section-title,
  .neox-home-extra .neox-extra-title,
  .neox-home-extra .neox-build-title,
  .neox-home-extra .neox-process-title,
  .neox-stack-title {
    margin: 0;
    color: var(--nx-ink);
    font-size: var(--home-section-title) !important;
    font-weight: 520;
    line-height: 1.08;
    letter-spacing: -0.058em;
    text-wrap: balance;
  }

  .neox-home-section-title {
    max-width: 720px;
    margin-inline: auto;
    text-align: center;
  }

  .neox-home-section-title span,
  .neox-home-extra .neox-extra-title span,
  .neox-home-extra .neox-build-title span,
  .neox-home-extra .neox-process-title span,
  .neox-stack-title span {
    color: var(--nx-blue);
    font-weight: inherit;
  }

  .neox-home-section-title::after,
  .neox-home-extra .neox-extra-title::after,
  .neox-home-extra .neox-build-title::after,
  .neox-home-extra .neox-process-title::after,
  .neox-stack-title::after {
    content: "";
    display: block;
    width: 68px;
    height: 1px;
    margin-top: 22px;
    background: var(--home-title-line);
    box-shadow:
      0 0 14px rgba(73, 100, 255, 0.2),
      0 0 32px rgba(73, 100, 255, 0.09);
  }

  .neox-home-section-title::after,
  .neox-capability-head .neox-extra-title::after,
  .neox-stack-title::after {
    margin-left: auto;
    margin-right: auto;
  }

  .neox-extra-kicker {
    margin: 0 0 14px;
    color: var(--nx-blue);
    font-size: 11px;
    font-weight: 760;
    line-height: 1.2;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .neox-extra-lead {
    margin: 22px 0 0;
    max-width: 560px;
    color: var(--nx-muted);
    font-size: 15.5px;
    font-weight: 430;
    line-height: 1.82;
    letter-spacing: -0.018em;
  }

  .neox-card-section {
    padding-top: 86px !important;
    padding-bottom: 88px !important;
  }

  .neox-interactive-system-section {
    position: relative;
    background: #ffffff;
    overflow: visible;
  }

  .neox-interactive-sticky {
    position: relative;
    height: 100svh;
    min-height: 720px;
    overflow: hidden;
    background: #ffffff;
    isolation: isolate;
  }

  .neox-interactive-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
    background: #ffffff;
    pointer-events: none;
  }

  .neox-interactive-bg::before {
    content: "";
    position: absolute;
    left: 50%;
    top: 50%;
    width: min(74vw, 980px);
    height: min(42vh, 380px);
    border-radius: 999px;
    border: 1px solid rgba(15, 23, 42, 0.052);
    transform: translate(-50%, -50%);
    opacity: 0.72;
  }

  .neox-interactive-stage {
    position: relative;
    z-index: 2;
    height: 100%;
    overflow: hidden;
  }

  .neox-interactive-inner {
    width: 100%;
    height: 100%;
    margin: 0 auto;
    position: relative;
  }

  .neox-gsap-text {
    position: absolute;
    width: min(560px, 42vw);
    will-change: transform, opacity;
    transform: translate3d(0, 0, 0);
    backface-visibility: hidden;
  }

  .neox-gsap-text-one {
    left: 58px;
    top: clamp(74px, 13vh, 128px);
  }

  .neox-gsap-text-two {
    right: 58px;
    bottom: clamp(58px, 10vh, 96px);
    opacity: 0;
  }

  .neox-gsap-kicker {
    margin: 0 0 16px;
    color: var(--nx-blue);
    font-size: 11px;
    font-weight: 780;
    line-height: 1.2;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .neox-gsap-title {
    margin: 0;
    color: var(--nx-ink);
    font-size: clamp(2.4rem, 4.8vw, 5.35rem);
    font-weight: 530;
    line-height: 0.98;
    letter-spacing: -0.07em;
    text-wrap: balance;
  }

  .neox-gsap-title span {
    color: var(--nx-blue);
    font-weight: inherit;
  }

  .neox-gsap-title::after {
    content: "";
    display: block;
    width: 72px;
    height: 1px;
    margin-top: 26px;
    background: var(--home-title-line);
    box-shadow:
      0 0 14px rgba(73, 100, 255, 0.2),
      0 0 32px rgba(73, 100, 255, 0.09);
  }

  .neox-gsap-lead {
    margin: 26px 0 0;
    max-width: 520px;
    color: #506178;
    font-size: 1rem;
    font-weight: 440;
    line-height: 1.82;
    letter-spacing: -0.018em;
  }

  .neox-gsap-points {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-top: 30px;
  }

  .neox-gsap-point {
    min-height: 108px;
    padding: 15px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.86);
    border: 1px solid rgba(15, 23, 42, 0.07);
    box-shadow: 0 16px 44px rgba(15, 23, 42, 0.055);
    backdrop-filter: blur(16px);
  }

  .neox-gsap-point span {
    display: block;
    width: 27px;
    height: 27px;
    margin-bottom: 12px;
    border-radius: 10px;
    background: rgba(36, 71, 198, 0.08);
    color: var(--nx-blue);
    font-size: 11px;
    font-weight: 760;
    line-height: 27px;
    text-align: center;
  }

  .neox-gsap-point strong {
    display: block;
    color: var(--nx-ink);
    font-size: 13.5px;
    font-weight: 730;
    line-height: 1.18;
    letter-spacing: -0.022em;
  }

  .neox-gsap-point p {
    margin: 7px 0 0;
    color: #64748b;
    font-size: 12.6px;
    font-weight: 430;
    line-height: 1.44;
    letter-spacing: -0.012em;
  }

  .neox-gsap-mini-label {
    position: absolute;
    z-index: 3;
    left: 50%;
    bottom: 44px;
    transform: translateX(-50%);
    min-height: 38px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 16px;
    border-radius: 13px;
    background: rgba(255, 255, 255, 0.76);
    border: 1px solid rgba(15, 23, 42, 0.07);
    color: #52627a;
    font-size: 12px;
    font-weight: 660;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    backdrop-filter: blur(18px);
    box-shadow: 0 18px 44px rgba(15, 23, 42, 0.08);
  }

  .neox-stack-panel {
    position: absolute;
    top: var(--nx-header-h, 56px);
    bottom: auto;
    height: calc(100% - var(--nx-header-h, 56px));
    overflow: hidden;
    background: #ffffff;
    border: 1px solid rgba(15, 23, 42, 0.065);
    box-shadow:
      0 -18px 70px rgba(15, 23, 42, 0.08),
      0 18px 70px rgba(15, 23, 42, 0.065);
    will-change: transform, opacity;
    transform: translate3d(0, 0, 0);
    transform-origin: center top;
    backface-visibility: hidden;
    contain: paint;
  }

  .neox-stack-panel--one {
    left: 0;
    right: 0;
    width: 100%;
    height: calc(100% - var(--nx-header-h, 56px));
    border-radius: 54px 54px 0 0;
    z-index: 10;
  }

  .neox-stack-panel--two {
    left: clamp(28px, 3.25vw, 56px);
    right: clamp(28px, 3.25vw, 56px);
    height: calc(100% - var(--nx-header-h, 56px));
    border-radius: 46px 46px 0 0;
    z-index: 11;
  }

  .neox-stack-panel--three {
    left: clamp(64px, 7vw, 112px);
    right: clamp(64px, 7vw, 112px);
    height: calc(100% - var(--nx-header-h, 56px));
    border-radius: 42px 42px 0 0;
    z-index: 12;
  }

  .neox-stack-panel--four {
    left: 0;
    right: 0;
    width: 100%;
    height: calc(100% - var(--nx-header-h, 56px));
    border-radius: 0;
    z-index: 20;
    border-left: 0;
    border-right: 0;
    border-bottom: 0;
    box-shadow:
      0 -22px 76px rgba(15, 23, 42, 0.1),
      0 -1px 0 rgba(15, 23, 42, 0.06);
  }

  .neox-stack-panel-inner {
    width: min(100%, var(--nx-container));
    height: 100%;
    margin: 0 auto;
    padding: clamp(16px, 2vw, 28px) 24px clamp(28px, 3.8vw, 52px);
    overflow: hidden;
  }

  .neox-stack-panel--one .neox-stack-panel-inner {
    max-width: none;
    width: 100%;
    padding-top: clamp(16px, 2vw, 28px);
    padding-right: clamp(26px, 3.55vw, 62px);
    padding-bottom: clamp(28px, 3.8vw, 52px);
    padding-left: clamp(26px, 3.55vw, 62px);
    overflow: hidden;
    overflow: clip;
  }

  .neox-stack-panel--two .neox-stack-panel-inner {
    max-width: 1400px;
    padding-top: clamp(16px, 2vw, 28px);
    padding-right: clamp(26px, 3vw, 48px);
    padding-bottom: clamp(28px, 3.8vw, 52px);
    padding-left: clamp(26px, 3vw, 48px);
    overflow: hidden;
    overflow: clip;
  }

  .neox-stack-panel--three .neox-stack-panel-inner {
    max-width: 1280px;
    height: 100%;
    min-height: 0;
    padding-top: clamp(16px, 2vw, 28px);
    padding-right: clamp(26px, 3vw, 48px);
    padding-bottom: clamp(28px, 3.8vw, 52px);
    padding-left: clamp(26px, 3vw, 48px);
    display: block;
    overflow: hidden;
    overflow: clip;
    will-change: auto;
  }

  .neox-stack-panel--four .neox-stack-panel-inner {
    height: 100%;
    max-width: var(--nx-container);
    padding: clamp(70px, 8vw, 106px) 24px clamp(58px, 7vw, 88px);
    display: flex;
    align-items: center;
  }

  .neox-stack-panel-head {
    max-width: 760px;
    margin: 0 auto 32px;
    text-align: center;
  }

  .neox-stack-panel--two .neox-stack-panel-head {
    margin-bottom: 20px;
  }

  .neox-stack-lead {
    margin: 20px auto 0;
    max-width: 620px;
    color: #5b6b82;
    font-size: 15.5px;
    font-weight: 430;
    line-height: 1.78;
    letter-spacing: -0.016em;
  }

  .neox-stack-grid {
    display: grid;
    gap: 18px;
  }

  .neox-stack-grid--three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .neox-stack-grid--two {
    grid-template-columns: 0.9fr 1.1fr;
    align-items: stretch;
  }

  .neox-stack-grid--metrics {
    grid-template-columns: 1.05fr repeat(3, minmax(0, 1fr));
    align-items: stretch;
  }

  .neox-stack-clean-card {
    position: relative;
    min-height: 300px;
    overflow: hidden;
    padding: 26px;
    border-radius: 28px;
    border: 1px solid rgba(15, 23, 42, 0.075);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,249,251,0.96)),
      #ffffff;
    box-shadow: 0 20px 52px rgba(15, 23, 42, 0.06);
    will-change: transform, opacity;
  }

  .neox-stack-clean-card::before {
    content: "";
    position: absolute;
    left: 26px;
    top: 26px;
    width: 34px;
    height: 34px;
    border-radius: 13px;
    background: rgba(36, 71, 198, 0.08);
  }

  .neox-stack-clean-card::after {
    content: "";
    position: absolute;
    left: 43px;
    top: 62px;
    bottom: 26px;
    width: 1px;
    background: linear-gradient(180deg, rgba(36, 71, 198, 0.2), transparent);
  }

  .neox-stack-card-label {
    display: inline-flex;
    align-items: center;
    min-height: 30px;
    margin-top: 58px;
    padding: 0 10px;
    border-radius: 10px;
    background: rgba(36, 71, 198, 0.07);
    border: 1px solid rgba(36, 71, 198, 0.1);
    color: var(--nx-blue);
    font-size: 11px;
    font-weight: 760;
    line-height: 1;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .neox-stack-clean-card h3 {
    margin: 20px 0 0;
    color: var(--nx-ink);
    font-size: 1.42rem;
    font-weight: 560;
    line-height: 1.1;
    letter-spacing: -0.05em;
    text-wrap: balance;
  }

  .neox-stack-clean-card p {
    margin: 12px 0 0;
    color: #607087;
    font-size: 14px;
    font-weight: 420;
    line-height: 1.65;
    letter-spacing: -0.012em;
  }

  .neox-stack-note {
    min-height: 132px;
    display: flex;
    align-items: center;
    padding: 26px;
    border-radius: 24px;
    background: #0e1420;
    color: #ffffff;
    will-change: transform, opacity;
  }

  .neox-stack-note strong {
    display: block;
    max-width: 430px;
    font-size: 1.1rem;
    font-weight: 560;
    line-height: 1.25;
    letter-spacing: -0.04em;
  }

  .neox-stack-metric {
    min-height: 132px;
    padding: 22px;
    border-radius: 24px;
    background: #f8f9fb;
    border: 1px solid rgba(15, 23, 42, 0.065);
    will-change: transform, opacity;
  }

  .neox-stack-metric strong {
    display: block;
    color: var(--nx-ink);
    font-size: 1.58rem;
    font-weight: 620;
    line-height: 1;
    letter-spacing: -0.05em;
  }

  .neox-stack-metric span {
    display: block;
    margin-top: 12px;
    color: #65758b;
    font-size: 13.5px;
    font-weight: 430;
    line-height: 1.5;
    letter-spacing: -0.012em;
  }

  .neox-stack-system-board {
    min-height: 280px;
    padding: 22px;
    border-radius: 28px;
    border: 1px solid rgba(15, 23, 42, 0.075);
    background:
      radial-gradient(420px 220px at 20% 14%, rgba(36, 71, 198, 0.07), transparent 68%),
      linear-gradient(180deg, #ffffff, #f8f9fb);
    box-shadow: 0 22px 62px rgba(15, 23, 42, 0.06);
    will-change: transform, opacity;
  }

  .neox-stack-system-board-row {
    display: grid;
    grid-template-columns: 46px minmax(0, 1fr);
    gap: 14px;
    align-items: center;
    padding: 14px;
    border-radius: 19px;
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(15, 23, 42, 0.06);
  }

  .neox-stack-system-board-row + .neox-stack-system-board-row {
    margin-top: 10px;
  }

  .neox-stack-system-board-badge {
    width: 46px;
    height: 46px;
    display: grid;
    place-items: center;
    border-radius: 16px;
    background: rgba(36, 71, 198, 0.08);
    color: var(--nx-blue);
    font-size: 12px;
    font-weight: 780;
  }

  .neox-stack-system-board-row h4 {
    margin: 0;
    color: var(--nx-ink);
    font-size: 0.96rem;
    font-weight: 680;
    line-height: 1.2;
    letter-spacing: -0.028em;
  }

  .neox-stack-system-board-row p {
    margin: 5px 0 0;
    color: #607087;
    font-size: 13px;
    font-weight: 420;
    line-height: 1.48;
    letter-spacing: -0.012em;
  }

  .neox-stack-split-text {
    padding: 2px 0 2px 4px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .neox-stack-split-list {
    display: grid;
    gap: 9px;
    margin-top: 18px;
  }

  .neox-stack-split-item {
    display: grid;
    grid-template-columns: 38px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
    padding: 13px 15px 13px 12px;
    border-radius: 18px;
    background: #f8f9fb;
    border: 1px solid rgba(15, 23, 42, 0.065);
    will-change: transform, opacity;
  }

  .neox-stack-split-item-badge {
    width: 38px;
    height: 38px;
    border-radius: 13px;
    background: rgba(36, 71, 198, 0.08);
    color: var(--nx-blue);
    font-size: 11px;
    font-weight: 760;
    line-height: 38px;
    text-align: center;
  }

  .neox-stack-split-item h4 {
    margin: 0;
    color: var(--nx-ink);
    font-size: 0.98rem;
    font-weight: 650;
    line-height: 1.18;
    letter-spacing: -0.03em;
  }

  .neox-stack-split-item p {
    margin: 6px 0 0;
    color: #607087;
    font-size: 13px;
    font-weight: 420;
    line-height: 1.48;
    letter-spacing: -0.013em;
  }

  .neox-stack-panel--three .neox-stack-grid--two {
    width: 100%;
    gap: clamp(14px, 1.8vw, 22px);
    align-items: start;
  }

  .neox-stack-panel--three .neox-stack-title {
    font-size: clamp(1.68rem, 2.1vw, 2.38rem) !important;
    line-height: 1.02;
    letter-spacing: -0.06em;
  }

  .neox-stack-panel--three .neox-stack-title::after {
    width: 56px;
    margin-top: 14px;
  }

  .neox-stack-panel--three .neox-extra-kicker {
    margin-bottom: 9px;
    font-size: 10.5px;
    letter-spacing: 0.15em;
  }

  .neox-stack-panel--three .neox-stack-lead {
    max-width: 520px;
    margin-top: 12px;
    font-size: 14px;
    line-height: 1.5;
  }

  .neox-stack-panel--three .neox-stack-system-board {
    min-height: auto;
    padding: 14px;
    border-radius: 24px;
  }

  .neox-stack-panel--three .neox-stack-system-board-row {
    grid-template-columns: 40px minmax(0, 1fr);
    gap: 12px;
    padding: 11px;
    border-radius: 17px;
  }

  .neox-stack-panel--three .neox-stack-system-board-row + .neox-stack-system-board-row {
    margin-top: 8px;
  }

  .neox-stack-panel--three .neox-stack-system-board-badge {
    width: 40px;
    height: 40px;
    border-radius: 14px;
    font-size: 11px;
  }

  .neox-stack-panel--three .neox-stack-system-board-row h4 {
    font-size: 0.92rem;
    line-height: 1.15;
  }

  .neox-stack-panel--three .neox-stack-system-board-row p {
    margin-top: 4px;
    font-size: 12.5px;
    line-height: 1.36;
  }

  .neox-stack-panel--three .neox-stack-split-list {
    gap: 7px;
    margin-top: 13px;
  }

  .neox-stack-panel--three .neox-stack-split-item {
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 10px;
    padding: 9px 12px 9px 9px;
    border-radius: 16px;
  }

  .neox-stack-panel--three .neox-stack-split-item-badge {
    width: 34px;
    height: 34px;
    border-radius: 12px;
    font-size: 10.5px;
    line-height: 34px;
  }

  .neox-stack-panel--three .neox-stack-split-item h4 {
    font-size: 0.9rem;
    line-height: 1.15;
  }

  .neox-stack-panel--three .neox-stack-split-item p {
    margin-top: 4px;
    font-size: 12.4px;
    line-height: 1.34;
  }

  .neox-layer-measure-word {
    color: inherit !important;
  }

  .neox-capability-inner {
    position: relative;
    z-index: 1;
    width: 100%;
  }

  .neox-capability-head {
    max-width: 780px;
    margin: 0 auto 38px;
    text-align: center;
  }

  .neox-capability-head .neox-extra-title {
    max-width: 760px;
    margin-inline: auto;
    text-align: center;
  }

  .neox-capability-head .neox-extra-lead {
    max-width: 640px;
    margin: 20px auto 0;
    text-align: center;
  }

  .neox-capability-grid {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border-top: 1px solid rgba(15, 23, 42, 0.075);
    border-left: 1px solid rgba(15, 23, 42, 0.075);
  }

  .neox-capability-card {
    min-height: 236px;
    padding: 28px 24px;
    border-right: 1px solid rgba(15, 23, 42, 0.075);
    border-bottom: 1px solid rgba(15, 23, 42, 0.075);
    background: #ffffff !important;
    transition:
      background-color 180ms ease,
      box-shadow 180ms ease;
  }

  .neox-capability-card:hover {
    background: #ffffff !important;
    box-shadow: inset 0 2px 0 rgba(36, 71, 198, 0.35);
  }

  .neox-capability-number {
    display: block;
    color: rgba(15, 23, 42, 0.26);
    font-family: var(--nx-font-display);
    font-size: 3.1rem;
    font-weight: 400;
    line-height: 0.9;
    letter-spacing: -0.055em;
  }

  .neox-capability-card:hover .neox-capability-number {
    color: var(--nx-blue);
  }

  .neox-capability-card h3 {
    margin: 34px 0 0;
    color: var(--nx-ink);
    font-size: 1.22rem;
    font-weight: 560;
    line-height: 1.12;
    letter-spacing: -0.045em;
    text-wrap: balance;
  }

  .neox-capability-card p {
    margin: 13px 0 0;
    color: #5f6c80;
    font-size: 14px;
    font-weight: 420;
    line-height: 1.68;
    letter-spacing: -0.014em;
  }

  .neox-extra-section-three {
    position: relative;
    overflow: hidden;
    padding: 92px 0 !important;
    background: #ffffff !important;
  }

  .neox-build-band {
    position: relative;
    overflow: hidden;
    display: grid;
    grid-template-columns: minmax(0, 0.96fr) minmax(320px, 0.54fr);
    gap: clamp(34px, 5vw, 74px);
    align-items: center;
    padding: clamp(34px, 5vw, 58px);
    border-radius: 30px;
    border: 1px solid rgba(15, 23, 42, 0.07) !important;
    background: #ffffff !important;
    background-image: none !important;
    box-shadow: 0 22px 62px rgba(15, 23, 42, 0.055) !important;
  }

  .neox-build-band::after {
    display: none !important;
  }

  .neox-build-content {
    position: relative;
    z-index: 1;
  }

  .neox-build-text {
    margin: 20px 0 0;
    max-width: 620px;
    color: #5a677c;
    font-size: 15.5px;
    font-weight: 420;
    line-height: 1.78;
    letter-spacing: -0.016em;
  }

  .neox-build-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 26px;
  }

  .neox-build-tags span {
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    padding: 0 12px;
    border-radius: 11px;
    border: 1px solid rgba(15, 23, 42, 0.075);
    background: rgba(255, 255, 255, 0.72);
    color: var(--nx-muted);
    font-size: 12.5px;
    font-weight: 620;
    letter-spacing: -0.012em;
  }

  .neox-build-actions {
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  @media (max-width: 1180px) {
    .neox-gsap-text {
      width: min(620px, 58vw);
    }

    .neox-stack-grid--three,
    .neox-stack-grid--two {
      grid-template-columns: 1fr;
    }

    .neox-stack-grid--metrics {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .neox-stack-note {
      grid-column: 1 / -1;
    }

    .neox-stack-clean-card {
      min-height: 220px;
    }

    .neox-stack-system-board {
      min-height: 280px;
    }

    .neox-capability-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .neox-build-band {
      grid-template-columns: 1fr;
    }

    .neox-build-actions {
      justify-content: flex-start;
    }
  }

  @media (max-width: 900px) {
    .neox-interactive-system-section {
      height: auto;
    }

    .neox-interactive-sticky {
      position: relative;
      top: auto;
      height: auto;
      min-height: 0;
      padding: 76px 0 0;
      overflow: visible;
    }

    .neox-interactive-stage {
      height: auto;
      overflow: visible;
    }

    .neox-interactive-inner {
      display: grid;
      gap: 34px;
      height: auto;
    }

    .neox-gsap-text {
      position: relative;
      left: auto;
      right: auto;
      top: auto;
      bottom: auto;
      width: 100%;
      padding-inline: 18px;
      transform: none !important;
      opacity: 1 !important;
    }

    .neox-gsap-text-two {
      display: none;
    }

    .neox-gsap-points {
      grid-template-columns: 1fr;
      max-width: 520px;
    }

    .neox-gsap-mini-label {
      display: none;
    }

    .neox-stack-panel {
      position: relative;
      top: auto !important;
      bottom: auto !important;
      left: auto !important;
      right: auto !important;
      width: 100%;
      height: auto !important;
      transform: none !important;
      border-radius: 34px 34px 0 0 !important;
      opacity: 1 !important;
      contain: none;
    }

    .neox-stack-panel--four {
      border-radius: 0 !important;
    }

    .neox-stack-panel + .neox-stack-panel {
      margin-top: -22px;
    }

    .neox-stack-panel-inner {
      height: auto;
      overflow: visible;
      padding: 34px 18px 46px;
      display: block;
    }
  }

  @media (max-width: 760px) {
    .neox-home-section-title,
    .neox-home-extra .neox-extra-title,
    .neox-home-extra .neox-build-title,
    .neox-home-extra .neox-process-title,
    .neox-stack-title {
      font-size: var(--home-section-title-mobile) !important;
    }

    .neox-gsap-title {
      font-size: clamp(2.45rem, 11vw, 4.2rem);
    }

    .neox-stack-grid--metrics {
      grid-template-columns: 1fr;
    }

    .neox-stack-clean-card,
    .neox-stack-system-board {
      min-height: 240px;
      border-radius: 22px;
    }

    .neox-capability-grid {
      grid-template-columns: 1fr;
    }

    .neox-capability-card {
      min-height: 210px;
    }

    .neox-extra-section-three {
      padding: 70px 0 !important;
    }

    .neox-build-actions {
      display: grid;
      width: 100%;
    }

    .neox-build-actions .nx-button {
      width: 100%;
    }
  }
`;

function HeroLoopText() {
  return (
    <span className="neox-hero-loop" aria-live="polite">
      <span className="neox-hero-loop-sizer" aria-hidden="true">
        Süni İntellekt sistemləri
      </span>

      {heroPhrases.map((phrase, index) => (
        <span
          key={phrase}
          className="neox-hero-loop-item"
          style={{ animationDelay: `${index * 3}s` }}
        >
          {phrase}
        </span>
      ))}
    </span>
  );
}

function SystemStrip() {
  const repeated = [...stripItems, ...stripItems, ...stripItems, ...stripItems];

  return (
    <div className="neox-system-strip">
      <div className="neox-system-strip-fade neox-system-strip-fade--left" />
      <div className="neox-system-strip-fade neox-system-strip-fade--right" />

      <div className="neox-system-strip-track-wrap">
        <div className="neox-home-strip">
          {repeated.map((item, index) => (
            <span key={`${item}-${index}`} className="neox-strip-item">
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function HomeHero() {
  const lang = useSafeLang();
  const heroRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const hero = heroRef.current;
    const video = videoRef.current;

    if (!hero || !video) return;

    let isHeroVisible = true;

    const playVideo = () => {
      if (document.visibilityState === "hidden") return;

      const reduceMotion = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (reduceMotion) {
        video.pause();
        return;
      }

      const playPromise = video.play();

      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => undefined);
      }
    };

    const pauseVideo = () => {
      video.pause();
    };

    const syncVideo = () => {
      if (document.visibilityState === "hidden" || !isHeroVisible) {
        pauseVideo();
        return;
      }

      playVideo();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        isHeroVisible = Boolean(
          entry?.isIntersecting && entry.intersectionRatio > 0.18,
        );
        syncVideo();
      },
      {
        threshold: [0, 0.18, 0.32, 0.6, 1],
      },
    );

    observer.observe(hero);
    document.addEventListener("visibilitychange", syncVideo);
    syncVideo();

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncVideo);
      pauseVideo();
    };
  }, []);

  return (
    <section ref={heroRef} className="neox-home-hero">
      <div className="neox-home-hero-main">
        <div className="neox-hero-media" aria-hidden="true">
          <video
            ref={videoRef}
            className="neox-hero-video"
            src={HERO_BACKGROUND_VIDEO_URL}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />

          <div className="neox-hero-overlay neox-hero-overlay--side" />
          <div className="neox-hero-overlay neox-hero-overlay--top" />
          <div className="neox-hero-overlay neox-hero-overlay--focus" />
        </div>

        <div className="nx-container neox-hero-container">
          <div className="neox-hero-copy">
            <h1 className="neox-hero-title">
              <span className="neox-hero-title-line">
                <span>Biz</span>
                <HeroLoopText />
              </span>
              <span className="neox-hero-title-line">qururuq.</span>
            </h1>

            <p className="neox-hero-lead">
              Veb sayt, brend görünüşü, kontent axını, zəng cavabları,
              avtomatlaşdırma və Süni İntellekt sistemlərini biznesiniz üçün
              işlək bir sistemə çeviririk.
            </p>

            <div className="neox-hero-actions">
              <Link
                to={withLang(lang, "/contact")}
                className="nx-button nx-button--primary nx-button--lg"
              >
                Sistemi quraq
              </Link>

              <Link
                to={withLang(lang, "/services")}
                className="nx-button nx-button--secondary nx-button--lg"
              >
                Xidmətlərə bax
              </Link>
            </div>
          </div>
        </div>
      </div>

      <SystemStrip />
    </section>
  );
}

function ServiceCardsSection() {
  const lang = useSafeLang();

  return (
    <section className="nx-section nx-section--soft neox-card-section">
      <div className="nx-container">
        <div className="neox-home-section-head">
          <p className="neox-extra-kicker">Xidmətlər</p>

          <h2 className="neox-home-section-title">
            Biznes sistemləri <span>qururuq.</span>
          </h2>
        </div>

        <div className="neox-card-grid">
          {serviceCards.map((card) => (
            <Link
              key={card.title}
              to={withLang(lang, card.href)}
              className="neox-system-card"
            >
              <div className="neox-card-cover">
                <img src={card.imageUrl} alt="" loading="lazy" decoding="async" />
              </div>

              <div className="neox-card-overlay" />

              <div className="neox-card-content">
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </div>

              <div className="neox-card-action">
                <span>Daha ətraflı</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const [activeIndex, setActiveIndex] = useState(-1);

  const sectionRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const movingRef = useRef<HTMLDivElement | null>(null);
  const stepRefs = useRef<Array<HTMLElement | null>>([]);

  const latestYRef = useRef(-1);
  const activeIndexRef = useRef(-1);

  useEffect(() => {
    let frame = 0;

    const getProcessTop = () => {
      const rawHeader = getComputedStyle(document.documentElement).getPropertyValue(
        "--nx-header-h",
      );
      const cssHeader = Number.parseFloat(rawHeader);

      const headerNode =
        document.querySelector<HTMLElement>("[data-site-header]") ||
        document.querySelector<HTMLElement>(".neox-header") ||
        document.querySelector<HTMLElement>(".nx-header") ||
        document.querySelector<HTMLElement>("header");

      const measuredHeader = headerNode?.getBoundingClientRect().height;
      const headerHeight = Number.isFinite(measuredHeader)
        ? Number(measuredHeader)
        : Number.isFinite(cssHeader)
          ? cssHeader
          : 56;

      return Math.round(headerHeight + 72);
    };

    const getStepAnchors = () => {
      const firstRow = stepRefs.current[0];
      const firstTop = firstRow?.offsetTop ?? 0;

      return processSteps.map((_, index) => {
        const row = stepRefs.current[index];
        if (!row) return index * 168;

        const content = row.querySelector<HTMLElement>(
          ".neox-process-row-content",
        );

        return row.offsetTop + (content?.offsetTop ?? 42) - firstTop;
      });
    };

    const setActive = (nextActive: number) => {
      if (nextActive !== activeIndexRef.current) {
        activeIndexRef.current = nextActive;
        setActiveIndex(nextActive);
      }
    };

    const update = () => {
      const section = sectionRef.current;
      const track = trackRef.current;
      const moving = movingRef.current;

      if (!section || !track || !moving) return;

      const anchors = getStepAnchors();
      const firstAnchor = anchors[0] ?? 0;
      const lastAnchor = anchors[anchors.length - 1] ?? firstAnchor;
      const maxY = Math.max(0, lastAnchor - firstAnchor);

      const scrollY = window.scrollY || window.pageYOffset;
      const trackTop = scrollY + track.getBoundingClientRect().top;
      const processTop = getProcessTop();

      const start = trackTop + firstAnchor - processTop;
      const rawY = scrollY - start;
      const nextY = Math.round(clamp(rawY, 0, maxY));

      const movingHeight = moving.offsetHeight || 260;
      const lastRow = stepRefs.current[stepRefs.current.length - 1];

      const trackHeight = Math.max(
        maxY + movingHeight + 40,
        lastRow ? lastRow.offsetTop + lastRow.offsetHeight : 840,
      );

      section.style.setProperty(
        "--neox-process-copy-start",
        `${Math.round(firstAnchor)}px`,
      );
      section.style.setProperty(
        "--neox-process-copy-track-h",
        `${Math.round(trackHeight)}px`,
      );

      if (Math.abs(latestYRef.current - nextY) > 0.5) {
        latestYRef.current = nextY;
        section.style.setProperty("--neox-process-copy-y", `${nextY}px`);
      }

      if (rawY < -32) {
        setActive(-1);
        return;
      }

      const revealLead = 112;
      let nextActive = 0;

      anchors.forEach((anchor, index) => {
        const relative = anchor - firstAnchor;

        if (nextY + revealLead >= relative) {
          nextActive = index;
        }
      });

      if (nextY >= maxY - 1) {
        nextActive = processSteps.length - 1;
      }

      setActive(nextActive);
    };

    const requestUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };

    requestUpdate();

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);

    const lateRefresh = window.setTimeout(() => {
      requestUpdate();
    }, 260);

    return () => {
      window.clearTimeout(lateRefresh);
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="nx-section nx-section--white neox-process-section"
      style={
        {
          "--neox-process-copy-y": "0px",
          "--neox-process-copy-start": "0px",
          "--neox-process-copy-track-h": "840px",
        } as CSSProperties
      }
    >
      <div className="nx-container neox-process-stage">
        <div className="neox-process-editorial">
          <div ref={trackRef} className="neox-process-copy-track">
            <div ref={movingRef} className="neox-process-moving">
              <h2 className="nx-section-title neox-balanced-section-title neox-process-title">
                Necə <span>işləyirik?</span>
              </h2>

              <p className="nx-section-lead neox-process-lead">
                İdeyanı sadə addımlarla işlək sistemə çeviririk. Hər mərhələ
                əvvəlkini tamamlayır və nəticə qarışıq yox, idarə olunan olur.
              </p>
            </div>
          </div>

          <div className="neox-process-list-wrap">
            <div className="neox-process-list">
              {processSteps.map((step, index) => {
                const isActive = index === activeIndex;
                const isVisible = activeIndex >= index;

                return (
                  <article
                    key={step.number}
                    ref={(node) => {
                      stepRefs.current[index] = node;
                    }}
                    className={[
                      "neox-process-row",
                      isActive ? "is-active" : "",
                      isVisible ? "is-visible" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={
                      {
                        "--neox-row-delay": "0ms",
                      } as CSSProperties
                    }
                  >
                    <div className="neox-process-row-number">{step.number}</div>

                    <div className="neox-process-row-divider" />

                    <div className="neox-process-row-content">
                      <h3>{step.title}</h3>
                      <p>{step.text}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InteractiveSystemSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stickyRef = useRef<HTMLDivElement | null>(null);
  const bgRef = useRef<HTMLDivElement | null>(null);

  const textOneRef = useRef<HTMLDivElement | null>(null);
  const textTwoRef = useRef<HTMLDivElement | null>(null);
  const miniLabelRef = useRef<HTMLDivElement | null>(null);

  const panelOneRef = useRef<HTMLDivElement | null>(null);
  const panelTwoRef = useRef<HTMLDivElement | null>(null);
  const panelThreeRef = useRef<HTMLDivElement | null>(null);
  const panelFourRef = useRef<HTMLDivElement | null>(null);

  const innerOneRef = useRef<HTMLDivElement | null>(null);
  const innerTwoRef = useRef<HTMLDivElement | null>(null);
  const innerThreeRef = useRef<HTMLDivElement | null>(null);
  const innerFourRef = useRef<HTMLDivElement | null>(null);

  const panelOneStopWordRef = useRef<HTMLSpanElement | null>(null);
  const panelTwoStopWordRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const section = sectionRef.current;
    const sticky = stickyRef.current;
    const bg = bgRef.current;
    const textOne = textOneRef.current;
    const textTwo = textTwoRef.current;
    const miniLabel = miniLabelRef.current;

    const panelOne = panelOneRef.current;
    const panelTwo = panelTwoRef.current;
    const panelThree = panelThreeRef.current;
    const panelFour = panelFourRef.current;

    const innerOne = innerOneRef.current;
    const innerTwo = innerTwoRef.current;
    const innerThree = innerThreeRef.current;
    const innerFour = innerFourRef.current;

    const panelOneStopWord = panelOneStopWordRef.current;
    const panelTwoStopWord = panelTwoStopWordRef.current;

    if (
      !section ||
      !sticky ||
      !bg ||
      !textOne ||
      !textTwo ||
      !miniLabel ||
      !panelOne ||
      !panelTwo ||
      !panelThree ||
      !panelFour ||
      !innerOne ||
      !innerTwo ||
      !innerThree ||
      !innerFour ||
      !panelOneStopWord ||
      !panelTwoStopWord
    ) {
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const isMobile = window.matchMedia?.("(max-width: 900px)").matches;

    if (reduceMotion || isMobile) {
      gsap.set(
        [
          textOne,
          textTwo,
          miniLabel,
          panelOne,
          panelTwo,
          panelThree,
          panelFour,
          innerOne,
          innerTwo,
          innerThree,
          innerFour,
        ],
        { clearProps: "all" },
      );

      window.requestAnimationFrame(() => {
        ScrollTrigger.refresh();
      });

      return;
    }

    let refreshFrame = 0;

    const ctx = gsap.context(() => {
      const points = textTwo.querySelectorAll(".neox-gsap-point");
      const panelOneItems = panelOne.querySelectorAll(".neox-stack-clean-card");
      const panelTwoItems = panelTwo.querySelectorAll(
        ".neox-stack-note, .neox-stack-metric",
      );
      const panelThreeItems = panelThree.querySelectorAll(
        ".neox-stack-system-board, .neox-stack-split-item",
      );
      const panelFourItems = panelFour.querySelectorAll(".neox-capability-card");

      const getLocalWordStopPx = (
        sourcePanel: HTMLElement,
        stopWord: HTMLElement,
        fallbackPx: number,
      ) => {
        const sourceRect = sourcePanel.getBoundingClientRect();
        const wordRect = stopWord.getBoundingClientRect();

        if (!sourceRect.height || !wordRect.height) return fallbackPx;

        const opticalGap = 8;
        return wordRect.bottom - sourceRect.top + opticalGap;
      };

      const getPanelRestPercent = (
        targetPanel: HTMLElement,
        stopPx: number,
        fallback: number,
      ) => {
        const targetHeight = targetPanel.offsetHeight;

        if (!targetHeight) return fallback;

        return clamp((stopPx / targetHeight) * 100, 12, 78);
      };

      const panelTwoLocalStopPx = getLocalWordStopPx(
        panelOne,
        panelOneStopWord,
        240,
      );

      const PANEL_TWO_REST_Y = getPanelRestPercent(
        panelTwo,
        panelTwoLocalStopPx,
        33.5,
      );

      const panelTwoRestPx =
        ((panelTwo.offsetHeight || panelOne.offsetHeight || 1) *
          PANEL_TWO_REST_Y) /
        100;

      const panelThreeLocalStopPx = getLocalWordStopPx(
        panelTwo,
        panelTwoStopWord,
        220,
      );

      const PANEL_THREE_REST_Y = getPanelRestPercent(
        panelThree,
        panelTwoRestPx + panelThreeLocalStopPx,
        50.5,
      );

      gsap.set([panelOne, panelTwo, panelThree, panelFour], {
        force3D: true,
        willChange: "transform, opacity",
        transformOrigin: "center top",
      });

      gsap.set(
        [
          bg,
          textOne,
          textTwo,
          miniLabel,
          innerOne,
          innerTwo,
          innerThree,
          innerFour,
          points,
          panelOneItems,
          panelTwoItems,
          panelThreeItems,
          panelFourItems,
        ],
        {
          force3D: true,
          willChange: "transform, opacity",
        },
      );

      gsap.set(bg, { opacity: 1, scale: 1 });
      gsap.set(textOne, { opacity: 1, y: 0 });
      gsap.set(textTwo, { opacity: 0, y: 44 });
      gsap.set(miniLabel, { opacity: 1, y: 0 });
      gsap.set(points, { opacity: 0, y: 18 });

      gsap.set(panelOne, { yPercent: 112, opacity: 1, zIndex: 10 });
      gsap.set(panelTwo, { yPercent: 112, opacity: 1, zIndex: 11 });
      gsap.set(panelThree, { yPercent: 112, opacity: 1, zIndex: 12 });
      gsap.set(panelFour, { yPercent: 108, opacity: 1, zIndex: 20 });

      gsap.set([innerOne, innerTwo, innerFour], {
        autoAlpha: 0,
        y: 18,
      });

      gsap.set(innerThree, {
        autoAlpha: 0,
        y: 0,
      });

      gsap.set([panelOneItems, panelTwoItems, panelFourItems], {
        autoAlpha: 0,
        y: 20,
      });

      gsap.set(panelThreeItems, {
        autoAlpha: 0,
        y: 0,
      });

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top top+=1",
          end: () => `+=${Math.max(window.innerHeight * 5.65, 4550)}`,
          scrub: true,
          pin: sticky,
          pinSpacing: true,
          anticipatePin: 0,
          invalidateOnRefresh: true,
          refreshPriority: 1,
          fastScrollEnd: false,
          preventOverlaps: false,
        },
      });

      tl
        .to(bg, { scale: 0.985, opacity: 0.98, duration: 0.34 }, 0)
        .to(textOne, { opacity: 0, y: -44, duration: 0.46 }, 0.28)
        .to(miniLabel, { opacity: 0, y: 16, duration: 0.28 }, 0.32)
        .to(textTwo, { opacity: 1, y: 0, duration: 0.48 }, 0.82)
        .to(points, { opacity: 1, y: 0, stagger: 0.055, duration: 0.32 }, 1.05)

        .to(panelOne, { yPercent: 0, duration: 1.18 }, 1.72)
        .to(innerOne, { autoAlpha: 1, y: 0, duration: 0.24 }, 2.36)
        .to(
          panelOneItems,
          { autoAlpha: 1, y: 0, stagger: 0.045, duration: 0.28 },
          2.52,
        )

        .to(panelTwo, { yPercent: PANEL_TWO_REST_Y, duration: 1.22 }, 3.12)
        .to(innerTwo, { autoAlpha: 1, y: 0, duration: 0.24 }, 3.82)
        .to(
          panelTwoItems,
          { autoAlpha: 1, y: 0, stagger: 0.045, duration: 0.28 },
          3.98,
        )

        .to(panelThree, { yPercent: PANEL_THREE_REST_Y, duration: 1.18 }, 4.68)
        .to(innerThree, { autoAlpha: 1, duration: 0.22 }, 5.34)
        .to(
          panelThreeItems,
          { autoAlpha: 1, stagger: 0.04, duration: 0.24 },
          5.5,
        )

        .to(panelFour, { yPercent: 0, duration: 1.34 }, 6.28)
        .to(innerFour, { autoAlpha: 1, y: 0, duration: 0.28 }, 7.02)
        .to(
          panelFourItems,
          { autoAlpha: 1, y: 0, stagger: 0.04, duration: 0.28 },
          7.22,
        );
    }, section);

    refreshFrame = window.requestAnimationFrame(() => {
      ScrollTrigger.refresh();
    });

    return () => {
      window.cancelAnimationFrame(refreshFrame);
      ctx.revert();
    };
  }, []);

  return (
    <section ref={sectionRef} className="neox-interactive-system-section">
      <div ref={stickyRef} className="neox-interactive-sticky">
        <div ref={bgRef} className="neox-interactive-bg" aria-hidden="true" />

        <div className="neox-interactive-stage">
          <div className="neox-interactive-inner">
            <div ref={textOneRef} className="neox-gsap-text neox-gsap-text-one">
              <p className="neox-gsap-kicker">Görünən tərəf</p>

              <h2 className="neox-gsap-title">
                Görünən tərəf <span>gözəl</span> olmalıdır.
              </h2>

              <p className="neox-gsap-lead">
                Müştərinin ilk gördüyü hissə sadə, təmiz və inandırıcı olmalıdır.
                Sayt, vizual dil və təqdimat biznesin dəyərini ilk saniyədə
                göstərir.
              </p>
            </div>

            <div ref={textTwoRef} className="neox-gsap-text neox-gsap-text-two">
              <p className="neox-gsap-kicker">İşləyən tərəf</p>

              <h2 className="neox-gsap-title">
                İşləyən tərəf isə <span>ağıllı</span> olmalıdır.
              </h2>

              <p className="neox-gsap-lead">
                Gözəl görünüş tək başına kifayət deyil. Mesaj, zəng, forma,
                cavab və daxili proseslər bir axında işləməlidir.
              </p>

              <div className="neox-gsap-points">
                <div className="neox-gsap-point">
                  <span>01</span>
                  <strong>Cavab</strong>
                  <p>Müştəri sualı düzgün istiqamətə düşür.</p>
                </div>

                <div className="neox-gsap-point">
                  <span>02</span>
                  <strong>Axın</strong>
                  <p>Mesajlar, formalar və zənglər dağınıq qalmır.</p>
                </div>

                <div className="neox-gsap-point">
                  <span>03</span>
                  <strong>Nəzarət</strong>
                  <p>Komanda prosesi bir yerdən görə bilir.</p>
                </div>
              </div>
            </div>

            <div ref={miniLabelRef} className="neox-gsap-mini-label">
              Scroll ilə davam et
            </div>

            <div
              ref={panelOneRef}
              className="neox-stack-panel neox-stack-panel--one"
            >
              <div ref={innerOneRef} className="neox-stack-panel-inner">
                <div className="neox-stack-panel-head">
                  <p className="neox-extra-kicker">Vahid sistem</p>

                  <h2 className="neox-stack-title">
                    Müştəri gəlir, sistem{" "}
                    <span
                      ref={panelOneStopWordRef}
                      className="neox-layer-measure-word"
                    >
                      qarşılayır
                    </span>
                    , <span>proses davam edir.</span>
                  </h2>

                  <p className="neox-stack-lead">
                    Müştəri ilə ilk təmasdan cavaba, yönləndirməyə və daxili
                    prosesə qədər hər şey bir-birinə bağlı işləyir.
                  </p>
                </div>

                <div className="neox-stack-grid neox-stack-grid--three">
                  <article className="neox-stack-clean-card">
                    <span className="neox-stack-card-label">01 / Giriş</span>
                    <h3>İlk təəssürat peşəkar olur.</h3>
                    <p>
                      Müştəri biznesinizi gördüyü anda nə etdiyinizi və niyə
                      dəyərli olduğunuzu anlayır.
                    </p>
                  </article>

                  <article className="neox-stack-clean-card">
                    <span className="neox-stack-card-label">02 / Axın</span>
                    <h3>Müraciətlər vahid sistemə düşür.</h3>
                    <p>
                      Forma, mesaj, zəng və digər müraciətlər dağınıq qalmır,
                      düzgün axına yönlənir.
                    </p>
                  </article>

                  <article className="neox-stack-clean-card">
                    <span className="neox-stack-card-label">03 / Cavab</span>
                    <h3>Sistem cavabı və prosesi davam etdirir.</h3>
                    <p>
                      AI və komanda birlikdə işləyir, biznes cavabsız və nizamsız
                      görünmür.
                    </p>
                  </article>
                </div>
              </div>
            </div>

            <div
              ref={panelTwoRef}
              className="neox-stack-panel neox-stack-panel--two"
            >
              <div ref={innerTwoRef} className="neox-stack-panel-inner">
                <div className="neox-stack-panel-head">
                  <p className="neox-extra-kicker">Əməliyyat axını</p>

                  <h2 className="neox-stack-title">
                    Müraciətlər <span>vahid axına</span>{" "}
                    <span
                      ref={panelTwoStopWordRef}
                      className="neox-layer-measure-word"
                    >
                      düşür
                    </span>{" "}
                    və idarə olunur.
                  </h2>

                  <p className="neox-stack-lead">
                    Sayt, mesajlaşma, zəng və daxili proseslər eyni biznes xəttinə
                    bağlanır.
                  </p>
                </div>

                <div className="neox-stack-grid neox-stack-grid--metrics">
                  <div className="neox-stack-note">
                    <strong>
                      Sayt, mesajlaşma və daxili proseslər eyni biznes xəttinə
                      bağlanır.
                    </strong>
                  </div>

                  <div className="neox-stack-metric">
                    <strong>24/7</strong>
                    <span>Müştəri müraciəti cavabsız qalmır.</span>
                  </div>

                  <div className="neox-stack-metric">
                    <strong>1 axın</strong>
                    <span>Sayt, zəng və mesajlar vahid məntiqə düşür.</span>
                  </div>

                  <div className="neox-stack-metric">
                    <strong>Nəzarət</strong>
                    <span>Komanda prosesin harada olduğunu aydın görür.</span>
                  </div>
                </div>
              </div>
            </div>

            <div
              ref={panelThreeRef}
              className="neox-stack-panel neox-stack-panel--three"
            >
              <div ref={innerThreeRef} className="neox-stack-panel-inner">
                <div className="neox-stack-grid neox-stack-grid--two">
                  <div className="neox-stack-system-board">
                    <div className="neox-stack-system-board-row">
                      <div className="neox-stack-system-board-badge">01</div>
                      <div>
                        <h4>Müştəri üçün aydın təcrübə</h4>
                        <p>Sayt və cavab xətti daha aydın görünür.</p>
                      </div>
                    </div>

                    <div className="neox-stack-system-board-row">
                      <div className="neox-stack-system-board-badge">02</div>
                      <div>
                        <h4>Komanda üçün rahat idarəetmə</h4>
                        <p>Müraciətlər bir axında idarə olunur.</p>
                      </div>
                    </div>

                    <div className="neox-stack-system-board-row">
                      <div className="neox-stack-system-board-badge">03</div>
                      <div>
                        <h4>Biznes üçün daha güclü axın</h4>
                        <p>Görünüş və işləyən sistem birlikdə nəticə verir.</p>
                      </div>
                    </div>
                  </div>

                  <div className="neox-stack-split-text">
                    <p className="neox-extra-kicker">Komanda + sistem</p>

                    <h2 className="neox-stack-title">
                      Komanda və sistem <span>eyni xəttdə işləyir.</span>
                    </h2>

                    <p className="neox-stack-lead">
                      Görünüş, cavab və nəzarət eyni sistemdə toplanır.
                    </p>

                    <div className="neox-stack-split-list">
                      <div className="neox-stack-split-item">
                        <div className="neox-stack-split-item-badge">01</div>
                        <div>
                          <h4>Görünüş</h4>
                          <p>İlk təəssürat güclənir.</p>
                        </div>
                      </div>

                      <div className="neox-stack-split-item">
                        <div className="neox-stack-split-item-badge">02</div>
                        <div>
                          <h4>Cavab</h4>
                          <p>Suallar cavabsız qalmır.</p>
                        </div>
                      </div>

                      <div className="neox-stack-split-item">
                        <div className="neox-stack-split-item-badge">03</div>
                        <div>
                          <h4>Proses</h4>
                          <p>Komanda prosesi rahat izləyir.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              ref={panelFourRef}
              className="neox-stack-panel neox-stack-panel--four"
            >
              <div ref={innerFourRef} className="neox-stack-panel-inner">
                <div className="neox-capability-inner">
                  <div className="neox-capability-head">
                    <p className="neox-extra-kicker">Nəyi birlikdə düşünürük</p>

                    <h2 className="neox-extra-title">
                      Ayrı işlər yox,{" "}
                      <span>bir-birini tamamlayan</span> hissələr.
                    </h2>

                    <p className="neox-extra-lead">
                      Biznesin rəqəmsal tərəfi tək bir səhifədən ibarət deyil.
                      Müştəri sizi görür, sual verir, qərar verir və proses davam
                      edir.
                    </p>
                  </div>

                  <div className="neox-capability-grid">
                    <article className="neox-capability-card">
                      <span className="neox-capability-number">01</span>
                      <h3>Sayt və təqdimat</h3>
                      <p>
                        Biznesin nə etdiyini qısa, təmiz və inandırıcı formada
                        göstəririk.
                      </p>
                    </article>

                    <article className="neox-capability-card">
                      <span className="neox-capability-number">02</span>
                      <h3>Məzmun və vizual dil</h3>
                      <p>
                        Brendin danışıq tərzi, görünüşü və kontent xətti vahid
                        qalır.
                      </p>
                    </article>

                    <article className="neox-capability-card">
                      <span className="neox-capability-number">03</span>
                      <h3>Cavab sistemləri</h3>
                      <p>
                        Çatbot, səsli assistant və mesaj axınları müştərini düzgün
                        qarşılayır.
                      </p>
                    </article>

                    <article className="neox-capability-card">
                      <span className="neox-capability-number">04</span>
                      <h3>Avtomatlaşdırma</h3>
                      <p>
                        Təkrar proseslər azalır, komanda daha vacib işlərə
                        fokuslanır.
                      </p>
                    </article>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BuildTogetherSection() {
  const lang = useSafeLang();

  return (
    <section className="neox-extra-section-three">
      <div className="nx-container">
        <div className="neox-build-band">
          <div className="neox-build-content">
            <p className="neox-extra-kicker">Başlayaq</p>

            <h2 className="neox-build-title">
              Biznesiniz üçün <span>nədən başlamağın</span> daha doğru olduğunu
              birlikdə seçək.
            </h2>

            <p className="neox-build-text">
              İlk danışıqda biznesinizi, müştəri axınınızı və hazırkı problemləri
              anlayırıq. Sonra sizə uyğun sayt, AI, kontent və avtomatlaşdırma
              xəritəsini qururuq.
            </p>

            <div className="neox-build-tags" aria-hidden="true">
              <span>Veb sayt</span>
              <span>Brend görünüşü</span>
              <span>AI sistemləri</span>
              <span>Workflow</span>
            </div>
          </div>

          <div className="neox-build-actions">
            <Link
              to={withLang(lang, "/contact")}
              className="nx-button nx-button--primary nx-button--lg"
            >
              Əlaqə saxla
            </Link>

            <Link
              to={withLang(lang, "/services")}
              className="nx-button nx-button--secondary nx-button--lg"
            >
              Xidmətlərə bax
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    gsap.registerPlugin(ScrollTrigger);

    const refresh = () => {
      ScrollTrigger.refresh();
    };

    const frame = window.requestAnimationFrame(refresh);

    const handleLoad = () => {
      window.requestAnimationFrame(refresh);
    };

    window.addEventListener("load", handleLoad, { once: true });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("load", handleLoad);
    };
  }, []);

  return (
    <main className="nx-page neox-home-page neox-home-extra">
      <style>{HOME_INLINE_CSS}</style>

      <HomeHero />
      <ServiceCardsSection />
      <HowItWorksSection />
      <InteractiveSystemSection />
      <BuildTogetherSection />
    </main>
  );
}