// src/pages/design-lab/CardLab.tsx
import { Alignment, Fit, Layout, useRive } from "@rive-app/react-canvas";
import { Link, useParams } from "react-router-dom";
import { DEFAULT_LANG, LANGS, type Lang } from "../../i18n/lang";

function isLang(value: string | undefined | null): value is Lang {
  return Boolean(value && (LANGS as readonly string[]).includes(value));
}

function useSafeLang(): Lang {
  const { lang } = useParams<{ lang?: string }>();
  return isLang(lang) ? lang : DEFAULT_LANG;
}

function withLang(lang: Lang, path: string) {
  if (path === "/") return `/${lang}`;
  return `/${lang}${path.startsWith("/") ? path : `/${path}`}`;
}

const RIVE_SRC = "/rive/neox-system-flow.riv";

function NeoxRiveStage() {
  const { RiveComponent } = useRive({
    src: RIVE_SRC,
    autoplay: true,
    layout: new Layout({
      fit: Fit.Contain,
      alignment: Alignment.Center,
    }),
  });

  return (
    <div className="neox-rive-stage">
      <div className="neox-rive-glow" aria-hidden="true" />
      <RiveComponent className="neox-rive-canvas" />

      <div className="neox-rive-empty">
        <span>Rive visual</span>
        <strong>public/rive/neox-system-flow.riv</strong>
        <p>Faylı bu path-ə qoyanda burada animated sistem səhnəsi görünəcək.</p>
      </div>
    </div>
  );
}

