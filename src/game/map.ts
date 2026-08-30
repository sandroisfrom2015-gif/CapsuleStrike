import * as THREE from 'three';
import type { MapId } from './types';

export interface BombSite {
  id: string;
  name: string;
  center: THREE.Vector3;
  radius: number;
}

export interface MapDef {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  spawnCT: THREE.Vector3[];
  spawnT: THREE.Vector3[];
  ffaSpawns: THREE.Vector3[];
  cover: { pos: THREE.Vector3; size: THREE.Vector3 }[];
  walls: { pos: THREE.Vector3; size: THREE.Vector3 }[];
  targets: THREE.Vector3[];
  bombSites: BombSite[];
}

function makeSky(scene: THREE.Scene, top: number, mid: number, bot: number) {
  const geo = new THREE.SphereGeometry(250, 32, 16);
  const sunDir = new THREE.Vector3(0.5, 0.35, 0.3).normalize();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(top) },
      midColor: { value: new THREE.Color(mid) },
      botColor: { value: new THREE.Color(bot) },
      sunDir: { value: sunDir },
      sunColor: { value: new THREE.Color(0xfff5d0) },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormal = normalize(position);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 botColor;
      uniform vec3 sunDir;
      uniform vec3 sunColor;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      void main() {
        vec3 dir = normalize(vWorldPos);
        float h = dir.y;
        vec3 col;
        if (h > 0.0) {
          col = mix(midColor, topColor, smoothstep(0.0, 0.55, h));
        } else {
          col = mix(midColor, botColor, smoothstep(0.0, -0.4, h));
        }
        // Sun glow
        float sunDot = max(dot(dir, sunDir), 0.0);
        float sunDisc = smoothstep(0.995, 0.999, sunDot);
        float sunGlow = pow(sunDot, 80.0) * 0.5;
        col += sunColor * sunDisc;
        col += sunColor * sunGlow * 0.3;
        // Horizon haze
        float horizon = 1.0 - abs(h);
        col = mix(col, midColor * 1.3, horizon * 0.25);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(geo, mat);
  scene.add(sky);
}

function addLighting(scene: THREE.Scene, fogColor: number, sunColor: number, sunPos: THREE.Vector3) {
  const ambient = new THREE.AmbientLight(0x7090b0, 0.55);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(0x90b0f0, 0x604535, 0.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(sunColor, 1.6);
  sun.position.copy(sunPos);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45;
  sun.shadow.camera.bottom = -45;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x4060a0, 0.7);
  rim.position.set(-25, 30, -20);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0x80a0c0, 0.35);
  fill.position.set(10, 20, 30);
  scene.add(fill);
  scene.fog = new THREE.Fog(fogColor, 60, 130);
}

function makeFloor(scene: THREE.Scene, size: number, color: number) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.05 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const grid = new THREE.GridHelper(size, size / 2, 0x4a5276, 0x2a3045);
  (grid.material as THREE.Material).opacity = 0.25;
  (grid.material as THREE.Material).transparent = true;
  grid.position.y = 0.01;
  scene.add(grid);
}

function makeBox(pos: THREE.Vector3, size: THREE.Vector3, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), mat);
  m.position.copy(pos);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function markBombSite(scene: THREE.Scene, site: BombSite, color: number) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(site.radius * 0.8, site.radius, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(site.center);
  ring.position.y = 0.02;
  scene.add(ring);
}

