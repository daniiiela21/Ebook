import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { clamp, lerp, seg, smooth, ease, easeOut, easeOutBack, keys, v3 } from './util.js';
import {
  C, ROOM, mat, mesh, rbox, buildRoom, makePot, setSoil, makeBasil, makeChives, makeLettuce, makeMint,
  makeStrawberry, makeTomato, makeWateringCan, makeScoop, makeScissors, makeBowl, makeTablet, makeBooklet,
  makePlate, Character,
} from './world.js';
import * as O from './overlay.js';

const W = 1080, H = 1920, FPS = 30, DUR = 18;

// ------------------------------------------------------------ timeline (s)
// Cuts sit on the music grid (85.7 BPM → half-beat = 0.35 s).
export const S = {
  s1: [0, 2.8], s2: [2.8, 5.25], s3: [5.25, 7.0], s4: [7.0, 9.8],
  s5a: [9.8, 11.35], s5b: [11.35, 12.6], s6: [12.6, 14.7], s7: [14.7, 18.0],
};
const HARVEST = { basil: 10.12, tomato: 10.63, straw: 11.16 };

// ------------------------------------------------------------ renderer
const glCanvas = document.createElement('canvas');
glCanvas.width = W; glCanvas.height = H;
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

const out = document.getElementById('out');
const ctx = out.getContext('2d');

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.bg);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const hemi = new THREE.HemisphereLight('#fff7e6', '#e9d6b2', 0.9);
scene.add(hemi);
const key = new THREE.DirectionalLight('#fff4e2', 1.55);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
Object.assign(key.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 40 });
key.shadow.radius = 7;
key.shadow.bias = -0.0006;
key.shadow.normalBias = 0.02;
scene.add(key, key.target);
const sun = new THREE.DirectionalLight('#fff0d0', 1.9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 40 });
sun.shadow.radius = 5;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

const camera = new THREE.OrthographicCamera(-W / H * 5, W / H * 5, 5, -5, 0.1, 100);

// ------------------------------------------------------------ world
buildRoom(scene);
const ch = new Character(scene);

const sillX = { lettuce: -0.45, chives: 0.05, mint: 0.55, basil: 1.1 };
function potAt(x, y, z, opts) {
  const p = makePot(opts);
  p.position.set(x, y, z);
  scene.add(p);
  return p;
}
const SZ = ROOM.sillZ, SY = ROOM.sillY;
const P = {};
P.basilPot = potAt(sillX.basil, SY, SZ, { r: 0.13, h: 0.2, color: C.terracotta });
P.basil = makeBasil(11);
scene.add(P.basil.group);
const sillDefs = [
  ['lettuce', makeLettuce(21), { r: 0.15, h: 0.18, color: C.white }],
  ['chives', makeChives(22), { r: 0.12, h: 0.2, color: C.sage }],
  ['mint', makeMint(23), { r: 0.13, h: 0.19, color: C.terracottaLight }],
];
P.sill = sillDefs.map(([k, plant, o]) => {
  const pot = potAt(sillX[k], SY, SZ, o);
  plant.group.position.set(sillX[k], SY + pot.userData.soilTop, SZ);
  scene.add(plant.group);
  return { pot, plant };
});
// shelf on the left wall
P.shelf = [
  [makeMint(31), { r: 0.1, h: 0.16, color: C.white }, -0.55],
  [makeChives(32), { r: 0.1, h: 0.16, color: C.terracotta }, 0.25],
].map(([plant, o, z]) => {
  const pot = potAt(-2.64, 2.33, z, o);
  plant.group.position.set(-2.64, 2.33 + pot.userData.soilTop, z);
  scene.add(plant.group);
  return { pot, plant };
});
// stand: strawberry trough + big tomato pot
const St = ROOM.stand;
P.trough = new THREE.Group();
const tr = rbox(0.72, 0.2, 0.28, 0.06, C.terracotta, 0.85);
tr.position.y = 0.1;
P.trough.add(tr);
const trs = rbox(0.66, 0.02, 0.22, 0.01, C.soil, 0.95);
trs.position.y = 0.19;
P.trough.add(trs);
P.trough.position.set(St.x, St.top, St.z);
scene.add(P.trough);
P.straw = [-0.22, 0, 0.22].map((dx, i) => {
  const s = makeStrawberry(41 + i);
  s.group.position.set(dx, 0.19, 0.02);
  s.group.rotation.y = i * 1.3;
  P.trough.add(s.group);
  return s;
});
P.tomatoPot = potAt(2.45, 0, -1.45, { r: 0.24, h: 0.4, color: C.terracottaLight });
P.tomato = makeTomato(51);
P.tomato.group.position.set(2.45, P.tomatoPot.userData.soilTop, -1.45);
P.tomato.group.rotation.y = 2.2;
scene.add(P.tomato.group);

