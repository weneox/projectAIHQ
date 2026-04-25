// src/pages/services/ServiceWebsites.tsx
import { Link, useParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Code2,
  Gauge,
  Globe2,
  LayoutTemplate,
  MessageSquareText,
  MousePointerClick,
  Palette,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap,
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
    title: "Premium light interface",
    desc: "Ağ, təmiz, sürətli və brendə uyğun surface dili. Panel-panel görüntü yox.",
    icon: Palette,
  },
  {
    title: "Satış yönümlü struktur",
    desc: "Hero, xidmətlər, sübut, CTA və əlaqə axını müştərini növbəti addıma aparır.",
    icon: MousePointerClick,
  },
  {
    title: "Sürət və texniki təmizlik",
    desc: "Yüngül frontend, mobil uyğunluq, SEO əsasları və performans düşünülərək qurulur.",
    icon: Zap,
  },
  {
    title: "Cavab sistemi üçün hazır baza",
    desc: "Sayt sonradan Süni İntellekt cavabları və lead axını ilə birləşə biləcək formada hazırlanır.",
    icon: Bot,
  },
];

const websiteTypes: ServiceItem[] = [
  {
    title: "Landing page",
    desc: "Bir xidmət və ya kampaniya üçün fokuslanmış, sürətli və premium səhifə.",
    icon: LayoutTemplate,
  },
  {
    title: "Şirkət saytı",
    desc: "Haqqımızda, xidmətlər, resurslar və əlaqə axını olan tam brend saytı.",
    icon: Globe2,
  },
  {
    title: "Lead toplama saytı",
    desc: "Form, WhatsApp, CTA və mesaj axını ilə müştəri müraciəti toplama sistemi.",
    icon: MessageSquareText,
  },
  {
    title: "Süni İntellektə hazır sayt",
    desc: "FAQ, xidmət və biznes məlumatı cavab sistemi üçün strukturlaşdırılır.",
    icon: Workflow,
  },
];

const steps: Step[] = [
  {
    number: "01",
    title: "Brend və məqsəd aydınlaşır",
    desc: "Saytın nə satacağı, kimin üçün olduğu və hansı addıma aparacağı müəyyən edilir.",
  },
  {
    number: "02",
    title: "Səhifə strukturu qurulur",
    desc: "Hero, xidmətlər, sübut, proses, FAQ və CTA axını sadə xəritəyə salınır.",
  },
  {
    number: "03",
    title: "Premium interface hazırlanır",
    desc: "Light surface dili, tipografiya, spacing və komponent sistemi tətbiq olunur.",
  },
  {
    number: "04",
    title: "İşə salınır və optimallaşdırılır",
    desc: "Mobil görünüş, sürət, SEO əsasları və əlaqə axını yoxlanır.",
  },
];

const results = [
  { value: "1", label: "vahid premium surface" },
  { value: "↑", label: "müştəri etibarı" },
  { value: "↓", label: "vizual qarışıqlıq" },
];

