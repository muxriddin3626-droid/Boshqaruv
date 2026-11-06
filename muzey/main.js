import * as THREE from "three";

const CFG = Object.assign(
  { title: "Xotiralar muzeyi", subtitle: "", startButton: "Kirish", welcome: "", finalTitle: "", finalMessage: "", music: "", photos: [] },
  window.MUZEY_CONFIG || {}
);
if (!CFG.photos.length) CFG.photos = Array.from({ length: 6 }, () => ({ src: "", caption: "" }));

// ---------- Asosiy o'lchamlar ----------
const ROOM_W = 8;          // xona eni (x: -4 .. 4)
const ROOM_H = 4.2;        // devor balandligi
const HALF = ROOM_W / 2;
const STEP = 2.7;          // rasmlar orasidagi masofa (z bo'yicha)
const START_Z = 5;         // pingvin boshlang'ich joyi
const BACK_Z = 8;          // orqa devor
const sideCount = CFG.photos.length > 2 ? CFG.photos.length - 1 : CFG.photos.length; // oxirgisi — ro'paradagi devorda
const LAST_SIDE_Z = -(sideCount - 1) * STEP;
const END_Z = LAST_SIDE_Z - 7.5; // oxirgi devor
const ROOM_LEN = BACK_Z - END_Z;
const MID_Z = (BACK_Z + END_Z) / 2;

// ---------- Renderer, sahna, kamera ----------
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x3a2414);
scene.fog = new THREE.Fog(0xd9b07a, 18, 45);

const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 100);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < h ? 68 : 55;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// ---------- Yorug'lik ----------
scene.add(new THREE.HemisphereLight(0xfff0d8, 0x9a7650, 1.35));
scene.add(new THREE.AmbientLight(0xffe2bc, 0.35));
for (let z = BACK_Z - 3; z > END_Z; z -= 7) {
  const p = new THREE.PointLight(0xffc98a, 14, 11, 1.6);
  p.position.set(0, ROOM_H - 0.4, z);
  scene.add(p);
}

// ---------- Kanvas teksturalar ----------
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

const floorTex = canvasTex(1024, 1024, (g, w, h) => {
  g.fillStyle = "#ecd7b8"; g.fillRect(0, 0, w, h);
  // marmar tomirlari
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = `rgba(150,115,80,${0.06 + Math.random() * 0.1})`;
    g.lineWidth = 0.6 + Math.random() * 1.6;
    g.beginPath();
    let x = Math.random() * w, y = Math.random() * h;
    g.moveTo(x, y);
    for (let k = 0; k < 8; k++) { x += (Math.random() - 0.3) * 160; y += (Math.random() - 0.5) * 120; g.lineTo(x, y); }
    g.stroke();
  }
  // plitka choklari
  g.strokeStyle = "rgba(170,135,95,.25)"; g.lineWidth = 2;
  for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * w / 2, 0); g.lineTo(i * w / 2, h); g.stroke(); g.beginPath(); g.moveTo(0, i * h / 2); g.lineTo(w, i * h / 2); g.stroke(); }
}, [ROOM_W / 4, ROOM_LEN / 4]);

const wallTex = canvasTex(512, 512, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, "#fff0d2"); grd.addColorStop(0.25, "#f7dfb7"); grd.addColorStop(1, "#ecc994");
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
});

const glowTex = canvasTex(256, 256, (g, w, h) => {
  const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  grd.addColorStop(0, "rgba(255,236,190,1)"); grd.addColorStop(0.4, "rgba(255,214,150,.45)"); grd.addColorStop(1, "rgba(255,200,130,0)");
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
});

// devordagi yorug'lik "konusi" (rasm ustidagi chiroqdan)
const washTex = canvasTex(256, 256, (g, w, h) => {
  const grd = g.createRadialGradient(w / 2, h * 0.02, 0, w / 2, h * 0.05, w / 2);
  grd.addColorStop(0, "rgba(255,248,225,1)"); grd.addColorStop(0.35, "rgba(255,226,170,.55)"); grd.addColorStop(1, "rgba(255,210,150,0)");
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
});

