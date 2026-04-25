// src/pages/Privacy.tsx
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCircle2,
  Cookie,
  DatabaseZap,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
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

type PrivacySection = {
  title: string;
  body: string;
};

const sections: PrivacySection[] = [
  {
    title: "Topladığımız məlumatlar",
    body:
      "Sayt üzərindən əlaqə forması göndərdiyiniz zaman ad, email, telefon, şirkət adı və mesaj məzmunu kimi məlumatları ala bilərik. Bu məlumatlar yalnız sizinlə əlaqə saxlamaq və layihə ehtiyacınızı anlamaq üçün istifadə olunur.",
  },
  {
    title: "Məlumatdan necə istifadə edirik",
    body:
      "Məlumatlar sorğunuza cavab vermək, xidmət təklifi hazırlamaq, layihə kommunikasiya axınını aparmaq və dəstək göstərmək üçün istifadə edilə bilər. Məlumatlar məqsədsiz marketinq və ya üçüncü tərəfə satılmaq üçün istifadə olunmur.",
  },
  {
    title: "Texniki məlumatlar",
    body:
      "Saytın işləməsi, təhlükəsizliyi və performansı üçün brauzer tipi, cihaz məlumatı, IP ünvanı və ümumi istifadə analitikası kimi texniki məlumatlar emal oluna bilər.",
  },
  {
    title: "Cookie və oxşar texnologiyalar",
    body:
      "Sayt təcrübəsini yaxşılaşdırmaq, təhlükəsizlik və analitika üçün cookie və oxşar texnologiyalardan istifadə edə bilər. Brauzer ayarlarından cookie-ləri idarə edə bilərsiniz.",
  },
  {
    title: "Məlumatların qorunması",
    body:
      "Məlumatlarınızı qorumaq üçün texniki və təşkilati tədbirlər görürük. Bununla belə internet üzərindən ötürülən heç bir məlumatın 100% təhlükəsizliyinə zəmanət vermək mümkün deyil.",
  },
  {
    title: "Sizin hüquqlarınız",
    body:
      "Siz şəxsi məlumatlarınızla bağlı məlumat almaq, düzəliş tələb etmək və qanunvericiliyə uyğun hallarda silinməsini istəmək üçün bizimlə əlaqə saxlaya bilərsiniz.",
  },
];

const principles = [
  {
    title: "Məqsədli istifadə",
    desc: "Məlumat yalnız əlaqə, təklif və xidmət kommunikasiya məqsədi ilə istifadə olunur.",
    icon: UserRoundCheck,
  },
  {
    title: "Təhlükəsiz yanaşma",
    desc: "Məlumatların qorunması üçün uyğun texniki və təşkilati tədbirlər görülür.",
    icon: LockKeyhole,
  },
  {
    title: "Şəffaflıq",
    desc: "Hansı məlumatın niyə istifadə olunduğunu aydın izah etməyə çalışırıq.",
    icon: ShieldCheck,
  },
  {
    title: "Nəzarət",
    desc: "Məlumatlarınızla bağlı sual və müraciət üçün bizimlə əlaqə saxlaya bilərsiniz.",
    icon: Mail,
  },
];

function PrincipleCard({ item }: { item: (typeof principles)[number] }) {
  const Icon = item.icon;

  return (
    <article className="nx-card nx-card--compact nx-card--quiet">
      <div className="nx-stack-sm">
        <span className="nx-badge nx-badge--soft nx-badge--plain">
          <Icon size={16} strokeWidth={2} aria-hidden="true" />
        </span>

        <div className="nx-stack-xs">
          <h2 className="nx-h4">{item.title}</h2>
          <p className="nx-copy-sm">{item.desc}</p>
        </div>
      </div>
    </article>
  );
}

