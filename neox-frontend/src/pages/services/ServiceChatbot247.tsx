import { Link, useParams } from "react-router-dom";
import { Helmet } from "@vuer-ai/react-helmet-async";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { DEFAULT_LANG, LANGS, type Lang } from "../../i18n/lang";

type CapabilityItem = {
  number: string;
  title: string;
  text: string;
};

type FlowItem = {
  number: string;
  title: string;
  text: string;
};

type ChannelItem = {
  number: string;
  title: string;
  text: string;
};

const capabilityItems: CapabilityItem[] = [
  {
    number: "01",
    title: "Müştərini qarşılayır",
    text: "Saytda və sosial kanallarda gələn ilk mesaj cavabsız qalmır.",
  },
  {
    number: "02",
    title: "Sualı anlayır",
    text: "Müştərinin qiymət, xidmət, görüş və ya dəstək istəyi ayırd edilir.",
  },
  {
    number: "03",
    title: "Düzgün cavab verir",
    text: "Cavablar biznesinizin təsdiqlənmiş məlumatına əsaslanır.",
  },
  {
    number: "04",
    title: "Operatora ötürür",
    text: "Əmin olmadığı və ya insan müdaxiləsi lazım olan halları komandaya yönləndirir.",
  },
];

const flowItems: FlowItem[] = [
  {
    number: "01",
    title: "Mesaj gəlir",
    text: "Müştəri sayt, Instagram və ya başqa kanal üzərindən sual verir.",
  },
  {
    number: "02",
    title: "Niyyət oxunur",
    text: "Sualın satış, məlumat, support və ya operator istəyi olduğu müəyyən edilir.",
  },
  {
    number: "03",
    title: "Cavab seçilir",
    text: "Sistem təsdiqlənmiş məlumatla cavab verir və ya sualı dəqiqləşdirir.",
  },
  {
    number: "04",
    title: "Nəticə saxlanır",
    text: "Lead məlumatı və söhbət nəticəsi komanda üçün aydın formada qalır.",
  },
];

const channelItems: ChannelItem[] = [
  {
    number: "01",
    title: "Website chat",
    text: "Sayta gələn ziyarətçini qarşılayan və əlaqəyə aparan cavab axını.",
  },
  {
    number: "02",
    title: "Instagram DM",
    text: "Sosial mesajlarda FAQ, qiymət və demo istəklərini idarə edən sistem.",
  },
  {
    number: "03",
    title: "WhatsApp keçidi",
    text: "Müştərini boş linkə yox, düzgün kontekstlə davam edən söhbətə yönləndirir.",
  },
  {
    number: "04",
    title: "Operator davamı",
    text: "Botun dayandığı yerdə insan operator söhbəti problemsiz davam etdirir.",
  },
];

const guardrailItems: CapabilityItem[] = [
  {
    number: "01",
    title: "Uydurmur",
    text: "Təsdiqlənməmiş məlumatı biznes həqiqəti kimi demir.",
  },
  {
    number: "02",
    title: "Dayanmağı bilir",
    text: "Əmin olmadığı halda sualı dəqiqləşdirir və ya operatora ötürür.",
  },
  {
    number: "03",
    title: "Brendi qoruyur",
    text: "Cavab dili biznesinizin tonu və təqdimatı ilə uyğun qalır.",
  },
  {
    number: "04",
    title: "Nəticəyə işləyir",
    text: "Məqsəd sadəcə danışmaq yox, müştərini düzgün növbəti addıma aparmaqdır.",
  },
];

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

function CapabilityCard({ item }: { item: CapabilityItem }) {
  return (
    <article className="neox-capability-card">
      <span className="neox-capability-number">{item.number}</span>
      <h3>{item.title}</h3>
      <p>{item.text}</p>
    </article>
  );
}

function FlowCard({ item }: { item: FlowItem }) {
  return (
    <article className="neox-capability-card">
      <span className="neox-capability-number">{item.number}</span>
      <h3>{item.title}</h3>
      <p>{item.text}</p>
    </article>
  );
}

function ChannelCard({ item }: { item: ChannelItem }) {
  return (
    <article className="neox-capability-card">
      <span className="neox-capability-number">{item.number}</span>
      <h3>{item.title}</h3>
      <p>{item.text}</p>
    </article>
  );
}

