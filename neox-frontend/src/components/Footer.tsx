// src/components/Footer.tsx
import React, { useCallback } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import { Instagram, Linkedin, Mail, Phone } from "lucide-react";
import { DEFAULT_LANG, type Lang } from "../i18n/lang";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const LANG_MENU: Lang[] = ["az", "tr", "ru", "en", "es"];
const LOGO_SRC = "/image/neox-logo.png";

function isLang(x: string | undefined | null): x is Lang {
  if (!x) return false;
  const v = String(x).toLowerCase();
  return (LANG_MENU as readonly string[]).includes(v);
}

type FooterLink = {
  label: string;
  to: string;
};

const companyLinks: FooterLink[] = [
  { label: "About", to: "/about" },
  { label: "Services", to: "/services" },
  { label: "Use Cases", to: "/use-cases" },
  { label: "Pricing", to: "/pricing" },
];

const resourceLinks: FooterLink[] = [
  { label: "Blog", to: "/blog" },
  { label: "FAQ", to: "/faq" },
  { label: "Guides", to: "/resources/guides" },
];

export default function Footer() {
  const { lang: paramLang } = useParams<{ lang?: string }>();
  const lang: Lang = isLang(paramLang) ? (paramLang as Lang) : DEFAULT_LANG;

  const withLang = useCallback(
    (to: string) => {
      if (to === "/") return `/${lang}`;
      return `/${lang}${to.startsWith("/") ? to : `/${to}`}`;
    },
    [lang]
  );

  const year = new Date().getFullYear();

  return (
    <footer className="neoFooter">
      <style>{`
        .neoFooter,
        .neoFooter *{
          box-sizing:border-box;
        }

        .neoFooter a,
        .neoFooter a:hover,
        .neoFooter a:focus,
        .neoFooter a:active{
          text-decoration:none !important;
        }

        .neoFooter{
          --ink:#0d1420;
          --heading:#0b1322;
          --text:#667286;
          --muted:#7a8597;
          --soft:#98a2b3;
          --line:rgba(13,20,32,.075);
          --accent:#3148c7;

          background:
            radial-gradient(circle at 16% 0%, rgba(49,72,199,.045), transparent 30%),
            linear-gradient(180deg,#fbfcfe 0%,#ffffff 58%,#fbfcfe 100%);
          border-top:1px solid rgba(13,20,32,.055);
          color:var(--ink);
        }

        .neoFooterShell{
          width:min(100%,1440px);
          margin:0 auto;
          padding:56px clamp(22px,6vw,92px) 26px;
        }

        .neoFooterGrid{
          display:grid;
          grid-template-columns:minmax(220px,1fr) minmax(360px,1.25fr) minmax(260px,1fr);
          gap:clamp(42px,6vw,92px);
          align-items:start;
          padding-bottom:42px;
          border-bottom:1px solid var(--line);
        }

        .neoFooterBrand{
          display:grid;
          gap:18px;
          align-content:start;
        }

        .neoFooterLogoLink{
          width:112px;
          height:42px;
          display:inline-flex;
          align-items:center;
          justify-content:flex-start;
        }

        .neoFooterLogo{
          width:108px;
          height:40px;
          display:block;
          object-fit:contain;
          object-position:left center;
          user-select:none;
          -webkit-user-drag:none;
        }

        .neoFooterLine{
          max-width:260px;
          margin:0;
          color:var(--text);
          font-size:14px;
          line-height:1.55;
          font-weight:540;
          letter-spacing:-.015em;
        }

        .neoFooterNav{
          display:grid;
          grid-template-columns:repeat(2,minmax(130px,1fr));
          gap:clamp(34px,5vw,72px);
        }

        .neoFooterCol{
          display:grid;
          gap:16px;
          align-content:start;
        }

        .neoFooterTitle{
          margin:0;
          color:var(--heading);
          font-size:12px;
          line-height:1;
          font-weight:820;
          letter-spacing:.08em;
          text-transform:uppercase;
        }

        .neoFooterLinks{
          display:grid;
          gap:12px;
        }

        .neoFooterLink{
          width:max-content;
          max-width:100%;
          color:var(--text);
          font-size:15px;
          line-height:1.15;
          font-weight:610;
          letter-spacing:-.02em;
          transition:
            color .16s ease,
            transform .16s cubic-bezier(.2,.8,.2,1);
        }

        .neoFooterLink:hover,
        .neoFooterLink.is-active{
          color:var(--accent);
          transform:translateX(2px);
        }

        .neoFooterContact{
          display:grid;
          gap:16px;
          align-content:start;
          justify-items:start;
        }

        .neoFooterContactList{
          display:grid;
          gap:10px;
          width:100%;
          max-width:260px;
        }

        .neoFooterContactItem{
          min-height:38px;
          display:inline-flex;
          align-items:center;
          justify-content:flex-start;
          gap:9px;
          padding:0 13px;
          border-radius:14px;
          border:1px solid rgba(13,20,32,.075);
          background:rgba(255,255,255,.74);
          color:var(--text);
          font-size:14px;
          font-weight:610;
          letter-spacing:-.02em;
          box-shadow:0 10px 24px rgba(13,20,32,.035);
          transition:
            transform .16s cubic-bezier(.2,.8,.2,1),
            border-color .16s ease,
            background .16s ease,
            color .16s ease;
        }

        .neoFooterContactItem svg{
          color:#6f7a8c;
        }

        .neoFooterContactItem:hover{
          transform:translateY(-1px);
          border-color:rgba(13,20,32,.13);
          background:#fff;
          color:#0d1420;
        }

        .neoFooterContactItem:hover svg{
          color:var(--accent);
        }

        .neoFooterSocials{
          display:flex;
          align-items:center;
          justify-content:flex-start;
          gap:9px;
          padding-top:2px;
        }

        .neoFooterSocial{
          width:38px;
          height:38px;
          border-radius:14px;
          border:1px solid rgba(13,20,32,.075);
          background:rgba(255,255,255,.74);
          color:#667286;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          box-shadow:0 10px 24px rgba(13,20,32,.035);
          transition:
            transform .16s cubic-bezier(.2,.8,.2,1),
            border-color .16s ease,
            background .16s ease,
            color .16s ease;
        }

        .neoFooterSocial:hover{
          transform:translateY(-1px);
          border-color:rgba(49,72,199,.22);
          background:#fff;
          color:var(--accent);
        }

        .neoFooterBottom{
          min-height:64px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:20px;
          padding-top:22px;
        }

        .neoFooterCopy{
          color:#758195;
          font-size:13px;
          line-height:1.35;
          font-weight:560;
          letter-spacing:-.01em;
        }

        .neoFooterMini{
          color:#8b95a6;
          font-size:13px;
          line-height:1.35;
          font-weight:540;
          letter-spacing:-.01em;
        }

        @media (max-width:980px){
          .neoFooterShell{
            padding:46px 22px 24px;
          }

          .neoFooterGrid{
            grid-template-columns:1fr;
            gap:34px;
            padding-bottom:34px;
          }

          .neoFooterLine{
            max-width:520px;
          }

          .neoFooterNav{
            max-width:520px;
          }

          .neoFooterContactList{
            max-width:340px;
          }
        }

        @media (max-width:560px){
          .neoFooterShell{
            padding:40px 18px 22px;
          }

          .neoFooterNav{
            grid-template-columns:1fr;
            gap:30px;
          }

          .neoFooterContactList{
            max-width:none;
          }

          .neoFooterContactItem{
            width:100%;
          }

          .neoFooterBottom{
            align-items:flex-start;
            flex-direction:column;
          }
        }

        @media (prefers-reduced-motion:reduce){
          .neoFooterLink,
          .neoFooterContactItem,
          .neoFooterSocial{
            transition:none !important;
          }
        }
      `}</style>

      <div className="neoFooterShell">
        <div className="neoFooterGrid">
          <div className="neoFooterBrand">
            <Link to={`/${lang}`} className="neoFooterLogoLink" aria-label="NEOX" data-wg-notranslate>
              <img className="neoFooterLogo" src={LOGO_SRC} alt="" loading="lazy" decoding="async" draggable={false} />
            </Link>

            <p className="neoFooterLine">Clean automation systems for customer conversations and business workflows.</p>
          </div>

          <nav className="neoFooterNav" aria-label="Footer navigation">
            <div className="neoFooterCol">
              <h2 className="neoFooterTitle">Company</h2>

              <div className="neoFooterLinks">
                {companyLinks.map((item) => (
                  <NavLink key={item.to} to={withLang(item.to)} className={({ isActive }) => cx("neoFooterLink", isActive && "is-active")}>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>

            <div className="neoFooterCol">
              <h2 className="neoFooterTitle">Resources</h2>

              <div className="neoFooterLinks">
                {resourceLinks.map((item) => (
                  <NavLink key={item.to} to={withLang(item.to)} className={({ isActive }) => cx("neoFooterLink", isActive && "is-active")}>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </nav>

          <div className="neoFooterContact">
            <h2 className="neoFooterTitle">Contact</h2>

            <div className="neoFooterContactList">
              <a className="neoFooterContactItem" href="mailto:info@weneox.com">
                <Mail size={16} strokeWidth={1.9} aria-hidden="true" />
                info@weneox.com
              </a>

              <a className="neoFooterContactItem" href="tel:+994518005577">
                <Phone size={16} strokeWidth={1.9} aria-hidden="true" />
                +994 51 800 55 77
              </a>
            </div>

            <div className="neoFooterSocials" aria-label="Social links">
              <a className="neoFooterSocial" href="https://www.linkedin.com" target="_blank" rel="noreferrer" aria-label="LinkedIn">
                <Linkedin size={16} strokeWidth={1.9} aria-hidden="true" />
              </a>

              <a className="neoFooterSocial" href="https://www.instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram">
                <Instagram size={16} strokeWidth={1.9} aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>

        <div className="neoFooterBottom">
          <div className="neoFooterCopy">© {year} NEOX — Intelligent Automation Systems</div>
          <div className="neoFooterMini">Built for modern operators.</div>
        </div>
      </div>
    </footer>
  );
}