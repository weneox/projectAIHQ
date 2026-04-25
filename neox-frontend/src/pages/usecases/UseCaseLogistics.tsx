// src/pages/usecases/UseCaseLogistics.tsx
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  BellRing,
  Bot,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageSquareText,
  PackageCheck,
  Route,
  ShieldCheck,
  Sparkles,
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

type IconType = typeof Truck;

type CardItem = {
  title: string;
  desc: string;
  icon: IconType;
};

type FlowStep = {
  number: string;
  title: string;
  desc: string;
};

const painPoints: CardItem[] = [
  {
    title: "Status sualları təkrarlanır",
    desc: "Müştərilər çatdırılma haradadır, nə vaxt gələcək, gecikmə varmı kimi eyni sualları verir.",
    icon: MessageSquareText,
  },
  {
    title: "Komanda çox cavab yazır",
    desc: "Operatorlar hər status sorğusuna manual cavab verdikcə əsas əməliyyat işi yavaşlayır.",
    icon: Clock3,
  },
  {
    title: "Gecikmə məlumatı dağınıq qalır",
    desc: "Gecikmə, ünvan dəqiqləşməsi və çatdırılma dəyişiklikləri vahid axında görünmür.",
    icon: MapPin,
  },
];

const solutions: CardItem[] = [
  {
    title: "Avtomatik status cavabları",
    desc: "Müştəri sorğusu status, çatdırılma vaxtı və ünvan dəqiqləşməsi kimi kateqoriyalara ayrılır.",
    icon: PackageCheck,
  },
  {
    title: "Bildiriş və yönləndirmə",
    desc: "Gecikmə, operator ehtiyacı və problemli çatdırılma halları komandaya ötürülür.",
    icon: BellRing,
  },
  {
    title: "Müştəri məlumatı səliqəli qalır",
    desc: "Ad, telefon, sifariş nömrəsi və problem tipi eyni axında saxlanılır.",
    icon: Workflow,
  },
  {
    title: "Riskli hallar insana keçir",
    desc: "Şikayət, itmiş bağlama və xüsusi hal kimi məsələlər avtomatik bağlanmır, operatora ötürülür.",
    icon: ShieldCheck,
  },
];

const flow: FlowStep[] = [
  {
    number: "01",
    title: "Müştəri status soruşur",
    desc: "Sorğu Instagram, WhatsApp, sayt forması və ya digər kanaldan gəlir.",
  },
  {
    number: "02",
    title: "Sistem məlumatı ayırır",
    desc: "Sifariş nömrəsi, telefon, ünvan və problem tipi strukturlaşdırılır.",
  },
  {
    number: "03",
    title: "Cavab və ya yönləndirmə edilir",
    desc: "Sadə status cavablanır, problemli hal isə komandaya ötürülür.",
  },
  {
    number: "04",
    title: "Axın görünən qalır",
    desc: "Komanda hansı sorğunun cavablandığını və hansının müdaxilə istədiyini görür.",
  },
];

const results = [
  { value: "24/7", label: "status sorğularına ilkin cavab" },
  { value: "↓", label: "manual operator yükü" },
  { value: "1", label: "vahid çatdırılma axını" },
];

const rules = [
  "Sadə status sorğuları avtomatik cavablandırılır.",
  "Problemli çatdırılma və şikayətlər operatora ötürülür.",
  "Müştəri məlumatı strukturlaşdırılmış formada qalır.",
  "Komanda təkrar suallara yox, real problemli hallara fokuslanır.",
];

function InfoCard({ item }: { item: CardItem }) {
  const Icon = item.icon;

  return (
    <article className="nx-card nx-card--quiet">
      <div className="nx-stack-sm">
        <div className="nx-row nx-row--top">
          <span className="nx-badge nx-badge--soft nx-badge--plain">
            <Icon size={16} strokeWidth={2} aria-hidden="true" />
          </span>
          <ArrowUpRight size={16} strokeWidth={1.9} className="nx-muted" aria-hidden="true" />
        </div>

        <div className="nx-stack-xs">
          <h3 className="nx-h4">{item.title}</h3>
          <p className="nx-copy-sm">{item.desc}</p>
        </div>
      </div>
    </article>
  );
}

function FlowCard({ step }: { step: FlowStep }) {
  return (
    <article className="nx-card nx-card--compact nx-card--quiet">
      <div className="nx-stack-sm">
        <span className="nx-badge nx-badge--plain">{step.number}</span>
        <div className="nx-stack-xs">
          <h3 className="nx-h4">{step.title}</h3>
          <p className="nx-copy-sm">{step.desc}</p>
        </div>
      </div>
    </article>
  );
}