// ship ostidagi yashirin chiroq (cove light) nuri
const coveTex = canvasTex(16, 256, (g, w, h) => {
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, "rgba(255,246,220,1)"); grd.addColorStop(0.3, "rgba(255,222,165,.5)"); grd.addColorStop(1, "rgba(255,210,150,0)");
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
});

function placeholderTex(i) {
  return canvasTex(600, 800, (g, w, h) => {
    const hues = [[255, 214, 222], [214, 230, 255], [255, 236, 200], [220, 245, 225], [240, 220, 255]];
    const [r, gg, b] = hues[i % hues.length];
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, `rgb(${r},${gg},${b})`); grd.addColorStop(1, `rgb(${r - 30},${gg - 30},${b - 20})`);
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.font = "200px serif"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("❤️", w / 2, h / 2 - 60);
    g.fillStyle = "rgba(90,50,40,.75)"; g.font = "bold 46px sans-serif";
    g.fillText(`Rasm ${i + 1}`, w / 2, h / 2 + 110);
    g.font = "28px sans-serif";
    g.fillText("photos/ papkaga qo'ying", w / 2, h / 2 + 165);
  });
}

// ---------- Materiallar ----------
const M = {
  floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.35, metalness: 0.05 }),
  wall: new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0xfff0d6, emissive: 0xffe0b0, emissiveIntensity: 0.5, roughness: 1 }),
  cove: new THREE.MeshBasicMaterial({ color: 0xfff3d6 }),
  frame: new THREE.MeshStandardMaterial({ color: 0x9a6a3a, roughness: 0.45, metalness: 0.35 }),
  mat: new THREE.MeshStandardMaterial({ color: 0xf7f1e6, roughness: 0.9 }),
  lampBar: new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.5, metalness: 0.4 }),
  red: new THREE.MeshStandardMaterial({ color: 0xc8101c, roughness: 0.55 }),
  redDark: new THREE.MeshStandardMaterial({ color: 0x8a0a12, roughness: 0.6 }),
  green: new THREE.MeshStandardMaterial({ color: 0x2f5a22, roughness: 0.8 }),
  white: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xf3e3c8, roughness: 0.8 }),
  wax: new THREE.MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.6, emissive: 0x553311, emissiveIntensity: 0.25 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.22 }),
  flame: new THREE.MeshBasicMaterial({ color: 0xffc35a }),
  balloon: new THREE.MeshStandardMaterial({ color: 0xd80f1e, roughness: 0.18, metalness: 0.1 }),
  balloonW: new THREE.MeshStandardMaterial({ color: 0xfff7ef, roughness: 0.25 }),
  orb: new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffd9a0, emissiveIntensity: 0.9, roughness: 0.3 }),
  carpet: new THREE.MeshStandardMaterial({ color: 0xb00d18, roughness: 0.95 }),
  string: new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }),
};

const additive = (map, opacity = 1) =>
  new THREE.MeshBasicMaterial({ map, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });

// ---------- Xona ----------
const room = new THREE.Group();
scene.add(room);

const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_LEN), M.floor);
floor.rotation.x = -Math.PI / 2; floor.position.z = MID_Z;
room.add(floor);

const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_LEN), M.ceiling);
ceil.rotation.x = Math.PI / 2; ceil.position.set(0, ROOM_H, MID_Z);
room.add(ceil);

function wall(w, x, z, rotY) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, ROOM_H), M.wall);
  m.position.set(x, ROOM_H / 2, z); m.rotation.y = rotY;
  room.add(m);
  // cove: ship tagidagi yorug' chiziq + devorga tushgan nur
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.06), M.cove);
  strip.position.set(x, ROOM_H - 0.18, z); strip.rotation.y = rotY; strip.translateZ(0.02);
  room.add(strip);
  const wash = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.3), additive(coveTex, 0.55));
  wash.position.set(x, ROOM_H - 0.85, z); wash.rotation.y = rotY; wash.translateZ(0.015);
  room.add(wash);
  // pastki plintus
  const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.03), M.cream);
  base.position.set(x, 0.06, z); base.rotation.y = rotY; base.translateZ(0.015);
  room.add(base);
}
wall(ROOM_LEN, -HALF, MID_Z, Math.PI / 2);   // chap
wall(ROOM_LEN, HALF, MID_Z, -Math.PI / 2);   // o'ng
wall(ROOM_W, 0, END_Z, 0);                   // oxirgi devor
wall(ROOM_W, 0, BACK_Z, Math.PI);            // orqa devor

