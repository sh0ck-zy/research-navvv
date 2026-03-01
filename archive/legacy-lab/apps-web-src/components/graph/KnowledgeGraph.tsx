import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { LabEdgeDTO, LabNodeDTO } from '@research-nav/shared-types';

interface KnowledgeGraphProps {
  nodes: LabNodeDTO[];
  edges: LabEdgeDTO[];
  focusNodeId?: string | null;
  focusNodeIds?: string[];
  className?: string;
  onNodeClick?: (node: LabNodeDTO) => void;
}

type SimNode = d3.SimulationNodeDatum &
  LabNodeDTO & {
    anchorX: number;
    anchorZ: number;
    layerY: number;
    baseX: number;
    baseY: number;
    baseZ: number;
    phase: number;
    size: number;
  };

type SimLink = d3.SimulationLinkDatum<SimNode> & LabEdgeDTO;

const NODE_COLOR_MAP: Record<string, string> = {
  paper: '#e8f2ff',
  author: '#7dd3fc',
  topic: '#fcd38d',
  method: '#93c5fd',
  dataset: '#f9a8d4',
  metric: '#a5b4fc',
};

const PAPER_COLOR_PALETTE = ['#f8fbff', '#eaf3ff', '#dcecff', '#f3e8ff', '#e0f7ff', '#ffe8f7'];

const NODE_BASE_SIZE: Record<string, number> = {
  paper: 10.8,
  author: 7.2,
  topic: 8.2,
  method: 7.5,
  dataset: 7.4,
  metric: 7.1,
};

const NODE_BASE_ALPHA: Record<string, number> = {
  paper: 0.92,
  author: 0.32,
  topic: 0.36,
  method: 0.3,
  dataset: 0.29,
  metric: 0.26,
};

function seededRandom(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) {
    state += 2147483646;
  }

  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function createStarTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  if (!context) {
    return new THREE.Texture();
  }

  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.24, 'rgba(233,245,255,0.96)');
  gradient.addColorStop(0.62, 'rgba(143,185,255,0.34)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function buildGraphLinks(edges: LabEdgeDTO[]): SimLink[] {
  return edges.map((edge) => ({
    ...edge,
    source: edge.source,
    target: edge.target,
  }));
}

function buildClusterAssignments(nodes: LabNodeDTO[], edges: LabEdgeDTO[]) {
  const topicIds = nodes.filter((node) => node.type === 'topic').map((node) => node.id);
  const neighbors = new Map<string, Set<string>>();

  const addNeighbor = (from: string, to: string) => {
    const set = neighbors.get(from);
    if (set) {
      set.add(to);
    } else {
      neighbors.set(from, new Set([to]));
    }
  };

  for (const edge of edges) {
    addNeighbor(edge.source, edge.target);
    addNeighbor(edge.target, edge.source);
  }

  const clusterByNode = new Map<string, string>();

  for (const node of nodes) {
    if (node.type === 'topic') {
      clusterByNode.set(node.id, node.id);
      continue;
    }

    const near = neighbors.get(node.id);
    if (!near) {
      continue;
    }

    for (const next of near) {
      if (topicIds.includes(next)) {
        clusterByNode.set(node.id, next);
        break;
      }
    }
  }

  for (let i = 0; i < 3; i += 1) {
    for (const node of nodes) {
      if (clusterByNode.has(node.id)) {
        continue;
      }

      const near = neighbors.get(node.id);
      if (!near) {
        continue;
      }

      let selected: string | null = null;
      for (const next of near) {
        const cluster = clusterByNode.get(next);
        if (cluster) {
          selected = cluster;
          break;
        }
      }

      if (selected) {
        clusterByNode.set(node.id, selected);
      }
    }
  }

  const fallbackClusters = topicIds.length > 0 ? topicIds : ['cluster-0'];

  for (const node of nodes) {
    if (!clusterByNode.has(node.id)) {
      clusterByNode.set(node.id, fallbackClusters[hashString(node.id) % fallbackClusters.length]);
    }
  }

  return clusterByNode;
}

