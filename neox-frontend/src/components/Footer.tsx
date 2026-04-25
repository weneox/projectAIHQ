import {
  ArrowUpRight,
  Github,
  Instagram,
  Linkedin,
  Mail,
  Phone,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
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

const LOGO_SRC = "/image/neox-logo.png";

const email = "info@weneox.com";
const phone = "+994 51 800 55 77";
const cleanPhone = phone.replace(/\s+/g, "");

const footerGroups = [
  {
    title: "NEOX",
    links: [
      { label: "Ana səhifə", to: "/" },
      { label: "Haqqımızda", to: "/about" },
      { label: "Qiymətlər", to: "/pricing" },
      { label: "Əlaqə", to: "/contact" },
    ],
  },
  {
    title: "Həllər",
    links: [
      { label: "Süni İntellekt çat sistemləri", to: "/services/chatbot-24-7" },
      { label: "Biznes workflow", to: "/services/business-workflows" },
      { label: "Premium veb sayt", to: "/services/websites" },
      { label: "Sosial media axını", to: "/services/smm-automation" },
    ],
  },
  {
    title: "Sahələr",
    links: [
      { label: "Klinikalar", to: "/use-cases/healthcare" },
      { label: "Logistika", to: "/use-cases/logistics" },
      { label: "Pərakəndə satış", to: "/use-cases/retail" },
      { label: "Hotellər", to: "/use-cases/hotels" },
    ],
  },
  {
    title: "Resurslar",
    links: [
      { label: "Bloq", to: "/blog" },
      { label: "Suallar", to: "/faq" },
      { label: "Məxfilik", to: "/privacy" },
      { label: "Şərtlər", to: "/terms" },
    ],
  },
];

export default function Footer() {
  const withLang = useLocalizedPath();
  const year = new Date().getFullYear();

  return (
    <footer className="nx-footer" aria-label="Footer">
      <div className="nx-footer-inner">
        <div className="nx-footer-main">
          <div className="nx-footer-brand-col">
            <Link to={withLang("/")} className="nx-footer-brand" aria-label="NEOX" data-wg-notranslate>
              <img src={LOGO_SRC} alt="NEOX" loading="lazy" decoding="async" draggable={false} />
            </Link>

            <p className="nx-footer-copy">
              Bizneslər üçün veb sayt, mesajlaşma və avtomatlaşdırma sistemlərini vahid axında qururuq.
            </p>

            <div className="nx-footer-contact">
              <a href={`mailto:${email}`} className="nx-footer-contact-link" aria-label="Email göndər">
                <Mail size={16} strokeWidth={1.85} aria-hidden="true" />
                <span>{email}</span>
              </a>

              <a href={`tel:${cleanPhone}`} className="nx-footer-contact-link" aria-label="Zəng et">
                <Phone size={16} strokeWidth={1.85} aria-hidden="true" />
                <span>{phone}</span>
              </a>
            </div>
          </div>

          <div className="nx-footer-links">
            {footerGroups.map((group) => (
              <div key={group.title} className="nx-footer-col">
                <h2 className="nx-footer-title">{group.title}</h2>

                <nav className="nx-footer-nav" aria-label={group.title}>
                  {group.links.map((item) => (
                    <Link key={item.to} to={withLang(item.to)} className="nx-footer-link">
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </div>
            ))}
          </div>
        </div>

        <div className="nx-footer-bottom">
          <p>© {year} NEOX. Ağıllı biznes sistemləri.</p>

          <div className="nx-footer-bottom-right">
            <div className="nx-footer-socials" aria-label="Sosial keçidlər">
              <a className="nx-footer-social" href="#" aria-label="Instagram">
                <Instagram size={16} strokeWidth={1.85} aria-hidden="true" />
              </a>

              <a className="nx-footer-social" href="#" aria-label="LinkedIn">
                <Linkedin size={16} strokeWidth={1.85} aria-hidden="true" />
              </a>

              <a className="nx-footer-social" href="#" aria-label="GitHub">
                <Github size={16} strokeWidth={1.85} aria-hidden="true" />
              </a>
            </div>

            <Link to={withLang("/contact")} className="nx-footer-bottom-link">
              Əlaqə saxla
              <ArrowUpRight size={14} strokeWidth={1.9} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}