// ship ostidagi pastroq "pog'ona" (cove ichi)
const coveCeil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W - 1.2, ROOM_LEN - 1.2), new THREE.MeshBasicMaterial({ color: 0xf2d6ab }));
coveCeil.rotation.x = Math.PI / 2; coveCeil.position.set(0, ROOM_H - 0.01, MID_Z);
room.add(coveCeil);

// ---------- Rasmlar (ramkalar) ----------
const loader = new THREE.TextureLoader();
const frames = []; // {group, photoMesh, viewPoint, caption, baseH}

function makeFrame(i, pos, rotY, maxH) {
  const g = new THREE.Group();
  g.position.copy(pos); g.rotation.y = rotY;
  room.add(g);

  const outer = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.09), M.frame);
  const inner = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.1), M.mat);
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0.12 }));
  photo.position.z = 0.056;
  g.add(outer, inner, photo);

  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.05, 0.14), M.lampBar);
  g.add(bar);
  const wash = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 3.6), additive(washTex, 0.7));
  wash.position.z = 0.01;
  g.add(wash);

  const f = { group: g, outer, inner, photo, bar, wash, maxH, caption: CFG.photos[i]?.caption || "" };
  f.viewPoint = new THREE.Vector3(0, 0, 2.3).applyEuler(new THREE.Euler(0, rotY, 0)).add(pos);
  f.viewPoint.y = 0;
  frames.push(f);
  setFrameTexture(f, placeholderTex(i));
  const src = CFG.photos[i]?.src;
  if (src) loader.load(src, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; setFrameTexture(f, t); }, undefined, () => {});
  return f;
}

function setFrameTexture(f, tex) {
  const img = tex.image;
  const aspect = img && img.width ? img.width / img.height : 0.75;
  let h = f.maxH, w = h * aspect;
  if (w > f.maxH * 1.25) { w = f.maxH * 1.25; h = w / aspect; }
  f.photo.material.map = tex; f.photo.material.emissiveMap = tex; f.photo.material.needsUpdate = true;
  f.photo.scale.set(w, h, 1);
  f.inner.scale.set(w + 0.1, h + 0.1, 1);
  f.outer.scale.set(w + 0.26, h + 0.26, 1);
  f.bar.position.set(0, h / 2 + 0.42, 0.07);
  f.wash.position.y = h / 2 + 0.42 - 1.6;
}

for (let i = 0; i < sideCount; i++) {
  const left = i % 2 === 0;
  const z = -i * STEP;
  const pos = new THREE.Vector3(left ? -HALF + 0.06 : HALF - 0.06, 2.05, z);
  makeFrame(i, pos, left ? Math.PI / 2 : -Math.PI / 2, 1.55);
}
if (CFG.photos.length > sideCount) {
  makeFrame(CFG.photos.length - 1, new THREE.Vector3(0, 2.15, END_Z + 0.06), 0, 1.9);
}

// ---------- Bezaklar ----------
const colliders = []; // {x,z,r}
const animated = { candles: [], balloons: [], orbs: [] };

const geo = {
  bloom: new THREE.SphereGeometry(0.075, 10, 8),
  petalBloom: new THREE.SphereGeometry(0.05, 8, 6),
  leaf: new THREE.SphereGeometry(0.06, 6, 4),
  orb: new THREE.SphereGeometry(1, 24, 16),
};

function roseBush(x, z, scale = 1, white = false) {
  const g = new THREE.Group();
  g.position.set(x, 0, z); g.scale.setScalar(scale);
  const n = 9 + Math.floor(Math.random() * 6);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 0.28;
    const hgt = 0.35 + Math.random() * 0.75;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, hgt, 4), M.green);
    const bx = Math.cos(a) * r, bz = Math.sin(a) * r;
    stem.position.set(bx * 0.5, hgt / 2, bz * 0.5);
    stem.lookAt(bx, hgt, bz); stem.rotateX(Math.PI / 2);
    g.add(stem);
    const bloom = new THREE.Mesh(geo.bloom, white ? M.white : (Math.random() < 0.3 ? M.redDark : M.red));
    bloom.position.set(bx, hgt, bz); bloom.scale.set(1, 0.8, 1);
    g.add(bloom);
    if (Math.random() < 0.6) {
      const leaf = new THREE.Mesh(geo.leaf, M.green);
      leaf.position.set(bx * 0.7, hgt * 0.6, bz * 0.7); leaf.scale.set(1, 0.35, 0.6);
      leaf.rotation.set(Math.random(), Math.random() * 3, Math.random());
      g.add(leaf);
    }
  }
  room.add(g);
  colliders.push({ x, z, r: 0.35 * scale });
  return g;
}

