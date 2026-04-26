// src/pages/design-lab/CardLab.tsx
import { Link, useParams } from "react-router-dom";
import { DEFAULT_LANG, LANGS, type Lang } from "../../i18n/lang";

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

const cards = [
  {
    eyebrow: "01",
    title: "Veb sistemləri",
    text: "Sayt sadəcə görünüş yox, biznesin əsas giriş səthidir.",
    pattern: "web",
  },
  {
    eyebrow: "02",
    title: "Brend görünüşü",
    text: "Logo, rəng, tipografiya və vizual üslub vahid sistemə çevrilir.",
    pattern: "brand",
  },
  {
    eyebrow: "03",
    title: "Kontent axını",
    text: "İdeyadan paylaşıma qədər kontent prosesi ardıcıl qurulur.",
    pattern: "content",
  },
  {
    eyebrow: "04",
    title: "Satış axını",
    text: "Müraciət, cavab, yönləndirmə və follow-up bir xəttə salınır.",
    pattern: "sales",
  },
  {
    eyebrow: "05",
    title: "İş axını",
    text: "Təkrar manual işlər avtomatik proseslərlə əvəz olunur.",
    pattern: "workflow",
  },
  {
    eyebrow: "06",
    title: "Süni İntellekt",
    text: "Çatbot, səsli assistant və cavab sistemi nəzarətli işləyir.",
    pattern: "ai",
  },
];

function CardLab() {
  const lang = useSafeLang();

  return (
    <main className="nx-page">
      <section className="nx-section neox-card-lab-page">
        <div className="nx-container">
          <div className="neox-lab-head">
            <p className="nx-kicker">Design lab</p>

            <h1 className="nx-section-title neox-balanced-section-title">
              Yeni kart sistemini <span>canlı yoxlayaq.</span>
            </h1>

            <p className="nx-section-lead">
              Iconsuz, daha təmiz, daha sistem hissi verən premium kart dili.
              Bəyənsək bunu digər səhifələrə də daşıyırıq.
            </p>
          </div>

          <div className="neox-orbit-card-grid">
            {cards.map((card) => (
              <article
                key={card.title}
                className="neox-orbit-card"
                data-pattern={card.pattern}
              >
                <div className="neox-orbit-card-glow" />

                <div className="neox-orbit-card-top">
                  <span className="neox-orbit-card-index">{card.eyebrow}</span>

                  <span className="neox-system-mark" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                </div>

                <div className="neox-orbit-card-body">
                  <h2>{card.title}</h2>
                  <p>{card.text}</p>
                </div>

                <div className="neox-orbit-card-bottom">
                  <span>Sistemə qoşulur</span>
                  <span className="neox-card-arrow" aria-hidden="true">
                    ↗
                  </span>
                </div>
              </article>
            ))}
          </div>

          <div className="neox-lab-actions">
            <Link
              to={withLang(lang, "/")}
              className="nx-button nx-button--secondary nx-button--lg"
            >
              Home-a qayıt
            </Link>

            <Link
              to={withLang(lang, "/contact")}
              className="nx-button nx-button--primary nx-button--lg"
            >
              Sistemi quraq
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default CardLab;