function buildGraphNodes(nodes: LabNodeDTO[], edges: LabEdgeDTO[]): SimNode[] {
  const random = seededRandom(Math.max(41, nodes.length * 67));
  const clusterByNode = buildClusterAssignments(nodes, edges);
  const uniqueClusters = Array.from(new Set(clusterByNode.values()));

  const clusterCenter = new Map<string, { x: number; z: number }>();

  for (let i = 0; i < uniqueClusters.length; i += 1) {
    const clusterId = uniqueClusters[i];
    const arm = i % 2;
    const armIndex = Math.floor(i / 2);
    const radius = 34 + armIndex * 26;
    const theta = arm * Math.PI + radius * 0.085 + random() * 0.45;

    clusterCenter.set(clusterId, {
      x: Math.cos(theta) * radius,
      z: Math.sin(theta) * radius,
    });
  }

  const localIndex = new Map<string, number>();

  return nodes.map((node) => {
    const nodeRandom = seededRandom(hashString(node.id) + 19);
    const clusterId = clusterByNode.get(node.id) ?? uniqueClusters[0] ?? 'cluster-0';
    const center = clusterCenter.get(clusterId) ?? { x: 0, z: 0 };
    const index = localIndex.get(clusterId) ?? 0;
    localIndex.set(clusterId, index + 1);

    const baseAngle = index * 2.399963229728653 + nodeRandom() * 0.8;

    let anchorX = center.x;
    let anchorZ = center.z;
    let layerY = (nodeRandom() - 0.5) * 2;

    if (node.type === 'paper') {
      const localRadius = 2.4 + Math.sqrt(index + 1) * 1.2 + nodeRandom() * 1.4;
      anchorX += Math.cos(baseAngle) * localRadius;
      anchorZ += Math.sin(baseAngle) * localRadius;
      layerY = (nodeRandom() - 0.5) * 3.2;
    } else {
      const localRadius = 1.4 + Math.sqrt(index + 1) * 0.8;
      anchorX += Math.cos(baseAngle) * localRadius;
      anchorZ += Math.sin(baseAngle) * localRadius;
      layerY = (nodeRandom() - 0.5) * 4.2;
    }

    const size = NODE_BASE_SIZE[node.type] ?? 7;

    return {
      ...node,
      x: anchorX,
      y: anchorZ,
      anchorX,
      anchorZ,
      layerY,
      z: 0,
      baseX: anchorX,
      baseY: layerY,
      baseZ: anchorZ,
      vx: 0,
      vy: 0,
      phase: random() * Math.PI * 2,
      size,
    };
  });
}

