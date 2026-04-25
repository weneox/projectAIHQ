// src/components/Footer.tsx
import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, Github, Instagram, Linkedin, Mail, Phone } from "lucide-react";
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

const companyLinks = [
  { label: "Haqqımızda", to: "/about" },
  { label: "Xidmətlər", to: "/services/chatbot-24-7" },
  { label: "İstifadə sahələri", to: "/use-cases" },
  { label: "Qiymətlər", to: "/pricing" },
];

const resourceLinks = [
  { label: "Bloq", to: "/blog" },
  { label: "Suallar", to: "/faq" },
  { label: "Bələdçilər", to: "/resources/guides" },
  { label: "Məxfilik", to: "/privacy" },
  { label: "Şərtlər", to: "/terms" },
];

const serviceLinks = [
  { label: "Süni İntellekt çat sistemləri", to: "/services/chatbot-24-7" },
  { label: "Biznes avtomatlaşdırması", to: "/services/business-workflows" },
  { label: "Premium veb saytlar", to: "/services/websites" },
  { label: "Sosial media sistemləri", to: "/services/smm-automation" },
];

export default function Footer() {
  const withLang = useLocalizedPath();
  const year = new Date().getFullYear();

  const email = "info@weneox.com";
  const phone = "+994 51 800 55 77";
  const cleanPhone = phone.replace(/\s+/g, "");

  return (
    <footer className="nx-footer" aria-label="Footer">
      <div className="nx-footer-inner">
        <div className="nx-footer-grid">
          <div className="nx-stack-lg">
            <div className="nx-stack">
              <Link to={withLang("/")} className="nx-footer-brand" aria-label="NEOX" data-wg-notranslate>
                <img src={LOGO_SRC} alt="NEOX" loading="lazy" decoding="async" draggable={false} />
              </Link>

              <div className="nx-stack-sm nx-max-tight">
                <span className="nx-badge nx-badge--soft">Süni İntellekt sistemləri</span>

                <p className="nx-lead">
                  Bizneslər üçün premium veb səthlər, Süni İntellekt cavab sistemləri və avtomatlaşdırılmış iş
                  axınları qururuq.
                </p>
              </div>
            </div>

            <div className="nx-footer-contact">
              <a className="nx-footer-contact-item" href={`mailto:${email}`} aria-label="Email göndər">
                <Mail size={17} strokeWidth={1.9} aria-hidden="true" />
                <span>{email}</span>
              </a>

              <a className="nx-footer-contact-item" href={`tel:${cleanPhone}`} aria-label="Zəng et">
                <Phone size={17} strokeWidth={1.9} aria-hidden="true" />
                <span>{phone}</span>
              </a>
            </div>

            <div className="nx-footer-socials" aria-label="Sosial keçidlər">
              <a className="nx-footer-social" href="#" aria-label="Instagram">
                <Instagram size={18} strokeWidth={1.9} aria-hidden="true" />
              </a>

              <a className="nx-footer-social" href="#" aria-label="LinkedIn">
                <Linkedin size={18} strokeWidth={1.9} aria-hidden="true" />
              </a>

              <a className="nx-footer-social" href="#" aria-label="GitHub">
                <Github size={18} strokeWidth={1.9} aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="nx-footer-col">
            <h2 className="nx-footer-title">Şirkət</h2>

            <nav className="nx-footer-nav" aria-label="Şirkət">
              {companyLinks.map((item) => (
                <Link key={item.to} to={withLang(item.to)} className="nx-footer-link">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="nx-footer-col">
            <h2 className="nx-footer-title">Xidmətlər</h2>

            <nav className="nx-footer-nav" aria-label="Xidmətlər">
              {serviceLinks.map((item) => (
                <Link key={item.to} to={withLang(item.to)} className="nx-footer-link">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="nx-footer-col">
            <h2 className="nx-footer-title">Resurslar</h2>

            <nav className="nx-footer-nav" aria-label="Resurslar">
              {resourceLinks.map((item) => (
                <Link key={item.to} to={withLang(item.to)} className="nx-footer-link">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="nx-footer-bottom">
          <p>© {year} NEOX — Ağıllı biznes sistemləri.</p>

          <Link to={withLang("/contact")} className="nx-link">
            Əlaqə saxla
            <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </footer>
  );
}