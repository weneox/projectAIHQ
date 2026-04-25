// src/pages/usecases/UseCasesIndex.tsx
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  Building2,
  CheckCircle2,
  Hotel,
  Landmark,
  MessageSquareText,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  Truck,
  Workflow,
} from "lucide-react";
import { DEFAULT_LANG, LANGS, type Lang } from "../../i18n/lang";

function isLang(value: string | undefined | null): value is Lang {
  if (!value) return false;
  return (LANGS as readonly string[]).includes(value);
}

function useLocalizedPath() {
  const { lang: paramLang } = useParams<{ lang?: string }>();
  const lang = isLang(paramLang) ? paramLang : DEFAULT_LANG;

  return (path: string) => {
    if (path === "/") return `/${lang}`;
    return `/${lang}${path.startsWith("/") ? path : `/${path}`}`;
  };
}

type UseCase = {
  title: string;
  desc: string;
  to: string;
  tag: string;
  icon: typeof Stethoscope;
  points: string[];
};

type Result = {
  value: string;
  label: string;
};

const useCases: UseCase[] = [
  {
    title: "Klinikalar",
    desc: "Görüş, qiymət, xidmət sualları və pasiyent mesajları üçün cavab və yönləndirmə sistemi.",
    to: "/use-cases/healthcare",
    tag: "Healthcare",
    icon: Stethoscope,
    points: ["Appointment axını", "FAQ cavabları", "Operatora ötürmə"],
  },
  {
    title: "Logistika",
    desc: "Status, çatdırılma, gecikmə və müştəri məlumatlandırması üçün daha səliqəli mesaj axını.",
    to: "/use-cases/logistics",
    tag: "Logistics",
    icon: Truck,
    points: ["Status sorğuları", "Bildirişlər", "Yönləndirmə"],
  },
  {
    title: "Maliyyə",
    desc: "Sorğu, sənəd, müraciət və uyğun komanda yönləndirməsi üçün kontrollu cavab sistemi.",
    to: "/use-cases/finance",
    tag: "Finance",
    icon: Landmark,
    points: ["Müraciət axını", "Sənəd sorğuları", "Riskli hallarda handoff"],
  },
  {
    title: "Retail və mağazalar",
    desc: "Qiymət, stok, çatdırılma və sifariş suallarını daha sürətli cavablandırmaq üçün sistem.",
    to: "/use-cases/retail",
    tag: "Retail",
    icon: ShoppingBag,
    points: ["Stok sualları", "Sifariş axını", "Lead toplama"],
  },
  {
    title: "Hotel və resortlar",
    desc: "Rezervasiya, otaq, qiymət və xidmət sualları üçün premium cavab və yönləndirmə axını.",
    to: "/use-cases/hotels",
    tag: "Hospitality",
    icon: Hotel,
    points: ["Rezervasiya", "Xidmət məlumatı", "Çoxdilli sorğular"],
  },
];

const results: Result[] = [
  { value: "24/7", label: "müştəri cavab rejimi" },
  { value: "1", label: "vahid mesaj axını" },
  { value: "↓", label: "manual iş yükü" },
];

const workflow = [
  {
    title: "Sorğu gəlir",
    desc: "Müştəri Instagram, sayt, WhatsApp və ya formadan yazır.",
    icon: MessageSquareText,
  },
  {
    title: "Niyyət anlaşılır",
    desc: "Qiymət, görüş, sifariş, status və ya dəstək sorğusu ayrılır.",
    icon: Workflow,
  },
  {
    title: "Düzgün cavab və ya handoff",
    desc: "Sadə sual cavablanır, riskli və satışa yaxın hal operatora ötürülür.",
    icon: ShieldCheck,
  },
  {
    title: "Lead itmir",
    desc: "Müştəri məlumatı və maraqlandığı mövzu komanda üçün görünən olur.",
    icon: PackageCheck,
  },
];

