import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { DEFAULT_LANG, type Lang } from "../i18n/lang";

const HERO_BACKGROUND_VIDEO_URL =
  "https://res.cloudinary.com/dppoomunj/video/upload/v1777159382/9150545-hd_1920_1080_24fps_xw2ces.mov";

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
    <main className="nx-page neox-home-page">
      <HomeHero />
      <ServiceCardsSection />
      <HowItWorksSection />
    </main>
  );
}