// props
P.can = makeWateringCan();
scene.add(P.can);
const canRest = { pos: v3(St.x - 0.2, St.low, St.z), yaw: 0.6 };
P.scoop = makeScoop();
scene.add(P.scoop);
P.scissors = makeScissors();
scene.add(P.scissors);
P.bowl = makeBowl(0.1);
scene.add(P.bowl);
P.seedPots = [0.65, 0.95, 1.25].map((x) => potAt(x, ROOM.table.y, 0.52, { r: 0.085, h: 0.15, color: C.terracotta }));
P.dimple = mesh(new THREE.CylinderGeometry(0.025, 0.012, 0.012, 16), mat('#3e2a20', 1), { cast: false });
scene.add(P.dimple);
P.seeds = [0, 1, 2].map(() => {
  const s = mesh(new THREE.SphereGeometry(0.009, 8, 6), mat('#e8d5a8', 0.6));
  s.scale.set(1.4, 0.8, 1);
  scene.add(s);
  return s;
});
P.plate = makePlate();
P.plate.position.set(0.55, ROOM.table.y, 0.58);
scene.add(P.plate);
P.plateTop = [];
for (let i = 0; i < 3; i++) {
  const tm = mesh(new THREE.SphereGeometry(0.03, 14, 10), mat(C.tomato, 0.35));
  tm.position.set(-0.07 + i * 0.07, 0.085, (i - 1) * 0.06);
  P.plate.add(tm);
  const bl = mesh(new THREE.SphereGeometry(0.5, 12, 8), mat(C.leaf, 0.55));
  bl.scale.set(0.07, 0.012, 0.045);
  bl.position.set(-0.05 + i * 0.07, 0.078, (i - 1) * 0.06 - 0.025);
  bl.rotation.y = i;
  P.plate.add(bl);
  P.plateTop.push({ tm, bl });
}
// harvested pieces that follow the hand / sit in the bowl
P.handLeaf = [0, 1].map((i) => {
  const l = mesh(new THREE.SphereGeometry(0.5, 12, 8), mat('#72ab50', 0.55));
  l.scale.set(0.09, 0.014, 0.055);
  scene.add(l);
  return l;
});
P.handTomato = mesh(new THREE.SphereGeometry(0.048, 16, 12), mat(C.tomato, 0.35));
scene.add(P.handTomato);
P.handStraw = (() => {
  const s = makeStrawberry(99); // borrow a fruit mesh
  const f = s.fruits[0];
  s.group.remove(f);
  f.scale.setScalar(1.25);
  scene.add(f);
  return f;
})();
P.bowlItems = new THREE.Group();
P.bowl.add(P.bowlItems);
for (let i = 0; i < 3; i++) {
  const tm = mesh(new THREE.SphereGeometry(0.035, 12, 10), mat(C.tomato, 0.35));
  tm.position.set(-0.03 + i * 0.03, 0.05, (i % 2) * 0.03 - 0.01);
  P.bowlItems.add(tm);
}
for (let i = 0; i < 3; i++) {
  const l = mesh(new THREE.SphereGeometry(0.5, 12, 8), mat(C.leaf, 0.55));
  l.scale.set(0.08, 0.014, 0.05);
  l.position.set(0.02 - i * 0.02, 0.07, -0.03 + i * 0.02);
  l.rotation.y = i * 0.8;
  P.bowlItems.add(l);
}

// water / soil particles
const dropGeo = new THREE.SphereGeometry(0.012, 8, 6);
const dropMat = new THREE.MeshStandardMaterial({ color: '#a9d8ea', roughness: 0.15, emissive: '#6fb2cc', emissiveIntensity: 0.25 });
const drops = Array.from({ length: 26 }, () => { const m = new THREE.Mesh(dropGeo, dropMat); scene.add(m); return m; });
const soilGeo = new THREE.SphereGeometry(0.011, 6, 5);
const soilBits = Array.from({ length: 18 }, () => { const m = new THREE.Mesh(soilGeo, mat(C.soil, 1)); scene.add(m); return m; });

// tablet with the official cover
let coverTex = null, coverAspect = 2 / 3, coverIsPlaceholder = false;
async function loadCover() {
  const res = await fetch('/assets/capa.png', { method: 'HEAD' });
  if (res.ok) {
    coverTex = await new THREE.TextureLoader().loadAsync('/assets/capa.png');
    coverAspect = coverTex.image.width / coverTex.image.height;
  } else {
    coverIsPlaceholder = true;
    const c = document.createElement('canvas');
    c.width = 800; c.height = 1200;
    const g = c.getContext('2d');
    g.fillStyle = '#f3efe4'; g.fillRect(0, 0, 800, 1200);
    g.strokeStyle = '#c9704a'; g.lineWidth = 10; g.setLineDash([36, 22]);
    g.strokeRect(30, 30, 740, 1140);
    g.fillStyle = '#c9704a';
    g.font = '700 70px Fredoka, sans-serif';
    g.textAlign = 'center';
    g.fillText('CAPA OFICIAL', 400, 560);
    g.font = '500 44px Fredoka, sans-serif';
    g.fillText('assets/capa.png', 400, 640);
    coverTex = new THREE.CanvasTexture(c);
  }
  coverTex.colorSpace = THREE.SRGBColorSpace;
  coverTex.anisotropy = 8;
}

// ------------------------------------------------------------ helpers
const UPV = v3(0, 1, 0);
const tmp = v3();
function camDir(az, el) {
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  return v3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
}
function setCam({ target, az = 45, el = 32, zoom = 0.66 }) {
  camera.position.copy(target).add(camDir(az, el).multiplyScalar(30));
  camera.up.set(0, 1, 0);
  camera.lookAt(target);
  camera.zoom = zoom;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}