function flowerPedestal(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 1.0, 20), M.cream);
  ped.position.y = 0.5;
  const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.08, 0.3, 16), M.glass);
  vase.position.y = 1.15;
  g.add(ped, vase);
  for (let i = 0; i < 22; i++) {
    const b = new THREE.Mesh(geo.bloom, i % 5 === 0 ? M.green : M.white);
    const a = Math.random() * Math.PI * 2, r = Math.random() * 0.25;
    b.position.set(Math.cos(a) * r, 1.4 + Math.random() * 0.3 - r * 0.4, Math.sin(a) * r);
    b.scale.setScalar(0.8 + Math.random() * 0.6);
    g.add(b);
  }
  room.add(g);
  colliders.push({ x, z, r: 0.35 });
}

function candle(x, z, h = 0.25 + Math.random() * 0.25, glass = true) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, h, 14), M.wax);
  body.position.y = h / 2;
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), M.flame);
  flame.scale.set(1, 1.9, 1); flame.position.y = h + 0.04;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb860, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9 }));
  glow.scale.setScalar(0.45); glow.position.y = h + 0.05;
  g.add(body, flame, glow);
  if (glass) {
    const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, h + 0.16, 16, 1, true), M.glass);
    gl.position.y = (h + 0.16) / 2;
    g.add(gl);
  }
  room.add(g);
  animated.candles.push({ flame, glow, seed: Math.random() * 100 });
}

function balloon(x, z, white = false, floatH = null) {
  const g = new THREE.Group();
  const r = 0.26 + Math.random() * 0.08;
  const baseY = floatH ?? r;
  g.position.set(x, baseY, z);
  const b = new THREE.Mesh(geo.orb, white ? M.balloonW : M.balloon);
  b.scale.set(r, r * 1.08, r);
  g.add(b);
  if (floatH) {
    const pts = [new THREE.Vector3(0, -r, 0), new THREE.Vector3(0.05, -r - 0.6, 0.02), new THREE.Vector3(-0.03, -baseY, 0)];
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.CatmullRomCurve3(pts).getPoints(12)), M.string));
  }
  room.add(g);
  animated.balloons.push({ g, baseY, seed: Math.random() * 10, floating: !!floatH });
  if (!floatH) colliders.push({ x, z, r: r + 0.05 });
}

function floorOrb(x, z, r = 0.2) {
  const o = new THREE.Mesh(geo.orb, M.orb);
  o.scale.setScalar(r); o.position.set(x, r, z);
  room.add(o);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffd9a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
  glow.scale.setScalar(r * 5); glow.position.set(x, r, z);
  room.add(glow);
  colliders.push({ x, z, r: r + 0.05 });
}

function hangingOrb(x, z, y) {
  const r = 0.16 + Math.random() * 0.1;
  const o = new THREE.Mesh(geo.orb, M.orb);
  o.scale.setScalar(r); o.position.set(x, y, z);
  room.add(o);
  room.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, y + r, z), new THREE.Vector3(x, ROOM_H, z)]), M.string));
  animated.orbs.push({ o, y, seed: Math.random() * 10 });
}

