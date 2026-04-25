// src/pages/services/ServiceMobileApps.tsx
import { Link, useParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  Code2,
  DatabaseZap,
  Gauge,
  Layers3,
  LockKeyhole,
  MessageSquareText,
  PanelsTopLeft,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TabletSmartphone,
  UserRoundCheck,
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
    title: "Müştəri tətbiqi",
    desc: "Sifariş, rezervasiya, status, profil və bildirişlər üçün premium mobil təcrübə.",
    icon: Smartphone,
  },
  {
    title: "Komanda tətbiqi",
    desc: "Daxili tapşırıq, lead, status və operator axınlarını komanda üçün rahatlaşdırır.",
    icon: UserRoundCheck,
  },
  {
    title: "Bildiriş sistemi",
    desc: "Vacib hadisələr, yeni müraciətlər və status dəyişiklikləri push və ya mesajla ötürülür.",
    icon: BellRing,
  },
  {
    title: "API və data bağlantısı",
    desc: "Tətbiq mövcud sayt, CRM, backend və digər sistemlərə uyğun qurulur.",
    icon: DatabaseZap,
  },
];

const appTypes: ServiceItem[] = [
  {
    title: "Booking app",
    desc: "Görüş, rezervasiya, xidmət seçimi və istifadəçi məlumatı üçün mobil axın.",
    icon: TabletSmartphone,
  },
  {
    title: "Customer portal",
    desc: "Müştərinin öz statusunu, müraciətini və xidmət tarixçəsini görməsi üçün tətbiq.",
    icon: PanelsTopLeft,
  },
  {
    title: "Ops app",
    desc: "Komanda üçün lead, status, tapşırıq və bildiriş idarəetmə tətbiqi.",
    icon: Workflow,
  },
  {
    title: "AI-ready app",
    desc: "Süni İntellekt cavabları və avtomatlaşdırma ilə birləşə bilən mobil interfeys.",
    icon: MessageSquareText,
  },
];

const steps: Step[] = [
  {
    number: "01",
    title: "İstifadəçi axını seçilir",
    desc: "Tətbiqin kim üçün olduğu, hansı problemi həll etdiyi və əsas ekranları müəyyən edilir.",
  },
  {
    number: "02",
    title: "Interface sistemi qurulur",
    desc: "Light premium səth, navigation, əsas action-lar və mobil komponentlər hazırlanır.",
  },
  {
    number: "03",
    title: "Backend və data bağlanır",
    desc: "Formalar, statuslar, istifadəçi məlumatı, bildiriş və API axınları inteqrasiya olunur.",
  },
  {
    number: "04",
    title: "Test və optimallaşdırma",
    desc: "Mobil performans, sadəlik, təhlükəsizlik və real istifadə axını yoxlanır.",
  },
];

const results = [
  { value: "1", label: "təmiz mobil surface" },
  { value: "↑", label: "istifadəçi rahatlığı" },
  { value: "↓", label: "manual status sorğuları" },
];

