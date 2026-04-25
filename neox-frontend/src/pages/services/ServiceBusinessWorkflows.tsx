// src/pages/services/ServiceBusinessWorkflows.tsx
import { Link, useParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  FileCheck2,
  Gauge,
  GitBranch,
  MessageSquareText,
  PackageCheck,
  ShieldCheck,
  Sparkles,
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
    title: "Lead yönləndirmə",
    desc: "Gələn sorğu uyğun komanda üzvünə, kanalına və ya statusa görə yönləndirilir.",
    icon: GitBranch,
  },
  {
    title: "Təsdiq axınları",
    desc: "Sifariş, təklif, sənəd və daxili qərarlar üçün sadə approval prosesi qurulur.",
    icon: ClipboardCheck,
  },
  {
    title: "Bildiriş sistemi",
    desc: "Vacib hadisələr komandaya email, mesaj və ya daxili xəbərdarlıq kimi ötürülür.",
    icon: BellRing,
  },
  {
    title: "Status izləmə",
    desc: "Sorğunun açıq, gözləyən, cavablanmış və ya operatora ötürülmüş vəziyyəti görünür.",
    icon: Gauge,
  },
];

const workflows: ServiceItem[] = [
  {
    title: "Müştəri sorğusu → lead",
    desc: "Form, DM və ya sayt mesajı lead kimi strukturlaşdırılır.",
    icon: MessageSquareText,
  },
  {
    title: "Lead → komanda",
    desc: "Müraciət xidmət, prioritet və kanal üzrə uyğun komandaya ötürülür.",
    icon: UserRoundCheck,
  },
  {
    title: "Sənəd → təsdiq",
    desc: "Təklif, faktura və ya müraciət sənədi təsdiq axınına salınır.",
    icon: FileCheck2,
  },
  {
    title: "Hadisə → bildiriş",
    desc: "Gecikmə, yeni lead, status dəyişikliyi və xüsusi hallar komandaya bildirilir.",
    icon: PackageCheck,
  },
];

const steps: Step[] = [
  {
    number: "01",
    title: "Proses xəritəsi çıxarılır",
    desc: "Manual işlər, təkrarlanan addımlar və gecikmə yaradan nöqtələr müəyyən edilir.",
  },
  {
    number: "02",
    title: "Qaydalar yazılır",
    desc: "Kimə, nə vaxt, hansı məlumatla və hansı şərtlə ötürüləcəyi strukturlaşdırılır.",
  },
  {
    number: "03",
    title: "Workflow qurulur",
    desc: "Bildiriş, status, təsdiq və yönləndirmə axınları sistemə salınır.",
  },
  {
    number: "04",
    title: "Ölçülür və təmizlənir",
    desc: "Gecikmə, təkrar iş və operator yükü izlənərək axın optimallaşdırılır.",
  },
];

const results = [
  { value: "↓", label: "manual təkrar iş" },
  { value: "↑", label: "komanda aydınlığı" },
  { value: "1", label: "vahid proses axını" },
];

