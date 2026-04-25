// src/pages/Home.tsx
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Globe2,
  Layers3,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";
import { DEFAULT_LANG, LANGS, type Lang } from "../i18n/lang";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

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

type Feature = {
  title: string;
  desc: string;
  icon: typeof Bot;
};

type Step = {
  number: string;
  title: string;
  desc: string;
};

const coreFeatures: Feature[] = [
  {
    title: "Mesajları bir yerə toplayır",
    desc: "Instagram, sayt, WhatsApp və digər kanallardan gələn sorğuları vahid iş axınına gətiririk.",
    icon: MessageSquareText,
  },
  {
    title: "Süni İntellekt cavab verir",
    desc: "Sadə bot deyil; biznes qaydalarına, xidmətlərə və müştəri niyyətinə görə cavab sistemi qurulur.",
    icon: Bot,
  },
  {
    title: "Lead və proses axını yaranır",
    desc: "Sorğu itmir: qeyd olunur, yönləndirilir, izlənir və satış/dəstək prosesinə çevrilir.",
    icon: Workflow,
  },
];

const systemCards: Feature[] = [
  {
    title: "Vebsayt və landing",
    desc: "Brendə uyğun, sürətli, premium və satış yönümlü veb səhifələr.",
    icon: Globe2,
  },
  {
    title: "Avtomatlaşdırma",
    desc: "Təkrar işləri sistemləşdiririk: cavab, yönləndirmə, təsdiq, bildiriş və izləmə.",
    icon: Layers3,
  },
  {
    title: "Nəzarət və analitika",
    desc: "Cavab sürəti, dönüşüm, sorğu tipi və komanda yükü görünən hala gəlir.",
    icon: BarChart3,
  },
  {
    title: "Təhlükəsiz icra",
    desc: "Sistem sərhədlərlə işləyir: riskli hallarda operatora ötürmə və nəzarət saxlanılır.",
    icon: ShieldCheck,
  },
];

const steps: Step[] = [
  {
    number: "01",
    title: "Biznesi başa düşürük",
    desc: "Sahəni, xidmətləri, müştəri suallarını və hazırkı iş axınını xəritələyirik.",
  },
  {
    number: "02",
    title: "Sistemi dizayn edirik",
    desc: "Veb, mesajlaşma, Süni İntellekt cavabları və avtomatlaşdırmanı vahid axına salırıq.",
  },
  {
    number: "03",
    title: "İşlək hala gətiririk",
    desc: "Sistemi qurur, test edir, ölçür və real müştəri axınına uyğun optimallaşdırırıq.",
  },
];

const proofItems = ["Daha sürətli cavab", "Daha az manual iş", "Daha səliqəli müştəri axını"];

function FeatureCard({ feature }: { feature: Feature }) {
  const Icon = feature.icon;

  return (
    <article className="nx-card nx-card--quiet">
      <div className="nx-stack-sm">
        <div className="nx-row nx-row--top">
          <div className="nx-badge nx-badge--soft nx-badge--plain">
            <Icon size={16} strokeWidth={2} aria-hidden="true" />
          </div>
          <ArrowUpRight size={16} strokeWidth={1.9} className="nx-muted" aria-hidden="true" />
        </div>

        <div className="nx-stack-xs">
          <h3 className="nx-h4">{feature.title}</h3>
          <p className="nx-copy-sm">{feature.desc}</p>
        </div>
      </div>
    </article>
  );
}

