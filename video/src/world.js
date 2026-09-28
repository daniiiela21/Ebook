import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rng, clamp, seg, easeOutBack, v3 } from './util.js';

// ---------------------------------------------------------------- palette
export const C = {
  bg: '#ffe2bd',
  wallBack: '#f9b04a',
  wallLeft: '#f59a3a',
  wood: '#e3a868',
  woodDark: '#b8763f',
  floor: '#d9975a',
  white: '#fff8ee',
  terracotta: '#dc6a3f',
  terracottaLight: '#f28b5e',
  sage: '#34b3a5',
  sageDark: '#23897f',
  pistachio: '#9fd34f',
  soil: '#6a4330',
  skin: '#f4c29e',
  hair: '#4e2f24',
  sweater: '#2fa89b',
  pants: '#4d6fa8',
  leaf: '#4fb13c',
  leafDark: '#3a8f2e',
  mint: '#3fa56b',
  lettuce: '#9bd94a',
  lettuceIn: '#d2f07c',
  tomato: '#f0412e',
  strawberry: '#ee3346',
  sky: '#a6dcf5',
  coral: '#e8574f',
  pink: '#f59ab4',
  yellow: '#ffcc3d',
  teal: '#35b0a8',
  cream: '#fff1d2',
};

const matCache = new Map();
export function mat(color, rough = 0.78, extra = {}) {
  const key = color + rough + JSON.stringify(extra);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...extra }));
  }
  return matCache.get(key);
}

export function mesh(geo, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

export function rbox(w, h, d, r, color, rough) {
  return mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2) * 0.999), mat(color, rough));
}

function roundedRectPath(path, x, y, w, h, r) {
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r);
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
  return path;
}

// ---------------------------------------------------------------- room
export const ROOM = {
  window: { x0: -0.8, x1: 1.6, y0: 1.0, y1: 3.1 },
  sillY: 1.05,
  sillZ: -2.74,
  table: { x: 0.95, z: 0.8, y: 0.9, w: 1.6, d: 0.95 },
  stand: { x: 2.42, z: -2.42, top: 0.98, low: 0.48 },
};

function floorTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = C.floor; g.fillRect(0, 0, 1024, 1024);
  const r = rng(7);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const y = (i * 1024) / n;
    g.fillStyle = `rgba(160,110,60,${0.03 + r() * 0.05})`;
    g.fillRect(0, y, 1024, 1024 / n);
    g.fillStyle = 'rgba(150,105,60,0.28)';
    g.fillRect(0, y, 1024, 3);
    const off = r() * 1024;
    g.fillRect(off, y, 3, 1024 / n);
    g.fillRect((off + 512) % 1024, y, 3, 1024 / n);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 16; c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, '#8fd3f4');
  gr.addColorStop(0.65, '#c9ecf6');
  gr.addColorStop(1, '#fff3cf');
  g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function tileTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f3e3c0'; g.fillRect(0, 0, 512, 256);
  const n = 8, m = 4, w = 512 / n, h = 256 / m;
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    g.fillStyle = (i + j) % 2 ? '#fff6dc' : '#fff1cf';
    g.fillRect(i * w + 3, j * h + 3, w - 6, h - 6);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function pictureTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 340;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 340);
  gr.addColorStop(0, '#8fd3f4'); gr.addColorStop(1, '#fff3cf');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 340);
  g.fillStyle = '#ffcc3d'; g.beginPath(); g.arc(180, 90, 36, 0, 7); g.fill();
  g.fillStyle = '#5fb24e'; g.beginPath(); g.ellipse(80, 330, 170, 110, 0, 0, 7); g.fill();
  g.fillStyle = '#7cc860'; g.beginPath(); g.ellipse(230, 340, 140, 90, 0, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildRoom(scene) {
  const room = new THREE.Group();
  scene.add(room);

  // diorama base
  const base = rbox(6.5, 0.45, 6.5, 0.14, '#b9723f');
  base.position.set(0.02, -0.225, 0.02);
  room.add(base);
  const floor = mesh(new THREE.PlaneGeometry(6.05, 6.05), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.8 }), { cast: false });
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0.18, 0.003, 0.18);
  room.add(floor);

  // back wall with window hole
  const W = ROOM.window;
  const shape = roundedRectPath(new THREE.Shape(), -3.15, 0, 6.35, 4.2, 0.12);
  const hole = roundedRectPath(new THREE.Path(), W.x0, W.y0, W.x1 - W.x0, W.y1 - W.y0, 0.28);
  shape.holes.push(hole);
  const wallGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.28, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3, curveSegments: 12 });
  const back = mesh(wallGeo, mat(C.wallBack, 0.92));
  back.position.set(0, 0, -3.14);
  room.add(back);

  const left = rbox(0.3, 4.2, 6.35, 0.08, C.wallLeft, 0.92);
  left.position.set(-3.0, 2.1, 0.03);
  room.add(left);

  // skirting boards
  const sk1 = rbox(6.0, 0.14, 0.05, 0.02, C.white);
  sk1.position.set(0.2, 0.07, -2.84);
  room.add(sk1);
  const sk2 = rbox(0.05, 0.14, 6.0, 0.02, C.white);
  sk2.position.set(-2.84, 0.07, 0.2);
  room.add(sk2);

  // window frame
  const frameShape = roundedRectPath(new THREE.Shape(), W.x0 - 0.1, W.y0 - 0.1, W.x1 - W.x0 + 0.2, W.y1 - W.y0 + 0.2, 0.34);
  frameShape.holes.push(roundedRectPath(new THREE.Path(), W.x0 + 0.06, W.y0 + 0.06, W.x1 - W.x0 - 0.12, W.y1 - W.y0 - 0.12, 0.22));
  const frame = mesh(new THREE.ExtrudeGeometry(frameShape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 12 }), mat(C.white, 0.6));
  frame.position.set(0, 0, -2.9);
  room.add(frame);
  const cx = (W.x0 + W.x1) / 2;
  const mull = rbox(0.06, W.y1 - W.y0 - 0.1, 0.06, 0.02, C.white, 0.6);
  mull.position.set(cx, (W.y0 + W.y1) / 2, -2.98);
  room.add(mull);
  const trans = rbox(W.x1 - W.x0 - 0.1, 0.06, 0.06, 0.02, C.white, 0.6);
  trans.position.set(cx, W.y0 + (W.y1 - W.y0) * 0.62, -2.98);
  room.add(trans);

  // sill
  const sill = rbox(3.0, 0.1, 0.62, 0.04, C.white, 0.55);
  sill.position.set(cx, ROOM.sillY - 0.05, -2.8);
  room.add(sill);

  // outside: sky + soft hills/trees (no shadows)
  const sky = mesh(new THREE.PlaneGeometry(4.6, 2.9), new THREE.MeshBasicMaterial({ map: skyTexture() }), { cast: false, receive: false });
  sky.position.set(cx - 0.6, 1.1, -4.3);
  room.add(sky);
  const r = rng(3);
  for (let i = 0; i < 6; i++) {
    const tr = new THREE.Mesh(new THREE.SphereGeometry(0.35 + r() * 0.25, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(i % 2 ? '#7cc860' : '#5fb24e') }));
    tr.position.set(cx - 2.4 + i * 0.7 + r() * 0.2, 0.05 + r() * 0.3, -4.0);
    tr.scale.y = 1.25;
    room.add(tr);
  }

  // tiled backsplash above the counter
  const tiles = mesh(new THREE.PlaneGeometry(1.95, 1.0), new THREE.MeshStandardMaterial({ map: tileTexture(), roughness: 0.45 }), { cast: false });
  tiles.rotation.y = Math.PI / 2;
  tiles.position.set(-2.845, 1.45, -1.9);
  room.add(tiles);
  // top molding
  const mold1 = rbox(6.3, 0.12, 0.08, 0.03, C.white, 0.6);
  mold1.position.set(0.02, 4.1, -2.84);
  room.add(mold1);
  const mold2 = rbox(0.08, 0.12, 6.3, 0.03, C.white, 0.6);
  mold2.position.set(-2.84, 4.1, 0.02);
  room.add(mold2);

  // kitchen counter along left wall (coral cabinets, cream top)
  const cab = rbox(0.66, 0.9, 1.9, 0.05, C.coral, 0.6);
  cab.position.set(-2.52, 0.45, -1.9);
  room.add(cab);
  const top = rbox(0.74, 0.07, 1.98, 0.03, C.cream, 0.45);
  top.position.set(-2.5, 0.93, -1.9);
  room.add(top);
  for (const z of [-2.35, -1.45]) {
    const door = rbox(0.03, 0.62, 0.8, 0.02, '#f07a5c', 0.6);
    door.position.set(-2.18, 0.45, z);
    room.add(door);
    const knob = mesh(new THREE.SphereGeometry(0.035, 12, 10), mat('#ffd36b', 0.3, { metalness: 0.3 }));
    knob.position.set(-2.15, 0.62, z + (z < -2 ? 0.3 : -0.3));
    room.add(knob);
  }
  // kettle
  const kettle = new THREE.Group();
  const kb = mesh(new THREE.SphereGeometry(0.14, 24, 16), mat(C.teal, 0.35));
  kb.scale.y = 0.85;
  kettle.add(kb);
  const kl = mesh(new THREE.SphereGeometry(0.035, 12, 8), mat(C.white));
  kl.position.y = 0.13;
  kettle.add(kl);
  const ks = mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.14, 10), mat(C.teal, 0.35));
  ks.position.set(0, 0.03, 0.14);
  ks.rotation.x = 0.9;
  kettle.add(ks);
  kettle.position.set(-2.5, 1.08, -2.55);
  room.add(kettle);
  const board = rbox(0.34, 0.03, 0.5, 0.012, C.woodDark);
  board.position.set(-2.52, 0.98, -1.55);
  room.add(board);
  const jar = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 20), mat(C.yellow, 0.4));
  jar.position.set(-2.55, 1.06, -1.1);
  room.add(jar);
  const jl = mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.035, 20), mat(C.coral));
  jl.position.set(-2.55, 1.17, -1.1);
  room.add(jl);

  // retro fridge (teal) on the left wall
  const fr = new THREE.Group();
  const fb = rbox(0.72, 1.75, 0.74, 0.14, C.teal, 0.45);
  fb.position.y = 0.875;
  fr.add(fb);
  const seam = rbox(0.02, 0.02, 0.66, 0.01, '#23877f', 0.5);
  seam.position.set(0.365, 1.2, 0);
  fr.add(seam);
  for (const [y, h] of [[1.45, 0.3], [0.8, 0.35]]) {
    const hd = mesh(new THREE.CapsuleGeometry(0.025, h, 4, 10), mat('#e8eef0', 0.25, { metalness: 0.4 }));
    hd.position.set(0.39, y, -0.26);
    fr.add(hd);
  }
  const mags = [[C.yellow, 1.55, 0.05], [C.coral, 1.35, 0.15], [C.pink, 0.95, 0.05], [C.white, 1.6, 0.2]];
  for (const [c, y, z] of mags) {
    const m = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 16), mat(c, 0.5));
    m.rotation.z = Math.PI / 2;
    m.position.set(0.375, y, z);
    fr.add(m);
  }
  // tiny house ornament on top
  const hb = rbox(0.24, 0.2, 0.22, 0.03, '#d9975a', 0.9);
  hb.position.set(0, 1.86, 0);
  fr.add(hb);
  const roof = mesh(new THREE.ConeGeometry(0.2, 0.16, 4), mat(C.coral, 0.6));
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, 2.04, 0);
  fr.add(roof);
  const hw = rbox(0.02, 0.07, 0.07, 0.01, '#3fae5a', 0.6);
  hw.position.set(0.12, 1.87, 0);
  fr.add(hw);
  fr.position.set(-2.45, 0, 1.45);
  room.add(fr);

  // wall shelf (left wall)
  const shelf = rbox(0.4, 0.06, 1.3, 0.02, C.wood);
  shelf.position.set(-2.66, 2.3, -0.15);
  room.add(shelf);
  // picture on the left wall
  const pic = rbox(0.05, 0.6, 0.48, 0.03, C.coral);
  pic.position.set(-2.84, 3.15, -0.1);
  room.add(pic);
  const pin = mesh(new THREE.PlaneGeometry(0.36, 0.48), new THREE.MeshStandardMaterial({ map: pictureTexture(), roughness: 0.8 }), { cast: false });
  pin.rotation.y = Math.PI / 2;
  pin.position.set(-2.81, 3.15, -0.1);
  room.add(pin);
  // clock on the back wall
  const clock = new THREE.Group();
  const cr = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.06, 36), mat(C.coral, 0.5));
  cr.rotation.x = Math.PI / 2;
  clock.add(cr);
  const cf = mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.02, 36), mat(C.white, 0.5));
  cf.rotation.x = Math.PI / 2;
  cf.position.z = 0.025;
  clock.add(cf);
  for (const [len, rot] of [[0.13, 0.5], [0.17, 2.3]]) {
    const hand = rbox(0.018, len, 0.01, 0.004, '#4e2f24');
    hand.geometry.translate(0, len / 2, 0);
    hand.rotation.z = rot;
    hand.position.z = 0.04;
    clock.add(hand);
  }
  clock.position.set(2.45, 3.2, -2.82);
  room.add(clock);

  // curtains + rod over the window
  const rod = mesh(new THREE.CylinderGeometry(0.025, 0.025, 3.5, 10), mat(C.woodDark, 0.5));
  rod.rotation.z = Math.PI / 2;
  rod.position.set(cx, 3.32, -2.72);
  room.add(rod);
  for (const e of [-1, 1]) {
    const knob = mesh(new THREE.SphereGeometry(0.06, 12, 10), mat(C.woodDark, 0.5));
    knob.position.set(cx + e * 1.78, 3.32, -2.72);
    room.add(knob);
    const drape = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const f = mesh(new THREE.CylinderGeometry(0.07, 0.085 + k * 0.004, 2.25, 14), mat(C.coral, 0.9));
      f.position.set(k * 0.1 * -e, 2.2, (k % 2) * 0.03);
      drape.add(f);
    }
    const tie = mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 20), mat(C.yellow, 0.6));
    tie.rotation.x = Math.PI / 2;
    tie.scale.set(1.1, 0.7, 1);
    tie.position.set(-e * 0.15, 1.75, 0.015);
    drape.add(tie);
    drape.position.set(cx + e * 1.55, 0, -2.68);
    room.add(drape);
  }

  // plant stand (two tiers)
  const S = ROOM.stand;
  for (const [y, w] of [[S.top, 0.8], [S.low, 0.8]]) {
    const b = rbox(w, 0.05, 0.42, 0.02, C.wood);
    b.position.set(S.x, y - 0.025, S.z);
    room.add(b);
  }
  for (const dx of [-0.36, 0.36]) for (const dz of [-0.17, 0.17]) {
    const leg = rbox(0.04, S.top, 0.04, 0.015, C.woodDark);
    leg.position.set(S.x + dx, S.top / 2, S.z + dz);
    room.add(leg);
  }

  // rug (yellow with orange border)
  const rug = rbox(2.7, 0.03, 2.1, 0.012, '#f7a13a', 0.95);
  rug.castShadow = false;
  rug.position.set(0.95, 0.016, 0.75);
  room.add(rug);
  const rugIn = rbox(2.3, 0.03, 1.7, 0.012, C.yellow, 0.95);
  rugIn.castShadow = false;
  rugIn.position.set(0.95, 0.022, 0.75);
  room.add(rugIn);

  // table with a pink tablecloth
  const T = ROOM.table;
  const tt = rbox(T.w, 0.06, T.d, 0.03, C.wood, 0.7);
  tt.position.set(T.x, T.y - 0.05, T.z);
  room.add(tt);
  const cloth = rbox(T.w + 0.04, 0.035, T.d + 0.04, 0.017, C.pink, 0.9);
  cloth.position.set(T.x, T.y - 0.015, T.z);
  room.add(cloth);
  for (const [dx, dz, w, d] of [[0, T.d / 2 + 0.02, T.w + 0.04, 0.03], [0, -T.d / 2 - 0.02, T.w + 0.04, 0.03], [T.w / 2 + 0.02, 0, 0.03, T.d + 0.04], [-T.w / 2 - 0.02, 0, 0.03, T.d + 0.04]]) {
    const drop = rbox(w, 0.2, d, 0.012, C.pink, 0.9);
    drop.position.set(T.x + dx, T.y - 0.12, T.z + dz);
    room.add(drop);
  }
  for (const dx of [-0.68, 0.68]) for (const dz of [-0.36, 0.36]) {
    const leg = mesh(new THREE.CylinderGeometry(0.035, 0.028, T.y - 0.08, 12), mat(C.white, 0.5));
    leg.position.set(T.x + dx, (T.y - 0.08) / 2, T.z + dz);
    room.add(leg);
  }
  // chairs: white with red cushions
  const chair = (x, z, yaw) => {
    const g = new THREE.Group();
    const seat = rbox(0.44, 0.05, 0.44, 0.02, C.white, 0.5);
    seat.position.y = 0.48;
    g.add(seat);
    const cush = rbox(0.4, 0.06, 0.4, 0.03, C.coral, 0.85);
    cush.position.y = 0.53;
    g.add(cush);
    for (const lx of [-0.18, 0.18]) for (const lz of [-0.18, 0.18]) {
      const l = mesh(new THREE.CylinderGeometry(0.022, 0.02, 0.48, 8), mat(C.white, 0.5));
      l.position.set(lx, 0.24, lz);
      g.add(l);
    }
    for (const lx of [-0.18, 0.18]) {
      const p = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 8), mat(C.white, 0.5));
      p.position.set(lx, 0.74, -0.2);
      g.add(p);
    }
    const back = rbox(0.44, 0.14, 0.04, 0.02, C.white, 0.5);
    back.position.set(0, 0.96, -0.2);
    g.add(back);
    g.position.set(x, 0, z);
    g.rotation.y = yaw;
    room.add(g);
  };
  chair(T.x + 1.08, T.z, -Math.PI / 2);
  chair(T.x - 0.35, T.z + 0.85, Math.PI);

  // pendant lamp over the table (hidden in close-ups)
  const lamp = new THREE.Group();
  const cord = mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.7, 6), mat('#4e2f24'), { cast: false });
  cord.position.y = 0.85;
  lamp.add(cord);
  const shade = mesh(new THREE.CylinderGeometry(0.06, 0.26, 0.2, 28, 1, true), mat(C.yellow, 0.4, { side: THREE.DoubleSide }));
  lamp.add(shade);
  const bulb = mesh(new THREE.SphereGeometry(0.06, 14, 10), new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#ffe6a0', emissiveIntensity: 1.2 }), { cast: false });
  bulb.position.y = -0.08;
  lamp.add(bulb);
  lamp.position.set(T.x, 2.75, T.z);
  room.add(lamp);
  room.userData.lamp = lamp;

  return room;
}