// ---------- DUST ----------
function buildDustMap(scene: THREE.Scene): MapDef {
  makeFloor(scene, 120, 0x3a4256);
  makeSky(scene, 0x1a3a6b, 0x3d6ba0, 0xa08050);
  addLighting(scene, 0x3d6ba0, 0xffe8c0, new THREE.Vector3(40, 55, 25));

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x525a72, roughness: 0.9 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.8 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.6, metalness: 0.4 });
  const platMat = new THREE.MeshStandardMaterial({ color: 0x6a7290, roughness: 0.85 });
  const wallH = 10, wallT = 1.5, half = 58;

  const outerWalls = [
    { pos: new THREE.Vector3(0, wallH / 2, -half), size: new THREE.Vector3(120, wallH, wallT) },
    { pos: new THREE.Vector3(0, wallH / 2, half), size: new THREE.Vector3(120, wallH, wallT) },
    { pos: new THREE.Vector3(-half, wallH / 2, 0), size: new THREE.Vector3(wallT, wallH, 120) },
    { pos: new THREE.Vector3(half, wallH / 2, 0), size: new THREE.Vector3(wallT, wallH, 120) },
  ];
  outerWalls.forEach((w) => scene.add(makeBox(w.pos, w.size, wallMat)));

  // Mid-map divider wall with gaps — blocks direct spawn-to-spawn sightline
  const midWalls: { pos: THREE.Vector3; size: THREE.Vector3 }[] = [
    { pos: new THREE.Vector3(-30, 4, 0), size: new THREE.Vector3(1, 8, 30) },
    { pos: new THREE.Vector3(30, 4, 0), size: new THREE.Vector3(1, 8, 30) },
    { pos: new THREE.Vector3(-8, 4, 0), size: new THREE.Vector3(1, 8, 16) },
    { pos: new THREE.Vector3(8, 4, 0), size: new THREE.Vector3(1, 8, 16) },
  ];
  midWalls.forEach((w) => scene.add(makeBox(w.pos, w.size, wallMat)));

  // Interior walls — labyrinth of cover
  const interiorWalls: { pos: THREE.Vector3; size: THREE.Vector3 }[] = [
    { pos: new THREE.Vector3(-20, 3, -20), size: new THREE.Vector3(14, 6, 1) },
    { pos: new THREE.Vector3(20, 3, 20), size: new THREE.Vector3(14, 6, 1) },
    { pos: new THREE.Vector3(-20, 3, 20), size: new THREE.Vector3(1, 6, 14) },
    { pos: new THREE.Vector3(20, 3, -20), size: new THREE.Vector3(1, 6, 14) },
    { pos: new THREE.Vector3(-40, 3, -15), size: new THREE.Vector3(1, 6, 18) },
    { pos: new THREE.Vector3(40, 3, 15), size: new THREE.Vector3(1, 6, 18) },
    { pos: new THREE.Vector3(-15, 3, -40), size: new THREE.Vector3(18, 6, 1) },
    { pos: new THREE.Vector3(15, 3, 40), size: new THREE.Vector3(18, 6, 1) },
    { pos: new THREE.Vector3(-45, 3, 30), size: new THREE.Vector3(16, 6, 1) },
    { pos: new THREE.Vector3(45, 3, -30), size: new THREE.Vector3(16, 6, 1) },
    { pos: new THREE.Vector3(-35, 3, -35), size: new THREE.Vector3(1, 6, 16) },
    { pos: new THREE.Vector3(35, 3, 35), size: new THREE.Vector3(1, 6, 16) },
  ];
  interiorWalls.forEach((w) => scene.add(makeBox(w.pos, w.size, wallMat)));

  const coverDefs: { pos: THREE.Vector3; size: THREE.Vector3; metal?: boolean }[] = [
    { pos: new THREE.Vector3(-12, 1.5, -5), size: new THREE.Vector3(3, 3, 3) },
    { pos: new THREE.Vector3(12, 1.5, 5), size: new THREE.Vector3(3, 3, 3), metal: true },
    { pos: new THREE.Vector3(-12, 1.5, 8), size: new THREE.Vector3(3, 3, 3) },
    { pos: new THREE.Vector3(12, 1.5, -8), size: new THREE.Vector3(3, 3, 3), metal: true },
    { pos: new THREE.Vector3(0, 1.5, 0), size: new THREE.Vector3(4, 3, 4), metal: true },
    { pos: new THREE.Vector3(-22, 1.5, 14), size: new THREE.Vector3(3, 3, 3) },
    { pos: new THREE.Vector3(22, 1.5, -14), size: new THREE.Vector3(3, 3, 3) },
    { pos: new THREE.Vector3(-22, 1.5, -14), size: new THREE.Vector3(3, 3, 3), metal: true },
    { pos: new THREE.Vector3(22, 1.5, 14), size: new THREE.Vector3(3, 3, 3), metal: true },
    { pos: new THREE.Vector3(0, 1.5, 18), size: new THREE.Vector3(3, 3, 3) },
    { pos: new THREE.Vector3(0, 1.5, -18), size: new THREE.Vector3(3, 3, 3), metal: true },
    { pos: new THREE.Vector3(-38, 1.5, -25), size: new THREE.Vector3(3, 3, 3), metal: true },
    { pos: new THREE.Vector3(38, 1.5, 25), size: new THREE.Vector3(3, 3, 3) },
    { pos: new THREE.Vector3(-38, 1.5, 25), size: new THREE.Vector3(3, 3, 3) },
    { pos: new THREE.Vector3(38, 1.5, -25), size: new THREE.Vector3(3, 3, 3), metal: true },
    { pos: new THREE.Vector3(-25, 1.5, 38), size: new THREE.Vector3(3, 3, 3), metal: true },
    { pos: new THREE.Vector3(25, 1.5, -38), size: new THREE.Vector3(3, 3, 3) },
    { pos: new THREE.Vector3(-25, 1.5, -38), size: new THREE.Vector3(3, 3, 3) },
    { pos: new THREE.Vector3(25, 1.5, 38), size: new THREE.Vector3(3, 3, 3), metal: true },
    { pos: new THREE.Vector3(-48, 1.5, 0), size: new THREE.Vector3(3, 3, 3), metal: true },
    { pos: new THREE.Vector3(48, 1.5, 0), size: new THREE.Vector3(3, 3, 3) },
    { pos: new THREE.Vector3(0, 1.5, 48), size: new THREE.Vector3(3, 3, 3), metal: true },
    { pos: new THREE.Vector3(0, 1.5, -48), size: new THREE.Vector3(3, 3, 3) },
    { pos: new THREE.Vector3(-42, 1.5, -42), size: new THREE.Vector3(4, 3, 4), metal: true },
    { pos: new THREE.Vector3(42, 1.5, 42), size: new THREE.Vector3(4, 3, 4) },
  ];
  coverDefs.forEach((c) => scene.add(makeBox(c.pos, c.size, c.metal ? metalMat : crateMat)));

  const platforms = [
    { pos: new THREE.Vector3(-40, 2, -40), size: new THREE.Vector3(8, 0.5, 8) },
    { pos: new THREE.Vector3(40, 2, 40), size: new THREE.Vector3(8, 0.5, 8) },
    { pos: new THREE.Vector3(-40, 2, 40), size: new THREE.Vector3(8, 0.5, 8) },
    { pos: new THREE.Vector3(40, 2, -40), size: new THREE.Vector3(8, 0.5, 8) },
  ];
  platforms.forEach((p) => {
    scene.add(makeBox(p.pos, p.size, platMat));
    scene.add(makeBox(new THREE.Vector3(p.pos.x, 1, p.pos.z), new THREE.Vector3(0.5, 2, 0.5), platMat));
  });

  const bombSites: BombSite[] = [
    { id: 'A', name: 'Site A', center: new THREE.Vector3(-42, 0, 42), radius: 7 },
    { id: 'B', name: 'Site B', center: new THREE.Vector3(42, 0, -42), radius: 7 },
  ];
  bombSites.forEach((s) => markBombSite(scene, s, 0xff4444));

  // Remove cover objects near bomb sites for cleaner plant/defuse area
  const isNearBombSite = (pos: THREE.Vector3): boolean => {
    for (const s of bombSites) {
      if (pos.distanceTo(s.center) < s.radius + 2) return true;
    }
    return false;
  };
  const filteredCover = coverDefs.filter((c) => !isNearBombSite(c.pos));
  filteredCover.forEach((c) => scene.add(makeBox(c.pos, c.size, c.metal ? metalMat : crateMat)));
  const filteredPlatforms = platforms.filter((p) => !isNearBombSite(p.pos));
  filteredPlatforms.forEach((p) => {
    scene.add(makeBox(p.pos, p.size, platMat));
    scene.add(makeBox(new THREE.Vector3(p.pos.x, 1, p.pos.z), new THREE.Vector3(0.5, 2, 0.5), platMat));
  });

  return {
    bounds: { minX: -56, maxX: 56, minZ: -56, maxZ: 56 },
    spawnCT: [new THREE.Vector3(-50, 1, -50), new THREE.Vector3(-46, 1, -50), new THREE.Vector3(-50, 1, -46), new THREE.Vector3(-54, 1, -50), new THREE.Vector3(-50, 1, -54)],
    spawnT: [new THREE.Vector3(50, 1, 50), new THREE.Vector3(46, 1, 50), new THREE.Vector3(50, 1, 46), new THREE.Vector3(54, 1, 50), new THREE.Vector3(50, 1, 54)],
    ffaSpawns: [
      new THREE.Vector3(-50, 1, -50), new THREE.Vector3(50, 1, 50), new THREE.Vector3(-50, 1, 50),
      new THREE.Vector3(50, 1, -50), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-30, 1, 30),
      new THREE.Vector3(30, 1, -30), new THREE.Vector3(0, 1, 40), new THREE.Vector3(0, 1, -40),
      new THREE.Vector3(-40, 1, 0), new THREE.Vector3(40, 1, 0),
    ],
    cover: filteredCover,
    walls: [...outerWalls, ...midWalls, ...interiorWalls, ...filteredCover, ...filteredPlatforms],
    targets: [],
    bombSites,
  };
}

