import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "gsap";

/** ---------------------------------------------
 * Helpers
 * --------------------------------------------- */
function cn(...arr: Array<string | undefined | false | null>) {
  return arr.filter(Boolean).join(" ");
}

function usePrefersReducedMotion() {
  const reduced = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;

    const update = () => {
      reduced.current = mq.matches;
    };
    update();

    // Safari fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mqa: any = mq;
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mqa.addListener(update);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mqa.removeListener(update);
    };
  }, []);

  return reduced;
}

/** ---------------------------------------------
 * Social Nodes (HTML overlay always facing camera)
 * --------------------------------------------- */
type SocialIconDef = {
  key: string;
  label: string;
  emoji: string; // replace with SVG later if you want
  colorClass: string;
};

const SOCIALS: SocialIconDef[] = [
  { key: "ig", label: "Instagram", emoji: "📸", colorClass: "from-fuchsia-500/75 to-pink-500/65" },
  { key: "tt", label: "TikTok", emoji: "🎵", colorClass: "from-slate-200/35 to-slate-200/10" },
  { key: "in", label: "LinkedIn", emoji: "💼", colorClass: "from-sky-400/75 to-blue-500/65" },
  { key: "tg", label: "Telegram", emoji: "✈️", colorClass: "from-cyan-400/75 to-sky-500/65" },
];

function SocialNodes() {
  const nodes = useMemo(() => {
    return [
      { idx: 0, pos: new THREE.Vector3(2.25, 0.35, 0.25) },
      { idx: 1, pos: new THREE.Vector3(0.55, 0.65, 2.25) },
      { idx: 2, pos: new THREE.Vector3(-2.25, 0.25, -0.25) },
      { idx: 3, pos: new THREE.Vector3(-0.65, 0.55, -2.15) },
    ];
  }, []);

  return (
    <>
      {nodes.map((n) => {
        const s = SOCIALS[n.idx % SOCIALS.length];
        return (
          <group key={s.key} position={n.pos.toArray()}>
            {/* ✅ sprite => always faces camera => NO MIRROR TEXT */}
            <Html sprite distanceFactor={10} center>
              <div className="select-none">
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-2xl border border-white/10",
                    "bg-gradient-to-b from-white/10 to-white/4 backdrop-blur-md",
                    "shadow-[0_18px_60px_rgba(0,0,0,0.55)]",
                    "px-3 py-2"
                  )}
                >
                  <div
                    className={cn(
                      "h-10 w-10 rounded-2xl grid place-items-center",
                      "bg-gradient-to-br",
                      s.colorClass,
                      "shadow-[0_12px_40px_rgba(0,0,0,0.45)]",
                      "border border-white/10"
                    )}
                  >
                    <span className="text-[16px] leading-none">{s.emoji}</span>
                  </div>
                  <div className="leading-tight">
                    <div className="text-[12px] font-semibold text-white/90">{s.label}</div>
                    <div className="text-[11px] text-white/55">Connected</div>
                  </div>
                </div>
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

/** ---------------------------------------------
 * Particles
 * --------------------------------------------- */
function DustParticles() {
  const pts = useMemo(() => {
    const count = 900;
    const arr = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // shell around center
      const r = 1.8 + Math.random() * 3.2;
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = (r * Math.cos(phi)) * 0.35; // squash Y
      const z = r * Math.sin(phi) * Math.sin(theta);

      arr[i * 3 + 0] = x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = z;
    }
    return arr;
  }, []);

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    return g;
  }, [pts]);

  const mat = useMemo(() => {
    const m = new THREE.PointsMaterial({
      color: new THREE.Color("#7fe7ff"),
      size: 0.018,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return m;
  }, []);

  useEffect(() => {
    return () => {
      geom.dispose();
      mat.dispose();
    };
  }, [geom, mat]);

  return <points geometry={geom} material={mat} />;
}

/** ---------------------------------------------
 * Glowing tube (data stream)
 * --------------------------------------------- */
function DataStream() {
  const curve = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const turns = 120;

    for (let i = 0; i < turns; i++) {
      const t = i / (turns - 1);
      const a = t * Math.PI * 2;
      const r = 2.1 + Math.sin(a * 2.0) * 0.16;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = Math.sin(a * 1.3) * 0.16 + 0.08;
      pts.push(new THREE.Vector3(x, y, z));
    }
    return new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.5);
  }, []);

  const geom = useMemo(() => new THREE.TubeGeometry(curve, 260, 0.03, 10, true), [curve]);

  const mat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#39b6ff"),
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    return m;
  }, []);

  useEffect(() => {
    return () => {
      geom.dispose();
      mat.dispose();
    };
  }, [geom, mat]);

  return <mesh geometry={geom} material={mat} />;
}

