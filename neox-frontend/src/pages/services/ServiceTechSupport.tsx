// src/pages/services/ServiceTechSupport.tsx
import { Link, useParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  Bug,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  Gauge,
  LifeBuoy,
  MessageSquareText,
  Rocket,
  Settings2,
  ShieldCheck,
  Sparkles,
  Wrench,
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

type ServiceItem = {
  title: string;
  desc: string;
  icon: LucideIcon;
};

type Step = {
  number: string;
  title: string;
  desc: string;
};

const features: ServiceItem[] = [
  {
    title: "Texniki nəzarət",
    desc: "Sayt, forma, cavab sistemi və avtomatlaşdırma axınlarının işlək qalması izlənir.",
    icon: Activity,
  },
  {
    title: "Problem analizi",
    desc: "Xəta, gecikmə, cavab problemi və inteqrasiya pozulması səbəbi aydınlaşdırılır.",
    icon: Bug,
  },
  {
    title: "Optimallaşdırma",
    desc: "Performans, cavab keyfiyyəti, UX və workflow səmərəsi mərhələli yaxşılaşdırılır.",
    icon: Gauge,
  },
  {
    title: "Dəyişiklik dəstəyi",
    desc: "Yeni xidmət, yeni sual, yeni səhifə və ya yeni workflow ehtiyacı sistemə əlavə olunur.",
    icon: Settings2,
  },
];

const supportAreas: ServiceItem[] = [
  {
    title: "Vebsayt dəstəyi",
    desc: "Səhifə, forma, mobil görünüş, sürət və texniki düzəlişlər.",
    icon: Code2,
  },
  {
    title: "Süni İntellekt cavab sistemi",
    desc: "FAQ, cavab dili, operatora ötürmə və yanlış cavab risklərinin təmizlənməsi.",
    icon: MessageSquareText,
  },
  {
    title: "Avtomatlaşdırma axını",
    desc: "Lead, bildiriş, status və workflow qaydalarının izlənməsi və yenilənməsi.",
    icon: BellRing,
  },
  {
    title: "Launch sonrası nəzarət",
    desc: "Sistem işə düşəndən sonra real istifadə davranışına görə düzəlişlər.",
    icon: Rocket,
  },
];

const steps: Step[] = [
  {
    number: "01",
    title: "Problem və ya ehtiyac qeyd olunur",
    desc: "Nəyin işləmədiyi, nəyin dəyişməli olduğu və hansı nəticənin gözləndiyi aydınlaşır.",
  },
  {
    number: "02",
    title: "Səbəb araşdırılır",
    desc: "UI, API, cavab qaydası, data və workflow hissələri ayrıca yoxlanılır.",
  },
  {
    number: "03",
    title: "Düzəliş edilir",
    desc: "Problem aradan qaldırılır və ya yeni ehtiyac sistemə uyğun formada əlavə olunur.",
  },
  {
    number: "04",
    title: "Nəticə izlənir",
    desc: "Dəyişiklikdən sonra sistemin daha stabil və aydın işlədiyi yoxlanılır.",
  },
];

const results = [
  { value: "↓", label: "texniki qarışıqlıq" },
  { value: "↑", label: "sistem stabilliyi" },
  { value: "1", label: "aydın dəstək axını" },
];

const rules = [
  "Dəstək yalnız xətanı söndürmək deyil, səbəbi anlamaqdır.",
  "Hər düzəliş sistemin ümumi dizayn və iş məntiqinə uyğun olmalıdır.",
  "Yeni funksiya əlavə ediləndə panel-panel qarışıqlıq yaradılmamalıdır.",
  "Launch sonrası real istifadə davranışı sistemin ən yaxşı testidir.",
];

function ItemCard({ item }: { item: ServiceItem }) {
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

function StepCard({ step }: { step: Step }) {
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

function SupportPreview() {
  return (
    <div className="nx-hero-panel">
      <div className="nx-hero-panel-inner">
        <div className="nx-stack-lg">
          <div className="nx-row nx-row--top">
            <div className="nx-stack-xs">
              <span className="nx-badge nx-badge--soft">
                <LifeBuoy size={15} strokeWidth={2} aria-hidden="true" />
                Texniki dəstək
              </span>
              <h2 className="nx-h3">Sistem işə düşəndən sonra da tək qalmır.</h2>
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

          <div className="nx-surface nx-surface--flat nx-surface-pad">
            <div className="nx-stack">
              <div className="nx-row">
                <div className="nx-stack-xs">
                  <p className="nx-eyebrow">Hadisə</p>
                  <p className="nx-h4">Forma göndərmir və ya cavab axını zəifləyib.</p>
                </div>
                <span className="nx-badge nx-badge--soft">Support</span>
              </div>

              <hr className="nx-divider" />

              <div className="nx-row">
                <div className="nx-stack-xs">
                  <p className="nx-eyebrow">Dəstək</p>
                  <p className="nx-copy-sm">
                    Səbəb yoxlanır, düzəliş edilir və sistemin stabil işləməsi təsdiqlənir.
                  </p>
                </div>
                <CheckCircle2 size={18} strokeWidth={2} color="var(--nx-success)" aria-hidden="true" />
              </div>
            </div>
          </div>

          <p className="nx-copy-sm">
            Dəstək xidməti sistemin daha sakit, daha stabil və daha uzunömürlü işləməsi üçündür.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ServiceTechnicalSupport() {
  const withLang = useLocalizedPath();

  return (
    <main className="nx-page">
      <section className="nx-hero">
        <div className="nx-container">
          <div className="nx-hero-grid">
            <div className="nx-hero-copy">
              <p className="nx-kicker">NEOX / Texniki dəstək</p>

              <div className="nx-stack">
                <h1 className="nx-display">
                  Sisteminiz üçün <span className="nx-gradient-text">davamlı texniki nəzarət və optimallaşdırma.</span>
                </h1>

                <p className="nx-lead nx-max-copy">
                  Vebsayt, Süni İntellekt cavab sistemi və avtomatlaşdırma axınları işə düşəndən sonra da
                  izlənməli, təmizlənməli və real istifadə davranışına uyğun yaxşılaşdırılmalıdır.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Dəstək üçün yaz
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/pricing")} className="nx-button">
                  Qiymət məntiqi
                </Link>
              </div>

              <div className="nx-chip-row">
                <span className="nx-chip">Monitoring</span>
                <span className="nx-chip">Bug fix</span>
                <span className="nx-chip">Optimization</span>
              </div>
            </div>

            <div className="nx-hero-visual">
              <SupportPreview />
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--tight">
        <div className="nx-container">
          <div className="nx-stack-xl">
            <div className="nx-row nx-row--top">
              <div className="nx-stack-sm nx-max-copy">
                <p className="nx-kicker">Nə daxildir?</p>
                <h2 className="nx-title-sm">Texniki dəstək sistemi stabil saxlamaq üçündür.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Dəstək sadəcə “xəta oldu, düzəltdik” deyil. Sistem böyüdükcə onu təmiz, yüngül və işlək saxlamaqdır.
              </p>
            </div>

            <div className="nx-grid nx-grid--4">
              {features.map((item) => (
                <ItemCard key={item.title} item={item} />
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
                <p className="nx-kicker">Dəstək sahələri</p>
                <h2 className="nx-title">Hər modul eyni sistem dili ilə qorunur.</h2>
                <p className="nx-lead">
                  Sayt, cavab sistemi, workflow və launch sonrası dəyişikliklər ayrı-ayrı yox,
                  vahid sistem məntiqi ilə idarə olunmalıdır.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/services/websites")} className="nx-button">
                  Vebsayt xidmətləri
                </Link>

                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Problemimi yazım
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="nx-grid nx-grid--2">
              {supportAreas.map((item) => (
                <ItemCard key={item.title} item={item} />
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
                <p className="nx-kicker">Proses</p>
                <h2 className="nx-title-sm">Dəstək prosesi aydın və ölçülə bilən olmalıdır.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Səbəb tapılmadan edilən düzəliş müvəqqəti olur. Ona görə problem əvvəl analiz edilir.
              </p>
            </div>

            <div className="nx-grid nx-grid--4">
              {steps.map((step) => (
                <StepCard key={step.number} step={step} />
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
                  Dəstək qaydası
                </span>

                <h2 className="nx-title-sm">Dəstək də dizayn kimi sakit və sistemli olmalıdır.</h2>

                <p className="nx-lead">
                  Hər dəyişiklik yeni qarışıqlıq yaratmamalıdır. Yeni funksiya, düzəliş və optimallaşdırma
                  mövcud surface və iş axınına uyğun edilməlidir.
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

      <section className="nx-section nx-section-divider">
        <div className="nx-container">
          <div className="nx-split nx-split--top">
            <div className="nx-stack-lg">
              <div className="nx-stack">
                <p className="nx-kicker">Nə zaman lazımdır?</p>
                <h2 className="nx-title">Sistem işə düşəndən sonra real istifadə yeni ehtiyaclar göstərir.</h2>
                <p className="nx-lead">
                  Müştərilər fərqli suallar verir, komanda yeni axın istəyir, forma dəyişir, cavab dili yenilənir.
                  Dəstək bu dəyişiklikləri sistemə səliqəli əlavə edir.
                </p>
              </div>
            </div>

            <div className="nx-grid nx-grid--2">
              {[
                { title: "Xəta və texniki problem", icon: AlertTriangle },
                { title: "Yeni funksiya ehtiyacı", icon: Wrench },
                { title: "Cavab keyfiyyəti düzəlişi", icon: MessageSquareText },
                { title: "Launch sonrası izləmə", icon: ClipboardCheck },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <article key={item.title} className="nx-card nx-card--compact nx-card--quiet">
                    <div className="nx-stack-sm">
                      <span className="nx-badge nx-badge--soft nx-badge--plain">
                        <Icon size={16} strokeWidth={2} aria-hidden="true" />
                      </span>
                      <h3 className="nx-h4">{item.title}</h3>
                    </div>
                  </article>
                );
              })}
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
                  Başlayaq
                </span>

                <h2 className="nx-title-sm">Sisteminizi stabil və premium vəziyyətdə saxlayaq.</h2>

                <p className="nx-lead">
                  Mövcud probleminizi və ya dəyişiklik ehtiyacınızı yazın. Səbəbi araşdıraq və sistemli şəkildə düzəldək.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary nx-button--full">
                  Dəstək üçün yaz
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/services/business-workflows")} className="nx-button nx-button--full">
                  Workflow xidmətləri
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}