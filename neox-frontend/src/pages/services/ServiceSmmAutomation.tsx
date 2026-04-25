// src/pages/services/ServiceSmmAutomation.tsx
import { Link, useParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  BarChart3,
  Bot,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Image,
  Instagram,
  Megaphone,
  MessageSquareText,
  PenTool,
  Repeat2,
  ShieldCheck,
  Sparkles,
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
    title: "Kontent planı",
    desc: "Mövzu, format, paylaşım ritmi və CTA-lar sistemli təqvimə salınır.",
    icon: CalendarDays,
  },
  {
    title: "Caption və ideya axını",
    desc: "Post, story, reels və kampaniya mətnləri brend tonuna uyğun hazırlanır.",
    icon: PenTool,
  },
  {
    title: "DM cavab sistemi",
    desc: "Kontentdən gələn suallar cavab, lead və operator axınına bağlana bilər.",
    icon: MessageSquareText,
  },
  {
    title: "Nəticə izləmə",
    desc: "Baxış, müraciət, lead və kampaniya nəticələri daha görünən olur.",
    icon: BarChart3,
  },
];

const modules: ServiceItem[] = [
  {
    title: "Instagram kontent sistemi",
    desc: "Reels, post, story və highlight mövzuları üçün planlı struktur.",
    icon: Instagram,
  },
  {
    title: "Kampaniya axını",
    desc: "Təklif, endirim, launch və xüsusi kampaniyalar üçün CTA və mesaj sistemi.",
    icon: Megaphone,
  },
  {
    title: "Vizual brief",
    desc: "Dizayn, şəkil, video və brend materialları üçün daha aydın brief sistemi.",
    icon: Image,
  },
  {
    title: "Təkrar istifadə edilən formatlar",
    desc: "Hər dəfə 0-dan başlamamaq üçün stabil kontent formatları və rubrikalar.",
    icon: Repeat2,
  },
];

const steps: Step[] = [
  {
    number: "01",
    title: "Brend dili aydınlaşır",
    desc: "Kimə danışdığınız, nə satdığınız və sosial mediada hansı tonun uyğun olduğu müəyyən edilir.",
  },
  {
    number: "02",
    title: "Kontent sütunları seçilir",
    desc: "Maarifləndirici, satış, sübut, behind-the-scenes və FAQ mövzuları qruplaşdırılır.",
  },
  {
    number: "03",
    title: "Plan və formatlar hazırlanır",
    desc: "Post, story, reels, caption və CTA-lar üçün sistemli təqvim qurulur.",
  },
  {
    number: "04",
    title: "DM və lead axını bağlanır",
    desc: "Kontentdən gələn mesajlar cavab və lead sisteminə qoşula bilər.",
  },
];

const results = [
  { value: "30", label: "günlük kontent xəritəsi" },
  { value: "↑", label: "brend ardıcıllığı" },
  { value: "↓", label: "hər dəfə sıfırdan düşünmə" },
];