// ---------- MIRAGE ----------
function buildMirageMap(scene: THREE.Scene): MapDef {
  makeFloor(scene, 80, 0x4a4030);
  makeSky(scene, 0x2a4a3a, 0x5a8a6a, 0x8a7a50);
  addLighting(scene, 0x5a8a6a, 0xfff0c0, new THREE.Vector3(-20, 45, 30));

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.9 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 0.85 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x5a5a52, roughness: 0.6, metalness: 0.4 });
  const platMat = new THREE.MeshStandardMaterial({ color: 0x7a6a4a, roughness: 0.85 });
  const wallH = 8, wallT = 1, half = 40;

  const outerWalls = [
    { pos: new THREE.Vector3(0, wallH / 2, -half), size: new THREE.Vector3(80, wallH, wallT) },
    { pos: new THREE.Vector3(0, wallH / 2, half), size: new THREE.Vector3(80, wallH, wallT) },
    { pos: new THREE.Vector3(-half, wallH / 2, 0), size: new THREE.Vector3(wallT, wallH, 80) },
    { pos: new THREE.Vector3(half, wallH / 2, 0), size: new THREE.Vector3(wallT, wallH, 80) },
  ];
  outerWalls.forEach((w) => scene.add(makeBox(w.pos, w.size, wallMat)));

  // Central building with corridors
  const buildingWalls: { pos: THREE.Vector3; size: THREE.Vector3 }[] = [
    { pos: new THREE.Vector3(-8, 3, -8), size: new THREE.Vector3(1, 6, 12) },
    { pos: new THREE.Vector3(8, 3, 8), size: new THREE.Vector3(1, 6, 12) },
    { pos: new THREE.Vector3(-8, 3, 8), size: new THREE.Vector3(12, 6, 1) },
    { pos: new THREE.Vector3(8, 3, -8), size: new THREE.Vector3(12, 6, 1) },
    { pos: new THREE.Vector3(0, 6, 0), size: new THREE.Vector3(16, 0.5, 16) },
  ];
  buildingWalls.forEach((w) => scene.add(makeBox(w.pos, w.size, wallMat)));

  // Extra interior walls
  const interiorWalls: { pos: THREE.Vector3; size: THREE.Vector3 }[] = [
    { pos: new THREE.Vector3(-25, 3, -10), size: new THREE.Vector3(1, 6, 10) },
    { pos: new THREE.Vector3(25, 3, 10), size: new THREE.Vector3(1, 6, 10) },
    { pos: new THREE.Vector3(-10, 3, -25), size: new THREE.Vector3(10, 6, 1) },
    { pos: new THREE.Vector3(10, 3, 25), size: new THREE.Vector3(10, 6, 1) },
  ];
  interiorWalls.forEach((w) => scene.add(makeBox(w.pos, w.size, wallMat)));

  const coverDefs: { pos: THREE.Vector3; size: THREE.Vector3; metal?: boolean }[] = [
    { pos: new THREE.Vector3(-20, 1.5, 0), size: new THREE.Vector3(3, 3, 3) },
    { pos: new THREE.Vector3(20, 1.5, 0), size: new THREE.Vector3(3, 3, 3), metal: true },
    { pos: new THREE.Vector3(0, 1.5, -20), size: new THREE.Vector3(3, 3, 3) },
    { pos: new THREE.Vector3(0, 1.5, 20), size: new THREE.Vector3(3, 3, 3), metal: true },
    { pos: new THREE.Vector3(-25, 1.5, -20), size: new THREE.Vector3(3, 3, 3), metal: true },
    { pos: new THREE.Vector3(25, 1.5, 20), size: new THREE.Vector3(3, 3, 3) },
    { pos: new THREE.Vector3(-25, 1.5, 20), size: new THREE.Vector3(3, 3, 3) },
    { pos: new THREE.Vector3(25, 1.5, -20), size: new THREE.Vector3(3, 3, 3), metal: true },
  ];
  coverDefs.forEach((c) => scene.add(makeBox(c.pos, c.size, c.metal ? metalMat : crateMat)));

  const platforms = [
    { pos: new THREE.Vector3(-30, 2.5, 0), size: new THREE.Vector3(6, 0.5, 10) },
    { pos: new THREE.Vector3(30, 2.5, 0), size: new THREE.Vector3(6, 0.5, 10) },
  ];
  platforms.forEach((p) => {
    scene.add(makeBox(p.pos, p.size, platMat));
    scene.add(makeBox(new THREE.Vector3(p.pos.x, 1.25, p.pos.z), new THREE.Vector3(0.5, 2.5, 0.5), platMat));
  });

  const bombSites: BombSite[] = [
    { id: 'A', name: 'Site A', center: new THREE.Vector3(-28, 0, -28), radius: 6 },
    { id: 'B', name: 'Site B', center: new THREE.Vector3(28, 0, 28), radius: 6 },
  ];
  bombSites.forEach((s) => markBombSite(scene, s, 0xff4444));

  return {
    bounds: { minX: -39, maxX: 39, minZ: -39, maxZ: 39 },
    spawnCT: [new THREE.Vector3(-36, 1, -36), new THREE.Vector3(-33, 1, -36), new THREE.Vector3(-36, 1, -33), new THREE.Vector3(-38, 1, -36), new THREE.Vector3(-36, 1, -38)],
    spawnT: [new THREE.Vector3(36, 1, 36), new THREE.Vector3(33, 1, 36), new THREE.Vector3(36, 1, 33), new THREE.Vector3(38, 1, 36), new THREE.Vector3(36, 1, 38)],
    ffaSpawns: [
      new THREE.Vector3(-36, 1, -36), new THREE.Vector3(36, 1, 36), new THREE.Vector3(-36, 1, 36),
      new THREE.Vector3(36, 1, -36), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-20, 1, 20),
      new THREE.Vector3(20, 1, -20), new THREE.Vector3(0, 1, 25), new THREE.Vector3(0, 1, -25),
    ],
    cover: coverDefs,
    walls: [...outerWalls, ...buildingWalls, ...interiorWalls, ...coverDefs, ...platforms],
    targets: [],
    bombSites,
  };
}

