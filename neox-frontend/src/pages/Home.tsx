import { Link, useParams } from "react-router-dom";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { DEFAULT_LANG, type Lang } from "../i18n/lang";

function isLang(value: string | undefined | null): value is Lang {
  return Boolean(value && ["az", "en", "tr", "ru", "es"].includes(value));
}

function withLang(path: string, lang: Lang) {
  if (path === "/") return `/${lang}`;
  return `/${lang}${path.startsWith("/") ? path : `/${path}`}`;
}

export default function Home() {
  const { lang: routeLang } = useParams<{ lang?: string }>();
  const lang: Lang = isLang(routeLang) ? routeLang : DEFAULT_LANG;

  const terminalItems = [
    "Instagram və WhatsApp cavab axınları",
    "Sayt çatbotu və lead toplama",
    "Müştəri sorğularının ağıllı yönləndirilməsi",
    "Görüş və rezervasiya xatırlatmaları",
    "Satış sonrası follow-up sistemləri",
    "FAQ və dəstək cavabları",
    "CRM və inbox inteqrasiyaları",
    "Daxili tapşırıq və təsdiq axınları",
    "Premium landing page və web interfeyslər",
    "Süni İntellekt əsaslı biznes köməkçiləri",
  ];

  const terminalTrack = [...terminalItems, ...terminalItems];

  return (
    <>
      <style>{`
        .hs-root{
          min-height: 100vh;
          overflow-x: hidden;
          background: #07111f;
        }

        .hs-shell{
          min-height: 100vh;
          padding-top: 86px;
        }

        .hs-hero{
          position: relative;
          min-height: calc(100svh - 86px);
          display: grid;
          grid-template-rows: 1fr auto;
          overflow: hidden;
        }

        .hs-bg{
          position: absolute;
          inset: 0;
          z-index: 0;
          background: #091427;
        }

        .hs-bgMediaSlot{
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          opacity: .18;
          background:
            linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,0)),
            linear-gradient(90deg, rgba(255,255,255,.02), rgba(255,255,255,0));
        }

        .hs-main{
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
        }

        .hs-container{
          width: min(1380px, calc(100% - 48px));
          margin: 0 auto;
        }

        .hs-content{
          width: min(720px, 100%);
          padding: 40px 0 32px;
        }

        .hs-kicker{
          display: inline-flex;
          align-items: center;
          min-height: 38px;
          padding: 0 14px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.12);
          color: rgba(255,255,255,.88);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: .16em;
          text-transform: uppercase;
        }

        .hs-title{
          margin: 26px 0 0;
          color: #ffffff;
          font-size: clamp(48px, 7vw, 94px);
          line-height: .96;
          letter-spacing: -.06em;
          font-weight: 780;
          max-width: 860px;
        }

        .hs-sub{
          margin: 24px 0 0;
          max-width: 640px;
          color: rgba(255,255,255,.78);
          font-size: 18px;
          line-height: 1.7;
          font-weight: 450;
        }

        .hs-actions{
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
          margin-top: 30px;
        }

        .hs-btnPrimary,
        .hs-btnGhost{
          min-height: 56px;
          padding: 0 22px;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          text-decoration: none !important;
          font-size: 16px;
          font-weight: 700;
          white-space: nowrap;
        }

        .hs-btnPrimary{
          background: #ffffff;
          color: #0f172a;
          border: 1px solid rgba(255,255,255,.16);
        }

        .hs-btnGhost{
          background: transparent;
          color: #ffffff;
          border: 1px solid rgba(255,255,255,.22);
        }

        .hs-terminalWrap{
          position: relative;
          z-index: 3;
          border-top: 1px solid rgba(255,255,255,.085);
          background:
            linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,.012)),
            rgba(3, 10, 22, .34);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }

        .hs-terminalBar{
          position: relative;
          overflow: hidden;
          padding: 18px 0;
        }

        .hs-terminalTrack{
          display: inline-flex;
          align-items: center;
          gap: 38px;
          white-space: nowrap;
          width: max-content;
          animation: hs-marquee 36s linear infinite;
          will-change: transform;
        }

        .hs-terminalItem{
          display: inline-flex;
          align-items: center;
          gap: 11px;
          color: rgba(255,255,255,.76);
          background: transparent;
          border: 0;
          border-radius: 0;
          padding: 0;
          min-height: auto;
          font-size: 14px;
          line-height: 1;
          font-weight: 520;
          letter-spacing: -.01em;
          text-transform: none;
        }

        .hs-terminalItem::before{
          content: "";
          width: 5px;
          height: 5px;
          border-radius: 999px;
          background: rgba(142, 166, 255, .92);
          box-shadow: 0 0 0 4px rgba(142, 166, 255, .10);
          flex: 0 0 auto;
        }

        .hs-terminalFade{
          position: absolute;
          top: 0;
          bottom: 0;
          width: 92px;
          z-index: 2;
          pointer-events: none;
        }

        .hs-terminalFade.left{
          left: 0;
          background: linear-gradient(90deg, #07111f 0%, rgba(7,17,31,0) 100%);
        }

        .hs-terminalFade.right{
          right: 0;
          background: linear-gradient(270deg, #07111f 0%, rgba(7,17,31,0) 100%);
        }

        @keyframes hs-marquee{
          0% { transform: translate3d(0,0,0); }
          100% { transform: translate3d(-50%,0,0); }
        }

        @media (prefers-reduced-motion: reduce){
          .hs-terminalTrack{
            animation: none;
          }
        }

        @media (max-width: 760px){
          .hs-shell{
            padding-top: 74px;
          }

          .hs-hero{
            min-height: calc(100svh - 74px);
          }

          .hs-container{
            width: calc(100% - 24px);
          }

          .hs-content{
            padding: 28px 0 20px;
          }

          .hs-title{
            font-size: clamp(40px, 12vw, 62px);
            line-height: .98;
          }

          .hs-sub{
            font-size: 15px;
            line-height: 1.7;
          }

          .hs-actions{
            display: grid;
            gap: 10px;
          }

          .hs-btnPrimary,
          .hs-btnGhost{
            width: 100%;
            min-height: 52px;
          }

          .hs-terminalBar{
            padding: 15px 0;
          }

          .hs-terminalTrack{
            gap: 28px;
          }

          .hs-terminalItem{
            font-size: 12px;
          }

          .hs-terminalFade{
            width: 36px;
          }
        }
      `}</style>

      <div className="hs-root">
        <div className="hs-shell">
          <section className="hs-hero">
            <div className="hs-bg" />
            <div className="hs-bgMediaSlot" />

            <div className="hs-main">
              <div className="hs-container">
                <div className="hs-content">
                  <div className="hs-kicker">Hero label</div>

                  <h1 className="hs-title">
                    Main hero
                    <br />
                    headline here
                  </h1>

                  <p className="hs-sub">
                    Background slot above, left content here, terminal visible below.
                  </p>

                  <div className="hs-actions">
                    <Link to={withLang("/contact", lang)} className="hs-btnPrimary">
                      Primary action
                      <ArrowUpRight size={18} />
                    </Link>

                    <Link to={withLang("/about", lang)} className="hs-btnGhost">
                      Secondary action
                      <ChevronRight size={18} />
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="hs-terminalWrap">
              <div className="hs-terminalBar">
                <div className="hs-terminalFade left" />
                <div className="hs-terminalFade right" />

                <div className="hs-terminalTrack">
                  {terminalTrack.map((item, index) => (
                    <span key={`${item}-${index}`} className="hs-terminalItem">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}