// ---------------------------------------------------------------- pots
export function makePot({ r = 0.13, h = 0.22, color = C.terracotta, soilFill = 1 } = {}) {
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(r, r * 0.74, h, 32), mat(color, 0.85));
  body.position.y = h / 2;
  g.add(body);
  const rim = mesh(new THREE.TorusGeometry(r * 1.02, r * 0.14, 10, 36), mat(color, 0.85));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = h;
  g.add(rim);
  const inside = mesh(new THREE.CylinderGeometry(r * 0.93, r * 0.93, 0.02, 28), mat(C.soil, 0.95), { cast: false });
  inside.position.y = h - 0.03;
  g.add(inside);
  const soil = mesh(new THREE.CylinderGeometry(r * 0.93, r * 0.7, 1, 28), mat(C.soil, 0.95), { cast: false });
  g.add(soil);
  g.userData = { r, h, soil, inside };
  setSoil(g, soilFill);
  return g;
}
export function setSoil(pot, f) {
  const { h, soil, inside } = pot.userData;
  const top = 0.04 + (h - 0.07) * clamp(f);
  soil.scale.y = Math.max(0.001, top - 0.02);
  soil.position.y = 0.02 + soil.scale.y / 2;
  soil.visible = f > 0.01;
  inside.visible = false;
  pot.userData.soilTop = top;
}

