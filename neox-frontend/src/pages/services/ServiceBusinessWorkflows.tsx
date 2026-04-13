"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, OrbitControls, useTexture } from "@react-three/drei";

/** ---------------- utils ---------------- */
function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function smoothstep(e0: number, e1: number, x: number) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/** ---------------- ErrorBoundary ---------------- */
class R3FErrorBoundary extends React.Component<
  { fallback?: React.ReactNode; children: React.ReactNode },
  { hasError: boolean; msg?: string }
> {
  state = { hasError: false, msg: "" };
  static getDerivedStateFromError(err: any) {
    return { hasError: true, msg: String(err?.message || err) };
  }
  componentDidCatch(err: any) {
    // eslint-disable-next-line no-console
    console.error("[R3FErrorBoundary]", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-[70vh] w-full items-center justify-center rounded-3xl bg-black text-white">
            <div className="max-w-[720px] rounded-3xl bg-white/10 p-6 backdrop-blur border border-white/10">
              <div className="text-base font-semibold">3D səhnə yüklənmədi</div>
              <div className="mt-2 text-sm text-white/70">WebGL/Three runtime xətası ola bilər.</div>
              <div className="mt-3 break-words text-xs text-white/60">{this.state.msg}</div>
              <div className="mt-4 text-xs text-white/60">
                public/ içində bunlar olmalıdır:
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <span className="rounded-lg bg-black/30 px-2 py-1">terrain-color.png</span>
                  <span className="rounded-lg bg-black/30 px-2 py-1">terrain-normal.png</span>
                  <span className="rounded-lg bg-black/30 px-2 py-1">terrain-roughness.png</span>
                  <span className="rounded-lg bg-black/30 px-2 py-1">terrain-height.png</span>
                </div>
              </div>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

/** ---------------- Loader ---------------- */
function Loader() {
  return (
    <Html center>
      <div className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white backdrop-blur border border-white/10">
        Yüklənir...
      </div>
    </Html>
  );
}

/** ---------------- cinematic scroll progress ---------------- */
function useWindowScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY || 0;
        const h = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        setP(clamp01(y / h));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return p;
}

/** ---------------- nodes ---------------- */
type NodeInfo = {
  id: string;
  title: string;
  desc: string;
  tags: string[];
  pos: [number, number, number];
};

/** ---------------- Premium pin ---------------- */
function GlowPin({
  node,
  active,
  onClick,
}: {
  node: NodeInfo;
  active: boolean;
  onClick: (id: string) => void;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringRef.current) {
      const s = 1 + Math.sin(t * 2.1 + node.pos[0] * 0.01) * 0.06;
      ringRef.current.scale.set(s, s, 1);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = active ? 0.48 : 0.28;
    }
    if (coreRef.current) {
      const pulse = 0.94 + Math.sin(t * 3.0) * 0.03;
      coreRef.current.scale.set(pulse, pulse, 1);
    }
  });

  return (
    <group position={node.pos}>
      <mesh
        ref={coreRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick(node.id);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <circleGeometry args={[0.95, 80]} />
        <meshBasicMaterial color={active ? "#ffffff" : "#e6f0ff"} transparent opacity={active ? 0.98 : 0.78} />
      </mesh>

      <mesh ref={ringRef} rotation-x={-Math.PI / 2} position={[0, 0.05, 0]}>
        <ringGeometry args={[1.25, 1.85, 140]} />
        <meshBasicMaterial color={active ? "#38bdf8" : "#60a5fa"} transparent opacity={active ? 0.48 : 0.28} />
      </mesh>

      <Html distanceFactor={18} style={{ pointerEvents: "none" }}>
        <div className="rounded-xl bg-black/55 px-3 py-1 text-xs text-white backdrop-blur border border-white/10">
          {node.title}
        </div>
      </Html>
    </group>
  );
}

/** ---------------- Terrain (tile + drift) ---------------- */
function TiledTerrain() {
  const [color, normal, rough, height] = useTexture([
    "/terrain-color.png",
    "/terrain-normal.png",
    "/terrain-roughness.png",
    "/terrain-height.png",
  ]);

  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useEffect(() => {
    color.colorSpace = THREE.SRGBColorSpace;
    normal.colorSpace = THREE.NoColorSpace;
    rough.colorSpace = THREE.NoColorSpace;
    height.colorSpace = THREE.NoColorSpace;

    const arr = [color, normal, rough, height];
    for (const t of arr) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 12;
      t.needsUpdate = true;
    }

    const rep = 18;
    color.repeat.set(rep, rep);
    normal.repeat.set(rep, rep);
    rough.repeat.set(rep, rep);
    height.repeat.set(rep, rep);
  }, [color, normal, rough, height]);

  useFrame(({ camera }) => {
    const speed = 0.0015;
    const ox = camera.position.x * speed;
    const oz = camera.position.z * speed;

    color.offset.set(ox, oz);
    normal.offset.set(ox, oz);
    rough.offset.set(ox, oz);
    height.offset.set(ox, oz);

    if (matRef.current) {
      matRef.current.displacementScale = 5.1; // daha drama
      matRef.current.normalScale.set(0.7, 0.7);
      matRef.current.roughness = 1.0;
      matRef.current.metalness = 0.0;
    }
  });

  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      {/* daha böyük dünya */}
      <planeGeometry args={[2200, 1400, 520, 520]} />
      <meshStandardMaterial
        ref={matRef}
        map={color}
        normalMap={normal}
        roughnessMap={rough}
        displacementMap={height}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

/** ---------------- River (clean ribbon) ---------------- */
function River() {
  const curve = useMemo(() => {
    const pts = [
      new THREE.Vector3(-760, 0.20, 360),
      new THREE.Vector3(-520, 0.20, 220),
      new THREE.Vector3(-260, 0.20, 120),
      new THREE.Vector3(40, 0.20, 10),
      new THREE.Vector3(360, 0.20, -140),
      new THREE.Vector3(760, 0.20, -420),
    ];
    return new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
  }, []);

  const geo = useMemo(() => new THREE.TubeGeometry(curve, 720, 3.4, 20, false), [curve]);

  const mat = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color("#2aa8ff"),
        roughness: 0.06,
        metalness: 0.0,
        transmission: 0.35,
        thickness: 0.25,
        transparent: true,
        opacity: 0.72,
        clearcoat: 1,
        clearcoatRoughness: 0.25,
      }),
    []
  );

  return <mesh geometry={geo} material={mat} position={[0, 0.2, 0]} />;
}