function mixCam(a, b, u) {
  return { target: a.target.clone().lerp(b.target, u), az: lerp(a.az, b.az, u), el: lerp(a.el, b.el, u), zoom: Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), u)) };
}
function project(p) {
  const q = p.clone().project(camera);
  return { x: (q.x * 0.5 + 0.5) * W, y: (-q.y * 0.5 + 0.5) * H };
}
function yawTo(from, to) { return Math.atan2(to.x - from.x, to.z - from.z); }
function localToWorld(pos, yaw, x, y, z) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return v3(pos.x + x * c + z * s, y, pos.z - x * s + z * c);
}
function holdCan(hand, yaw, tilt) {
  P.can.visible = true;
  P.can.position.copy(hand).add(v3(0, -0.2, 0));
  P.can.rotation.set(0, 0, 0);
  P.can.rotation.order = 'YXZ';
  P.can.rotation.y = yaw;
  P.can.rotation.x = tilt;
  P.can.updateMatrixWorld(true);
}
function spoutWorld() { return P.can.userData.spout.clone().applyMatrix4(P.can.matrixWorld); }
function waterFrom(t, origin, dir, amount) {
  drops.forEach((d, i) => {
    const ph = (t * 2.6 + i / drops.length) % 1;
    const on = amount > 0.05 && i / drops.length < amount;
    d.visible = on;
    if (!on) return;
    const spread = ((i * 7919) % 13) / 13 - 0.5;
    d.position.copy(origin)
      .add(dir.clone().multiplyScalar(ph * 0.25))
      .add(v3(spread * 0.05, -ph * ph * 0.42, ((i * 31) % 7) / 7 * 0.04 - 0.02));
    d.scale.setScalar(0.8 + 0.4 * ((i * 13) % 5) / 5);
  });
}
function soilFrom(t, origin, amount) {
  soilBits.forEach((d, i) => {
    const ph = (t * 3 + i / soilBits.length) % 1;
    const on = amount > 0.05 && i / soilBits.length < amount;
    d.visible = on;
    if (!on) return;
    d.position.copy(origin).add(v3(((i * 37) % 11) / 11 * 0.05 - 0.025, -ph * 0.14, ((i * 17) % 7) / 7 * 0.05 - 0.025));
  });
}
function show(obj, v) { obj.visible = v; }

// ------------------------------------------------------------ world state
function gardenState(t, variant) {
  const full = (variant === 'B' || variant === 'C') ? t < S.s1[1] : (variant === 'A' && t >= 1.4 && t < S.s1[1]);
  const pop = (t0) => (full ? 1 : easeOutBack(seg(t, t0, t0 + 0.28)));
  const grow = (t0, t1) => (full ? 1 : smooth(seg(t, t0, t1)));
  const g = {};
  g.basil = full ? 1 : t < 5.3 ? 0.3 : lerp(0.3, 1, smooth(seg(t, 5.3, 6.85)));
  g.sill = [0, 1, 2].map((i) => ({ pop: pop(5.35 + 0.17 * i), g: grow(5.45 + 0.12 * i, 6.9) }));
  g.shelf = [0, 1].map((i) => ({ pop: pop(5.85 + 0.12 * i), g: grow(5.9 + 0.1 * i, 6.95) }));
  g.trough = pop(6.1);
  g.tomatoPot = pop(6.0);
  g.straw = grow(6.15, 6.98);
  g.tomato = grow(6.05, 6.98);
  g.harvest = full ? { basil: false, tomato: false, straw: false } : { basil: t >= HARVEST.basil, tomato: t >= HARVEST.tomato, straw: t >= HARVEST.straw };
  return g;
}

function applyGarden(g, basilInPot) {
  P.basil.setGrowth(g.basil);
  P.basil.group.visible = true;
  if (basilInPot) {
    P.basil.group.position.set(sillX.basil, SY + P.basilPot.userData.soilTop, SZ);
    P.basil.group.rotation.set(0, 0.4, 0);
  }
  P.sill.forEach((s, i) => {
    s.pot.scale.setScalar(Math.max(1e-4, g.sill[i].pop));
    s.pot.visible = g.sill[i].pop > 0.01;
    s.plant.group.visible = s.pot.visible;
    s.plant.setGrowth(g.sill[i].g);
    s.plant.group.scale.multiplyScalar(Math.max(1e-4, g.sill[i].pop));
  });
  P.shelf.forEach((s, i) => {
    s.pot.scale.setScalar(Math.max(1e-4, g.shelf[i].pop));
    s.pot.visible = g.shelf[i].pop > 0.01;
    s.plant.group.visible = s.pot.visible;
    s.plant.setGrowth(g.shelf[i].g);
    s.plant.group.scale.multiplyScalar(Math.max(1e-4, g.shelf[i].pop));
  });
  P.trough.visible = g.trough > 0.01;
  P.trough.scale.setScalar(Math.max(1e-4, g.trough));
  P.straw.forEach((s) => s.setGrowth(g.straw));
  P.tomatoPot.visible = g.tomatoPot > 0.01;
  P.tomatoPot.scale.setScalar(Math.max(1e-4, g.tomatoPot));
  P.tomato.group.visible = P.tomatoPot.visible;
  P.tomato.setGrowth(g.tomato);
  P.tomato.group.scale.multiplyScalar(Math.max(1e-4, g.tomatoPot));
  // harvest
  P.basil.remove('top', g.harvest.basil);
  P.basil.setGrowth(g.basil);
  const tf = P.tomato.fruits;
  [tf[5], tf[6]].forEach((f) => { if (f) f.visible = !g.harvest.tomato; });
  const sf = P.straw[1].fruits[0];
  if (g.harvest.straw) sf.visible = false;
}