// ---------------------------------------------------------------- plants
const leafGeoCache = new Map();
function leafGeo(len, wid, thick, point = 0.35) {
  const k = [len, wid, thick, point].join();
  if (leafGeoCache.has(k)) return leafGeoCache.get(k);
  const g = new THREE.SphereGeometry(0.5, 16, 10);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + 0.5; // 0..1 along the leaf
    p.setX(i, x * len);
    p.setZ(i, p.getZ(i) * wid * (1 - point * x));
    // gentle upward curl towards the tip
    p.setY(i, p.getY(i) * thick + Math.pow(x, 2) * len * 0.12);
  }
  g.computeVertexNormals();
  leafGeoCache.set(k, g);
  return g;
}

class Plant {
  constructor() {
    this.group = new THREE.Group();
    this.parts = []; // {obj, birth, dur, scale}
    this.removable = {};
    this.minScale = 0.35;
  }
  add(obj, birth, parent = this.group, dur = 0.25) {
    parent.add(obj);
    this.parts.push({ obj, birth, dur, s: obj.scale.clone() });
    return obj;
  }
  setGrowth(g) {
    this.group.scale.setScalar(this.minScale + (1 - this.minScale) * Math.min(1, g * 1.15));
    for (const p of this.parts) {
      const k = easeOutBack(seg(g, p.birth, p.birth + p.dur));
      p.obj.scale.copy(p.s).multiplyScalar(Math.max(1e-4, k));
      p.obj.visible = k > 0.002 && !p.obj.userData.removed;
    }
  }
  remove(tag, removed) {
    for (const o of this.removable[tag] || []) o.userData.removed = removed;
  }
}

function leafPivot(geoArgs, color, az, elev, pos) {
  const pv = new THREE.Group();
  pv.position.copy(pos);
  pv.rotation.order = 'YZX';
  pv.rotation.y = az;
  pv.rotation.z = elev;
  const m = mesh(leafGeo(...geoArgs), mat(color, 0.6));
  pv.add(m);
  return pv;
}

export function makeBasil(seed = 1) {
  const P = new Plant();
  const r = rng(seed);
  const H = 0.3;
  const stem = mesh(new THREE.CylinderGeometry(0.012, 0.016, H, 8), mat('#5f9345'));
  stem.position.y = H / 2;
  P.add(stem, 0.0, P.group, 0.2);
  P.removable.top = [];
  for (let i = 0; i < 4; i++) {
    const y = 0.07 + i * 0.075;
    for (const s of [0, Math.PI]) {
      const len = 0.17 - i * 0.022;
      const l = leafPivot([len, len * 0.62, 0.11 * len * 6 / 6], i % 2 ? C.leaf : '#72ab50', i * Math.PI / 2 + s + (r() - 0.5) * 0.3, 0.55 - i * 0.05 + r() * 0.1, v3(0, y, 0));
      P.add(l, 0.02 + i * 0.2);
      if (i >= 2) P.removable.top.push(l);
    }
  }
  for (let j = 0; j < 4; j++) {
    const l = leafPivot([0.08, 0.05, 0.012], '#86bb5e', (j * Math.PI) / 2 + 0.6, 1.0, v3(0, H + 0.005, 0));
    P.add(l, 0.8);
    P.removable.top.push(l);
  }
  P.minScale = 0.3;
  return P;
}

