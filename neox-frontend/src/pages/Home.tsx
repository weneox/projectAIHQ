import { ArrowUpRight } from "lucide-react";

const HERO_BACKGROUND_URL =
  "https://images.unsplash.com/photo-1497366754035-f200968a6e72?q=80&w=2400&auto=format&fit=crop";

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
              className="neox-strip-item flex h-[82px] items-center whitespace-nowrap text-[13px] font-extrabold uppercase tracking-[0.17em] text-slate-500 transition-colors duration-300 hover:text-[#3347d9]"
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
            className="absolute inset-0 h-full w-full object-cover object-[64%_center] blur-[12px]"
            style={{
              WebkitMaskImage:
                "linear-gradient(90deg, black 0%, black 30%, transparent 58%)",
              maskImage:
                "linear-gradient(90deg, black 0%, black 30%, transparent 58%)",
            }}
          />

          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.99)_0%,rgba(255,255,255,0.93)_39%,rgba(255,255,255,0.56)_70%,rgba(255,255,255,0.18)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0)_44%,rgba(255,255,255,0.08)_100%)]" />
        </div>

        <div className="relative mx-auto flex w-full max-w-[1460px] items-center px-6 pb-8 pt-10 lg:px-10 lg:pb-10 lg:pt-12">
          <div className="max-w-[760px]">
            <h1 className="max-w-[760px] bg-[linear-gradient(112deg,#020617_0%,#020617_58%,#2438b8_100%)] bg-clip-text text-[3.45rem] font-extrabold leading-[1.03] tracking-[-0.074em] text-transparent md:text-[4.55rem] lg:text-[5.05rem]">
              Ağıllı biznes sistemləri qururuq.
            </h1>

            <p className="mt-7 max-w-[620px] text-[1.16rem] font-medium leading-[1.75] tracking-[-0.02em] text-slate-600">
              Veb sayt, mesajlaşma, avtomatlaşdırma və Süni İntellekt
              cavablarını birləşdiririk ki, müştəri axını daha səliqəli,
              sürətli və ölçülə bilən olsun.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a
                href="/az/elaqe"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#3347d9] px-7 text-[16px] font-bold text-white shadow-[0_20px_46px_rgba(51,71,217,0.23)] transition hover:-translate-y-0.5 hover:bg-[#293ac7]"
              >
                Sistemi quraq
                <ArrowUpRight className="h-4 w-4" />
              </a>

              <a
                href="/az/xidmetler"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/92 px-7 text-[16px] font-bold text-slate-950 shadow-sm backdrop-blur-md transition hover:-translate-y-0.5 hover:border-slate-300"
              >
                Xidmətlərə bax
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <SystemStrip />
    </section>
  );
}

function ValueSection() {
  return (
    <section className="bg-white py-16 lg:py-20">
      <div className="mx-auto max-w-[1460px] px-6 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-3">
          {valueCards.map((card) => (
            <article
              key={card.title}
              className="group rounded-[30px] border border-slate-200 bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.045)] transition hover:-translate-y-1 hover:shadow-[0_28px_78px_rgba(15,23,42,0.075)]"
            >
              <h3 className="text-[1.7rem] font-bold tracking-[-0.055em] text-slate-950">
                {card.title}
              </h3>

              <p className="mt-5 max-w-[390px] text-[1.02rem] font-medium leading-8 text-slate-600">
                {card.text}
              </p>

              <a
                href="/az/xidmetler"
                className="mt-8 inline-flex items-center gap-2 text-[15px] font-bold text-[#3347d9]"
              >
                Daha ətraflı
                <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
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
            <div className="mb-5 text-[12px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Proses
            </div>

            <h2 className="max-w-[690px] text-[3.8rem] font-bold leading-[1.04] tracking-[-0.075em] text-slate-950">
              Sadə başlayırıq, sistemli böyüdürük.
            </h2>
          </div>

          <p className="max-w-[660px] text-[1.12rem] font-medium leading-9 text-slate-600 lg:justify-self-end">
            Məqsəd çox ekran, çox panel və qarışıq quruluş deyil. Lazım olan iş
            axınını tapırıq, onu təmiz interfeys və avtomatlaşdırma ilə işlək
            hala gətiririk.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {processSteps.map((step) => (
            <article
              key={step.number}
              className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm"
            >
              <div className="mb-7 inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-2 text-[14px] font-bold text-slate-500">
                {step.number}
              </div>

              <h3 className="text-[1.35rem] font-bold tracking-[-0.04em] text-slate-950">
                {step.title}
              </h3>

              <p className="mt-4 text-[1rem] font-medium leading-8 text-slate-600">
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
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-[1460px] px-6 lg:px-10">
        <div className="rounded-[38px] border border-slate-200 bg-[#f8f9fc] p-8 shadow-[0_30px_100px_rgba(15,23,42,0.075)] md:p-12 lg:p-14">
          <div className="grid gap-10 lg:grid-cols-[1fr_0.72fr] lg:items-center">
            <div>
              <div className="mb-5 inline-flex rounded-full border border-[#3347d9]/16 bg-white px-5 py-2 text-[13px] font-bold text-[#3347d9]">
                Başlamaq üçün
              </div>

              <h2 className="max-w-[760px] text-[3.35rem] font-bold leading-[1.04] tracking-[-0.075em] text-slate-950">
                Biznesinizə uyğun sistemi birlikdə quraq.
              </h2>

              <p className="mt-6 max-w-[720px] text-[1.12rem] font-medium leading-9 text-slate-600">
                Bir neçə əsas məlumat kifayətdir: nə satırsınız, müştəri haradan
                yazır və hazırda hansı işlər sizi yavaşladır.
              </p>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white px-5 py-5">
                <div>
                  <div className="text-[1.05rem] font-bold text-slate-950">
                    İlk addım
                  </div>

                  <div className="mt-2 text-[14px] font-medium leading-6 text-slate-500">
                    Qısa danışıqla sistem xəritəsini və ilk icra istiqamətini
                    müəyyən edirik.
                  </div>
                </div>

                <div className="shrink-0 rounded-full border border-slate-200 px-4 py-2 text-[13px] font-bold text-slate-500">
                  15 dəq
                </div>
              </div>

              <a
                href="/az/elaqe"
                className="mt-5 inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#3347d9] text-[16px] font-bold text-white shadow-[0_18px_42px_rgba(51,71,217,0.22)] transition hover:-translate-y-0.5 hover:bg-[#293ac7]"
              >
                Əlaqə saxla
                <ArrowUpRight className="h-4 w-4" />
              </a>
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

        .neox-home-strip {
          animation: neoxHomeStrip 38s linear infinite;
        }

        .neox-home-strip:hover {
          animation-play-state: paused;
        }

        .neox-strip-item:hover {
          color: #3347d9;
        }

        @media (max-width: 900px) {
          .neox-home-hero {
            height: auto;
            min-height: calc(100svh - var(--nx-header-h, 64px));
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