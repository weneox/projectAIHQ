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

const WEBSITE_SHOWCASE_ONE =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1777264211/ChatGPT_Image_Apr_27_2026_08_25_30_AM_dq9sfl.webp";

const WEBSITE_SHOWCASE_TWO =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1777264112/ChatGPT_Image_Apr_27_2026_08_25_13_AM_mnfm7d.webp";

/**
 * 3-cü atdığın link Cloudinary console linkidir, img src kimi işləmir.
 * 3-cü public direct Cloudinary image URL olanda bunu dəyiş.
 */
const WEBSITE_SHOWCASE_THREE =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1777264211/ChatGPT_Image_Apr_27_2026_08_25_30_AM_dq9sfl.webp";

const WEBSITE_ICON = "/image/vebsayticon.webp";
const BRAND_ICON = "/image/brendicon.webp";
const RESPONSE_ICON = "/image/cavab-sistemleri-icon.webp";
const WORKFLOW_ICON = "/image/workflowicon.webp";

const HOME_INLINE_STYLES = `
  .neox-home-page .neox-capability-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border: 1px solid rgba(15, 23, 42, 0.075);
    border-radius: 0;
    overflow: hidden;
    background: #fff;
    box-shadow: none !important;
  }

  .neox-home-page .neox-capability-card {
    position: relative;
    min-height: 292px;
    padding: 30px 30px 28px;
    overflow: hidden;
    isolation: isolate;
    border: 0;
    border-right: 1px solid rgba(15, 23, 42, 0.075);
    background:
      linear-gradient(180deg, rgba(255,255,255,0.99), rgba(248,250,252,0.68));
    box-shadow: none !important;
    transition:
      background 260ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .neox-home-page .neox-capability-card:last-child {
    border-right: 0;
  }

  .neox-home-page .neox-capability-card::before {
    content: "";
    position: absolute;
    left: 30px;
    top: 30px;
    width: 26px;
    height: 2px;
    border-radius: 999px;
    background: linear-gradient(90deg, #2455e6, rgba(36, 85, 230, 0));
    opacity: 0.42;
    pointer-events: none;
  }

  .neox-home-page .neox-capability-card::after {
    display: none !important;
    content: none !important;
  }

  .neox-home-page .neox-capability-card:hover {
    background:
      linear-gradient(180deg, rgba(255,255,255,1), rgba(247,249,252,0.84));
  }

  .neox-home-page .neox-capability-icon-wrap {
    position: absolute;
    right: 30px;
    top: 30px;
    z-index: 2;
    width: 78px;
    height: 78px;
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    margin: 0;
    pointer-events: none;
    user-select: none;
    background: transparent !important;
    box-shadow: none !important;
    filter: none !important;
  }

  .neox-home-page .neox-capability-icon-wrap::before,
  .neox-home-page .neox-capability-icon-wrap::after {
    display: none !important;
    content: none !important;
  }

  .neox-home-page .neox-capability-icon {
    width: 72px !important;
    height: 72px !important;
    max-width: 72px !important;
    max-height: 72px !important;
    object-fit: contain;
    display: block;
    flex: 0 0 auto;
    transform: translateZ(0);
    filter: none !important;
    box-shadow: none !important;
    background: transparent !important;
    transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .neox-home-page .neox-capability-card:hover .neox-capability-icon {
    transform: translateY(-2px);
    filter: none !important;
    box-shadow: none !important;
  }

  .neox-home-page .neox-capability-fallback {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(37,99,235,0.14);
    background: transparent;
    box-shadow: none !important;
    color: #2455e6;
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.04em;
  }

  .neox-home-page .neox-capability-number {
    position: relative;
    z-index: 2;
    display: block;
    margin: 98px 0 22px;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 42px;
    line-height: 0.9;
    letter-spacing: -0.07em;
    color: rgba(15, 23, 42, 0.18);
  }

  .neox-home-page .neox-capability-card h3 {
    position: relative;
    z-index: 2;
    margin: 0 0 13px;
    max-width: 230px;
    font-size: 21px;
    line-height: 1.08;
    letter-spacing: -0.045em;
    color: #070a18;
  }

  .neox-home-page .neox-capability-card p {
    position: relative;
    z-index: 2;
    margin: 0;
    max-width: 238px;
    font-size: 15px;
    line-height: 1.62;
    color: #66728a;
  }

  .neox-home-page .neox-gsap-text-one {
    max-width: 470px;
  }

  .neox-home-page .neox-gsap-title {
    margin-bottom: 0;
  }

  .neox-home-page .neox-visual-showcase {
    position: absolute;
    right: clamp(22px, 4.7vw, 82px);
    top: 50%;
    z-index: 7;
    width: min(57vw, 900px);
    height: min(62vh, 630px);
    transform: translateY(-50%);
    pointer-events: none;
    user-select: none;
  }

  .neox-home-page .neox-visual-showcase-shadow {
    position: absolute;
    left: 5%;
    right: 5%;
    bottom: -36px;
    z-index: 1;
    height: 76px;
    background: radial-gradient(ellipse at center, rgba(15,23,42,0.18), rgba(15,23,42,0));
    filter: blur(18px);
    opacity: 0.58;
    pointer-events: none;
  }

  .neox-home-page .neox-visual-showcase-frame {
    position: absolute;
    inset: 0;
    z-index: 2;
    overflow: hidden;
    border-radius: 0;
    background: #f8fafc;
    box-shadow:
      0 34px 90px rgba(15, 23, 42, 0.14),
      0 10px 28px rgba(15, 23, 42, 0.08);
    transform: translateZ(0);
    will-change: transform, opacity;
  }

  .neox-home-page .neox-visual-showcase-frame::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 3;
    background:
      linear-gradient(90deg, rgba(255,255,255,0.08), rgba(255,255,255,0)),
      linear-gradient(180deg, rgba(255,255,255,0.02), rgba(15,23,42,0.08));
    pointer-events: none;
  }

  .neox-home-page .neox-visual-showcase-frame img {
    position: relative;
    z-index: 2;
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    transform: translateZ(0);
  }

  .neox-home-page .neox-visual-showcase-frame--one {
    z-index: 3;
  }

  .neox-home-page .neox-visual-showcase-frame--two {
    z-index: 4;
  }

  .neox-home-page .neox-visual-showcase-frame--three {
    z-index: 5;
  }

  .neox-home-page .neox-visual-showcase-progress {
    position: absolute;
    left: -34px;
    top: 50%;
    z-index: 9;
    display: grid;
    gap: 10px;
    transform: translateY(-50%);
  }

  .neox-home-page .neox-visual-showcase-dot {
    width: 5px;
    height: 32px;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.14);
    overflow: hidden;
  }

  .neox-home-page .neox-visual-showcase-dot span {
    display: block;
    width: 100%;
    height: 100%;
    background: #0f172a;
    transform: scaleY(0);
    transform-origin: bottom center;
  }

  .neox-home-page .neox-visual-label-stack {
    position: absolute;
    right: 0;
    bottom: -50px;
    z-index: 10;
    width: min(420px, 82%);
    height: 28px;
    pointer-events: none;
  }

  .neox-home-page .neox-visual-label {
    position: absolute;
    right: 0;
    top: 0;
    display: inline-flex;
    align-items: center;
    gap: 12px;
    white-space: nowrap;
    transform: translateZ(0);
    will-change: transform, opacity;
  }

  .neox-home-page .neox-visual-label::before {
    content: "";
    width: 32px;
    height: 1px;
    flex: 0 0 auto;
    background: linear-gradient(90deg, rgba(36, 85, 230, 0), rgba(36, 85, 230, 0.72));
  }

  .neox-home-page .neox-visual-label span {
    font-size: 12px;
    line-height: 1;
    font-weight: 850;
    letter-spacing: 0.12em;
    color: rgba(36, 85, 230, 0.72);
  }

  .neox-home-page .neox-visual-label strong {
    font-size: 12px;
    line-height: 1;
    font-weight: 850;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(15, 23, 42, 0.62);
  }

  @media (max-width: 1100px) {
    .neox-home-page .neox-capability-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .neox-home-page .neox-capability-card:nth-child(2) {
      border-right: 0;
    }

    .neox-home-page .neox-capability-card:nth-child(1),
    .neox-home-page .neox-capability-card:nth-child(2) {
      border-bottom: 1px solid rgba(15, 23, 42, 0.075);
    }

    .neox-home-page .neox-visual-showcase {
      right: 26px;
      width: 55vw;
      height: min(56vh, 520px);
    }
  }

  @media (max-width: 900px) {
    .neox-home-page .neox-capability-icon-wrap {
      right: 24px;
      top: 28px;
      width: 70px;
      height: 70px;
    }

    .neox-home-page .neox-capability-icon {
      width: 64px !important;
      height: 64px !important;
      max-width: 64px !important;
      max-height: 64px !important;
    }

    .neox-home-page .neox-capability-number {
      margin-top: 90px;
    }

    .neox-home-page .neox-gsap-text-one {
      max-width: 100%;
    }

    .neox-home-page .neox-visual-showcase {
      position: relative;
      inset: auto;
      width: 100%;
      height: 420px;
      margin-top: 34px;
      transform: none;
      pointer-events: auto;
    }

    .neox-home-page .neox-visual-showcase-progress {
      left: 18px;
    }

    .neox-home-page .neox-visual-label-stack {
      bottom: -46px;
      width: 92%;
    }

    .neox-home-page .neox-visual-label strong,
    .neox-home-page .neox-visual-label span {
      font-size: 11px;
    }
  }

  @media (max-width: 640px) {
    .neox-home-page .neox-capability-grid {
      grid-template-columns: 1fr;
    }

    .neox-home-page .neox-capability-card,
    .neox-home-page .neox-capability-card:nth-child(2) {
      min-height: 246px;
      border-right: 0;
      border-bottom: 1px solid rgba(15, 23, 42, 0.075);
      padding: 28px 24px 26px;
    }

    .neox-home-page .neox-capability-card:last-child {
      border-bottom: 0;
    }

    .neox-home-page .neox-capability-card::before {
      left: 24px;
      top: 28px;
    }

    .neox-home-page .neox-capability-icon-wrap {
      right: 24px;
      top: 26px;
      width: 64px;
      height: 64px;
    }

    .neox-home-page .neox-capability-icon {
      width: 58px !important;
      height: 58px !important;
      max-width: 58px !important;
      max-height: 58px !important;
    }

    .neox-home-page .neox-capability-number {
      margin-top: 82px;
    }

    .neox-home-page .neox-capability-card h3 {
      font-size: 20px;
    }

    .neox-home-page .neox-visual-showcase {
      height: 330px;
    }

    .neox-home-page .neox-visual-showcase-progress {
      display: none;
    }

    .neox-home-page .neox-visual-label-stack {
      left: 0;
      right: auto;
      bottom: -42px;
      width: 100%;
    }

    .neox-home-page .neox-visual-label {
      left: 0;
      right: auto;
      gap: 9px;
    }

    .neox-home-page .neox-visual-label::before {
      width: 22px;
    }

    .neox-home-page .neox-visual-label strong,
    .neox-home-page .neox-visual-label span {
      font-size: 10px;
      letter-spacing: 0.09em;
    }
  }
`;

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
  "səsli assistentlər",
  "biznes iş axınları",
  "24/7 çatbotlar",
  "süni intellekt sistemləri",
  "satış axınları",
];