const rules = [
  "Kontent sadəcə paylaşım yox, müştəri axınının başlanğıcıdır.",
  "Hər postun məqsədi və növbəti addımı olmalıdır.",
  "DM-lər cavab və lead sisteminə bağlananda kontent daha çox iş görür.",
  "Brend tonu və vizual dil hər paylaşımda eyni qalmalıdır.",
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

function SmmPreview() {
  return (
    <div className="nx-hero-panel">
      <div className="nx-hero-panel-inner">
        <div className="nx-stack-lg">
          <div className="nx-row nx-row--top">
            <div className="nx-stack-xs">
              <span className="nx-badge nx-badge--soft">
                <Instagram size={15} strokeWidth={2} aria-hidden="true" />
                SMM sistemi
              </span>
              <h2 className="nx-h3">Kontent daha planlı və satışa bağlı işləyir.</h2>
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
                  <p className="nx-eyebrow">Kontent</p>
                  <p className="nx-h4">Post → DM → cavab → lead axını</p>
                </div>
                <span className="nx-badge nx-badge--soft">Growth</span>
              </div>

              <hr className="nx-divider" />

              <div className="nx-row">
                <div className="nx-stack-xs">
                  <p className="nx-eyebrow">Sistem</p>
                  <p className="nx-copy-sm">
                    Kontent mövzusu, CTA və gələn mesajların cavablanması eyni biznes məntiqinə bağlanır.
                  </p>
                </div>
                <CheckCircle2 size={18} strokeWidth={2} color="var(--nx-success)" aria-hidden="true" />
              </div>
            </div>
          </div>

          <p className="nx-copy-sm">
            SMM avtomatlaşdırması paylaşımı çoxaltmaq yox, kontenti biznes axınına bağlamaqdır.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ServiceSmmAutomation() {
  const withLang = useLocalizedPath();

  return (
    <main className="nx-page">
      <section className="nx-hero">
        <div className="nx-container">
          <div className="nx-hero-grid">
            <div className="nx-hero-copy">
              <p className="nx-kicker">NEOX / SMM avtomatlaşdırması</p>

              <div className="nx-stack">
                <h1 className="nx-display">
                  Sosial media üçün <span className="nx-gradient-text">planlı kontent və cavab sistemi.</span>
                </h1>

                <p className="nx-lead nx-max-copy">
                  Kontent ideyası, paylaşım ritmi, caption, CTA və mesajlardan gələn lead axını daha sistemli qurulur.
                  Məqsəd sadəcə post paylaşmaq yox, sosial medianı biznes prosesinə bağlamaqdır.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  SMM sistemi quraq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/pricing")} className="nx-button">
                  Qiymət məntiqi
                </Link>
              </div>

              <div className="nx-chip-row">
                <span className="nx-chip">Kontent planı</span>
                <span className="nx-chip">Caption sistemi</span>
                <span className="nx-chip">DM lead axını</span>
              </div>
            </div>

            <div className="nx-hero-visual">
              <SmmPreview />
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
                <h2 className="nx-title-sm">Kontent təsadüfi yox, sistemli işləməlidir.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Hər paylaşımın rolu olmalıdır: tanıtmaq, inandırmaq, sual yaratmaq və ya satışa yaxınlaşdırmaq.
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
                <p className="nx-kicker">Modullar</p>
                <h2 className="nx-title">SMM sistemi kontent və mesaj axınını birləşdirir.</h2>
                <p className="nx-lead">
                  Kontent paylaşılır, müştəri sual verir, cavab sistemi işləyir və lead yaranır.
                  Bu hissələr ayrı-ayrı yox, eyni biznes dili ilə qurulmalıdır.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/services/chatbot-24-7")} className="nx-button">
                  Cavab sistemləri
                </Link>

                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Kontent axını danışaq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="nx-grid nx-grid--2">
              {modules.map((item) => (
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
                <h2 className="nx-title-sm">SMM avtomatlaşdırması planla başlayır.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Əvvəl brend dili və mövzular, sonra formatlar, sonra paylaşım və mesaj axını qurulur.
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
                  Kontent qaydası
                </span>

                <h2 className="nx-title-sm">Yaxşı SMM daha çox post yox, daha aydın sistemdir.</h2>

                <p className="nx-lead">
                  Sosial media biznesə xidmət etməlidir. Kontent mövzuları, CTA və DM cavabları eyni
                  müştəri yoluna bağlananda nəticə daha stabil olur.
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
                <h2 className="nx-title">SMM üçün əvvəl brend və müştəri sualları bilinməlidir.</h2>
                <p className="nx-lead">
                  Nə satırsınız, müştəri nə soruşur, hansı mövzular etibar yaradır və postdan sonra hansı action
                  olmalıdır — sistem buradan başlayır.
                </p>
              </div>
            </div>

            <div className="nx-grid nx-grid--2">
              {[
                { title: "Kontent sütunları", icon: ClipboardList },
                { title: "Caption və CTA", icon: PenTool },
                { title: "Vizual brief", icon: Image },
                { title: "DM cavab axını", icon: Bot },
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

                <h2 className="nx-title-sm">Sosial medianızı sistemli biznes axınına çevirək.</h2>

                <p className="nx-lead">
                  Brendinizi, xidmətlərinizi və müştərilərin ən çox verdiyi sualları göndərin,
                  SMM və DM cavab axınını birlikdə quraq.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary nx-button--full">
                  SMM sistemi quraq
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