// ---------- NUKE ----------
function buildNukeMap(scene: THREE.Scene): MapDef {
  makeFloor(scene, 80, 0x3a3a3a);
  makeSky(scene, 0x1a2a3a, 0x3a5a7a, 0x5a5a5a);
  addLighting(scene, 0x3a5a7a, 0xc0e0ff, new THREE.Vector3(15, 50, -25));

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x6a6a6a, roughness: 0.85 });
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x4a4a3a, roughness: 0.8 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x5a6a6a, roughness: 0.5, metalness: 0.5 });
  const platMat = new THREE.MeshStandardMaterial({ color: 0x4a5a5a, roughness: 0.7, metalness: 0.3 });
  const wallH = 8, wallT = 1, half = 40;

  const outerWalls = [
    { pos: new THREE.Vector3(0, wallH / 2, -half), size: new THREE.Vector3(80, wallH, wallT) },
    { pos: new THREE.Vector3(0, wallH / 2, half), size: new THREE.Vector3(80, wallH, wallT) },
    { pos: new THREE.Vector3(-half, wallH / 2, 0), size: new THREE.Vector3(wallT, wallH, 80) },
    { pos: new THREE.Vector3(half, wallH / 2, 0), size: new THREE.Vector3(wallT, wallH, 80) },
  ];
  outerWalls.forEach((w) => scene.add(makeBox(w.pos, w.size, wallMat)));

  // Central tower (the "nuke" silo)
  const siloWalls: { pos: THREE.Vector3; size: THREE.Vector3 }[] = [
    { pos: new THREE.Vector3(-6, 5, -6), size: new THREE.Vector3(1, 10, 12) },
    { pos: new THREE.Vector3(6, 5, 6), size: new THREE.Vector3(1, 10, 12) },
    { pos: new THREE.Vector3(-6, 5, 6), size: new THREE.Vector3(12, 10, 1) },
    { pos: new THREE.Vector3(6, 5, -6), size: new THREE.Vector3(12, 10, 1) },
    { pos: new THREE.Vector3(0, 10, 0), size: new THREE.Vector3(12, 0.5, 12) },
  ];
  siloWalls.forEach((w) => scene.add(makeBox(w.pos, w.size, metalMat)));

  // Extra interior walls
  const interiorWalls: { pos: THREE.Vector3; size: THREE.Vector3 }[] = [
    { pos: new THREE.Vector3(-20, 3, -10), size: new THREE.Vector3(1, 6, 14) },
    { pos: new THREE.Vector3(20, 3, 10), size: new THREE.Vector3(1, 6, 14) },
    { pos: new THREE.Vector3(-10, 3, -20), size: new THREE.Vector3(14, 6, 1) },
    { pos: new THREE.Vector3(10, 3, 20), size: new THREE.Vector3(14, 6, 1) },
  ];
  interiorWalls.forEach((w) => scene.add(makeBox(w.pos, w.size, wallMat)));

  const coverDefs: { pos: THREE.Vector3; size: THREE.Vector3; metal?: boolean }[] = [
    { pos: new THREE.Vector3(-18, 1.5, 0), size: new THREE.Vector3(3, 3, 3), metal: true },
    { pos: new THREE.Vector3(18, 1.5, 0), size: new THREE.Vector3(3, 3, 3), metal: true },
    { pos: new THREE.Vector3(0, 1.5, -22), size: new THREE.Vector3(3, 3, 3) },
    { pos: new THREE.Vector3(0, 1.5, 22), size: new THREE.Vector3(3, 3, 3) },
    { pos: new THREE.Vector3(-22, 1.5, -22), size: new THREE.Vector3(3, 3, 3) },
    { pos: new THREE.Vector3(22, 1.5, 22), size: new THREE.Vector3(3, 3, 3), metal: true },
    { pos: new THREE.Vector3(-22, 1.5, 22), size: new THREE.Vector3(3, 3, 3), metal: true },
    { pos: new THREE.Vector3(22, 1.5, -22), size: new THREE.Vector3(3, 3, 3) },
  ];
  coverDefs.forEach((c) => scene.add(makeBox(c.pos, c.size, c.metal ? metalMat : crateMat)));

  // Multi-level platforms for vertical play
  const platforms = [
    { pos: new THREE.Vector3(-28, 3, -28), size: new THREE.Vector3(8, 0.5, 8) },
    { pos: new THREE.Vector3(28, 3, 28), size: new THREE.Vector3(8, 0.5, 8) },
    { pos: new THREE.Vector3(-28, 6, -28), size: new THREE.Vector3(6, 0.5, 6) },
    { pos: new THREE.Vector3(28, 6, 28), size: new THREE.Vector3(6, 0.5, 6) },
    { pos: new THREE.Vector3(0, 4, -28), size: new THREE.Vector3(8, 0.5, 4) },
    { pos: new THREE.Vector3(0, 4, 28), size: new THREE.Vector3(8, 0.5, 4) },
  ];
  platforms.forEach((p) => {
    scene.add(makeBox(p.pos, p.size, platMat));
    scene.add(makeBox(new THREE.Vector3(p.pos.x, p.pos.y / 2, p.pos.z), new THREE.Vector3(0.5, p.pos.y, 0.5), platMat));
  });

  const bombSites: BombSite[] = [
    { id: 'A', name: 'Site A', center: new THREE.Vector3(-28, 0, -28), radius: 6 },
    { id: 'B', name: 'Site B', center: new THREE.Vector3(28, 0, 28), radius: 6 },
  ];
  bombSites.forEach((s) => markBombSite(scene, s, 0xff4444));

  return {
    bounds: { minX: -39, maxX: 39, minZ: -39, maxZ: 39 },
    spawnCT: [new THREE.Vector3(-36, 1, -36), new THREE.Vector3(-33, 1, -36), new THREE.Vector3(-36, 1, -33), new THREE.Vector3(-38, 1, -36), new THREE.Vector3(-36, 1, -38)],
    spawnT: [new THREE.Vector3(36, 1, 36), new THREE.Vector3(33, 1, 36), new THREE.Vector3(36, 1, 33), new THREE.Vector3(38, 1, 36), new THREE.Vector3(36, 1, 38)],
    ffaSpawns: [
      new THREE.Vector3(-36, 1, -36), new THREE.Vector3(36, 1, 36), new THREE.Vector3(-36, 1, 36),
      new THREE.Vector3(36, 1, -36), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-20, 1, 20),
      new THREE.Vector3(20, 1, -20), new THREE.Vector3(0, 1, 25), new THREE.Vector3(0, 1, -25),
    ],
    cover: coverDefs,
    walls: [...outerWalls, ...siloWalls, ...interiorWalls, ...coverDefs, ...platforms],
    targets: [],
    bombSites,
  };
}

