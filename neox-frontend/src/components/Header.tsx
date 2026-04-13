import React, { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronDown, Globe, Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DEFAULT_LANG, type Lang } from "../i18n/lang";

type HeaderProps = {
  introReady?: boolean;
};

const LANGS: Lang[] = ["az", "en", "tr", "ru", "es"];

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function isLang(value: string | undefined | null): value is Lang {
  return Boolean(value && LANGS.includes(value as Lang));
}

function langLabel(lang: Lang) {
  switch (lang) {
    case "az":
      return "AZ";
    case "en":
      return "EN";
    case "tr":
      return "TR";
    case "ru":
      return "RU";
    case "es":
      return "ES";
    default:
      return String(lang).toUpperCase();
  }
}

function langFullName(lang: Lang) {
  switch (lang) {
    case "az":
      return "Azərbaycan";
    case "en":
      return "English";
    case "tr":
      return "Türkçe";
    case "ru":
      return "Русский";
    case "es":
      return "Español";
    default:
      return String(lang).toUpperCase();
  }
}

function stripLangPrefix(pathname: string) {
  return pathname.replace(/^\/(az|en|tr|ru|es)(?=\/|$)/i, "") || "/";
}

export default function Header({ introReady = true }: HeaderProps) {
  const { t, i18n } = useTranslation();
  const { pathname, search, hash } = useLocation();
  const { lang: routeLang } = useParams<{ lang?: string }>();
  const navigate = useNavigate();

  const lang: Lang = isLang(routeLang) ? routeLang : DEFAULT_LANG;

  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    setLangOpen(false);
  }, [pathname, search, hash]);

  useEffect(() => {
    if (!mobileOpen) return;

    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [mobileOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLangOpen(false);
        setMobileOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const navItems = useMemo(
    () => [
      { to: "/", label: t("nav.home") || "Home" },
      { to: "/about", label: t("nav.about") || "About" },
      { to: "/services/chatbot-24-7", label: t("nav.services") || "Services" },
      { to: "/use-cases", label: t("nav.useCases") || "Use Cases" },
      { to: "/pricing", label: t("nav.pricing") || "Pricing" },
      { to: "/blog", label: t("nav.blog") || "Blog" },
      { to: "/contact", label: t("nav.contact") || "Contact" },
    ],
    [t]
  );

  const withLang = (to: string) => {
    if (to === "/") return `/${lang}`;
    return `/${lang}${to.startsWith("/") ? to : `/${to}`}`;
  };

  const isActiveItem = (to: string) => {
    const localized = withLang(to);

    if (to === "/") {
      return pathname === localized;
    }

    if (to === "/services/chatbot-24-7") {
      return pathname.startsWith(`/${lang}/services`);
    }

    return pathname === localized || pathname.startsWith(`${localized}/`);
  };

  const switchLang = async (nextLang: Lang) => {
    if (nextLang === lang) {
      setLangOpen(false);
      return;
    }

    const rest = stripLangPrefix(pathname);
    const nextPath = rest === "/" ? `/${nextLang}` : `/${nextLang}${rest}`;

    try {
      await i18n.changeLanguage(nextLang);
    } catch {
      // no-op
    }

    setLangOpen(false);
    setMobileOpen(false);
    navigate(`${nextPath}${search}${hash}`);
  };

  return (
    <header className={cx("neo-header", introReady && "is-ready")}>
      <div className="neo-headerInner">
        <Link to={withLang("/")} className="neo-brand" aria-label="NEOX" data-wg-notranslate>
          <span className="neo-brandMark">
            <img src="/image/neox-logo.png" alt="NEOX" draggable={false} />
          </span>

          <span className="neo-brandText">
            <span className="neo-brandTitle">NEOX</span>
            <span className="neo-brandSub">Operational intelligence</span>
          </span>
        </Link>

        <nav className="neo-nav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={withLang(item.to)}
              className={cx("neo-navLink", isActiveItem(item.to) && "is-active")}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="neo-headerRight">
          <div
            style={{ position: "relative" }}
            onMouseLeave={() => setLangOpen(false)}
          >
            <button
              type="button"
              className="neo-headerChip"
              aria-haspopup="menu"
              aria-expanded={langOpen}
              onClick={() => setLangOpen((open) => !open)}
            >
              <Globe size={15} />
              {langLabel(lang)}
              <ChevronDown size={14} />
            </button>

            {langOpen ? (
              <div
                className="neo-surface neo-surface--soft"
                role="menu"
                aria-label="Language menu"
                style={{
                  position: "absolute",
                  top: "calc(100% + 10px)",
                  right: 0,
                  width: 210,
                  padding: 8,
                  borderRadius: 20,
                  boxShadow: "var(--neo-shadow-md)",
                  zIndex: 30,
                }}
              >
                <div className="neo-stack-12">
                  {LANGS.map((code) => (
                    <button
                      key={code}
                      type="button"
                      role="menuitem"
                      onClick={() => switchLang(code)}
                      style={{
                        minHeight: 42,
                        borderRadius: 14,
                        border: `1px solid ${
                          code === lang ? "rgba(37, 99, 235, 0.14)" : "transparent"
                        }`,
                        background:
                          code === lang ? "rgba(37, 99, 235, 0.08)" : "transparent",
                        color: code === lang ? "var(--neo-accent)" : "var(--neo-text-soft)",
                        fontWeight: 650,
                        fontSize: 14,
                        padding: "0 12px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "background 180ms ease, color 180ms ease, border-color 180ms ease",
                      }}
                    >
                      <span>{langFullName(code)}</span>
                      <span style={{ fontSize: 12, opacity: 0.8 }}>{langLabel(code)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <Link to={withLang("/contact")} className="neo-btn neo-btn--primary">
            {t("nav.contact") || "Contact"}
          </Link>

          <button
            type="button"
            className="neo-mobileTrigger"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="neo-mobilePanel">
          <div className="neo-mobilePanelNav">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={withLang(item.to)}
                className={cx("neo-mobilePanelLink", isActiveItem(item.to) && "is-active")}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}

            <div className="neo-divider" style={{ margin: "4px 0" }} />

            {LANGS.map((code) => (
              <button
                key={code}
                type="button"
                className="neo-mobilePanelLink"
                onClick={() => switchLang(code)}
                style={{
                  justifyContent: "space-between",
                  background:
                    code === lang ? "rgba(37, 99, 235, 0.08)" : "transparent",
                  color: code === lang ? "var(--neo-accent)" : "var(--neo-text-soft)",
                  border:
                    code === lang
                      ? "1px solid rgba(37, 99, 235, 0.08)"
                      : "1px solid transparent",
                  cursor: "pointer",
                }}
              >
                <span>{langFullName(code)}</span>
                <span style={{ fontSize: 12, opacity: 0.8 }}>{langLabel(code)}</span>
              </button>
            ))}

            <Link
              to={withLang("/contact")}
              className="neo-btn neo-btn--primary"
              onClick={() => setMobileOpen(false)}
              style={{ width: "100%", marginTop: 4 }}
            >
              {t("nav.contact") || "Contact"}
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}