export function makeChives(seed = 2) {
  const P = new Plant();
  const r = rng(seed);
  for (let i = 0; i < 16; i++) {
    const h = 0.34 + r() * 0.2;
    const pv = new THREE.Group();
    const a = r() * Math.PI * 2, d = r() * 0.06;
    pv.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    pv.rotation.set((r() - 0.5) * 0.35, 0, (r() - 0.5) * 0.35);
    const b = mesh(new THREE.CylinderGeometry(0.004, 0.011, h, 7), mat(i % 3 ? '#4d7f37' : '#5b8f40', 0.55));
    b.position.y = h / 2;
    pv.add(b);
    P.add(pv, r() * 0.45, P.group, 0.35);
    if (i < 2) {
      const f = mesh(new THREE.IcosahedronGeometry(0.035, 1), mat('#b99ad4', 0.9));
      f.position.y = h + 0.02;
      P.add(f, 0.82, pv, 0.15);
    }
  }
  P.minScale = 0.25;
  return P;
}

export function makeLettuce(seed = 3) {
  const P = new Plant();
  const r = rng(seed);
  const rings = [
    { n: 6, len: 0.2, wid: 0.17, elev: 0.35, col: C.lettuce, b: 0.0 },
    { n: 5, len: 0.16, wid: 0.14, elev: 0.8, col: '#b9da7b', b: 0.3 },
    { n: 4, len: 0.11, wid: 0.1, elev: 1.15, col: C.lettuceIn, b: 0.55 },
  ];
  rings.forEach((R, k) => {
    for (let i = 0; i < R.n; i++) {
      const l = leafPivot([R.len, R.wid, 0.012, 0.05], R.col, (i / R.n) * Math.PI * 2 + k * 0.5 + r() * 0.2, R.elev + r() * 0.1, v3(0, 0.02 + k * 0.012, 0));
      P.add(l, R.b + i * 0.03);
    }
  });
  P.minScale = 0.3;
  return P;
}

export function makeMint(seed = 4) {
  const P = new Plant();
  const r = rng(seed);
  for (let s = 0; s < 6; s++) {
    const h = 0.22 + r() * 0.1;
    const pv = new THREE.Group();
    const a = (s / 6) * Math.PI * 2 + r();
    pv.position.set(Math.cos(a) * 0.04, 0, Math.sin(a) * 0.04);
    pv.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
    const st = mesh(new THREE.CylinderGeometry(0.007, 0.009, h, 6), mat('#6b8f5a'));
    st.position.y = h / 2;
    pv.add(st);
    P.add(pv, s * 0.06, P.group, 0.3);
    for (let i = 0; i < 4; i++) {
      for (const side of [0, Math.PI]) {
        const l = leafPivot([0.075 - i * 0.008, 0.05, 0.01, 0.45], i % 2 ? C.mint : '#6aab80', i * Math.PI / 2 + side, 0.35, v3(0, 0.06 + i * (h - 0.06) / 4, 0));
        P.add(l, 0.1 + i * 0.18 + s * 0.02, pv);
      }
    }
  }
  P.minScale = 0.3;
  return P;
}

const berryGeo = (() => {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    const rr = Math.sin(Math.PI * Math.pow(u, 0.75)) * (0.55 + 0.45 * u) * 0.045;
    pts.push(new THREE.Vector2(rr, -u * 0.08));
  }
  return new THREE.LatheGeometry(pts.reverse(), 20);
})();

function makeStrawberryFruit() {
  const g = new THREE.Group();
  const b = mesh(berryGeo, mat(C.strawberry, 0.5));
  b.rotation.x = Math.PI;
  b.position.y = -0.08;
  g.add(b);
  for (let i = 0; i < 5; i++) {
    const l = leafPivot([0.035, 0.018, 0.006, 0.5], '#5a9440', (i / 5) * Math.PI * 2, -0.35, v3(0, 0, 0));
    g.add(l);
  }
  // seeds
  const sr = rng(9);
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 5, 4), mat('#f4d27a', 0.6));
    const u = 0.25 + sr() * 0.6, a = sr() * Math.PI * 2;
    const rr = Math.sin(Math.PI * Math.pow(u, 0.75)) * (0.55 + 0.45 * u) * 0.045 + 0.001;
    s.position.set(Math.cos(a) * rr, -0.08 + (1 - u) * 0.08 - 0.0, Math.sin(a) * rr);
    s.position.y = -(u) * 0.08;
    g.add(s);
  }
  return g;
}
export { makeStrawberryFruit };