/** ---------------------------------------------
 * Core Scene
 * - orbit lines use primitive => no SVG <line> TS conflict
 * - group rotates, HTML nodes are sprite so never mirrored
 * --------------------------------------------- */
function CoreScene() {
  const group = useRef<THREE.Group | null>(null);
  const ringA = useRef<THREE.Mesh | null>(null);
  const ringB = useRef<THREE.Mesh | null>(null);
  const disk = useRef<THREE.Mesh | null>(null);

  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const turns = 280;

    for (let i = 0; i < turns; i++) {
      const t = i / (turns - 1);
      const a = t * Math.PI * 2;
      const r = 2.55 + Math.sin(a * 2) * 0.12;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = Math.sin(a * 1.4) * 0.24;
      pts.push(new THREE.Vector3(x, y, z));
    }
    return pts;
  }, []);

  const lineGeom = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  const lineMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color("#3aa0ff"),
        transparent: true,
        opacity: 0.35,
      }),
    []
  );

  const glowLineMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: new THREE.Color("#66d6ff"),
        transparent: true,
        opacity: 0.14,
      }),
    []
  );

  const orbitLine = useMemo(() => new THREE.Line(lineGeom, lineMat), [lineGeom, lineMat]);
  const orbitGlowLine = useMemo(() => new THREE.Line(lineGeom, glowLineMat), [lineGeom, glowLineMat]);

  useEffect(() => {
    return () => {
      orbitLine.geometry.dispose();
      orbitGlowLine.geometry.dispose();
      lineMat.dispose();
      glowLineMat.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (group.current) group.current.rotation.y = t * 0.10; // slower, premium

    if (ringA.current) ringA.current.rotation.z = t * 0.28;
    if (ringB.current) ringB.current.rotation.z = -t * 0.18;

    if (disk.current) {
      disk.current.position.y = Math.sin(t * 1.15) * 0.08 + 0.08;
      disk.current.rotation.y = t * 0.35;
    }
  });

  return (
    <group ref={group}>
      {/* lights - subtle */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 8, 6]} intensity={0.85} />
      <pointLight position={[-6, 3, -3]} intensity={0.35} />
      <pointLight position={[0, 2.5, 2]} intensity={0.25} />

      {/* Dust + stream give reference vibe */}
      <DustParticles />
      <DataStream />

      {/* base */}
      <mesh position={[0, -0.25, 0]}>
        <cylinderGeometry args={[1.75, 2.15, 0.55, 72, 1, false]} />
        <meshStandardMaterial
          color="#0b1020"
          metalness={0.72}
          roughness={0.32}
          emissive="#081023"
          emissiveIntensity={0.38}
        />
      </mesh>

      {/* inner disk */}
      <mesh position={[0, 0.05, 0]} ref={disk}>
        <cylinderGeometry args={[1.35, 1.35, 0.22, 72, 1, false]} />
        <meshStandardMaterial
          color="#0a0f1e"
          metalness={0.78}
          roughness={0.22}
          emissive="#0a2a55"
          emissiveIntensity={0.65}
        />
      </mesh>

      {/* ring A */}
      <mesh position={[0, 0.24, 0]} ref={ringA}>
        <torusGeometry args={[1.55, 0.05, 28, 140]} />
        <meshStandardMaterial
          color="#0a1226"
          metalness={0.82}
          roughness={0.18}
          emissive="#1d7cff"
          emissiveIntensity={0.65}
        />
      </mesh>

      {/* ring B */}
      <mesh position={[0, 0.29, 0]} ref={ringB} rotation={[Math.PI / 2.25, 0, 0]}>
        <torusGeometry args={[1.18, 0.04, 28, 140]} />
        <meshStandardMaterial
          color="#07101f"
          metalness={0.82}
          roughness={0.26}
          emissive="#3be3ff"
          emissiveIntensity={0.40}
        />
      </mesh>

      {/* orbit lines */}
      <primitive object={orbitLine} />
      <primitive object={orbitGlowLine} scale={1.03} />

      {/* social nodes (sprite => always facing camera) */}
      <SocialNodes />
    </group>
  );
}