// Bezaklarni rasmlar orasiga joylash
const rnd = (a, b) => a + Math.random() * (b - a);
for (let i = 0; i < sideCount; i++) {
  const left = i % 2 === 0;
  const s = left ? -1 : 1;
  const z = -i * STEP;
  // rasm ostida gullar va shamlar
  roseBush(s * (HALF - 0.45), z + 0.95, rnd(0.9, 1.25));
  candle(s * (HALF - 0.35), z - 0.6);
  candle(s * (HALF - 0.6), z - 0.85, 0.2);
  if (i % 3 === 1) flowerPedestal(-s * (HALF - 0.5), z + 0.2);
  if (i % 3 === 2) floorOrb(-s * (HALF - 0.5), z + 0.4, 0.22);
  if (i % 2 === 1) balloon(-s * (HALF - 0.7), z - 1.0, Math.random() < 0.3);
  if (i % 2 === 0) hangingOrb(rnd(-1.5, 1.5), z - 1.2, rnd(2.9, 3.5));
}
// kirish qismi
roseBush(-HALF + 0.5, BACK_Z - 1.2, 1.2); roseBush(HALF - 0.5, BACK_Z - 1.2, 1.2);
balloon(HALF - 0.9, START_Z + 0.3); balloon(-HALF + 0.9, START_Z - 0.5, true);
floorOrb(-HALF + 0.55, START_Z + 1.5, 0.24);
for (let k = 0; k < 4; k++) hangingOrb(rnd(-2.6, 2.6), rnd(END_Z + 2, BACK_Z - 1), rnd(2.8, 3.6));

// oxiri: qizil gilam, shamlar yo'lagi, sharlar, gullar
const carpetLen = 6;
const carpet = new THREE.Mesh(new THREE.PlaneGeometry(3.2, carpetLen), M.carpet);
carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.006, END_Z + carpetLen / 2 + 0.3);
room.add(carpet);
for (let k = 0; k < 4; k++) {
  candle(-1.9, END_Z + 1 + k * 1.5, 0.35); candle(1.9, END_Z + 1 + k * 1.5, 0.35);
}
roseBush(-2.9, END_Z + 0.7, 1.4); roseBush(2.9, END_Z + 0.7, 1.4);
flowerPedestal(-3.3, END_Z + 2.6); flowerPedestal(3.3, END_Z + 2.6);
for (let k = 0; k < 7; k++) balloon(rnd(-3.2, 3.2), END_Z + rnd(0.6, 2.2), Math.random() < 0.3, rnd(2.6, 3.6));
balloon(-3.2, END_Z + 4.3); balloon(3.1, END_Z + 3.9, true);

// atirgul yaproqlari polda
{
  const count = 520;
  const petals = new THREE.InstancedMesh(new THREE.CircleGeometry(0.045, 6), new THREE.MeshStandardMaterial({ color: 0xb30f1a, roughness: 0.7, side: THREE.DoubleSide }), count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const nearEnd = i < 200;
    p.set(rnd(-HALF + 0.3, HALF - 0.3), 0.004 + Math.random() * 0.004, nearEnd ? rnd(END_Z + 0.5, END_Z + 7) : rnd(END_Z + 1, BACK_Z - 0.5));
    e.set(-Math.PI / 2 + rnd(-0.2, 0.2), 0, Math.random() * Math.PI * 2);
    q.setFromEuler(e); s.set(1, rnd(0.6, 1.2), 1);
    m4.compose(p, q, s);
    petals.setMatrixAt(i, m4);
  }
  room.add(petals);
}

// havoda suzuvchi uchqunlar
const sparkCount = 160;
const sparkGeo = new THREE.BufferGeometry();
const sparkPos = new Float32Array(sparkCount * 3);
for (let i = 0; i < sparkCount; i++) {
  sparkPos[i * 3] = rnd(-HALF, HALF); sparkPos[i * 3 + 1] = rnd(0.2, ROOM_H); sparkPos[i * 3 + 2] = rnd(END_Z, BACK_Z);
}
sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ map: glowTex, size: 0.09, color: 0xfff3d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
scene.add(sparks);

