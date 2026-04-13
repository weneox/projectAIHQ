import { Link, useLocation } from "react-router-dom";
import { Mail, Phone, ArrowUpRight, Linkedin, Github } from "lucide-react";
import { useTranslation } from "react-i18next";

const SUPPORTED_LANGS = ["az", "en", "tr", "ru", "es"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

function isLang(value: string | undefined | null): value is Lang {
  return Boolean(value && SUPPORTED_LANGS.includes(value as Lang));
}

function getLangFromPath(pathname: string): Lang {
  const seg = (pathname.split("/")[1] || "").toLowerCase();
  return isLang(seg) ? seg : "az";
}

function withLang(path: string, lang: Lang) {
  if (path === "/") return `/${lang}`;
  return `/${lang}${path.startsWith("/") ? path : `/${path}`}`;
}

export default function Footer() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const lang = getLangFromPath(pathname);
  const year = new Date().getFullYear();

  const companyLinks = [
    { to: "/about", label: t("footer.company.links.about") || "About" },
    { to: "/services/chatbot-24-7", label: t("footer.company.links.services") || "Services" },
    { to: "/use-cases", label: t("footer.company.links.useCases") || "Use Cases" },
    { to: "/pricing", label: t("nav.pricing") || "Pricing" },
  ];

  const resourceLinks = [
    { to: "/blog", label: t("footer.resources.links.blog") || "Blog" },
    { to: "/faq", label: t("footer.resources.links.faq") || "FAQ" },
    { to: "/contact", label: t("footer.resources.links.contact") || "Contact" },
    { to: "/privacy", label: "Privacy" },
    { to: "/terms", label: "Terms" },
  ];

  return (
    <footer className="neox-footer" aria-label={t("footer.aria") || "Footer"}>
      <div className="neo-footerShell">
        <div className="neo-footerInner">
          <div className="neo-footerGrid">
            <div className="neo-stack-20">
              <Link
                to={withLang("/", lang)}
                className="neo-brand"
                aria-label="NEOX"
                data-wg-notranslate
                style={{ width: "fit-content" }}
              >
                <span className="neo-brandMark">
                  <img src="/image/neox-logo.png" alt="NEOX" draggable={false} />
                </span>

                <span className="neo-brandText">
                  <span className="neo-brandTitle">NEOX</span>
                  <span className="neo-brandSub">Operational intelligence</span>
                </span>
              </Link>

              <p className="neo-body" style={{ maxWidth: 520 }}>
                {t("footer.brand.copy") ||
                  "We build refined digital systems for modern businesses — clear interfaces, strong automation, and real operational leverage."}
              </p>

              <div className="neo-pillRow">
                <a href="mailto:info@weneox.com" className="neo-pill" aria-label="Email NEOX">
                  <Mail size={15} />
                  <span>info@weneox.com</span>
                </a>

                <a href="tel:+994518005577" className="neo-pill" aria-label="Call NEOX">
                  <Phone size={15} />
                  <span>+994 51 800 55 77</span>
                </a>
              </div>

              <div className="neo-actions">
                <Link to={withLang("/contact", lang)} className="neo-btn neo-btn--primary">
                  <span>{t("footer.cta.primary") || "Start a conversation"}</span>
                  <ArrowUpRight size={16} />
                </Link>

                <Link to={withLang("/services/chatbot-24-7", lang)} className="neo-btn neo-btn--ghost">
                  {t("footer.cta.secondary") || "Explore services"}
                </Link>
              </div>
            </div>

            <div>
              <div className="neo-footerTitle">{t("footer.company.title") || "Company"}</div>

              <div className="neo-footerLinks">
                {companyLinks.map((item) => (
                  <Link key={item.to} to={withLang(item.to, lang)} className="neo-footerLink">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <div className="neo-footerTitle">{t("footer.resources.title") || "Resources"}</div>

              <div className="neo-footerLinks">
                {resourceLinks.map((item) => (
                  <Link key={item.to} to={withLang(item.to, lang)} className="neo-footerLink">
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <div className="neo-footerBottom">
            <span>
              {t("footer.bottom.copy", { year }) || `© ${year} NEOX. All rights reserved.`}
            </span>

            <div className="neo-socialRow" aria-label={t("footer.social.aria") || "Social links"}>
              <a
                href="#"
                className="neo-socialButton"
                aria-label={t("footer.social.linkedin") || "LinkedIn"}
              >
                <Linkedin size={16} />
              </a>

              <a
                href="#"
                className="neo-socialButton"
                aria-label={t("footer.social.github") || "GitHub"}
              >
                <Github size={16} />
              </a>

              <a
                href="mailto:info@weneox.com"
                className="neo-socialButton"
                aria-label={t("footer.social.email") || "Email"}
              >
                <Mail size={16} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}