function LogisticsPreview() {
  return (
    <div className="nx-hero-panel">
      <div className="nx-hero-panel-inner">
        <div className="nx-stack-lg">
          <div className="nx-row nx-row--top">
            <div className="nx-stack-xs">
              <span className="nx-badge nx-badge--soft">
                <Truck size={15} strokeWidth={2} aria-hidden="true" />
                Logistika axını
              </span>
              <h2 className="nx-h3">Status sorğuları səliqəli idarə olunur.</h2>
            </div>

            <Route size={21} strokeWidth={1.9} color="var(--nx-accent)" aria-hidden="true" />
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

          <div className="nx-surface nx-surface--flat nx-surface-pad">
            <div className="nx-stack">
              <div className="nx-row">
                <div className="nx-stack-xs">
                  <p className="nx-eyebrow">Sorğu</p>
                  <p className="nx-h4">“Sifarişim haradadır?”</p>
                </div>
                <span className="nx-badge nx-badge--soft">Status</span>
              </div>

              <hr className="nx-divider" />

              <div className="nx-row">
                <div className="nx-stack-xs">
                  <p className="nx-eyebrow">Sistem cavabı</p>
                  <p className="nx-copy-sm">
                    Sifariş məlumatı istənir, status cavablanır və problemli halda operatora ötürülür.
                  </p>
                </div>
                <CheckCircle2 size={18} strokeWidth={2} color="var(--nx-success)" aria-hidden="true" />
              </div>
            </div>
          </div>

          <p className="nx-copy-sm">
            Logistikada əsas məqsəd müştərinin qeyri-müəyyənliyini azaltmaq və komandanın manual cavab yükünü yüngülləşdirməkdir.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function UseCaseLogistics() {
  const withLang = useLocalizedPath();

  return (
    <main className="nx-page">
      <section className="nx-hero">
        <div className="nx-container">
          <div className="nx-hero-grid">
            <div className="nx-hero-copy">
              <p className="nx-kicker">NEOX / Logistika</p>

              <div className="nx-stack">
                <h1 className="nx-display">
                  Logistika üçün <span className="nx-gradient-text">status və müştəri axını.</span>
                </h1>

                <p className="nx-lead nx-max-copy">
                  Çatdırılma, sifariş statusu, gecikmə və müştəri sualları daha səliqəli cavablanır.
                  Sistem sadə status sorğularını qarşılayır, problemli halları isə komandaya ötürür.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Logistika axını quraq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/use-cases")} className="nx-button">
                  Bütün sahələr
                </Link>
              </div>

              <div className="nx-chip-row">
                <span className="nx-chip">Status cavabı</span>
                <span className="nx-chip">Gecikmə bildirimi</span>
                <span className="nx-chip">Operator handoff</span>
              </div>
            </div>

            <div className="nx-hero-visual">
              <LogisticsPreview />
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--tight">
        <div className="nx-container">
          <div className="nx-stack-xl">
            <div className="nx-row nx-row--top">
              <div className="nx-stack-sm nx-max-copy">
                <p className="nx-kicker">Problem</p>
                <h2 className="nx-title-sm">Logistikada müştəri ən çox status və gecikmə haqqında yazır.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Eyni sualların manual cavablanması operatorları yükləyir. Müştəri isə tez və aydın cavab istəyir.
              </p>
            </div>

            <div className="nx-grid nx-grid--3">
              {painPoints.map((item) => (
                <InfoCard key={item.title} item={item} />
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
                <p className="nx-kicker">Həll</p>
                <h2 className="nx-title">Status sorğuları avtomatlaşır, problemli hallar görünən olur.</h2>
                <p className="nx-lead">
                  Sistem hər şeyi avtomatik bağlamır. Sadə status suallarını cavablayır, xüsusi və riskli halları
                  isə doğru komandaya yönləndirir.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/services/business-workflows")} className="nx-button">
                  Workflow xidmətləri
                </Link>

                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Sistem xəritəsi çıxaraq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="nx-grid nx-grid--2">
              {solutions.map((item) => (
                <InfoCard key={item.title} item={item} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section-divider">
        <div className="nx-container">
          <div className="nx-stack-xl">
            <div className="nx-row nx-row--top">
              <div className="nx-stack-sm nx-max-copy">
                <p className="nx-kicker">Axın</p>
                <h2 className="nx-title-sm">Status sorğusu dörd addımda idarə olunur.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Sifariş nömrəsi, telefon, çatdırılma problemi və yönləndirmə qaydaları biznesinizə görə qurulur.
              </p>
            </div>

            <div className="nx-grid nx-grid--4">
              {flow.map((step) => (
                <FlowCard key={step.number} step={step} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section">
        <div className="nx-container">
          <div className="nx-surface nx-surface--raised nx-surface-pad">
            <div className="nx-split">
              <div className="nx-stack">
                <span className="nx-badge nx-badge--soft">
                  <ShieldCheck size={15} strokeWidth={2} aria-hidden="true" />
                  Kontrollu cavab
                </span>

                <h2 className="nx-title-sm">Logistikada avtomatlaşdırma müştərini sakitləşdirməlidir.</h2>

                <p className="nx-lead">
                  Müştəriyə cavab verilməlidir, amma yanlış söz verilməməlidir. Ona görə cavab sistemi
                  status, qayda və operator handoff məntiqi ilə qurulur.
                </p>
              </div>

              <div className="nx-grid">
                {rules.map((rule) => (
                  <div key={rule} className="nx-row">
                    <span className="nx-list-item">{rule}</span>
                    <CheckCircle2 size={18} strokeWidth={2} color="var(--nx-success)" aria-hidden="true" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--last nx-section-divider">
        <div className="nx-container">
          <div className="nx-surface nx-surface--raised nx-surface-pad">
            <div className="nx-split">
              <div className="nx-stack">
                <span className="nx-badge nx-badge--soft">
                  <Sparkles size={15} strokeWidth={2} aria-hidden="true" />
                  Logistikaya uyğun
                </span>

                <h2 className="nx-title-sm">Çatdırılma və müştəri sorğu axınınızı sistemləşdirək.</h2>

                <p className="nx-lead">
                  Müştərilər ən çox nə soruşur, status məlumatı haradan gəlir və hansı hallarda operator lazımdır —
                  bunları sistemə çevirək.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary nx-button--full">
                  Logistika üçün danışaq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/pricing")} className="nx-button nx-button--full">
                  Qiymət məntiqi
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}