// ---------- Pingvin ----------
function makePenguin() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  // yumshoq o'yinchoq ko'rinishi uchun roughness yuqori
  const black = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 1, sheen: 1 });
  const whiteM = new THREE.MeshStandardMaterial({ color: 0xf6f3ee, roughness: 1 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xf07a12, roughness: 0.7 });
  const eye = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.2 });

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), black);
  torso.scale.set(1, 1.15, 0.92); torso.position.y = 0.62;
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), whiteM);
  belly.scale.set(0.95, 1.08, 0.7); belly.position.set(0, 0.56, 0.2);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 24), black);
  head.scale.set(1, 0.92, 0.95); head.position.y = 1.2;
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.31, 32, 24), whiteM);
  face.scale.set(1.1, 0.85, 0.6); face.position.set(0, 1.16, 0.2);
  body.add(torso, belly, head, face);

  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), eye);
    e.position.set(s * 0.12, 1.24, 0.38);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    shine.position.set(s * 0.12 + 0.015, 1.255, 0.425);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffa6a6, transparent: true, opacity: 0.6 }));
    cheek.scale.set(1, 0.6, 0.3); cheek.position.set(s * 0.2, 1.12, 0.33);
    body.add(e, shine, cheek);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 12), orange);
  beak.rotation.x = Math.PI / 2; beak.scale.set(1.3, 1, 0.7); beak.position.set(0, 1.13, 0.43);
  body.add(beak);

  const flippers = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.45, 0.85, 0);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), black);
    fl.scale.set(0.28, 1, 0.55); fl.position.set(s * 0.04, -0.2, 0);
    pivot.add(fl);
    pivot.rotation.z = s * 0.35;
    body.add(pivot);
    flippers.push({ pivot, s });
  }
  const feet = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), orange);
    f.scale.set(1, 0.35, 1.5); f.position.set(s * 0.2, 0.04, 0.12);
    root.add(f);
    feet.push({ f, s });
  }
  // soya
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 24), new THREE.MeshBasicMaterial({ color: 0x3a2010, transparent: true, opacity: 0.28, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.008; shadow.scale.set(1, 0.85, 1);
  root.add(shadow);

  root.scale.setScalar(0.8);
  return { root, body, flippers, feet };
}

const peng = makePenguin();
scene.add(peng.root);
const P = { pos: new THREE.Vector3(0, 0, START_Z), yaw: Math.PI, vel: 0, phase: 0, hop: 0, hopT: 0 };
let camYaw = Math.PI;
camera.position.set(0, 2.35, START_Z + 3.6);

// ---------- Boshqaruv ----------
const keys = {};
window.addEventListener("keydown", (e) => { keys[e.key.toLowerCase()] = true; });
window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

const joy = { x: 0, y: 0, id: null };
const joyEl = document.getElementById("joystick");
const knob = document.getElementById("knob");
function joyMove(e) {
  const r = joyEl.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const max = r.width / 2 - 10, len = Math.hypot(dx, dy);
  if (len > max) { dx *= max / len; dy *= max / len; }
  knob.style.transform = `translate(${dx}px, ${dy}px)`;
  joy.x = dx / max; joy.y = -dy / max;
}
joyEl.addEventListener("pointerdown", (e) => { joy.id = e.pointerId; joyEl.setPointerCapture(e.pointerId); joyMove(e); hideHint(); });
joyEl.addEventListener("pointermove", (e) => { if (e.pointerId === joy.id) joyMove(e); });
const joyEnd = (e) => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; knob.style.transform = ""; };
joyEl.addEventListener("pointerup", joyEnd);
joyEl.addEventListener("pointercancel", joyEnd);

function readInput() {
  let x = joy.x, y = joy.y;
  if (keys["w"] || keys["arrowup"] || keys["ц"]) y += 1;
  if (keys["s"] || keys["arrowdown"] || keys["ы"]) y -= 1;
  if (keys["a"] || keys["arrowleft"] || keys["ф"]) x -= 1;
  if (keys["d"] || keys["arrowright"] || keys["в"]) x += 1;
  const l = Math.hypot(x, y);
  if (l > 1) { x /= l; y /= l; }
  if (l > 0.1) hideHint();
  return { x, y, l: Math.min(l, 1) };
}

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const captionEl = $("caption");
let captionText = "", captionUntil = 0;
function showCaption(text, holdMs = 0) {
  if (text !== captionText) { captionEl.textContent = text; captionText = text; }
  captionEl.classList.toggle("show", !!text);
  captionUntil = holdMs ? performance.now() + holdMs : 0;
}
let hintHidden = false;
function hideHint() { if (hintHidden) return; hintHidden = true; $("hint").style.opacity = 0; }
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.tm); toast.tm = setTimeout(() => t.classList.remove("show"), 3200); }