const rules = [
  "Sayt sadəcə gözəl görünməməli, iş görməlidir.",
  "Hər bölmə növbəti addımı aydın göstərməlidir.",
  "Çox panel və artıq dekor əvəzinə vahid surface dili istifadə olunmalıdır.",
  "Sayt gələcək cavab sistemi və avtomatlaşdırma üçün hazır qurulmalıdır.",
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

function WebsitePreview() {
  return (
    <div className="nx-hero-panel">
      <div className="nx-hero-panel-inner">
        <div className="nx-stack-lg">
          <div className="nx-row nx-row--top">
            <div className="nx-stack-xs">
              <span className="nx-badge nx-badge--soft">
                <Globe2 size={15} strokeWidth={2} aria-hidden="true" />
                Premium website
              </span>
              <h2 className="nx-h3">Sayt sadə görünür, amma satış axını daşıyır.</h2>
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
                  <p className="nx-eyebrow">Sayt məqsədi</p>
                  <p className="nx-h4">Müştəri nə etdiyinizi 5 saniyədə anlamalıdır.</p>
                </div>
                <span className="nx-badge nx-badge--soft">Clarity</span>
              </div>

              <hr className="nx-divider" />

              <div className="nx-row">
                <div className="nx-stack-xs">
                  <p className="nx-eyebrow">Növbəti addım</p>
                  <p className="nx-copy-sm">
                    Xidmətlər, etibar siqnalları və CTA-lar istifadəçini əlaqə və ya müraciətə aparır.
                  </p>
                </div>
                <CheckCircle2 size={18} strokeWidth={2} color="var(--nx-success)" aria-hidden="true" />
              </div>
            </div>
          </div>

          <p className="nx-copy-sm">
            Premium sayt çox animasiya yox, düzgün söz, düzgün spacing və işlək əlaqə axınıdır.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ServiceWebsites() {
  const withLang = useLocalizedPath();

  return (
    <main className="nx-page">
      <section className="nx-hero">
        <div className="nx-container">
          <div className="nx-hero-grid">
            <div className="nx-hero-copy">
              <p className="nx-kicker">NEOX / Premium veb saytlar</p>

              <div className="nx-stack">
                <h1 className="nx-display">
                  Brendiniz üçün <span className="nx-gradient-text">premium və satış yönümlü vebsayt.</span>
                </h1>

                <p className="nx-lead nx-max-copy">
                  Qara, ağır, panel-panel görünən sayt yox. Təmiz light surface, güclü mətn strukturu,
                  sürətli mobil təcrübə və müştərini əlaqəyə aparan axın qururuq.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Sayt quraq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/pricing")} className="nx-button">
                  Qiymət məntiqi
                </Link>
              </div>

              <div className="nx-chip-row">
                <span className="nx-chip">Light premium</span>
                <span className="nx-chip">SEO əsasları</span>
                <span className="nx-chip">Lead axını</span>
              </div>
            </div>

            <div className="nx-hero-visual">
              <WebsitePreview />
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--tight">
        <div className="nx-container">
          <div className="nx-stack-xl">
            <div className="nx-row nx-row--top">
              <div className="nx-stack-sm nx-max-copy">
                <p className="nx-kicker">Nə fərqlidir?</p>
                <h2 className="nx-title-sm">Sayt dizayn yox, biznes səthidir.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Hər elementin işi olmalıdır: izah etmək, inandırmaq, yönləndirmək və müraciət yaratmaq.
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
                <p className="nx-kicker">Sayt tipləri</p>
                <h2 className="nx-title">Ehtiyaca uyğun sayt strukturu qurulur.</h2>
                <p className="nx-lead">
                  Bəzən bir güclü landing kifayətdir. Bəzən tam şirkət saytı, resurslar, FAQ və cavab sistemi
                  üçün struktur lazımdır. Əsas məsələ məqsədi düzgün seçməkdir.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/resources/guides")} className="nx-button">
                  Bələdçilərə bax
                </Link>

                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Saytımı planlaşdıraq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="nx-grid nx-grid--2">
              {websiteTypes.map((item) => (
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
                <p className="nx-kicker">Qurulum</p>
                <h2 className="nx-title-sm">Premium sayt mərhələli şəkildə yığılır.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Əvvəl məqsəd və struktur, sonra interface, sonra texniki optimallaşdırma və əlaqə axını.
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
                  Dizayn qaydası
                </span>

                <h2 className="nx-title-sm">Premium sayt daha çox dekor yox, daha çox aydınlıqdır.</h2>

                <p className="nx-lead">
                  Səhifə “wow” demək üçün yox, müştərinin qərarını rahatlaşdırmaq üçün işləməlidir.
                  Ona görə surface, mətn və CTA sistemi bir dildə danışmalıdır.
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
                <p className="nx-kicker">Nə lazımdır?</p>
                <h2 className="nx-title">Sayt üçün əvvəl mesajınız aydın olmalıdır.</h2>
                <p className="nx-lead">
                  Nə edirsiniz, kimə xidmət edirsiniz, müştəri niyə sizə inanmalıdır və növbəti addım nədir —
                  sayt bu suallara sakit və aydın cavab verməlidir.
                </p>
              </div>
            </div>

            <div className="nx-grid nx-grid--2">
              {[
                { title: "Brend mesajı", icon: Palette },
                { title: "Səhifə strukturu", icon: LayoutTemplate },
                { title: "Texniki icra", icon: Code2 },
                { title: "SEO və performans", icon: SearchCheck },
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

                <h2 className="nx-title-sm">Brendiniz üçün təmiz və premium sayt quraq.</h2>

                <p className="nx-lead">
                  Biznesinizi qısa izah edin, sizə landing, şirkət saytı və ya AI-ready struktur lazım olduğunu
                  birlikdə müəyyən edək.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary nx-button--full">
                  Sayt quraq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/services/chatbot-24-7")} className="nx-button nx-button--full">
                  Cavab sistemi
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}