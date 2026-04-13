// src/components/HeroSystemBackground.tsx
import React, { useEffect, useRef, useState } from "react";

type Props = {
  className?: string;

  /** 0..1.6 (0 => ən yüngül) */
  intensity?: number;

  /** default true */
  respectReducedMotion?: boolean;

  /** HERO-nun altında yumşaq yox olma hündürlüyü (px). Default: 260 */
  fadeOutPx?: number;

  /** Matrix sütun sıxlığı (daha az = daha sürətli). Default: 11 (desktop), 8 (mobile) */
  colsDesktop?: number;
  colsMobile?: number;

  /** Pill sayı limiti (daha az = daha sürətli). Default: normal 70, reduced 42 */
  smallLimitNormal?: number;
  smallLimitReduced?: number;

  /** Burst miqdarı (daha az = daha sürətli). Default: normal 32, reduced 20 */
  burstNormal?: number;
  burstReduced?: number;

  /** ✅ NEW: dışardan pause (hero görünməyəndə true) */
  paused?: boolean;

  /** ✅ NEW: mobil üçün FPS cap (default: auto => mobile 30, desktop 60) */
  maxFps?: number;
};

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
function rr(a: number, b: number) {
  return a + Math.random() * (b - a);
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

type Hue = "red" | "blue";
type PillKind = "big" | "small";

type Pill = {
  id: number;
  kind: PillKind;
  hue: Hue;

  x: number;
  y: number;
  vx: number;
  vy: number;

  w: number;
  h: number;
  r: number;

  alpha: number;

  rot: number;
  vr: number;
};

type Stream = {
  x: number;
  y: number;
  speed: number;
  len: number;
  alpha: number;
  seed: number;
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr2 = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr2, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr2);
  ctx.arcTo(x + w, y + h, x, y + h, rr2);
  ctx.arcTo(x, y + h, x, y, rr2);
  ctx.arcTo(x, y, x + w, y, rr2);
  ctx.closePath();
}

/** ✅ "real code" simvolları */
const CODE_GLYPHS =
  "01" +
  "0123456789" +
  "abcdef" +
  "ABCDEF" +
  "{}[]()<>" +
  ";:,.=+-*/\\_|&!?#$%^~@" +
  "'\"`";

function seededChar(seed: number) {
  const x = Math.sin(seed) * 10000;
  const r = x - Math.floor(x);
  return CODE_GLYPHS[Math.floor(r * CODE_GLYPHS.length)];
}