function CardLab() {
  const lang = useSafeLang();

  return (
    <main className="neox-rive-page">
      <style>{`
        .neox-rive-page {
          min-height: 100vh;
          color: #070b18;
          background:
            radial-gradient(circle at 50% 8%, rgba(37, 84, 216, 0.075), transparent 34%),
            linear-gradient(180deg, #f8f9fc 0%, #ffffff 44%, #f8f9fc 100%);
        }

        .neox-rive-shell {
          width: min(1480px, calc(100% - 72px));
          margin: 0 auto;
          padding: 70px 0 64px;
        }

        .neox-rive-head {
          max-width: 850px;
          margin: 0 auto;
          text-align: center;
        }

        .neox-rive-kicker {
          margin: 0 0 16px;
          font-size: 13px;
          line-height: 1;
          font-weight: 850;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: #2554d8;
        }

        .neox-rive-head h1 {
          margin: 0;
          font-size: clamp(44px, 5.25vw, 82px);
          line-height: 0.94;
          letter-spacing: -0.078em;
          font-weight: 850;
          color: #070b18;
        }

        .neox-rive-head h1 span {
          color: #2c5be3;
        }

        .neox-rive-head p {
          max-width: 690px;
          margin: 26px auto 0;
          font-size: 18px;
          line-height: 1.75;
          letter-spacing: -0.025em;
          color: #65728a;
        }

        .neox-rive-stage-wrap {
          margin-top: 68px;
          position: relative;
        }

        .neox-rive-stage {
          position: relative;
          height: min(560px, 52vw);
          min-height: 430px;
          overflow: hidden;
          border-radius: 36px;
          border: 1px solid rgba(7, 11, 24, 0.06);
          background:
            radial-gradient(circle at 50% 46%, rgba(37, 84, 216, 0.075), transparent 36%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(247, 249, 253, 0.72));
          box-shadow:
            0 36px 120px rgba(15, 23, 42, 0.07),
            inset 0 1px 0 rgba(255, 255, 255, 0.95);
        }

        .neox-rive-stage::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(255,255,255,0.9), transparent 16%, transparent 84%, rgba(255,255,255,0.9)),
            linear-gradient(180deg, rgba(255,255,255,0.86), transparent 22%, transparent 78%, rgba(255,255,255,0.86));
          pointer-events: none;
          z-index: 2;
        }

        .neox-rive-glow {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 720px;
          height: 320px;
          transform: translate(-50%, -50%);
          border-radius: 999px;
          background: rgba(37, 84, 216, 0.11);
          filter: blur(62px);
          opacity: 0.65;
          pointer-events: none;
        }

        .neox-rive-canvas {
          position: relative;
          z-index: 3;
          width: 100%;
          height: 100%;
        }

        .neox-rive-empty {
          position: absolute;
          left: 50%;
          top: 50%;
          z-index: 1;
          width: min(520px, calc(100% - 48px));
          transform: translate(-50%, -50%);
          text-align: center;
          pointer-events: none;
          opacity: 0.72;
        }

        .neox-rive-empty span {
          display: block;
          margin-bottom: 12px;
          font-size: 12px;
          font-weight: 850;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #2554d8;
        }

        .neox-rive-empty strong {
          display: block;
          font-size: clamp(28px, 3vw, 46px);
          line-height: 1;
          letter-spacing: -0.06em;
          color: #07101f;
        }

        .neox-rive-empty p {
          max-width: 420px;
          margin: 16px auto 0;
          font-size: 15px;
          line-height: 1.6;
          color: #65728a;
        }

        .neox-rive-caption {
          max-width: 850px;
          margin: 34px auto 0;
          text-align: center;
          font-size: 17px;
          line-height: 1.7;
          letter-spacing: -0.025em;
          color: #5f6c82;
        }

        .neox-rive-caption strong {
          color: #07101f;
          font-weight: 820;
        }

        .neox-rive-actions {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-top: 36px;
        }

        .neox-rive-button {
          height: 50px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 24px;
          border-radius: 14px;
          text-decoration: none;
          font-size: 14px;
          font-weight: 820;
          letter-spacing: -0.02em;
          transition:
            border-color 180ms ease,
            background 180ms ease,
            color 180ms ease;
        }

        .neox-rive-button--ghost {
          color: #1f2b43;
          background: rgba(255, 255, 255, 0.72);
          border: 1px solid rgba(7, 11, 24, 0.1);
        }

        .neox-rive-button--primary {
          color: #ffffff;
          background: #25359a;
          border: 1px solid #25359a;
        }

        .neox-rive-button--ghost:hover {
          color: #2554d8;
          border-color: rgba(37, 84, 216, 0.24);
        }

        .neox-rive-button--primary:hover {
          background: #1e2f91;
        }

        @media (max-width: 760px) {
          .neox-rive-shell {
            width: min(100% - 28px, 540px);
            padding-top: 48px;
          }

          .neox-rive-head h1 {
            font-size: 44px;
          }

          .neox-rive-head p,
          .neox-rive-caption {
            font-size: 16px;
          }

          .neox-rive-stage-wrap {
            margin-top: 48px;
          }

          .neox-rive-stage {
            height: 520px;
            min-height: 520px;
            border-radius: 28px;
          }

          .neox-rive-actions {
            flex-direction: column;
          }

          .neox-rive-button {
            width: 100%;
          }
        }
      `}</style>

      <section className="neox-rive-shell">
        <div className="neox-rive-head">
          <p className="neox-rive-kicker">Vahid sistem</p>

          <h1>
            Müştəri gəlir, sistem qarşılayır, <span>proses davam edir.</span>
          </h1>

          <p>
            İlk təmasdan cavaba, yönləndirməyə və daxili prosesə qədər hər şey
            bir-birinə bağlı işləyir.
          </p>
        </div>

        <div className="neox-rive-stage-wrap">
          <NeoxRiveStage />
        </div>

        <p className="neox-rive-caption">
          <strong>Burada kod artıq workflow çəkmir.</strong> Kod yalnız premium Rive səhnəsini
          səhifəyə yerləşdirir. Əsas vizual dizayn `.riv` faylında hazırlanır.
        </p>

        <div className="neox-rive-actions">
          <Link to={withLang(lang, "/")} className="neox-rive-button neox-rive-button--ghost">
            Home-a qayıt
          </Link>

          <Link
            to={withLang(lang, "/contact")}
            className="neox-rive-button neox-rive-button--primary"
          >
            Sistemi quraq
          </Link>
        </div>
      </section>
    </main>
  );
}

export default CardLab;