export function makeStrawberry(seed = 5) {
  const P = new Plant();
  const r = rng(seed);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + r() * 0.4;
    const pv = new THREE.Group();
    pv.rotation.order = 'YZX';
    pv.rotation.y = a;
    pv.rotation.z = -(0.45 + r() * 0.3);
    const L = 0.13 + r() * 0.05;
    const st = mesh(new THREE.CylinderGeometry(0.006, 0.008, L, 6), mat('#6c9650'));
    st.position.y = L / 2;
    pv.add(st);
    for (let k = 0; k < 3; k++) {
      const l = leafPivot([0.07, 0.06, 0.01, 0.2], k === 1 ? '#5f9c47' : '#6aa650', (k - 1) * 0.9, 0.25, v3(0, L, 0));
      l.rotation.x = 0;
      pv.add(l);
    }
    P.add(pv, i * 0.08, P.group, 0.3);
  }
  // flower
  const fl = new THREE.Group();
  for (let k = 0; k < 5; k++) {
    const p = mesh(new THREE.SphereGeometry(0.016, 10, 8), mat(C.white, 0.7));
    p.scale.y = 0.35;
    p.position.set(Math.cos(k * 1.2566) * 0.017, 0, Math.sin(k * 1.2566) * 0.017);
    fl.add(p);
  }
  const fc = mesh(new THREE.SphereGeometry(0.01, 8, 6), mat('#f2c84b'));
  fl.add(fc);
  fl.position.set(0.02, 0.14, 0.08);
  P.add(fl, 0.6);
  // berries hanging to the front
  P.fruits = [];
  const pos = [v3(0.1, 0.07, 0.07), v3(-0.07, 0.06, 0.1), v3(0.02, 0.05, 0.13)];
  pos.forEach((p, i) => {
    const f = makeStrawberryFruit();
    f.position.copy(p);
    f.scale.setScalar(1.25);
    P.add(f, 0.72 + i * 0.07, P.group, 0.2);
    P.fruits.push(f);
  });
  P.minScale = 0.3;
  return P;
}

export function makeTomato(seed = 6) {
  const P = new Plant();
  const r = rng(seed);
  const stake = mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.35, 8), mat('#d8c08e'));
  stake.position.set(0.06, 0.62, -0.03);
  P.group.add(stake);
  let p = v3(0, 0, 0);
  const nodes = [];
  for (let i = 0; i < 6; i++) {
    const q = v3((i % 2 ? 0.05 : -0.03) + (r() - 0.5) * 0.02, p.y + 0.2, (r() - 0.5) * 0.04);
    const d = q.clone().sub(p);
    const s = mesh(new THREE.CylinderGeometry(0.013, 0.017, d.length(), 7), mat('#5d8f41'));
    s.position.copy(p).add(q).multiplyScalar(0.5);
    s.quaternion.setFromUnitVectors(v3(0, 1, 0), d.clone().normalize());
    P.add(s, i * 0.1, P.group, 0.2);
    nodes.push(q);
    p = q;
  }
  P.fruits = [];
  nodes.forEach((n, i) => {
    // compound leaf
    for (const side of [0, Math.PI]) {
      const pv = new THREE.Group();
      pv.position.copy(n);
      pv.rotation.order = 'YZX';
      pv.rotation.y = side + i * 1.2;
      pv.rotation.z = 0.15;
      for (let k = 0; k < 4; k++) {
        const l = leafPivot([0.09, 0.055, 0.009, 0.45], k % 2 ? '#5b8e3c' : '#66983f', (k % 2 ? 0.5 : -0.5), 0.1, v3(0.04 + k * 0.055, 0, 0));
        pv.add(l);
      }
      const tip = leafPivot([0.1, 0.06, 0.009, 0.45], '#66983f', 0, 0.1, v3(0.25, 0, 0));
      pv.add(tip);
      P.add(pv, 0.05 + i * 0.1, P.group, 0.25);
    }
    // trusses
    if (i >= 1 && i <= 4) {
      const tr = new THREE.Group();
      tr.position.copy(n).add(v3(0.08 * (i % 2 ? 1 : -1), -0.06, 0.1));
      const cols = i === 4 ? ['#e98a3f', '#9dbf57', '#e0513d', '#f0a14b'] : [C.tomato, C.tomato, '#e8643f', C.tomato, '#ec7a41'];
      cols.forEach((c, k) => {
        const f = mesh(new THREE.SphereGeometry(0.048, 18, 12), mat(c, 0.35));
        f.position.set(Math.cos(k * 1.9) * 0.05, -k * 0.035, Math.sin(k * 1.9) * 0.05);
        const cal = mesh(new THREE.CylinderGeometry(0.018, 0.001, 0.012, 5), mat('#5b8e3c'));
        cal.position.y = 0.047;
        f.add(cal);
        tr.add(f);
        if (c === C.tomato) P.fruits.push(f);
      });
      P.add(tr, 0.7 + i * 0.05, P.group, 0.2);
    }
  });
  P.minScale = 0.2;
  return P;
}

// ---------------------------------------------------------------- props
export function makeWateringCan() {
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.15, 28), mat(C.sage, 0.5));
  body.position.y = 0.075;
  g.add(body);
  const lid = mesh(new THREE.SphereGeometry(0.085, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(C.sage, 0.5));
  lid.position.y = 0.15;
  lid.scale.y = 0.4;
  g.add(lid);
  const sp = mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.2, 10), mat(C.sage, 0.5));
  sp.position.set(0, 0.1, 0.14);
  sp.rotation.x = 1.0;
  g.add(sp);
  const rose = mesh(new THREE.CylinderGeometry(0.028, 0.014, 0.03, 12), mat(C.sageDark, 0.5));
  rose.position.set(0, 0.155, 0.225);
  rose.rotation.x = 1.0;
  g.add(rose);
  const h = mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 20, Math.PI), mat(C.sageDark, 0.5));
  h.position.set(0, 0.16, -0.02);
  h.rotation.y = Math.PI / 2;
  g.add(h);
  g.userData.spout = v3(0, 0.165, 0.24);
  return g;
}

export function makeScoop() {
  const g = new THREE.Group();
  const handle = mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.12, 10), mat(C.woodDark));
  handle.rotation.x = Math.PI / 2;
  handle.position.z = -0.06;
  g.add(handle);
  const blade = mesh(new THREE.SphereGeometry(0.05, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(C.terracottaLight, 0.5, { side: THREE.DoubleSide }));
  blade.scale.set(0.9, 0.5, 1.4);
  blade.position.z = 0.05;
  g.add(blade);
  const dirt = mesh(new THREE.SphereGeometry(0.04, 12, 8), mat(C.soil, 0.95));
  dirt.scale.set(0.9, 0.35, 1.3);
  dirt.position.set(0, -0.005, 0.05);
  g.add(dirt);
  g.userData.dirt = dirt;
  return g;
}

