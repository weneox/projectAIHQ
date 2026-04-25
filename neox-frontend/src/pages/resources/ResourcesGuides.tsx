// src/pages/resources/ResourcesGuides.tsx
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  BookOpenText,
  Bot,
  CheckCircle2,
  ClipboardList,
  Compass,
  FileText,
  Layers3,
  MessageSquareText,
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

type Guide = {
  title: string;
  desc: string;
  tag: string;
  icon: typeof Bot;
};

type ChecklistItem = {
  title: string;
  desc: string;
};

const guides: Guide[] = [
  {
    title: "Müştəri suallarını necə strukturlaşdırmaq olar?",
    desc: "FAQ, qiymət, xidmət, çatdırılma və operatora ötürmə suallarını cavab sistemi üçün düzgün ayırmaq.",
    tag: "Süni İntellekt",
    icon: Bot,
  },
  {
    title: "Premium vebsayt üçün başlanğıc xəritəsi",
    desc: "Hero, xidmət bölməsi, əlaqə axını və lead toplama hissəsini qarışdırmadan necə qurmaq olar.",
    tag: "Vebsayt",
    icon: Layers3,
  },
  {
    title: "Instagram DM cavab axını necə planlanır?",
    desc: "Müştəri niyyəti, hazır cavab, lead məlumatı və operatora ötürmə məntiqini sadə sxemə salmaq.",
    tag: "Mesajlaşma",
    icon: MessageSquareText,
  },
  {
    title: "Workflow avtomatlaşdırmasına haradan başlamaq lazımdır?",
    desc: "Ən çox təkrarlanan manual işi tapmaq və onu ölçülə bilən sistemə çevirmək.",
    tag: "Avtomatlaşdırma",
    icon: Workflow,
  },
  {
    title: "Layihə brifi necə yazılmalıdır?",
    desc: "Biznes, problem, kanal, müştəri tipi və gözlənilən nəticəni qısa formada izah etmək.",
    tag: "Brief",
    icon: ClipboardList,
  },
  {
    title: "Süni İntellekt üçün təhlükəsiz davranış qaydaları",
    desc: "Nəyə cavab verə bilər, harada dayanmalıdır və nə vaxt operatora ötürməlidir?",
    tag: "Nəzarət",
    icon: Compass,
  },
];

const checklist: ChecklistItem[] = [
  {
    title: "Müştəri kanallarını yazın",
    desc: "Instagram, WhatsApp, sayt forması, zəng və digər giriş nöqtələrini qeyd edin.",
  },
  {
    title: "Ən çox verilən sualları toplayın",
    desc: "Qiymət, xidmət, vaxt, çatdırılma, görüş və şikayət suallarını ayrıca qruplaşdırın.",
  },
  {
    title: "Manual işləri seçin",
    desc: "Komandanı ən çox yoran təkrar cavab, yönləndirmə və qeydiyyat işlərini müəyyən edin.",
  },
  {
    title: "Nəticəni sadə yazın",
    desc: "Daha sürətli cavab, daha çox lead, daha az manual iş və ya daha səliqəli veb səth.",
  },
];