document.title = CFG.title;
$("introTitle").textContent = CFG.title;
$("introSub").textContent = CFG.subtitle;
$("btnStart").textContent = CFG.startButton;
$("finalTitle").textContent = CFG.finalTitle;
$("finalMessage").textContent = CFG.finalMessage;
$("loading").textContent = "";

let audio = null;
if (CFG.music) { audio = new Audio(CFG.music); audio.loop = true; audio.volume = 0.6; } else $("btnMusic").classList.add("hidden");
$("btnMusic").onclick = () => {
  if (!audio) return;
  if (audio.paused) { audio.play().catch(() => {}); $("btnMusic").textContent = "🔊"; } else { audio.pause(); $("btnMusic").textContent = "🔇"; }
};

let started = false;
$("btnStart").onclick = () => {
  $("intro").classList.add("hidden");
  $("topbar").classList.remove("hidden");
  $("joystick").classList.remove("hidden");
  $("hint").classList.remove("hidden");
  started = true;
  if (audio) audio.play().catch(() => {});
  if (CFG.welcome) setTimeout(() => showCaption(CFG.welcome, 3500), 600);
};

$("btnPhotos").onclick = () => $("fileInput").click();
$("fileInput").onchange = (e) => {
  const files = [...e.target.files].filter((f) => f.type.startsWith("image/"));
  files.slice(0, frames.length).forEach((file, i) => {
    const order = frameOrder[i];
    loader.load(URL.createObjectURL(file), (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; setFrameTexture(frames[order], t); });
  });
  if (files.length) toast("Rasmlar faqat shu qurilmada ko'rinadi. Doimiy qilish uchun ularni photos/ papkaga qo'ying.");
  e.target.value = "";
};
// tanlangan rasmlar tartibi: kirishdan oxirigacha
const frameOrder = frames.map((_, i) => i);

$("btnShare").onclick = async () => {
  const url = location.href;
  try {
    if (navigator.share) await navigator.share({ title: CFG.title, url });
    else { await navigator.clipboard.writeText(url); toast("Havola nusxalandi ✅"); }
  } catch { /* bekor qilindi */ }
};

let finalShown = false, finalOpen = false;
$("btnFinalClose").onclick = () => { $("final").classList.add("hidden"); finalOpen = false; };

// ---------- To'qnashuv ----------
const PR = 0.42;
function collide(p) {
  p.x = THREE.MathUtils.clamp(p.x, -HALF + PR, HALF - PR);
  p.z = THREE.MathUtils.clamp(p.z, END_Z + PR + 0.3, BACK_Z - PR);
  for (const c of colliders) {
    const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), min = c.r + PR;
    if (d < min && d > 1e-4) { p.x = c.x + dx / d * min; p.z = c.z + dz / d * min; }
  }
}

// ---------- Asosiy sikl ----------
const clock = new THREE.Clock();
const tmpV = new THREE.Vector3(), camTarget = new THREE.Vector3(), lookTarget = new THREE.Vector3(), curLook = new THREE.Vector3(0, 1.4, START_Z - 2);
let activeFrame = null;

