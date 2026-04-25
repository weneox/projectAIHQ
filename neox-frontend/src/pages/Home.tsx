import { Link, useParams } from "react-router-dom";
import { DEFAULT_LANG, type Lang } from "../i18n/lang";

const HERO_BACKGROUND_URL =
  "https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=2400&auto=format&fit=crop";

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

const heroPhrases = [
  "ağıllı biznes sistemləri",
  "premium veb saytlar",
  "mesajlaşma axınları",
  "Süni İntellekt cavabları",
  "satış yönümlü sistemlər",
  "avtomatlaşdırma qatları",
  "müştəri idarəetmə axınları",
  "analitika sistemləri",
];

const stripItems = [
  "NEOX CORE",
  "VEB SAYT",
  "BİZNES WORKFLOW",
  "MESAJLAŞMA",
  "AVTOMATLAŞDIRMA",
  "SÜNİ İNTELLEKT CAVABLARI",
  "ANALİTİKA",
  "SƏS QATI",
  "OPERATOR YÖNLƏNDİRMƏSİ",
  "BİZNES KONTEKSTİ",
];

const serviceCards = [
  {
    variant: "cover",
    title: "Veb sistemi qurur",
    text: "Brendə uyğun, sürətli və satış yönümlü veb səhifələri biznes axını ilə birlikdə hazırlayırıq.",
    tag: "Veb sistem",
    href: "/services/web-systems",
    imageUrl: "",
  },
  {
    variant: "split",
    title: "Mesajları idarə edir",
    text: "Instagram, sayt, WhatsApp və digər kanallardan gələn sorğuları vahid sistemə gətiririk.",
    tag: "Mesajlaşma",
    href: "/services/messaging",
    imageUrl: "",
  },
  {
    variant: "stack",
    title: "İş axınını avtomatlaşdırır",
    text: "Cavab, yönləndirmə, lead izləmə və komanda proseslərini daha səliqəli hala salırıq.",
    tag: "Workflow",
    href: "/services/automation",
    imageUrl: "",
  },
] as const;

const processSteps = [
  {
    number: "01",
    title: "Biznesi başa düşürük",
    text: "Sahəni, xidmətləri, müştəri suallarını və hazırkı iş axınını xəritələyirik.",
  },
  {
    number: "02",
    title: "Sistemi dizayn edirik",
    text: "Veb sayt, mesajlaşma, Süni İntellekt cavabları və avtomatlaşdırmanı vahid axına salırıq.",
  },
  {
    number: "03",
    title: "İşlək hala gətiririk",
    text: "Sistemi qurur, test edir və real müştəri axınına uyğun optimallaşdırırıq.",
  },
];