function StepCard({ step }: { step: Step }) {
  return (
    <article className="nx-card nx-card--compact">
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

function HeroSystemPreview() {
  return (
    <div className="nx-hero-panel">
      <div className="nx-hero-panel-inner">
        <div className="nx-stack-lg">
          <div className="nx-row nx-row--top">
            <div className="nx-stack-xs">
              <span className="nx-badge nx-badge--soft">Canlı sistem</span>
              <h2 className="nx-h3">Müştəri axını idarədədir</h2>
            </div>

            <span className="nx-badge nx-badge--plain">NEOX</span>
          </div>

          <div className="nx-surface nx-surface--flat nx-surface-pad">
            <div className="nx-stack">
              <div className="nx-row">
                <div className="nx-stack-xs">
                  <p className="nx-eyebrow">Gələn sorğu</p>
                  <p className="nx-h4">“Qiymət və çatdırılma necədir?”</p>
                </div>
                <span className="nx-badge nx-badge--soft">Instagram DM</span>
              </div>

              <hr className="nx-divider" />

              <div className="nx-grid nx-grid--3">
                <div className="nx-metric">
                  <span className="nx-metric-value">24/7</span>
                  <span className="nx-metric-label">cavab rejimi</span>
                </div>

                <div className="nx-metric">
                  <span className="nx-metric-value">3x</span>
                  <span className="nx-metric-label">daha sürətli yönləndirmə</span>
                </div>

                <div className="nx-metric">
                  <span className="nx-metric-value">1</span>
                  <span className="nx-metric-label">vahid iş axını</span>
                </div>
              </div>
            </div>
          </div>

          <div className="nx-grid">
            {proofItems.map((item) => (
              <div key={item} className="nx-row">
                <span className="nx-list-item">{item}</span>
                <CheckCircle2 size={18} strokeWidth={2} color="var(--nx-success)" aria-hidden="true" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const withLang = useLocalizedPath();

  return (
    <main className="nx-page">
      <section className="nx-hero">
        <div className="nx-container">
          <div className="nx-hero-grid">
            <div className="nx-hero-copy">
              <p className="nx-kicker">NEOX / Süni İntellekt sistemləri</p>

              <div className="nx-stack">
                <h1 className="nx-display">
                  Biznesiniz üçün <span className="nx-gradient-text">ağıllı iş sistemi</span> qururuq.
                </h1>

                <p className="nx-lead nx-max-copy">
                  Vebsayt, mesajlaşma, avtomatlaşdırma və Süni İntellekt cavablarını bir sistemə salırıq ki,
                  müştəri axını daha səliqəli, sürətli və ölçülə bilən olsun.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Sistemi quraq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/services/chatbot-24-7")} className="nx-button">
                  Xidmətlərə bax
                </Link>
              </div>

              <div className="nx-chip-row">
                <span className="nx-chip">Süni İntellekt cavabları</span>
                <span className="nx-chip">Premium vebsayt</span>
                <span className="nx-chip">Avtomatlaşdırma</span>
              </div>
            </div>

            <div className="nx-hero-visual">
              <HeroSystemPreview />
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--tight">
        <div className="nx-container">
          <div className="nx-grid nx-grid--3">
            {coreFeatures.map((feature) => (
              <FeatureCard key={feature.title} feature={feature} />
            ))}
          </div>
        </div>
      </section>

      <section className="nx-section">
        <div className="nx-container">
          <div className="nx-split nx-split--top">
            <div className="nx-stack-lg">
              <div className="nx-stack">
                <p className="nx-kicker">Nə qururuq?</p>
                <h2 className="nx-title">Ayrı-ayrı alətlər yox, vahid biznes səthi.</h2>
                <p className="nx-lead">
                  Sayt, mesaj, cavab, lead və komanda işi bir-birindən ayrı görünəndə proses dağılır.
                  NEOX-un işi bu parçaları premium, sadə və işlək bir sistemə çevirməkdir.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/about")} className="nx-button">
                  Yanaşmamız
                </Link>

                <Link to={withLang("/use-cases")} className="nx-button nx-button--ghost">
                  İstifadə sahələri
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="nx-grid nx-grid--2">
              {systemCards.map((feature) => (
                <FeatureCard key={feature.title} feature={feature} />
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
                <h2 className="nx-title-sm">Sadə başlayırıq, sistemli böyüdürük.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Məqsəd çox ekran, çox panel, çox qarışıq quruluş deyil. Lazım olan iş axınını tapırıq,
                onu təmiz interfeys və avtomatlaşdırma ilə işlək hala gətiririk.
              </p>
            </div>

            <div className="nx-grid nx-grid--3">
              {steps.map((step) => (
                <StepCard key={step.number} step={step} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--last">
        <div className="nx-container">
          <div className="nx-surface nx-surface--raised nx-surface-pad">
            <div className="nx-split">
              <div className="nx-stack">
                <span className="nx-badge nx-badge--soft">
                  <Sparkles size={15} strokeWidth={2} aria-hidden="true" />
                  Başlamaq üçün
                </span>

                <h2 className="nx-title-sm">Biznesinizə uyğun sistemi birlikdə quraq.</h2>

                <p className="nx-lead">
                  Bir neçə əsas məlumat kifayətdir: nə satırsınız, müştəri haradan yazır və hazırda
                  hansı işlər sizi yavaşladır.
                </p>
              </div>

              <div className="nx-stack">
                <div className="nx-grid">
                  <div className={cx("nx-card", "nx-card--compact", "nx-card--quiet")}>
                    <div className="nx-row">
                      <span className="nx-h4">İlk addım</span>
                      <span className="nx-badge nx-badge--plain">15 dəq</span>
                    </div>
                    <p className="nx-copy-sm nx-mt-xs">
                      Qısa danışıqla sistem xəritəsini və ilk icra istiqamətini müəyyən edirik.
                    </p>
                  </div>
                </div>

                <div className="nx-actions">
                  <Link to={withLang("/contact")} className="nx-button nx-button--primary nx-button--full">
                    Əlaqə saxla
                    <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}