// src/pages/usecases/UseCaseFinance.tsx
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  Banknote,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileText,
  Landmark,
  LockKeyhole,
  MessageSquareText,
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

type IconType = typeof Landmark;

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
    title: "Müraciətlər qarışır",
    desc: "Müştəri sualı, sənəd sorğusu, konsultasiya və satış marağı eyni mesaj axınında itib gedə bilər.",
    icon: MessageSquareText,
  },
  {
    title: "Həssas məlumat riski var",
    desc: "Maliyyə sahəsində cavab sistemi daha kontrollu olmalı, yanlış və riskli cavab verməməlidir.",
    icon: LockKeyhole,
  },
  {
    title: "Sənəd və status sualları çoxalır",
    desc: "Müştərilər sənəd, müraciət, təsdiq və proses statusu haqqında tez-tez yazır.",
    icon: FileText,
  },
];

const solutions: CardItem[] = [
  {
    title: "Kontrollu ilkin cavab",
    desc: "Sistem ümumi məlumatı verir, riskli və fərdi qərar tələb edən halları operatora ötürür.",
    icon: Bot,
  },
  {
    title: "Müraciət məlumatı toplanır",
    desc: "Ad, əlaqə, maraqlandığı xidmət və müraciət tipi strukturlaşdırılır.",
    icon: ClipboardCheck,
  },
  {
    title: "Sənəd sorğuları ayrılır",
    desc: "Müştərinin hansı sənədə və ya proses izahına ehtiyacı olduğu daha aydın görünür.",
    icon: FileCheck2,
  },
  {
    title: "Təhlükəsiz handoff",
    desc: "Həssas, hüquqi və maliyyə qərarı tələb edən hallar insana ötürülür.",
    icon: ShieldCheck,
  },
];

const flow: FlowStep[] = [
  {
    number: "01",
    title: "Müştəri müraciət edir",
    desc: "Xidmət, sənəd, status və ya konsultasiya haqqında sorğu gəlir.",
  },
  {
    number: "02",
    title: "Sorğu tipi ayrılır",
    desc: "Ümumi məlumat, lead, sənəd ehtiyacı və riskli hal kateqoriyalaşdırılır.",
  },
  {
    number: "03",
    title: "Cavab və ya handoff edilir",
    desc: "Təhlükəsiz məlumat verilir, fərdi qərar tələb edən məsələ operatora ötürülür.",
  },
  {
    number: "04",
    title: "Müraciət izlənir",
    desc: "Müştəri məlumatı və maraqlandığı xidmət komanda üçün görünən qalır.",
  },
];

const results = [
  { value: "1", label: "vahid müraciət axını" },
  { value: "↓", label: "təkrar manual cavab" },
  { value: "↑", label: "nəzarətli yönləndirmə" },
];

