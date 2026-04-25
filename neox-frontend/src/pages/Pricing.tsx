// src/pages/Pricing.tsx
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Gauge,
  Layers3,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { DEFAULT_LANG, LANGS, type Lang } from "../i18n/lang";

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

type PackageItem = {
  name: string;
  desc: string;
  ideal: string;
  points: string[];
  featured?: boolean;
};

type IncludedItem = {
  title: string;
  desc: string;
  icon: typeof Bot;
};

const packages: PackageItem[] = [
  {
    name: "Start",
    desc: "Kiçik biznes üçün ilkin premium rəqəmsal sistem.",
    ideal: "Sayt, əsas mesaj axını və sadə avtomatlaşdırma istəyən bizneslər üçün.",
    points: [
      "Premium landing və ya kiçik vebsayt",
      "Əsas əlaqə və lead toplama axını",
      "Sadə Süni İntellekt cavab strukturu",
      "Mobil uyğun light premium interfeys",
    ],
  },
  {
    name: "Growth",
    desc: "Satış, mesajlaşma və avtomatlaşdırmanı bir sistemə salmaq üçün.",
    ideal: "Müştəri sorğuları artan, cavab və lead axınını sistemləşdirmək istəyən bizneslər üçün.",
    points: [
      "Vebsayt + mesajlaşma axını",
      "Instagram / sayt sorğuları üçün cavab məntiqi",
      "Lead yönləndirmə və komanda xəbərdarlığı",
      "Süni İntellekt üçün FAQ və xidmət strukturu",
      "İlkin analitika və proses izləmə",
    ],
    featured: true,
  },
  {
    name: "Custom",
    desc: "Tam biznesə uyğun xüsusi sistem və inteqrasiya.",
    ideal: "Daha böyük əməliyyat, fərqli kanallar və xüsusi iş axını olan komandalar üçün.",
    points: [
      "Xüsusi veb platforma və ya dashboard",
      "Çoxkanallı mesaj və operator axını",
      "Süni İntellekt davranış qaydaları",
      "CRM, API və daxili sistem inteqrasiyası",
      "Davamlı optimallaşdırma və nəzarət",
    ],
  },
];

const included: IncludedItem[] = [
  {
    title: "Premium interface",
    desc: "Panel-panel görünməyən, təmiz və brendə uyğun light səth.",
    icon: Layers3,
  },
  {
    title: "Süni İntellekt məntiqi",
    desc: "Sadə chatbot yox, biznes suallarına və xidmət strukturuna uyğun cavab axını.",
    icon: Bot,
  },
  {
    title: "Mesaj və lead axını",
    desc: "Sorğuların cavablanması, qeyd olunması və düzgün yerə yönləndirilməsi.",
    icon: MessageSquareText,
  },
  {
    title: "Avtomatlaşdırma",
    desc: "Təkrarlanan manual işləri azaltmaq üçün bildiriş, təsdiq və workflow quruluşu.",
    icon: Workflow,
  },
  {
    title: "Ölçülə bilən nəticə",
    desc: "Cavab sürəti, lead keyfiyyəti və proses səmərəsi daha görünən olur.",
    icon: Gauge,
  },
  {
    title: "Kontrollu icra",
    desc: "Riskli hallarda operatora ötürmə, sərhədlər və təhlükəsiz davranış məntiqi.",
    icon: ShieldCheck,
  },
];

const faq = [
  {
    q: "Qiymət niyə sabit paket kimi göstərilmir?",
    a: "Çünki hər biznesin axını fərqlidir. Sadə landing ilə çoxkanallı Süni İntellekt sistemi eyni qiymət məntiqinə sığmır. Əvvəl ehtiyacı anlayırıq, sonra real təklif veririk.",
  },
  {
    q: "Təkcə vebsayt hazırlamaq olar?",
    a: "Bəli. Amma məqsəd təkcə gözəl sayt yox, müştəri sorğusunu və satış axınını daha düzgün işlədən veb səth qurmaqdır.",
  },
  {
    q: "Süni İntellekt cavab sistemi ayrıca qoşula bilər?",
    a: "Bəli. Mövcud saytınıza və ya mesajlaşma kanalınıza uyğun cavab, FAQ, lead və operatora ötürmə axını qura bilərik.",
  },
  {
    q: "Başlamaq üçün nə lazımdır?",
    a: "Biznes sahəniz, xidmətləriniz, müştərilərin ən çox verdiyi suallar və hazırda sizi yavaşladan proseslər kifayətdir.",
  },
];

