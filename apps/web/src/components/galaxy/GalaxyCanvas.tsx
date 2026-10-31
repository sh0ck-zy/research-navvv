import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GalaxyNode } from '../../lib/galaxy/schema';

export const MILKY_WAY_MODE = true;

interface HoverPayload {
  node: GalaxyNode;
  x: number;
  y: number;
}

export interface FlyToRequest {
  nodeId: string;
  nonce: number;
  source: 'search' | 'ui';
}

interface AmbientConfig {
  enabled: boolean;
  seed: number;
  count: number;
}

interface GalaxyCanvasProps {
  nodes: GalaxyNode[];
  bridgesMode?: boolean;
  selectedNodeId?: string | null;
  flyToRequest?: FlyToRequest | null;
  ambient?: AmbientConfig;
  pointThreshold?: number;
  onHoverChange: (payload: HoverPayload | null) => void;
  onNodeClick: (node: GalaxyNode | null) => void;
  onFlyToComplete?: (nodeId: string) => void;
}

interface FlyAnimationState {
  request: FlyToRequest;
  nodeIndex: number;
  startAt: number;
  durationMs: number;
  settleMs: number;
  disableUntil: number;
  startCameraPos: THREE.Vector3;
  startTarget: THREE.Vector3;
  startFov: number;
  midCameraPos: THREE.Vector3;
  overshootCameraPos: THREE.Vector3;
  endCameraPos: THREE.Vector3;
  overshootTarget: THREE.Vector3;
  endTarget: THREE.Vector3;
  endFov: number;
}

interface RuntimeState {
  nodes: GalaxyNode[];
  positions: Float32Array;
  baseSizeAttr: THREE.BufferAttribute;
  baseAlphaAttr: THREE.BufferAttribute;
  sizeAttr: THREE.BufferAttribute;
  alphaAttr: THREE.BufferAttribute;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  width: number;
  height: number;
  idToIndex: Map<string, number>;
  fly: FlyAnimationState | null;
  lastFlyAtMs: number;
}

const K_NEIGHBORS = 24;
const FLY_DURATION_MS = 1500;
const FLY_SETTLE_MS = 200;
const FLY_DEBOUNCE_MS = 80;
const DEFAULT_AMBIENT: AmbientConfig = { enabled: true, seed: 42, count: 3200 };