function HeroLoopText() {
  return (
    <span className="neox-hero-loop" aria-live="polite">
      <span className="neox-hero-loop-sizer" aria-hidden="true">
        ağıllı biznes sistemləri
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
    <div className="relative z-10 h-[82px] shrink-0 overflow-hidden border-y border-slate-200 bg-[#f7f8fb]">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#f7f8fb] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#f7f8fb] to-transparent" />

      <div className="flex h-full items-center overflow-hidden">
        <div className="neox-home-strip flex w-max items-center gap-16">
          {repeated.map((item, index) => (
            <span
              key={`${item}-${index}`}
              className="neox-strip-item flex h-[82px] items-center whitespace-nowrap text-[13px] font-extrabold uppercase tracking-[0.17em]"
            >
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

  return (
    <section className="neox-home-hero relative overflow-hidden bg-white">
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={HERO_BACKGROUND_URL}
            alt=""
            className="neox-hero-bg h-full w-full object-cover object-[64%_center]"
          />

          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(248,250,252,0.66)_0%,rgba(248,250,252,0.42)_34%,rgba(248,250,252,0.16)_66%,rgba(248,250,252,0.02)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0)_42%,rgba(255,255,255,0.06)_100%)]" />
        </div>

        <div className="relative mx-auto flex w-full max-w-[1460px] items-center px-6 pb-8 pt-10 lg:px-10 lg:pb-10 lg:pt-12">
          <div className="max-w-[960px]">
            <h1 className="neox-hero-title text-[#070a18]">
              <span className="neox-hero-title-line">
                <span>Biz</span>
                <HeroLoopText />
              </span>
              <span className="neox-hero-title-line">qururuq.</span>
            </h1>

            <p className="mt-7 max-w-[650px] text-[1.05rem] font-[540] leading-[1.78] tracking-[-0.018em] text-slate-700 md:text-[1.12rem]">
              Veb sayt, mesajlaşma, avtomatlaşdırma və Süni İntellekt
              cavablarını bir sistemdə birləşdiririk. Müştəri axını daha
              səliqəli, sürətli və ölçülə bilən olur.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
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

function MediaSlot({
  imageUrl,
  className = "",
}: {
  imageUrl?: string;
  className?: string;
}) {
  return (
    <div className={`neox-card-media ${imageUrl ? "has-image" : "is-empty"} ${className}`}>
      {imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : null}
    </div>
  );
}

function ServiceCardsSection() {
  const lang = useSafeLang();

  return (
    <section className="neox-card-section">
      <div className="mx-auto max-w-[1460px] px-6 lg:px-10">
        <div className="neox-card-section-head">
          <div>
            <div className="mb-5 text-[12px] font-[720] uppercase tracking-[0.2em] text-slate-400">
              Sistemlər
            </div>

            <h2 className="max-w-[720px] text-[3rem] font-[720] leading-[1.06] tracking-[-0.068em] text-slate-950 md:text-[3.4rem]">
              Xidmətləri vizual, təmiz və kliklənən göstəririk.
            </h2>
          </div>

          <p className="max-w-[560px] text-[1.04rem] font-[500] leading-8 text-slate-600 lg:justify-self-end">
            Hər kartda şəkil və ya ikon yerləşdirmək üçün ayrıca sahə var.
            Vizualı sonra öz dizaynına uyğun əlavə edirsən.
          </p>
        </div>

        <div className="neox-card-grid">
          {serviceCards.map((card) => {
            if (card.variant === "cover") {
              return (
                <Link
                  key={card.title}
                  to={withLang(lang, card.href)}
                  className="neox-system-card neox-system-card--cover"
                >
                  <MediaSlot imageUrl={card.imageUrl} className="neox-cover-media" />

                  <div className="neox-cover-overlay" />

                  <div className="neox-cover-content">
                    <h3>{card.title}</h3>
                    <p>{card.text}</p>
                  </div>

                  <div className="neox-cover-action">
                    <span>Daha ətraflı</span>
                  </div>
                </Link>
              );
            }

            if (card.variant === "split") {
              return (
                <Link
                  key={card.title}
                  to={withLang(lang, card.href)}
                  className="neox-system-card neox-system-card--split"
                >
                  <div className="neox-split-visual">
                    <MediaSlot imageUrl={card.imageUrl} />
                  </div>

                  <div className="neox-split-content">
                    <div className="neox-card-tag">{card.tag}</div>
                    <h3>{card.title}</h3>
                    <p>{card.text}</p>
                  </div>

                  <div className="neox-split-action">
                    <span>Daha ətraflı</span>
                  </div>
                </Link>
              );
            }

            return (
              <Link
                key={card.title}
                to={withLang(lang, card.href)}
                className="neox-system-card neox-system-card--stack"
              >
                <div className="neox-stack-media-wrap">
                  <MediaSlot imageUrl={card.imageUrl} />
                </div>

                <div className="neox-stack-panel">
                  <div className="neox-card-tag">{card.tag}</div>
                  <h3>{card.title}</h3>
                  <p>{card.text}</p>

                  <div className="neox-stack-footer">
                    <span>Daha ətraflı</span>
                    <span className="neox-stack-arrow">→</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ProcessSection() {
  return (
    <section className="bg-[#f7f8fb] py-24">
      <div className="mx-auto max-w-[1460px] px-6 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-end">
          <div>
            <div className="mb-5 text-[12px] font-[720] uppercase tracking-[0.2em] text-slate-400">
              Proses
            </div>

            <h2 className="max-w-[680px] text-[3.15rem] font-[720] leading-[1.06] tracking-[-0.068em] text-slate-950 md:text-[3.55rem]">
              Sadə başlayırıq, sistemli böyüdürük.
            </h2>
          </div>

          <p className="max-w-[660px] text-[1.08rem] font-[500] leading-9 text-slate-600 lg:justify-self-end">
            Məqsəd çox ekran, çox panel və qarışıq quruluş deyil. Lazım olan iş
            axınını tapırıq, onu təmiz interfeys və avtomatlaşdırma ilə işlək
            hala gətiririk.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {processSteps.map((step) => (
            <article
              key={step.number}
              className="rounded-[26px] border border-slate-200/90 bg-white p-8 shadow-sm"
            >
              <div className="mb-7 inline-flex rounded-[16px] border border-slate-200 bg-white px-4 py-2 text-[14px] font-[680] text-slate-500">
                {step.number}
              </div>

              <h3 className="text-[1.28rem] font-[720] tracking-[-0.035em] text-slate-950">
                {step.title}
              </h3>

              <p className="mt-4 text-[1rem] font-[500] leading-8 text-slate-600">
                {step.text}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  const lang = useSafeLang();

  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-[1460px] px-6 lg:px-10">
        <div className="rounded-[34px] border border-slate-200/90 bg-[#f8f9fc] p-8 shadow-[0_30px_100px_rgba(15,23,42,0.075)] md:p-12 lg:p-14">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.72fr] lg:items-center">
            <div>
              <div className="mb-5 inline-flex rounded-[14px] border border-slate-200 bg-white px-5 py-2 text-[13px] font-[680] text-slate-600">
                Başlamaq üçün
              </div>

              <h2 className="max-w-[760px] text-[3rem] font-[720] leading-[1.06] tracking-[-0.068em] text-slate-950 md:text-[3.35rem]">
                Biznesinizə uyğun sistemi birlikdə quraq.
              </h2>

              <p className="mt-6 max-w-[720px] text-[1.08rem] font-[500] leading-9 text-slate-600">
                Bir neçə əsas məlumat kifayətdir: nə satırsınız, müştəri haradan
                yazır və hazırda hansı işlər sizi yavaşladır.
              </p>
            </div>

            <div className="rounded-[26px] border border-slate-200/90 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4 rounded-[20px] border border-slate-100 bg-white px-5 py-5">
                <div>
                  <div className="text-[1.05rem] font-[720] text-slate-950">
                    İlk addım
                  </div>

                  <div className="mt-2 text-[14px] font-[500] leading-6 text-slate-500">
                    Qısa danışıqla sistem xəritəsini və ilk icra istiqamətini
                    müəyyən edirik.
                  </div>
                </div>

                <div className="shrink-0 rounded-[14px] border border-slate-200 px-4 py-2 text-[13px] font-[680] text-slate-500">
                  15 dəq
                </div>
              </div>

              <Link
                to={withLang(lang, "/contact")}
                className="nx-button nx-button--primary nx-button--lg nx-button--full mt-5"
              >
                Əlaqə saxla
              </Link>
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
          padding-top: var(--nx-header-h, 64px);
          background: #fff;
        }

        .neox-home-hero {
          height: calc(100vh - var(--nx-header-h, 64px));
          height: calc(100svh - var(--nx-header-h, 64px));
          display: flex;
          flex-direction: column;
        }

        .neox-hero-bg {
          opacity: 0.98;
          filter: saturate(1.02) contrast(1.01);
        }

        .neox-hero-title {
          max-width: 980px;
          font-size: clamp(2.85rem, 4.45vw, 5rem);
          font-weight: 640;
          line-height: 1.08;
          letter-spacing: -0.058em;
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
          color: #2447c6;
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
          color: #2447c6;
          animation: neoxHeroPhrase 24s cubic-bezier(0.22, 1, 0.36, 1) infinite;
          will-change: opacity, transform;
        }

        .neox-home-strip {
          animation: neoxHomeStrip 38s linear infinite;
        }

        .neox-home-strip:hover {
          animation-play-state: paused;
        }

        .neox-strip-item {
          color: #64748b;
          transition: color 180ms ease;
        }

        .neox-strip-item:hover {
          color: #2447c6;
        }

        .neox-card-section {
          padding: 86px 0 96px;
          background:
            radial-gradient(720px 280px at 14% 0%, rgba(68, 89, 223, 0.045), transparent 64%),
            linear-gradient(180deg, #ffffff 0%, #f6f7fa 100%);
        }

        .neox-card-section-head {
          display: grid;
          grid-template-columns: minmax(0, 0.94fr) minmax(320px, 0.66fr);
          gap: 36px;
          align-items: end;
          margin-bottom: 42px;
        }

        .neox-card-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 20px;
          align-items: stretch;
        }

        .neox-system-card {
          position: relative;
          min-height: 390px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(15, 23, 42, 0.095);
          border-radius: 26px;
          background: #ffffff;
          color: #07111f;
          box-shadow: 0 20px 58px rgba(15, 23, 42, 0.055);
          isolation: isolate;
          transition:
            border-color 180ms ease,
            box-shadow 180ms ease,
            background 180ms ease;
        }

        .neox-system-card:hover {
          border-color: rgba(68, 89, 223, 0.22);
          box-shadow: 0 28px 78px rgba(15, 23, 42, 0.085);
        }

        .neox-system-card h3 {
          margin: 0;
          color: inherit;
          font-size: clamp(1.55rem, 2.25vw, 2.08rem);
          font-weight: 730;
          line-height: 1.05;
          letter-spacing: -0.058em;
          text-wrap: balance;
        }

        .neox-system-card p {
          margin: 0;
          color: rgba(51, 65, 85, 0.78);
          font-size: 15px;
          font-weight: 500;
          line-height: 1.72;
          letter-spacing: -0.018em;
        }

        .neox-card-tag {
          width: fit-content;
          min-height: 30px;
          display: inline-flex;
          align-items: center;
          padding: 0 11px;
          border-radius: 10px;
          border: 1px solid rgba(15, 23, 42, 0.09);
          background: rgba(255, 255, 255, 0.86);
          color: #26368f;
          font-size: 12.5px;
          font-weight: 680;
          letter-spacing: -0.014em;
        }

        .neox-card-media {
          position: relative;
          overflow: hidden;
          background:
            linear-gradient(135deg, rgba(68, 89, 223, 0.07), rgba(255, 255, 255, 0.92)),
            #f5f7fb;
        }

        .neox-card-media::before {
          content: "";
          position: absolute;
          inset: 18px;
          border: 1px dashed rgba(100, 116, 139, 0.22);
          border-radius: inherit;
          pointer-events: none;
        }

        .neox-card-media.has-image::before {
          display: none;
        }

        .neox-card-media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition:
            transform 420ms cubic-bezier(0.2, 0.8, 0.2, 1),
            filter 420ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .neox-system-card--cover {
          justify-content: flex-end;
          min-height: 420px;
          background: #0b1220;
          color: #ffffff;
        }

        .neox-cover-media {
          position: absolute;
          inset: 0;
          z-index: 0;
          border-radius: 0;
          background:
            linear-gradient(135deg, #0c1326 0%, #16204a 52%, #26368f 100%);
        }

        .neox-cover-media::before {
          display: none;
        }

        .neox-cover-overlay {
          position: absolute;
          inset: 0;
          z-index: 1;
          background:
            linear-gradient(180deg, rgba(8, 13, 25, 0.12) 0%, rgba(8, 13, 25, 0.58) 54%, rgba(8, 13, 25, 0.9) 100%);
          transition: background 260ms ease;
        }

        .neox-cover-content {
          position: relative;
          z-index: 3;
          display: grid;
          gap: 16px;
          padding: 110px 30px 30px;
          transition:
            opacity 220ms ease,
            filter 260ms ease,
            transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .neox-cover-content p {
          color: rgba(255, 255, 255, 0.74);
        }

        .neox-cover-action {
          position: absolute;
          inset: 0;
          z-index: 5;
          display: grid;
          place-items: center;
          opacity: 0;
          pointer-events: none;
          transform: translateY(8px) scale(0.98);
          transition:
            opacity 220ms ease,
            transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .neox-cover-action span {
          min-height: 50px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 22px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.94);
          color: #07111f;
          font-size: 14px;
          font-weight: 730;
          letter-spacing: -0.018em;
          box-shadow: 0 18px 44px rgba(0, 0, 0, 0.22);
        }

        .neox-system-card--cover:hover .neox-cover-media img {
          transform: scale(1.07);
          filter: blur(7px) brightness(0.62);
        }

        .neox-system-card--cover:hover .neox-cover-overlay {
          background: rgba(8, 13, 25, 0.62);
        }

        .neox-system-card--cover:hover .neox-cover-content {
          opacity: 0.28;
          filter: blur(3px);
          transform: scale(0.985);
        }

        .neox-system-card--cover:hover .neox-cover-action {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        .neox-system-card--split {
          display: grid;
          grid-template-rows: minmax(170px, 0.86fr) auto auto;
          background: #ffffff;
        }

        .neox-split-visual {
          padding: 22px 22px 0;
        }

        .neox-split-visual .neox-card-media {
          height: 180px;
          border-radius: 20px;
        }

        .neox-split-content {
          display: grid;
          gap: 15px;
          padding: 26px 30px 18px;
        }

        .neox-split-action {
          min-height: 58px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: auto;
          padding: 0 30px;
          border-top: 1px solid rgba(15, 23, 42, 0.07);
          color: #26368f;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -0.016em;
          transform: translateY(14px);
          opacity: 0;
          transition:
            opacity 220ms ease,
            transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1),
            background 180ms ease;
        }

        .neox-system-card--split:hover .neox-card-media img {
          transform: scale(1.045);
        }

        .neox-system-card--split:hover .neox-split-action {
          opacity: 1;
          transform: translateY(0);
          background: #f8f9fc;
        }

        .neox-system-card--stack {
          padding: 18px;
          background:
            linear-gradient(180deg, #ffffff 0%, #f8f9fc 100%);
        }

        .neox-stack-media-wrap {
          height: 190px;
          border-radius: 22px;
          overflow: hidden;
        }

        .neox-stack-media-wrap .neox-card-media {
          width: 100%;
          height: 100%;
          border-radius: 22px;
        }

        .neox-stack-panel {
          position: relative;
          z-index: 2;
          display: grid;
          gap: 15px;
          margin-top: -28px;
          padding: 26px 24px 22px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.92);
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.06);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          transition:
            transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1),
            border-color 180ms ease,
            box-shadow 180ms ease;
        }

        .neox-stack-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-top: 6px;
          color: #26368f;
          font-size: 14px;
          font-weight: 720;
          letter-spacing: -0.016em;
        }

        .neox-stack-arrow {
          width: 34px;
          height: 34px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: rgba(68, 89, 223, 0.08);
          transition:
            transform 180ms ease,
            background 180ms ease;
        }

        .neox-system-card--stack:hover .neox-card-media img {
          transform: scale(1.045);
        }

        .neox-system-card--stack:hover .neox-stack-panel {
          transform: translateY(-5px);
          border-color: rgba(68, 89, 223, 0.18);
          box-shadow: 0 24px 56px rgba(15, 23, 42, 0.085);
        }

        .neox-system-card--stack:hover .neox-stack-arrow {
          transform: translateX(3px);
          background: rgba(68, 89, 223, 0.12);
        }

        @media (max-width: 1100px) {
          .neox-hero-title {
            max-width: 860px;
            font-size: clamp(2.75rem, 6vw, 4.6rem);
          }

          .neox-card-section-head {
            grid-template-columns: 1fr;
            gap: 18px;
          }

          .neox-card-grid {
            grid-template-columns: 1fr;
          }

          .neox-system-card {
            min-height: 360px;
          }
        }

        @media (max-width: 900px) {
          .neox-home-hero {
            height: auto;
            min-height: calc(100svh - var(--nx-header-h, 64px));
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
        }

        @media (max-width: 640px) {
          .neox-card-section {
            padding: 70px 0 78px;
          }

          .neox-system-card {
            border-radius: 22px;
          }

          .neox-cover-content,
          .neox-split-content {
            padding-left: 24px;
            padding-right: 24px;
          }

          .neox-split-action {
            padding-inline: 24px;
          }
        }

        @media (max-width: 520px) {
          .neox-hero-title {
            font-size: 2.85rem;
            line-height: 1.06;
            letter-spacing: -0.058em;
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
        }
      `}</style>

      <main className="neox-home-page min-h-screen overflow-x-hidden font-sans text-slate-950 antialiased">
        <HomeHero />
        <ServiceCardsSection />
        <ProcessSection />
        <FinalCta />
      </main>
    </>
  );
}