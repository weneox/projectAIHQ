"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type Step = {
  id: string;
  title: string;
  desc: string;
  bullets: string[];
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}
function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** ===========================
 *  Canvas -> point target
 * =========================== */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function buildTargetFromCanvas(args: {
  w: number;
  h: number;
  step: number;
  alphaCutoff?: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}) {
  const { w, h, step, alphaCutoff = 10, draw } = args;
  const c = document.createElement("canvas");
  c.width = Math.max(2, Math.floor(w));
  c.height = Math.max(2, Math.floor(h));
  const ctx = c.getContext("2d");
  if (!ctx) return new Float32Array(0);

  ctx.clearRect(0, 0, c.width, c.height);
  draw(ctx);

  const img = ctx.getImageData(0, 0, c.width, c.height);
  const data = img.data;

  const pts: number[] = [];
  for (let y = 0; y < c.height; y += step) {
    for (let x = 0; x < c.width; x += step) {
      const i = (y * c.width + x) * 4;
      const a = data[i + 3];
      if (a > alphaCutoff) {
        const wx = x - c.width / 2;
        const wy = -(y - c.height / 2);
        pts.push(wx, wy, 0);
      }
    }
  }
  return new Float32Array(pts);
}

function normalizeToCount(src: Float32Array, count: number) {
  const srcCount = Math.floor(src.length / 3);
  const out = new Float32Array(count * 3);
  if (srcCount <= 0 || count <= 0) return out;

  for (let i = 0; i < count; i++) {
    const si = (i % srcCount) * 3;
    const oi = i * 3;
    out[oi] = src[si];
    out[oi + 1] = src[si + 1];
    out[oi + 2] = src[si + 2];
  }
  return out;
}

/** ===========================
 *  SVG workflow overlay
 *  - real DOM positions -> path
 *  - strokeDashoffset + moving dots
 * =========================== */
function WorkflowOverlay(props: {
  stepRefs: React.MutableRefObject<HTMLElement[]>;
  enabled: boolean;
  navbarOffset?: number;
}) {
  const { stepRefs, enabled, navbarOffset = 0 } = props;
  const pathRef = useRef<SVGPathElement | null>(null);
  const dotRefs = useRef<Array<SVGCircleElement | null>>([]);
  const [d, setD] = useState("");

  useLayoutEffect(() => {
    if (!enabled) return;

    const build = () => {
      const els = stepRefs.current.filter(Boolean);
      if (els.length < 2) return;

      const pts = els.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.left + r.width / 2,
          y: r.top + r.height / 2 + navbarOffset,
        };
      });

      let nd = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1];
        const p1 = pts[i];
        const mx = (p0.x + p1.x) / 2;
        nd += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
      }
      setD(nd);
    };

    build();
    window.addEventListener("resize", build);
    window.addEventListener("scroll", build, { passive: true });

    return () => {
      window.removeEventListener("resize", build);
      window.removeEventListener("scroll", build);
    };
  }, [enabled, navbarOffset, stepRefs]);

  useEffect(() => {
    if (!enabled) return;
    const path = pathRef.current;
    if (!path) return;

    const total = path.getTotalLength();
    path.style.strokeDasharray = `${total}`;
    path.style.strokeDashoffset = `${total}`;

    const st = ScrollTrigger.create({
      trigger: "#wf-track",
      start: "top top",
      end: "bottom bottom",
      scrub: 1,
      onUpdate: (self) => {
        const p = self.progress;
        path.style.strokeDashoffset = `${total * (1 - p)}`;

        const dots = dotRefs.current;
        for (let i = 0; i < dots.length; i++) {
          const t = clamp01(p - i * 0.12);
          const len = total * clamp01(t);
          const pt = path.getPointAtLength(len);
          const c = dots[i];
          if (c) {
            c.setAttribute("cx", `${pt.x}`);
            c.setAttribute("cy", `${pt.y}`);
            c.style.opacity = t > 0 ? "1" : "0";
          }
        }
      },
    });

    return () => st.kill();
  }, [enabled, d]);

  if (!enabled) return null;

  return (
    <svg className="wfSvg" width="100%" height="100%" aria-hidden="true">
      <path ref={pathRef} className="wfPath" d={d} fill="none" vectorEffect="non-scaling-stroke" />
      {Array.from({ length: 6 }).map((_, i) => (
        <circle
          key={i}
          className="wfDot"
          r={4}
          ref={(el) => {
            dotRefs.current[i] = el;
          }}
        />
      ))}
    </svg>
  );
}