function GuideCard({ item }: { item: Guide }) {
  const Icon = item.icon;

  return (
    <article className="nx-card nx-card--quiet nx-guide-card">
      <div className="nx-stack">
        <div className="nx-row nx-row--top">
          <span className="nx-badge nx-badge--soft nx-badge--plain">
            <Icon size={16} strokeWidth={2} aria-hidden="true" />
          </span>

          <span className="nx-badge nx-badge--plain">{item.tag}</span>
        </div>

        <div className="nx-stack-xs">
          <h2 className="nx-h3">{item.title}</h2>
          <p className="nx-copy-sm">{item.desc}</p>
        </div>

        <span className="nx-link">
          Oxu xəritəsi
          <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

function ChecklistCard({ item, index }: { item: ChecklistItem; index: number }) {
  return (
    <article className="nx-card nx-card--compact nx-card--quiet">
      <div className="nx-stack-sm">
        <span className="nx-badge nx-badge--plain">0{index + 1}</span>

        <div className="nx-stack-xs">
          <h3 className="nx-h4">{item.title}</h3>
          <p className="nx-copy-sm">{item.desc}</p>
        </div>
      </div>
    </article>
  );
}

function GuidesPreview() {
  return (
    <div className="nx-hero-panel">
      <div className="nx-hero-panel-inner">
        <div className="nx-stack-lg">
          <div className="nx-row nx-row--top">
            <div className="nx-stack-xs">
              <span className="nx-badge nx-badge--soft">
                <BookOpenText size={15} strokeWidth={2} aria-hidden="true" />
                Bələdçi sistemi
              </span>
              <h2 className="nx-h3">Qarışıqlığı sadə xəritəyə çevirin.</h2>
            </div>

            <Sparkles size={20} strokeWidth={1.9} color="var(--nx-accent)" aria-hidden="true" />
          </div>

          <div className="nx-grid">
            {checklist.map((item, index) => (
              <div key={item.title} className="nx-surface nx-surface--flat nx-surface-pad nx-guide-preview-row">
                <div className="nx-row">
                  <div className="nx-stack-xs">
                    <p className="nx-eyebrow">0{index + 1}</p>
                    <p className="nx-h4">{item.title}</p>
                  </div>

                  <CheckCircle2 size={18} strokeWidth={2} color="var(--nx-success)" aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>

          <p className="nx-copy-sm">
            Yaxşı sistem texniki mürəkkəblikdən yox, düzgün suallardan başlayır.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResourcesGuides() {
  const withLang = useLocalizedPath();

  return (
    <main className="nx-page">
      <section className="nx-hero">
        <div className="nx-container">
          <div className="nx-hero-grid">
            <div className="nx-hero-copy">
              <p className="nx-kicker">NEOX / Bələdçilər</p>

              <div className="nx-stack">
                <h1 className="nx-display">
                  Biznes sistemini qurmazdan əvvəl{" "}
                  <span className="nx-gradient-text">doğru xəritə</span> lazımdır.
                </h1>

                <p className="nx-lead nx-max-copy">
                  Vebsayt, mesajlaşma, Süni İntellekt cavabları və avtomatlaşdırma üçün praktik başlanğıc
                  bələdçiləri. Məqsəd çox termin yox, aydın qərardır.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Biznesimi izah edim
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/faq")} className="nx-button">
                  Suallara bax
                </Link>
              </div>

              <div className="nx-chip-row">
                <span className="nx-chip">Brief</span>
                <span className="nx-chip">Workflow</span>
                <span className="nx-chip">Süni İntellekt</span>
              </div>
            </div>

            <div className="nx-hero-visual">
              <GuidesPreview />
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--tight">
        <div className="nx-container">
          <div className="nx-stack-xl">
            <div className="nx-row nx-row--top">
              <div className="nx-stack-sm nx-max-copy">
                <p className="nx-kicker">Bələdçilər</p>
                <h2 className="nx-title-sm">Başlamaq üçün praktik mövzular.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Bu bələdçilər sistemi daha düzgün düşünmək üçündür: hansı məlumat lazımdır, hansı iş
                avtomatlaşdırılmalıdır və nə artıqdır.
              </p>
            </div>

            <div className="nx-grid nx-grid--3">
              {guides.map((item) => (
                <GuideCard key={item.title} item={item} />
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
                <p className="nx-kicker">Hazırlıq</p>
                <h2 className="nx-title">Layihəyə başlamazdan əvvəl bu 4 şeyi yazın.</h2>
                <p className="nx-lead">
                  Qısa və səliqəli məlumat layihənin daha tez və daha düzgün başlamasına kömək edir.
                  Böyük sənəd lazım deyil; əsas olan doğru suallara cavabdır.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Brif göndər
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/blog")} className="nx-button">
                  Resurslara bax
                </Link>
              </div>
            </div>

            <div className="nx-grid nx-grid--2">
              {checklist.map((item, index) => (
                <ChecklistCard key={item.title} item={item} index={index} />
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
                  <FileText size={15} strokeWidth={2} aria-hidden="true" />
                  Qısa brief
                </span>

                <h2 className="nx-title-sm">Ən yaxşı başlanğıc: problemi bir cümlə ilə yazmaq.</h2>

                <p className="nx-lead">
                  “Müştərilər Instagram-da çox yazır, cavab gecikir və lead-lər itir.” Bu cümlə artıq
                  sistem xəritəsi üçün kifayət qədər güclü başlanğıcdır.
                </p>
              </div>

              <div className="nx-surface nx-surface--flat nx-surface-pad">
                <div className="nx-stack-sm">
                  <h3 className="nx-h3">Brief nümunəsi</h3>
                  <p className="nx-copy">
                    Klinikamız üçün premium sayt və Instagram mesajlarına cavab sistemi istəyirik.
                    Müştərilər daha çox qiymət, xidmət və görüş vaxtı soruşur. Komandamız bu suallara
                    manual cavab verməkdən yorulur.
                  </p>
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
              Növbəti addım
            </p>

            <h2 className="nx-title-sm">Bələdçini oxumaq yox, sistemə çevirmək lazımdır.</h2>

            <p className="nx-lead">
              Biznesinizi qısa izah edin, hansı veb, cavab və avtomatlaşdırma axınının daha uyğun olduğunu çıxaraq.
            </p>

            <div className="nx-actions nx-actions--center">
              <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                Bizə yaz
                <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
              </Link>

              <Link to={withLang("/services/chatbot-24-7")} className="nx-button">
                Xidmətlərə bax
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}