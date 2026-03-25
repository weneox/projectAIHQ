import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function useAccentMaterial(accent) {
  return useMemo(() => {
    const c = new THREE.Color(accent);

    return new THREE.MeshPhysicalMaterial({
      color: c,
      emissive: c,
      emissiveIntensity: 0.22,
      metalness: 0.75,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      reflectivity: 1,
    });
  }, [accent]);
}

function OrionGlyph({ accent }) {
  const ref = useRef(null);
  const mat = useAccentMaterial(accent);

  useFrame((state, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * 0.55;
    ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.7) * 0.15;
  });

  return (
    <group ref={ref}>
      <mesh material={mat} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.08, 0.09, 24, 100]} />
      </mesh>
      <mesh material={mat} rotation={[0, 0, Math.PI / 4]}>
        <octahedronGeometry args={[0.52, 0]} />
      </mesh>
      <mesh material={mat} rotation={[0, 0, Math.PI / 4]} scale={0.46}>
        <octahedronGeometry args={[0.52, 0]} />
      </mesh>
    </group>
  );
}

function NovaGlyph({ accent }) {
  const group = useRef(null);
  const mat = useAccentMaterial(accent);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.4;
    group.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.5) * 0.18;
  });

  return (
    <group ref={group}>
      <mesh material={mat}>
        <icosahedronGeometry args={[0.8, 1]} />
      </mesh>

      <mesh material={mat} rotation={[Math.PI / 2, 0, 0]} scale={1.15}>
        <torusGeometry args={[1.22, 0.05, 24, 100]} />
      </mesh>

      {[
        [1.55, 0.18, 0],
        [-1.45, -0.14, 0.18],
        [0.3, 1.55, -0.14],
      ].map((p, i) => (
        <mesh key={i} material={mat} position={p} scale={0.14}>
          <sphereGeometry args={[1, 18, 18]} />
        </mesh>
      ))}
    </group>
  );
}

function AtlasGlyph({ accent }) {
  const group = useRef(null);
  const mat = useAccentMaterial(accent);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y += delta * 0.34;
    group.current.position.y = Math.sin(state.clock.elapsedTime * 1.1) * 0.05;
  });

  return (
    <group ref={group}>
      <mesh material={mat} position={[-0.6, -0.16, 0]} scale={[0.36, 1.05, 0.36]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh material={mat} position={[0, 0.06, 0]} scale={[0.36, 1.5, 0.36]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh material={mat} position={[0.6, 0.34, 0]} scale={[0.36, 2.04, 0.36]}>
        <boxGeometry args={[1, 1, 1]} />
      </mesh>
      <mesh material={mat} rotation={[Math.PI / 2, 0, 0]} position={[0, -0.8, 0]}>
        <torusGeometry args={[1.05, 0.06, 20, 100]} />
      </mesh>
    </group>
  );
}

function EchoGlyph({ accent }) {
  const group = useRef(null);
  const mat = useAccentMaterial(accent);

  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.z += delta * 0.22;
    group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.2;
  });

  return (
    <group ref={group}>
      <mesh material={mat}>
        <torusGeometry args={[0.92, 0.08, 24, 120]} />
      </mesh>
      <mesh material={mat} scale={0.58}>
        <torusGeometry args={[0.92, 0.06, 24, 120]} />
      </mesh>
      <mesh material={mat} rotation={[0, 0, Math.PI / 4]} scale={[1.35, 0.09, 0.09]}>
        <boxGeometry args={[1.4, 1.4, 1.4]} />
      </mesh>
      <mesh material={mat} rotation={[0, 0, -Math.PI / 4]} scale={[1.35, 0.09, 0.09]}>
        <boxGeometry args={[1.4, 1.4, 1.4]} />
      </mesh>
    </group>
  );
}

function Glyph({ variant, accent }) {
  return (
    <Float speed={2} rotationIntensity={0.45} floatIntensity={0.35}>
      {variant === "nova" && <NovaGlyph accent={accent} />}
      {variant === "atlas" && <AtlasGlyph accent={accent} />}
      {variant === "echo" && <EchoGlyph accent={accent} />}
      {variant === "orion" && <OrionGlyph accent={accent} />}
    </Float>
  );
}

export default function AgentIcon3D({ variant = "orion", accent = "#67e8f9", className = "" }) {
  return (
    <div className={className}>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 4.8], fov: 34 }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={1.15} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} />
        <pointLight position={[-4, -2, 3]} intensity={1.4} color={accent} />
        <Glyph variant={variant} accent={accent} />
      </Canvas>
    </div>
  );
}