const stripItems = [
  "VEB SAYTLAR",
  "BREND GÖRÜNÜŞÜ",
  "KONTENT AXINI",
  "SƏSLİ ASSİSTENT",
  "BİZNES İŞ AXINI",
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
    title: "Səsli assistentlər qururuq",
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
    text: "Sosial media və veb saytlarda müştəriyə gecə-gündüz cavab verən ağıllı çatbotlar qururuq.",
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
    title: "Tanışlıq və analiz",
    text: "Biznesinizi, hədəflərinizi və mövcud prosesləri anlayırıq.",
  },
  {
    number: "02",
    title: "Strategiya və plan",
    text: "Uyğun yanaşmanı, sistem xəritəsini və icra planını hazırlayırıq.",
  },
  {
    number: "03",
    title: "İcra və qurulum",
    text: "Veb, kontent, satış və avtomatlaşdırma hissələrini vahid sistem kimi qururuq.",
  },
  {
    number: "04",
    title: "Yoxlama və təqdimat",
    text: "Nəticəni birlikdə yoxlayır, təkmilləşdirir və təqdim edirik.",
  },
  {
    number: "05",
    title: "Dəstək və optimallaşdırma",
    text: "Layihədən sonra sistemi izləyir, dəstəkləyir və inkişaf etdiririk.",
  },
] as const;