/** ---------------- Lake ---------------- */
function Lake() {
  return (
    <mesh rotation-x={-Math.PI / 2} position={[420, 0.24, 260]} receiveShadow>
      <circleGeometry args={[82, 190]} />
      <meshPhysicalMaterial
        color={"#2aa8ff"}
        roughness={0.07}
        metalness={0}
        transmission={0.35}
        thickness={0.25}
        transparent
        opacity={0.7}
        clearcoat={1}
        clearcoatRoughness={0.25}
      />
    </mesh>
  );
}

/** ---------------- Bridge (over river) ---------------- */
function Bridge() {
  return (
    <group position={[-260, 0.38, 120]} rotation={[0, -0.25, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[28, 0.75, 9]} />
        <meshStandardMaterial color={"#3a2b22"} roughness={1} metalness={0} />
      </mesh>

      <mesh position={[0, 2.2, 4.1]} castShadow>
        <boxGeometry args={[28, 0.38, 0.38]} />
        <meshStandardMaterial color={"#2a201a"} roughness={1} />
      </mesh>
      <mesh position={[0, 2.2, -4.1]} castShadow>
        <boxGeometry args={[28, 0.38, 0.38]} />
        <meshStandardMaterial color={"#2a201a"} roughness={1} />
      </mesh>

      {Array.from({ length: 10 }).map((_, i) => (
        <mesh key={i} position={[-12.2 + i * 2.7, 1.45, 4.1]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 2.9, 10]} />
          <meshStandardMaterial color={"#2a201a"} roughness={1} />
        </mesh>
      ))}
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh key={`b-${i}`} position={[-12.2 + i * 2.7, 1.45, -4.1]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 2.9, 10]} />
          <meshStandardMaterial color={"#2a201a"} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** ---------------- Roads ---------------- */
function Roads() {
  const roads = useMemo(() => {
    const mk = (pts: Array<[number, number, number]>, radius: number) => {
      const curve = new THREE.CatmullRomCurve3(
        pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
        false,
        "catmullrom",
        0.5
      );
      return new THREE.TubeGeometry(curve, 420, radius, 16, false);
    };

    return [
      mk(
        [
          [-760, 0.24, -60],
          [-520, 0.24, -20],
          [-260, 0.24, 20],
          [40, 0.24, 90],
          [320, 0.24, 170],
          [620, 0.24, 260],
        ],
        1.3
      ),
      mk(
        [
          [120, 0.24, 560],
          [80, 0.24, 320],
          [0, 0.24, 120],
          [-120, 0.24, -140],
          [-220, 0.24, -380],
          [-280, 0.24, -560],
        ],
        1.05
      ),
    ];
  }, []);

  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color("#0b1329"),
        roughness: 0.98,
        metalness: 0.0,
        transparent: true,
        opacity: 0.9,
      }),
    []
  );

  return (
    <group>
      {roads.map((g, i) => (
        <mesh key={i} geometry={g} material={mat} />
      ))}
    </group>
  );
}