export default function Privacy() {
  const withLang = useLocalizedPath();

  return (
    <main className="nx-page">
      <section className="nx-section nx-section--first">
        <div className="nx-container">
          <div className="nx-stack-xl">
            <div className="nx-split">
              <div className="nx-stack">
                <p className="nx-kicker">NEOX / Məxfilik siyasəti</p>

                <h1 className="nx-display">
                  Məlumatlarınızla bağlı <span className="nx-gradient-text">şəffaf və təhlükəsiz</span> yanaşma.
                </h1>

                <p className="nx-lead nx-max-copy">
                  Bu səhifə NEOX saytından istifadə zamanı hansı məlumatların toplana biləcəyini,
                  necə istifadə olunduğunu və bizimlə necə əlaqə saxlaya biləcəyinizi izah edir.
                </p>

                <div className="nx-chip-row">
                  <span className="nx-chip">Son yenilənmə: 2026</span>
                  <span className="nx-chip">NEOX</span>
                  <span className="nx-chip">Məxfilik</span>
                </div>
              </div>

              <div className="nx-hero-panel">
                <div className="nx-hero-panel-inner">
                  <div className="nx-stack-lg">
                    <div className="nx-row nx-row--top">
                      <div className="nx-stack-xs">
                        <span className="nx-badge nx-badge--soft">
                          <ShieldCheck size={15} strokeWidth={2} aria-hidden="true" />
                          Privacy
                        </span>
                        <h2 className="nx-h3">Əsas prinsip sadədir.</h2>
                      </div>

                      <Sparkles size={20} strokeWidth={1.9} color="var(--nx-accent)" aria-hidden="true" />
                    </div>

                    <div className="nx-grid">
                      {[
                        "Məlumat məqsədli istifadə olunur.",
                        "Lazımsız məlumat toplamaq istəmirik.",
                        "Sorğularınız üçün bizimlə əlaqə saxlaya bilərsiniz.",
                      ].map((item) => (
                        <div key={item} className="nx-row">
                          <span className="nx-list-item">{item}</span>
                          <CheckCircle2 size={18} strokeWidth={2} color="var(--nx-success)" aria-hidden="true" />
                        </div>
                      ))}
                    </div>

                    <p className="nx-copy-sm">
                      Bu mətn ümumi məlumat üçündür və hüquqi məsləhət kimi qəbul edilməməlidir.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="nx-grid nx-grid--4">
              {principles.map((item) => (
                <PrincipleCard key={item.title} item={item} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section-divider">
        <div className="nx-container">
          <div className="nx-split nx-split--top">
            <aside className="nx-stack-lg">
              <div className="nx-surface nx-surface--raised nx-surface-pad">
                <div className="nx-stack">
                  <span className="nx-badge nx-badge--soft">
                    <DatabaseZap size={15} strokeWidth={2} aria-hidden="true" />
                    Data
                  </span>

                  <h2 className="nx-title-sm">Məxfilik mətni sadə və oxunaqlı olmalıdır.</h2>

                  <p className="nx-copy">
                    Burada məqsəd sizə uzun, qarışıq hüquqi mətn göstərmək deyil. Məlumatın hansı məqsədlə
                    istifadə olunduğunu aydın izah etməkdir.
                  </p>
                </div>
              </div>

              <div className="nx-surface nx-surface--soft nx-surface-pad">
                <div className="nx-stack-sm">
                  <span className="nx-badge nx-badge--plain">
                    <Cookie size={14} strokeWidth={2} aria-hidden="true" />
                    Cookie
                  </span>
                  <p className="nx-copy-sm">
                    Cookie-lər saytın işləməsi və analitika üçün istifadə oluna bilər. Brauzer ayarlarınızdan
                    onları idarə edə bilərsiniz.
                  </p>
                </div>
              </div>
            </aside>

            <div className="nx-stack">
              {sections.map((section) => (
                <article key={section.title} className="nx-card nx-card--quiet">
                  <div className="nx-stack-xs">
                    <h2 className="nx-h3">{section.title}</h2>
                    <p className="nx-copy">{section.body}</p>
                  </div>
                </article>
              ))}
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
                  <Mail size={15} strokeWidth={2} aria-hidden="true" />
                  Əlaqə
                </span>

                <h2 className="nx-title-sm">Məxfiliklə bağlı sualınız var?</h2>

                <p className="nx-lead">
                  Məlumatlarınız və ya bu məxfilik siyasəti ilə bağlı sualınız varsa, bizimlə əlaqə saxlayın.
                </p>
              </div>

              <div className="nx-actions">
                <a href="mailto:info@weneox.com" className="nx-button nx-button--primary nx-button--full">
                  info@weneox.com
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </a>

                <Link to={withLang("/terms")} className="nx-button nx-button--full">
                  Şərtlərə bax
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}