export default function ServiceChatbot247() {
  const lang = useSafeLang();

  return (
    <>
      <Helmet>
        <title>24/7 Çatbotlar | NEOX</title>
        <meta
          name="description"
          content="NEOX bizneslər üçün sayt, sosial media, lead toplama və operatora ötürmə məntiqi olan 24/7 cavab sistemi qurur."
        />
      </Helmet>

      <main className="nx-page neox-home-extra">
        <section className="nx-section nx-section--soft neox-card-section">
          <div className="nx-container">
            <div className="neox-home-section-head">
              <p className="neox-extra-kicker">NEOX / 24/7 çatbotlar</p>

              <h1 className="neox-home-section-title">
                Cavab sistemləri <span>qururuq.</span>
              </h1>

              <p className="neox-extra-lead">
                Sayt və sosial kanallarda gələn sualları cavabsız qoymayan,
                məlumat toplayan və lazım olanda operatora ötürən sistem.
              </p>
            </div>

            <div className="neox-build-actions">
              <Link
                to={withLang(lang, "/contact")}
                className="nx-button nx-button--primary nx-button--lg"
              >
                Cavab sistemi quraq
                <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
              </Link>

              <Link
                to={withLang(lang, "/services/websites")}
                className="nx-button nx-button--secondary nx-button--lg"
              >
                Website ilə birlikdə bax
              </Link>
            </div>
          </div>
        </section>

        <section className="nx-section nx-section--white">
          <div className="nx-container">
            <div className="neox-home-section-head">
              <p className="neox-extra-kicker">Nə edir?</p>

              <h2 className="neox-home-section-title">
                Sadə bot yox, <span>işləyən cavab axınıdır.</span>
              </h2>

              <p className="neox-extra-lead">
                Sistem müştərini qarşılayır, sualın məqsədini anlayır və onu
                düzgün növbəti addıma aparır.
              </p>
            </div>

            <div className="neox-capability-grid">
              {capabilityItems.map((item) => (
                <CapabilityCard key={item.number} item={item} />
              ))}
            </div>
          </div>
        </section>

        <section className="nx-section nx-section--soft">
          <div className="nx-container">
            <div className="neox-home-section-head">
              <p className="neox-extra-kicker">Axın</p>

              <h2 className="neox-home-section-title">
                Hər mesaj <span>idarə olunan xəttə</span> düşür.
              </h2>

              <p className="neox-extra-lead">
                Mesaj gələndən nəticə saxlanana qədər proses aydın, qısa və
                nəzarətli formada işləyir.
              </p>
            </div>

            <div className="neox-capability-grid">
              {flowItems.map((item) => (
                <FlowCard key={item.number} item={item} />
              ))}
            </div>
          </div>
        </section>

        <section className="nx-section nx-section--white">
          <div className="nx-container">
            <div className="neox-home-section-head">
              <p className="neox-extra-kicker">Kanallar</p>

              <h2 className="neox-home-section-title">
                Müştəri harada yazırsa, <span>sistem orada işləyir.</span>
              </h2>

              <p className="neox-extra-lead">
                Website, Instagram, WhatsApp keçidi və operator davamı eyni
                cavab məntiqinə bağlanır.
              </p>
            </div>

            <div className="neox-capability-grid">
              {channelItems.map((item) => (
                <ChannelCard key={item.number} item={item} />
              ))}
            </div>
          </div>
        </section>

        <section className="nx-section nx-section--soft">
          <div className="nx-container">
            <div className="neox-home-section-head">
              <p className="neox-extra-kicker">Nəzarət</p>

              <h2 className="neox-home-section-title">
                Süni intellekt <span>sərhədlə</span> işləyir.
              </h2>

              <p className="neox-extra-lead">
                Yaxşı cavab sistemi hər şeyi cavablamır. Harada dayanmalı
                olduğunu bilir.
              </p>
            </div>

            <div className="neox-capability-grid">
              {guardrailItems.map((item) => (
                <CapabilityCard key={item.number} item={item} />
              ))}
            </div>
          </div>
        </section>

        <section className="neox-extra-section-three">
          <div className="nx-container">
            <div className="neox-build-band">
              <div className="neox-build-content">
                <p className="neox-extra-kicker">Başlayaq</p>

                <h2 className="neox-build-title">
                  Müştəri suallarını <span>cavab sisteminə</span> çevirək.
                </h2>

                <p className="neox-build-text">
                  Xidmətlərinizi, ən çox verilən sualları və operator
                  qaydalarını götürüb biznesinizə uyğun 24/7 cavab axını quraq.
                </p>

                <div className="neox-build-tags" aria-hidden="true">
                  <span>Website chat</span>
                  <span>Instagram DM</span>
                  <span>Lead toplama</span>
                  <span>Operator handoff</span>
                </div>
              </div>

              <div className="neox-build-actions">
                <Link
                  to={withLang(lang, "/contact")}
                  className="nx-button nx-button--primary nx-button--lg"
                >
                  Əlaqə saxla
                  <Sparkles size={16} strokeWidth={2} aria-hidden="true" />
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
      </main>
    </>
  );
}