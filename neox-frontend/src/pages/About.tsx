// src/pages/About.tsx
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Compass,
  Gauge,
  Layers3,
  LockKeyhole,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Target,
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

type IconType = typeof Target;

type Principle = {
  title: string;
  desc: string;
  icon: IconType;
};

type MethodStep = {
  number: string;
  title: string;
  desc: string;
};

const principles: Principle[] = [
  {
    title: "Əvvəl sistem, sonra effekt",
    desc: "Biz sadəcə gözəl görünən Süni İntellekt demo-ları qurmuruq. Əsas məqsəd real biznes axınını daha səliqəli və idarəolunan etməkdir.",
    icon: Target,
  },
  {
    title: "İş axınına uyğun quruluş",
    desc: "Hər biznesin müştəri, satış və dəstək axını fərqlidir. Sistemi həmin reallığa uyğun dizayn edirik.",
    icon: Workflow,
  },
  {
    title: "Nəzarət itmir",
    desc: "Süni İntellekt hər şeyi kor-koranə etmir. Qayda, sərhəd, operatora ötürmə və izləmə mexanizmi saxlanılır.",
    icon: ShieldCheck,
  },
  {
    title: "Sadə interfeys, güclü məntiq",
    desc: "Panel-panel görüntü yox. İstifadəçi üçün təmiz səth, arxada isə düzgün işləyən avtomatlaşdırma.",
    icon: Layers3,
  },
];

const capabilities: Principle[] = [
  {
    title: "Mesajlaşma sistemləri",
    desc: "Instagram, sayt və digər kanallardan gələn sorğuların cavab və yönləndirmə axını.",
    icon: MessageSquareText,
  },
  {
    title: "Süni İntellekt cavabları",
    desc: "FAQ, xidmət, qiymət, lead və operatora ötürmə qaydaları ilə işləyən cavab sistemi.",
    icon: Bot,
  },
  {
    title: "Avtomatlaşdırma",
    desc: "Təkrar manual işləri azaltmaq üçün bildiriş, qeydiyyat, təsdiq və izləmə axınları.",
    icon: Gauge,
  },
  {
    title: "Təhlükəsiz icra",
    desc: "Riskli sorğular, həssas məlumatlar və biznes qaydaları üçün kontrollu davranış.",
    icon: LockKeyhole,
  },
];

const methodSteps: MethodStep[] = [
  {
    number: "01",
    title: "Biznesi dinləyirik",
    desc: "Sahəni, müştəri suallarını, satış yolunu və hazırkı problemləri başa düşürük.",
  },
  {
    number: "02",
    title: "Axını sadələşdiririk",
    desc: "Dağınıq mesajları, manual işləri və təkrarlanan addımları bir sistem xəritəsinə salırıq.",
  },
  {
    number: "03",
    title: "Premium səth qururuq",
    desc: "İstifadəçiyə yüngül görünən, amma arxada real iş görən interfeys və avtomatlaşdırma yaradırıq.",
  },
  {
    number: "04",
    title: "Ölçür və yaxşılaşdırırıq",
    desc: "Cavab sürəti, lead keyfiyyəti, komanda yükü və müştəri təcrübəsi izlənir.",
  },
];

const proof = ["Şablon olmayan yanaşma", "Biznesə uyğun sistem", "Təmiz və premium interfeys", "Ölçülə bilən nəticə"];