const rules = [
  "Əvvəl proses aydınlaşır, sonra avtomatlaşdırılır.",
  "Hər bildiriş və yönləndirmənin real səbəbi olmalıdır.",
  "Komanda üçün artıq panel yox, aydın status lazımdır.",
  "Workflow böyüdükcə ölçülməli və təmizlənməlidir.",
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

function WorkflowPreview() {
  return (
    <div className="nx-hero-panel">
      <div className="nx-hero-panel-inner">
        <div className="nx-stack-lg">
          <div className="nx-row nx-row--top">
            <div className="nx-stack-xs">
              <span className="nx-badge nx-badge--soft">
                <Workflow size={15} strokeWidth={2} aria-hidden="true" />
                Workflow sistemi
              </span>
              <h2 className="nx-h3">Manual addımlar daha səliqəli axına düşür.</h2>
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
                  <p className="nx-h4">Yeni müştəri sorğusu gəldi</p>
                </div>
                <span className="nx-badge nx-badge--soft">Lead</span>
              </div>

              <hr className="nx-divider" />

              <div className="nx-row">
                <div className="nx-stack-xs">
                  <p className="nx-eyebrow">Workflow</p>
                  <p className="nx-copy-sm">
                    Sorğu qeyd olunur, uyğun komandaya ötürülür və statusu görünən qalır.
                  </p>
                </div>
                <CheckCircle2 size={18} strokeWidth={2} color="var(--nx-success)" aria-hidden="true" />
              </div>
            </div>
          </div>

          <p className="nx-copy-sm">
            Məqsəd daha çox dashboard yox, işin harada olduğunu aydın göstərən sadə prosesdir.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ServiceBusinessWorkflows() {
  const withLang = useLocalizedPath();

  return (
    <main className="nx-page">
      <section className="nx-hero">
        <div className="nx-container">
          <div className="nx-hero-grid">
            <div className="nx-hero-copy">
              <p className="nx-kicker">NEOX / Biznes avtomatlaşdırması</p>

              <div className="nx-stack">
                <h1 className="nx-display">
                  Təkrar işləri <span className="nx-gradient-text">səliqəli workflow sisteminə</span> çeviririk.
                </h1>

                <p className="nx-lead nx-max-copy">
                  Lead yönləndirmə, təsdiq, bildiriş, status izləmə və komanda handoff prosesləri daha aydın
                  və ölçülə bilən hala gəlir.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Workflow quraq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/pricing")} className="nx-button">
                  Qiymət məntiqi
                </Link>
              </div>

              <div className="nx-chip-row">
                <span className="nx-chip">Lead routing</span>
                <span className="nx-chip">Approval</span>
                <span className="nx-chip">Status tracking</span>
              </div>
            </div>

            <div className="nx-hero-visual">
              <WorkflowPreview />
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--tight">
        <div className="nx-container">
          <div className="nx-stack-xl">
            <div className="nx-row nx-row--top">
              <div className="nx-stack-sm nx-max-copy">
                <p className="nx-kicker">Nə avtomatlaşır?</p>
                <h2 className="nx-title-sm">Komandanı yoran təkrar addımlar sistemə düşür.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Avtomatlaşdırma hər şeyi robota vermək deyil. Ən çox gecikən, təkrarlanan və qarışıqlıq yaradan
                addımları səliqəli axına salmaqdır.
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
                <p className="nx-kicker">Axın nümunələri</p>
                <h2 className="nx-title">Hər proses əvvəl sadələşir, sonra avtomatlaşır.</h2>
                <p className="nx-lead">
                  Əgər prosesin qaydası aydın deyilsə, avtomatlaşdırma qarışıqlığı artırır. Ona görə əvvəl
                  iş axınını təmizləyirik, sonra sistemə çeviririk.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/resources/guides")} className="nx-button">
                  Bələdçilərə bax
                </Link>

                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Prosesimi izah edim
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="nx-grid nx-grid--2">
              {workflows.map((item) => (
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
                <h2 className="nx-title-sm">Workflow mərhələli şəkildə qurulur.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Bir anda bütün biznesi avtomatlaşdırmırıq. Əvvəl ən real ağrını tapırıq və oradan başlayırıq.
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
                  Sadəlik qaydası
                </span>

                <h2 className="nx-title-sm">Yaxşı workflow daha çox panel deyil, daha az qərarsızlıqdır.</h2>

                <p className="nx-lead">
                  Komanda harada nə baş verdiyini anlamalıdır. Buna görə avtomatlaşdırma sakit, aydın və
                  işə xidmət edən formada qurulur.
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
                <h2 className="nx-title">Başlamaq üçün prosesinizi bir cümlə ilə izah edin.</h2>
                <p className="nx-lead">
                  “Yeni lead gələndə komanda gec xəbər tutur”, “Sənəd təsdiqi itir”, “Müştəri status soruşanda
                  cavab gecikir” — bu cümlələr workflow üçün kifayət qədər yaxşı başlanğıcdır.
                </p>
              </div>
            </div>

            <div className="nx-grid nx-grid--2">
              {[
                { title: "Giriş nöqtəsi", icon: MessageSquareText },
                { title: "Qərar qaydası", icon: GitBranch },
                { title: "Məlumat saxlanması", icon: DatabaseZap },
                { title: "Bildiriş və status", icon: BellRing },
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

                <h2 className="nx-title-sm">Biznes prosesinizi səliqəli workflow-a çevirək.</h2>

                <p className="nx-lead">
                  Ən çox təkrarlanan, gecikən və komandanı yoran prosesi yazın. Onu necə sadələşdirəcəyimizi
                  birlikdə çıxaraq.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary nx-button--full">
                  Workflow quraq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/services/chatbot-24-7")} className="nx-button nx-button--full">
                  Cavab sistemləri
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}