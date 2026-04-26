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

type SceneKind = "web" | "brand" | "content" | "sales" | "workflow" | "ai";

type SceneCard = {
  number: string;
  kind: SceneKind;
  title: string;
  text: string;
  tag: string;
  imageUrl: string;
  videoUrl?: string;
};

const scenes: SceneCard[] = [
  {
    number: "01",
    kind: "web",
    title: "Veb sistemləri",
    text: "Biznesin əsas giriş səthi. Sadəcə sayt yox, mesajı, etibarı və müraciəti daşıyan sistem.",
    tag: "Digital surface",
    imageUrl:
      "https://res.cloudinary.com/dppoomunj/image/upload/v1777157607/ChatGPT_Image_Apr_26_2026_02_52_52_AM_k5ua6g.webp",
  },
  {
    number: "02",
    kind: "brand",
    title: "Brend görünüşü",
    text: "Logo, rəng, tipografiya və vizual dil bir-birinə bağlı premium görünüşə çevrilir.",
    tag: "Visual identity",
    imageUrl:
      "https://res.cloudinary.com/dppoomunj/image/upload/v1777157819/cdc46192-1199-4157-9005-df6655aec353_nl1lmz.webp",
  },
  {
    number: "03",
    kind: "content",
    title: "Kontent axını",
    text: "İdeyadan paylaşıma qədər kontent artıq təsadüfi yox, sistemli axın kimi işləyir.",
    tag: "Content engine",
    imageUrl:
      "https://res.cloudinary.com/dppoomunj/image/upload/v1777157728/7980da92-7475-4408-9c82-3fa23b913176_cyoxq8.webp",
  },
  {
    number: "04",
    kind: "sales",
    title: "Satış axını",
    text: "Müraciət gəlir, cavablanır, yönləndirilir və itmir. Satış yolu daha aydın olur.",
    tag: "Lead path",
    imageUrl:
      "https://res.cloudinary.com/dppoomunj/image/upload/v1777157761/857c6bd2-374e-4ca1-85e3-3f62ea93a5a4_itzbj8.webp",
  },
  {
    number: "05",
    kind: "workflow",
    title: "İş axını",
    text: "Təkrar manual addımlar avtomatik prosesə çevrilir. Komanda daha az qarışıqlıqla işləyir.",
    tag: "Operations flow",
    imageUrl:
      "https://res.cloudinary.com/dppoomunj/image/upload/v1777157641/5d7f54df-d9ff-4af8-8816-961fdfd809a9_vquktq.webp",
  },
  {
    number: "06",
    kind: "ai",
    title: "Süni İntellekt",
    text: "Çatbot, səsli assistant və cavab sistemi nəzarətli bilik bazası ilə işləyir.",
    tag: "AI response layer",
    imageUrl:
      "https://res.cloudinary.com/dppoomunj/image/upload/v1777157688/f08b0651-fcd9-4134-b27e-681e2cc2af04_v6e5q8.webp",
    videoUrl:
      "https://res.cloudinary.com/dppoomunj/video/upload/v1777159382/9150545-hd_1920_1080_24fps_xw2ces.mov",
  },
];