/** ---------------- Stones beside roads ---------------- */
function RoadStones() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 380;

  const geo = useMemo(() => new THREE.DodecahedronGeometry(0.48, 0), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1f2937", roughness: 1, metalness: 0 }), []);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();

    let i = 0;
    while (i < count) {
      const t = Math.random();
      const x = lerp(-760, 620, t) + (Math.random() * 2 - 1) * 18;
      const z = lerp(-60, 260, t) + (Math.random() * 2 - 1) * 14;

      const side = Math.random() < 0.5 ? -1 : 1;
      const sx = x + side * (10 + Math.random() * 14);
      const sz = z + side * (7 + Math.random() * 10);

      const s = lerp(0.65, 1.55, Math.random());
      dummy.position.set(sx, 0.35, sz);
      dummy.rotation.set(Math.random() * 2, Math.random() * 2, Math.random() * 2);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      i++;
    }

    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  return <instancedMesh ref={ref} args={[geo, mat, count]} castShadow receiveShadow />;
}

/** ---------------- Trees (forest) ---------------- */
function Trees() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 760;

  const geo = useMemo(() => new THREE.ConeGeometry(1.25, 5.4, 8), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1f7a3a", roughness: 1, metalness: 0 }), []);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();
    const col = new THREE.Color();

    let i = 0;
    while (i < count) {
      const x = (Math.random() * 2 - 1) * 820;
      const z = (Math.random() * 2 - 1) * 520;

      // clear areas near village + lake
      const dVillage = Math.hypot(x - 330, z - 210);
      const dLake = Math.hypot(x - 420, z - 260);
      if (dVillage < 180 || dLake < 210) continue;

      // avoid river corridor (approx diagonal ribbon)
      const avoidRiver = Math.abs(z - 0.55 * x) < 52;
      if (avoidRiver) continue;

      const s = lerp(0.75, 2.8, Math.random());
      const rot = Math.random() * Math.PI * 2;

      dummy.position.set(x, 2.55, z);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // tint
      const tint = lerp(0.82, 1.15, Math.random());
      col.setRGB(0.12 * tint, 0.46 * tint, 0.22 * tint);
      mesh.setColorAt(i, col);

      i++;
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, []);

  return <instancedMesh ref={ref} args={[geo, mat, count]} castShadow receiveShadow />;
}

