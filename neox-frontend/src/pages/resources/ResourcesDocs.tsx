import React, { memo, useEffect, useRef, useState } from "react";

const DAY_HERO_IMG =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1771195679/ChatGPT_Image_Feb_16_2026_02_45_45_AM_mpzrzt.png";

const NIGHT_HERO_IMG =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1771195665/ChatGPT_Image_Feb_16_2026_02_40_45_AM_kn8wrt.png";

const DAY_SCI_BG =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1771197628/ChatGPT_Image_Feb_16_2026_03_20_10_AM_fwlwmr.png";

const NIGHT_SCI_BG =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1771197629/ChatGPT_Image_Feb_16_2026_03_20_15_AM_lqozta.png";

export default memo(function ResourcesDocs() {
  const [mode, setMode] = useState<"day" | "night">("day");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Mobil üçün: kənara klik edəndə bağla
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  const isNight = mode === "night";
  const heroImg = isNight ? NIGHT_HERO_IMG : DAY_HERO_IMG;
  const sciBg = isNight ? NIGHT_SCI_BG : DAY_SCI_BG;

  return (
    <main className={`neo-page ${isNight ? "isNight" : "isDay"}`}>
      <style>{`
        html, body {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
        }

        .neo-page{
          min-height: 100vh;
          overflow-x: hidden;

          /* theme vars */
          --page-bg: #ffffff;
          --text: #0b0b0b;
          --muted: rgba(0,0,0,0.65);
          --fade-bg: #ffffff;
        }

        .neo-page.isNight{
          --page-bg: #0b0b0b;
          --text: #ffffff;
          --muted: rgba(255,255,255,0.72);
          --fade-bg: #0b0b0b;
        }

        .neo-page{
          background: var(--page-bg);
          color: var(--text);
        }

        /* =========================
           HERO
           ========================= */

        .neo-hero {
          position: relative;
          width: 100%;
          background: #000; /* contain olanda boş yer qalsa qara görünsün */
          overflow: hidden;
          isolation: isolate; /* z-index fix */
        }

        /* Şəkil yalnız hero-da: crop/zoom YOX */
        .neo-hero img {
          display: block;
          width: 100%;
          height: auto;
          object-fit: contain;
          user-select: none;
          -webkit-user-drag: none;
          position: relative;
          z-index: 1; /* şəkil aşağı lay */
        }

        /* =========================
           Toggle HERO üstündə
           ========================= */

        .neo-mode-wrap {
          position: absolute;
          top: 90px;
          left: 18px;
          z-index: 9999;
          pointer-events: auto;
        }

        .neo-mode-pill {
          display: flex;
          align-items: center;
          gap: 10px;
          height: 42px;
          padding: 8px;
          border-radius: 999px;
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.14);
          box-shadow: 0 8px 24px rgba(0,0,0,0.25);
          transition: width 180ms ease, padding 180ms ease, background 180ms ease;
          overflow: hidden;
          width: 46px;
        }

        .neo-mode-pill.isOpen {
          width: 190px;
          padding: 8px 10px;
          background: rgba(0,0,0,0.62);
        }

        .neo-mode-iconBtn {
          width: 30px;
          height: 30px;
          border-radius: 999px;
          border: 0;
          background: rgba(255,255,255,0.12);
          color: #fff;
          display: grid;
          place-items: center;
          cursor: pointer;
          flex: 0 0 auto;
        }

        .neo-mode-iconBtn:active {
          transform: translateY(1px);
        }

        .neo-mode-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: 2px;
          opacity: 0;
          pointer-events: none;
          transform: translateX(-4px);
          transition: opacity 160ms ease, transform 160ms ease;
          white-space: nowrap;
        }

        .neo-mode-pill.isOpen .neo-mode-actions {
          opacity: 1;
          pointer-events: auto;
          transform: translateX(0px);
        }

        .neo-mode-btn {
          border: none;
          background: transparent;
          color: #fff;
          padding: 6px 10px;
          border-radius: 999px;
          cursor: pointer;
          font-size: 13px;
          opacity: 0.7;
          transition: opacity 140ms ease, background 140ms ease;
        }

        .neo-mode-btn:hover { opacity: 1; }

        .neo-mode-btn.active {
          background: rgba(255,255,255,0.16);
          opacity: 1;
        }

        @media (hover: none) {
          .neo-mode-pill { width: 46px; }
          .neo-mode-pill.isOpen { width: 190px; }
        }

        /* =========================
           SCI SECTION (background)
           - hard line olmasın: üst/alt gradient fade
           ========================= */

        .neo-sci {
          position: relative;
          isolation: isolate;
          overflow: hidden;

          /* background */
          background-image: var(--sci-bg);
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;

          /* spacing */
          padding: 72px 16px;
        }

        /* yumşaq “natural” qaralma (text oxunaqlı olsun) */
        .neo-sci::before{
          content: "";
          position: absolute;
          inset: 0;
          z-index: 0;

          /* yüngül overlay + çox az vignette hissi */
          background:
            radial-gradient(1200px 520px at 50% 40%, rgba(0,0,0,0.18), rgba(0,0,0,0.35)),
            linear-gradient(to bottom, rgba(0,0,0,0.18), rgba(0,0,0,0.18));
          mix-blend-mode: normal;
          pointer-events: none;
        }

        /* sectionlar arası düz xətt olmasın: top/bottom fade */
        .neo-sci::after{
          content: "";
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;

          background:
            linear-gradient(to bottom,
              var(--fade-bg) 0%,
              rgba(255,255,255,0) 12%,
              rgba(255,255,255,0) 88%,
              var(--fade-bg) 100%
            );
        }

        .neo-page.isNight .neo-sci::after{
          background:
            linear-gradient(to bottom,
              var(--fade-bg) 0%,
              rgba(11,11,11,0) 12%,
              rgba(11,11,11,0) 88%,
              var(--fade-bg) 100%
            );
        }

        .neo-sci-inner{
          position: relative;
          z-index: 2;
          max-width: 980px;
          margin: 0 auto;
        }

        .neo-sci-card{
          max-width: 720px;
          padding: 18px 18px;
          border-radius: 18px;
          background: rgba(0,0,0,0.34);
          border: 1px solid rgba(255,255,255,0.14);
          backdrop-filter: blur(8px);
          box-shadow: 0 18px 60px rgba(0,0,0,0.35);
        }

        .neo-sci-title{
          margin: 0;
          font-size: 28px;
          letter-spacing: -0.02em;
          color: #fff;
        }

        .neo-sci-text{
          margin: 10px 0 0;
          color: rgba(255,255,255,0.84);
          line-height: 1.55;
        }

        /* =========================
           Content after sections
           ========================= */
        .neo-content {
          background: var(--page-bg);
          color: var(--text);
          padding: 24px 16px;
        }

        .neo-content p{
          color: var(--muted);
        }
      `}</style>

      {/* HERO */}
      <section className="neo-hero">
        {/* Toggle HERO-nun ÜSTÜNDƏ */}
        <div className="neo-mode-wrap" ref={wrapRef}>
          <div
            className={`neo-mode-pill ${open ? "isOpen" : ""}`}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            <button
              className="neo-mode-iconBtn"
              aria-label={isNight ? "Gecə rejimi" : "Gündüz rejimi"}
              onClick={() => setOpen((v) => !v)}
              type="button"
            >
              {isNight ? "🌙" : "☀️"}
            </button>

            <div className="neo-mode-actions" role="group" aria-label="Theme">
              <button
                className={`neo-mode-btn ${mode === "day" ? "active" : ""}`}
                onClick={() => setMode("day")}
                type="button"
              >
                Gündüz
              </button>
              <button
                className={`neo-mode-btn ${mode === "night" ? "active" : ""}`}
                onClick={() => setMode("night")}
                type="button"
              >
                Gecə
              </button>
            </div>
          </div>
        </div>

        {/* Şəkil yalnız HERO-da */}
        <img src={heroImg} alt="" draggable={false} />
      </section>

      {/* SCI SECTION (background) */}
      <section
        className="neo-sci"
        style={
          {
            // CSS variable ilə bg dəyişirik (day/night)
            ["--sci-bg" as any]: `url("${sciBg}")`,
          } as React.CSSProperties
        }
      >
        <div className="neo-sci-inner">
          <div className="neo-sci-card">
            <h2 className="neo-sci-title">SCI Section</h2>
            <p className="neo-sci-text">
              Bu section-un background-u day/night rejiminə görə dəyişir və
              yuxarı/aşağı hissədə yumşaq fade var — sectionlar arasında düz xətt
              kimi kəsilmə görünməsin deyə.
            </p>
          </div>

          <div style={{ height: 420 }} />
        </div>
      </section>

      {/* Aşağı hissə */}
      <section className="neo-content">
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <h2 style={{ margin: 0 }}>Content</h2>
          <p style={{ marginTop: 10 }}>
            Bu hissədə background şəkil yoxdur — yalnız HERO və SCI section-da var.
          </p>
          <div style={{ height: 800 }} />
        </div>
      </section>
    </main>
  );
});