function PackageCard({ item }: { item: PackageItem }) {
  return (
    <article className={item.featured ? "nx-card nx-card--quiet nx-pricing-card is-featured" : "nx-card nx-card--quiet nx-pricing-card"}>
      <div className="nx-stack">
        <div className="nx-row nx-row--top">
          <div className="nx-stack-xs">
            <span className={item.featured ? "nx-badge nx-badge--soft" : "nx-badge nx-badge--plain"}>
              {item.featured ? "Ən uyğun" : "Paket"}
            </span>
            <h2 className="nx-title-sm">{item.name}</h2>
          </div>

          {item.featured ? <Sparkles size={20} strokeWidth={1.9} color="var(--nx-accent)" aria-hidden="true" /> : null}
        </div>

        <p className="nx-copy">{item.desc}</p>

        <div className="nx-surface nx-surface--flat nx-surface-pad nx-pricing-note">
          <p className="nx-copy-sm">{item.ideal}</p>
        </div>

        <ul className="nx-list">
          {item.points.map((point) => (
            <li key={point} className="nx-list-item">
              {point}
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function IncludedCard({ item }: { item: IncludedItem }) {
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

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <article className="nx-card nx-card--compact nx-card--quiet">
      <div className="nx-stack-xs">
        <h3 className="nx-h4">{q}</h3>
        <p className="nx-copy-sm">{a}</p>
      </div>
    </article>
  );
}

function PricingPreview() {
  return (
    <div className="nx-hero-panel">
      <div className="nx-hero-panel-inner">
        <div className="nx-stack-lg">
          <div className="nx-row nx-row--top">
            <div className="nx-stack-xs">
              <span className="nx-badge nx-badge--soft">Təklif məntiqi</span>
              <h2 className="nx-h3">Əvvəl ehtiyac, sonra qiymət</h2>
            </div>

            <CheckCircle2 size={20} strokeWidth={2} color="var(--nx-success)" aria-hidden="true" />
          </div>

          <div className="nx-grid">
            <div className="nx-surface nx-surface--flat nx-surface-pad">
              <div className="nx-row">
                <div className="nx-stack-xs">
                  <p className="nx-eyebrow">01</p>
                  <p className="nx-h4">Biznes axını anlaşılır</p>
                </div>
                <span className="nx-badge nx-badge--plain">brief</span>
              </div>
            </div>

            <div className="nx-surface nx-surface--flat nx-surface-pad">
              <div className="nx-row">
                <div className="nx-stack-xs">
                  <p className="nx-eyebrow">02</p>
                  <p className="nx-h4">Sistem xəritəsi hazırlanır</p>
                </div>
                <span className="nx-badge nx-badge--plain">scope</span>
              </div>
            </div>

            <div className="nx-surface nx-surface--flat nx-surface-pad">
              <div className="nx-row">
                <div className="nx-stack-xs">
                  <p className="nx-eyebrow">03</p>
                  <p className="nx-h4">Uyğun təklif verilir</p>
                </div>
                <span className="nx-badge nx-badge--soft">offer</span>
              </div>
            </div>
          </div>

          <p className="nx-copy-sm">
            Beləliklə həm sadə layihə şişirdilmir, həm də ciddi sistem yarımçıq qiymətləndirilmır.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Pricing() {
  const withLang = useLocalizedPath();

  return (
    <main className="nx-page">
      <section className="nx-hero">
        <div className="nx-container">
          <div className="nx-hero-grid">
            <div className="nx-hero-copy">
              <p className="nx-kicker">NEOX / Qiymətlər</p>

              <div className="nx-stack">
                <h1 className="nx-display">
                  Qiymət layihənin <span className="nx-gradient-text">real sistem dəyərinə</span> görə formalaşır.
                </h1>

                <p className="nx-lead nx-max-copy">
                  NEOX-da qiymət hazır şablon paketindən yox, qurulacaq sistemin dərinliyindən asılıdır:
                  vebsayt, mesajlaşma, Süni İntellekt cavabları, avtomatlaşdırma və inteqrasiya səviyyəsi.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Təklif al
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/services/chatbot-24-7")} className="nx-button">
                  Xidmətlərə bax
                </Link>
              </div>

              <div className="nx-chip-row">
                <span className="nx-chip">Şablon qiymət yox</span>
                <span className="nx-chip">Biznesə uyğun scope</span>
                <span className="nx-chip">Premium icra</span>
              </div>
            </div>

            <div className="nx-hero-visual">
              <PricingPreview />
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--tight">
        <div className="nx-container">
          <div className="nx-stack-xl">
            <div className="nx-row nx-row--top">
              <div className="nx-stack-sm nx-max-copy">
                <p className="nx-kicker">Paket məntiqi</p>
                <h2 className="nx-title-sm">Başlanğıc üçün üç istiqamət.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Bunlar yekun qiymət siyahısı deyil. Sadəcə layihənin həcmini düzgün düşünmək üçün başlanğıc çərçivəsidir.
              </p>
            </div>

            <div className="nx-grid nx-grid--3">
              {packages.map((item) => (
                <PackageCard key={item.name} item={item} />
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
                <p className="nx-kicker">Nə daxildir?</p>
                <h2 className="nx-title">Sadəcə ekran yox, biznes axını qurulur.</h2>
                <p className="nx-lead">
                  Layihənin həcmi dəyişə bilər, amma yanaşma eynidir: təmiz interface, real məntiq,
                  kontrollu Süni İntellekt və ölçülə bilən icra.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Bizə yaz
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="nx-grid nx-grid--2">
              {included.map((item) => (
                <IncludedCard key={item.title} item={item} />
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
                  Düzgün təklif
                </span>

                <h2 className="nx-title-sm">Ən yaxşı qiymət düzgün scope-dan başlayır.</h2>

                <p className="nx-lead">
                  Sənə lazımsız ekran, panel və modul satmaq istəmirik. Əvvəl real ehtiyacı tapırıq,
                  sonra daha az, amma daha düzgün sistem qururuq.
                </p>
              </div>

              <div className="nx-grid">
                <div className="nx-card nx-card--compact nx-card--quiet">
                  <div className="nx-stack-xs">
                    <h3 className="nx-h4">Kiçik başlamaq olar</h3>
                    <p className="nx-copy-sm">
                      Əvvəl sadə sayt və cavab axını qurub, sonra avtomatlaşdırmanı genişləndirmək mümkündür.
                    </p>
                  </div>
                </div>

                <div className="nx-card nx-card--compact nx-card--quiet">
                  <div className="nx-stack-xs">
                    <h3 className="nx-h4">Tam sistem də qura bilərik</h3>
                    <p className="nx-copy-sm">
                      Çoxkanallı mesajlaşma, lead, CRM, operator və Süni İntellekt cavab axını birlikdə qurula bilər.
                    </p>
                  </div>
                </div>

                <Link to={withLang("/contact")} className="nx-button nx-button--primary nx-button--full">
                  Layihəni qiymətləndirək
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--last">
        <div className="nx-container">
          <div className="nx-stack-xl">
            <div className="nx-row nx-row--top">
              <div className="nx-stack-sm nx-max-copy">
                <p className="nx-kicker">Suallar</p>
                <h2 className="nx-title-sm">Qiymətlə bağlı ən çox verilən suallar.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Qısa cavab: qiymət ehtiyacdan asılıdır. Amma proses aydın, sadə və əvvəlcədən razılaşdırılmış olur.
              </p>
            </div>

            <div className="nx-grid nx-grid--2">
              {faq.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}