/** ---------------- Giant trees (hero look) ---------------- */
function GiantTrees() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 38;

  const geo = useMemo(() => new THREE.ConeGeometry(5.2, 22, 10), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#135b2b", roughness: 1, metalness: 0 }), []);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();

    const ringCenters: Array<[number, number]> = [
      [0, -40],
      [-220, 120],
      [120, 170],
      [-520, -120],
      [520, 120],
      [620, -220],
    ];

    for (let i = 0; i < count; i++) {
      const c = ringCenters[i % ringCenters.length];
      const ang = rand(0, Math.PI * 2);
      const r = rand(160, 320);
      const x = c[0] + Math.cos(ang) * r + rand(-24, 24);
      const z = c[1] + Math.sin(ang) * r + rand(-24, 24);

      // not on lake/village
      if (Math.hypot(x - 420, z - 260) < 240) {
        i--;
        continue;
      }
      if (Math.hypot(x - 330, z - 210) < 220) {
        i--;
        continue;
      }

      const s = rand(0.85, 1.25);
      dummy.position.set(x, 10.5, z);
      dummy.rotation.set(0, rand(0, Math.PI * 2), 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  return <instancedMesh ref={ref} args={[geo, mat, count]} castShadow receiveShadow />;
}

/** ---------------- Village: BIG houses + roof + chimney ---------------- */
function VillageBig() {
  const baseRef = useRef<THREE.InstancedMesh>(null);
  const roofRef = useRef<THREE.InstancedMesh>(null);
  const chimRef = useRef<THREE.InstancedMesh>(null);

  const count = 120;

  const baseGeo = useMemo(() => new THREE.BoxGeometry(3.6, 1.8, 3.2), []);
  const roofGeo = useMemo(() => new THREE.ConeGeometry(2.7, 1.7, 4), []);
  const chimGeo = useMemo(() => new THREE.BoxGeometry(0.42, 1.12, 0.42), []);

  const baseMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d3c1a6", roughness: 0.95, metalness: 0 }), []);
  const roofMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#2f2323", roughness: 1, metalness: 0 }), []);
  const chimMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#3a3a3a", roughness: 1, metalness: 0 }), []);

  useEffect(() => {
    const b = baseRef.current;
    const r = roofRef.current;
    const c = chimRef.current;
    if (!b || !r || !c) return;

    const dummy = new THREE.Object3D();

    let i = 0;
    while (i < count) {
      const x = (Math.random() * 2 - 1) * 140 + 330;
      const z = (Math.random() * 2 - 1) * 110 + 210;

      // keep houses off the lake center
      if (Math.hypot(x - 420, z - 260) < 120) continue;

      const rot = (Math.random() * 2 - 1) * 0.9;
      const s = lerp(0.9, 1.75, Math.random());

      // base
      dummy.position.set(x, 1.05, z);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      b.setMatrixAt(i, dummy.matrix);

      // roof
      dummy.position.set(x, 2.45, z);
      dummy.rotation.set(0, rot + Math.PI * 0.25, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      r.setMatrixAt(i, dummy.matrix);

      // chimney
      dummy.position.set(x + 0.95 * s, 2.95, z + 0.45 * s);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      c.setMatrixAt(i, dummy.matrix);

      i++;
    }

    b.instanceMatrix.needsUpdate = true;
    r.instanceMatrix.needsUpdate = true;
    c.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <group>
      <instancedMesh ref={baseRef} args={[baseGeo, baseMat, count]} castShadow receiveShadow />
      <instancedMesh ref={roofRef} args={[roofGeo, roofMat, count]} castShadow receiveShadow />
      <instancedMesh ref={chimRef} args={[chimGeo, chimMat, count]} castShadow receiveShadow />
    </group>
  );
}

/** ---------------- Mountain ridge (far silhouette) ---------------- */
function Mountains() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 90;

  const geo = useMemo(() => new THREE.ConeGeometry(20, 92, 7), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#0b1220", roughness: 1, metalness: 0 }), []);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const x = lerp(-1040, 1040, i / (count - 1)) + (Math.random() * 2 - 1) * 34;
      const z = -740 + (Math.random() * 2 - 1) * 55;
      const h = lerp(78, 175, Math.random());
      const s = lerp(0.85, 1.4, Math.random());

      dummy.position.set(x, h * 0.25, z);
      dummy.rotation.set(0, (Math.random() * 2 - 1) * 0.2, 0);
      dummy.scale.set(s, h / 92, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  return <instancedMesh ref={ref} args={[geo, mat, count]} castShadow receiveShadow />;
}

/** ---------------- Birds (instanced, flying) ---------------- */
function Birds() {
  const ref = useRef<THREE.InstancedMesh>(null);

  const count = 90;
  const geo = useMemo(() => new THREE.ConeGeometry(0.55, 1.7, 5), []);
  const mat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#0b1020",
        roughness: 0.9,
        metalness: 0,
        transparent: true,
        opacity: 0.9,
      }),
    []
  );

  // store per-bird params
  const birds = useMemo(() => {
    const arr: Array<{
      seed: number;
      center: THREE.Vector3;
      radius: number;
      speed: number;
      height: number;
      phase: number;
      tilt: number;
    }> = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        seed: Math.random(),
        center: new THREE.Vector3(rand(-240, 240), 0, rand(-60, 180)),
        radius: rand(120, 360),
        speed: rand(0.12, 0.28),
        height: rand(120, 210),
        phase: rand(0, Math.PI * 2),
        tilt: rand(-0.3, 0.3),
      });
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;

    const t = clock.getElapsedTime();
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const b = birds[i];
      const ang = t * b.speed + b.phase;
      const x = b.center.x + Math.cos(ang) * b.radius;
      const z = b.center.z + Math.sin(ang * 0.92) * (b.radius * 0.55);
      const y = b.height + Math.sin(ang * 2.1 + b.seed * 10) * 6.5;

      // face direction
      const nx = -Math.sin(ang);
      const nz = Math.cos(ang * 0.92) * 0.92;

      dummy.position.set(x, y, z);
      dummy.rotation.set(0, Math.atan2(nx, nz) + Math.PI, b.tilt + Math.sin(ang * 5.2) * 0.08);
      dummy.scale.setScalar(lerp(0.85, 1.35, smoothstep(0.2, 0.9, (Math.sin(ang * 2.4) + 1) / 2)));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={ref} args={[geo, mat, count]} castShadow={false} receiveShadow={false} />;
}

/** ---------------- Atmosphere + lights ---------------- */
function Atmosphere() {
  return (
    <>
      <color attach="background" args={["#060a12"]} />
      <fog attach="fog" args={["#060a12", 320, 1600]} />

      <ambientLight intensity={0.44} />
      <hemisphereLight args={["#b8ccff", "#081021", 0.40]} />

      <directionalLight
        position={[90, 130, 60]}
        intensity={1.16}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={10}
        shadow-camera-far={520}
        shadow-camera-left={-260}
        shadow-camera-right={260}
        shadow-camera-top={260}
        shadow-camera-bottom={-260}
      />
    </>
  );
}

/** ---------------- Camera rig ---------------- */
function CameraRig({ focus }: { focus: [number, number, number] | null }) {
  const { camera } = useThree();
  const p = useWindowScrollProgress();

  // daha geniş baxış: xəritə “tam görünsün”
  const baseFrom = useMemo(() => new THREE.Vector3(-360, 148, 320), []);
  const baseTo = useMemo(() => new THREE.Vector3(360, 132, 280), []);

  const lookFrom = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const lookTo = useMemo(() => new THREE.Vector3(140, 0, -80), []);

  const vPos = useRef(new THREE.Vector3().copy(baseFrom));
  const vLook = useRef(new THREE.Vector3().copy(lookFrom));

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    const targetPos = baseFrom.clone().lerp(baseTo, p);
    const targetLook = lookFrom.clone().lerp(lookTo, p);

    // slow drift
    targetPos.x += Math.sin(t * 0.10) * 2.6;
    targetPos.z += Math.cos(t * 0.09) * 1.8;

    if (focus) {
      const f = new THREE.Vector3(focus[0], focus[1], focus[2]);
      const focusPos = f.clone().add(new THREE.Vector3(0, 74, 120));
      targetPos.lerp(focusPos, 0.66);
      targetLook.lerp(f, 0.92);
    }

    vPos.current.lerp(targetPos, 0.052);
    vLook.current.lerp(targetLook, 0.08);

    camera.position.copy(vPos.current);
    camera.lookAt(vLook.current);
  });

  return null;
}