const showcaseLabels = [
  {
    number: "01",
    label: "Website design system",
  },
  {
    number: "02",
    label: "Brand experience",
  },
  {
    number: "03",
    label: "Digital presentation",
  },
] as const;

function HeroLoopText() {
  return (
    <span className="neox-hero-loop" aria-live="polite">
      <span className="neox-hero-loop-sizer" aria-hidden="true">
        süni intellekt sistemləri
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

function CapabilityIcon({
  src,
  label,
  fallback,
}: {
  src: string;
  label: string;
  fallback: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="neox-capability-icon-wrap" aria-hidden="true">
      {!failed ? (
        <img
          src={src}
          alt=""
          className="neox-capability-icon"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="neox-capability-fallback" title={label}>
          {fallback}
        </div>
      )}
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
              avtomatlaşdırma və süni intellekt sistemlərini biznesiniz üçün
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
  const miniLabelRef = useRef<HTMLDivElement | null>(null);
  const showcaseRef = useRef<HTMLDivElement | null>(null);

  const showcaseFrameOneRef = useRef<HTMLDivElement | null>(null);
  const showcaseFrameTwoRef = useRef<HTMLDivElement | null>(null);
  const showcaseFrameThreeRef = useRef<HTMLDivElement | null>(null);

  const showcaseLabelOneRef = useRef<HTMLDivElement | null>(null);
  const showcaseLabelTwoRef = useRef<HTMLDivElement | null>(null);
  const showcaseLabelThreeRef = useRef<HTMLDivElement | null>(null);

  const showcaseDotOneRef = useRef<HTMLSpanElement | null>(null);
  const showcaseDotTwoRef = useRef<HTMLSpanElement | null>(null);
  const showcaseDotThreeRef = useRef<HTMLSpanElement | null>(null);

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
    const miniLabel = miniLabelRef.current;
    const showcase = showcaseRef.current;

    const showcaseFrameOne = showcaseFrameOneRef.current;
    const showcaseFrameTwo = showcaseFrameTwoRef.current;
    const showcaseFrameThree = showcaseFrameThreeRef.current;

    const showcaseLabelOne = showcaseLabelOneRef.current;
    const showcaseLabelTwo = showcaseLabelTwoRef.current;
    const showcaseLabelThree = showcaseLabelThreeRef.current;

    const showcaseDotOne = showcaseDotOneRef.current;
    const showcaseDotTwo = showcaseDotTwoRef.current;
    const showcaseDotThree = showcaseDotThreeRef.current;

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
      !miniLabel ||
      !showcase ||
      !showcaseFrameOne ||
      !showcaseFrameTwo ||
      !showcaseFrameThree ||
      !showcaseLabelOne ||
      !showcaseLabelTwo ||
      !showcaseLabelThree ||
      !showcaseDotOne ||
      !showcaseDotTwo ||
      !showcaseDotThree ||
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
          miniLabel,
          showcase,
          showcaseFrameOne,
          showcaseFrameTwo,
          showcaseFrameThree,
          showcaseLabelOne,
          showcaseLabelTwo,
          showcaseLabelThree,
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

      gsap.set([showcaseDotOne, showcaseDotTwo, showcaseDotThree], {
        clearProps: "all",
      });

      window.requestAnimationFrame(() => {
        ScrollTrigger.refresh();
      });

      return;
    }

    let refreshFrame = 0;

    const ctx = gsap.context(() => {
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
          miniLabel,
          showcase,
          showcaseFrameOne,
          showcaseFrameTwo,
          showcaseFrameThree,
          showcaseLabelOne,
          showcaseLabelTwo,
          showcaseLabelThree,
          innerOne,
          innerTwo,
          innerThree,
          innerFour,
        ],
        {
          force3D: true,
          willChange: "transform, opacity",
        },
      );

      gsap.set(bg, { opacity: 1, scale: 1 });
      gsap.set(textOne, { opacity: 1, y: 0 });
      gsap.set(miniLabel, { opacity: 1, y: 0 });
      gsap.set(showcase, { opacity: 1, y: 0, scale: 1 });

      gsap.set(showcaseFrameOne, {
        autoAlpha: 1,
        xPercent: 0,
        yPercent: 0,
        scale: 1,
        rotate: 0,
      });

      gsap.set(showcaseFrameTwo, {
        autoAlpha: 0,
        xPercent: 5,
        yPercent: 7,
        scale: 0.965,
        rotate: -0.35,
      });

      gsap.set(showcaseFrameThree, {
        autoAlpha: 0,
        xPercent: 7,
        yPercent: 10,
        scale: 0.94,
        rotate: 0.35,
      });

      gsap.set(showcaseLabelOne, {
        autoAlpha: 1,
        y: 0,
      });

      gsap.set([showcaseLabelTwo, showcaseLabelThree], {
        autoAlpha: 0,
        y: 8,
      });

      gsap.set(showcaseDotOne, { scaleY: 1 });
      gsap.set([showcaseDotTwo, showcaseDotThree], { scaleY: 0 });

      gsap.set(panelOne, { yPercent: 112, opacity: 1, zIndex: 10 });
      gsap.set(panelTwo, { yPercent: 112, opacity: 1, zIndex: 11 });
      gsap.set(panelThree, { yPercent: 112, opacity: 1, zIndex: 12 });
      gsap.set(panelFour, { yPercent: 108, opacity: 1, zIndex: 20 });

      gsap.set([innerOne, innerTwo, innerThree, innerFour], {
        autoAlpha: 0,
        y: 18,
      });

      gsap.set(panelFourItems, {
        autoAlpha: 0,
        y: 20,
      });

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: section,
          start: "top top+=1",
          end: () => `+=${Math.max(window.innerHeight * 5.85, 4850)}`,
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

        .to(showcaseFrameOne, { scale: 0.985, xPercent: -2, duration: 0.7 }, 0.24)
        .to(
          showcaseFrameTwo,
          {
            autoAlpha: 1,
            xPercent: 0,
            yPercent: 0,
            scale: 1,
            rotate: 0,
            duration: 0.7,
          },
          0.82,
        )
        .to(
          showcaseFrameOne,
          {
            autoAlpha: 0,
            xPercent: -5,
            yPercent: -4,
            scale: 1.025,
            duration: 0.58,
          },
          0.96,
        )
        .to(showcaseLabelOne, { autoAlpha: 0, y: -8, duration: 0.28 }, 0.78)
        .to(showcaseLabelTwo, { autoAlpha: 1, y: 0, duration: 0.34 }, 0.92)
        .to(showcaseDotOne, { scaleY: 0, duration: 0.34 }, 0.82)
        .to(showcaseDotTwo, { scaleY: 1, duration: 0.42 }, 0.88)

        .to(showcaseFrameTwo, { scale: 0.985, xPercent: -2, duration: 0.7 }, 1.8)
        .to(
          showcaseFrameThree,
          {
            autoAlpha: 1,
            xPercent: 0,
            yPercent: 0,
            scale: 1,
            rotate: 0,
            duration: 0.7,
          },
          2.28,
        )
        .to(
          showcaseFrameTwo,
          {
            autoAlpha: 0,
            xPercent: -5,
            yPercent: -4,
            scale: 1.025,
            duration: 0.58,
          },
          2.42,
        )
        .to(showcaseLabelTwo, { autoAlpha: 0, y: -8, duration: 0.28 }, 2.22)
        .to(showcaseLabelThree, { autoAlpha: 1, y: 0, duration: 0.34 }, 2.36)
        .to(showcaseDotTwo, { scaleY: 0, duration: 0.34 }, 2.28)
        .to(showcaseDotThree, { scaleY: 1, duration: 0.42 }, 2.34)

        .to(showcaseFrameThree, { scale: 1.012, duration: 0.5 }, 3.08)
        .to(miniLabel, { opacity: 0, y: 18, duration: 0.34 }, 3.14)

        .to(panelOne, { yPercent: 0, duration: 1.08 }, 3.18)
        .to(innerOne, { autoAlpha: 1, y: 0, duration: 0.26 }, 3.62)

        .to(textOne, { opacity: 0, y: -42, duration: 0.34 }, 3.94)
        .to(showcase, { opacity: 0, y: -34, scale: 0.975, duration: 0.34 }, 3.94)

        .to(panelTwo, { yPercent: PANEL_TWO_REST_Y, duration: 1.18 }, 4.78)
        .to(innerTwo, { autoAlpha: 1, y: 0, duration: 0.26 }, 5.34)

        .to(panelThree, { yPercent: PANEL_THREE_REST_Y, duration: 1.14 }, 6.16)
        .to(innerThree, { autoAlpha: 1, y: 0, duration: 0.26 }, 6.72)

        .to(panelFour, { yPercent: 0, duration: 1.28 }, 7.48)
        .to(innerFour, { autoAlpha: 1, y: 0, duration: 0.26 }, 8.12)
        .to(
          panelFourItems,
          { autoAlpha: 1, y: 0, stagger: 0.04, duration: 0.26 },
          8.34,
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
              <h2 className="neox-gsap-title">
                Görünən tərəf <span>gözəl</span> olmalıdır.
              </h2>
            </div>

            <div ref={miniLabelRef} className="neox-gsap-mini-label">
              Aşağı sürüşdür
            </div>

            <div ref={showcaseRef} className="neox-visual-showcase" aria-hidden="true">
              <div className="neox-visual-showcase-shadow" />

              <div className="neox-visual-showcase-progress">
                <div className="neox-visual-showcase-dot">
                  <span ref={showcaseDotOneRef} />
                </div>

                <div className="neox-visual-showcase-dot">
                  <span ref={showcaseDotTwoRef} />
                </div>

                <div className="neox-visual-showcase-dot">
                  <span ref={showcaseDotThreeRef} />
                </div>
              </div>

              <div
                ref={showcaseFrameOneRef}
                className="neox-visual-showcase-frame neox-visual-showcase-frame--one"
              >
                <img
                  src={WEBSITE_SHOWCASE_ONE}
                  alt=""
                  loading="eager"
                  decoding="async"
                  draggable={false}
                />
              </div>

              <div
                ref={showcaseFrameTwoRef}
                className="neox-visual-showcase-frame neox-visual-showcase-frame--two"
              >
                <img
                  src={WEBSITE_SHOWCASE_TWO}
                  alt=""
                  loading="eager"
                  decoding="async"
                  draggable={false}
                />
              </div>

              <div
                ref={showcaseFrameThreeRef}
                className="neox-visual-showcase-frame neox-visual-showcase-frame--three"
              >
                <img
                  src={WEBSITE_SHOWCASE_THREE}
                  alt=""
                  loading="eager"
                  decoding="async"
                  draggable={false}
                />
              </div>

              <div className="neox-visual-label-stack">
                <div ref={showcaseLabelOneRef} className="neox-visual-label">
                  <span>{showcaseLabels[0].number}</span>
                  <strong>{showcaseLabels[0].label}</strong>
                </div>

                <div ref={showcaseLabelTwoRef} className="neox-visual-label">
                  <span>{showcaseLabels[1].number}</span>
                  <strong>{showcaseLabels[1].label}</strong>
                </div>

                <div ref={showcaseLabelThreeRef} className="neox-visual-label">
                  <span>{showcaseLabels[2].number}</span>
                  <strong>{showcaseLabels[2].label}</strong>
                </div>
              </div>
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
                </div>
              </div>
            </div>

            <div
              ref={panelThreeRef}
              className="neox-stack-panel neox-stack-panel--three"
            >
              <div ref={innerThreeRef} className="neox-stack-panel-inner">
                <div className="neox-stack-panel-head">
                  <p className="neox-extra-kicker">Komanda + sistem</p>

                  <h2 className="neox-stack-title">
                    Komanda və sistem <span>eyni xəttdə işləyir.</span>
                  </h2>
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
                      <CapabilityIcon
                        src={WEBSITE_ICON}
                        label="Sayt və təqdimat"
                        fallback="01"
                      />

                      <span className="neox-capability-number">01</span>

                      <h3>Sayt və təqdimat</h3>

                      <p>
                        Biznesin nə etdiyini qısa, təmiz və inandırıcı formada
                        göstəririk.
                      </p>
                    </article>

                    <article className="neox-capability-card">
                      <CapabilityIcon
                        src={BRAND_ICON}
                        label="Məzmun və vizual dil"
                        fallback="02"
                      />

                      <span className="neox-capability-number">02</span>

                      <h3>Məzmun və vizual dil</h3>

                      <p>
                        Brendin danışıq tərzi, görünüşü və kontent xətti vahid
                        qalır.
                      </p>
                    </article>

                    <article className="neox-capability-card">
                      <CapabilityIcon
                        src={RESPONSE_ICON}
                        label="Cavab sistemləri"
                        fallback="03"
                      />

                      <span className="neox-capability-number">03</span>

                      <h3>Cavab sistemləri</h3>

                      <p>
                        Çatbot, səsli assistent və mesaj axınları müştərini
                        düzgün qarşılayır.
                      </p>
                    </article>

                    <article className="neox-capability-card">
                      <CapabilityIcon
                        src={WORKFLOW_ICON}
                        label="Avtomatlaşdırma"
                        fallback="04"
                      />

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
              anlayırıq. Sonra sizə uyğun sayt, süni intellekt, kontent və
              avtomatlaşdırma xəritəsini qururuq.
            </p>

            <div className="neox-build-tags" aria-hidden="true">
              <span>Veb sayt</span>
              <span>Brend görünüşü</span>
              <span>Süni intellekt</span>
              <span>İş axını</span>
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
      <style>{HOME_INLINE_STYLES}</style>

      <HomeHero />
      <ServiceCardsSection />
      <HowItWorksSection />
      <InteractiveSystemSection />
      <BuildTogetherSection />
    </main>
  );
}