export function makeScissors() {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const bl = rbox(0.012, 0.004, 0.09, 0.002, '#e9eef0', 0.3);
    bl.position.set(s * 0.004, 0, 0.05);
    bl.rotation.y = s * 0.12;
    g.add(bl);
    const ring = mesh(new THREE.TorusGeometry(0.017, 0.006, 6, 14), mat(C.terracotta, 0.5));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(s * 0.02, 0, -0.01);
    g.add(ring);
  }
  return g;
}

export function makeBowl(r = 0.1, color = C.white) {
  const g = new THREE.Group();
  const b = mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(color, 0.4, { side: THREE.DoubleSide }));
  b.position.y = r;
  g.add(b);
  const rim = mesh(new THREE.TorusGeometry(r, 0.008, 6, 30), mat(color, 0.4));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = r;
  g.add(rim);
  return g;
}

export function makeTablet(coverTex, aspect) {
  const g = new THREE.Group();
  const w = 0.36, h = 0.48;
  const body = rbox(w, h, 0.022, 0.03, '#f7f3ea', 0.35);
  g.add(body);
  const screenBg = mesh(new THREE.PlaneGeometry(w - 0.03, h - 0.03), new THREE.MeshBasicMaterial({ color: '#ffffff' }), { cast: false });
  screenBg.position.z = 0.0115;
  g.add(screenBg);
  // fit cover (contain) inside screen – never cropped or distorted
  const sw = w - 0.03, sh = h - 0.03;
  let cw = sw, ch = sw / aspect;
  if (ch > sh) { ch = sh; cw = sh * aspect; }
  const cover = mesh(new THREE.PlaneGeometry(cw, ch), new THREE.MeshBasicMaterial({ map: coverTex, toneMapped: false }), { cast: false });
  cover.position.z = 0.012;
  g.add(cover);
  // stand
  const stand = new THREE.Group();
  const leg = rbox(0.2, 0.3, 0.015, 0.006, C.woodDark);
  leg.position.set(0, -0.1, -0.1);
  leg.rotation.x = -0.45;
  stand.add(leg);
  g.add(stand);
  g.userData = { w, h };
  return g;
}

export function makeBooklet(color, w = 0.26, h = 0.34) {
  const g = new THREE.Group();
  const b = rbox(w, h, 0.02, 0.008, color, 0.8);
  g.add(b);
  const pg = rbox(w - 0.012, h - 0.012, 0.022, 0.004, C.white, 0.9);
  pg.position.set(0.004, 0, -0.002);
  g.add(pg);
  const band = rbox(w * 0.7, 0.03, 0.004, 0.002, C.white, 0.8);
  band.position.set(0, h * 0.28, 0.011);
  g.add(band);
  const leafIcon = mesh(new THREE.CircleGeometry(0.035, 20), new THREE.MeshStandardMaterial({ color: C.white, roughness: 0.8 }));
  leafIcon.position.set(0, -0.02, 0.0115);
  g.add(leafIcon);
  return g;
}

export function makePlate() {
  const g = new THREE.Group();
  const p = mesh(new THREE.CylinderGeometry(0.19, 0.15, 0.025, 36), mat(C.white, 0.35));
  p.position.y = 0.0125;
  g.add(p);
  const rim = mesh(new THREE.TorusGeometry(0.18, 0.012, 8, 40), mat(C.white, 0.35));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.026;
  g.add(rim);
  // bruschetta-like toasts
  for (let i = 0; i < 3; i++) {
    const tst = rbox(0.12, 0.03, 0.075, 0.012, '#e3b777', 0.9);
    tst.position.set(-0.07 + i * 0.07, 0.04, (i - 1) * 0.06);
    tst.rotation.y = 0.5 + i * 0.3;
    g.add(tst);
    const top = rbox(0.1, 0.012, 0.058, 0.005, '#f3ead3', 0.8);
    top.position.set(-0.07 + i * 0.07, 0.058, (i - 1) * 0.06);
    top.rotation.y = 0.5 + i * 0.3;
    g.add(top);
  }
  return g;
}