// ------------------------------------------------------------ per-frame update
const CAM = {
  wide: { target: v3(0.25, 1.25, -0.35), az: 45, el: 31, zoom: 0.68 },
};

function resetProps() {
  P.can.visible = true;
  P.can.position.copy(canRest.pos);
  P.can.rotation.set(0, canRest.yaw, 0);
  P.scoop.visible = false;
  P.scissors.visible = false;
  P.bowl.visible = false;
  P.bowlItems.visible = true;
  P.dimple.visible = false;
  P.seeds.forEach((s) => (s.visible = false));
  P.seedPots.forEach((p) => (p.visible = false));
  P.plate.visible = false;
  P.plateTop.forEach(({ tm, bl }) => { tm.visible = true; bl.visible = true; });
  P.handLeaf.forEach((l) => (l.visible = false));
  P.handTomato.visible = false;
  P.handStraw.visible = false;
  drops.forEach((d) => (d.visible = false));
  soilBits.forEach((d) => (d.visible = false));
  if (P.tablet) {
    P.tablet.visible = false;
    P.booklets.forEach((b) => (b.visible = false));
    P.mug.visible = false;
  }
}

function tableSceneProps(t) {
  if (t >= S.s5b[0]) P.plate.visible = true;
  if (t >= S.s6[0]) {
    P.tablet.visible = true;
    P.booklets.forEach((b) => (b.visible = true));
    P.mug.visible = true;
  }
}

function sunSetup(t) {
  // default morning light through the window; sweeps during the time-lapse
  let az = -0.35;
  if (t >= S.s3[0] && t < S.s3[1]) az = lerp(-0.75, 0.75, seg(t, S.s3[0], S.s3[1]));
  const cx = 0.4;
  sun.position.set(cx + Math.sin(az) * 9, 6.5, -3 - Math.cos(az) * 9);
  sun.target.position.set(cx, 0, -1.2);
  const flick = (t >= S.s3[0] && t < S.s3[1]) ? 0.85 + 0.15 * Math.sin(t * 20) : 1;
  sun.intensity = 1.9 * flick;
  key.position.set(-4.5, 10, 6);
  key.target.position.set(0.3, 0, -0.5);
}

