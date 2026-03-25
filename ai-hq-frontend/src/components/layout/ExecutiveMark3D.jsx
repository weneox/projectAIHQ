import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function ExecutiveMark3D({ className = "" }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let raf = 0;

    let width = Math.max(mount.clientWidth || 88, 1);
    let height = Math.max(mount.clientHeight || 88, 1);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(24, width / height, 0.1, 100);
    camera.position.set(0, 0, 8.8);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
      premultipliedAlpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    mount.appendChild(renderer.domElement);

    const world = new THREE.Group();
    const insignia = new THREE.Group();
    scene.add(world);
    world.add(insignia);

    const ambient = new THREE.AmbientLight(0xffffff, 0.82);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xfafcff, 1.45);
    keyLight.position.set(2.8, 2.4, 5.5);
    scene.add(keyLight);

    const coolFill = new THREE.DirectionalLight(0xd8eaff, 0.45);
    coolFill.position.set(-3.2, -1.8, 4.2);
    scene.add(coolFill);

    const rimTop = new THREE.DirectionalLight(0xffffff, 0.28);
    rimTop.position.set(0, 4, 3);
    scene.add(rimTop);

    const backGlow = new THREE.PointLight(0xb9deff, 0.35, 10);
    backGlow.position.set(0, 0, -2);
    scene.add(backGlow);

    const outerShellMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf8fbff,
      roughness: 0.18,
      metalness: 0.04,
      transmission: 0.16,
      transparent: true,
      opacity: 0.96,
      thickness: 0.7,
      ior: 1.18,
      reflectivity: 0.42,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
    });

    const midShellMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xeaf3ff,
      roughness: 0.26,
      metalness: 0.02,
      transmission: 0.08,
      transparent: true,
      opacity: 0.18,
      thickness: 0.45,
      ior: 1.12,
      reflectivity: 0.24,
      clearcoat: 0.6,
      clearcoatRoughness: 0.16,
    });

    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xdcecff,
      emissive: 0xc9e0ff,
      emissiveIntensity: 0.04,
      roughness: 0.32,
      metalness: 0.02,
      transmission: 0.04,
      transparent: true,
      opacity: 0.16,
      thickness: 0.28,
      ior: 1.08,
      clearcoat: 0.42,
      clearcoatRoughness: 0.18,
    });

    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.14,
    });

    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0xdcedff,
      transparent: true,
      opacity: 0.055,
      depthWrite: false,
    });

    const haloMaterialStrong = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
    });

    const shardMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf8fbff,
      roughness: 0.22,
      metalness: 0.03,
      transmission: 0.08,
      transparent: true,
      opacity: 0.34,
      thickness: 0.18,
      ior: 1.12,
      clearcoat: 0.8,
      clearcoatRoughness: 0.14,
    });

    const outerGeometry = new THREE.OctahedronGeometry(1.2, 0);
    const outerShell = new THREE.Mesh(outerGeometry, outerShellMaterial);
    outerShell.scale.set(0.86, 1.08, 0.86);
    outerShell.rotation.z = 0.16;
    insignia.add(outerShell);

    const midGeometry = new THREE.OctahedronGeometry(0.88, 0);
    const midShell = new THREE.Mesh(midGeometry, midShellMaterial);
    midShell.scale.set(0.92, 1.08, 0.92);
    midShell.rotation.z = -0.12;
    insignia.add(midShell);

    const coreGeometry = new THREE.OctahedronGeometry(0.5, 0);
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.scale.set(0.95, 1.18, 0.95);
    core.rotation.z = 0.08;
    insignia.add(core);

    const outerEdges = new THREE.EdgesGeometry(outerGeometry);
    const outerLines = new THREE.LineSegments(outerEdges, lineMaterial);
    outerLines.scale.copy(outerShell.scale);
    outerLines.rotation.copy(outerShell.rotation);
    insignia.add(outerLines);

    const haloOneGeometry = new THREE.TorusGeometry(1.72, 0.014, 12, 180);
    const haloOne = new THREE.Mesh(haloOneGeometry, haloMaterial);
    haloOne.rotation.x = 1.08;
    haloOne.rotation.y = -0.22;
    haloOne.rotation.z = 0.1;
    haloOne.scale.set(1.02, 0.9, 1);
    insignia.add(haloOne);

    const haloTwoGeometry = new THREE.TorusGeometry(1.4, 0.01, 12, 180);
    const haloTwo = new THREE.Mesh(haloTwoGeometry, haloMaterialStrong);
    haloTwo.rotation.x = 0.88;
    haloTwo.rotation.y = 0.52;
    haloTwo.rotation.z = 1.18;
    haloTwo.scale.set(0.95, 1.06, 1);
    insignia.add(haloTwo);

    const haloThreeGeometry = new THREE.TorusGeometry(
      1.06,
      0.01,
      10,
      140,
      Math.PI * 0.92
    );
    const haloThree = new THREE.Mesh(haloThreeGeometry, haloMaterial);
    haloThree.rotation.x = 1.24;
    haloThree.rotation.y = -0.55;
    haloThree.rotation.z = -0.42;
    insignia.add(haloThree);

    const shardGeometry = new THREE.TetrahedronGeometry(0.11, 0);
    const shards = new THREE.Group();

    const shardAnchors = [
      { x: 0, y: 1.62, z: 0.12, s: 1.0 },
      { x: 1.44, y: 0.14, z: -0.12, s: 0.86 },
      { x: -1.34, y: -0.22, z: 0.06, s: 0.78 },
      { x: 0.16, y: -1.52, z: -0.08, s: 0.92 },
    ];

    const shardMeshes = shardAnchors.map((item) => {
      const mesh = new THREE.Mesh(shardGeometry, shardMaterial);
      mesh.position.set(item.x, item.y, item.z);
      mesh.scale.setScalar(item.s);
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      shards.add(mesh);
      return mesh;
    });

    insignia.add(shards);

    const particleCount = 20;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleMeta = [];

    for (let i = 0; i < particleCount; i += 1) {
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 1.55 + Math.random() * 0.24;
      const y = (Math.random() - 0.5) * 0.24;

      particlePositions[i * 3 + 0] = Math.cos(angle) * radius;
      particlePositions[i * 3 + 1] = y;
      particlePositions[i * 3 + 2] = Math.sin(angle) * radius * 0.34;

      particleMeta.push({
        angle,
        radius,
        speed: 0.08 + Math.random() * 0.05,
        y,
        wobble: 0.025 + Math.random() * 0.025,
      });
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(particlePositions, 3)
    );

    const particleMaterial = new THREE.PointsMaterial({
      color: 0xfafcff,
      size: 0.018,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    insignia.add(particles);

    const positions = particleGeometry.attributes.position.array;

    const animate = () => {
      if (disposed) return;

      const t = performance.now() * 0.001;

      world.rotation.y = Math.sin(t * 0.24) * 0.055;
      world.rotation.x = Math.sin(t * 0.18) * 0.02;

      insignia.rotation.y += 0.0018;

      outerShell.rotation.z = 0.16 + Math.sin(t * 0.55) * 0.012;
      midShell.rotation.z = -0.12 - Math.sin(t * 0.42) * 0.01;
      core.rotation.z = 0.08 + Math.sin(t * 0.72) * 0.018;

      haloOne.rotation.z = 0.1 + t * 0.08;
      haloTwo.rotation.z = 1.18 - t * 0.065;
      haloThree.rotation.z = -0.42 + t * 0.05;

      shards.rotation.z = t * 0.11;
      shards.rotation.y = Math.sin(t * 0.28) * 0.14;

      shardMeshes.forEach((mesh, i) => {
        const p = shardAnchors[i];
        mesh.position.y = p.y + Math.sin(t * (0.8 + i * 0.08)) * 0.02;
        mesh.rotation.x += 0.0025 + i * 0.0001;
        mesh.rotation.y += 0.002 + i * 0.00008;
      });

      for (let i = 0; i < particleCount; i += 1) {
        const meta = particleMeta[i];
        const a = meta.angle + t * meta.speed;
        positions[i * 3 + 0] = Math.cos(a) * meta.radius;
        positions[i * 3 + 1] = meta.y + Math.sin(t * 1.2 + i) * meta.wobble;
        positions[i * 3 + 2] = Math.sin(a) * meta.radius * 0.38;
      }

      particleGeometry.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      width = Math.max(mount.clientWidth || 88, 1);
      height = Math.max(mount.clientHeight || 88, 1);

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mount);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(raf);
      resizeObserver.disconnect();

      outerGeometry.dispose();
      midGeometry.dispose();
      coreGeometry.dispose();
      outerEdges.dispose();
      haloOneGeometry.dispose();
      haloTwoGeometry.dispose();
      haloThreeGeometry.dispose();
      shardGeometry.dispose();
      particleGeometry.dispose();

      outerShellMaterial.dispose();
      midShellMaterial.dispose();
      coreMaterial.dispose();
      lineMaterial.dispose();
      haloMaterial.dispose();
      haloMaterialStrong.dispose();
      shardMaterial.dispose();
      particleMaterial.dispose();

      renderer.dispose();

      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className={className} />;
}