/** ===========================
 *  PAGE
 *  - normal intro first
 *  - scroll -> intro fades
 *  - then dust particles appear + form blocks
 *  - then workflow path completes
 * =========================== */
export default function NeonBusinessWorkflowDustPage() {
  const reduceMotion =
    typeof window !== "undefined"
      ? (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false)
      : false;

  // DOM
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // cards refs for svg path anchors
  const stepRefs = useRef<HTMLElement[]>([]);
  const setStepRef = (i: number) => (el: HTMLElement | null) => {
    if (!el) return;
    stepRefs.current[i] = el;
  };

  const [wfEnabled, setWfEnabled] = useState(false);

  const steps: Step[] = useMemo(
    () => [
      {
        id: "map",
        title: "Biznes xəritəsi",
        desc: "Prosesləri xəritələyirik, bottleneck-ləri tapırıq və hədəf nəticəni ölçülə bilən edirik.",
        bullets: ["Audit + KPI", "Müştəri yolu", "Risk/ROI", "Prioritet plan"],
      },
      {
        id: "systems",
        title: "Sistemlər birləşir",
        desc: "CRM, WhatsApp/Telegram/Instagram, form-lar, e-poçt, payment və daxili sistemlər bir axına girir.",
        bullets: ["Integrasiya", "Webhook/ETL", "Notification", "Dashboard"],
      },
      {
        id: "automation",
        title: "Avtomasiya axınları",
        desc: "SMM, satış və support üçün qaydalar qurulur: lead bölünür, task açılır, cavablar avtomatik gedir.",
        bullets: ["SMM automation", "Lead routing", "Task orchestration", "Follow-up"],
      },
      {
        id: "ai",
        title: "AI Chatbot 24/7",
        desc: "Məlumat bazası ilə danışan bot: sual cavab, təklif, sifariş yönləndirmə və canlı operatora ötürmə.",
        bullets: ["Knowledge base", "Çox dil", "Analytics", "Human handoff"],
      },
    ],
    []
  );

  /** ===========================
   *  THREE: particles + morph targets
   * =========================== */
  useEffect(() => {
    if (reduceMotion) return;
    const mount = mountRef.current;
    if (!mount) return;

    let killed = false;
    let raf = 0;

    // sizes
    const getSize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      return { w, h };
    };

    // scene
    const scene = new THREE.Scene();
    const { w, h } = getSize();
    const camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, -2000, 2000);
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // particles
    const COUNT = 32000; // denser for "dust vibe"
    const geometry = new THREE.BufferGeometry();

    const positions = new Float32Array(COUNT * 3);
    const velocities = new Float32Array(COUNT * 3);

    // initial: spread cloud (we'll fade in later by opacity)
    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3;
      positions[ix] = (Math.random() - 0.5) * w * 1.4;
      positions[ix + 1] = (Math.random() - 0.5) * h * 1.2;
      positions[ix + 2] = (Math.random() - 0.5) * 40;

      velocities[ix] = (Math.random() - 0.5) * 0.6;
      velocities[ix + 1] = (Math.random() - 0.5) * 0.6;
      velocities[ix + 2] = (Math.random() - 0.5) * 0.2;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      size: 2.0,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0, // IMPORTANT: start invisible (normal intro first)
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: new THREE.Color("#2AA8FF"), // neon blue
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // mouse interaction (subtle)
    const mouse = { x: 0, y: 0, has: false };
    const onMove = (e: PointerEvent) => {
      const rect = mount.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / Math.max(1, rect.width);
      const ny = (e.clientY - rect.top) / Math.max(1, rect.height);
      mouse.x = (nx - 0.5) * 2;
      mouse.y = -(ny - 0.5) * 2;
      mouse.has = true;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    // targets
    let targets: Float32Array[] = [];
    let currentTargetIndex = 0;

    const makeTargets = () => {
      const sz = getSize();

      // base cloud
      const cloud = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        const ix = i * 3;
        cloud[ix] = (Math.random() - 0.5) * sz.w * 1.5;
        cloud[ix + 1] = (Math.random() - 0.5) * sz.h * 1.2;
        cloud[ix + 2] = (Math.random() - 0.5) * 55;
      }

      // card silhouette targets
      const cardTarget = (title: string, idx: number) => {
        const cw = Math.min(980, sz.w * 0.82);
        const ch = Math.min(280, sz.h * 0.34);

        const pts = buildTargetFromCanvas({
          w: cw,
          h: ch,
          step: 4,
          draw: (ctx) => {
            const W = ctx.canvas.width;
            const H = ctx.canvas.height;

            // card body
            ctx.fillStyle = "rgba(255,255,255,0.95)";
            drawRoundedRect(ctx, 18, 18, W - 36, H - 36, 34);
            ctx.fill();

            // top "chip"
            ctx.fillStyle = "rgba(0,0,0,0.90)";
            ctx.beginPath();
            ctx.arc(60, 64, 14, 0, Math.PI * 2);
            ctx.fill();

            // title
            ctx.fillStyle = "rgba(0,0,0,0.92)";
            ctx.font = `800 ${Math.floor(Math.max(18, W * 0.045))}px Inter, system-ui, sans-serif`;
            ctx.textAlign = "left";
            ctx.textBaseline = "top";
            ctx.fillText(title, 92, 48);

            // content lines
            ctx.fillStyle = "rgba(0,0,0,0.34)";
            const y0 = 118;
            for (let i = 0; i < 5; i++) {
              ctx.fillRect(56, y0 + i * 26, Math.max(170, W * 0.58) - i * 26, 10);
            }

            // slight "tech notch"
            ctx.fillStyle = "rgba(0,0,0,0.14)";
            ctx.fillRect(W - 190, 24, 150, 10);

            // mini left accent
            ctx.fillStyle = "rgba(0,0,0,0.10)";
            ctx.fillRect(18, 18, 12, H - 36);
          },
        });

        const normalized = normalizeToCount(pts, COUNT);

        // position each card slightly different (so it feels like a sequence)
        const shiftX = (idx - 1.5) * Math.min(220, sz.w * 0.12);
        const shiftY = (idx % 2 === 0 ? 1 : -1) * Math.min(70, sz.h * 0.05);

        for (let i = 0; i < COUNT; i++) {
          const ix = i * 3;
          normalized[ix] += shiftX;
          normalized[ix + 1] += shiftY;
          normalized[ix + 2] = (Math.random() - 0.5) * 10;
        }
        return normalized;
      };

      // final: workflow "field" (dotted terrain)
      const bandPts = buildTargetFromCanvas({
        w: sz.w,
        h: sz.h,
        step: 6,
        draw: (ctx) => {
          const W = ctx.canvas.width;
          const H = ctx.canvas.height;

          ctx.fillStyle = "rgba(255,255,255,0.95)";
          ctx.beginPath();
          ctx.moveTo(0, H * 0.62);
          for (let x = 0; x <= W; x += 36) {
            const t = x / W;
            const y =
              H *
              (0.60 +
                0.05 * Math.sin(t * Math.PI * 2) +
                0.03 * Math.sin(t * Math.PI * 6) +
                0.015 * Math.sin(t * Math.PI * 14));
            ctx.lineTo(x, y);
          }
          ctx.lineTo(W, H);
          ctx.lineTo(0, H);
          ctx.closePath();
          ctx.fill();
        },
      });
      const band = normalizeToCount(bandPts, COUNT);
      for (let i = 0; i < COUNT; i++) band[i * 3 + 2] = (Math.random() - 0.5) * 18;

      targets = [
        cloud,
        cardTarget("Biznes xəritəsi", 0),
        cardTarget("Sistemlər birləşir", 1),
        cardTarget("Avtomasiya axınları", 2),
        cardTarget("AI Chatbot 24/7", 3),
        band,
      ];
    };

    makeTargets();

    // morph controller
    const morph = {
      t: 0,
      active: false,
      from: new Float32Array(COUNT * 3),
      to: new Float32Array(COUNT * 3),
    };

    const setTarget = (idx: number) => {
      const clamped = Math.max(0, Math.min(idx, targets.length - 1));
      currentTargetIndex = clamped;
      morph.from.set(positions);
      morph.to.set(targets[clamped]);
      morph.t = 0;
      morph.active = true;

      gsap.to(morph, {
        t: 1,
        duration: 0.95,
        ease: "power2.out",
        onComplete: () => {
          morph.active = false;
        },
      });
    };

    // render loop
    const tick = () => {
      if (killed) return;

      const time = performance.now() * 0.00025;

      // subtle interactivity (only when particles are visible)
      const vis = (material as THREE.PointsMaterial).opacity;
      const mx = mouse.has ? mouse.x : 0;
      const my = mouse.has ? mouse.y : 0;
      const pull = 0.0016 * vis;

      if (morph.active) {
        const t = morph.t;
        for (let i = 0; i < COUNT; i++) {
          const ix = i * 3;
          positions[ix] = lerp(morph.from[ix], morph.to[ix], t);
          positions[ix + 1] = lerp(morph.from[ix + 1], morph.to[ix + 1], t);
          positions[ix + 2] = lerp(morph.from[ix + 2], morph.to[ix + 2], t);
        }
        (geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      } else {
        // light "dust drift"
        const attr = geometry.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < COUNT; i += 10) {
          const ix = i * 3;
          const vx = velocities[ix];
          const vy = velocities[ix + 1];

          positions[ix] += vx * 0.18 + Math.sin(time + i) * 0.02;
          positions[ix + 1] += vy * 0.18 + Math.cos(time + i) * 0.02;

          // gentle pull towards mouse (screen-space-ish)
          positions[ix] += mx * 18 * pull;
          positions[ix + 1] += my * 18 * pull;
        }
        attr.needsUpdate = true;
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    /** ===========================
     *  SCROLL STORY
     *  1) intro pinned, fades out
     *  2) dust stage pinned, particles appear + morph + cards reveal
     * =========================== */
    const introTL = gsap.timeline({
      scrollTrigger: {
        trigger: "#intro",
        start: "top top",
        end: "+=1200",
        scrub: 1,
        pin: true,
        anticipatePin: 1,
      },
    });

    introTL
      .to(".introGlow", { opacity: 0.15, duration: 1 }, 0)
      .to(".introTitle", { y: -18, opacity: 0.0, duration: 1 }, 0.2)
      .to(".introSub", { y: -12, opacity: 0.0, duration: 1 }, 0.25)
      .to(".introPanel", { opacity: 0.0, duration: 1 }, 0.35)
      .to(
        material,
        {
          opacity: 0.0,
          duration: 0.1,
        },
        0
      );

    // dust stage timeline
    const dustTL = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: "#dustStage",
        start: "top top",
        end: "+=5600",
        scrub: 1,
        pin: true,
        anticipatePin: 1,
        onUpdate: (self) => {
          // enable workflow overlay in the latter half
          setWfEnabled(self.progress > 0.62);
        },
      },
    });

    // set initial card state
    gsap.set(".dustCard", { opacity: 0, y: 16, filter: "blur(6px)" });

    // particles fade in at start of dust stage
    dustTL.to(material, { opacity: 0.88, duration: 0.25 }, 0.0);

    // helper: reveal card
    const reveal = (sel: string, at: number) => {
      dustTL
        .to(sel, { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.24, ease: "power2.out" }, at)
        .to(sel, { opacity: 0.0, y: -10, filter: "blur(6px)", duration: 0.22, ease: "power2.in" }, at + 0.70);
    };

    // story steps: cloud -> card silhouettes -> final band
    dustTL.add(() => setTarget(0), 0.03);

    dustTL.add(() => setTarget(1), 0.12);
    reveal("#card-0", 0.15);

    dustTL.add(() => setTarget(2), 0.30);
    reveal("#card-1", 0.33);

    dustTL.add(() => setTarget(3), 0.48);
    reveal("#card-2", 0.51);

    dustTL.add(() => setTarget(4), 0.66);
    reveal("#card-3", 0.69);

    // final: terrain band + keep cards visible afterwards (we'll fade them back in at end)
    dustTL.add(() => setTarget(5), 0.84);

    // At the end, bring all cards in together (so user sees full workflow summary)
    dustTL.to(".dustCard", { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.25, ease: "power2.out" }, 0.90);

    // resize
    const onResize = () => {
      const sz = getSize();
      renderer.setSize(sz.w, sz.h, false);

      camera.left = -sz.w / 2;
      camera.right = sz.w / 2;
      camera.top = sz.h / 2;
      camera.bottom = -sz.h / 2;
      camera.updateProjectionMatrix();

      makeTargets();
      morph.to.set(targets[currentTargetIndex]);
    };
    window.addEventListener("resize", onResize);

    return () => {
      killed = true;
      cancelAnimationFrame(raf);

      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove as any);

      introTL.scrollTrigger?.kill();
      introTL.kill();

      dustTL.scrollTrigger?.kill();
      dustTL.kill();

      scene.remove(points);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [reduceMotion]);

  return (
    <div ref={rootRef} className="page">
      <style>{`
        :root{
          --bg0:#05070c;
          --bg1:#070a14;
          --card:rgba(8,12,22,0.55);
          --border:rgba(255,255,255,0.08);
          --neon:#2AA8FF;
          --neon2:#55E7FF;
          --text:#EAF6FF;
        }

        *{box-sizing:border-box;}
        html,body{height:100%;}
        body{margin:0; background:var(--bg0); color:var(--text);}

        .page{
          min-height:100vh;
          position:relative;
          overflow-x:hidden;
          background:
            radial-gradient(900px 600px at 50% 0%, rgba(42,168,255,0.14), transparent 55%),
            radial-gradient(1100px 700px at 80% 20%, rgba(85,231,255,0.08), transparent 60%),
            linear-gradient(180deg, var(--bg1), var(--bg0));
        }

        /* webgl behind content */
        .webglLayer{
          position:fixed;
          inset:0;
          z-index:0;
          pointer-events:none;
        }
        .content{
          position:relative;
          z-index:1;
        }

        /* topbar */
        .topbar{
          position:sticky;
          top:0;
          z-index:20;
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding:16px 20px;
          border-bottom:1px solid rgba(255,255,255,0.06);
          background:rgba(5,7,12,0.55);
          backdrop-filter: blur(10px);
        }
        .brand{
          display:flex; align-items:center; gap:10px;
          font-weight:800; letter-spacing:.2px;
        }
        .badge{
          width:10px;height:10px;border-radius:999px;
          background: radial-gradient(circle at 30% 30%, var(--neon2), var(--neon));
          box-shadow: 0 0 18px rgba(42,168,255,0.55);
        }
        .navHint{opacity:.75;font-size:13px;}
        .cta{
          padding:10px 14px;
          border-radius:999px;
          border:1px solid rgba(42,168,255,0.35);
          background: rgba(42,168,255,0.10);
          color:var(--text);
          text-decoration:none;
          font-weight:800;
        }

        /* INTRO */
        #intro{
          min-height:100vh;
          display:grid;
          place-items:center;
          padding:80px 18px;
          position:relative;
        }
        .introGlow{
          position:absolute; inset:-10%;
          background:
            radial-gradient(900px 500px at 50% 20%, rgba(42,168,255,0.20), transparent 60%),
            radial-gradient(800px 500px at 70% 40%, rgba(85,231,255,0.10), transparent 60%);
          opacity:1;
          filter: blur(2px);
          pointer-events:none;
        }
        .introInner{
          width:min(1080px, 92vw);
          text-align:center;
          position:relative;
        }
        .kicker{
          letter-spacing:.18em;
          text-transform:uppercase;
          font-size:12px;
          opacity:.8;
          margin:0 0 14px;
        }
        .introTitle{
          margin:0 0 14px;
          font-size:clamp(36px, 4.7vw, 72px);
          line-height:1.02;
          font-weight:900;
        }
        .introTitle span{
          color:var(--neon2);
          text-shadow: 0 0 18px rgba(85,231,255,0.15);
        }
        .introSub{
          margin:0 auto 22px;
          width:min(760px, 92vw);
          opacity:.82;
          line-height:1.6;
          font-size:16px;
        }
        .introPanel{
          width:min(920px, 92vw);
          margin:22px auto 0;
          display:grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap:12px;
        }
        .miniCard{
          border:1px solid rgba(255,255,255,0.08);
          background: rgba(8,12,22,0.40);
          border-radius:16px;
          padding:14px 14px 12px;
          text-align:left;
          backdrop-filter: blur(10px);
        }
        .miniCard strong{
          display:block; font-size:13px; margin-bottom:6px;
          color:rgba(234,246,255,0.92);
        }
        .miniCard p{
          margin:0;
          opacity:.78;
          font-size:13px;
          line-height:1.45;
        }
        .scrollHint{
          margin-top:18px;
          display:inline-flex;
          align-items:center;
          gap:10px;
          padding:10px 14px;
          border-radius:999px;
          border:1px solid rgba(42,168,255,0.24);
          background: rgba(0,0,0,0.18);
          opacity:.88;
          font-weight:800;
          font-size:13px;
        }
        .dotPulse{
          width:8px;height:8px;border-radius:999px;
          background: var(--neon);
          box-shadow: 0 0 16px rgba(42,168,255,0.55);
          animation: pulse 1.4s ease-in-out infinite;
        }
        @keyframes pulse{
          0%,100%{ transform:scale(1); opacity:.7; }
          50%{ transform:scale(1.6); opacity:1; }
        }

        /* DUST STAGE */
        #dustStage{
          min-height:100vh;
          padding:70px 18px 30px;
          position:relative;
        }
        .stageHead{
          width:min(1080px, 92vw);
          margin:0 auto 16px;
          text-align:center;
        }
        .stageHead h2{
          margin:0;
          font-size: clamp(22px, 2.6vw, 34px);
          font-weight:900;
        }
        .stageHead p{
          margin:10px auto 0;
          width:min(720px, 92vw);
          opacity:.78;
          line-height:1.6;
        }

        .cardsWrap{
          width:min(1080px, 92vw);
          margin:18px auto 0;
          display:grid;
          gap:14px;
          position:relative;
          z-index:3;
        }
        .dustCard{
          border-radius:20px;
          border:1px solid rgba(42,168,255,0.18);
          background: rgba(7,10,18,0.52);
          backdrop-filter: blur(12px);
          padding:16px 16px 14px;
          box-shadow: 0 18px 60px rgba(0,0,0,0.35);
        }
        .cardTop{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
        }
        .chip{
          display:inline-flex;
          align-items:center;
          gap:10px;
          font-weight:900;
        }
        .chip b{
          width:30px;height:30px;border-radius:12px;
          display:grid;place-items:center;
          background: rgba(42,168,255,0.14);
          border:1px solid rgba(42,168,255,0.30);
          color:var(--neon2);
        }
        .chip span{opacity:.95;}
        .spark{
          width:9px;height:9px;border-radius:999px;
          background: radial-gradient(circle at 30% 30%, var(--neon2), var(--neon));
          box-shadow: 0 0 18px rgba(42,168,255,0.55);
        }
        .dustCard h3{
          margin:10px 0 8px;
          font-size:18px;
          letter-spacing:.1px;
          font-weight:900;
        }
        .dustCard p{
          margin:0 0 10px;
          opacity:.78;
          line-height:1.55;
        }
        .dustCard ul{
          margin:0; padding-left:18px;
          opacity:.86;
          line-height:1.7;
        }

        /* SVG workflow overlay */
        .wfSvg{
          position:fixed;
          inset:0;
          z-index:2;
          pointer-events:none;
        }
        .wfPath{
          stroke: rgba(85,231,255,0.42);
          stroke-width: 2;
          filter: drop-shadow(0 0 10px rgba(42,168,255,0.18));
        }
        .wfDot{
          fill: rgba(85,231,255,0.95);
          filter: drop-shadow(0 0 14px rgba(42,168,255,0.25));
          opacity:0;
        }
        #wf-track{ height: 165vh; }

        /* After section */
        .after{
          padding:90px 18px 110px;
          border-top:1px solid rgba(255,255,255,0.06);
        }
        .afterInner{
          width:min(1080px, 92vw);
          margin:0 auto;
          text-align:left;
        }
        .afterInner h3{ margin:0 0 10px; font-size:28px; font-weight:900; }
        .afterInner p{ margin:0; opacity:.8; line-height:1.65; }

        .actions{
          margin-top:18px;
          display:flex;
          gap:12px;
          flex-wrap:wrap;
        }
        .btn{
          padding:12px 16px;
          border-radius:14px;
          border:1px solid rgba(42,168,255,0.28);
          background: rgba(42,168,255,0.12);
          color:var(--text);
          text-decoration:none;
          font-weight:900;
        }
        .btnGhost{
          border-color: rgba(255,255,255,0.16);
          background: rgba(0,0,0,0.22);
        }

        @media (max-width: 860px){
          .introPanel{ grid-template-columns: 1fr; }
        }
      `}</style>

      {!reduceMotion && <div ref={mountRef} className="webglLayer" />}

      <div className="content">
        <header className="topbar">
          <div className="brand">
            <span className="badge" />
            NEON Workflow
          </div>
          <div className="navHint">Business • Automation • AI</div>
          <a className="cta" href="#contact">
            Bizə yaz
          </a>
        </header>

        {/* 1) NORMAL INTRO FIRST */}
        <section id="intro">
          <div className="introGlow" />
          <div className="introInner">
            <p className="kicker">Business Workflow System</p>
            <h1 className="introTitle">
              Mərkəzdə <span>business workflow</span> — scroll etdikcə isə sistem “tozdan” qurulur.
            </h1>
            <p className="introSub">
              Sən normal şəkildə səhifəyə girirsən: başlıq, izah, premium fon. Sonra scroll edəndə bu hissə yox olur və
              neon-blue “dust” hissəcikləri bloklara çevrilərək workflow-u sona qədər tamamlayır.
            </p>

            <div className="introPanel">
              <div className="miniCard">
                <strong>Interaktiv hiss</strong>
                <p>Mouse hərəkətinə reaksiya verən toz, scroll ilə formalaşan bloklar.</p>
              </div>
              <div className="miniCard">
                <strong>Neon Blue vibe</strong>
                <p>Göz yormayan, premium, minimal parıltı: əsas vurğu neon-blue.</p>
              </div>
              <div className="miniCard">
                <strong>Workflow final</strong>
                <p>Sonda bloklar bir araya gəlir və proses xətti çəkilərək tamamlanır.</p>
              </div>
            </div>

            <div className="scrollHint">
              <span className="dotPulse" />
              Scroll et (başlayır)
            </div>
          </div>
        </section>

        {/* 2) DUST STAGE */}
        <section id="dustStage">
          <div className="stageHead">
            <h2>Toz hissəcikləri bloklara çevrilir</h2>
            <p>
              Hər blok “tozdan” formalaşır, sonra izah görünür. Finalda workflow xətti çəkilir və bütün sistem tamamlanır.
            </p>
          </div>

          <div className="cardsWrap">
            {steps.map((s, i) => (
              <article
                key={s.id}
                id={`card-${i}`}
                ref={setStepRef(i)}
                className={cx("dustCard", "dustCard")}
              >
                <div className="cardTop">
                  <div className="chip">
                    <b>{String(i + 1).padStart(2, "0")}</b>
                    <span>{s.title}</span>
                  </div>
                  <span className="spark" />
                </div>

                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <ul>
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div id="wf-track" />
          <WorkflowOverlay stepRefs={stepRefs} enabled={wfEnabled} navbarOffset={0} />
        </section>

        {/* 3) AFTER */}
        <section className="after" id="contact">
          <div className="afterInner">
            <h3>Workflow hazırdır — indi bunu sənin biznesinə uyğunlaşdıraq</h3>
            <p>
              İstəsən buranı daha da interaktiv edirik: blok hover edəndə toz “swirl” olur, dot-lar path üzrə axır,
              hər addımda micro-interactions + premium soundless feedback.
            </p>

            <div className="actions">
              <a className="btn" href="tel:+994000000000">
                Zəng et
              </a>
              <a className={cx("btn", "btnGhost")} href="mailto:hello@company.az">
                Yaz
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