function update(t, variant) {
  resetProps();
  sunSetup(t);
  const g = gardenState(t, variant);
  const standPos = (x, z) => v3(x, 0, z);
  let chs = { pos: standPos(0.95, 0.05), yaw: 0, visible: true };
  let cam = CAM.wide;
  let basilInPot = true;
  const hook = t < S.s1[1];

  if (hook && (variant === 'base' || (variant === 'A' && t < 1.4))) {
    // ---------------- Scene 1: she places a basil seedling in the only pot
    const A = variant === 'A';
    const tArrive = A ? 0 : 1.15, tPlace0 = A ? 0.15 : 1.15, tPlace1 = A ? 0.9 : 1.9;
    const from = standPos(-1.7, -0.9), to = standPos(0.5, -2.1);
    const u = seg(t, 0, tArrive);
    const pos = A ? to.clone() : from.clone().lerp(to, easeOut(u) * 0.7 + u * 0.3);
    const potTop = v3(sillX.basil, SY + P.basilPot.userData.soilTop + 0.02, SZ);
    const yaw = t < tArrive ? yawTo(from, to) : lerp(yawTo(from, to), yawTo(to, potTop) + 0.25, smooth(seg(t, tArrive, tArrive + 0.3)));
    const walking = t < tArrive ? 1 : 1 - smooth(seg(t, tArrive, tArrive + 0.2));
    const rest = localToWorld(pos, yaw, -0.18, 1.02, 0.3);
    const above = potTop.clone().add(v3(0, 0.1, 0.02));
    const hand = keys(t, [[tPlace0, rest], [tPlace0 + 0.35, above], [tPlace0 + 0.55, potTop.clone().add(v3(0, 0.03, 0))], [tPlace1, above], [tPlace1 + 0.35, rest]]);
    chs = { pos, yaw, walk: walking, phase: t * 2.6, lean: 0.12 + 0.12 * smooth(seg(t, tPlace0, tPlace0 + 0.4)) * (1 - smooth(seg(t, tPlace1, tPlace1 + 0.3))), headPitch: 0.35, hand: [hand, null] };
    const placed = t >= tPlace0 + 0.5;
    basilInPot = placed;
    g.basil = 0.3;
    if (!placed) {
      // seedling travels in her hand (inside a tiny nursery pot look)
      P.basil.group.position.copy(chs.hand[0] || rest).add(v3(0, -0.02, 0));
      P.basil.group.rotation.set(0, 0.4, 0);
      P.basil.group.visible = true;
    }
    cam = A
      ? { target: v3(0.75, 1.3, -2.2), az: 45, el: 28, zoom: lerp(1.35, 1.45, t / 1.4) }
      : mixCam({ target: v3(0.2, 1.25, -0.5), az: 45, el: 31, zoom: 0.7 }, { target: v3(0.55, 1.25, -1.35), az: 45, el: 30, zoom: 0.82 }, ease(t / 2.8));
    // hide garden (only the single pot on the sill)
    ch.update(chs);
    if (!placed) {
      const hp = ch.handPos[0];
      P.basil.group.position.copy(hp).add(v3(0, -0.04, 0));
    }
  } else if (hook) {
    // ---------------- Hook variants showing the grown garden
    if (variant === 'A') {
      chs = { pos: standPos(0.35, -1.55), yaw: yawTo(v3(0.35, 0, -1.55), v3(0.8, 0, -2.7)), headPitch: 0.05, headRoll: 0.1 * Math.sin(t * 2), hand: [null, null] };
      cam = { target: v3(0.35, 1.3, -0.9), az: 45, el: 30, zoom: lerp(0.8, 0.9, ease(seg(t, 1.4, 2.8))) };
    } else if (variant === 'B') {
      const pos = standPos(1.7, -1.75);
      const tgt = v3(2.35, 1.35, -2.35);
      const yaw = yawTo(pos, tgt);
      const hand = localToWorld(pos, yaw, 0.12, 1.2, 0.42);
      chs = { pos, yaw, headPitch: 0.35, lean: 0.08, hand: [null, hand] };
      cam = { target: v3(1.85, 1.15, -1.9), az: 45, el: 27, zoom: lerp(1.5, 1.68, ease(t / 2.8)) };
    } else {
      const pos = standPos(0.55, -1.45);
      const yaw = yawTo(pos, v3(1.0, 0, -2.7));
      chs = { pos, yaw, headPitch: -0.05, headRoll: 0.12, hand: [localToWorld(pos, yaw, -0.2, 0.8, 0.02), localToWorld(pos, yaw, 0.2, 0.8, 0.02)], sway: 0.03 * Math.sin(t * 2.4) };
      cam = { target: v3(0.75, 1.35, -1.6), az: 45, el: 29, zoom: lerp(1.0, 1.14, ease(t / 2.8)) };
    }
    ch.update(chs);
    if (variant === 'B') {
      holdCan(ch.handPos[1], chs.yaw, 0.55 * smooth(seg(t, 0.4, 0.9)));
      const sp = spoutWorld();
      waterFrom(t, sp, v3(0, 0, 0), smooth(seg(t, 0.8, 1.1)));
    }
  } else if (t < S.s2[1]) {
    // ---------------- Scene 2: potting macro on the table
    const u = t - S.s2[0];
    P.seedPots.forEach((p) => (p.visible = true));
    const pos = standPos(0.95, -0.02);
    const yaw = 0;
    const potsTop = P.seedPots.map((p) => p.position.clone().add(v3(0, p.userData.h, 0)));
    // pot A gets soil from the scoop
    setSoil(P.seedPots[0], lerp(0.25, 1, smooth(seg(u, 0.25, 0.75))));
    setSoil(P.seedPots[1], 1);
    setSoil(P.seedPots[2], 1);
    const restL = localToWorld(pos, yaw, -0.22, 1.02, 0.32);
    const restR = localToWorld(pos, yaw, 0.22, 1.02, 0.32);
    const scoopAt = potsTop[0].clone().add(v3(-0.03, 0.14, -0.02));
    const handL = keys(u, [[0, scoopAt.clone().add(v3(-0.08, 0.06, -0.05))], [0.2, scoopAt], [0.75, scoopAt.clone().add(v3(0.01, 0.01, 0))], [1.0, restL]]);
    const B = potsTop[1];
    const handR = keys(u, [
      [0.55, restR], [0.8, B.clone().add(v3(0, 0.1, 0))], [0.9, B.clone().add(v3(0, 0.035, 0))], [1.0, B.clone().add(v3(0, 0.1, 0))],
      [1.1, B.clone().add(v3(0, 0.14, 0))], [1.3, B.clone().add(v3(0, 0.07, 0))], [1.45, B.clone().add(v3(0.04, 0.06, 0))], [1.62, potsTop[1].clone().add(v3(0.02, 0.32, -0.12))], [2.45, potsTop[2].clone().add(v3(-0.1, 0.32, -0.14))],
    ]);
    chs = { pos, yaw, lean: 0.28, headPitch: 0.55, headYaw: lerp(0.15, -0.1, seg(u, 0.5, 1.5)), hand: [handL, handR] };
    ch.update(chs);
    // scoop in left hand while pouring
    if (u < 0.95) {
      P.scoop.visible = true;
      P.scoop.position.copy(ch.handPos[0]).add(v3(0.02, -0.02, 0.05));
      P.scoop.rotation.set(0, 0.9, 0);
      P.scoop.rotation.order = 'YXZ';
      P.scoop.rotation.z = -1.1 * smooth(seg(u, 0.2, 0.4));
      P.scoop.userData.dirt.visible = u < 0.65;
      soilFrom(t, ch.handPos[0].clone().add(v3(0.06, -0.04, 0.06)), smooth(seg(u, 0.25, 0.3)) * (1 - smooth(seg(u, 0.6, 0.7))));
    }
    // finger hole + seeds + cover
    const soilB = P.seedPots[1].position.y + P.seedPots[1].userData.soilTop;
    if (u > 0.88 && u < 1.45) {
      P.dimple.visible = true;
      P.dimple.position.set(B.x, soilB + 0.002, B.z);
      P.dimple.scale.setScalar(easeOutBack(seg(u, 0.88, 1.0)));
    }
    P.seeds.forEach((s, i) => {
      const t0 = 1.08 + i * 0.06;
      if (u < t0 || u > 1.42) return;
      s.visible = true;
      const k = easeOut(seg(u, t0, t0 + 0.14));
      s.position.set(B.x + (i - 1) * 0.012, lerp(ch.handPos[1].y - 0.03, soilB + 0.008, k), B.z + (i % 2) * 0.01);
    });
    // watering can in right hand
    if (u > 1.45) {
      const tilt = 0.7 * smooth(seg(u, 1.65, 1.9));
      holdCan(ch.handPos[1], -Math.PI / 2 + 0.3, tilt);
      waterFrom(t, spoutWorld(), v3(-0.3, 0, 0.1), smooth(seg(u, 1.85, 1.95)));
    }
    P.can.visible = u > 1.45;
    cam = { target: v3(0.95, 1.07, 0.5), az: 40, el: 33, zoom: lerp(3.0, 3.25, u / 2.45) };
  } else if (t < S.s3[1]) {
    // ---------------- Scene 3: time-lapse at the window
    chs = { visible: false, pos: standPos(0, 0), yaw: 0 };
    ch.update(chs);
    cam = { target: v3(0.55, 1.4, -2.35), az: 45, el: 27, zoom: lerp(1.42, 1.48, seg(t, S.s3[0], S.s3[1])) };
  } else if (t < S.s4[1]) {
    // ---------------- Scene 4: pull back to reveal the whole garden
    const from = standPos(-1.3, -0.45), to = standPos(1.55, -1.85);
    const u = seg(t, 7.05, 9.35);
    const pos = from.clone().lerp(to, u);
    const walking = t < 9.35 ? smooth(seg(t, 7.0, 7.15)) : 1 - smooth(seg(t, 9.35, 9.55));
    const yaw = t < 9.35 ? yawTo(from, to) : lerp(yawTo(from, to), yawTo(to, v3(2.45, 0, -1.45)), smooth(seg(t, 9.35, 9.7)));
    chs = { pos, yaw, walk: walking, phase: (t - 7) * 1.9, headPitch: 0.1, headYaw: 0.25 * Math.sin(t * 1.3), hand: [null, null] };
    ch.update(chs);
    holdCan(ch.handPos[1], yaw, 0);
    const c3 = { target: v3(0.55, 1.4, -2.35), az: 45, el: 27, zoom: 1.48 };
    cam = mixCam(c3, { ...CAM.wide, zoom: 0.66 }, ease(seg(t, 7.0, 9.4)));
  } else if (t < S.s5b[0]) {
    // ---------------- Scene 5a: harvest close-ups (basil, tomato, strawberry)
    const k = t < 10.325 ? 0 : t < 10.85 ? 1 : 2;
    const t0 = [9.8, 10.325, 10.85][k];
    const u = t - t0;
    let target;
    if (k === 0) target = v3(sillX.basil, SY + 0.2 + 0.3, SZ).add(v3(0, 0.02, 0));
    else if (k === 1) target = P.tomato.fruits[5].getWorldPosition(v3());
    else { P.trough.updateMatrixWorld(true); target = P.straw[1].fruits[0].getWorldPosition(v3()); }
    const camRight = v3(Math.cos(Math.PI / 4), 0, -Math.sin(Math.PI / 4));
    const toCam = v3(Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4));
    const pos = target.clone().setY(0).add(camRight.clone().multiplyScalar(-0.5)).add(toCam.clone().multiplyScalar(-0.05));
    const yaw = yawTo(pos, target) + 0.35;
    const rest = localToWorld(pos, yaw, 0.2, 1.0, 0.25);
    const pick = [HARVEST.basil, HARVEST.tomato, HARVEST.straw][k] - t0;
    const near = target.clone().add(v3(-0.08, 0.02, 0.1));
    const hand = keys(u, [[0, rest], [pick - 0.12, near], [pick, target.clone().add(v3(-0.01, 0, 0.03))], [pick + 0.08, target.clone().add(v3(-0.02, 0.02, 0.04))], [0.525, rest.clone().lerp(near, 0.4)]]);
    chs = { pos, yaw, lean: 0.1, headPitch: 0.3, hand: [null, hand] };
    ch.update(chs);
    const hp = ch.handPos[1];
    if (k === 0) {
      P.scissors.visible = true;
      P.scissors.position.copy(hp).add(v3(0.02, 0.01, -0.02));
      P.scissors.rotation.set(0, yaw - 0.3, 0.3);
      const open = u < pick ? 0.2 : 0;
      P.scissors.children.forEach((c, i) => { if (i % 2 === 0) c.rotation.y = (i ? 1 : -1) * (0.12 + open); });
      if (t >= HARVEST.basil) P.handLeaf.forEach((l, i) => { l.visible = true; l.position.copy(hp).add(v3(-0.02 + i * 0.03, 0.02, 0.03)); l.rotation.set(0.3, i, 0.2); });
    } else if (k === 1 && t >= HARVEST.tomato) {
      P.handTomato.visible = true;
      P.handTomato.position.copy(hp).add(v3(0, 0.01, 0.035));
    } else if (k === 2 && t >= HARVEST.straw) {
      P.handStraw.visible = true;
      P.handStraw.position.copy(hp).add(v3(0, 0.02, 0.03));
    }
    const zoomK = [4.3, 4.3, 4.4][k];
    cam = { target: target.clone().add(v3(0.0, -0.04, 0)), az: 45, el: 24, zoom: zoomK + u * 0.3 };
  } else if (t < S.s5b[1]) {
    // ---------------- Scene 5b: garnishing the meal at the table
    const u = t - S.s5b[0];
    const pos = standPos(0.58, -0.05);
    const yaw = 0.05;
    const plate = P.plate.position.clone();
    const bowlAt = plate.clone().add(v3(-0.26, 0.14, -0.1));
    const handL = bowlAt.clone().add(v3(0, 0.02, 0));
    const over = plate.clone().add(v3(0.02, 0.2, 0));
    const handR = keys(u, [[0, bowlAt.clone().add(v3(0.08, 0.1, 0))], [0.15, bowlAt.clone().add(v3(0.03, 0.06, 0))], [0.35, over], [0.45, over.clone().add(v3(0, -0.05, 0))], [0.6, bowlAt.clone().add(v3(0.04, 0.07, 0))], [0.75, over.clone().add(v3(-0.03, 0, 0.03))], [0.85, over.clone().add(v3(-0.03, -0.05, 0.03))], [1.05, localToWorld(pos, yaw, 0.2, 1.02, 0.3)]]);
    const joy = smooth(seg(u, 0.9, 1.15));
    chs = { pos, yaw, lean: 0.25 - joy * 0.12, headPitch: 0.5 - joy * 0.2, headRoll: joy * 0.16, bob: joy * 0.02 * Math.sin((u - 0.9) * 14) + joy * 0.012, hand: [handL, handR] };
    ch.update(chs);
    P.bowl.visible = true;
    P.bowl.position.copy(ch.handPos[0]).add(v3(0, -0.07, 0));
    P.plateTop.forEach(({ tm, bl }) => { tm.visible = u > 0.45; bl.visible = u > 0.85; });
    cam = { target: plate.clone().add(v3(-0.05, 0.14, 0)), az: 42, el: 36, zoom: lerp(3.45, 3.6, u / 1.25) };
  } else if (t < S.s6[1]) {
    // ---------------- Scene 6: back to the whole room, she waters
    const pos = standPos(1.72, -1.72);
    const tgt = v3(2.35, 0, -2.4);
    const yaw = yawTo(pos, tgt);
    const hand = localToWorld(pos, yaw, 0.12, 1.2, 0.42);
    chs = { pos, yaw, headPitch: 0.35, lean: 0.08, hand: [null, hand] };
    ch.update(chs);
    holdCan(ch.handPos[1], yaw, 0.55 * smooth(seg(t, 12.75, 13.1)));
    waterFrom(t, spoutWorld(), v3(0, 0, 0), smooth(seg(t, 13.0, 13.2)));
    cam = { ...CAM.wide, target: v3(0.35, 1.25, -0.45), zoom: lerp(0.7, 0.73, seg(t, S.s6[0], S.s6[1])) };
  } else {
    // ---------------- Scene 7: product on the table (same room)
    const pos = standPos(0.5, -2.05);
    chs = { pos, yaw: Math.PI - 0.2, headPitch: 0.2, headRoll: 0.08 * Math.sin(t * 1.5), hand: [null, null] };
    ch.update(chs);
    const tc = P.tablet.position.clone().add(v3(0, 0.02, 0));
    const camUp = v3(-Math.sin(Math.PI / 4) * Math.sin(0.3), Math.cos(0.3), -Math.cos(Math.PI / 4) * Math.sin(0.3));
    const tableCam = { target: tc.clone().sub(camUp.multiplyScalar(0.075)), az: 45, el: 17, zoom: lerp(6.9, 7.2, seg(t, 15.3, 18)) };
    const c6 = { ...CAM.wide, target: v3(0.35, 1.25, -0.45), zoom: 0.73 };
    cam = mixCam(c6, tableCam, ease(seg(t, S.s7[0], S.s7[0] + 0.62)));
  }

  applyGarden(g, basilInPot);
  if (!hook) tableSceneProps(t);
  if (hook && variant !== 'base' && !(variant === 'A' && t < 1.4)) {
    P.plate.visible = false;
  }
  setCam(cam);
  return { chs, g };
}

