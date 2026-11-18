import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { BOARD, GROUP_COLORS, TOKENS } from './board.js';

// ---------- Həndəsə ----------
const L = 12.3, H = L / 2, C = 1.65;
const SIDE_ROT = { bottom: 0, left: Math.PI / 2, top: Math.PI, right: -Math.PI / 2 };
const INWARD = { bottom: [0, -1], left: [1, 0], top: [0, 1], right: [-1, 0] };

export function tileInfo(i) {
  let x, z, side, w = 1;
  if (i % 10 === 0) {
    const k = [[1, 1], [-1, 1], [-1, -1], [1, -1]][i / 10];
    x = k[0] * (H - C / 2); z = k[1] * (H - C / 2); side = ['bottom', 'left', 'top', 'right'][i / 10]; w = C;
  } else if (i < 10) { x = H - C - (i - 1) - 0.5; z = H - C / 2; side = 'bottom'; }
  else if (i < 20) { x = -(H - C / 2); z = H - C - (i - 11) - 0.5; side = 'left'; }
  else if (i < 30) { x = -H + C + (i - 21) + 0.5; z = -(H - C / 2); side = 'top'; }
  else { x = H - C / 2; z = -H + C + (i - 31) + 0.5; side = 'right'; }
  return { x, z, side, w, d: C, corner: i % 10 === 0, n: INWARD[side] };
}
function tileAt(x, z) {
  for (let i = 0; i < 40; i++) {
    const t = tileInfo(i);
    const horiz = t.side === 'bottom' || t.side === 'top';
    const hw = (horiz ? t.w : t.d) / 2, hd = (horiz ? t.d : t.w) / 2;
    if (Math.abs(x - t.x) <= hw && Math.abs(z - t.z) <= hd) return i;
  }
  return -1;
}

// ---------- Köməkçi ----------
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...o });
function mesh(geo, material, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; return m;
}
const box = (w, h, d, c, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat(c), x, y, z);
const cyl = (rt, rb, h, c, x, y, z, seg = 20) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c), x, y, z);
const sph = (r, c, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = mesh(new THREE.SphereGeometry(r, 20, 14), mat(c), x, y, z); m.scale.set(sx, sy, sz); return m; };
const cone = (r, h, c, x, y, z, seg = 16) => mesh(new THREE.ConeGeometry(r, h, seg), mat(c), x, y, z);

// ---------- Lövhə teksturası ----------
function wrapLines(ctx, text, maxW) {
  const words = text.split(' '); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } }
  if (cur) lines.push(cur);
  return lines;
}
function fitText(ctx, text, maxW, maxLines, startPx, weight = '800') {
  for (let px = startPx; px >= 10; px -= 1) {
    ctx.font = `${weight} ${px}px "Trebuchet MS", "Segoe UI", sans-serif`;
    const lines = wrapLines(ctx, text, maxW);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW)) return { lines, px };
  }
  ctx.font = '800 10px sans-serif';
  return { lines: wrapLines(ctx, text, maxW), px: 10 };
}