/** ---------------------------------------------
 * UI Components
 * --------------------------------------------- */
function FeatureCard(props: { title: string; subtitle: string; bullets: string[]; accent: string }) {
  return (
    <div
      data-card
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/10",
        "bg-gradient-to-b from-white/6 to-white/3 backdrop-blur",
        "shadow-[0_30px_120px_rgba(0,0,0,0.45)]",
        "p-5 transition hover:bg-white/6"
      )}
    >
      <div className={cn("absolute -right-12 -top-12 h-36 w-36 rounded-full blur-2xl bg-gradient-to-br", props.accent)} />
      <div className="relative">
        <div className="text-[12px] text-white/55">{props.subtitle}</div>
        <div className="mt-1 text-lg font-extrabold tracking-tight">{props.title}</div>

        <div className="mt-4 space-y-2">
          {props.bullets.map((b) => (
            <div key={b} className="flex items-center gap-2 text-[13px] text-white/65">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/75" />
              <span>{b}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="text-[12px] text-white/45">AI Optimized</div>
          <div className="text-[12px] font-semibold text-cyan-200/90">Explore →</div>
        </div>
      </div>
    </div>
  );
}

function MiniPanel(props: { title: string; desc: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur shadow-[0_25px_90px_rgba(0,0,0,0.4)]">
      <div className="text-[13px] font-semibold text-white/90">{props.title}</div>
      <div className="mt-2 text-[13px] leading-6 text-white/60">{props.desc}</div>
      <div className="mt-4 h-px w-full bg-white/10" />
      <div className="mt-3 text-[12px] text-white/45">Included</div>
    </div>
  );
}

/** ---------------------------------------------
 * PAGE
 * --------------------------------------------- */
export default function ServiceSmmAutomation() {
  const reducedMotion = usePrefersReducedMotion();

  const pageRef = useRef<HTMLDivElement | null>(null);
  const heroLeftRef = useRef<HTMLDivElement | null>(null);
  const heroRightRef = useRef<HTMLDivElement | null>(null);
  const statsRef = useRef<HTMLDivElement | null>(null);
  const cardsRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (reducedMotion.current) return;

    const ctx = gsap.context(() => {
      const cards = cardsRef.current?.querySelectorAll?.("[data-card]") ?? [];

      gsap.set([heroLeftRef.current, heroRightRef.current, statsRef.current], { opacity: 0, y: 18 });
      gsap.set(cards, { opacity: 0, y: 18 });

      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

      tl.to(heroLeftRef.current, { opacity: 1, y: 0, duration: 0.75 }, 0)
        .to(heroRightRef.current, { opacity: 1, y: 0, duration: 0.85 }, 0.05)
        .to(statsRef.current, { opacity: 1, y: 0, duration: 0.7 }, 0.25)
        .to(cards, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08 }, 0.35);
    }, pageRef);

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <div ref={pageRef} className="min-h-screen bg-[#05070b] text-white">
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-44 left-1/2 h-[560px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(45,140,255,0.22),rgba(0,0,0,0)_55%)] blur-2xl" />
          <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:44px_44px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(90,210,255,0.10),rgba(0,0,0,0)_45%),radial-gradient(circle_at_70%_30%,rgba(60,120,255,0.11),rgba(0,0,0,0)_55%)]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 pt-14 pb-10 sm:pt-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div ref={heroLeftRef}>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[12px] text-white/75 backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-cyan-300/90 shadow-[0_0_25px_rgba(80,220,255,0.55)]" />
                NEOX • SMM Automation
              </div>

              <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
                Automate Your <span className="text-white/85">Social Media</span>{" "}
                <span className="bg-gradient-to-r from-cyan-300 to-blue-500 bg-clip-text text-transparent">
                  Growth
                </span>
              </h1>

              <p className="mt-4 max-w-xl text-[15px] leading-7 text-white/70">
                Smart AI-powered SMM automation that schedules content, replies instantly, tracks analytics,
                and captures leads—without feeling robotic.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  className={cn(
                    "rounded-2xl px-5 py-3 text-[14px] font-semibold",
                    "bg-gradient-to-r from-sky-500 to-blue-600",
                    "shadow-[0_18px_60px_rgba(40,130,255,0.35)]",
                    "border border-white/10 hover:brightness-110 transition"
                  )}
                >
                  Start Automation
                </button>

                <button
                  className={cn(
                    "rounded-2xl px-5 py-3 text-[14px] font-semibold",
                    "bg-white/6 border border-white/10 backdrop-blur",
                    "hover:bg-white/10 transition"
                  )}
                >
                  Watch Demo <span className="ml-1 opacity-75">▶</span>
                </button>
              </div>

              <div className="mt-7 flex items-center gap-4 text-[12px] text-white/55">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/80" />
                  No-code workflows
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400/80" />
                  Multi-platform
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500/70" />
                  Real-time analytics
                </div>
              </div>
            </div>

            <div ref={heroRightRef} className="relative">
              <div
                className={cn(
                  "relative aspect-[1.45/1] w-full overflow-hidden rounded-3xl", // a bit wider like reference
                  "border border-white/10 bg-gradient-to-b from-white/7 to-white/2",
                  "shadow-[0_30px_120px_rgba(0,0,0,0.55)]"
                )}
              >
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute left-6 top-6 h-24 w-24 rounded-full bg-cyan-300/18 blur-2xl" />
                  <div className="absolute right-10 top-12 h-28 w-28 rounded-full bg-blue-500/16 blur-2xl" />
                  <div className="absolute -bottom-10 left-1/2 h-44 w-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(60,180,255,0.20),rgba(0,0,0,0)_60%)] blur-2xl" />
                </div>

                <Canvas
                  dpr={[1, 2]}
                  camera={{ position: [0.0, 1.15, 6.0], fov: 42 }}
                  gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
                >
                  <color attach="background" args={["#000000"]} />
                  <fog attach="fog" args={["#05070b", 6.0, 15]} />
                  <CoreScene />
                </Canvas>

                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_32%,rgba(0,0,0,0.62)_80%)]" />

                <div className="pointer-events-none absolute left-5 bottom-5 right-5 grid grid-cols-3 gap-3">
                  {[
                    { k: "Latency", v: "18ms" },
                    { k: "AI Runs", v: "24/7" },
                    { k: "Automations", v: "Live" },
                  ].map((x) => (
                    <div
                      key={x.k}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur"
                    >
                      <div className="text-[11px] text-white/55">{x.k}</div>
                      <div className="text-[13px] font-semibold text-white/85">{x.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div ref={statsRef} className="mt-8">
            <div
              className={cn(
                "grid gap-3 rounded-3xl border border-white/10 bg-white/5 backdrop-blur",
                "px-4 py-4 shadow-[0_30px_120px_rgba(0,0,0,0.45)]",
                "sm:grid-cols-4"
              )}
            >
              {[
                { big: "10K+", small: "Active Users" },
                { big: "1.2M", small: "Posts Automated" },
                { big: "85%", small: "Time Saved" },
                { big: "24/7", small: "AI Support" },
              ].map((s) => (
                <div key={s.small} className="flex items-center gap-3 rounded-2xl bg-white/3 px-4 py-3">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-cyan-300/25 to-blue-500/15 border border-white/10" />
                  <div>
                    <div className="text-xl font-extrabold leading-none">{s.big}</div>
                    <div className="mt-1 text-[12px] text-white/55">{s.small}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div ref={cardsRef} className="mt-10 pb-12">
            <div className="flex items-end justify-between gap-6">
              <div>
                <div className="text-[12px] text-white/55">Automations that feel natural</div>
                <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">
                  Smart Automation <span className="text-white/70">Features</span>
                </h2>
              </div>
              <div className="hidden sm:block text-[13px] text-white/55 max-w-sm">
                More glow, more life — still clean and readable.
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <FeatureCard
                title="Auto Posting"
                subtitle="Schedule & Publish"
                accent="from-cyan-300/40 to-blue-500/20"
                bullets={["AI optimized time", "Multi-platform queues", "Brand-safe templates"]}
              />
              <FeatureCard
                title="DM Automation"
                subtitle="Smart Replies"
                accent="from-fuchsia-400/30 to-blue-500/15"
                bullets={["Instant responses", "Lead qualification", "Human-like tone"]}
              />
              <FeatureCard
                title="Analytics"
                subtitle="Real-time Insights"
                accent="from-emerald-300/25 to-cyan-300/15"
                bullets={["Performance trends", "Content scoring", "Weekly summaries"]}
              />
              <FeatureCard
                title="Lead Generation"
                subtitle="Capture & Convert"
                accent="from-orange-300/25 to-blue-500/15"
                bullets={["Smart forms", "CRM-ready export", "Conversion tracking"]}
              />
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              <MiniPanel
                title="Workflow Builder"
                desc="Drag-and-drop automations with AI suggestions. Build flows that adapt to user intent."
              />
              <MiniPanel title="Brand Voice" desc="Train a consistent tone. Replies stay premium—never robotic." />
              <MiniPanel title="Safety Layer" desc="Rate-limits, filters, approvals. You stay in control." />
            </div>
          </div>
        </div>
      </section>

      <section className="relative bg-[#070a12] border-t border-white/10">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h3 className="text-2xl font-extrabold tracking-tight">How it works</h3>
              <p className="mt-3 text-[15px] leading-7 text-white/70 max-w-xl">
                Connect accounts → pick a goal → launch workflows. The system learns from results and improves recommendations.
              </p>

              <div className="mt-6 space-y-3">
                {[
                  { t: "Connect Platforms", d: "Instagram, TikTok, LinkedIn, Telegram and more." },
                  { t: "Define Strategy", d: "Post types, frequency, tone, and audience goals." },
                  { t: "Automate & Improve", d: "Insights + optimization runs daily." },
                ].map((x) => (
                  <div key={x.t} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                    <div className="text-[13px] font-semibold text-white/90">{x.t}</div>
                    <div className="mt-1 text-[13px] text-white/60">{x.d}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/6 to-white/3 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
              <div className="text-[12px] text-white/55">Live Preview</div>
              <div className="mt-2 text-lg font-extrabold">AI Control Room</div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  { k: "Auto Replies", v: "ON" },
                  { k: "Scheduler", v: "Active" },
                  { k: "Lead Capture", v: "Enabled" },
                  { k: "Analytics", v: "Realtime" },
                ].map((x) => (
                  <div key={x.k} className="rounded-2xl bg-white/5 border border-white/10 p-4">
                    <div className="text-[12px] text-white/55">{x.k}</div>
                    <div className="mt-1 text-[14px] font-semibold text-white/90">{x.v}</div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-[12px] text-white/55">Next action</div>
                <div className="mt-1 text-[14px] font-semibold text-white/90">Suggest content plan for next 7 days</div>
                <button
                  className={cn(
                    "mt-4 w-full rounded-2xl px-4 py-3 text-[14px] font-semibold",
                    "bg-gradient-to-r from-cyan-300/25 to-blue-500/25",
                    "border border-white/10 hover:brightness-110 transition"
                  )}
                >
                  Generate Plan
                </button>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center text-[12px] text-white/45">
            © NEOX — SMM Automation module (plug into your existing header/footer)
          </div>
        </div>
      </section>
    </div>
  );
}