const NODE_VERTEX_SHADER = `
attribute float aSize;
attribute float aAlpha;
attribute float aPhase;

varying vec3 vColor;
varying float vAlpha;

uniform float uTime;
uniform float uPixelRatio;

void main() {
  vColor = color;
  float pulse = 0.82 + 0.18 * sin(uTime * 1.2 + aPhase);
  vAlpha = aAlpha * pulse;

  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float depth = max(24.0, -mvPosition.z);
  gl_PointSize = aSize * (210.0 / depth) * uPixelRatio;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const NODE_FRAGMENT_SHADER = `
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float dist = length(uv);

  float core = smoothstep(0.29, 0.0, dist);
  float halo = smoothstep(0.67, 0.0, dist) * 0.56;
  float spikes = max(0.0, 1.0 - abs(uv.x * uv.y) * 28.0) * 0.16;
  float alpha = (core + halo + spikes) * vAlpha;

  if (alpha < 0.01) {
    discard;
  }

  gl_FragColor = vec4(vColor, alpha);
}
`;

function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

export function KnowledgeGraph({ nodes, edges, focusNodeId, focusNodeIds = [], className, onNodeClick }: KnowledgeGraphProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const focusRef = useRef<string | null>(focusNodeId ?? null);
  const focusIdsRef = useRef<string[]>([]);
  const onNodeClickRef = useRef<typeof onNodeClick>(onNodeClick);

  useEffect(() => {
    focusRef.current = focusNodeId ?? null;
  }, [focusNodeId]);

  useEffect(() => {
    focusIdsRef.current = focusNodeIds;
  }, [focusNodeIds]);

  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);

  const hasData = nodes.length > 0;
  const stableNodes = useMemo(() => nodes, [nodes]);
  const stableEdges = useMemo(() => edges, [edges]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount || !hasData) {
      return;
    }

    const width = mount.clientWidth || 960;
    const height = mount.clientHeight || 640;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x01040a, 0.00045);

    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 2800);

    const initialTarget = new THREE.Vector3(0, 0, 0);
    const viewDirection = new THREE.Vector3(0.08, 0.38, 1).normalize();
    const initialDistance = 300;
    camera.position.copy(initialTarget).add(viewDirection.clone().multiplyScalar(initialDistance));

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0x9dc8ff, 0.6);
    scene.add(ambient);

    const keyLight = new THREE.PointLight(0xcbdfff, 1.05, 1600, 1.8);
    keyLight.position.set(180, 120, 130);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0x9d8dff, 0.34, 1000, 1.8);
    fillLight.position.set(-210, -80, -170);
    scene.add(fillLight);

    const graphGroup = new THREE.Group();
    scene.add(graphGroup);

    const starTexture = createStarTexture();

    const simNodes = buildGraphNodes(stableNodes, stableEdges);
    const simLinks = buildGraphLinks(stableEdges);

    const simulation = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((link) => {
            if (link.type === 'cites') return 14;
            if (link.type === 'authored_by') return 18;
            return 16;
          })
          .strength(0.045)
      )
      .force('charge', d3.forceManyBody<SimNode>().strength(-7).distanceMax(80))
      .force('x', d3.forceX<SimNode>((node) => node.anchorX).strength(0.11))
      .force('y', d3.forceY<SimNode>((node) => node.anchorZ).strength(0.11))
      .force(
        'collide',
        d3
          .forceCollide<SimNode>()
          .radius((node) => (node.type === 'paper' ? 1.8 : 2.2))
          .strength(0.36)
      )
      .velocityDecay(0.4)
      .alphaDecay(0.035);

    simulation.stop();
    for (let i = 0; i < 240; i += 1) {
      simulation.tick();
    }

    for (const node of simNodes) {
      node.baseX = node.x ?? node.anchorX;
      node.baseZ = node.y ?? node.anchorZ;
      node.baseY = node.layerY;
    }

    const nodePositions = new Float32Array(simNodes.length * 3);
    const renderPositions = new Float32Array(simNodes.length * 3);
    const nodeColorAttr = new Float32Array(simNodes.length * 3);
    const nodeSizes = new Float32Array(simNodes.length);
    const nodeTargetSizes = new Float32Array(simNodes.length);
    const nodeBaseSizes = new Float32Array(simNodes.length);
    const nodeAlphas = new Float32Array(simNodes.length);
    const nodeTargetAlphas = new Float32Array(simNodes.length);
    const nodePhases = new Float32Array(simNodes.length);
    const nodeById = new Map<string, { node: SimNode; index: number }>();

    for (let i = 0; i < simNodes.length; i += 1) {
      const node = simNodes[i];
      const i3 = i * 3;

      const colorHex =
        node.type === 'paper'
          ? PAPER_COLOR_PALETTE[hashString(node.id) % PAPER_COLOR_PALETTE.length]
          : NODE_COLOR_MAP[node.type] ?? '#9ca3af';
      const color = new THREE.Color(colorHex);

      nodePositions[i3] = node.baseX;
      nodePositions[i3 + 1] = node.baseY;
      nodePositions[i3 + 2] = node.baseZ;
      renderPositions[i3] = node.baseX;
      renderPositions[i3 + 1] = node.baseY;
      renderPositions[i3 + 2] = node.baseZ;

      nodeColorAttr[i3] = color.r;
      nodeColorAttr[i3 + 1] = color.g;
      nodeColorAttr[i3 + 2] = color.b;

      const baseSize = NODE_BASE_SIZE[node.type] ?? 7;
      const baseAlpha = NODE_BASE_ALPHA[node.type] ?? 0.3;
      nodeSizes[i] = baseSize;
      nodeTargetSizes[i] = baseSize;
      nodeBaseSizes[i] = baseSize;
      nodeAlphas[i] = baseAlpha;
      nodeTargetAlphas[i] = baseAlpha;
      nodePhases[i] = node.phase;

      nodeById.set(node.id, { node, index: i });
    }

    const nodeGeometry = new THREE.BufferGeometry();
    nodeGeometry.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));
    nodeGeometry.setAttribute('color', new THREE.BufferAttribute(nodeColorAttr, 3));
    nodeGeometry.setAttribute('aSize', new THREE.BufferAttribute(nodeSizes, 1));
    nodeGeometry.setAttribute('aAlpha', new THREE.BufferAttribute(nodeAlphas, 1));
    nodeGeometry.setAttribute('aPhase', new THREE.BufferAttribute(nodePhases, 1));

    const nodeMaterial = new THREE.ShaderMaterial({
      vertexShader: NODE_VERTEX_SHADER,
      fragmentShader: NODE_FRAGMENT_SHADER,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
    });

    const nodePoints = new THREE.Points(nodeGeometry, nodeMaterial);
    nodePoints.frustumCulled = false;
    graphGroup.add(nodePoints);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.11;
    controls.enableRotate = false;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.zoomSpeed = 0.75;
    controls.minDistance = 62;
    controls.maxDistance = 680;
    controls.target.copy(initialTarget);

    const pointer = new THREE.Vector2(0, 0);
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 8 };

    const desiredTarget = new THREE.Vector3(0, 0, 0);
    const desiredCamera = camera.position.clone();

    const navState = {
      active: false,
      progress: 1,
      duration: 0.95,
      startTarget: new THREE.Vector3(),
      endTarget: new THREE.Vector3(),
      startCamera: new THREE.Vector3(),
      endCamera: new THREE.Vector3(),
    };

    let activeFocusSignature = '';

    const applyFocusVisual = (nextIndexes: number[]) => {
      if (nextIndexes.length === 0) {
        for (let i = 0; i < simNodes.length; i += 1) {
          nodeTargetSizes[i] = nodeBaseSizes[i];
          nodeTargetAlphas[i] = NODE_BASE_ALPHA[simNodes[i].type] ?? 0.3;
        }
        return;
      }

      const focusSet = new Set(nextIndexes);
      for (let i = 0; i < simNodes.length; i += 1) {
        if (focusSet.has(i)) {
          nodeTargetSizes[i] = nodeBaseSizes[i] * 2.2;
          nodeTargetAlphas[i] = 1;
        } else {
          nodeTargetSizes[i] = nodeBaseSizes[i] * 0.34;
          nodeTargetAlphas[i] = 0.06;
        }
      }
    };

    const startNavigation = (target: THREE.Vector3, cameraPosition: THREE.Vector3) => {
      navState.active = true;
      navState.progress = 0;
      navState.startTarget.copy(controls.target);
      navState.endTarget.copy(target);
      navState.startCamera.copy(camera.position);
      navState.endCamera.copy(cameraPosition);

      desiredTarget.copy(target);
      desiredCamera.copy(cameraPosition);
    };

    const applyFocus = (targetIds: string[]) => {
      if (targetIds.length === 0) {
        const resetTarget = new THREE.Vector3(0, 0, 0);
        const resetCamera = resetTarget.clone().add(viewDirection.clone().multiplyScalar(initialDistance));
        startNavigation(resetTarget, resetCamera);
        activeFocusSignature = '';
        applyFocusVisual([]);
        return;
      }

      const entries = targetIds
        .map((targetId) => nodeById.get(targetId))
        .filter((entry): entry is { node: SimNode; index: number } => Boolean(entry));

      if (entries.length === 0) {
        return;
      }

      const centroid = new THREE.Vector3(0, 0, 0);
      for (const entry of entries) {
        centroid.x += entry.node.baseX;
        centroid.y += entry.node.baseY;
        centroid.z += entry.node.baseZ;
      }
      centroid.divideScalar(entries.length);

      let spread = 0;
      for (const entry of entries) {
        const dx = entry.node.baseX - centroid.x;
        const dy = entry.node.baseY - centroid.y;
        const dz = entry.node.baseZ - centroid.z;
        spread = Math.max(spread, Math.sqrt(dx * dx + dy * dy + dz * dz));
      }

      const distance = THREE.MathUtils.clamp(90 + spread * 2.4, 95, 320);
      const focusedCamera = centroid.clone().add(viewDirection.clone().multiplyScalar(distance));

      startNavigation(centroid, focusedCamera);
      activeFocusSignature = targetIds.join('|');
      applyFocusVisual(entries.map((entry) => entry.index));
    };

    const onClick = () => {
      raycaster.setFromCamera(pointer, camera);
      const intersections = raycaster.intersectObject(nodePoints, false);
      const firstHit = intersections[0];
      if (!firstHit) {
        return;
      }

      const index = firstHit.index;
      if (index === undefined) {
        return;
      }

      const node = simNodes[index];
      focusRef.current = node.id;
      focusIdsRef.current = [node.id];
      applyFocus([node.id]);
      onNodeClickRef.current?.(node);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerLeave = () => {
      pointer.set(-10, -10);
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);
    renderer.domElement.addEventListener('click', onClick);

    const onResize = () => {
      const nextWidth = mount.clientWidth || 960;
      const nextHeight = mount.clientHeight || 640;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      nodeMaterial.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    };

    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let rafId = 0;

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const delta = Math.min(0.05, clock.getDelta());

      for (let i = 0; i < simNodes.length; i += 1) {
        const node = simNodes[i];
        const i3 = i * 3;

        const subtleY = node.baseY + Math.sin(elapsed * 0.2 + node.phase) * 0.2;
        renderPositions[i3] += (node.baseX - renderPositions[i3]) * 0.1;
        renderPositions[i3 + 1] += (subtleY - renderPositions[i3 + 1]) * 0.1;
        renderPositions[i3 + 2] += (node.baseZ - renderPositions[i3 + 2]) * 0.1;

        nodePositions[i3] = renderPositions[i3];
        nodePositions[i3 + 1] = renderPositions[i3 + 1];
        nodePositions[i3 + 2] = renderPositions[i3 + 2];

        nodeSizes[i] += (nodeTargetSizes[i] - nodeSizes[i]) * 0.16;
        nodeAlphas[i] += (nodeTargetAlphas[i] - nodeAlphas[i]) * 0.15;
      }

      (nodeGeometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (nodeGeometry.getAttribute('aSize') as THREE.BufferAttribute).needsUpdate = true;
      (nodeGeometry.getAttribute('aAlpha') as THREE.BufferAttribute).needsUpdate = true;
      nodeMaterial.uniforms.uTime.value = elapsed;

      const requestedFocusIds =
        focusIdsRef.current.length > 0 ? focusIdsRef.current : focusRef.current ? [focusRef.current] : [];
      const requestedSignature = requestedFocusIds.join('|');
      if (requestedSignature !== activeFocusSignature) {
        applyFocus(requestedFocusIds);
      }

      if (navState.active) {
        navState.progress = Math.min(1, navState.progress + delta / navState.duration);
        const t = smoothstep(navState.progress);

        controls.target.lerpVectors(navState.startTarget, navState.endTarget, t);
        camera.position.lerpVectors(navState.startCamera, navState.endCamera, t);

        if (navState.progress >= 1) {
          navState.active = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('click', onClick);

      controls.dispose();
      simulation.stop();

      nodeGeometry.dispose();
      nodeMaterial.dispose();
      starTexture.dispose();
      renderer.dispose();

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [hasData, stableEdges, stableNodes]);

  if (!hasData) {
    return (
      <div className="flex h-full min-h-[520px] items-center justify-center rounded-2xl border border-cyan-200/15 bg-slate-950/55 text-sm text-slate-300/75">
        Waiting for graph data...
      </div>
    );
  }

  return <div ref={mountRef} className={className ?? 'h-full min-h-[560px] w-full rounded-2xl'} />;
}
