// src/pages/resources/ResourcesDocs.tsx
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  BookMarked,
  Bot,
  CheckCircle2,
  Code2,
  FileText,
  Layers3,
  MessageSquareText,
  ShieldCheck,
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

type DocItem = {
  title: string;
  desc: string;
  tag: string;
  icon: typeof Bot;
};

type DocSection = {
  title: string;
  desc: string;
  items: string[];
};

const docs: DocItem[] = [
  {
    title: "Süni İntellekt cavab sistemi",
    desc: "FAQ, xidmət, qiymət, handoff və lead axını üçün əsas struktur.",
    tag: "AI replies",
    icon: Bot,
  },
  {
    title: "Vebsayt struktur xəritəsi",
    desc: "Hero, xidmətlər, sosial sübut, əlaqə və lead toplama bölmələrinin məntiqi.",
    tag: "Website",
    icon: Layers3,
  },
  {
    title: "Mesajlaşma axını",
    desc: "Instagram DM, sayt forması və gələn sorğular üçün yönləndirmə qaydaları.",
    tag: "Messaging",
    icon: MessageSquareText,
  },
  {
    title: "Workflow avtomatlaşdırması",
    desc: "Təkrar işləri, bildirişləri, təsdiqləri və komanda yönləndirməsini sistemləşdirmək.",
    tag: "Workflow",
    icon: Workflow,
  },
  {
    title: "Təhlükəsiz davranış qaydaları",
    desc: "Süni İntellektin nə vaxt cavab verəcəyi, dayanacağı və operatora ötürəcəyi hallar.",
    tag: "Guardrails",
    icon: ShieldCheck,
  },
  {
    title: "Texniki inteqrasiya qeydləri",
    desc: "API, webhook, forma və kanal qoşulmaları üçün sadə texniki başlanğıc.",
    tag: "Integration",
    icon: Code2,
  },
];

const docSections: DocSection[] = [
  {
    title: "Biznes məlumatları",
    desc: "Sistemin düzgün cavab verməsi üçün əvvəl biznesin əsas məlumatları aydın olmalıdır.",
    items: ["Xidmətlər", "Qiymət məntiqi", "İş saatları", "Əlaqə kanalları"],
  },
  {
    title: "Müştəri sualları",
    desc: "Ən çox verilən suallar qruplaşdırılmalı və cavab qaydası müəyyən edilməlidir.",
    items: ["FAQ", "Qiymət", "Görüş", "Çatdırılma", "Operator"],
  },
  {
    title: "Avtomatlaşdırma qaydaları",
    desc: "Hansı sorğu avtomatik cavablanır, hansı sorğu komandaya ötürülür — əvvəlcədən bilinməlidir.",
    items: ["Routing", "Handoff", "Bildiriş", "Lead qeydiyyatı"],
  },
];

const setupChecklist = [
  "Biznes adı və qısa izah",
  "Əsas xidmətlər və paketlər",
  "Müştərilərin ən çox verdiyi suallar",
  "Əlaqə kanalları və cavab qaydası",
  "Operatora ötürülməli hallar",
];

function DocCard({ item }: { item: DocItem }) {
  const Icon = item.icon;

  return (
    <article className="nx-card nx-card--quiet nx-doc-card">
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
          Struktur
          <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
        </span>
      </div>
    </article>
  );
}