// ------------------------------------------------------------ overlay per frame
const HOOKS = {
  base: ['Comecei com um vasinho na janela…'],
  A: ['Comecei com um vasinho na janela e agora olha isso…'],
  B: ['Eu não sabia que dava pra plantar isso dentro de casa…'],
  C: ['Esse cantinho da minha casa ficou meio fora de controle… ', { emoji: '1f331' }],
};

function overlay(t, variant) {
  const top = 330;
  O.caption(ctx, HOOKS[variant], { t, t0: 0.02, t1: 2.72, cy: top + 20, size: 66, maxW: 780 });
  O.caption(ctx, ['…e descobri que dava pra plantar ', { t: 'MUITA', color: O.ACCENT }, ' coisa.'], { t, t0: 2.9, t1: 5.15, cy: top + 20, size: 64, maxW: 760 });
  if (t >= 6.15 && t < 7.2) {
    const lb = (plantPos, e, txt, t0, dx, dy) => {
      const p = project(plantPos);
      O.label(ctx, e, txt, { x: p.x + dx, y: p.y + dy, t, t0, t1: 6.98 });
    };
    lb(v3(sillX.basil, SY + 0.55, SZ), '1f331', 'manjericão', 6.2, 40, -60);
    lb(v3(sillX.chives, SY + 0.72, SZ), '1f33f', 'cebolinha', 6.35, 20, -190);
    lb(v3(sillX.lettuce, SY + 0.4, SZ), '1f96c', 'alface', 6.5, -30, -60);
  }
  O.caption(ctx, ['E você não precisa de um quintal.'], { t, t0: 7.35, t1: 9.7, cy: top + 20, size: 66, maxW: 760 });
  O.sequence(ctx, [
    { t: 'Plantar ', at: 9.95 }, { t: '→ ', at: 10.4, color: O.ACCENT }, { t: 'cuidar ', at: 10.45 },
    { t: '→ ', at: 10.9, color: O.ACCENT }, { t: 'colher ', at: 10.95 }, { t: '♡', at: 11.4, color: O.ACCENT },
  ], { t, t1: 12.5, cy: top + 20, size: 60 });
  O.caption(ctx, ['Foi assim que eu comecei.'], { t, t0: 12.72, t1: 13.55, cy: top + 20, size: 64, maxW: 760 });
  O.caption(ctx, ['Mas eu queria saber o que mais dava pra plantar…'], { t, t0: 13.72, t1: 14.62, cy: top + 20, size: 62, maxW: 760 });
  // product
  if (t >= 15.0) {
    O.caption(ctx, ['100 Hortaliças, Ervas e Frutas para Cultivar Dentro de Casa'], { t, t0: 15.0, t1: 99, cy: 320, size: 52, weight: 700, maxW: 760, pad: 34 });
    O.plainText(ctx, '+ Guias práticos', { cx: 540, cy: 1235, size: 50, weight: 600, t, t0: 15.55, stroke: 14, color: '#4f6a45' });
    O.plainText(ctx, 'R$24,90', { cx: 540, cy: 1320, size: 84, weight: 700, t, t0: 16.0, stroke: 18, color: O.ACCENT });
    O.button(ctx, 'QUERO COMEÇAR ', { cx: 540, cy: 1450, t, t0: 16.45 });
  }
}