const VERTEX_SHADER = `
attribute float aSize;
attribute float aAlpha;
varying vec3 vColor;
varying float vAlpha;

void main() {
  vColor = color;
  vAlpha = aAlpha;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float depth = max(18.0, -mvPosition.z);
  gl_PointSize = aSize * (170.0 / depth);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAGMENT_SHADER = `
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float dist = length(uv) * 2.0;
  if (dist > 1.0) discard;

  // Soft "core + halo" profile to avoid square-looking points.
  float core = smoothstep(0.44, 0.0, dist);
  float halo = smoothstep(1.0, 0.24, dist);
  float alpha = (core * 0.88 + halo * 0.42) * vAlpha;
  gl_FragColor = vec4(vColor, alpha);
}
`;

const TEMP_VEC3_A = new THREE.Vector3();
const TEMP_VEC3_B = new THREE.Vector3();
const TEMP_VEC3_C = new THREE.Vector3();

function clusterColor(cluster: number) {
  const palette = [0xeaf2ff, 0x7fa8ff, 0xa78bfa, 0x6ee7b7, 0xf5f5f5, 0x60a5fa, 0xc4b5fd, 0x34d399];
  const hex = palette[((cluster % palette.length) + palette.length) % palette.length];
  return new THREE.Color(hex);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createSeededRng(seed: number) {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function easeInOutCubic(value: number) {
  if (value < 0.5) {
    return 4 * value * value * value;
  }

  return 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function quadraticBezier(out: THREE.Vector3, p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, t: number) {
  const it = 1 - t;
  const w0 = it * it;
  const w1 = 2 * it * t;
  const w2 = t * t;

  out.set(
    p0.x * w0 + p1.x * w1 + p2.x * w2,
    p0.y * w0 + p1.y * w1 + p2.y * w2,
    p0.z * w0 + p1.z * w1 + p2.z * w2
  );

  return out;
}

function resolveBaseSize(node: GalaxyNode) {
  const raw = node.sizeBase ?? node.size;
  return clamp(raw, 0.55, 3.2);
}

function resolveBaseAlpha(node: GalaxyNode) {
  if (typeof node.alphaBase === 'number') {
    return clamp(node.alphaBase, 0.05, 1);
  }

  if (node.layer === 'dust') {
    return 0.2;
  }

  if (node.layer === 'bright') {
    return 0.58;
  }

  return 0.36;
}

function buildAmbientField(config: AmbientConfig) {
  const count = Math.max(0, Math.floor(config.count));
  if (!config.enabled || count <= 0) {
    return null;
  }

  const rand = createSeededRng(config.seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const radial = Math.pow(rand(), 1.72) * 360;
    const branchSign = rand() < 0.5 ? -1 : 1;
    const thetaBase = rand() * Math.PI * 2;
    const thetaSpiral = thetaBase + branchSign * (0.24 + radial * 0.0027);
    const theta = thetaSpiral + 0.11 * Math.sin(thetaBase * 2.0 + radial * 0.021);

    const filamentJitter = (rand() - 0.5) * (3.2 + radial * 0.012);
    const x = (radial + filamentJitter) * Math.cos(theta);
    const z = (radial + filamentJitter) * Math.sin(theta);

    const bandHalfHeight = 5.8 + radial * 0.024;
    const y = (rand() - 0.5) * bandHalfHeight + (rand() - 0.5) * 1.2;

    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;

    const tint = 0.84 + rand() * 0.16;
    colors[i3] = 0.58 * tint;
    colors[i3 + 1] = 0.66 * tint;
    colors[i3 + 2] = 0.94 * tint;

    sizes[i] = 0.32 + Math.pow(rand(), 1.35) * 0.88;
    alphas[i] = 0.02 + Math.pow(rand(), 0.72) * 0.08;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  return { geometry, material, points };
}

function distanceSq(positions: Float32Array, a: number, b: number) {
  const a3 = a * 3;
  const b3 = b * 3;
  const dx = positions[a3] - positions[b3];
  const dy = positions[a3 + 1] - positions[b3 + 1];
  const dz = positions[a3 + 2] - positions[b3 + 2];
  return dx * dx + dy * dy + dz * dz;
}

function computeKNearestNeighbors(positions: Float32Array, selectedIndex: number, k: number) {
  const distances: Array<{ index: number; dist: number }> = [];
  const count = positions.length / 3;

  for (let i = 0; i < count; i += 1) {
    if (i === selectedIndex) {
      continue;
    }

    distances.push({ index: i, dist: distanceSq(positions, selectedIndex, i) });
  }

  distances.sort((left, right) => left.dist - right.dist);
  return new Set(distances.slice(0, k).map((entry) => entry.index));
}

function applyVisualState(runtime: RuntimeState, bridgesMode: boolean, selectedNodeId: string | null) {
  const selectedIndex = selectedNodeId ? runtime.idToIndex.get(selectedNodeId) ?? -1 : -1;
  const hasSelection = selectedIndex >= 0;
  const neighborIndexes = selectedIndex >= 0 ? computeKNearestNeighbors(runtime.positions, selectedIndex, K_NEIGHBORS) : new Set<number>();

  for (let i = 0; i < runtime.nodes.length; i += 1) {
    const node = runtime.nodes[i];
    const baseSize = runtime.baseSizeAttr.getX(i);
    const baseAlpha = runtime.baseAlphaAttr.getX(i);

    const selected = i === selectedIndex;
    const neighbor = neighborIndexes.has(i);

    let size = baseSize;
    let alpha = baseAlpha;

    if (hasSelection && selected) {
      size = baseSize * 1.38;
      alpha = baseAlpha + 0.28;
    } else if (hasSelection && neighbor) {
      alpha = baseAlpha + 0.12;
    } else if (hasSelection) {
      alpha = baseAlpha - 0.07;
    }

    if (bridgesMode && !selected && !neighbor) {
      alpha += node.isBridge ? 0.04 : -0.06;
    }

    runtime.sizeAttr.setX(i, clamp(size, 0.55, 6.4));
    runtime.alphaAttr.setX(i, clamp(alpha, 0.06, 1));
  }

  runtime.sizeAttr.needsUpdate = true;
  runtime.alphaAttr.needsUpdate = true;
}

export function GalaxyCanvas({
  nodes,
  bridgesMode = false,
  selectedNodeId = null,
  flyToRequest = null,
  ambient = DEFAULT_AMBIENT,
  pointThreshold = 3.2,
  onHoverChange,
  onNodeClick,
  onFlyToComplete,
}: GalaxyCanvasProps) {
  const ambientConfig = ambient ?? DEFAULT_AMBIENT;
  const ambientEnabled = ambientConfig.enabled;
  const ambientSeed = ambientConfig.seed;
  const ambientCount = ambientConfig.count;
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onHoverRef = useRef(onHoverChange);
  const onClickRef = useRef(onNodeClick);
  const onFlyCompleteRef = useRef(onFlyToComplete);
  const runtimeRef = useRef<RuntimeState | null>(null);

  useEffect(() => {
    onHoverRef.current = onHoverChange;
  }, [onHoverChange]);

  useEffect(() => {
    onClickRef.current = onNodeClick;
  }, [onNodeClick]);

  useEffect(() => {
    onFlyCompleteRef.current = onFlyToComplete;
  }, [onFlyToComplete]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    applyVisualState(runtime, bridgesMode, selectedNodeId);
  }, [bridgesMode, selectedNodeId]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || !flyToRequest) {
      return;
    }

    const nodeIndex = runtime.idToIndex.get(flyToRequest.nodeId);
    if (nodeIndex === undefined) {
      return;
    }

    const now = performance.now();
    if (now - runtime.lastFlyAtMs < FLY_DEBOUNCE_MS) {
      return;
    }

    runtime.lastFlyAtMs = now;

    const i3 = nodeIndex * 3;
    const targetPosition = TEMP_VEC3_A.set(runtime.positions[i3], runtime.positions[i3 + 1], runtime.positions[i3 + 2]).clone();

    const startCamera = runtime.camera.position.clone();
    const startTarget = runtime.controls.target.clone();

    const lookDirection = TEMP_VEC3_B.copy(startCamera).sub(startTarget);
    if (lookDirection.lengthSq() < 1e-6) {
      lookDirection.set(0, 0.25, 1);
    }
    lookDirection.normalize();

    const startDistance = Math.max(1, startCamera.distanceTo(startTarget));
    const standoff = clamp(startDistance * 0.34, 18, 36);

    const endTarget = targetPosition.clone();
    const endCamera = targetPosition
      .clone()
      .addScaledVector(lookDirection, standoff)
      .add(new THREE.Vector3(0, standoff * 0.14, 0));

    const railHeight = Math.max(8, startCamera.distanceTo(endCamera) * 0.18);
    const midCamera = startCamera.clone().lerp(endCamera, 0.5).add(new THREE.Vector3(0, railHeight, 0));

    const overshootDirection = TEMP_VEC3_C.copy(endCamera).sub(endTarget).normalize();
    const overshootCamera = endCamera.clone().addScaledVector(overshootDirection, 0.95);
    const overshootTarget = endTarget.clone().add(new THREE.Vector3(0, 0.28, 0));

    const endFov = clamp(48 - (runtime.nodes[nodeIndex].layer === 'bright' ? 4 : 0), 40, 54);

    runtime.fly = {
      request: flyToRequest,
      nodeIndex,
      startAt: now,
      durationMs: FLY_DURATION_MS,
      settleMs: FLY_SETTLE_MS,
      disableUntil: now + 600,
      startCameraPos: startCamera,
      startTarget,
      startFov: runtime.camera.fov,
      midCameraPos: midCamera,
      overshootCameraPos: overshootCamera,
      endCameraPos: endCamera,
      overshootTarget,
      endTarget,
      endFov,
    };

    runtime.controls.enabled = false;
    runtime.controls.dampingFactor = 0.16;
  }, [flyToRequest]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || nodes.length === 0) {
      return;
    }

    let width = mount.clientWidth || 960;
    let height = mount.clientHeight || 640;

    const scene = new THREE.Scene();

    if (MILKY_WAY_MODE) {
      scene.fog = new THREE.FogExp2(0x060a12, 0.00024);
    } else {
      scene.fog = new THREE.FogExp2(0x0b0d12, 0.00135);
    }

    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 4000);
    camera.position.set(0, 22, 94);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;
    mount.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    const key = new THREE.PointLight(0xffffff, 0.62, 900);
    key.position.set(130, 120, 90);
    scene.add(key);

    const count = nodes.length;

    // Sort nodes to group by layer for multi-material drawing
    const order: Record<string, number> = { dust: 0, star: 1, bright: 2 };
    const sortedNodes = [...nodes].sort((a, b) => {
      const orderA = a.layer && order[a.layer] !== undefined ? order[a.layer] : 0;
      const orderB = b.layer && order[b.layer] !== undefined ? order[b.layer] : 0;
      return orderA - orderB;
    });

    let dustCount = 0;
    let starCount = 0;
    let brightCount = 0;

    for (let i = 0; i < count; i += 1) {
      if (sortedNodes[i].layer === 'dust' || !sortedNodes[i].layer) dustCount++;
      else if (sortedNodes[i].layer === 'star') starCount++;
      else if (sortedNodes[i].layer === 'bright') brightCount++;
    }

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const clusterTints = new Float32Array(count);
    const baseSizes = new Float32Array(count);
    const baseAlphas = new Float32Array(count);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);

    const geometry = new THREE.BufferGeometry();

    const idToIndex = new Map<string, number>();

    for (let i = 0; i < count; i += 1) {
      const node = sortedNodes[i];
      const i3 = i * 3;
      const color = clusterColor(node.cluster);

      idToIndex.set(node.id, i);

      positions[i3] = node.x;
      positions[i3 + 1] = node.y;
      positions[i3 + 2] = node.z;

      colors[i3] = color.r;
      colors[i3 + 1] = color.g;
      colors[i3 + 2] = color.b;
      clusterTints[i] = node.cluster;

      const baseSize = resolveBaseSize(node);
      const baseAlpha = resolveBaseAlpha(node);
      baseSizes[i] = baseSize;
      baseAlphas[i] = baseAlpha;
      sizes[i] = baseSize;
      alphas[i] = baseAlpha;
    }

    const baseSizeAttr = new THREE.BufferAttribute(baseSizes, 1);
    const baseAlphaAttr = new THREE.BufferAttribute(baseAlphas, 1);
    const sizeAttr = new THREE.BufferAttribute(sizes, 1);
    const alphaAttr = new THREE.BufferAttribute(alphas, 1);

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('aClusterTint', new THREE.BufferAttribute(clusterTints, 1));
    geometry.setAttribute('aBaseSize', baseSizeAttr);
    geometry.setAttribute('aBaseAlpha', baseAlphaAttr);
    geometry.setAttribute('aSize', sizeAttr);
    geometry.setAttribute('aAlpha', alphaAttr);

    geometry.addGroup(0, dustCount, 0);
    geometry.addGroup(dustCount, starCount, 1);
    geometry.addGroup(dustCount + starCount, brightCount, 2);

    const baseMaterialOptions = {
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      vertexColors: true,
    };

    const dustMaterial = new THREE.ShaderMaterial({
      ...baseMaterialOptions,
      blending: THREE.NormalBlending,
    });

    const starMaterial = new THREE.ShaderMaterial({
      ...baseMaterialOptions,
      blending: THREE.AdditiveBlending,
    });

    const brightMaterial = new THREE.ShaderMaterial({
      ...baseMaterialOptions,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, [dustMaterial, starMaterial, brightMaterial]);
    points.frustumCulled = false;
    scene.add(points);

    const ambientField = buildAmbientField({ enabled: ambientEnabled, seed: ambientSeed, count: ambientCount });
    if (ambientField) {
      scene.add(ambientField.points);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.zoomSpeed = 0.76;
    controls.minDistance = 18;
    controls.maxDistance = 470;

    // --- MILKY WAY BACKGROUND ---
    if (MILKY_WAY_MODE) {
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load('/textures/galaxy/milky-way.jpg', (texture) => {
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.colorSpace = THREE.SRGBColorSpace;

        const skyGeometry = new THREE.SphereGeometry(4000, 32, 32);
        const skyMaterial = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.BackSide,
          transparent: true,
          opacity: 0.2,
          color: new THREE.Color(0xb9c8f0),
        });

        const skySphere = new THREE.Mesh(skyGeometry, skyMaterial);
        skySphere.rotation.set(Math.PI / 4, -Math.PI / 6, 0);
        scene.add(skySphere);
      });

    }

    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: pointThreshold };

    const pointerNdc = new THREE.Vector2();
    const reusableVector = new THREE.Vector3();

    let raf = 0;
    let hoverIndex = -1;

    runtimeRef.current = {
      nodes: sortedNodes,
      positions,
      baseSizeAttr,
      baseAlphaAttr,
      sizeAttr,
      alphaAttr,
      camera,
      controls,
      width,
      height,
      idToIndex,
      fly: null,
      lastFlyAtMs: 0,
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
      if (intersections.length > 0) {
        for (const hit of intersections) {
          if (hit.index !== undefined) {
            return hit.index;
          }
        }
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

      const runtime = runtimeRef.current;
      if (!runtime) return;

      if (hoverIndex === nextIndex) {
        onHoverRef.current({ node: runtime.nodes[nextIndex], x: event.clientX, y: event.clientY });
        return;
      }

      hoverIndex = nextIndex;
      onHoverRef.current({ node: runtime.nodes[nextIndex], x: event.clientX, y: event.clientY });
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

      const runtime = runtimeRef.current;
      if (!runtime) return;

      onClickRef.current(runtime.nodes[index]);
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
      const runtime = runtimeRef.current;
      if (runtime?.fly) {
        const now = performance.now();
        const fly = runtime.fly;

        if (now >= fly.disableUntil && !runtime.controls.enabled) {
          runtime.controls.enabled = true;
        }

        const elapsed = now - fly.startAt;

        if (elapsed <= fly.durationMs) {
          const t = easeInOutCubic(clamp(elapsed / fly.durationMs, 0, 1));
          quadraticBezier(runtime.camera.position, fly.startCameraPos, fly.midCameraPos, fly.overshootCameraPos, t);
          runtime.controls.target.copy(fly.startTarget).lerp(fly.overshootTarget, t);
          runtime.camera.fov = THREE.MathUtils.lerp(fly.startFov, fly.endFov + 1.1, t);
          runtime.camera.updateProjectionMatrix();
        } else if (elapsed <= fly.durationMs + fly.settleMs) {
          const settleT = easeOutCubic(clamp((elapsed - fly.durationMs) / fly.settleMs, 0, 1));
          runtime.camera.position.copy(fly.overshootCameraPos).lerp(fly.endCameraPos, settleT);
          runtime.controls.target.copy(fly.overshootTarget).lerp(fly.endTarget, settleT);
          runtime.camera.fov = THREE.MathUtils.lerp(fly.endFov + 1.1, fly.endFov, settleT);
          runtime.camera.updateProjectionMatrix();
        } else {
          runtime.camera.position.copy(fly.endCameraPos);
          runtime.controls.target.copy(fly.endTarget);
          runtime.camera.fov = fly.endFov;
          runtime.camera.updateProjectionMatrix();
          runtime.fly = null;
          runtime.controls.enabled = true;
          runtime.controls.dampingFactor = 0.08;
          onFlyCompleteRef.current?.(fly.request.nodeId);
        }
      }

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
      dustMaterial.dispose();
      starMaterial.dispose();
      brightMaterial.dispose();
      ambientField?.geometry.dispose();
      ambientField?.material.dispose();
      renderer.dispose();
      runtimeRef.current = null;
      mount.removeChild(renderer.domElement);
    };
  }, [nodes, pointThreshold, ambientCount, ambientEnabled, ambientSeed]);

  return <div ref={mountRef} className="h-full w-full" />;
}