const rules = [
  "Tətbiq hər funksiyanı yox, ən vacib axını həll etməlidir.",
  "Mobil interface web panelin kiçildilmiş versiyası olmamalıdır.",
  "Push, status və məlumat axınları aydın qaydada işləməlidir.",
  "Təhlükəsizlik və giriş səviyyələri əvvəlcədən düşünülməlidir.",
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

function MobilePreview() {
  return (
    <div className="nx-hero-panel">
      <div className="nx-hero-panel-inner">
        <div className="nx-stack-lg">
          <div className="nx-row nx-row--top">
            <div className="nx-stack-xs">
              <span className="nx-badge nx-badge--soft">
                <Smartphone size={15} strokeWidth={2} aria-hidden="true" />
                Mobil tətbiq
              </span>
              <h2 className="nx-h3">Əsas iş axını cibdə daha rahat olur.</h2>
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
                  <p className="nx-eyebrow">Mobil axın</p>
                  <p className="nx-h4">Rezervasiya, status və bildiriş bir yerdə.</p>
                </div>
                <span className="nx-badge nx-badge--soft">App</span>
              </div>

              <hr className="nx-divider" />

              <div className="nx-row">
                <div className="nx-stack-xs">
                  <p className="nx-eyebrow">Nəticə</p>
                  <p className="nx-copy-sm">
                    Müştəri və ya komanda əsas prosesi mobil ekrandan daha rahat idarə edir.
                  </p>
                </div>
                <CheckCircle2 size={18} strokeWidth={2} color="var(--nx-success)" aria-hidden="true" />
              </div>
            </div>
          </div>

          <p className="nx-copy-sm">
            Mobil tətbiq o zaman lazımdır ki, müştəri və ya komanda eyni axına tez-tez qayıdır.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ServiceMobileApps() {
  const withLang = useLocalizedPath();

  return (
    <main className="nx-page">
      <section className="nx-hero">
        <div className="nx-container">
          <div className="nx-hero-grid">
            <div className="nx-hero-copy">
              <p className="nx-kicker">NEOX / Mobil tətbiqlər</p>

              <div className="nx-stack">
                <h1 className="nx-display">
                  Biznes axınınız üçün <span className="nx-gradient-text">premium mobil tətbiq.</span>
                </h1>

                <p className="nx-lead nx-max-copy">
                  Mobil tətbiqi sadəcə “app olsun” deyə qurmuruq. Müştəri, komanda və ya əməliyyat üçün
                  real iş axını varsa, onu təmiz və istifadəsi rahat mobil səthə çeviririk.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Tətbiq planlaşdıraq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/pricing")} className="nx-button">
                  Qiymət məntiqi
                </Link>
              </div>

              <div className="nx-chip-row">
                <span className="nx-chip">Customer app</span>
                <span className="nx-chip">Ops app</span>
                <span className="nx-chip">Push flow</span>
              </div>
            </div>

            <div className="nx-hero-visual">
              <MobilePreview />
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--tight">
        <div className="nx-container">
          <div className="nx-stack-xl">
            <div className="nx-row nx-row--top">
              <div className="nx-stack-sm nx-max-copy">
                <p className="nx-kicker">Nə qurulur?</p>
                <h2 className="nx-title-sm">Mobil tətbiq əsas axını daha yaxın və rahat edir.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Tətbiq saytın təkrarı olmamalıdır. O, tez-tez istifadə olunan funksiyanı daha rahat və sürətli etməlidir.
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
                <p className="nx-kicker">Tətbiq tipləri</p>
                <h2 className="nx-title">Hər biznesin tətbiq ehtiyacı eyni deyil.</h2>
                <p className="nx-lead">
                  Bəzən müştəri portalı lazımdır, bəzən komanda üçün ops tətbiqi, bəzən də rezervasiya və
                  status axını. Əsas məsələ tətbiqin nəyi sadələşdirdiyini bilməkdir.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/services/business-workflows")} className="nx-button">
                  Workflow xidmətləri
                </Link>

                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  App ideyamı danışım
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="nx-grid nx-grid--2">
              {appTypes.map((item) => (
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
                <h2 className="nx-title-sm">Mobil tətbiq əvvəl axın, sonra ekran deməkdir.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Əvvəl istifadəçi ssenarisi aydın olur, sonra interface və texniki quruluş hazırlanır.
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
                  Mobil qayda
                </span>

                <h2 className="nx-title-sm">Yaxşı mobil tətbiq az ekranla çox işi həll edir.</h2>

                <p className="nx-lead">
                  Mobil ekranda artıq mətn, artıq panel və artıq funksiya istifadəçini yorur. Ona görə tətbiq
                  ən vacib axını premium və sadə formada daşımalıdır.
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
                <h2 className="nx-title">Tətbiq üçün əvvəl əsas istifadə ssenarisi bilinməlidir.</h2>
                <p className="nx-lead">
                  Kim istifadə edəcək, nəyi tez-tez edəcək, hansı məlumatı görəcək və hansı action-u tamamlayacaq —
                  tətbiqin dəyəri bu suallardan başlayır.
                </p>
              </div>
            </div>

            <div className="nx-grid nx-grid--2">
              {[
                { title: "İstifadəçi axını", icon: Workflow },
                { title: "Mobil interface", icon: Layers3 },
                { title: "Backend bağlantısı", icon: Code2 },
                { title: "Giriş və təhlükəsizlik", icon: LockKeyhole },
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

                <h2 className="nx-title-sm">Tətbiq ideyanızı real mobil axına çevirək.</h2>

                <p className="nx-lead">
                  Müştəri, komanda və ya əməliyyat üçün hansı mobil axının lazım olduğunu qısa danışıqla
                  müəyyən edək.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary nx-button--full">
                  Tətbiq planlaşdıraq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/services/websites")} className="nx-button nx-button--full">
                  Vebsayt xidmətləri
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}