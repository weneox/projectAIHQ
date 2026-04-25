// src/pages/Terms.tsx
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Handshake,
  Mail,
  Scale,
  ShieldCheck,
  Sparkles,
  Wrench,
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

type TermsSection = {
  title: string;
  body: string;
};

const sections: TermsSection[] = [
  {
    title: "Saytdan istifadə",
    body:
      "NEOX saytından istifadə edərkən qanuna, etik qaydalara və saytın normal işləməsinə mane olmayan davranışa əməl etməlisiniz. Saytdakı məlumatlar ümumi tanıtım və məlumatlandırma məqsədi daşıyır.",
  },
  {
    title: "Xidmətlərin xarakteri",
    body:
      "NEOX vebsayt, Süni İntellekt cavab sistemi, avtomatlaşdırma, mobil tətbiq və texniki dəstək kimi rəqəmsal xidmətlər təqdim edə bilər. Hər layihənin həcmi, müddəti və nəticəsi ayrıca razılaşdırılır.",
  },
  {
    title: "Təklif və razılaşma",
    body:
      "Saytdakı məlumatlar avtomatik olaraq yekun müqavilə və ya sabit qiymət təklifi sayılmır. Layihə şərtləri, qiymət, icra müddəti və təhvil formatı ayrıca yazılı razılaşma ilə təsdiqlənir.",
  },
  {
    title: "Müştəri məlumatları",
    body:
      "Layihə üçün təqdim etdiyiniz məlumatların düzgünlüyünə görə siz məsuliyyət daşıyırsınız. Yanlış və ya natamam məlumat layihə nəticəsinə və icra müddətinə təsir edə bilər.",
  },
  {
    title: "İntellektual mülkiyyət",
    body:
      "Layihə çərçivəsində yaradılan dizayn, kod, mətn və sistem strukturlarının istifadə hüquqları tərəflər arasında ayrıca razılaşdırıla bilər. Üçüncü tərəfə məxsus materiallardan istifadə zamanı uyğun icazələr müştəri tərəfindən təmin edilməlidir.",
  },
  {
    title: "Məhdudiyyətlər",
    body:
      "NEOX qanunsuz, zərərli, aldadıcı və ya üçüncü şəxslərin hüquqlarını pozan layihələrdə iştirak etməmək hüququnu saxlayır. Sistemlər real biznes ehtiyacına və təhlükəsiz istifadə qaydalarına uyğun qurulmalıdır.",
  },
  {
    title: "Dəyişikliklər",
    body:
      "Bu şərtlər zaman-zaman yenilənə bilər. Yenilənmiş versiya sayt üzərində yayımlandığı andan qüvvəyə minir.",
  },
];

const principles = [
  {
    title: "Aydın razılaşma",
    desc: "Layihənin həcmi, qiyməti və müddəti ayrıca təsdiqlənir.",
    icon: Handshake,
  },
  {
    title: "Düzgün məlumat",
    desc: "Layihə üçün verilən biznes məlumatlarının düzgünlüyü vacibdir.",
    icon: ClipboardCheck,
  },
  {
    title: "Təhlükəsiz istifadə",
    desc: "Sistemlər qanuni və təhlükəsiz biznes məqsədləri üçün qurulur.",
    icon: ShieldCheck,
  },
  {
    title: "Dəyişiklik qaydası",
    desc: "Yeni ehtiyaclar və dəyişikliklər ayrıca scope kimi razılaşdırıla bilər.",
    icon: Wrench,
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

export default function Terms() {
  const withLang = useLocalizedPath();

  return (
    <main className="nx-page">
      <section className="nx-section nx-section--first">
        <div className="nx-container">
          <div className="nx-stack-xl">
            <div className="nx-split">
              <div className="nx-stack">
                <p className="nx-kicker">NEOX / İstifadə şərtləri</p>

                <h1 className="nx-display">
                  Xidmətlərdən istifadə üçün <span className="nx-gradient-text">sadə və aydın şərtlər.</span>
                </h1>

                <p className="nx-lead nx-max-copy">
                  Bu səhifə NEOX saytından və xidmətlərindən istifadə ilə bağlı ümumi şərtləri izah edir.
                  Layihə üzrə yekun razılaşmalar ayrıca təsdiqlənir.
                </p>

                <div className="nx-chip-row">
                  <span className="nx-chip">Son yenilənmə: 2026</span>
                  <span className="nx-chip">NEOX</span>
                  <span className="nx-chip">Şərtlər</span>
                </div>
              </div>

              <div className="nx-hero-panel">
                <div className="nx-hero-panel-inner">
                  <div className="nx-stack-lg">
                    <div className="nx-row nx-row--top">
                      <div className="nx-stack-xs">
                        <span className="nx-badge nx-badge--soft">
                          <Scale size={15} strokeWidth={2} aria-hidden="true" />
                          Terms
                        </span>
                        <h2 className="nx-h3">Əsas məntiq sadədir.</h2>
                      </div>

                      <Sparkles size={20} strokeWidth={1.9} color="var(--nx-accent)" aria-hidden="true" />
                    </div>

                    <div className="nx-grid">
                      {[
                        "Saytdakı məlumat yekun müqavilə deyil.",
                        "Hər layihənin scope-u ayrıca razılaşdırılır.",
                        "Təhlükəsiz və qanuni istifadə əsas şərtdir.",
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
                    <FileText size={15} strokeWidth={2} aria-hidden="true" />
                    Agreement
                  </span>

                  <h2 className="nx-title-sm">Şərtlər layihənin ümumi çərçivəsini izah edir.</h2>

                  <p className="nx-copy">
                    Konkret layihə üçün xidmət həcmi, təhvil formatı, müddət, ödəniş və dəstək şərtləri ayrıca
                    razılaşdırılmalıdır.
                  </p>
                </div>
              </div>

              <div className="nx-surface nx-surface--soft nx-surface-pad">
                <div className="nx-stack-sm">
                  <span className="nx-badge nx-badge--plain">Qeyd</span>
                  <p className="nx-copy-sm">
                    Əgər layihə üzrə xüsusi müqavilə və ya yazılı razılaşma varsa, həmin sənəd bu ümumi şərtlərdən üstün ola bilər.
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

                <h2 className="nx-title-sm">Şərtlərlə bağlı sualınız var?</h2>

                <p className="nx-lead">
                  Xidmət həcmi, layihə razılaşması və ya bu şərtlərlə bağlı sualınız varsa, bizimlə əlaqə saxlayın.
                </p>
              </div>

              <div className="nx-actions">
                <a href="mailto:info@weneox.com" className="nx-button nx-button--primary nx-button--full">
                  info@weneox.com
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </a>

                <Link to={withLang("/privacy")} className="nx-button nx-button--full">
                  Məxfilik siyasəti
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}