// ------------------------------------------------------------ API
let ready = null;
async function init() {
  await O.loadOverlayAssets();
  await loadCover();
  P.tablet = makeTablet(coverTex, coverAspect);
  const T = ROOM.table;
  P.tablet.position.set(1.42, T.y + 0.255, 0.95);
  P.tablet.rotation.order = 'YXZ';
  P.tablet.rotation.y = Math.PI / 4;
  P.tablet.rotation.x = -0.16;
  scene.add(P.tablet);
  P.booklets = [
    [C.sage, v3(1.2, T.y + 0.17, 0.72), 0.55, -0.22],
    [C.terracottaLight, v3(1.5, T.y + 0.16, 0.66), 0.95, -0.2],
    [C.pistachio, v3(1.72, T.y + 0.15, 0.86), 1.15, -0.18],
  ].map(([c, p, y, x]) => {
    const b = makeBooklet(c, 0.22, 0.3);
    b.position.copy(p);
    b.rotation.order = 'YXZ';
    b.rotation.y = y;
    b.rotation.x = x;
    scene.add(b);
    return b;
  });
  P.mug = new THREE.Group();
  const mb = mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.11, 20), mat(C.white, 0.4));
  mb.position.y = 0.055;
  P.mug.add(mb);
  const mh = mesh(new THREE.TorusGeometry(0.03, 0.01, 8, 16), mat(C.white, 0.4));
  mh.position.set(0.058, 0.06, 0);
  mh.rotation.y = 0;
  P.mug.add(mh);
  const coffee = mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.005, 20), mat('#8a5a3c', 0.3));
  coffee.position.y = 0.1;
  P.mug.add(coffee);
  P.mug.position.set(1.12, T.y, 1.1);
  scene.add(P.mug);
  // warm up shaders
  update(0, 'base');
  renderer.render(scene, camera);
  return { coverIsPlaceholder };
}
ready = init();

window.renderFrame = async (f, variant = 'base', fmt = 'image/png') => {
  await ready;
  const t = f / FPS;
  update(t, variant);
  renderer.render(scene, camera);
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(glCanvas, 0, 0);
  overlay(t, variant);
  return out.toDataURL(fmt, 0.95);
};
window.info = async () => ({ ...(await ready), FPS, DUR });
window.S = S;