export default function HeroSystemBackground({
  className,
  intensity = 1,
  respectReducedMotion = true,

  fadeOutPx = 260,
  colsDesktop = 11,
  colsMobile = 8,

  smallLimitNormal = 70,
  smallLimitReduced = 42,

  burstNormal = 32,
  burstReduced = 20,

  paused = false,
  maxFps,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (!respectReducedMotion) {
      setReduced(false);
      return;
    }
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = () => setReduced(!!mq.matches);
    on();
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on);
    };
  }, [respectReducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true } as any);
    if (!ctx) return;

    let alive = true;
    let raf = 0;

    // --- PERF tuning / auto quality ---
    let w = 1;
    let h = 1;

    const isMobileNow = () => w < 680;

    // FPS cap: default auto => mobile 30, desktop 60
    const FPS_CAP = Math.max(10, Math.min(120, maxFps ?? (isMobileNow() ? 30 : 60)));
    const MIN_FRAME_MS = 1000 / FPS_CAP;

    // DPR cap (mobile daha sərt)
    const DPR_CAP = reduced ? 1.0 : (isMobileNow() ? 1.0 : 1.15);

    let dpr = 1;

    let phase = 0;
    let nextId = 1;

    let bigA: Pill | null = null; // blue
    let bigB: Pill | null = null; // red
    let smalls: Pill[] = [];
    let collided = false;

    // Auto-lite: mobile və ya intensity çox aşağıdırsa daha az element
    const liteMode = () => reduced || isMobileNow() || intensity <= 0.25;

    const SMALL_LIMIT = () => {
      if (reduced) return smallLimitReduced;
      if (liteMode()) return Math.min(32, smallLimitNormal);
      return smallLimitNormal;
    };

    const BURST = () => {
      if (reduced) return burstReduced;
      if (liteMode()) return Math.min(14, burstNormal);
      return burstNormal;
    };

    let streams: Stream[] = [];

    // loop
    let respawnIn = 0;

    const pillCenter = (p: Pill) => ({ cx: p.x + p.w * 0.5, cy: p.y + p.h * 0.5 });
    const heroFocus = () => ({ x: w * 0.5, y: h * 0.52 });

    const uniformSmallSize = () => {
      const baseW = w < 520 ? 38 : 48;
      const baseH = w < 520 ? 14 : 18;
      const r = baseH * 0.5;
      return { sw: baseW, sh: baseH, sr: r };
    };

    // HERO bottom yumşaq fade (0..1)
    const fadeFactorAtY = (yy: number) => {
      const fh = clamp(fadeOutPx, 80, 520);
      const start = h - fh;
      if (yy <= start) return 1;
      const t = clamp((yy - start) / fh, 0, 1);
      return 1 - (t * t * (3 - 2 * t)); // smoothstep out
    };

    const spawnSmallBurstUniform = (x: number, y: number) => {
      const { sw, sh, sr } = uniformSmallSize();
      const burst = BURST();
      const limit = SMALL_LIMIT();

      for (let i = 0; i < burst; i++) {
        if (smalls.length >= limit) break;

        const hue: Hue = Math.random() < 0.5 ? "blue" : "red";

        const ang = rr(0, Math.PI * 2);
        const sp = reduced ? rr(0.055, 0.12) : (liteMode() ? rr(0.07, 0.16) : rr(0.09, 0.22));

        smalls.push({
          id: nextId++,
          kind: "small",
          hue,
          x: x - sw * 0.5 + rr(-10, 10),
          y: y - sh * 0.5 + rr(-10, 10),
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          w: sw,
          h: sh,
          r: sr,
          alpha: rr(0.70, 0.92),
          rot: rr(-0.24, 0.24),
          vr: rr(-0.0007, 0.0007),
        });
      }
    };

    const spawnBigPair = () => {
      collided = false;

      // liteMode-da daha kiçik ölçülər
      const scale = liteMode() ? 0.88 : 1;
      const pw = rr(175, 230) * (w < 520 ? 0.86 : 1) * scale;
      const ph = rr(52, 64) * (w < 520 ? 0.92 : 1) * scale;

      const focus = heroFocus();
      const y = clamp(focus.y - ph * 0.5, ph * 0.65, h - ph * 1.65);

      const targetX = w * 0.5 - pw * 0.5;
      const startAx = -pw * 1.25;
      const startBx = w + pw * 1.25;

      const travelMs = reduced ? 4600 : (liteMode() ? 3800 : 3200);
      const vxA = (targetX - startAx) / travelMs;
      const vxB = (targetX - startBx) / travelMs;

      const spin = reduced ? rr(0.0010, 0.0015) : (liteMode() ? rr(0.0016, 0.0022) : rr(0.0020, 0.0030));

      bigA = {
        id: nextId++,
        kind: "big",
        hue: "blue",
        x: startAx,
        y,
        vx: vxA,
        vy: 0,
        w: pw,
        h: ph,
        r: ph * 0.48,
        alpha: 1,
        rot: rr(-1.1, -0.55),
        vr: Math.abs(spin),
      };

      bigB = {
        id: nextId++,
        kind: "big",
        hue: "red",
        x: startBx,
        y,
        vx: vxB,
        vy: 0,
        w: pw,
        h: ph,
        r: ph * 0.48,
        alpha: 1,
        rot: rr(0.55, 1.1),
        vr: -Math.abs(spin),
      };
    };

    const fit = () => {
      const rect = wrap.getBoundingClientRect();
      dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);

      w = Math.max(1, Math.floor(rect.width || 1));
      h = Math.max(1, Math.floor(rect.height || 1));

      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const isMobile = w < 680;

      // cols: liteMode və mobile üçün azaldırıq
      const baseCols = isMobile ? colsMobile : colsDesktop;
      const cols = clamp(
        liteMode() ? Math.max(5, Math.floor(baseCols * 0.75)) : baseCols,
        5,
        16
      );

      // intensity çox aşağıdırsa matrix-i zəiflədirik
      const streamAlphaMult = intensity <= 0.25 ? 0.55 : 1;

      streams = new Array(cols).fill(0).map((_, i) => {
        const x = (i + rr(0.15, 0.85)) * (w / cols);
        return {
          x,
          y: rr(-h, 0),
          speed: rr(20, 48) * (reduced ? 0.45 : liteMode() ? 0.75 : 1),
          len: rr(8, liteMode() ? 12 : 15),
          alpha: rr(0.070, 0.135) * (reduced ? 0.85 : 1) * streamAlphaMult,
          seed: rr(1, 9999),
        };
      });

      smalls = [];
      bigA = null;
      bigB = null;
      collided = false;
      respawnIn = 0;

      spawnBigPair();
    };

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    ro?.observe(wrap);
    fit();

    let last = performance.now();
    let lastDraw = last;

    let pausedLocal = document.visibilityState === "hidden";
    const onVis = () => {
      pausedLocal = document.visibilityState === "hidden";
      last = performance.now();
      lastDraw = last;
      if (!pausedLocal && alive) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(draw);
      }
    };
    document.addEventListener("visibilitychange", onVis);

    function drawMatrix(dt: number) {
      // intensity çox azdırsa matrix-i ümumiyyətlə çəkmə (FPS boost)
      if (intensity <= 0.1) return;

      // trail: liteMode-da daha az repaint (daha açıq alpha => daha az iz)
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      const fadeA = reduced ? 0.18 : (liteMode() ? 0.11 : 0.14);
      ctx.fillStyle = `rgba(0,0,0,${fadeA})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      const fontSize = w < 520 ? 12 : 13;

      ctx.save();
      ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
      ctx.textBaseline = "top";
      ctx.globalCompositeOperation = "lighter";

      const ph = Math.floor(phase * 10);

      for (const s of streams) {
        s.y += s.speed * (dt * 0.001);
        if (s.y - s.len * fontSize > h + 40) {
          s.y = rr(-h, -20);
          s.speed = rr(20, 48) * (reduced ? 0.45 : liteMode() ? 0.75 : 1);
          s.alpha = rr(0.070, 0.135) * (reduced ? 0.85 : 1) * (intensity <= 0.25 ? 0.55 : 1);
          s.seed = rr(1, 9999);
        }

        for (let i = 0; i < s.len; i++) {
          const yy = s.y - i * (fontSize + 2);
          if (yy < -40 || yy > h + 20) continue;

          const fade = fadeFactorAtY(yy + fontSize * 0.5);
          const head = i === 0;

          const a =
            s.alpha *
            (head ? 1.55 : lerp(0.34, 1.02, 1 - i / s.len)) *
            (0.92 + 0.22 * intensity) *
            fade;

          if (a <= 0.002) continue;

          const ch = seededChar(s.seed + i * 13 + ph);
          ctx.fillStyle = head ? `rgba(240,252,255,${a})` : `rgba(47,184,255,${a})`;
          ctx.fillText(ch, s.x, yy);
        }
      }

      ctx.restore();
    }

    function drawGelCapsule(p: Pill) {
      // intensity çox azdırsa pills layer-i çəkmə
      if (intensity <= 0.2) return;

      const ww = p.w;
      const hh = p.h;
      const x = p.x;
      const y = p.y;

      const gx = x + ww * 0.5;
      const gy = y + hh * 0.5;

      const fade = fadeFactorAtY(gy);
      const alpha = clamp(p.alpha, 0, 1) * (p.kind === "small" ? 0.92 : 1) * fade;
      if (alpha <= 0.01) return;

      const isBlue = p.hue === "blue";
      const c1 = isBlue ? "rgba(47,184,255," : "rgba(255,45,85,";
      const c2 = isBlue ? "rgba(42,125,255," : "rgba(255,115,135,";
      const rim = isBlue ? "rgba(170,225,255," : "rgba(255,165,185,";

      // glow
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(ww, hh) * 0.95);
      g.addColorStop(0, `${c1}${0.11 * alpha})`);
      g.addColorStop(0.55, `${c2}${0.055 * alpha})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(gx, gy, Math.max(ww, hh) * 1.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(p.rot);
      ctx.translate(-gx, -gy);

      const body = ctx.createLinearGradient(x, y, x + ww, y + hh);
      body.addColorStop(0, `rgba(255,255,255,${0.065 * alpha})`);
      body.addColorStop(0.18, `${c1}${0.18 * alpha})`);
      body.addColorStop(0.55, `${c2}${0.15 * alpha})`);
      body.addColorStop(1, `rgba(255,255,255,${0.035 * alpha})`);

      const core = ctx.createLinearGradient(x, y + hh * 0.15, x + ww, y + hh * 0.85);
      core.addColorStop(0, `${c2}${0.085 * alpha})`);
      core.addColorStop(0.5, `${c1}${0.13 * alpha})`);
      core.addColorStop(1, `${c2}${0.065 * alpha})`);

      roundRect(ctx, x, y, ww, hh, p.r);
      ctx.fillStyle = body;
      ctx.fill();

      const inset = Math.max(2, Math.floor(hh * 0.12));
      roundRect(ctx, x + inset, y + inset, ww - inset * 2, hh - inset * 2, Math.max(4, p.r - 3));
      ctx.fillStyle = core;
      ctx.fill();

      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = 1.0;
      ctx.strokeStyle = `${rim}${0.19 * alpha})`;
      roundRect(ctx, x + 0.5, y + 0.5, ww - 1, hh - 1, p.r);
      ctx.stroke();

      const split = x + ww * 0.53;
      ctx.beginPath();
      ctx.moveTo(split, y + hh * 0.20);
      ctx.lineTo(split, y + hh * 0.80);
      ctx.strokeStyle = isBlue ? `rgba(47,184,255,${0.21 * alpha})` : `rgba(255,45,85,${0.21 * alpha})`;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.globalCompositeOperation = "screen";
      const hi = ctx.createLinearGradient(x + ww * 0.15, y + hh * 0.12, x + ww * 0.55, y + hh * 0.9);
      hi.addColorStop(0, `rgba(255,255,255,${0.20 * alpha})`);
      hi.addColorStop(0.35, `rgba(255,255,255,${0.075 * alpha})`);
      hi.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = hi;
      roundRect(ctx, x + ww * 0.12, y + hh * 0.14, ww * 0.28, hh * 0.72, hh * 0.45);
      ctx.fill();

      ctx.restore();
    }

    function update(dt: number) {
      // intensity azdırsa pills update etmə (FPS boost)
      if (intensity <= 0.2) return;

      if (!collided && bigA && bigB) {
        bigA.x += bigA.vx * dt;
        bigA.rot += bigA.vr * dt;

        bigB.x += bigB.vx * dt;
        bigB.rot += bigB.vr * dt;

        const ac = pillCenter(bigA);
        const bc = pillCenter(bigB);
        const d = Math.hypot(bc.cx - ac.cx, bc.cy - ac.cy);

        const th = Math.min(bigA.w, bigA.h) * 0.62;
        if (d < th) {
          collided = true;

          const mx = (ac.cx + bc.cx) * 0.5;
          const my = (ac.cy + bc.cy) * 0.5;

          spawnSmallBurstUniform(mx, my);

          bigA = null;
          bigB = null;

          respawnIn = reduced ? 1500 : (liteMode() ? 1250 : 1100);
        }
      }

      const PAD = 140;
      for (let i = smalls.length - 1; i >= 0; i--) {
        const p = smalls[i];

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;

        p.vx *= reduced ? 0.9968 : liteMode() ? 0.9978 : 0.9975;
        p.vy *= reduced ? 0.9968 : liteMode() ? 0.9978 : 0.9975;

        p.alpha = clamp(p.alpha - (reduced ? 0.000020 : (liteMode() ? 0.000030 : 0.000030)) * dt, 0, 1);

        const off = p.x < -PAD || p.x > w + PAD || p.y < -PAD || p.y > h + PAD || p.alpha <= 0.02;
        if (off) smalls.splice(i, 1);
      }

      const limit = SMALL_LIMIT();
      if (smalls.length > limit) smalls.length = limit;

      if (!bigA && !bigB) {
        respawnIn -= dt;
        if (respawnIn <= 0 && smalls.length < (reduced ? 3 : liteMode() ? 5 : 8)) {
          spawnBigPair();
        }
      }
    }

    const draw = () => {
      if (!alive) return;

      // ✅ PAUSE: hero görünmürsə və ya tab hidden-dirsə
      if (paused || pausedLocal) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const now = performance.now();
      const dtRaw = now - last;
      last = now;

      // ✅ FPS CAP: çox tez gələn frame-ləri skip et
      if (now - lastDraw < MIN_FRAME_MS) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const dt = Math.min(40, now - lastDraw);
      lastDraw = now;

      phase += dt * 0.001;

      // clear
      ctx.clearRect(0, 0, w, h);

      // vignette (yüngül)
      ctx.save();
      const vg = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.55, Math.max(w, h) * 0.8);
      vg.addColorStop(0, `rgba(0,0,0,0)`);
      vg.addColorStop(1, `rgba(0,0,0,0.66)`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      drawMatrix(dt);
      update(dt);

      // pills draw
      if (intensity > 0.2) {
        for (const p of smalls) drawGelCapsule(p);
        if (bigA) drawGelCapsule(bigA);
        if (bigB) drawGelCapsule(bigB);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [
    intensity,
    reduced,
    fadeOutPx,
    colsDesktop,
    colsMobile,
    smallLimitNormal,
    smallLimitReduced,
    burstNormal,
    burstReduced,
    paused,
    maxFps,
  ]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}