function SceneGlyph({ kind }: { kind: SceneKind }) {
  return (
    <svg
      className="neox-scene-glyph"
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
    >
      <circle className="neox-glyph-orbit" cx="60" cy="60" r="42" />
      <circle className="neox-glyph-orbit neox-glyph-orbit--soft" cx="60" cy="60" r="27" />

      {kind === "web" ? (
        <>
          <rect className="neox-glyph-line" x="31" y="39" width="58" height="42" rx="8" />
          <path className="neox-glyph-line" d="M31 51H89" />
          <path className="neox-glyph-line" d="M43 65H67" />
          <path className="neox-glyph-line" d="M43 73H77" />
        </>
      ) : null}

      {kind === "brand" ? (
        <>
          <path className="neox-glyph-line" d="M37 75L60 32L83 75" />
          <path className="neox-glyph-line" d="M47 60H73" />
          <circle className="neox-glyph-dot" cx="60" cy="83" r="4" />
        </>
      ) : null}

      {kind === "content" ? (
        <>
          <path className="neox-glyph-line" d="M38 42H82" />
          <path className="neox-glyph-line" d="M38 58H74" />
          <path className="neox-glyph-line" d="M38 74H86" />
          <circle className="neox-glyph-dot" cx="86" cy="42" r="4" />
          <circle className="neox-glyph-dot" cx="78" cy="58" r="4" />
        </>
      ) : null}

      {kind === "sales" ? (
        <>
          <path className="neox-glyph-line" d="M33 76C48 40 67 86 87 42" />
          <circle className="neox-glyph-dot" cx="33" cy="76" r="4" />
          <circle className="neox-glyph-dot" cx="60" cy="61" r="4" />
          <circle className="neox-glyph-dot" cx="87" cy="42" r="4" />
        </>
      ) : null}

      {kind === "workflow" ? (
        <>
          <rect className="neox-glyph-line" x="31" y="34" width="22" height="22" rx="6" />
          <rect className="neox-glyph-line" x="67" y="34" width="22" height="22" rx="6" />
          <rect className="neox-glyph-line" x="49" y="70" width="22" height="22" rx="6" />
          <path className="neox-glyph-line" d="M53 45H67" />
          <path className="neox-glyph-line" d="M60 56V70" />
        </>
      ) : null}

      {kind === "ai" ? (
        <>
          <path className="neox-glyph-line" d="M39 67C39 52 48 42 60 42C72 42 81 52 81 67" />
          <path className="neox-glyph-line" d="M47 72H73" />
          <circle className="neox-glyph-dot" cx="50" cy="61" r="4" />
          <circle className="neox-glyph-dot" cx="70" cy="61" r="4" />
          <path className="neox-glyph-line" d="M60 42V30" />
          <circle className="neox-glyph-dot" cx="60" cy="27" r="3" />
        </>
      ) : null}
    </svg>
  );
}

function SceneTile({ scene, featured = false }: { scene: SceneCard; featured?: boolean }) {
  return (
    <article
      className={`neox-scene-card ${featured ? "neox-scene-card--featured" : ""}`}
      data-kind={scene.kind}
    >
      <div className="neox-scene-media" aria-hidden="true">
        {scene.videoUrl ? (
          <video
            src={scene.videoUrl}
            poster={scene.imageUrl}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
        ) : (
          <img src={scene.imageUrl} alt="" loading="lazy" decoding="async" />
        )}
      </div>

      <div className="neox-scene-shade" />

      <div className="neox-scene-top">
        <span>{scene.number}</span>
        <span>{scene.tag}</span>
      </div>

      <div className="neox-scene-mark">
        <SceneGlyph kind={scene.kind} />
      </div>

      <div className="neox-scene-content">
        <h2>{scene.title}</h2>
        <p>{scene.text}</p>
      </div>

      <div className="neox-scene-bottom">
        <span>Sistem qatına bax</span>
        <span aria-hidden="true">↗</span>
      </div>
    </article>
  );
}

function CardLab() {
  const lang = useSafeLang();

  return (
    <main className="nx-page neox-scene-lab-page">
      <section className="neox-scene-lab">
        <div className="nx-container">
          <div className="neox-scene-lab-head">
            <p className="nx-kicker">Design lab</p>

            <h1>
              Kart yox, <span>xidmət səhnələri.</span>
            </h1>

            <p>
              Hər xidmət ayrı qutu kimi yox, NEOX sisteminin bir qatını göstərən
              cinematic vizual səhnə kimi işləyir.
            </p>
          </div>

          <div className="neox-scene-grid">
            {scenes.map((scene, index) => (
              <SceneTile key={scene.title} scene={scene} featured={index === 0 || index === 5} />
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