function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * t;
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // --- harakat
  const inp = started && !finalOpen ? readInput() : { x: 0, y: 0, l: 0 };
  if (inp.l > 0.05) {
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
    const mx = fx * inp.y + rx * inp.x, mz = fz * inp.y + rz * inp.x;
    const targetYaw = Math.atan2(mx, mz);
    P.yaw = angleLerp(P.yaw, targetYaw, 1 - Math.exp(-8 * dt));
    P.vel = THREE.MathUtils.lerp(P.vel, 2.1 * inp.l, 1 - Math.exp(-6 * dt));
  } else {
    P.vel = THREE.MathUtils.lerp(P.vel, 0, 1 - Math.exp(-8 * dt));
  }
  P.pos.x += Math.sin(P.yaw) * P.vel * dt;
  P.pos.z += Math.cos(P.yaw) * P.vel * dt;
  collide(P.pos);
  // kamera sekin pingvin orqasiga buriladi (orqaga yurganda emas)
  if (P.vel > 0.2 && inp.y > -0.3) camYaw = angleLerp(camYaw, P.yaw, 1 - Math.exp(-1.6 * dt));

  // --- pingvin animatsiyasi (lapanglab yurish)
  const moving = P.vel / 2.1;
  P.phase += dt * (3 + 9 * moving);
  const sw = Math.sin(P.phase);
  if (P.hopT > 0) { P.hopT -= dt; P.hop = Math.max(0, Math.sin((1 - P.hopT / 0.9) * Math.PI * 2)) * 0.25; } else P.hop = 0;
  peng.root.position.set(P.pos.x, P.hop, P.pos.z);
  peng.root.rotation.y = P.yaw;
  peng.body.rotation.z = sw * 0.13 * moving + Math.sin(t * 1.5) * 0.02 * (1 - moving);
  peng.body.position.y = Math.abs(sw) * 0.05 * moving + Math.sin(t * 2) * 0.008;
  peng.body.rotation.x = 0.06 * moving;
  for (const { pivot, s } of peng.flippers) {
    const flap = P.hopT > 0 ? Math.sin(t * 22) * 0.5 + 0.6 : 0.15 * moving * Math.sin(P.phase + (s > 0 ? 0 : Math.PI));
    pivot.rotation.z = s * (0.3 + Math.max(0, flap));
  }
  for (const { f, s } of peng.feet) {
    f.position.z = 0.12 + Math.sin(P.phase + (s > 0 ? 0 : Math.PI)) * 0.12 * moving;
    f.position.y = 0.04 + Math.max(0, Math.sin(P.phase + (s > 0 ? 0 : Math.PI))) * 0.05 * moving;
  }

  // --- kamera
  const dist = 3.6, hgt = 2.35;
  camTarget.set(P.pos.x - Math.sin(camYaw) * dist, hgt, P.pos.z - Math.cos(camYaw) * dist);
  camTarget.x = THREE.MathUtils.clamp(camTarget.x, -HALF + 0.25, HALF - 0.25);
  camTarget.z = THREE.MathUtils.clamp(camTarget.z, END_Z + 0.3, BACK_Z - 0.25);
  camera.position.lerp(camTarget, 1 - Math.exp(-4 * dt));
  lookTarget.set(P.pos.x + Math.sin(camYaw) * 2.6, 1.35, P.pos.z + Math.cos(camYaw) * 2.6);
  curLook.lerp(lookTarget, 1 - Math.exp(-5 * dt));
  camera.lookAt(curLook);

  // --- yaqin rasm -> yozuv
  let best = null, bestD = 1.9;
  for (const f of frames) {
    const d = Math.hypot(P.pos.x - f.viewPoint.x, P.pos.z - f.viewPoint.z);
    if (d < bestD) { bestD = d; best = f; }
  }
  if (best !== activeFrame) {
    activeFrame = best;
    if (best && best.caption) P.hopT = 0.9; // xursand sakrash
  }
  if (performance.now() > captionUntil) showCaption(activeFrame ? activeFrame.caption : "");

  // --- yakuniy xabar
  if (started && !finalShown && P.pos.z < END_Z + 3.2) {
    finalShown = finalOpen = true;
    P.hopT = 0.9;
    setTimeout(() => $("final").classList.remove("hidden"), 700);
  }
  if (finalShown && !finalOpen && P.pos.z > END_Z + 6) finalShown = false;

  // --- bezak animatsiyalari
  for (const c of animated.candles) {
    const k = 0.85 + Math.sin(t * 13 + c.seed) * 0.08 + Math.sin(t * 7.3 + c.seed * 2) * 0.07;
    c.flame.scale.set(k, 1.9 * k, k);
    c.glow.material.opacity = 0.65 + (k - 0.85) * 2;
  }
  for (const b of animated.balloons) {
    b.g.position.y = b.baseY + (b.floating ? Math.sin(t * 0.9 + b.seed) * 0.08 : 0);
    b.g.rotation.z = Math.sin(t * 0.7 + b.seed) * 0.06;
  }
  for (const o of animated.orbs) o.o.position.y = o.y + Math.sin(t * 0.6 + o.seed) * 0.03;
  const sp = sparkGeo.attributes.position;
  for (let i = 0; i < sparkCount; i++) {
    let y = sp.getY(i) + dt * 0.12;
    if (y > ROOM_H) y = 0.1;
    sp.setY(i, y);
    sp.setX(i, sp.getX(i) + Math.sin(t + i) * dt * 0.05);
  }
  sp.needsUpdate = true;

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