const rules = [
  "Fərdi maliyyə qərarı avtomatik verilmir.",
  "Həssas məlumat və riskli suallar operatora ötürülür.",
  "Sistem yalnız təsdiqlənmiş xidmət və proses məlumatı ilə cavab verir.",
  "Müştəri müraciəti lead kimi strukturlaşdırılır.",
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

function FinancePreview() {
  return (
    <div className="nx-hero-panel">
      <div className="nx-hero-panel-inner">
        <div className="nx-stack-lg">
          <div className="nx-row nx-row--top">
            <div className="nx-stack-xs">
              <span className="nx-badge nx-badge--soft">
                <Landmark size={15} strokeWidth={2} aria-hidden="true" />
                Maliyyə axını
              </span>
              <h2 className="nx-h3">Müraciətlər kontrollu şəkildə yönləndirilir.</h2>
            </div>

            <Banknote size={21} strokeWidth={1.9} color="var(--nx-accent)" aria-hidden="true" />
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
                  <p className="nx-h4">“Müraciət üçün hansı sənədlər lazımdır?”</p>
                </div>
                <span className="nx-badge nx-badge--soft">Sənəd</span>
              </div>

              <hr className="nx-divider" />

              <div className="nx-row">
                <div className="nx-stack-xs">
                  <p className="nx-eyebrow">Sistem cavabı</p>
                  <p className="nx-copy-sm">
                    Ümumi sənəd siyahısı verilir, fərdi qiymətləndirmə və riskli hallar operatora ötürülür.
                  </p>
                </div>
                <CheckCircle2 size={18} strokeWidth={2} color="var(--nx-success)" aria-hidden="true" />
              </div>
            </div>
          </div>

          <p className="nx-copy-sm">
            Maliyyədə məqsəd sürətli cavabla yanaşı, nəzarəti və təhlükəsiz sərhədləri qorumaqdır.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function UseCaseFinance() {
  const withLang = useLocalizedPath();

  return (
    <main className="nx-page">
      <section className="nx-hero">
        <div className="nx-container">
          <div className="nx-hero-grid">
            <div className="nx-hero-copy">
              <p className="nx-kicker">NEOX / Maliyyə</p>

              <div className="nx-stack">
                <h1 className="nx-display">
                  Maliyyə xidməti üçün <span className="nx-gradient-text">nəzarətli cavab axını.</span>
                </h1>

                <p className="nx-lead nx-max-copy">
                  Müştəri müraciətləri, sənəd sualları və xidmət izahları daha səliqəli idarə olunur.
                  Sistem ümumi məlumat verir, həssas və fərdi qərar tələb edən halları insana ötürür.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Maliyyə axını quraq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/use-cases")} className="nx-button">
                  Bütün sahələr
                </Link>
              </div>

              <div className="nx-chip-row">
                <span className="nx-chip">Müraciət axını</span>
                <span className="nx-chip">Sənəd sorğuları</span>
                <span className="nx-chip">Risk handoff</span>
              </div>
            </div>

            <div className="nx-hero-visual">
              <FinancePreview />
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
                <h2 className="nx-title-sm">Maliyyə sahəsində cavab sürəti ilə nəzarət birlikdə getməlidir.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Bu sahədə avtomatik cavab çox ehtiyatlı qurulmalıdır. Müştəri tez cavab almalıdır,
                amma sistem yanlış və ya fərdi maliyyə qərarı verməməlidir.
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
                <h2 className="nx-title">Sürətli cavab, amma sərhədli və təhlükəsiz davranış.</h2>
                <p className="nx-lead">
                  Sistem ümumi xidmət məlumatını verir, müraciət məlumatını toplayır və həssas hallarda
                  operatorun müdaxiləsini saxlayır.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/services/chatbot-24-7")} className="nx-button">
                  Cavab sistemləri
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
                <h2 className="nx-title-sm">Müraciət dörd addımda strukturlaşdırılır.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Bu axın sizin xidmət tipinizə, compliance tələblərinə və operator qaydalarınıza görə dəyişə bilər.
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
                  Təhlükəsiz qayda
                </span>

                <h2 className="nx-title-sm">Maliyyə cavab sistemində əsas məsələ sərhəddir.</h2>

                <p className="nx-lead">
                  Sistem müştəriyə kömək etməlidir, amma fərdi qərar verməməlidir. Ona görə cavablar
                  təsdiqlənmiş məlumat və operator handoff qaydaları ilə qurulur.
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
                <h2 className="nx-title">Maliyyə sistemi üçün əvvəl qaydalar aydın olmalıdır.</h2>
                <p className="nx-lead">
                  Xidmətlər, sənəd tələbləri, cavab sərhədləri, operatora ötürmə halları və lead məlumatı
                  əvvəl strukturlaşdırılır.
                </p>
              </div>
            </div>

            <div className="nx-grid nx-grid--2">
              {[
                { title: "Xidmət siyahısı", icon: FileText },
                { title: "Müraciət forması", icon: ClipboardCheck },
                { title: "Sənəd tələbləri", icon: FileCheck2 },
                { title: "Operator qaydası", icon: UserRoundCheck },
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
                  Maliyyəyə uyğun
                </span>

                <h2 className="nx-title-sm">Maliyyə xidmətiniz üçün təhlükəsiz cavab axını quraq.</h2>

                <p className="nx-lead">
                  Müştərilər nə soruşur, hansı məlumat verilə bilər və hansı halda operator lazımdır —
                  bunları birlikdə sistemləşdirək.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary nx-button--full">
                  Maliyyə axını üçün danışaq
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