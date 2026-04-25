import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { Mail, Phone, Linkedin, Github, ArrowUpRight } from "lucide-react";

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
  const { pathname } = useLocation();
  const lang = useMemo(() => getLangFromPath(pathname), [pathname]);

  const year = new Date().getFullYear();
  const phone = "+994 51 800 55 77";
  const email = "info@weneox.com";

  return (
    <footer className="neox-white-footer">
      <div className="nwf-shell">
        <div className="nwf-top">
          <div className="nwf-brand">
            <Link to={withLang("/", lang)} className="nwf-logo" aria-label="NEOX">
              <img src="/image/neox-logo.png" alt="NEOX" draggable={false} />
            </Link>

            <div>
              <div className="nwf-name">NEOX</div>
              <div className="nwf-tag">Operational Intelligence</div>
            </div>
          </div>

          <p className="nwf-copy">
            We build clean automation systems for customer conversations, workflows and business operations.
          </p>
        </div>

        <div className="nwf-grid">
          <div className="nwf-contact">
            <a href={`mailto:${email}`} className="nwf-contact-item">
              <Mail size={17} />
              {email}
            </a>

            <a href={`tel:${phone.replace(/\s+/g, "")}`} className="nwf-contact-item">
              <Phone size={17} />
              {phone}
            </a>
          </div>

          <div className="nwf-links">
            <div>
              <div className="nwf-title">Company</div>
              <Link to={withLang("/about", lang)}>About</Link>
              <Link to={withLang("/services", lang)}>Services</Link>
              <Link to={withLang("/use-cases", lang)}>Use Cases</Link>
            </div>

            <div>
              <div className="nwf-title">Resources</div>
              <Link to={withLang("/blog", lang)}>Blog</Link>
              <Link to={withLang("/faq", lang)}>FAQ</Link>
              <Link to={withLang("/contact", lang)}>Contact</Link>
            </div>
          </div>

          <div className="nwf-action">
            <Link to={withLang("/contact", lang)} className="nwf-cta">
              Contact
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>

        <div className="nwf-bottom">
          <span>© {year} NEOX — Intelligent Automation Systems</span>

          <div className="nwf-socials">
            <a href="#" aria-label="LinkedIn">
              <Linkedin size={17} />
            </a>
            <a href="#" aria-label="GitHub">
              <Github size={17} />
            </a>
            <a href={`mailto:${email}`} aria-label="Email">
              <Mail size={17} />
            </a>
          </div>
        </div>
      </div>

      <style>{`
        .neox-white-footer{
          position: relative;
          background:
            radial-gradient(900px 360px at 50% -20%, rgba(37,99,235,.08), transparent 65%),
            linear-gradient(180deg, #f8fbff 0%, #ffffff 62%);
          color: #101827;
          border-top: 1px solid rgba(15,23,42,.08);
          overflow: hidden;
        }

        .neox-white-footer a{
          text-decoration: none !important;
          color: inherit;
        }

        .nwf-shell{
          width: min(1280px, calc(100% - 48px));
          margin: 0 auto;
          padding: 58px 0 26px;
        }

        .nwf-top{
          display: grid;
          grid-template-columns: .9fr 1.1fr;
          gap: 48px;
          align-items: end;
          padding-bottom: 34px;
          border-bottom: 1px solid rgba(15,23,42,.08);
        }

        .nwf-brand{
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .nwf-logo{
          width: 54px;
          height: 54px;
          border-radius: 18px;
          display: grid;
          place-items: center;
          background: #fff;
          border: 1px solid rgba(15,23,42,.08);
          box-shadow: 0 18px 50px rgba(15,23,42,.08);
        }

        .nwf-logo img{
          width: 31px;
          height: 31px;
          object-fit: contain;
        }

        .nwf-name{
          font-size: 24px;
          line-height: 1;
          font-weight: 850;
          letter-spacing: -.04em;
        }

        .nwf-tag{
          margin-top: 5px;
          color: #667085;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .16em;
          text-transform: uppercase;
        }

        .nwf-copy{
          margin: 0;
          max-width: 640px;
          color: #344054;
          font-size: 18px;
          line-height: 1.75;
          font-weight: 500;
        }

        .nwf-grid{
          display: grid;
          grid-template-columns: .9fr 1fr auto;
          gap: 44px;
          align-items: start;
          padding: 34px 0;
        }

        .nwf-contact{
          display: grid;
          gap: 10px;
          align-content: start;
        }

        .nwf-contact-item{
          width: fit-content;
          min-height: 42px;
          padding: 0 14px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          color: #344054;
          background: #fff;
          border: 1px solid rgba(15,23,42,.08);
          box-shadow: 0 12px 34px rgba(15,23,42,.05);
          font-size: 14px;
          font-weight: 650;
        }

        .nwf-links{
          display: grid;
          grid-template-columns: repeat(2, minmax(140px, 1fr));
          gap: 28px;
        }

        .nwf-links > div{
          display: grid;
          gap: 12px;
        }

        .nwf-title{
          margin-bottom: 4px;
          color: #667085;
          font-size: 12px;
          font-weight: 850;
          letter-spacing: .16em;
          text-transform: uppercase;
        }

        .nwf-links a{
          width: fit-content;
          color: #1d2939;
          font-size: 15px;
          font-weight: 650;
          transition: color .18s ease, transform .18s ease;
        }

        .nwf-links a:hover{
          color: #2458ff;
          transform: translateX(2px);
        }

        .nwf-action{
          display: flex;
          justify-content: flex-end;
        }

        .nwf-cta{
          min-height: 48px;
          padding: 0 18px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          color: #fff !important;
          background: #2458ff;
          border: 1px solid rgba(36,88,255,.2);
          box-shadow: 0 18px 45px rgba(36,88,255,.22);
          font-size: 14px;
          font-weight: 800;
        }

        .nwf-bottom{
          padding-top: 22px;
          border-top: 1px solid rgba(15,23,42,.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          color: #667085;
          font-size: 13px;
          font-weight: 550;
        }

        .nwf-socials{
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .nwf-socials a{
          width: 38px;
          height: 38px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: #fff;
          color: #344054;
          border: 1px solid rgba(15,23,42,.08);
          box-shadow: 0 12px 30px rgba(15,23,42,.05);
        }

        @media (max-width: 900px){
          .nwf-shell{
            width: calc(100% - 28px);
            padding: 44px 0 22px;
          }

          .nwf-top,
          .nwf-grid{
            grid-template-columns: 1fr;
            gap: 26px;
          }

          .nwf-action{
            justify-content: flex-start;
          }

          .nwf-bottom{
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </footer>
  );
}