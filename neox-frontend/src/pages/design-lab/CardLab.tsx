// src/pages/design-lab/CardLab.tsx
import { Canvas, useFrame } from "@react-three/fiber";
import { PointMaterial, Points } from "@react-three/drei";
import { AdditiveBlending, Color } from "three";
import { useMemo, useRef } from "react";

const PALETTES = [
  ["#1f4fe0", "#4b78ff", "#8eb1ff", "#d9e7ff"],
  ["#2358ff", "#6f93ff", "#c6d7ff", "#eef4ff"],
  ["#173fbd", "#3b68f1", "#7ea4ff", "#d7e4ff"],
] as const;

type DustCloudProps = {
  count?: number;
  radius?: number;
  offset?: [number, number, number];
  spreadX?: number;
  spreadY?: number;
  size?: number;
  opacity?: number;
  speed?: number;
  paletteIndex?: number;
};

function DustCloud({
  count = 280,
  radius = 1,
  offset = [0, 0, 0],
  spreadX = 1.4,
  spreadY = 0.9,
  size = 0.03,
  opacity = 0.8,
  speed = 0.1,
  paletteIndex = 0,
}: DustCloudProps) {
  const ref = useRef<any>(null);

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const palette = PALETTES[paletteIndex % PALETTES.length].map((hex) => new Color(hex));

    for (let i = 0; i < count; i += 1) {
      const i3 = i * 3;

      const angle = Math.random() * Math.PI * 2;
      const distance = Math.pow(Math.random(), 0.55) * radius;

      pos[i3] = Math.cos(angle) * distance * spreadX + offset[0];
      pos[i3 + 1] = Math.sin(angle) * distance * spreadY + offset[1];
      pos[i3 + 2] = (Math.random() - 0.5) * radius * 0.6 + offset[2];

      const c = palette[Math.floor(Math.random() * palette.length)].clone();
      c.multiplyScalar(0.82 + Math.random() * 0.28);

      col[i3] = c.r;
      col[i3 + 1] = c.g;
      col[i3 + 2] = c.b;
    }

    return { positions: pos, colors: col };
  }, [count, radius, offset, spreadX, spreadY, paletteIndex]);

  useFrame((state, delta) => {
    if (!ref.current) return;

    ref.current.rotation.z += delta * 0.012;
    ref.current.rotation.y += delta * 0.01;
    ref.current.position.y = Math.sin(state.clock.elapsedTime * (0.22 + speed)) * 0.03;
    ref.current.position.x = Math.sin(state.clock.elapsedTime * (0.14 + speed)) * 0.02;
  });

  return (
    <Points
      ref={ref}
      positions={positions}
      colors={colors}
      stride={3}
      frustumCulled={false}
    >
      <PointMaterial
        transparent
        vertexColors
        size={size}
        sizeAttenuation
        depthWrite={false}
        opacity={opacity}
        blending={AdditiveBlending}
      />
    </Points>
  );
}

function DustOnly() {
  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        width: "100%",
        overflow: "hidden",
        background: "transparent",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(circle at 72% 48%, rgba(51, 102, 255, 0.10), transparent 16%), radial-gradient(circle at 81% 50%, rgba(136, 174, 255, 0.08), transparent 22%)",
          filter: "blur(18px)",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.98) 22%, rgba(255,255,255,0.82) 34%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.04) 62%, rgba(255,255,255,0.14) 82%, rgba(255,255,255,0.58) 100%)",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.88) 0%, rgba(255,255,255,0.08) 18%, rgba(255,255,255,0.08) 82%, rgba(255,255,255,0.88) 100%)",
        }}
      />

      <Canvas
        dpr={[1, 1.8]}
        camera={{ position: [0, 0, 4.2], fov: 34 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <DustCloud
          count={380}
          radius={1.34}
          offset={[1.05, 0.02, 0]}
          spreadX={1.85}
          spreadY={0.98}
          size={0.026}
          opacity={0.8}
          speed={0.08}
          paletteIndex={0}
        />

        <DustCloud
          count={240}
          radius={0.88}
          offset={[1.42, -0.04, 0.03]}
          spreadX={1.25}
          spreadY={0.82}
          size={0.035}
          opacity={0.68}
          speed={0.13}
          paletteIndex={1}
        />

        <DustCloud
          count={160}
          radius={0.58}
          offset={[1.72, 0.14, -0.04]}
          spreadX={1.05}
          spreadY={0.72}
          size={0.045}
          opacity={0.5}
          speed={0.17}
          paletteIndex={2}
        />
      </Canvas>
    </div>
  );
}

export default function CardLab() {
  return <DustOnly />;
}