// ---------- RANGE ----------
export function buildRangeMap(scene: THREE.Scene): MapDef {
  makeFloor(scene, 60, 0x2a3045);
  makeSky(scene, 0x1a3a6b, 0x3d6ba0, 0xa08050);
  addLighting(scene, 0x3d6ba0, 0xffe8c0, new THREE.Vector3(10, 40, 10));

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x525a72, roughness: 0.9 });
  const walls = [
    { pos: new THREE.Vector3(0, 4, 28), size: new THREE.Vector3(60, 8, 1) },
    { pos: new THREE.Vector3(0, 4, -28), size: new THREE.Vector3(60, 8, 1) },
    { pos: new THREE.Vector3(-30, 4, 0), size: new THREE.Vector3(1, 8, 60) },
    { pos: new THREE.Vector3(30, 4, 0), size: new THREE.Vector3(1, 8, 60) },
  ];
  walls.forEach((w) => scene.add(makeBox(w.pos, w.size, wallMat)));

  const targets = [
    new THREE.Vector3(0, 2, 24), new THREE.Vector3(-8, 2, 22), new THREE.Vector3(8, 2, 22),
    new THREE.Vector3(-14, 2, 20), new THREE.Vector3(14, 2, 20), new THREE.Vector3(0, 4, 24),
    new THREE.Vector3(-8, 4, 22), new THREE.Vector3(8, 4, 22), new THREE.Vector3(-14, 4, 20),
    new THREE.Vector3(14, 4, 20), new THREE.Vector3(0, 6, 24),
  ];

  return {
    bounds: { minX: -29, maxX: 29, minZ: -27, maxZ: 27 },
    spawnCT: [new THREE.Vector3(0, 1, -20)],
    spawnT: [],
    ffaSpawns: [],
    cover: [],
    walls,
    targets,
    bombSites: [],
  };
}

// ---------- DISPATCHER ----------
export function buildMap(scene: THREE.Scene, mapId: MapId = 'dust'): MapDef {
  switch (mapId) {
    case 'mirage': return buildMirageMap(scene);
    case 'nuke': return buildNukeMap(scene);
    case 'dust':
    default: return buildDustMap(scene);
  }
}
