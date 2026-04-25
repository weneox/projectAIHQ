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

const valueCards = [
  {
    title: "Veb sistemi qurur",
    text: "Brendə uyğun, sürətli və satış yönümlü veb səhifələri biznes axını ilə birlikdə hazırlayırıq.",
  },
  {
    title: "Mesajları idarə edir",
    text: "Instagram, sayt, WhatsApp və digər kanallardan gələn sorğuları vahid sistemə gətiririk.",
  },
  {
    title: "İş axınını avtomatlaşdırır",
    text: "Cavab, yönləndirmə, lead izləmə və komanda proseslərini daha səliqəli hala salırıq.",
  },
];

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
              className="neox-strip-item flex h-[82px] items-center whitespace-nowrap text-[13px] font-extrabold uppercase tracking-[0.17em] text-slate-500 transition-colors duration-300 hover:text-slate-800"
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
            className="h-full w-full object-cover object-[64%_center]"
          />

          <img
            src={HERO_BACKGROUND_URL}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[64%_center] blur-[10px]"
            style={{
              WebkitMaskImage:
                "linear-gradient(90deg, black 0%, black 27%, transparent 55%)",
              maskImage:
                "linear-gradient(90deg, black 0%, black 27%, transparent 55%)",
            }}
          />

          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.995)_0%,rgba(255,255,255,0.965)_36%,rgba(255,255,255,0.74)_62%,rgba(255,255,255,0.22)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_42%,rgba(255,255,255,0.62)_0%,rgba(255,255,255,0.28)_32%,rgba(255,255,255,0)_60%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18)_0%,rgba(255,255,255,0)_46%,rgba(255,255,255,0.1)_100%)]" />
        </div>

        <div className="relative mx-auto flex w-full max-w-[1460px] items-center px-6 pb-8 pt-10 lg:px-10 lg:pb-10 lg:pt-12">
          <div className="max-w-[760px]">
            <h1 className="neox-hero-title max-w-[790px] text-[#070a18]">
              Ağıllı biznes sistemləri qururuq.
            </h1>

            <p className="mt-7 max-w-[650px] text-[1.08rem] font-[520] leading-[1.78] tracking-[-0.018em] text-slate-600 md:text-[1.14rem]">
              Veb sayt, mesajlaşma, avtomatlaşdırma və Süni İntellekt
              cavablarını birləşdiririk ki, müştəri axını daha səliqəli,
              sürətli və ölçülə bilən olsun.
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

function ValueSection() {
  const lang = useSafeLang();

  return (
    <section className="bg-white py-16 lg:py-20">
      <div className="mx-auto max-w-[1460px] px-6 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-3">
          {valueCards.map((card) => (
            <article
              key={card.title}
              className="group rounded-[28px] border border-slate-200/90 bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.045)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_28px_78px_rgba(15,23,42,0.075)]"
            >
              <h3 className="text-[1.55rem] font-[720] tracking-[-0.048em] text-slate-950">
                {card.title}
              </h3>

              <p className="mt-5 max-w-[390px] text-[1rem] font-[500] leading-8 text-slate-600">
                {card.text}
              </p>

              <Link
                to={withLang(lang, "/services")}
                className="nx-link mt-8"
              >
                Daha ətraflı
              </Link>
            </article>
          ))}
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

        .neox-hero-title {
          font-size: clamp(3.2rem, 5.3vw, 6rem);
          font-weight: 700;
          line-height: 1.015;
          letter-spacing: -0.066em;
          text-wrap: balance;
        }

        .neox-home-strip {
          animation: neoxHomeStrip 38s linear infinite;
        }

        .neox-home-strip:hover {
          animation-play-state: paused;
        }

        .neox-strip-item:hover {
          color: #1f2937;
        }

        @media (max-width: 900px) {
          .neox-home-hero {
            height: auto;
            min-height: calc(100svh - var(--nx-header-h, 64px));
          }

          .neox-hero-title {
            font-size: clamp(3rem, 12vw, 4.7rem);
            letter-spacing: -0.068em;
          }
        }

        @media (max-width: 520px) {
          .neox-hero-title {
            font-size: 3.1rem;
            line-height: 1.04;
            letter-spacing: -0.062em;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .neox-home-strip {
            animation: none;
          }
        }
      `}</style>

      <main className="neox-home-page min-h-screen overflow-x-hidden font-sans text-slate-950 antialiased">
        <HomeHero />
        <ValueSection />
        <ProcessSection />
        <FinalCta />
      </main>
    </>
  );
}