function PrincipleCard({ item }: { item: Principle }) {
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

function MethodCard({ step }: { step: MethodStep }) {
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

function AboutPreview() {
  return (
    <div className="nx-hero-panel">
      <div className="nx-hero-panel-inner">
        <div className="nx-stack-lg">
          <div className="nx-row nx-row--top">
            <div className="nx-stack-xs">
              <span className="nx-badge nx-badge--soft">NEOX yanaşması</span>
              <h2 className="nx-h3">Sadə görünən, sistemli işləyən quruluş</h2>
            </div>

            <Sparkles size={20} strokeWidth={1.9} color="var(--nx-accent)" aria-hidden="true" />
          </div>

          <div className="nx-surface nx-surface--flat nx-surface-pad">
            <div className="nx-stack">
              <div className="nx-row">
                <div className="nx-stack-xs">
                  <p className="nx-eyebrow">Problem</p>
                  <p className="nx-h4">Mesajlar, lead-lər və manual işlər dağınıqdır.</p>
                </div>
              </div>

              <hr className="nx-divider" />

              <div className="nx-row">
                <div className="nx-stack-xs">
                  <p className="nx-eyebrow">Həll</p>
                  <p className="nx-h4">Vahid səth + Süni İntellekt + avtomatlaşdırma.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="nx-grid">
            {proof.map((item) => (
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

export default function About() {
  const withLang = useLocalizedPath();

  return (
    <main className="nx-page">
      <section className="nx-hero">
        <div className="nx-container">
          <div className="nx-hero-grid">
            <div className="nx-hero-copy">
              <p className="nx-kicker">NEOX / Haqqımızda</p>

              <div className="nx-stack">
                <h1 className="nx-display">
                  Biz texnologiyanı <span className="nx-gradient-text">işlək biznes sisteminə</span> çeviririk.
                </h1>

                <p className="nx-lead nx-max-copy">
                  NEOX bizneslər üçün premium veb səthlər, Süni İntellekt cavab sistemləri və
                  avtomatlaşdırılmış iş axınları qurur. Məqsəd daha çox komponent yox, daha az qarışıqlıqdır.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Layihəni danışaq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/services/chatbot-24-7")} className="nx-button">
                  Xidmətlərə bax
                </Link>
              </div>

              <div className="nx-chip-row">
                <span className="nx-chip">Premium interface</span>
                <span className="nx-chip">Süni İntellekt</span>
                <span className="nx-chip">Avtomatlaşdırma</span>
              </div>
            </div>

            <div className="nx-hero-visual">
              <AboutPreview />
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--tight">
        <div className="nx-container">
          <div className="nx-grid nx-grid--4">
            {principles.map((item) => (
              <PrincipleCard key={item.title} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="nx-section">
        <div className="nx-container">
          <div className="nx-split nx-split--top">
            <div className="nx-stack-lg">
              <div className="nx-stack">
                <p className="nx-kicker">Fəlsəfə</p>
                <h2 className="nx-title">Texnologiya görünməməli, biznes işləməlidir.</h2>
                <p className="nx-lead">
                  Çox panel, çox effekt, çox izah — bunlar sistemi premium etmir. Premium hiss
                  o zaman yaranır ki, hər şey sakit, aydın və yerində işləyir.
                </p>
              </div>

              <div className="nx-surface nx-surface--soft nx-surface-pad">
                <div className="nx-stack-sm">
                  <h3 className="nx-h3">Bizim üçün yaxşı sistem nədir?</h3>
                  <p className="nx-copy">
                    Müştəri yazanda cavab gecikmir. Komanda eyni sualı təkrar cavablamır.
                    Lead itmir. İş axını görünür. İstifadəçi isə bütün bunları qarışıq panel kimi yox,
                    sadə və təmiz bir səth kimi görür.
                  </p>
                </div>
              </div>
            </div>

            <div className="nx-grid nx-grid--2">
              {capabilities.map((item) => (
                <PrincipleCard key={item.title} item={item} />
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
                <p className="nx-kicker">Metod</p>
                <h2 className="nx-title-sm">Səliqəli nəticə üçün proses də səliqəli olmalıdır.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Hər layihədə əvvəl dağınıqlığı anlayırıq, sonra onu daha sadə sistemə çeviririk.
                Dizayn və avtomatlaşdırma eyni məqsədə xidmət edir: işin axması.
              </p>
            </div>

            <div className="nx-grid nx-grid--4">
              {methodSteps.map((step) => (
                <MethodCard key={step.number} step={step} />
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
                  <Compass size={15} strokeWidth={2} aria-hidden="true" />
                  İstiqamət
                </span>

                <h2 className="nx-title-sm">Biz agentlik kimi yox, sistem qurucusu kimi düşünürük.</h2>

                <p className="nx-lead">
                  Sadəcə sayt hazırlamaq, bot qoşmaq və ya bir dashboard yaratmaq kifayət deyil.
                  Əsas məsələ bunların biznesin real axınına düzgün oturmasıdır.
                </p>
              </div>

              <div className="nx-grid">
                <div className="nx-card nx-card--compact nx-card--quiet">
                  <div className="nx-stack-xs">
                    <h3 className="nx-h4">Nə etmirik?</h3>
                    <p className="nx-copy-sm">
                      Şablon interfeys, boş animasiya, real iş axını olmayan demo və panel-içində-panel görüntü.
                    </p>
                  </div>
                </div>

                <div className="nx-card nx-card--compact nx-card--quiet">
                  <div className="nx-stack-xs">
                    <h3 className="nx-h4">Nə edirik?</h3>
                    <p className="nx-copy-sm">
                      Premium light səth, biznesə uyğun cavab sistemi, avtomatlaşdırma və ölçülə bilən icra.
                    </p>
                  </div>
                </div>

                <div className="nx-actions">
                  <Link to={withLang("/contact")} className="nx-button nx-button--primary nx-button--full">
                    Biznesiniz üçün danışaq
                    <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--last nx-section-divider">
        <div className="nx-container">
          <div className="nx-stack-lg nx-text-center" style={{ maxWidth: 820, margin: "0 auto" }}>
            <p className="nx-kicker" style={{ marginInline: "auto" }}>
              NEOX
            </p>

            <h2 className="nx-title-sm">Daha az səs-küy. Daha çox sistem.</h2>

            <p className="nx-lead">
              Bizim dizayn və texnologiya dilimiz budur: aydınlıq, premium səth, real icra və biznesə uyğun Süni İntellekt.
            </p>

            <div className="nx-actions nx-actions--center">
              <Link to={withLang("/services/chatbot-24-7")} className="nx-button">
                Xidmətlər
              </Link>

              <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                Əlaqə saxla
                <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}