function SectionCard({ item }: { item: DocSection }) {
  return (
    <article className="nx-card nx-card--compact nx-card--quiet">
      <div className="nx-stack">
        <div className="nx-stack-xs">
          <h3 className="nx-h4">{item.title}</h3>
          <p className="nx-copy-sm">{item.desc}</p>
        </div>

        <div className="nx-chip-row">
          {item.items.map((chip) => (
            <span key={chip} className="nx-chip">
              {chip}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function DocsPreview() {
  return (
    <div className="nx-hero-panel">
      <div className="nx-hero-panel-inner">
        <div className="nx-stack-lg">
          <div className="nx-row nx-row--top">
            <div className="nx-stack-xs">
              <span className="nx-badge nx-badge--soft">
                <BookMarked size={15} strokeWidth={2} aria-hidden="true" />
                Sistem sənədləri
              </span>
              <h2 className="nx-h3">Hər cavabın arxasında struktur olmalıdır.</h2>
            </div>
          </div>

          <div className="nx-grid">
            {setupChecklist.map((item, index) => (
              <div key={item} className="nx-surface nx-surface--flat nx-surface-pad nx-doc-preview-row">
                <div className="nx-row">
                  <div className="nx-stack-xs">
                    <p className="nx-eyebrow">0{index + 1}</p>
                    <p className="nx-h4">{item}</p>
                  </div>

                  <CheckCircle2 size={18} strokeWidth={2} color="var(--nx-success)" aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>

          <p className="nx-copy-sm">
            Sənədləşmə ağır texniki kitab deyil — sistemin düzgün işləməsi üçün aydın biznes xəritəsidir.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResourcesDocs() {
  const withLang = useLocalizedPath();

  return (
    <main className="nx-page">
      <section className="nx-hero">
        <div className="nx-container">
          <div className="nx-hero-grid">
            <div className="nx-hero-copy">
              <p className="nx-kicker">NEOX / Docs</p>

              <div className="nx-stack">
                <h1 className="nx-display">
                  Sistemin işləməsi üçün <span className="nx-gradient-text">aydın sənəd strukturu</span> lazımdır.
                </h1>

                <p className="nx-lead nx-max-copy">
                  Vebsayt, Süni İntellekt cavabları, mesajlaşma və avtomatlaşdırma üçün əsas qaydalar
                  əvvəl aydın olmalıdır. Docs hissəsi həmin sistemi sadə şəkildə izah edir.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Sistemi planlaşdıraq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/resources/guides")} className="nx-button">
                  Bələdçilərə bax
                </Link>
              </div>

              <div className="nx-chip-row">
                <span className="nx-chip">Business data</span>
                <span className="nx-chip">AI rules</span>
                <span className="nx-chip">Workflow</span>
              </div>
            </div>

            <div className="nx-hero-visual">
              <DocsPreview />
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--tight">
        <div className="nx-container">
          <div className="nx-stack-xl">
            <div className="nx-row nx-row--top">
              <div className="nx-stack-sm nx-max-copy">
                <p className="nx-kicker">Dokumentasiya</p>
                <h2 className="nx-title-sm">Hər modul üçün sadə struktur.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Bu səhifə ağır developer dokumentasiyası deyil. Məqsəd biznesin sistemə hansı məlumatı
                verməli olduğunu və cavabların hansı qayda ilə işlədiyini aydın göstərməkdir.
              </p>
            </div>

            <div className="nx-grid nx-grid--3">
              {docs.map((item) => (
                <DocCard key={item.title} item={item} />
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
                <p className="nx-kicker">Əsas bloklar</p>
                <h2 className="nx-title">Yaxşı cavab sistemi yaxşı məlumatdan başlayır.</h2>
                <p className="nx-lead">
                  Süni İntellekt sistemi biznesinizi tanımırsa, yaxşı cavab verə bilməz. Ona görə əvvəl
                  xidmət, sual, qayda və yönləndirmə strukturu hazırlanır.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/faq")} className="nx-button">
                  Suallara bax
                </Link>

                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Brif göndər
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="nx-grid">
              {docSections.map((item) => (
                <SectionCard key={item.title} item={item} />
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
                  Praktiki sənəd
                </span>

                <h2 className="nx-title-sm">Biz sənədi sistemin dili üçün hazırlayırıq.</h2>

                <p className="nx-lead">
                  Məqsəd uzun PDF deyil. Məqsəd cavab sisteminin, vebsaytın və avtomatlaşdırmanın eyni
                  biznes məlumatı ilə danışmasıdır.
                </p>
              </div>

              <div className="nx-surface nx-surface--flat nx-surface-pad">
                <div className="nx-stack-sm">
                  <h3 className="nx-h3">Minimum struktur</h3>

                  <ul className="nx-list">
                    <li className="nx-list-item">Biznes nə edir?</li>
                    <li className="nx-list-item">Müştəri ən çox nə soruşur?</li>
                    <li className="nx-list-item">Hansı cavab avtomatik verilə bilər?</li>
                    <li className="nx-list-item">Hansı halda operatora ötürülməlidir?</li>
                  </ul>
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

            <h2 className="nx-title-sm">Biznes məlumatınızı sistemə çevirməyə başlayaq.</h2>

            <p className="nx-lead">
              Qısa məlumat göndərin, sizin üçün hansı veb, cavab və avtomatlaşdırma strukturunun lazım olduğunu çıxaraq.
            </p>

            <div className="nx-actions nx-actions--center">
              <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                Əlaqə saxla
                <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
              </Link>

              <Link to={withLang("/resources/guides")} className="nx-button">
                Bələdçilər
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}