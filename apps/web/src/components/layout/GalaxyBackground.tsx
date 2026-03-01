import { useEffect, useRef } from 'react';
import * as THREE from 'three';

type GalaxyConfig = {
  count: number;
  radius: number;
  branches: number;
  spin: number;
  randomness: number;
  randomnessPower: number;
  insideColor: string;
  outsideColor: string;
  pointSize: number;
};

function createStarTexture() {
  const canvas = document.createElement('canvas');
  const size = 128;
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }

  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.2, 'rgba(240,235,255,1)');
  gradient.addColorStop(0.5, 'rgba(106,169,255,0.45)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function getGalaxyConfig(width: number): GalaxyConfig {
  const mobile = width < 768;

  return {
    count: mobile ? 9000 : 28000,
    radius: mobile ? 7.5 : 10,
    branches: 5,
    spin: 0.6,
    randomness: 0.24,
    randomnessPower: 3,
    insideColor: '#fff2c6',
    outsideColor: '#5da7ff',
    pointSize: mobile ? 0.04 : 0.03,
  };
}

function buildGalaxy(config: GalaxyConfig, texture: THREE.Texture | null) {
  const geometry = new THREE.BufferGeometry();

  const positions = new Float32Array(config.count * 3);
  const colors = new Float32Array(config.count * 3);

  const insideColor = new THREE.Color(config.insideColor);
  const outsideColor = new THREE.Color(config.outsideColor);

  for (let i = 0; i < config.count; i += 1) {
    const i3 = i * 3;
    const radius = Math.random() * config.radius;
    const branchAngle = ((i % config.branches) / config.branches) * Math.PI * 2;
    const spinAngle = radius * config.spin;

    const randomX =
      Math.pow(Math.random(), config.randomnessPower) *
      (Math.random() < 0.5 ? 1 : -1) *
      config.randomness *
      radius;
    const randomY =
      Math.pow(Math.random(), config.randomnessPower) *
      (Math.random() < 0.5 ? 1 : -1) *
      config.randomness *
      radius *
      0.25;
    const randomZ =
      Math.pow(Math.random(), config.randomnessPower) *
      (Math.random() < 0.5 ? 1 : -1) *
      config.randomness *
      radius;

    positions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
    positions[i3 + 1] = randomY;
    positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

    const mixedColor = insideColor.clone();
    mixedColor.lerp(outsideColor, radius / config.radius);

    colors[i3] = mixedColor.r;
    colors[i3 + 1] = mixedColor.g;
    colors[i3 + 2] = mixedColor.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: config.pointSize,
    map: texture,
    alphaMap: texture,
    sizeAttenuation: true,
    depthWrite: false,
    transparent: true,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    opacity: 0.9,
  });

  const points = new THREE.Points(geometry, material);
  return { points, geometry, material };
}

export function GalaxyBackground() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mountElement = mountRef.current;
    if (!mountElement) {
      return;
    }

    let rafId = 0;
    let currentGalaxy: ReturnType<typeof buildGalaxy> | null = null;
    let config = getGalaxyConfig(window.innerWidth);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.2, config.radius * 1.08);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    mountElement.appendChild(renderer.domElement);

    const texture = createStarTexture();

    const rebuildGalaxy = () => {
      if (currentGalaxy) {
        scene.remove(currentGalaxy.points);
        currentGalaxy.geometry.dispose();
        currentGalaxy.material.dispose();
      }

      currentGalaxy = buildGalaxy(config, texture);
      currentGalaxy.points.rotation.x = -0.18;
      scene.add(currentGalaxy.points);
    };

    rebuildGalaxy();

    const pointer = { x: 0, y: 0 };
    const clock = new THREE.Clock();

    const onPointerMove = (event: MouseEvent) => {
      pointer.x = (event.clientX / window.innerWidth - 0.5) * 0.35;
      pointer.y = (event.clientY / window.innerHeight - 0.5) * 0.2;
    };

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      const nextConfig = getGalaxyConfig(window.innerWidth);
      if (nextConfig.count !== config.count || nextConfig.radius !== config.radius) {
        config = nextConfig;
        camera.position.set(0, 1.2, config.radius * 1.08);
        rebuildGalaxy();
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('resize', onResize);

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      if (currentGalaxy) {
        currentGalaxy.points.rotation.y = elapsed * 0.0075;
      }

      camera.position.x += (pointer.x - camera.position.x) * 0.012;
      camera.position.y += (1.2 - pointer.y - camera.position.y) * 0.012;
      camera.lookAt(0, 0.2, 0);

      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);
      window.cancelAnimationFrame(rafId);

      if (currentGalaxy) {
        currentGalaxy.geometry.dispose();
        currentGalaxy.material.dispose();
      }

      texture?.dispose();
      renderer.dispose();
      mountElement.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      <div
        ref={mountRef}
        className="h-full w-full bg-[radial-gradient(circle_at_25%_10%,rgba(255,212,133,0.08),transparent_38%),radial-gradient(circle_at_80%_70%,rgba(53,113,255,0.16),transparent_42%),linear-gradient(180deg,rgba(3,9,20,0.96),rgba(2,6,16,0.99))]"
      />
    </div>
  );
}
