// src/pages/resources/ResourcesFaq.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Lang } from "../../i18n/lang";

type Item = { q: string; a: string };

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const IMAGE_ON =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1771112989/ChatGPT_Image_Feb_15_2026_03_49_24_AM_fiuket.png";

function SplitText({
  text,
  active,
  baseDelayMs,
}: {
  text: string;
  active: boolean;
  baseDelayMs: number;
}) {
  const chars = Array.from(text);
  return (
    <span className={cx("qText", active && "isEnergized")} aria-label={text}>
      {chars.map((ch, idx) => {
        const isSpace = ch === " ";
        const d = baseDelayMs + idx * 22;
        return (
          <span
            key={idx}
            className={cx("qChar", isSpace && "sp")}
            style={{ ["--d" as any]: `${d}ms` } as React.CSSProperties}
            aria-hidden="true"
          >
            {isSpace ? "\u00A0" : ch}
          </span>
        );
      })}
    </span>
  );
}

export default function ResourcesFaq() {
  const { lang } = useParams<{ lang: Lang }>();
  const [open, setOpen] = useState<number | null>(0);
  const [lightOn, setLightOn] = useState(false);

  // pull cord (down)
  const startYRef = useRef<number | null>(null);
  const [dragging, setDragging] = useState(false);

  // ✅ FPS: pullY state-ni RAF ilə throttling edirik
  const pullYRef = useRef(0);
  const [pullY, setPullY] = useState(0);
  const pullRafRef = useRef<number | null>(null);

  const THRESHOLD = 78;
  const MAX_PULL = 150;
  const BASE_CORD = 132;

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
    startYRef.current = e.clientY;
    setDragging(true);
    pullYRef.current = 0;
    setPullY(0);
  };

  const schedulePullCommit = () => {
    if (pullRafRef.current) return;
    pullRafRef.current = window.requestAnimationFrame(() => {
      pullRafRef.current = null;
      setPullY(pullYRef.current);
    });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging || startYRef.current == null) return;
    const dy = Math.max(0, Math.min(MAX_PULL, e.clientY - startYRef.current));
    pullYRef.current = dy;
    schedulePullCommit();
  };

  const [cordPulse, setCordPulse] = useState(false);

  // ✅ elektrik “1 dəfə otursun” üçün trigger
  const [chargeId, setChargeId] = useState(0);

  const endDrag = () => {
    const finalPull = pullYRef.current;
    if (finalPull >= THRESHOLD) {
      setLightOn((v) => {
        const next = !v;
        if (next) setChargeId((x) => x + 1);
        return next;
      });
      setCordPulse(true);
      window.setTimeout(() => setCordPulse(false), 1100);
    }
    startYRef.current = null;
    setDragging(false);
    pullYRef.current = 0;
    setPullY(0);
  };

  const items = useMemo<Item[]>(
    () => [
      {
        q: "NEOX nədir?",
        a: "NEOX – veb sayt və biznes prosesləri üçün AI əsaslı canlı chat, avtomatlaşdırma və lead toplama sistemidir.",
      },
      {
        q: "Quraşdırma nə qədər vaxt aparır?",
        a: "Orta hesabla 5–10 dəqiqə. Widget kodunu əlavə edirsən və işləməyə başlayır.",
      },
      {
        q: "Məlumatlarım təhlükəsizdirmi?",
        a: "Bəli. Trafik şifrələnir, admin girişi qorunur və istəsən IP allowlist aktiv edə bilərsən.",
      },
      {
        q: "Mobil və desktop dəstəyi varmı?",
        a: "Tam dəstək var. Panel mobilə optimallaşdırılıb, widget isə bütün cihazlarda stabil işləyir.",
      },
      {
        q: "AI cavabları redaktə edə bilərəm?",
        a: "Bəli. Operator istənilən an söhbəti ələ ala, cavabları dəyişə və hazır quick-reply istifadə edə bilər.",
      },
      {
        q: "Ödəniş planları necədir?",
        a: "Paketlər istifadə həcminə görə dəyişir. Ətraflı məlumat üçün Pricing səhifəsinə bax.",
      },
    ],
    []
  );

  // reveal like hero
  const revealTimerRef = useRef<number | null>(null);
  const [revealCount, setRevealCount] = useState(0);

  const stopRevealTimer = () => {
    if (revealTimerRef.current) {
      window.clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  };

  const startReveal = () => {
    stopRevealTimer();
    setRevealCount(0);
    let i = 0;
    revealTimerRef.current = window.setInterval(() => {
      i += 1;
      setRevealCount(i);
      if (i >= 4) stopRevealTimer();
    }, 260);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    requestAnimationFrame(() =>
      window.scrollTo({ top: 0, left: 0, behavior: "auto" })
    );
    startReveal();
    return () => stopRevealTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showH1 = revealCount >= 1;
  const showP = revealCount >= 2;
  const showActions = revealCount >= 3;
  const showCard = revealCount >= 4;

  const cordH = BASE_CORD + pullY;

  /* =========================================================
     ✅ PENDULUM (FPS max):
     - React setState hər frame YOX
     - CSS var (--theta) DOM-a birbaşa yazılır
     - ✅ FIX: sağa gedəndə “arxaya girmə” = contain: paint klipləyirdi
  ========================================================= */
  const rigRef = useRef<HTMLSpanElement | null>(null);
  const thetaRef = useRef(0); // rad
  const omegaRef = useRef(0); // rad/s
  const rafRef = useRef<number | null>(null);
  const lastTRef = useRef<number | null>(null);
  const lastMoveRef = useRef<{ t: number; x: number } | null>(null);

  // hover hessaslığı azaltmaq üçün: kick throttle
  const lastKickRef = useRef<number>(0);

  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

  const kickOmega = (impulse01: number) => {
    const MAX_ADD = 3.1;
    omegaRef.current += impulse01 * MAX_ADD;
  };

  const startPendulum = () => {
    if (rafRef.current) return;
    const tick = (t: number) => {
      if (lastTRef.current == null) lastTRef.current = t;
      const dt = clamp((t - lastTRef.current) / 1000, 0.001, 0.033);
      lastTRef.current = t;

      const w0 = 7.2;
      const damp = 0.88;

      const theta = thetaRef.current;
      let omega = omegaRef.current;

      omega += -(w0 * w0) * theta * dt;
      omega *= Math.pow(damp, dt * 60);
      let nextTheta = theta + omega * dt;

      const MAX_THETA = 0.62;
      if (nextTheta > MAX_THETA) {
        nextTheta = MAX_THETA;
        omega *= -0.55;
      } else if (nextTheta < -MAX_THETA) {
        nextTheta = -MAX_THETA;
        omega *= -0.55;
      }

      thetaRef.current = nextTheta;
      omegaRef.current = omega;

      const deg = (nextTheta * 180) / Math.PI;
      if (rigRef.current) rigRef.current.style.setProperty("--theta", `${deg}deg`);

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
  };

  const stopPendulum = () => {
    if (!rafRef.current) return;
    window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    lastTRef.current = null;
  };

  useEffect(() => {
    startPendulum();
    return () => stopPendulum();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCordMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const now = performance.now();
    if (now - lastKickRef.current < 24) return;

    const x = e.clientX;

    const prev = lastMoveRef.current;
    lastMoveRef.current = { t: now, x };
    if (!prev) return;

    const dtMs = Math.max(12, now - prev.t);
    const dx = x - prev.x;

    const v = dx / dtMs; // px/ms
    const strength = Math.min(1, Math.abs(v) / 2.35);

    // ✅ düz istiqamət
    const dir = -(Math.sign(v) || 0);

    const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
    const cx0 = rect.left + rect.width / 2;
    const off = Math.min(1, Math.abs(e.clientX - cx0) / 220);

    const impulse = dir * strength * (0.62 + off * 0.38);
    if (Math.abs(impulse) < 0.06) return;

    lastKickRef.current = now;
    kickOmega(impulse);
  };

  return (
    <main className="pageShell faqSplitShell">
      <section
        className={cx("faqSplit", lightOn && "lightOn")}
        data-charge={chargeId}
      >
        {/* LEFT */}
        <aside className="leftPanel" aria-hidden="true">
          <div
            className={cx("leftOnImage", lightOn && "show")}
            style={{ backgroundImage: `url(${IMAGE_ON})` }}
          />
          <div className="leftVignette" />
          <div className="leftSeamFade" />
        </aside>

        {/* RIGHT */}
        <section className="rightPanel">
          <div className="pullWrap">
            <button
              type="button"
              className={cx(
                "pullButton",
                dragging && "dragging",
                pullY >= THRESHOLD && "armed",
                lightOn && "on",
                cordPulse && "pulse"
              )}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onMouseMove={onCordMouseMove}
              onMouseEnter={() => {
                lastMoveRef.current = null;
                lastKickRef.current = 0;
              }}
              aria-label="İşığı yandırmaq üçün orb-u aşağı çək və burax"
            >
              <span className="pullLabel">Çək və burax</span>

              <span ref={rigRef} className="cordRig" aria-hidden="true">
                <span className="cordCol">
                  <span className="cord" style={{ height: cordH }} />
                  <span className="orb" />
                </span>
              </span>
            </button>
          </div>

          <div className={cx("rightInner", lightOn && "lightOn")}>
            <div className="pageHero pageHeroDark">
              <h1 className={cx("faqTitle", showH1 && "revealOn")}>FAQ</h1>
              <p className={cx("heroP", showP && "revealOn")}>
                Ən çox verilən suallar – qısa, net cavablarla.
              </p>

              <div className={cx("pageActions heroActions", showActions && "revealOn")}>
                <Link
                  className={cx("btn", "noHoverLine", lightOn && "btnLit")}
                  to={`/${lang}/contact`}
                >
                  Contact
                </Link>
                <Link
                  className={cx("btn", "btnGhost", "noHoverLine", lightOn && "btnLit")}
                  to={`/${lang}/resources/docs`}
                >
                  Docs
                </Link>
              </div>
            </div>

            <section
              className={cx("neo-container", "heroCardWrap", showCard && "revealOn")}
              style={{ marginTop: 18 }}
            >
              <div className={cx("faqCard", "faqCardDark", lightOn && "lightOn")}>
                {items.map((it, i) => {
                  const isOpen = open === i;
                  const baseDelayMs = i * 220;
                  return (
                    <div
                      key={i}
                      className={cx("faqItem", isOpen && "isOpen")}
                      style={
                        {
                          ["--i" as any]: i,
                          ["--bd" as any]: `${baseDelayMs}ms`,
                        } as React.CSSProperties
                      }
                    >
                      <button
                        className="faqQ faqQDark"
                        onClick={() => setOpen(isOpen ? null : i)}
                        aria-expanded={isOpen}
                      >
                        <span className="qWire" aria-hidden="true">
                          <span className="qDot" />
                        </span>

                        <SplitText
                          text={it.q}
                          active={lightOn}
                          baseDelayMs={baseDelayMs + 380}
                        />
                        <i className="faqChevron faqChevronDark" />
                      </button>

                      <div className="faqA">
                        <p className="faqADark">{it.a}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </section>
      </section>

      <style>{`
        :root{
          --nb: #00E5FF;
          --nb2:#36A2FF;
          --nbSoft: rgba(0,229,255,.18);
          --nbGlow: rgba(0,229,255,.28);
        }

        .faqSplitShell{ min-height: 100svh; padding: 0; }
        .faqSplit{
          min-height: 100svh;
          display: grid;
          grid-template-columns: 1fr 1.25fr;
          background: #000;
          overflow: visible;
          position: relative;
        }

        /* ===== left ===== */
        .leftPanel{
          position: sticky;
          top: 0;
          height: 100svh;
          overflow: hidden;
          background: #000;
        }
        .leftOnImage{
          position:absolute; inset:0;
          background-size: cover;
          background-repeat:no-repeat;
          background-position: 35% 10%;
          opacity: 0;
          transition: opacity .55s ease, filter .55s ease;
          will-change: opacity, filter;
          filter: saturate(1.06) contrast(1.06);
        }
        .leftOnImage.show{
          opacity: 1;
          filter: saturate(1.12) contrast(1.08) hue-rotate(-8deg);
        }
        .leftVignette{
          position:absolute; inset:0; pointer-events:none;
          background: radial-gradient(1200px 780px at 45% 45%, rgba(0,0,0,.18), rgba(0,0,0,.94));
        }
        .leftSeamFade{
          position:absolute; top:0; right:0; bottom:0;
          width: 230px; pointer-events:none;
          background: linear-gradient(90deg,
            rgba(0,0,0,0) 0%,
            rgba(0,0,0,.45) 35%,
            rgba(0,0,0,.90) 70%,
            rgba(0,0,0,1) 100%
          );
        }

        /* ===== right ===== */
        .rightPanel{
          position: relative;
          min-height: 100svh;
          background: #000;
          overflow: visible;
        }
        .rightInner{
          position: relative;
          z-index: 2;
          max-width: 980px;
          padding: 86px 28px 56px 28px;
        }

        /* ===== reveal ===== */
        .faqTitle, .heroP, .heroActions, .heroCardWrap{
          opacity: 0;
          transform: translateY(8px);
          transition: opacity .55s ease, transform .55s ease;
          will-change: opacity, transform;
        }
        .revealOn{ opacity: 1; transform: translateY(0); }

        .faqTitle{
          color: rgba(255,255,255,.92);
          font-weight: 900;
        }
        .rightInner.lightOn .faqTitle{
          filter: drop-shadow(0 0 18px var(--nbSoft));
          animation: titleGlow 1.9s ease-in-out infinite;
        }
        @keyframes titleGlow{
          0%, 100% { text-shadow: 0 0 0 rgba(0,229,255,0); }
          50% { text-shadow: 0 0 30px var(--nbGlow); }
        }
        .heroP{ color: rgba(255,255,255,.64); }

        .noHoverLine{ text-decoration:none !important; box-shadow:none !important; background-image:none !important; }
        .noHoverLine:hover{ text-decoration:none !important; box-shadow:none !important; background-image:none !important; }

        .btnLit{
          border-color: rgba(0,229,255,.22) !important;
          box-shadow: 0 10px 40px rgba(0,0,0,.55), 0 0 18px rgba(0,229,255,.10) !important;
        }
        .btnLit:hover{
          box-shadow: 0 12px 44px rgba(0,0,0,.55), 0 0 24px rgba(0,229,255,.16) !important;
        }

        /* ===== pull cord ===== */
        .pullWrap{
          position: fixed;
          top: 0;
          right: 110px;
          z-index: 80;
          pointer-events: none;
        }

        .pullButton{
          position: relative;
          border: 0;
          background: transparent;
          padding: 0 18px 18px 18px;
          border-radius: 18px;
          cursor: grab;
          user-select: none;
          touch-action: none;
          min-width: 140px;
          height: 260px;
          pointer-events: auto;
          transform: none !important;

          /* ✅ FIX: contain: paint orb-u kənarda KLİPLƏYİRDİ (sağa gedəndə “arxaya girir” kimi görünürdü)
             - paint-i çıxardıq, overflow visible saxladıq */
          overflow: visible;
          contain: layout; /* (paint YOX) */
        }
        .pullButton.dragging{ cursor: grabbing; }

        .pullLabel{
          position: absolute;
          top: 22px;
          right: 58px;
          font-size: 12px;
          color: rgba(255,255,255,.46);
          letter-spacing: .12px;
          user-select:none;
          white-space: nowrap;
          text-shadow: 0 10px 30px rgba(0,0,0,.65);
          pointer-events:none;
        }

        .cordRig{
          position: absolute;
          top: 0;
          right: 36px;
          width: 0;
          height: 0;
          transform: rotate(var(--theta, 0deg));
          transform-origin: 50% 0%;
          will-change: transform;
          pointer-events:none;
        }

        .cordCol{
          position: absolute;
          top: 0;
          left: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
        }

        .cord{
          width: 2px;
          background: linear-gradient(180deg, rgba(255,255,255,.30), rgba(255,255,255,.06));
          border-radius: 999px;
          box-shadow: 0 0 0 1px rgba(0,0,0,.28);
        }

        .orb{
          width: 26px;
          height: 26px;
          margin-top: -1px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.18);
          background:
            radial-gradient(circle at 35% 30%, rgba(255,255,255,.26), rgba(255,255,255,.06) 40%, rgba(0,0,0,.10) 70%),
            rgba(255,255,255,.08);
          box-shadow:
            0 14px 34px rgba(0,0,0,.65),
            inset 0 0 0 1px rgba(0,0,0,.25);
          transition: transform .18s ease, box-shadow .22s ease, border-color .22s ease, background .22s ease;
          will-change: transform, box-shadow;
        }

        .pullButton:hover .orb{
          transform: scale(1.03);
          border-color: rgba(255,255,255,.22);
          box-shadow: 0 16px 38px rgba(0,0,0,.65), 0 0 14px rgba(0,229,255,.08);
        }
        .pullButton.armed .orb{
          border-color: rgba(0,229,255,.26);
          box-shadow: 0 16px 38px rgba(0,0,0,.65), 0 0 18px rgba(0,229,255,.12);
        }
        .pullButton.on .orb{
          border-color: rgba(210,245,255,.70);
          background:
            radial-gradient(circle at 35% 30%, rgba(210,245,255,.70), rgba(0,229,255,.22) 48%, rgba(0,0,0,.10) 78%),
            rgba(0,229,255,.12);
          box-shadow:
            0 16px 38px rgba(0,0,0,.65),
            0 0 26px rgba(0,229,255,.22),
            0 0 70px rgba(54,162,255,.12);
        }

        .pullButton.pulse .orb{
          animation: orbPulse 1.1s ease-in-out 1;
        }
        @keyframes orbPulse{
          0% { box-shadow: 0 16px 38px rgba(0,0,0,.65), 0 0 0 rgba(0,229,255,0); }
          35%{ box-shadow: 0 16px 38px rgba(0,0,0,.65), 0 0 30px rgba(0,229,255,.28); }
          70%{ box-shadow: 0 16px 38px rgba(0,0,0,.65), 0 0 16px rgba(120,200,255,.18); }
          100%{ box-shadow: 0 16px 38px rgba(0,0,0,.65), 0 0 0 rgba(0,229,255,0); }
        }

        /* ===== FAQ card ===== */
        .faqCardDark{
          max-width: 980px;
          margin: 0 auto;
          border-radius: 22px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.04);
          backdrop-filter: blur(10px);
          overflow: hidden;
          box-shadow: 0 18px 60px rgba(0,0,0,.55);
          position: relative;
        }
        .faqCardDark:before{
          content:"";
          position:absolute;
          left: 22px;
          top: 18px;
          bottom: 18px;
          width: 2px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(255,255,255,.10), rgba(255,255,255,.05));
          opacity: .95;
        }

        /* kabel 1x dolur və qalır */
        .faqSplit[data-charge] .faqCardDark.lightOn:after{
          content:"";
          position:absolute;
          left: 22px;
          top: 18px;
          width: 2px;
          height: calc(100% - 36px);
          border-radius: 999px;
          background: linear-gradient(180deg,
            rgba(0,229,255,0) 0%,
            rgba(0,229,255,.92) 18%,
            rgba(54,162,255,.28) 42%,
            rgba(0,229,255,0) 70%
          );
          box-shadow: 0 0 20px rgba(0,229,255,.22);
          transform-origin: top;
          transform: scaleY(0);
          pointer-events:none;
          will-change: transform, opacity;
          animation: cableFill 1.1s ease forwards;
          animation-fill-mode: forwards;
        }
        .faqSplit[data-charge="0"] .faqCardDark.lightOn:after{ animation: none; }

        @keyframes cableFill{
          0% { transform: scaleY(0); opacity: 0; }
          14% { opacity: 1; }
          100% { transform: scaleY(1); opacity: 1; }
        }

        .faqItem + .faqItem{ border-top: 1px solid rgba(255,255,255,.08); }

        .faqQDark{
          width:100%;
          text-align:left;
          padding: 18px 18px 18px 54px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          color: rgba(255,255,255,.90);
          font-weight: 760;
          letter-spacing: .15px;
          background: transparent;
          border: 0;
          cursor: pointer;
          position: relative;
        }
        .faqQDark:hover{ background: rgba(255,255,255,.04); }

        .qWire{
          position:absolute;
          left: 22px;
          top: 50%;
          transform: translateY(-50%);
          width: 30px;
          height: 18px;
          display: inline-block;
        }
        .qWire:before{
          content:"";
          position:absolute;
          left: 2px;
          top: 50%;
          width: 18px;
          height: 2px;
          transform: translateY(-50%);
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(255,255,255,.10), rgba(255,255,255,.06));
        }
        .qDot{
          position:absolute;
          right: 0;
          top: 50%;
          width: 10px;
          height: 10px;
          transform: translateY(-50%);
          border-radius: 999px;
          background: rgba(255,255,255,.14);
          border: 1px solid rgba(255,255,255,.16);
          opacity: .9;
        }

        /* ✅ dot + wire 1x, sonra sabit */
        .faqCardDark.lightOn .qDot{
          opacity: 1;
          animation: dotFill .55s ease forwards;
          animation-delay: var(--bd);
        }
        @keyframes dotFill{
          0%{ background: rgba(255,255,255,.14); border-color: rgba(255,255,255,.16); transform: translateY(-50%) scale(.92); box-shadow:none; }
          100%{
            background: rgba(0,229,255,.92);
            border-color: rgba(210,245,255,.70);
            box-shadow: 0 0 12px rgba(0,229,255,.50), 0 0 28px rgba(54,162,255,.18), 0 0 60px rgba(0,229,255,.08);
            transform: translateY(-50%) scale(1);
          }
        }
        .faqCardDark.lightOn .qWire:before{
          animation: wireFill .55s ease forwards;
          animation-delay: var(--bd);
        }
        @keyframes wireFill{
          0%{ background: linear-gradient(90deg, rgba(255,255,255,.10), rgba(255,255,255,.06)); opacity:.8; box-shadow:none; }
          100%{
            background: linear-gradient(90deg, rgba(0,229,255,.40), rgba(54,162,255,.12));
            opacity:1;
            box-shadow: 0 0 16px rgba(0,229,255,.16);
          }
        }

        /* letter-by-letter (1x) */
        .qText{ flex: 1 1 auto; min-width:0; display:inline-block; line-height:1.2; }
        .qChar{ display:inline-block; color: rgba(255,255,255,.90); will-change: color, text-shadow, filter, transform; }
        .qChar.sp{ width:.33em; }
        .isEnergized .qChar{
          animation: charPulse 780ms ease-out both;
          animation-delay: var(--d);
        }
        @keyframes charPulse{
          0%{ color: rgba(255,255,255,.90); text-shadow:none; filter:none; transform: translateY(0); }
          25%{
            color: rgba(210,245,255,.96);
            text-shadow: 0 0 12px rgba(0,229,255,.18), 0 0 30px rgba(54,162,255,.10);
            filter: drop-shadow(0 0 16px rgba(0,229,255,.10));
            transform: translateY(-.2px);
          }
          55%{
            color: rgba(0,229,255,.92);
            text-shadow: 0 0 12px rgba(0,229,255,.16), 0 0 28px rgba(54,162,255,.10);
          }
          78%{
            color: rgba(180,210,255,.92);
            text-shadow: 0 0 10px rgba(120,200,255,.12), 0 0 26px rgba(0,229,255,.08);
          }
          100%{
            color: rgba(255,255,255,.92);
            text-shadow: 0 0 14px rgba(0,229,255,.08);
            filter:none;
            transform: translateY(0);
          }
        }

        .faqChevronDark{
          width: 18px; height: 18px; flex: 0 0 18px;
          border-right: 2px solid rgba(255,255,255,.55);
          border-bottom: 2px solid rgba(255,255,255,.55);
          transform: rotate(45deg);
          transition: transform .25s ease, opacity .25s ease;
          opacity: .75;
        }
        .faqItem.isOpen .faqChevronDark{ transform: rotate(-135deg); opacity: 1; }

        .faqA{
          max-height: 0;
          overflow: hidden;
          transition: max-height .35s ease, opacity .25s ease;
          opacity: 0;
        }
        .faqItem.isOpen .faqA{ max-height: 240px; opacity: 1; }
        .faqADark{ padding: 0 18px 18px 54px; color: rgba(255,255,255,.70); line-height: 1.65; margin: 0; }

        @media (max-width: 980px){
          .faqSplit{ grid-template-columns: 1fr; }
          .leftPanel{ position: relative; height: 42svh; }
          .rightInner{ padding: 78px 16px 44px 16px; }
          .leftSeamFade{ display:none; }
          .leftOnImage{ background-position: 40% 10%; }
          .pullWrap{ right: 86px; }
          .rightInner.lightOn .faqTitle{ animation: none; text-shadow: 0 0 22px rgba(0,229,255,.14); }
        }
        @media (max-width: 520px){
          .faqQDark{ padding: 14px 14px 14px 50px; }
          .faqADark{ padding: 0 14px 14px 50px; }
          .faqCardDark:before{ left: 18px; }
          .faqSplit[data-charge] .faqCardDark.lightOn:after{ left: 18px; }
          .qWire{ left: 18px; }
          .pullWrap{ right: 72px; }
          .pullButton{ height: 240px; }
          .orb{ width: 24px; height: 24px; }
        }

        @media (prefers-reduced-motion: reduce){
          .cordRig{ transform: none !important; }
          .isEnergized .qChar,
          .faqSplit[data-charge] .faqCardDark.lightOn:after,
          .rightInner.lightOn .faqTitle,
          .pullButton.pulse .orb,
          .faqCardDark.lightOn .qDot,
          .faqCardDark.lightOn .qWire:before{
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </main>
  );
}