function UseCaseCard({ item }: { item: UseCase }) {
  const withLang = useLocalizedPath();
  const Icon = item.icon;

  return (
    <Link to={withLang(item.to)} className="nx-card nx-card--link nx-usecase-card">
      <div className="nx-row nx-row--top">
        <span className="nx-badge nx-badge--soft nx-badge--plain">
          <Icon size={16} strokeWidth={2} aria-hidden="true" />
        </span>

        <span className="nx-badge nx-badge--plain">{item.tag}</span>
      </div>

      <div className="nx-stack-sm">
        <div className="nx-stack-xs">
          <h2 className="nx-h3">{item.title}</h2>
          <p className="nx-copy-sm">{item.desc}</p>
        </div>

        <ul className="nx-list">
          {item.points.map((point) => (
            <li key={point} className="nx-list-item">
              {point}
            </li>
          ))}
        </ul>
      </div>

      <div className="nx-card-footer">
        <span className="nx-link">
          Ssenariyə bax
          <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

function WorkflowCard({ item }: { item: (typeof workflow)[number] }) {
  const Icon = item.icon;

  return (
    <article className="nx-card nx-card--compact nx-card--quiet">
      <div className="nx-stack-sm">
        <span className="nx-badge nx-badge--soft nx-badge--plain">
          <Icon size={16} strokeWidth={2} aria-hidden="true" />
        </span>

        <div className="nx-stack-xs">
          <h3 className="nx-h4">{item.title}</h3>
          <p className="nx-copy-sm">{item.desc}</p>
        </div>
      </div>
    </article>
  );
}

function UseCasesPreview() {
  return (
    <div className="nx-hero-panel">
      <div className="nx-hero-panel-inner">
        <div className="nx-stack-lg">
          <div className="nx-row nx-row--top">
            <div className="nx-stack-xs">
              <span className="nx-badge nx-badge--soft">
                <Building2 size={15} strokeWidth={2} aria-hidden="true" />
                Sektor xəritəsi
              </span>
              <h2 className="nx-h3">Eyni sistem, fərqli biznes reallığı.</h2>
            </div>

            <Sparkles size={20} strokeWidth={1.9} color="var(--nx-accent)" aria-hidden="true" />
          </div>

          <div className="nx-grid nx-grid--3">
            {results.map((item) => (
              <div key={item.label} className="nx-surface nx-surface--flat nx-surface-pad">
                <div className="nx-metric">
                  <span className="nx-metric-value">{item.value}</span>
                  <span className="nx-metric-label">{item.label}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="nx-grid">
            {["Kanal seçilir", "Cavab qaydası qurulur", "Operator axını saxlanılır"].map((item) => (
              <div key={item} className="nx-row">
                <span className="nx-list-item">{item}</span>
                <CheckCircle2 size={18} strokeWidth={2} color="var(--nx-success)" aria-hidden="true" />
              </div>
            ))}
          </div>

          <p className="nx-copy-sm">
            Klinikada görüş, mağazada stok, hoteldə rezervasiya — məntiq fərqlidir, sistem dili eyni qalır.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function UseCasesIndex() {
  const withLang = useLocalizedPath();

  return (
    <main className="nx-page">
      <section className="nx-hero">
        <div className="nx-container">
          <div className="nx-hero-grid">
            <div className="nx-hero-copy">
              <p className="nx-kicker">NEOX / İstifadə sahələri</p>

              <div className="nx-stack">
                <h1 className="nx-display">
                  Hər sahə üçün <span className="nx-gradient-text">fərqli iş axını</span>, eyni premium sistem.
                </h1>

                <p className="nx-lead nx-max-copy">
                  NEOX-un işi hazır şablonu hər biznesə yapışdırmaq deyil. Sektorun real müştəri suallarını,
                  satış yolunu və komanda işini anlayıb ona uyğun sistem qururuq.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Öz sahəmi danışım
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/services/chatbot-24-7")} className="nx-button">
                  Xidmətlərə bax
                </Link>
              </div>

              <div className="nx-chip-row">
                <span className="nx-chip">Klinika</span>
                <span className="nx-chip">Retail</span>
                <span className="nx-chip">Hotel</span>
                <span className="nx-chip">Logistika</span>
              </div>
            </div>

            <div className="nx-hero-visual">
              <UseCasesPreview />
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--tight">
        <div className="nx-container">
          <div className="nx-stack-xl">
            <div className="nx-row nx-row--top">
              <div className="nx-stack-sm nx-max-copy">
                <p className="nx-kicker">Ssenarilər</p>
                <h2 className="nx-title-sm">Ən çox uyğunlaşan biznes sahələri.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Bu nümunələr başlanğıc üçündür. Sizin sahə burada yoxdursa belə, prosesiniz varsa,
                sistem qurmaq mümkündür.
              </p>
            </div>

            <div className="nx-grid nx-grid--3">
              {useCases.map((item) => (
                <UseCaseCard key={item.title} item={item} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section">
        <div className="nx-container">
          <div className="nx-split nx-split--top">
            <div className="nx-stack-lg">
              <div className="nx-stack">
                <p className="nx-kicker">Ortaq məntiq</p>
                <h2 className="nx-title">Sektor dəyişir, amma sistemin əsası eyni qalır.</h2>
                <p className="nx-lead">
                  Müştəri yazır, sistem niyyəti anlayır, uyğun cavab və ya yönləndirmə edir,
                  lead isə komanda üçün görünən olur. Fərq sadəcə biznes qaydalarında və cavab mətnlərindədir.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/resources/guides")} className="nx-button">
                  Bələdçilərə bax
                </Link>

                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Sistem xəritəsi çıxaraq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="nx-grid nx-grid--2">
              {workflow.map((item) => (
                <WorkflowCard key={item.title} item={item} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section-divider">
        <div className="nx-container">
          <div className="nx-surface nx-surface--raised nx-surface-pad">
            <div className="nx-split">
              <div className="nx-stack">
                <span className="nx-badge nx-badge--soft">
                  <Sparkles size={15} strokeWidth={2} aria-hidden="true" />
                  Fərdi yanaşma
                </span>

                <h2 className="nx-title-sm">Sizin biznesiniz üçün ssenarini ayrıca quraq.</h2>

                <p className="nx-lead">
                  Eyni platforma hər sahəyə eyni cavab verməməlidir. Klinikada pasiyent dili,
                  mağazada satış dili, hoteldə rezervasiya dili lazımdır.
                </p>
              </div>

              <div className="nx-grid">
                <div className="nx-card nx-card--compact nx-card--quiet">
                  <div className="nx-stack-xs">
                    <h3 className="nx-h4">Əvvəl biznes dili</h3>
                    <p className="nx-copy-sm">
                      Müştərinin necə yazdığını və komandaya hansı məlumatın lazım olduğunu müəyyən edirik.
                    </p>
                  </div>
                </div>

                <div className="nx-card nx-card--compact nx-card--quiet">
                  <div className="nx-stack-xs">
                    <h3 className="nx-h4">Sonra sistem axını</h3>
                    <p className="nx-copy-sm">
                      Cavab, yönləndirmə, lead və operator qaydalarını vahid iş səthinə salırıq.
                    </p>
                  </div>
                </div>

                <Link to={withLang("/contact")} className="nx-button nx-button--primary nx-button--full">
                  Öz sahəmi izah edim
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--last nx-section-divider">
        <div className="nx-container">
          <div className="nx-stack-lg nx-text-center" style={{ maxWidth: 820, margin: "0 auto" }}>
            <p className="nx-kicker" style={{ marginInline: "auto" }}>
              Başlayaq
            </p>

            <h2 className="nx-title-sm">Sahəniz nə olursa olsun, axını sadələşdirmək mümkündür.</h2>

            <p className="nx-lead">
              Biznesinizi qısa izah edin, sizin sektor üçün hansı cavab, veb və avtomatlaşdırma sisteminin
              uyğun olduğunu çıxaraq.
            </p>

            <div className="nx-actions nx-actions--center">
              <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                Əlaqə saxla
                <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
              </Link>

              <Link to={withLang("/pricing")} className="nx-button">
                Qiymət məntiqi
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}