/** ---------------- Vignette overlay ---------------- */
function Vignette() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0)_34%,rgba(0,0,0,0.62)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/36 to-transparent" />
    </div>
  );
}

/** ---------------- FINAL ---------------- */
export default function MasterplanWorldMap3D_Premium() {
  const NODES: NodeInfo[] = useMemo(
    () => [
      { id: "ai", title: "AI Chatbot 24/7", desc: "Cavablandırma, lead toplama, satış axını.", tags: ["24/7", "Support"], pos: [-320, 1.2, 70] },
      { id: "crm", title: "CRM Avtomatlaşdırma", desc: "Lead → pipeline → follow-up → deal.", tags: ["Pipeline", "Automation"], pos: [-140, 1.2, -40] },
      { id: "smm", title: "SMM Avtomasiya", desc: "Kontent planı, paylaşım, analitika.", tags: ["Content", "Analytics"], pos: [120, 1.2, -90] },
      { id: "ops", title: "Biznes Prosesləri", desc: "Task, approval, reporting, dashboard.", tags: ["Ops", "Workflow"], pos: [80, 1.2, 130] },
      { id: "web", title: "Vebsayt Sistemləri", desc: "Landing + xidmət səhifələri + inteqrasiya.", tags: ["SEO", "Performance"], pos: [420, 1.2, 40] },
    ],
    []
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeNode = useMemo(() => NODES.find((n) => n.id === activeId) || null, [NODES, activeId]);

  const onNodeClick = useCallback((id: string) => setActiveId((p) => (p === id ? null : id)), []);
  const onMiss = useCallback(() => setActiveId(null), []);

  return (
    <R3FErrorBoundary>
      {/* HERO daha hündür + daha geniş */}
      <section className="relative w-full min-h-[92vh] lg:min-h-[96vh]">
        <div className="relative w-full h-[92vh] lg:h-[96vh] rounded-3xl overflow-hidden bg-[#060a12]">
          <Canvas
            shadows
            dpr={[1, 1.75]}
            camera={{ position: [-360, 148, 320], fov: 34, near: 0.1, far: 3200 }}
            gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
            onCreated={({ gl }) => {
              gl.outputColorSpace = THREE.SRGBColorSpace;
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.06;
            }}
            onPointerMissed={onMiss}
          >
            <Atmosphere />

            <Suspense fallback={<Loader />}>
              {/* Base world */}
              <TiledTerrain />

              {/* Scene dressing */}
              <Mountains />
              <River />
              <Lake />
              <Bridge />
              <Roads />
              <RoadStones />

              {/* Bigger settlement + forests */}
              <VillageBig />
              <Trees />
              <GiantTrees />

              {/* Birds in sky */}
              <Birds />

              {/* Pins */}
              {NODES.map((n) => (
                <GlowPin key={n.id} node={n} active={n.id === activeId} onClick={onNodeClick} />
              ))}
            </Suspense>

            <CameraRig focus={activeNode ? activeNode.pos : null} />

            <OrbitControls
              enablePan={false}
              enableZoom={false}
              enableDamping
              dampingFactor={0.06}
              minAzimuthAngle={-0.6}
              maxAzimuthAngle={0.6}
              minPolarAngle={Math.PI * 0.20}
              maxPolarAngle={Math.PI * 0.40}
              target={[0, 0, 0]}
            />
          </Canvas>

          {/* Label */}
          <div className="pointer-events-none absolute left-4 top-4 rounded-2xl bg-white/10 px-3 py-2 text-xs text-white/80 backdrop-blur border border-white/10">
            Premium Workflow Map (3D)
          </div>

          {/* Right panel */}
          <div className="absolute right-4 top-4 w-[390px] max-w-[86vw]">
            <div className="rounded-3xl bg-black/42 p-4 text-white backdrop-blur border border-white/10">
              <div className="text-xs text-white/60">Workflow Node</div>
              <div className="mt-1 text-base font-semibold">{activeNode ? activeNode.title : "Bir node seç"}</div>
              <div className="mt-2 text-sm text-white/75">
                {activeNode
                  ? activeNode.desc
                  : "Böyük xəritə: dağ silsiləsi, çay + körpü, göl, yollar, böyük kənd evləri, meşə + nəhəng ağaclar və göydə uçan quşlar. Pin-ə kliklə fokusla."}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(activeNode?.tags ?? ["AI", "Automation", "Systems"]).map((t) => (
                  <span key={t} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-white/80 border border-white/10">
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-4 text-xs text-white/50">* Scroll = drift. Klik = fokus.</div>
            </div>
          </div>

          <Vignette />
        </div>
      </section>
    </R3FErrorBoundary>
  );
}
