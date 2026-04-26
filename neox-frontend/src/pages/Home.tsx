import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { DEFAULT_LANG, type Lang } from "../i18n/lang";

const HERO_BACKGROUND_VIDEO_URL =
  "https://res.cloudinary.com/dppoomunj/video/upload/v1777159382/9150545-hd_1920_1080_24fps_xw2ces.mov";

const UNIFIED_SYSTEM_IMAGE_URL =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1777153052/ChatGPT_Image_Apr_26_2026_01_36_45_AM_adfc1t.webp";

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
    imageUrl:
      "https://res.cloudinary.com/dppoomunj/image/upload/v1777157607/ChatGPT_Image_Apr_26_2026_02_52_52_AM_k5ua6g.webp",
  },
  {
    title: "Biznes iş axınlarını avtomatlaşdırırıq",
    text: "Sifariş, müraciət, qeydiyyat və komanda proseslərini ardıcıl avtomatik axına salırıq.",
    href: "/services/workflow-automation",
    imageUrl:
      "https://res.cloudinary.com/dppoomunj/image/upload/v1777157641/5d7f54df-d9ff-4af8-8816-961fdfd809a9_vquktq.webp",
  },
  {
    title: "Səsli assistantlar qururuq",
    text: "Zənglərə cavab verən, məlumat toplayan və müştərini düzgün istiqamətə yönləndirən səsli sistemlər qururuq.",
    href: "/services/voice-assistants",
    imageUrl:
      "https://res.cloudinary.com/dppoomunj/image/upload/v1777157688/f08b0651-fcd9-4134-b27e-681e2cc2af04_v6e5q8.webp",
  },
  {
    title: "Kontent axınını qururuq",
    text: "İdeyadan paylaşımadək kontent planı, çəkiliş, təsdiq və paylaşım prosesini sistemləşdiririk.",
    href: "/services/content-flow",
    imageUrl:
      "https://res.cloudinary.com/dppoomunj/image/upload/v1777157728/7980da92-7475-4408-9c82-3fa23b913176_cyoxq8.webp",
  },
  {
    title: "24/7 çatbotlar qururuq",
    text: "Sosial media və vebsaytlarda müştəriyə gecə-gündüz cavab verən ağıllı çatbotlar qururuq.",
    href: "/services/chatbots",
    imageUrl:
      "https://res.cloudinary.com/dppoomunj/image/upload/v1777157761/857c6bd2-374e-4ca1-85e3-3f62ea93a5a4_itzbj8.webp",
  },
  {
    title: "Brend görünüşünü yaradırıq",
    text: "Logo, rəng, tipografiya və vizual üslubu biznesin xarakterinə uyğun premium şəkildə formalaşdırırıq.",
    href: "/services/brand-identity",
    imageUrl:
      "https://res.cloudinary.com/dppoomunj/image/upload/v1777157819/cdc46192-1199-4157-9005-df6655aec353_nl1lmz.webp",
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
        <div className="nx-section-head">
          <h2 className="nx-section-title neox-balanced-section-title">
            Biznesiniz üçün lazım olan əsas sistemləri qururuq.
          </h2>

          <p className="nx-section-lead">
            Hər xidmət ayrıca istiqamətdir. Birlikdə işləyəndə isə veb,
            kontent, satış, zəng və müştəri cavabları vahid biznes sisteminə
            çevrilir.
          </p>
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

function UnifiedSystemSection() {
  return (
    <section className="nx-section neox-unified-section">
      <div className="nx-container neox-unified-container">
        <div className="neox-unified-layout">
          <div className="neox-unified-visual" aria-hidden="true">
            <div className="neox-unified-image-wrap">
              <img
                src={UNIFIED_SYSTEM_IMAGE_URL}
                alt=""
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>

          <div className="neox-unified-copy">
            <h2 className="nx-section-title neox-balanced-section-title neox-unified-title">
              Ayrı xidmətlər yox, <span>vahid sistem</span> qururuq.
            </h2>

            <p className="nx-section-lead neox-unified-lead">
              Veb sayt, kontent, çatbot, satış və avtomatlaşdırma hissələri
              bir-birinə bağlı işləyəndə biznes daha sürətli, daha aydın və
              daha idarəolunan olur.
            </p>
          </div>
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

    return () => {
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

export default function HomePage() {
  return (
    <>
      <style>{`
        body:has(.neox-home-page) {
          overflow-y: auto !important;
          scrollbar-gutter: auto !important;
        }

        body:has(.neox-home-page) #root,
        body:has(.neox-home-page) #root > *,
        body:has(.neox-home-page) #root > * > *,
        body:has(.neox-home-page) #root > * > * > *,
        body:has(.neox-home-page) .nx-page,
        body:has(.neox-home-page) .neox-home-page {
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          overflow: visible !important;
          overflow-y: visible !important;
        }

        body:has(.neox-home-page) .nx-page::-webkit-scrollbar,
        body:has(.neox-home-page) .neox-home-page::-webkit-scrollbar,
        body:has(.neox-home-page) #root > *::-webkit-scrollbar,
        body:has(.neox-home-page) #root > * > *::-webkit-scrollbar,
        body:has(.neox-home-page) #root > * > * > *::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }

        @keyframes neoxHomeStrip {
          0% {
            transform: translateX(0);
          }

          100% {
            transform: translateX(-33.333%);
          }
        }

        @keyframes neoxHeroPhrase {
          0% {
            opacity: 0;
            transform: translateY(0.18em);
          }

          4%,
          10.5% {
            opacity: 1;
            transform: translateY(0);
          }

          12.5%,
          100% {
            opacity: 0;
            transform: translateY(-0.14em);
          }
        }

        .neox-home-page {
          display: block;
          width: 100%;
          overflow: visible !important;
        }

        .neox-home-hero {
          height: calc(100vh - var(--nx-header-h, 56px));
          height: calc(100svh - var(--nx-header-h, 56px));
          display: flex;
          flex-direction: column;
          background: #ffffff;
          overflow: hidden;
        }

        .neox-home-hero-main {
          position: relative;
          min-height: 0;
          flex: 1;
          overflow: hidden;
        }

        .neox-hero-media {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }

        .neox-hero-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: 62% center;
          opacity: 1;
          filter: saturate(0.96) contrast(1.02) brightness(1.04);
          transform: scale(1.01);
        }

        .neox-hero-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .neox-hero-overlay--side {
          background: linear-gradient(
            90deg,
            rgba(248, 250, 252, 0.82) 0%,
            rgba(248, 250, 252, 0.64) 34%,
            rgba(248, 250, 252, 0.28) 66%,
            rgba(248, 250, 252, 0.06) 100%
          );
        }

        .neox-hero-overlay--top {
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.12) 0%,
            rgba(255, 255, 255, 0) 42%,
            rgba(255, 255, 255, 0.08) 100%
          );
        }

        .neox-hero-overlay--focus {
          background: radial-gradient(
            760px 420px at 12% 50%,
            rgba(255, 255, 255, 0.52),
            transparent 68%
          );
        }

        .neox-hero-container {
          position: relative;
          z-index: 1;
          height: 100%;
          display: flex;
          align-items: center;
          padding-top: 40px;
          padding-bottom: 40px;
        }

        .neox-hero-copy {
          max-width: 960px;
        }

        .neox-hero-title {
          margin: 0;
          max-width: 980px;
          color: var(--nx-ink);
          font-size: clamp(2.85rem, 4.45vw, 5rem);
          font-weight: 520;
          line-height: 1.08;
          letter-spacing: -0.06em;
          text-wrap: balance;
        }

        .neox-hero-title-line {
          display: block;
        }

        .neox-hero-title-line:first-child {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 0.24em;
        }

        .neox-hero-loop {
          position: relative;
          display: inline-grid;
          white-space: nowrap;
          color: var(--nx-blue);
          vertical-align: baseline;
        }

        .neox-hero-loop-sizer {
          grid-area: 1 / 1;
          visibility: hidden;
          pointer-events: none;
        }

        .neox-hero-loop-item {
          grid-area: 1 / 1;
          opacity: 0;
          color: var(--nx-blue);
          animation: neoxHeroPhrase 24s cubic-bezier(0.22, 1, 0.36, 1) infinite;
          will-change: opacity, transform;
        }

        .neox-hero-lead {
          margin: 28px 0 0;
          max-width: 650px;
          color: #334155;
          font-size: 1.05rem;
          font-weight: 430;
          line-height: 1.78;
          letter-spacing: -0.018em;
        }

        .neox-hero-actions {
          margin-top: 36px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 16px;
        }

        .neox-system-strip {
          position: relative;
          z-index: 2;
          height: 82px;
          flex: 0 0 auto;
          overflow: hidden;
          border-top: 1px solid rgba(15, 23, 42, 0.08);
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
          background: #f7f8fb;
        }

        .neox-system-strip-fade {
          position: absolute;
          top: 0;
          bottom: 0;
          z-index: 2;
          width: 96px;
          pointer-events: none;
        }

        .neox-system-strip-fade--left {
          left: 0;
          background: linear-gradient(90deg, #f7f8fb, transparent);
        }

        .neox-system-strip-fade--right {
          right: 0;
          background: linear-gradient(270deg, #f7f8fb, transparent);
        }

        .neox-system-strip-track-wrap {
          height: 100%;
          display: flex;
          align-items: center;
          overflow: hidden;
        }

        .neox-home-strip {
          width: max-content;
          display: flex;
          align-items: center;
          gap: 64px;
          animation: neoxHomeStrip 38s linear infinite;
        }

        .neox-home-strip:hover {
          animation-play-state: paused;
        }

        .neox-strip-item {
          height: 82px;
          display: flex;
          align-items: center;
          white-space: nowrap;
          color: var(--nx-muted);
          font-size: 13px;
          font-weight: 760;
          line-height: 1;
          letter-spacing: 0.17em;
          text-transform: uppercase;
          transition: color 180ms ease;
        }

        .neox-strip-item:hover {
          color: var(--nx-blue);
        }

        .neox-balanced-section-title {
          font-size: clamp(2.75rem, 4.45vw, 4.75rem);
          font-weight: 520;
          line-height: 1.08;
          letter-spacing: -0.064em;
        }

        .neox-balanced-section-title span {
          color: var(--nx-blue);
          font-weight: inherit;
        }

        .neox-card-section {
          padding-top: 88px;
          padding-bottom: 72px;
        }

        .neox-card-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 18px;
          align-items: stretch;
        }

        .neox-system-card {
          position: relative;
          min-height: 342px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: var(--nx-radius-xl);
          background: var(--nx-dark-2);
          color: #ffffff;
          box-shadow: var(--nx-shadow-card);
          isolation: isolate;
          text-decoration: none;
          transition:
            border-color 180ms ease,
            box-shadow 180ms ease;
        }

        .neox-system-card:hover {
          border-color: rgba(255, 255, 255, 0.14);
          box-shadow: var(--nx-shadow-card-hover);
        }

        .neox-card-cover {
          position: absolute;
          inset: 0;
          z-index: 0;
          background:
            radial-gradient(
              420px 270px at 74% 12%,
              rgba(255, 255, 255, 0.07),
              transparent 62%
            ),
            radial-gradient(
              520px 340px at 8% 100%,
              rgba(58, 84, 255, 0.16),
              transparent 68%
            ),
            linear-gradient(135deg, #090f1d 0%, #0b1220 52%, #111827 100%);
          transition:
            transform 420ms var(--nx-ease),
            filter 420ms var(--nx-ease);
        }

        .neox-card-cover img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }

        .neox-card-overlay {
          position: absolute;
          inset: 0;
          z-index: 1;
          background: linear-gradient(
            180deg,
            rgba(8, 13, 25, 0.06) 0%,
            rgba(8, 13, 25, 0.28) 44%,
            rgba(8, 13, 25, 0.9) 100%
          );
          transition: background 260ms ease;
        }

        .neox-card-content {
          position: relative;
          z-index: 3;
          display: grid;
          gap: 13px;
          padding: 112px 26px 26px;
          transition:
            opacity 220ms ease,
            filter 260ms ease,
            transform 260ms var(--nx-ease);
        }

        .neox-system-card h3 {
          margin: 0;
          color: inherit;
          font-size: clamp(1.38rem, 1.65vw, 1.72rem);
          font-weight: 560;
          line-height: 1.12;
          letter-spacing: -0.05em;
          text-wrap: balance;
        }

        .neox-system-card p {
          margin: 0;
          max-width: 94%;
          color: rgba(255, 255, 255, 0.76);
          font-size: 14.5px;
          font-weight: 420;
          line-height: 1.68;
          letter-spacing: -0.016em;
        }

        .neox-card-action {
          position: absolute;
          inset: 0;
          z-index: 5;
          display: grid;
          place-items: center;
          opacity: 0;
          pointer-events: none;
          transform: translateY(7px) scale(0.985);
          transition:
            opacity 220ms ease,
            transform 280ms var(--nx-ease);
        }

        .neox-card-action span {
          min-height: 48px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 22px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.94);
          color: var(--nx-dark);
          font-size: 14px;
          font-weight: 620;
          letter-spacing: -0.018em;
          box-shadow: 0 18px 44px rgba(0, 0, 0, 0.22);
        }

        .neox-system-card:hover .neox-card-cover {
          transform: scale(1.04);
          filter: blur(7px) brightness(0.64);
        }

        .neox-system-card:hover .neox-card-overlay {
          background: linear-gradient(
            180deg,
            rgba(8, 13, 25, 0.48) 0%,
            rgba(8, 13, 25, 0.72) 58%,
            rgba(8, 13, 25, 0.92) 100%
          );
        }

        .neox-system-card:hover .neox-card-content {
          opacity: 0.25;
          filter: blur(3px);
          transform: scale(0.985);
        }

        .neox-system-card:hover .neox-card-action {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        .neox-unified-section {
          position: relative;
          overflow: hidden;
          padding-top: 112px;
          padding-bottom: 112px;
          background:
            radial-gradient(
              980px 520px at 22% 48%,
              rgba(28, 92, 255, 0.18),
              rgba(28, 92, 255, 0.055) 34%,
              transparent 68%
            ),
            radial-gradient(
              760px 420px at 78% 28%,
              rgba(255, 255, 255, 0.055),
              transparent 62%
            ),
            linear-gradient(180deg, #020304 0%, #000000 54%, #020304 100%);
          color: #ffffff;
          border-top: 1px solid rgba(255, 255, 255, 0.075);
          border-bottom: 1px solid rgba(255, 255, 255, 0.075);
        }

        .neox-unified-section::before {
          content: "";
          position: absolute;
          left: -18%;
          top: 12%;
          width: 58%;
          height: 72%;
          pointer-events: none;
          background:
            radial-gradient(
              circle at 48% 52%,
              rgba(47, 124, 255, 0.22),
              rgba(47, 124, 255, 0.075) 38%,
              transparent 70%
            );
          filter: blur(34px);
          opacity: 0.86;
        }

        .neox-unified-section::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(
              90deg,
              rgba(0, 0, 0, 0.08) 0%,
              transparent 24%,
              transparent 70%,
              rgba(0, 0, 0, 0.45) 100%
            ),
            radial-gradient(
              720px 360px at 47% 50%,
              transparent 0%,
              transparent 58%,
              rgba(0, 0, 0, 0.28) 100%
            );
        }

        .neox-unified-container {
          position: relative;
          z-index: 1;
        }

        .neox-unified-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(360px, 0.75fr);
          gap: clamp(42px, 5.8vw, 92px);
          align-items: center;
        }

        .neox-unified-visual {
          position: relative;
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: flex-start;
        }

        .neox-unified-visual::before {
          content: "";
          position: absolute;
          left: 4%;
          top: 50%;
          width: 72%;
          height: 64%;
          transform: translateY(-50%);
          pointer-events: none;
          background:
            radial-gradient(
              circle at 50% 50%,
              rgba(36, 106, 255, 0.28),
              rgba(36, 106, 255, 0.11) 38%,
              transparent 72%
            );
          filter: blur(44px);
          opacity: 0.78;
        }

        .neox-unified-image-wrap {
          position: relative;
          width: min(112%, 980px);
          aspect-ratio: 1.48 / 1;
          margin-left: -42px;
          overflow: visible;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
          isolation: isolate;
        }

        .neox-unified-image-wrap::before {
          content: "";
          position: absolute;
          inset: 7% 8% 5% 8%;
          z-index: -1;
          pointer-events: none;
          background:
            radial-gradient(
              circle at 50% 50%,
              rgba(28, 104, 255, 0.26),
              rgba(28, 104, 255, 0.08) 42%,
              transparent 72%
            );
          filter: blur(34px);
          opacity: 0.86;
        }

        .neox-unified-image-wrap::after {
          content: "";
          position: absolute;
          inset: -3px;
          pointer-events: none;
          background:
            linear-gradient(
              90deg,
              #000000 0%,
              rgba(0, 0, 0, 0.72) 3.5%,
              rgba(0, 0, 0, 0) 14%,
              rgba(0, 0, 0, 0) 78%,
              rgba(0, 0, 0, 0.34) 91%,
              #000000 100%
            ),
            linear-gradient(
              180deg,
              #000000 0%,
              rgba(0, 0, 0, 0.62) 4%,
              rgba(0, 0, 0, 0) 16%,
              rgba(0, 0, 0, 0) 76%,
              rgba(0, 0, 0, 0.46) 91%,
              #000000 100%
            ),
            radial-gradient(
              680px 360px at 52% 52%,
              transparent 0%,
              transparent 54%,
              rgba(0, 0, 0, 0.48) 86%,
              #000000 100%
            );
          z-index: 2;
        }

        .neox-unified-image-wrap img {
          position: relative;
          z-index: 1;
          width: 100%;
          height: 100%;
          display: block;
          object-fit: contain;
          object-position: center;
          transform: scale(1.08);
          opacity: 0.96;
          filter:
            saturate(1.08)
            contrast(1.05)
            brightness(0.92)
            drop-shadow(0 38px 96px rgba(0, 0, 0, 0.58));
        }

        .neox-unified-copy {
          width: min(100%, 610px);
          justify-self: end;
          text-align: left;
        }

        .neox-unified-title {
          margin: 0;
          max-width: 610px;
          color: #ffffff;
          font-size: clamp(3.05rem, 5vw, 5.45rem);
          font-weight: 520;
          line-height: 1.03;
          letter-spacing: -0.074em;
          text-wrap: balance;
        }

        .neox-unified-title span {
          color: #2f7cff;
          font-weight: inherit;
        }

        .neox-unified-lead {
          margin: 30px 0 0;
          max-width: 520px;
          color: rgba(255, 255, 255, 0.68);
          font-size: clamp(1rem, 1.12vw, 1.16rem);
          font-weight: 390;
          line-height: 1.78;
          letter-spacing: -0.022em;
        }

        .neox-process-section {
          position: relative;
          z-index: 0;
          overflow: visible;
          padding-top: 112px;
          padding-bottom: 96px;
          background:
            radial-gradient(
              900px 360px at 8% 16%,
              rgba(68, 89, 223, 0.025),
              transparent 64%
            ),
            linear-gradient(180deg, #ffffff 0%, #f8f9fb 100%);
        }

        .neox-process-section::before {
          content: "";
          position: absolute;
          left: -180px;
          bottom: -180px;
          width: 620px;
          height: 420px;
          border-radius: 999px;
          border: 1px solid rgba(36, 71, 198, 0.035);
          opacity: 0.8;
          pointer-events: none;
        }

        .neox-process-stage {
          position: relative;
          z-index: 1;
        }

        .neox-process-editorial {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 0.8fr) minmax(560px, 1.02fr);
          gap: clamp(64px, 8vw, 112px);
          align-items: start;
        }

        .neox-process-copy-track {
          position: relative;
          min-width: 0;
          min-height: var(--neox-process-copy-track-h, 840px);
          overflow: visible;
        }

        .neox-process-moving {
          position: absolute;
          top: var(--neox-process-copy-start, 0px);
          left: 0;
          width: min(100%, 620px);
          transform: translate3d(0, var(--neox-process-copy-y, 0px), 0);
          transition: none;
          will-change: transform;
          backface-visibility: hidden;
        }

        .neox-process-title {
          max-width: 620px;
        }

        .neox-process-lead {
          margin-top: 26px;
          max-width: 520px;
          color: #425166;
          font-size: clamp(1.1rem, 1.32vw, 1.34rem);
          font-weight: 360;
          line-height: 1.78;
          letter-spacing: -0.026em;
        }

        .neox-process-list-wrap {
          position: relative;
          min-width: 0;
          overflow: visible;
        }

        .neox-process-list {
          display: grid;
          padding-bottom: 0;
        }

        .neox-process-row {
          position: relative;
          display: grid;
          grid-template-columns: 120px 1px minmax(0, 1fr);
          gap: 40px;
          align-items: center;
          min-height: 168px;
          padding: 12px 0;
          border-bottom: 1px solid rgba(15, 23, 42, 0.075);
          color: var(--nx-ink);
          background: transparent;
          box-shadow: none;
          border-radius: 0;
        }

        .neox-process-row:first-child {
          border-top: 1px solid rgba(15, 23, 42, 0.075);
        }

        .neox-process-row-number {
          color: rgba(15, 23, 42, 0.22);
          font-family: var(--nx-font-display);
          font-size: clamp(4.2rem, 5.4vw, 5.8rem);
          font-weight: 400;
          line-height: 0.9;
          letter-spacing: -0.06em;
          opacity: 0;
          filter: blur(7px);
          transform: translateY(14px);
          transition:
            opacity 240ms ease,
            filter 280ms ease,
            transform 280ms var(--nx-ease),
            color 180ms ease;
          transition-delay: 0ms;
        }

        .neox-process-row-divider {
          width: 1px;
          height: 76px;
          background: linear-gradient(
            180deg,
            rgba(15, 23, 42, 0.035),
            rgba(36, 71, 198, 0.18),
            rgba(15, 23, 42, 0.035)
          );
          opacity: 0.58;
          transform: scaleY(0.72);
          transform-origin: center;
          transition:
            opacity 240ms ease,
            transform 280ms var(--nx-ease),
            background 180ms ease;
        }

        .neox-process-row-content {
          min-width: 0;
          opacity: 0;
          filter: blur(7px);
          transform: translateY(14px);
          transition:
            opacity 240ms ease,
            filter 280ms ease,
            transform 280ms var(--nx-ease);
          transition-delay: 0ms;
        }

        .neox-process-row.is-visible .neox-process-row-number,
        .neox-process-row.is-visible .neox-process-row-content {
          opacity: 0.62;
          filter: blur(0);
          transform: translateY(0);
        }

        .neox-process-row.is-visible .neox-process-row-divider {
          opacity: 0.76;
          transform: scaleY(1);
        }

        .neox-process-row.is-active .neox-process-row-number,
        .neox-process-row.is-active .neox-process-row-content {
          opacity: 1;
        }

        .neox-process-row.is-active .neox-process-row-number {
          color: var(--nx-blue);
        }

        .neox-process-row.is-active .neox-process-row-divider {
          opacity: 1;
          background: linear-gradient(
            180deg,
            rgba(36, 71, 198, 0.06),
            rgba(36, 71, 198, 0.38),
            rgba(36, 71, 198, 0.06)
          );
        }

        .neox-process-row-content h3 {
          margin: 0;
          color: var(--nx-ink);
          font-family: var(--nx-font-body);
          font-size: clamp(1.38rem, 1.65vw, 1.72rem);
          font-weight: 560;
          line-height: 1.12;
          letter-spacing: -0.05em;
          text-wrap: balance;
          transition: color 180ms ease;
        }

        .neox-process-row.is-active .neox-process-row-content h3 {
          color: var(--nx-blue);
        }

        .neox-process-row-content p {
          margin: 12px 0 0;
          max-width: 620px;
          color: #5a677c;
          font-size: 14.5px;
          font-weight: 420;
          line-height: 1.68;
          letter-spacing: -0.016em;
        }

        @media (max-width: 1180px) {
          .neox-card-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .neox-unified-layout {
            gap: 54px;
          }

          .neox-unified-title {
            font-size: clamp(2.85rem, 5.8vw, 4.7rem);
          }

          .neox-process-section {
            padding-top: 82px;
            padding-bottom: 92px;
          }

          .neox-process-editorial {
            grid-template-columns: 1fr;
            gap: 54px;
          }

          .neox-process-copy-track {
            min-height: auto;
          }

          .neox-process-moving {
            position: relative;
            top: auto;
            left: auto;
            transform: none !important;
            transition: none;
          }

          .neox-process-title,
          .neox-process-lead {
            max-width: 760px;
          }

          .neox-process-row-number,
          .neox-process-row-content {
            opacity: 1;
            filter: none;
            transform: none;
          }

          .neox-process-row-divider {
            opacity: 0.78;
            transform: scaleY(1);
          }
        }

        @media (max-width: 1100px) {
          .neox-hero-title {
            max-width: 860px;
            font-size: clamp(2.75rem, 6vw, 4.6rem);
          }
        }

        @media (max-width: 980px) {
          .neox-unified-section {
            padding-top: 84px;
            padding-bottom: 86px;
          }

          .neox-unified-layout {
            grid-template-columns: 1fr;
            gap: 42px;
          }

          .neox-unified-copy {
            width: 100%;
            justify-self: start;
            order: -1;
          }

          .neox-unified-title {
            max-width: 760px;
          }

          .neox-unified-lead {
            max-width: 640px;
          }

          .neox-unified-image-wrap {
            width: min(108%, 820px);
            margin-left: -18px;
          }

          .neox-unified-image-wrap img {
            transform: scale(1.04);
          }
        }

        @media (max-width: 900px) {
          .neox-home-hero {
            height: auto;
            min-height: calc(100svh - var(--nx-header-h, 60px));
          }

          .neox-hero-container {
            min-height: calc(100svh - var(--nx-header-h, 60px) - 82px);
            padding-top: 72px;
            padding-bottom: 64px;
          }

          .neox-hero-title {
            max-width: 100%;
            font-size: clamp(2.65rem, 10vw, 4.25rem);
            line-height: 1.07;
            letter-spacing: -0.06em;
          }

          .neox-hero-title-line:first-child {
            display: block;
          }

          .neox-hero-loop {
            display: grid;
            margin-top: 0.04em;
            white-space: normal;
          }

          .neox-hero-loop-item {
            width: 100%;
          }

          .neox-hero-lead {
            font-size: 1rem;
            line-height: 1.76;
          }

          .neox-card-section {
            padding-top: 76px;
            padding-bottom: 64px;
          }

          .neox-balanced-section-title {
            font-size: clamp(2.45rem, 8vw, 4.1rem);
            letter-spacing: -0.06em;
          }

          .neox-process-row {
            grid-template-columns: 90px 1px minmax(0, 1fr);
            gap: 28px;
            min-height: 142px;
          }

          .neox-process-row-number {
            font-size: 3.8rem;
          }
        }

        @media (max-width: 720px) {
          .neox-card-grid {
            grid-template-columns: 1fr;
          }

          .neox-system-card {
            min-height: 330px;
          }

          .neox-unified-title {
            font-size: clamp(2.75rem, 11vw, 4rem);
          }

          .neox-unified-image-wrap {
            aspect-ratio: 1.08 / 1;
            width: 112%;
            margin-left: -6%;
          }

          .neox-unified-image-wrap img {
            transform: scale(1.08);
          }
        }

        @media (max-width: 640px) {
          .neox-hero-container {
            padding-top: 60px;
          }

          .neox-card-content {
            padding-left: 24px;
            padding-right: 24px;
          }

          .neox-system-card {
            border-radius: 22px;
          }

          .neox-unified-section {
            padding-top: 72px;
            padding-bottom: 74px;
          }

          .neox-unified-lead {
            font-size: 1rem;
            line-height: 1.72;
          }

          .neox-process-row {
            grid-template-columns: 1fr;
            gap: 14px;
            min-height: auto;
            padding: 28px 0;
          }

          .neox-process-row-divider {
            display: none;
          }

          .neox-process-row-number {
            font-size: 3rem;
          }

          .neox-process-row-content h3 {
            font-size: 1.55rem;
          }

          .neox-process-row-content p {
            font-size: 0.98rem;
          }
        }

        @media (max-width: 520px) {
          .neox-hero-title {
            font-size: 2.85rem;
            line-height: 1.06;
            letter-spacing: -0.058em;
          }

          .neox-hero-actions {
            gap: 12px;
          }

          .neox-balanced-section-title {
            font-size: 2.85rem;
          }

          .neox-process-lead {
            font-size: 1rem;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .neox-home-strip,
          .neox-hero-loop-item {
            animation: none;
          }

          .neox-hero-loop-item:nth-of-type(2) {
            opacity: 1;
            transform: none;
          }

          .neox-process-moving,
          .neox-process-row-number,
          .neox-process-row-divider,
          .neox-process-row-content {
            transition: none !important;
          }
        }
      `}</style>

      <main className="nx-page neox-home-page">
        <HomeHero />
        <ServiceCardsSection />
        <UnifiedSystemSection />
        <HowItWorksSection />
      </main>
    </>
  );
}