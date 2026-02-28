import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GalaxyNode } from '../../lib/galaxy/schema';

interface HoverPayload {
  node: GalaxyNode;
  x: number;
  y: number;
}

interface GalaxyCanvasProps {
  nodes: GalaxyNode[];
  bridgesMode: boolean;
  selectedNodeId: string | null;
  onHoverChange: (payload: HoverPayload | null) => void;
  onNodeClick: (node: GalaxyNode | null) => void;
}

interface RuntimeState {
  nodes: GalaxyNode[];
  positions: Float32Array;
  sizeAttr: THREE.BufferAttribute;
  alphaAttr: THREE.BufferAttribute;
  camera: THREE.PerspectiveCamera;
  width: number;
  height: number;
}

const VERTEX_SHADER = `
attribute float aSize;
attribute float aAlpha;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vColor = color;
  vAlpha = aAlpha;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float depth = max(20.0, -mvPosition.z);
  gl_PointSize = aSize * (180.0 / depth);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAGMENT_SHADER = `
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float dist = length(uv);
  float alpha = smoothstep(0.5, 0.0, dist) * vAlpha;

  if (alpha < 0.02) {
    discard;
  }

  gl_FragColor = vec4(vColor, alpha);
}
`;

function clusterColor(cluster: number) {
  const hue = (cluster * 53) % 360;
  const color = new THREE.Color();
  color.setHSL(hue / 360, 0.62, 0.64);
  return color;
}

function resolveAlpha(node: GalaxyNode, bridgesMode: boolean, selectedId: string | null) {
  if (selectedId && node.id === selectedId) {
    return 1;
  }

  if (!bridgesMode) {
    return 0.9;
  }

  return node.isBridge ? 1 : 0.1;
}

function resolveSize(node: GalaxyNode, selectedId: string | null) {
  const selectedBoost = selectedId === node.id ? 1.9 : 1;
  return Math.max(2, node.size) * selectedBoost;
}

export function GalaxyCanvas({ nodes, bridgesMode, selectedNodeId, onHoverChange, onNodeClick }: GalaxyCanvasProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onHoverRef = useRef(onHoverChange);
  const onClickRef = useRef(onNodeClick);
  const runtimeRef = useRef<RuntimeState | null>(null);

  useEffect(() => {
    onHoverRef.current = onHoverChange;
  }, [onHoverChange]);

  useEffect(() => {
    onClickRef.current = onNodeClick;
  }, [onNodeClick]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    for (let i = 0; i < runtime.nodes.length; i += 1) {
      const node = runtime.nodes[i];
      runtime.sizeAttr.setX(i, resolveSize(node, selectedNodeId));
      runtime.alphaAttr.setX(i, resolveAlpha(node, bridgesMode, selectedNodeId));
    }

    runtime.sizeAttr.needsUpdate = true;
    runtime.alphaAttr.needsUpdate = true;
  }, [bridgesMode, selectedNodeId]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || nodes.length === 0) {
      return;
    }

    let width = mount.clientWidth || 960;
    let height = mount.clientHeight || 640;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050914, 0.0016);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 4000);
    camera.position.set(0, 26, 95);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xbad7ff, 0.6);
    scene.add(ambient);

    const key = new THREE.PointLight(0xc8e0ff, 1, 900);
    key.position.set(130, 140, 90);
    scene.add(key);

    const count = nodes.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);

    const geometry = new THREE.BufferGeometry();

    for (let i = 0; i < count; i += 1) {
      const node = nodes[i];
      const i3 = i * 3;
      const color = clusterColor(node.cluster);

      positions[i3] = node.x;
      positions[i3 + 1] = node.y;
      positions[i3 + 2] = node.z;
      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
      sizes[i] = resolveSize(node, selectedNodeId);
      alphas[i] = resolveAlpha(node, bridgesMode, selectedNodeId);
    }

    const sizeAttr = new THREE.BufferAttribute(sizes, 1);
    const alphaAttr = new THREE.BufferAttribute(alphas, 1);

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', sizeAttr);
    geometry.setAttribute('aAlpha', alphaAttr);

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });

    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.zoomSpeed = 0.8;
    controls.minDistance = 20;
    controls.maxDistance = 450;

    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 3.2 };

    const pointerNdc = new THREE.Vector2();
    const reusableVector = new THREE.Vector3();

    let raf = 0;
    let hoverIndex = -1;

    runtimeRef.current = {
      nodes,
      positions,
      sizeAttr,
      alphaAttr,
      camera,
      width,
      height,
    };

    const screenSearch = (clientX: number, clientY: number): number => {
      const runtime = runtimeRef.current;
      if (!runtime) {
        return -1;
      }

      let nearestIndex = -1;
      let nearestDistance = Number.POSITIVE_INFINITY;
      const maxDistancePx = 18;

      for (let i = 0; i < runtime.nodes.length; i += 1) {
        const i3 = i * 3;
        reusableVector.set(runtime.positions[i3], runtime.positions[i3 + 1], runtime.positions[i3 + 2]);
        reusableVector.project(runtime.camera);

        const sx = ((reusableVector.x + 1) * 0.5) * runtime.width;
        const sy = ((1 - reusableVector.y) * 0.5) * runtime.height;
        const distance = Math.hypot(sx - clientX, sy - clientY);

        if (distance < nearestDistance && distance <= maxDistancePx) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      return nearestIndex;
    };

    const pickNodeIndex = (clientX: number, clientY: number) => {
      const runtime = runtimeRef.current;
      if (!runtime) {
        return -1;
      }

      pointerNdc.x = (clientX / runtime.width) * 2 - 1;
      pointerNdc.y = -(clientY / runtime.height) * 2 + 1;

      raycaster.setFromCamera(pointerNdc, runtime.camera);
      const intersections = raycaster.intersectObject(points, false);
      if (intersections.length > 0 && intersections[0].index !== undefined) {
        return intersections[0].index;
      }

      return screenSearch(clientX, clientY);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const clientX = event.clientX - rect.left;
      const clientY = event.clientY - rect.top;
      const nextIndex = pickNodeIndex(clientX, clientY);

      if (nextIndex < 0) {
        if (hoverIndex !== -1) {
          hoverIndex = -1;
          onHoverRef.current(null);
        }
        return;
      }

      if (hoverIndex === nextIndex) {
        onHoverRef.current({ node: nodes[nextIndex], x: event.clientX, y: event.clientY });
        return;
      }

      hoverIndex = nextIndex;
      onHoverRef.current({ node: nodes[nextIndex], x: event.clientX, y: event.clientY });
    };

    const onMouseLeave = () => {
      hoverIndex = -1;
      onHoverRef.current(null);
    };

    const onClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const clientX = event.clientX - rect.left;
      const clientY = event.clientY - rect.top;
      const index = pickNodeIndex(clientX, clientY);

      if (index < 0) {
        onClickRef.current(null);
        return;
      }

      onClickRef.current(nodes[index]);
    };

    const onResize = () => {
      width = mount.clientWidth || 960;
      height = mount.clientHeight || 640;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);

      if (runtimeRef.current) {
        runtimeRef.current.width = width;
        runtimeRef.current.height = height;
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('mouseleave', onMouseLeave);
    renderer.domElement.addEventListener('click', onClick);
    window.addEventListener('resize', onResize);

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('mouseleave', onMouseLeave);
      renderer.domElement.removeEventListener('click', onClick);
      controls.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      runtimeRef.current = null;
      mount.removeChild(renderer.domElement);
    };
  }, [nodes]);

  return <div ref={mountRef} className="h-full w-full" />;
}
