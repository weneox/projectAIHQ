// src/components/Footer.tsx
import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Mail, Linkedin, Twitter, Github, Phone } from "lucide-react";

const SUPPORTED_LANGS = ["az", "tr", "en", "ru", "es"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

function getLangFromPath(pathname: string): Lang {
  const seg = (pathname.split("/")[1] || "").toLowerCase();
  return (SUPPORTED_LANGS as readonly string[]).includes(seg) ? (seg as Lang) : "az";
}

function withLang(path: string, lang: Lang) {
  if (!path.startsWith("/")) return `/${lang}/${path}`;
  return `/${lang}${path}`;
}

export default function Footer() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  const year = new Date().getFullYear();
  const phone = "+994 51 800 55 77";
  const email = "info@weneox.com";

  const lang = useMemo(() => getLangFromPath(pathname), [pathname]);

  return (
    <footer className="neox-footer" aria-label={t("footer.aria")}>
      <div className="neox-foot-bg" aria-hidden="true" />
      <div className="neox-foot-noise" aria-hidden="true" />
      <div className="neox-foot-vignette" aria-hidden="true" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-14 relative">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-3 mb-4 neox-foot-brandRow">
              <Link to={withLang("/", lang)} className="neox-logoWrap" aria-label="NEOX" data-wg-notranslate>
                <span className="neox-logoAura" aria-hidden="true" />
                <span className="neox-logoGlint" aria-hidden="true" />
                <img src="/image/neox-logo.png" alt="NEOX" className="neox-logoImg" draggable={false} />
              </Link>

              <span className="neox-foot-badge">{t("footer.brand.badge")}</span>
            </div>

            <p className="neox-footer-text max-w-md">{t("footer.brand.copy")}</p>

            <div className="neox-foot-contact mt-6" aria-label={t("footer.contact.aria")}>
              <a className="neox-foot-contactItem" href={`mailto:${email}`} aria-label={t("footer.contact.emailAria")}>
                <span className="neox-foot-ic" aria-hidden="true">
                  <Mail className="w-4 h-4" aria-hidden="true" />
                </span>
                <span className="neox-foot-contactText">{email}</span>
              </a>

              <a
                className="neox-foot-contactItem"
                href={`tel:${phone.replace(/\s+/g, "")}`}
                aria-label={t("footer.contact.phoneAria")}
              >
                <span className="neox-foot-ic" aria-hidden="true">
                  <Phone className="w-4 h-4" aria-hidden="true" />
                </span>
                <span className="neox-foot-contactText">{phone}</span>
              </a>
            </div>

            <div className="flex gap-3 mt-6 neox-foot-socialRow" aria-label={t("footer.social.aria")}>
              <a href="#" className="neox-social" aria-label={t("footer.social.twitter")}>
                <Twitter className="w-5 h-5" aria-hidden="true" />
              </a>
              <a href="#" className="neox-social" aria-label={t("footer.social.linkedin")}>
                <Linkedin className="w-5 h-5" aria-hidden="true" />
              </a>
              <a href="#" className="neox-social" aria-label={t("footer.social.github")}>
                <Github className="w-5 h-5" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="neox-foot-title">{t("footer.company.title")}</h3>
            <ul className="space-y-3 neox-foot-linksCol">
              <li>
                <Link to={withLang("/about", lang)} className="neox-foot-link">
                  {t("footer.company.links.about")}
                </Link>
              </li>
              <li>
                <Link to={withLang("/services", lang)} className="neox-foot-link">
                  {t("footer.company.links.services")}
                </Link>
              </li>
              <li>
                <Link to={withLang("/use-cases", lang)} className="neox-foot-link">
                  {t("footer.company.links.useCases")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="neox-foot-title">{t("footer.resources.title")}</h3>
            <ul className="space-y-3 neox-foot-linksCol">
              <li>
                <Link to={withLang("/blog", lang)} className="neox-foot-link">
                  {t("footer.resources.links.blog")}
                </Link>
              </li>
              <li>
                <Link to={withLang("/contact", lang)} className="neox-foot-link">
                  {t("footer.resources.links.contact")}
                </Link>
              </li>
              <li>
                <Link to={withLang("/privacy", lang)} className="neox-foot-link">
                  Privacy
                </Link>
              </li>
              <li>
                <Link to={withLang("/terms", lang)} className="neox-foot-link">
                  Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="neox-foot-divider mt-12 pt-8 text-center">
          <p className="neox-foot-copy">{t("footer.bottom.copy", { year })}</p>
        </div>
      </div>

      <style>{`
        .neox-footer{
          position:relative;
          background:#000;
          overflow:hidden;
          border-top:1px solid rgba(255,255,255,.08);
        }

        .neox-footer a,
        .neox-footer a:hover,
        .neox-footer a:focus,
        .neox-footer a:active{
          text-decoration:none !important;
        }

        .neox-foot-bg{
          position:absolute; inset:-1px 0 0 0;
          background:
            radial-gradient(900px 520px at 50% 0%, rgba(47,184,255,.14), transparent 70%),
            radial-gradient(700px 420px at 80% -10%, rgba(42,125,255,.12), transparent 72%);
          pointer-events:none;
        }

        .neox-foot-noise{
          position:absolute; inset:0;
          pointer-events:none;
          opacity:.08;
          mix-blend-mode:overlay;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='.6'/%3E%3C/svg%3E");
        }

        .neox-foot-vignette{
          position:absolute; inset:0;
          pointer-events:none;
          background:radial-gradient(1200px 720px at 50% 120%, rgba(0,0,0,0), rgba(0,0,0,.82));
        }

        .neox-foot-brandRow{ flex-wrap: wrap; row-gap: 10px; }
        .neox-foot-socialRow{ flex-wrap: wrap; }
        .neox-foot-linksCol{ margin: 0; padding: 0; }

        @media (max-width: 920px){
          .neox-footer .container{
            padding-top: 44px !important;
            padding-bottom: 44px !important;
          }

          .neox-footer .grid{
            row-gap: 28px;
          }

          .neox-foot-title{ margin-bottom: 10px; }
          .neox-foot-link{ padding: 6px 0; }

          .neox-foot-contact{
            display:flex;
            flex-direction: column;
            gap: 10px;
            align-items: stretch;
          }
          .neox-foot-contactItem{
            width: 100%;
            justify-content: flex-start;
            padding: 12px 14px;
          }

          .neox-social{
            width: 44px;
            height: 44px;
            border-radius: 14px;
          }
        }

        @media (max-width: 420px){
          .neox-footer .container{
            padding-top: 38px !important;
            padding-bottom: 38px !important;
          }
          .neox-foot-badge{
            padding: 6px 9px;
            letter-spacing: .14em;
          }
        }

        .neox-logoWrap{
          --logoH: 26px;
          position:relative;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          padding:10px 12px;
          border-radius:16px;
          border:1px solid rgba(255,255,255,.10);
          background:rgba(255,255,255,.02);
          box-shadow:
            0 18px 55px rgba(0,0,0,.62),
            inset 0 0 0 1px rgba(47,184,255,.06);
          overflow:hidden;
          transform:translateY(0);
          transition:transform .22s ease, border-color .22s ease, box-shadow .22s ease, background .22s ease;
          -webkit-tap-highlight-color: transparent;
        }

        @media (max-width: 920px){
          .neox-logoWrap{
            --logoH: 21px;
            padding: 9px 11px;
            border-radius: 14px;
          }
        }
        @media (max-width: 420px){
          .neox-logoWrap{
            --logoH: 20px;
            padding: 8px 10px;
            border-radius: 14px;
          }
        }

        .neox-logoWrap:hover{
          transform:translateY(-2px);
          border-color:rgba(47,184,255,.28);
          background:rgba(255,255,255,.03);
          box-shadow:
            0 22px 70px rgba(0,0,0,.70),
            0 0 0 1px rgba(47,184,255,.14),
            inset 0 0 0 1px rgba(47,184,255,.08);
        }

        .neox-logoAura{
          position:absolute;
          inset:-18px;
          pointer-events:none;
          background:
            radial-gradient(closest-side at 30% 40%, rgba(47,184,255,.18), transparent 62%),
            radial-gradient(closest-side at 70% 60%, rgba(42,125,255,.14), transparent 66%);
          opacity:.55;
          filter:blur(10px);
          transition:opacity .22s ease;
        }
        .neox-logoWrap:hover .neox-logoAura{ opacity:.75; }

        .neox-logoGlint{
          position:absolute;
          inset:-40% -30%;
          pointer-events:none;
          background:linear-gradient(
            115deg,
            rgba(255,255,255,0) 0%,
            rgba(255,255,255,.06) 32%,
            rgba(96,165,250,.18) 50%,
            rgba(255,255,255,.06) 68%,
            rgba(255,255,255,0) 100%
          );
          transform:translateX(-60%) rotate(8deg);
          opacity:0;
        }
        .neox-logoWrap:hover .neox-logoGlint{
          opacity:1;
          animation: neoxGlint 900ms ease both;
        }
        @keyframes neoxGlint{
          0%{ transform:translateX(-70%) rotate(8deg); }
          100%{ transform:translateX(70%) rotate(8deg); }
        }

        .neox-logoImg{
          display:block;
          height: var(--logoH);
          width:auto;
          max-width:180px;
          object-fit:contain;
          user-select:none;
          transform:translateZ(0);
          filter:
            drop-shadow(0 8px 22px rgba(0,0,0,.55))
            drop-shadow(0 0 18px rgba(47,184,255,.10));
          animation: neoxIrisPulse 6.4s ease-in-out infinite;
          will-change: filter, transform;
        }

        @keyframes neoxIrisPulse{
          0%, 100%{
            transform:translateZ(0) scale(1);
            filter:
              drop-shadow(0 8px 22px rgba(0,0,0,.55))
              drop-shadow(0 0 18px rgba(47,184,255,.10));
          }
          55%{
            transform:translateZ(0) scale(1.01);
            filter:
              drop-shadow(0 10px 28px rgba(0,0,0,.60))
              drop-shadow(0 0 26px rgba(47,184,255,.16));
          }
        }

        .neox-foot-badge{
          font-size:11px;
          padding:6px 10px;
          border-radius:999px;
          border:1px solid rgba(47,184,255,.28);
          background:rgba(47,184,255,.10);
          color:rgba(255,255,255,.8);
          letter-spacing:.18em;
          white-space: nowrap;
        }

        .neox-footer-text{
          color:rgba(255,255,255,.72);
          font-size:14px;
          line-height:1.8;
        }

        .neox-foot-contact{
          display:flex;
          gap:10px;
          flex-wrap:wrap;
        }

        .neox-foot-contactItem{
          position:relative;
          display:inline-flex;
          align-items:center;
          gap:10px;
          padding:10px 14px;
          border-radius:999px;
          border:1px solid rgba(255,255,255,.12);
          background:rgba(255,255,255,.03);
          color:rgba(255,255,255,.90);
          font-size:13px;
          text-decoration:none !important;
          transition:transform .2s ease, box-shadow .2s ease, border-color .2s ease, background .2s ease;
          overflow:hidden;
          -webkit-tap-highlight-color: transparent;
          max-width: 100%;
        }
        .neox-foot-contactItem::after{ content:none !important; }

        .neox-foot-contactItem::before{
          content:"";
          position:absolute;
          inset:-1px;
          border-radius:999px;
          pointer-events:none;
          background:
            radial-gradient(120% 140% at 30% 0%, rgba(47,184,255,.20), transparent 55%),
            radial-gradient(120% 140% at 90% 40%, rgba(42,125,255,.16), transparent 60%),
            linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,0));
          opacity:.0;
          transition:opacity .2s ease;
        }

        .neox-foot-contactItem:hover{
          transform:translateY(-1px);
          border-color:rgba(47,184,255,.35);
          background:rgba(255,255,255,.035);
          box-shadow:
            0 18px 55px rgba(0,0,0,.62),
            0 0 0 1px rgba(47,184,255,.18);
        }
        .neox-foot-contactItem:hover::before{ opacity:.9; }

        .neox-foot-contactItem:focus-visible{
          outline:none;
          box-shadow:
            0 18px 55px rgba(0,0,0,.62),
            0 0 0 3px rgba(20,82,199,.34);
        }

        .neox-foot-ic{
          width:28px; height:28px;
          display:grid; place-items:center;
          border-radius:10px;
          border:1px solid rgba(255,255,255,.10);
          background:rgba(0,0,0,.28);
          box-shadow: inset 0 0 0 1px rgba(47,184,255,.08);
          color:rgba(255,255,255,.92);
          flex:0 0 auto;
        }

        .neox-foot-contactText{
          letter-spacing:.01em;
          font-variant-numeric: tabular-nums;
          color:rgba(255,255,255,.92);
          text-decoration:none !important;
          white-space:nowrap;
          overflow:hidden;
          text-overflow:ellipsis;
          min-width: 0;
        }

        .neox-social{
          width:42px;height:42px;
          display:grid;place-items:center;
          border-radius:14px;
          border:1px solid rgba(255,255,255,.12);
          background:rgba(255,255,255,.03);
          color:rgba(255,255,255,.85);
          text-decoration:none !important;
          transition:transform .22s ease, box-shadow .22s ease, border-color .22s ease, background .22s ease;
        }
        .neox-social:hover{
          transform:translateY(-3px);
          border-color:rgba(47,184,255,.35);
          background:rgba(255,255,255,.035);
          box-shadow:0 18px 60px rgba(47,184,255,.18);
        }

        .neox-foot-title{
          font-weight:800;
          color:rgba(255,255,255,.95);
          margin-bottom:12px;
          letter-spacing: .02em;
        }

        .neox-foot-link{
          position:relative;
          display:inline-block;
          padding:4px 0;
          color:rgba(255,255,255,.72);
          text-decoration:none !important;
          transition:color .2s ease, transform .2s ease;
        }

        .neox-foot-link::after{
          content:"";
          position:absolute;
          left:0;
          bottom:-2px;
          width:100%;
          height:2px;
          transform:scaleX(0);
          transform-origin:left;
          background:linear-gradient(
            90deg,
            rgba(47,184,255,0),
            rgba(47,184,255,.65),
            rgba(42,125,255,.45)
          );
          transition:transform .25s ease;
          pointer-events:none;
        }

        .neox-foot-link:hover{
          color:#fff;
          transform:translateY(-1px);
        }
        .neox-foot-link:hover::after{ transform:scaleX(1); }

        .neox-foot-divider{
          border-top:1px solid rgba(255,255,255,.08);
        }
        .neox-foot-copy{
          color:rgba(255,255,255,.55);
          font-size:13px;
          letter-spacing:.02em;
        }

        @media (prefers-reduced-motion:reduce){
          .neox-logoImg{ animation:none !important; }
          .neox-logoWrap,
          .neox-logoAura,
          .neox-logoGlint{ transition:none !important; }
          .neox-logoWrap:hover .neox-logoGlint{ animation:none !important; }
        }
      `}</style>
    </footer>
  );
}
