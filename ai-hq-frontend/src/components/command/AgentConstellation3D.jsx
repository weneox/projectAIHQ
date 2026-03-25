import { Canvas, useFrame } from "@react-three/fiber";
import { Html, Line, PerspectiveCamera } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useMemo, useRef } from "react";

const TONE = {
  cyan: "#6ee7ff",
  sky: "#38bdf8",
  indigo: "#818cf8",
  violet: "#a78bfa",
  emerald: "#34d399",
  amber: "#fbbf24",
  pink: "#f472b6",
};

function FloatingNode({ node, activeKey, onHover, onLeave, index }) {
  const group = useRef(null);
  const isActive = activeKey === node.key;
  const color = TONE[node.tone] || "#7dd3fc";

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (!group.current) return;

    const drift = index * 0.37;
    group.current.position.y =
      (node.y - 0.5) * -6 + Math.sin(t * 0.7 + drift) * 0.08;
    group.current.position.x =
      (node.x - 0.5) * 10 + Math.cos(t * 0.45 + drift) * 0.06;
    group.current.position.z =
      node.z * 4 + Math.sin(t * 0.42 + drift) * 0.05;

    group.current.rotation.y += 0.002;
  });

  return (
    <group
      ref={group}
      onPointerOver={() => onHover(node.key)}
      onPointerOut={onLeave}
      scale={isActive ? 1.1 : 1}
    >
      <mesh>
        <sphereGeometry args={[0.16 * node.size, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.95} />
      </mesh>

      <mesh scale={1.8}>
        <sphereGeometry args={[0.16 * node.size, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} />
      </mesh>

      <mesh scale={3}>
        <sphereGeometry args={[0.16 * node.size, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.03} />
      </mesh>

      <Html center distanceFactor={8}>
        <div
          className={[
            "pointer-events-none min-w-[150px] rounded-[22px] px-4 py-2.5 transition-all duration-300",
            isActive
              ? "border border-white/14 bg-white/[0.08] shadow-[0_10px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl"
              : "border border-white/7 bg-white/[0.035] backdrop-blur-lg",
          ].join(" ")}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/72">
            {node.title}
          </div>
          <div className="mt-1 text-[10px] text-white/38">{node.subtitle}</div>
        </div>
      </Html>
    </group>
  );
}

function Connections({ nodes, activeKey }) {
  const positions = useMemo(
    () =>
      nodes.map((n) => [
        (n.x - 0.5) * 10,
        (n.y - 0.5) * -6,
        n.z * 4,
      ]),
    [nodes]
  );

  const links = useMemo(() => {
    const result = [];
    for (let i = 0; i < positions.length - 1; i += 1) {
      result.push([positions[i], positions[(i + 2) % positions.length]]);
    }
    result.push([positions[0], positions[4]]);
    result.push([positions[3], positions[8]]);
    result.push([positions[1], positions[6]]);
    result.push([positions[2], positions[7]]);
    return result;
  }, [positions]);

  return (
    <>
      {links.map((pts, idx) => {
        const highlight =
          activeKey &&
          nodes.some(
            (n, nIdx) =>
              n.key === activeKey &&
              (positions[nIdx] === pts[0] || positions[nIdx] === pts[1])
          );

        return (
          <Line
            key={idx}
            points={pts}
            color={highlight ? "#7dd3fc" : "#2f4862"}
            lineWidth={highlight ? 1.1 : 0.45}
            transparent
            opacity={highlight ? 0.66 : 0.18}
          />
        );
      })}
    </>
  );
}

function Scene({ nodes, activeKey, onHover, onLeave }) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 8]} fov={42} />

      <ambientLight intensity={0.7} />
      <pointLight position={[-4, 2, 5]} intensity={2.1} color="#6ee7ff" />
      <pointLight position={[4, -1, 4]} intensity={1.5} color="#8b5cf6" />
      <pointLight position={[0, 4, 3]} intensity={0.5} color="#ffffff" />

      <Connections nodes={nodes} activeKey={activeKey} />

      {nodes.map((node, index) => (
        <FloatingNode
          key={node.key}
          node={node}
          index={index}
          activeKey={activeKey}
          onHover={onHover}
          onLeave={onLeave}
        />
      ))}
    </>
  );
}

export default function AgentConstellation3D({
  nodes,
  activeKey,
  onHover,
  onLeave,
}) {
  return (
    <div className="absolute inset-0">
      <Canvas gl={{ antialias: true, alpha: true }} dpr={[1, 1.6]}>
        <Scene
          nodes={nodes}
          activeKey={activeKey}
          onHover={onHover}
          onLeave={onLeave}
        />
        <EffectComposer>
          <Bloom intensity={0.72} luminanceThreshold={0.15} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  );
}