function makeBoardTexture() {
  const S = 2560, k = S / L;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d');
  // Mərkəz: ot + yollar
  const grad = g.createLinearGradient(0, 0, S, S); grad.addColorStop(0, '#86d36f'); grad.addColorStop(1, '#4fa352');
  g.fillStyle = '#cfe8c5'; g.fillRect(0, 0, S, S);
  g.fillStyle = grad; g.fillRect((C) * k, (C) * k, (L - 2 * C) * k, (L - 2 * C) * k);
  const c0 = S / 2, rw = 0.95 * k;
  g.fillStyle = '#59636d';
  g.fillRect(C * k, c0 - rw / 2, (L - 2 * C) * k, rw); g.fillRect(c0 - rw / 2, C * k, rw, (L - 2 * C) * k);
  g.fillStyle = '#f4f1e6';
  for (let p = C * k + 10; p < (L - C) * k - 30; p += 70) { g.fillRect(p, c0 - 4, 34, 8); g.fillRect(c0 - 4, p, 8, 34); }
  g.beginPath(); g.arc(c0, c0, 1.35 * k, 0, Math.PI * 2); g.fillStyle = '#d9d2bd'; g.fill();
  g.lineWidth = 10; g.strokeStyle = '#b8402f'; g.stroke();
  g.fillStyle = '#b8402f'; g.font = `900 ${0.33 * k}px "Trebuchet MS", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.save(); g.translate(c0, c0 - 1.12 * k); g.fillText('MONOPOLY', 0, 0); g.restore();

  // Xanalar
  for (let i = 0; i < 40; i++) {
    const t = tileInfo(i), b = BOARD[i];
    const cx = (t.x + H) * k, cy = (t.z + H) * k;
    const horiz = t.side === 'bottom' || t.side === 'top';
    g.save(); g.translate(cx, cy); g.rotate(SIDE_ROT[t.side]);
    const w = t.w * k, d = t.d * k;       // yerli çərçivə: eni (kənar boyu) və dərinliyi
    g.fillStyle = '#f3f8ec'; g.fillRect(-w / 2, -d / 2, w, d);
    g.lineWidth = 5; g.strokeStyle = '#33473a'; g.strokeRect(-w / 2, -d / 2, w, d);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const name = b.name.toUpperCase();
    if (t.corner) {
      g.fillStyle = '#1b2b21';
      const big = { go: ['GO', '➡️'], jail: ['', '🚔'], park: ['FREE PARKING', '🅿️'], gotojail: ['GO TO JAIL', '👮'] }[b.type];
      if (b.type === 'go') {
        g.fillStyle = '#d8281f'; g.font = `900 ${w * 0.4}px "Trebuchet MS", sans-serif`; g.fillText('GO', 0, -d * 0.05);
        g.fillStyle = '#1b2b21'; g.font = `800 ${w * 0.09}px "Trebuchet MS", sans-serif`; g.fillText('COLLECT ₥200', 0, d * 0.28); g.font = `${w * 0.2}px sans-serif`; g.fillText('⬅️', 0, d * 0.4);
      } else if (b.type === 'jail') {
        g.fillStyle = '#f28c1e'; g.fillRect(-w / 2 + 6, -d / 2 + 6, w * 0.58, d * 0.58);
        g.fillStyle = '#1b2b21'; g.font = `900 ${w * 0.12}px "Trebuchet MS", sans-serif`; g.fillText('IN JAIL', -w * 0.2, -d * 0.2);
        for (let q = 0; q < 4; q++) g.fillRect(-w * 0.43 + q * w * 0.12, -d * 0.43, 6, d * 0.58);
        g.font = `800 ${w * 0.1}px "Trebuchet MS", sans-serif`; g.fillText('JUST', w * 0.2, d * 0.32); g.fillText('VISITING', w * 0.2, d * 0.42);
      } else {
        g.font = `${w * 0.42}px sans-serif`; g.fillText(big[1], 0, -d * 0.05);
        g.font = `900 ${w * 0.12}px "Trebuchet MS", sans-serif`; g.fillStyle = b.type === 'gotojail' ? '#d8281f' : '#1b2b21'; g.fillText(big[0], 0, d * 0.33);
      }
    } else {
      const pad = w * 0.07;
      if (b.type === 'street') {
        g.fillStyle = GROUP_COLORS[b.g]; g.fillRect(-w / 2, -d / 2, w, d * 0.22);
        g.strokeRect(-w / 2, -d / 2, w, d * 0.22);
        g.fillStyle = '#1b2b21';
        const f = fitText(g, name.replace('AVENUE', 'AVE.'), w - pad * 2, 3, 24);
        const y0 = -d * 0.22 + (d * 0.06);
        f.lines.forEach((l, q) => g.fillText(l, 0, y0 + q * f.px * 1.1 + f.px * 0.7));
        g.font = `900 ${w * 0.15}px "Trebuchet MS", sans-serif`; g.fillText('₥' + b.price, 0, d * 0.4);
      } else {
        g.fillStyle = '#1b2b21';
        const icon = { rail: '🚂', util: i === 12 ? '💡' : '🚰', chance: '❓', chest: '🧰', tax: '💎' }[b.type];
        const f = fitText(g, name, w - pad * 2, 3, 22);
        const top = -d * 0.4;
        f.lines.forEach((l, q) => g.fillText(l, 0, top + q * f.px * 1.1 + f.px * 0.5));
        g.font = `${w * 0.42}px sans-serif`;
        if (b.type === 'chance') { g.fillStyle = '#f28c1e'; g.font = `900 ${w * 0.7}px "Trebuchet MS", sans-serif`; g.fillText('?', 0, d * 0.12); }
        else g.fillText(icon, 0, d * 0.1);
        if (b.price || b.amount) { g.fillStyle = '#1b2b21'; g.font = `900 ${w * 0.15}px "Trebuchet MS", sans-serif`; g.fillText('₥' + (b.price || b.amount), 0, d * 0.42); }
      }
    }
    g.restore();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function windowTexture(tint) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = tint; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(30,60,90,.75)';
  for (let y = 6; y < 64; y += 21) for (let x = 6; x < 64; x += 21) g.fillRect(x, y, 12, 14);
  g.fillStyle = 'rgba(255,255,255,.35)';
  for (let y = 6; y < 64; y += 21) for (let x = 6; x < 64; x += 21) g.fillRect(x, y, 12, 3);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function pipTexture(v) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#fdfdfb'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#dcdcd6'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122);
  const P = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[v];
  g.fillStyle = v === 1 ? '#d8281f' : '#1c1c1c';
  for (const p of P) { g.beginPath(); g.arc(30 + (p % 3) * 34, 30 + Math.floor(p / 3) * 34, v === 1 ? 14 : 10, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------- Fiqur modelləri ----------
function buildToken(id, color) {
  const g = new THREE.Group();
  const dark = '#2b2b35';
  switch (id) {
    case 'hat':
      g.add(cyl(0.36, 0.36, 0.06, dark, 0, 0.1, 0, 28), cyl(0.21, 0.23, 0.46, dark, 0, 0.35, 0, 28), cyl(0.235, 0.235, 0.09, '#d8281f', 0, 0.2, 0, 28));
      break;
    case 'car': {
      g.add(box(0.74, 0.17, 0.34, color, 0, 0.2, 0), box(0.34, 0.15, 0.28, '#dff3ff', -0.05, 0.36, 0), box(0.1, 0.1, 0.4, dark, -0.34, 0.37, 0), box(0.2, 0.06, 0.3, '#fff', 0.22, 0.3, 0));
      for (const [x, z] of [[0.24, 0.19], [0.24, -0.19], [-0.24, 0.19], [-0.24, -0.19]]) { const w = cyl(0.1, 0.1, 0.08, '#17171c', x, 0.12, z, 18); w.rotation.x = Math.PI / 2; g.add(w); }
      break;
    }
    case 'cat': {
      g.add(sph(0.24, '#e8a33d', 0, 0.3, 0, 1, 0.95, 1.25), sph(0.17, '#e8a33d', 0, 0.56, 0.24), cone(0.065, 0.13, '#e8a33d', -0.09, 0.73, 0.24, 4), cone(0.065, 0.13, '#e8a33d', 0.09, 0.73, 0.24, 4),
        sph(0.025, '#111', -0.06, 0.58, 0.39), sph(0.025, '#111', 0.06, 0.58, 0.39), sph(0.02, '#e0489a', 0, 0.54, 0.41));
      const tail = cyl(0.04, 0.03, 0.42, '#e8a33d', 0, 0.45, -0.34, 10); tail.rotation.x = -0.5; g.add(tail);
      break;
    }
    case 'dog': {
      g.add(box(0.28, 0.24, 0.56, '#c28a5a', 0, 0.34, 0), box(0.24, 0.22, 0.26, '#c28a5a', 0, 0.56, 0.3), box(0.12, 0.1, 0.14, '#e6c9a8', 0, 0.52, 0.45), sph(0.035, '#111', 0, 0.56, 0.53),
        box(0.06, 0.17, 0.1, '#6b4326', -0.15, 0.58, 0.28), box(0.06, 0.17, 0.1, '#6b4326', 0.15, 0.58, 0.28));
      for (const [x, z] of [[0.09, 0.2], [-0.09, 0.2], [0.09, -0.2], [-0.09, -0.2]]) g.add(cyl(0.045, 0.045, 0.22, '#c28a5a', x, 0.11, z, 10));
      const tail = cyl(0.03, 0.025, 0.3, '#c28a5a', 0, 0.5, -0.33, 8); tail.rotation.x = -0.9; g.add(tail);
      break;
    }
    case 'boot':
      g.add(box(0.28, 0.56, 0.28, '#7a4a28', -0.1, 0.38, 0), box(0.52, 0.2, 0.3, '#7a4a28', 0.05, 0.17, 0), box(0.54, 0.07, 0.32, '#2b1a0d', 0.05, 0.05, 0), box(0.3, 0.07, 0.3, '#9a6538', -0.1, 0.68, 0));
      break;
    case 'ship': {
      g.add(box(0.8, 0.18, 0.3, '#6b7a8c', 0, 0.2, 0), box(0.28, 0.18, 0.24, '#e8eef3', -0.05, 0.38, 0), cyl(0.07, 0.07, 0.24, color, -0.05, 0.58, 0), cyl(0.03, 0.03, 0.34, dark, 0.22, 0.36, 0));
      g.children[g.children.length - 1].rotation.z = Math.PI / 2;
      const bow = cone(0.15, 0.22, '#6b7a8c', 0.5, 0.2, 0, 4); bow.rotation.z = -Math.PI / 2; bow.rotation.y = Math.PI / 4; g.add(bow);
      break;
    }
    case 'thimble': {
      g.add(cyl(0.22, 0.27, 0.42, '#c9d3dc', 0, 0.27, 0, 28), mesh(new THREE.SphereGeometry(0.22, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#c9d3dc'), 0, 0.48, 0), mesh(new THREE.TorusGeometry(0.265, 0.03, 8, 28), mat('#8f9aa5'), 0, 0.07, 0));
      g.children[2].rotation.x = Math.PI / 2;
      for (let a = 0; a < 10; a++) for (const y of [0.3, 0.42, 0.54]) { const m = sph(0.018, '#6c7882', Math.cos(a * 0.628 + y * 3) * 0.225, y, Math.sin(a * 0.628 + y * 3) * 0.225); g.add(m); }
      break;
    }
    case 'wheelbarrow': {
      const tray = box(0.5, 0.16, 0.34, color, 0.04, 0.36, 0); tray.rotation.z = 0.12; g.add(tray);
      const w = cyl(0.13, 0.13, 0.06, '#222', 0.3, 0.14, 0, 18); w.rotation.x = Math.PI / 2; g.add(w);
      for (const z of [-0.12, 0.12]) { const h = box(0.38, 0.04, 0.04, '#8a5a30', -0.28, 0.3, z); h.rotation.z = -0.25; g.add(h); g.add(box(0.04, 0.2, 0.04, '#8a5a30', -0.14, 0.12, z)); }
      break;
    }
    default: g.add(sph(0.25, color, 0, 0.3, 0));
  }
  // əsas disk (oyunçu rəngi)
  const base = cyl(0.36, 0.38, 0.06, color, 0, 0.03, 0, 28);
  const root = new THREE.Group(); root.add(base, g); g.position.y = 0.06;
  root.scale.setScalar(0.95);
  return root;
}

function buildHouse(hotel) {
  const g = new THREE.Group();
  if (hotel) {
    g.add(box(0.46, 0.2, 0.17, '#d8281f', 0, 0.1, 0));
    const roof = cone(0.17, 0.09, '#8f1710', 0, 0.245, 0, 4); roof.rotation.y = Math.PI / 4; roof.scale.set(1.9, 1, 0.7); g.add(roof);
  } else {
    g.add(box(0.17, 0.12, 0.17, '#2fa14a', 0, 0.06, 0));
    const roof = cone(0.15, 0.1, '#1d6e32', 0, 0.17, 0, 4); roof.rotation.y = Math.PI / 4; g.add(roof);
  }
  return g;
}

// ---------- Əsas səhnə ----------
export function createScene(container, { onTile, sfx }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.prepend(renderer.domElement);
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfe6ff);
  scene.fog = new THREE.Fog(0xbfe6ff, 38, 85);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  const DEF_POS = new THREE.Vector3(0, 15, 13.8);
  camera.position.copy(DEF_POS);
  const controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, minDistance: 7, maxDistance: 45, maxPolarAngle: 1.38, target: new THREE.Vector3(0, 0, 0.8) });

  scene.add(new THREE.HemisphereLight(0xffffff, 0x7fae6e, 0.85));
  const sun = new THREE.DirectionalLight(0xfff1d2, 1.35);
  sun.position.set(-7, 15, 9); sun.castShadow = true;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches; // telefonda yüngül kölgə
  sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  // Yer, ot və ətraf
  const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 48), mat('#69b35b', { roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.36; ground.receiveShadow = true; scene.add(ground);
  const ring = new THREE.Mesh(new THREE.RingGeometry(10.5, 13.2, 64), mat('#5d6670', { roughness: 0.9 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = -0.34; ring.receiveShadow = true; scene.add(ring);
  const r0 = rng(11);
  for (let i = 0; i < 46; i++) {
    const a = r0() * Math.PI * 2, rad = 15 + r0() * 22, s = 0.8 + r0() * 0.9;
    const tr = new THREE.Group();
    tr.add(cyl(0.12 * s, 0.16 * s, 0.7 * s, '#7a5230', 0, 0.35 * s - 0.36, 0, 8), cone(0.55 * s, 1.3 * s, r0() > 0.4 ? '#2f8f46' : '#3fa65a', 0, 1.15 * s - 0.36, 0, 9));
    tr.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad); scene.add(tr);
  }
  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group(); const r = r0;
    for (let q = 0; q < 5; q++) { const s = sph(1.2 + r() * 1.2, '#ffffff', q * 1.5 - 3, r() * 0.5, r() * 1.2, 1, 0.6, 1); s.material.transparent = true; s.material.opacity = 0.9; s.castShadow = false; c.add(s); }
    c.position.set((r() - 0.5) * 70, 11 + r() * 5, -20 - r() * 25); scene.add(c); clouds.push(c);
  }

  // Lövhə
  const baseMat = mat('#2e4a35');
  const base = mesh(new THREE.BoxGeometry(L + 0.4, 0.34, L + 0.4), baseMat, 0, -0.17, 0); scene.add(base);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(L, L), new THREE.MeshStandardMaterial({ map: makeBoardTexture(), roughness: 0.8 }));
  top.rotation.x = -Math.PI / 2; top.position.y = 0.002; top.receiveShadow = true; scene.add(top);

  // Şəhər
  const city = new THREE.Group(); scene.add(city);
  const rc = rng(7);
  const palette = ['#bfd8ea', '#d9dee2', '#f2dcae', '#e9b3b3', '#c3dcb4', '#cdbfe8', '#a5c6e0', '#f0e6c8'];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      if (i === 0 && j === 0) continue;
      const cx = sx * (0.95 + i * 0.92), cz = sz * (0.95 + j * 0.92);
      const near = Math.hypot(cx, cz);
      const roll = rc();
      if (roll < 0.68) {
        const w = 0.48 + rc() * 0.28, d = 0.48 + rc() * 0.28;
        const h = (near < 2.3 ? 0.35 + rc() * 0.45 : 0.45 + rc() * 0.95);
        const col = palette[Math.floor(rc() * palette.length)];
        const tex = windowTexture(col); tex.repeat.set(Math.max(1, Math.round(w * 3)), Math.max(1, Math.round(h * 3.4)));
        const side = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.15 });
        const roofM = mat('#8d949b');
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, roofM, roofM, side, side]);
        b.position.set(cx, h / 2, cz); b.castShadow = b.receiveShadow = true; city.add(b);
        if (rc() > 0.55) city.add(box(w * 0.4, 0.14, d * 0.4, '#6c737a', cx, h + 0.07, cz));
      } else if (roll < 0.88) {
        for (let q = 0; q < 3; q++) {
          const s = 0.7 + rc() * 0.6;
          const t = new THREE.Group(); t.add(cyl(0.05 * s, 0.07 * s, 0.3 * s, '#7a5230', 0, 0.15 * s, 0, 6), cone(0.26 * s, 0.6 * s, '#2f8f46', 0, 0.55 * s, 0, 8));
          t.position.set(cx + (rc() - 0.5) * 0.5, 0, cz + (rc() - 0.5) * 0.5); t.children.forEach((m) => (m.castShadow = true)); city.add(t);
        }
      } else {
        city.add(cyl(0.38, 0.38, 0.05, '#8fd3f0', cx, 0.03, cz, 24), cyl(0.42, 0.42, 0.04, '#d9d2bd', cx, 0.015, cz, 24));
      }
    }
  }

  // Dinamik qrup: sahiblik, evlər, girov
  const dyn = { owner: [], houses: [], mort: [] };
  const dynGroup = new THREE.Group(); scene.add(dynGroup);
  const sig = new Array(40).fill('');

  // Zərlər
  const dieGeo = new THREE.BoxGeometry(0.62, 0.62, 0.62);
  const faceVals = [3, 4, 1, 6, 2, 5];
  const dieMats = faceVals.map((v) => new THREE.MeshStandardMaterial({ map: pipTexture(v), roughness: 0.35 }));
  const dice = [0, 1].map(() => { const m = new THREE.Mesh(dieGeo, dieMats); m.castShadow = true; scene.add(m); return m; });
  const REST = [new THREE.Vector3(-0.55, 0.31, 0.15), new THREE.Vector3(0.55, 0.31, -0.2)];
  const faceUp = (v) => {
    const q = new THREE.Quaternion();
    const e = { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2], 2: [-Math.PI / 2, 0, 0], 5: [Math.PI / 2, 0, 0] }[v] || [0, 0, 0];
    return q.setFromEuler(new THREE.Euler(...e));
  };
  let diceAnim = null;
  function placeDice(vals) {
    dice.forEach((d, i) => {
      d.position.copy(REST[i]);
      d.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.7 + 0.4).multiply(faceUp(vals[i] || 1)));
    });
  }
  placeDice([1, 1]);

  // Fiqurlar
  const tokens = []; // { group, ring, cur, tgt, anim, off }
  let blockUntil = 0;
  const walkSpeed = 150;
  const tilePos = (i) => { const t = tileInfo(i); return new THREE.Vector3(t.x, 0, t.z); };
  const ringGeo = new THREE.TorusGeometry(0.5, 0.045, 8, 40);

  function ensureTokens(S) {
    while (tokens.length < S.players.length) {
      const pi = tokens.length, p = S.players[pi];
      const def = TOKENS.find((t) => t.id === p.token) || TOKENS[0];
      const group = buildToken(def.id, def.color);
      const rg = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffe14d })); rg.rotation.x = Math.PI / 2; rg.position.y = 0.05; group.add(rg);
      scene.add(group);
      const pos = tilePos(p.pos); group.position.copy(pos);
      tokens.push({ group, ring: rg, cur: p.pos, tgt: p.pos, anim: null, off: new THREE.Vector3(), tokenId: def.id, steps: 0 });
    }
    S.players.forEach((p, i) => {
      const tk = tokens[i];
      if (tk.tokenId !== p.token) { // fiqur dəyişib (lobbidə)
        scene.remove(tk.group);
        const def = TOKENS.find((t) => t.id === p.token) || TOKENS[0];
        tk.group = buildToken(def.id, def.color); tk.group.add(tk.ring); scene.add(tk.group); tk.tokenId = def.id;
        tk.group.position.copy(tilePos(tk.cur));
      }
    });
  }

  function syncTiles(S) {
    for (let i = 0; i < 40; i++) {
      const pr = S.props[i];
      const key = pr ? `${pr.o}|${pr.h}|${pr.m}|${S.players[pr.o]?.token}` : '';
      if (sig[i] === key) continue;
      sig[i] = key;
      for (const arr of [dyn.owner, dyn.houses, dyn.mort]) { if (arr[i]) { dynGroup.remove(arr[i]); arr[i] = null; } }
      if (!pr) continue;
      const t = tileInfo(i), b = BOARD[i];
      const [nx, nz] = t.n; const tx = -nz, tz = nx;
      const horiz = t.side === 'bottom' || t.side === 'top';
      const colorHex = (TOKENS.find((k) => k.id === S.players[pr.o].token) || TOKENS[0]).color;
      // sahib zolağı (xananın xarici kənarında)
      const bar = box(horiz ? t.w - 0.08 : 0.24, 0.06, horiz ? 0.24 : t.w - 0.08, colorHex, t.x - nx * (t.d / 2 - 0.13), 0.035, t.z - nz * (t.d / 2 - 0.13));
      bar.material.emissive = new THREE.Color(colorHex).multiplyScalar(0.35); // kölgədə qaralmasın
      bar.castShadow = false; dynGroup.add(bar); dyn.owner[i] = bar;
      if (pr.h > 0) {
        const g = new THREE.Group();
        const bandC = t.d / 2 - 0.18;
        if (pr.h === 5) { const h = buildHouse(true); h.position.set(t.x + nx * bandC, 0, t.z + nz * bandC); if (!horiz) h.rotation.y = Math.PI / 2; g.add(h); }
        else for (let q = 0; q < pr.h; q++) {
          const off = (q - (pr.h - 1) / 2) * 0.21;
          const h = buildHouse(false); h.position.set(t.x + nx * bandC + tx * off, 0, t.z + nz * bandC + tz * off); g.add(h);
        }
        dynGroup.add(g); dyn.houses[i] = g;
      }
      if (pr.m) {
        const ov = new THREE.Mesh(new THREE.PlaneGeometry(horiz ? t.w : t.d, horiz ? t.d : t.w), new THREE.MeshBasicMaterial({ color: 0x20262b, transparent: true, opacity: 0.62 }));
        ov.rotation.x = -Math.PI / 2; ov.position.set(t.x, 0.02, t.z); dynGroup.add(ov); dyn.mort[i] = ov;
      }
    }
  }

  let lastS = null;
  function sync(S) {
    lastS = S;
    ensureTokens(S); syncTiles(S);
    S.players.forEach((p, i) => { tokens[i].tgt = p.pos; tokens[i].group.visible = !p.out; });
  }

  function rollDice(vals) {
    const now = performance.now();
    diceAnim = {
      t0: now, dur: 1000, vals,
      start: dice.map((_, i) => new THREE.Vector3(i ? 4.2 : -4.2, 3.2, 5.5 + i)),
      axis: dice.map(() => new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()),
      spin: dice.map(() => 10 + Math.random() * 6),
      fin: dice.map((_, i) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28).multiply(faceUp(vals[i]))),
      landed: false,
    };
    blockUntil = now + 1050;
  }

  // Klik və sürüşdürmə fərqi
  let down = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) { down = null; return; }
    down = null;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const p = new THREE.Vector3();
    if (ray.ray.intersectPlane(plane, p)) { const i = tileAt(p.x, p.z); if (i >= 0) onTile(i); }
  });

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.zoom = 1; camera.updateProjectionMatrix();
    if (!userMoved) fitCamera();
  }
  // Lövhə həm eninə, həm hündürlüyünə ekrana sığsın (portret və landscape üçün)
  function fitCamera() {
    const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), th = tv * camera.aspect;
    const dist = Math.max(6.4 / tv, 7.0 / th);
    controls.target.set(0, 0, 0.8);
    camera.position.copy(controls.target).addScaledVector(DEF_POS.clone().normalize(), dist);
    controls.update();
  }
  let userMoved = false;
  controls.addEventListener('start', () => { userMoved = true; });
  new ResizeObserver(resize).observe(container); resize();

  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const tmpQ = new THREE.Quaternion();
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    controls.update();
    clouds.forEach((c, i) => { c.position.x += dt * (0.25 + i * 0.03); if (c.position.x > 45) c.position.x = -45; });

    // Zər animasiyası
    if (diceAnim) {
      const t = Math.min(1, (now - diceAnim.t0) / diceAnim.dur);
      dice.forEach((d, i) => {
        const u = ease(Math.min(1, t * 1.05));
        d.position.lerpVectors(diceAnim.start[i], REST[i], u);
        d.position.y = REST[i].y + Math.abs(Math.sin(t * Math.PI * 3)) * (1 - t) * 2.2;
        const ang = diceAnim.spin[i] * (1 - t) * (1 - t);
        d.quaternion.copy(diceAnim.fin[i]).premultiply(tmpQ.setFromAxisAngle(diceAnim.axis[i], ang));
      });
      if (t >= 1) { dice.forEach((d, i) => { d.position.copy(REST[i]); d.quaternion.copy(diceAnim.fin[i]); }); diceAnim = null; }
    }

    // Fiqurlar
    const slots = {};
    tokens.forEach((tk, i) => {
      if (!tk.group.visible) return;
      if (!tk.anim && tk.cur !== tk.tgt && now >= blockUntil) {
        const fwd = (tk.tgt - tk.cur + 40) % 40;
        const next = fwd <= 12 ? (tk.cur + 1) % 40 : tk.tgt;
        tk.anim = { from: tilePos(tk.cur), to: tilePos(next), t0: now, dur: fwd <= 12 ? walkSpeed : 420, hop: fwd <= 12 ? 0.45 : 1.6, next };
      }
      if (tk.anim) {
        const a = tk.anim, t = Math.min(1, (now - a.t0) / a.dur);
        tk.group.position.lerpVectors(a.from, a.to, t);
        tk.group.position.x += tk.off.x; tk.group.position.z += tk.off.z;
        tk.group.position.y = Math.sin(t * Math.PI) * a.hop;
        if (t >= 1) {
          tk.cur = a.next; tk.anim = null; tk.group.position.y = 0;
          if (tk.cur === tk.tgt) sfx.place(); else sfx.step(tk.steps++);
        }
      }
      const at = tk.anim ? tk.anim.next : tk.cur;
      (slots[at] = slots[at] || []).push(i);
    });
    for (const [tile, list] of Object.entries(slots)) {
      list.forEach((pi, k) => {
        const tk = tokens[pi];
        const n = list.length, ang = (k / n) * Math.PI * 2 + 0.6, rad = n === 1 ? 0 : 0.34;
        let ox = Math.cos(ang) * rad, oz = Math.sin(ang) * rad;
        if (+tile === 10 && lastS?.players[pi]?.jail) { ox = -0.35 + k * 0.1; oz = -0.35 + k * 0.1; }
        tk.off.x += (ox - tk.off.x) * 0.15; tk.off.z += (oz - tk.off.z) * 0.15;
      });
    }
    tokens.forEach((tk, i) => {
      if (!tk.group.visible) return;
      if (!tk.anim) { const base = tilePos(tk.cur); tk.group.position.set(base.x + tk.off.x, 0, base.z + tk.off.z); }
      const isTurn = lastS && lastS.phase === 'play' && lastS.turn === i;
      tk.ring.visible = !!isTurn;
      if (isTurn) { tk.ring.scale.setScalar(1 + Math.sin(now / 250) * 0.08); tk.group.rotation.y += dt * 0.8; }
      else tk.group.rotation.y *= 0.9;
    });
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  return {
    sync, rollDice, setDice: placeDice,
    resetView() { userMoved = false; fitCamera(); },
    topView() { userMoved = true; const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), th = tv * camera.aspect; const d = Math.max(6.6 / tv, 6.6 / th); controls.target.set(0, 0, 0); camera.position.set(0, d, 0.01); controls.update(); },
    get busy() { return !!diceAnim || tokens.some((t) => t.anim || t.cur !== t.tgt); },
  };
}