// ---------------------------------------------------------------- character
const UP = v3(0, 1, 0);
function capsule(r, len, color) {
  const m = mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat(color, 0.85));
  m.userData.len = len + 2 * r;
  m.userData.r = r;
  return m;
}
function placeLimb(m, A, B) {
  const d = B.clone().sub(A);
  const L = d.length();
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  m.scale.set(1, (L + 2 * m.userData.r) / m.userData.len, 1);
}
function ik(S, T, L1, L2, pole) {
  const d = T.clone().sub(S);
  let dist = d.length();
  const dir = d.normalize();
  dist = clamp(dist, Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
  const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const p = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  const E = S.clone().add(dir.clone().multiplyScalar(a)).add(p.multiplyScalar(h));
  return { E, T: S.clone().add(dir.multiplyScalar(dist)) };
}

export class Character {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.hips = new THREE.Group();
    this.root.add(this.hips);
    const pelvis = mesh(new THREE.SphereGeometry(0.16, 20, 14), mat(C.pants, 0.85));
    pelvis.scale.set(1.05, 0.75, 0.85);
    this.hips.add(pelvis);
    this.torso = new THREE.Group();
    this.hips.add(this.torso);
    const body = mesh(new THREE.CapsuleGeometry(0.175, 0.26, 8, 20), mat(C.sweater, 0.9));
    body.scale.set(1.08, 1, 0.8);
    body.position.y = 0.28;
    this.torso.add(body);
    // collar
    const collar = mesh(new THREE.TorusGeometry(0.07, 0.025, 8, 20), mat(C.white, 0.9));
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.52;
    this.torso.add(collar);
    const neck = mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 12), mat(C.skin, 0.7));
    neck.position.y = 0.55;
    this.torso.add(neck);
    this.head = new THREE.Group();
    this.head.position.y = 0.6;
    this.torso.add(this.head);
    const hd = mesh(new THREE.SphereGeometry(0.19, 28, 20), mat(C.skin, 0.7));
    hd.position.y = 0.14;
    this.head.add(hd);
    const hair = mesh(new THREE.SphereGeometry(0.2, 28, 20), mat(C.hair, 0.8));
    hair.position.set(0, 0.18, -0.035);
    hair.scale.set(1.03, 0.98, 1.0);
    this.head.add(hair);
    const fringe = mesh(new THREE.SphereGeometry(0.12, 20, 12), mat(C.hair, 0.8));
    fringe.position.set(0.05, 0.27, 0.09);
    fringe.scale.set(1.2, 0.55, 0.8);
    this.head.add(fringe);
    const bun = mesh(new THREE.SphereGeometry(0.085, 20, 14), mat(C.hair, 0.8));
    bun.position.set(0, 0.36, -0.1);
    this.head.add(bun);
    for (const s of [-1, 1]) {
      const eye = mesh(new THREE.SphereGeometry(0.017, 10, 8), mat('#3b2a24', 0.4), { cast: false });
      eye.position.set(s * 0.068, 0.13, 0.172);
      eye.scale.set(1, 1.2, 0.6);
      this.head.add(eye);
      const ch = mesh(new THREE.SphereGeometry(0.028, 10, 8), mat('#eea892', 0.9), { cast: false });
      ch.position.set(s * 0.105, 0.075, 0.155);
      ch.scale.set(1, 0.7, 0.4);
      this.head.add(ch);
    }
    this.shoulders = [-1, 1].map((s) => {
      const o = new THREE.Object3D();
      o.position.set(s * 0.19, 0.44, 0);
      this.torso.add(o);
      const sh = mesh(new THREE.SphereGeometry(0.075, 14, 10), mat(C.sweater, 0.9));
      o.add(sh);
      return o;
    });
    this.hipJ = [-1, 1].map((s) => {
      const o = new THREE.Object3D();
      o.position.set(s * 0.085, -0.02, 0);
      this.hips.add(o);
      return o;
    });
    this.arm = [0, 1].map(() => ({
      up: capsule(0.052, 0.2, C.sweater),
      lo: capsule(0.045, 0.18, C.sweater),
      hand: mesh(new THREE.SphereGeometry(0.048, 14, 10), mat(C.skin, 0.7)),
    }));
    this.leg = [0, 1].map(() => ({
      up: capsule(0.075, 0.22, C.pants),
      lo: capsule(0.065, 0.22, C.pants),
      foot: rbox(0.11, 0.07, 0.2, 0.03, C.white, 0.6),
    }));
    for (const a of [...this.arm, ...this.leg]) for (const k in a) scene.add(a[k]);
    this.L = { up: 0.3, lo: 0.28, thigh: 0.36, shin: 0.35 };
    this.handPos = [v3(), v3()];
  }

  // state: {pos:V3(x,0,z), yaw, walk:0..1, phase, lean, headPitch, headYaw, bob, hand:[V3|null,V3|null], visible}
  update(st) {
    const vis = st.visible !== false;
    this.root.visible = vis;
    for (const a of [...this.arm, ...this.leg]) for (const k in a) a[k].visible = vis;
    if (!vis) return;
    const walk = st.walk || 0;
    const ph = (st.phase || 0) * Math.PI * 2;
    this.root.position.copy(st.pos);
    this.root.rotation.y = st.yaw;
    const bob = walk * Math.abs(Math.sin(ph)) * 0.035 + (st.bob || 0);
    this.hips.position.y = 0.76 + bob - walk * 0.02;
    this.hips.rotation.y = walk * Math.sin(ph) * 0.08;
    this.torso.rotation.x = (st.lean || 0) + walk * 0.05;
    this.torso.rotation.z = walk * Math.sin(ph) * 0.03 + (st.sway || 0);
    this.head.rotation.x = st.headPitch || 0;
    this.head.rotation.y = st.headYaw || 0;
    this.head.rotation.z = st.headRoll || 0;
    this.root.updateMatrixWorld(true);
    const toW = (x, y, z) => v3(x, y, z).applyMatrix4(this.root.matrixWorld);
    const dirW = (x, y, z) => v3(x, y, z).transformDirection(this.root.matrixWorld);

    // legs
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      const p = ph + (i ? Math.PI : 0);
      const fz = walk * Math.sin(p) * 0.17 + (st.footZ ? st.footZ[i] : 0);
      const lift = walk * Math.max(0, Math.cos(p)) * 0.07;
      const F = toW(s * 0.1, 0.075 + lift, fz);
      const Hp = this.hipJ[i].getWorldPosition(v3());
      const { E, T } = ik(Hp, F, this.L.thigh, this.L.shin, dirW(0, 0, 1));
      const g = this.leg[i];
      placeLimb(g.up, Hp, E);
      placeLimb(g.lo, E, T);
      g.foot.position.copy(T).add(v3(0, -0.04, 0)).add(dirW(0, 0, 1).multiplyScalar(0.05));
      g.foot.rotation.set(0, st.yaw, 0);
    }
    // arms
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      const S = this.shoulders[i].getWorldPosition(v3());
      let T = st.hand && st.hand[i];
      if (!T) {
        const sw = walk * Math.sin(ph + (i ? 0 : Math.PI)) * 0.14;
        T = toW(s * 0.25, 0.72 + bob, 0.05 + sw);
      }
      const pole = dirW(s * 0.7, -0.4, -0.8);
      const r = ik(S, T, this.L.up, this.L.lo, pole);
      const g = this.arm[i];
      placeLimb(g.up, S, r.E);
      placeLimb(g.lo, r.E, r.T);
      g.hand.position.copy(r.T);
      this.handPos[i].copy(r.T);
    }
  }
}
