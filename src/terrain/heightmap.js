// Planet heightmap: voxel arrays, terrain queries, generation, offscreen render.
import {
  WORLD_W, WORLD_H, CX, CY,
  BASE_RADIUS, SURFACE_NOISE, CORE_RADIUS, GRAVITY,
} from '../config.js';
import { pseudoRand, valueNoise, dist } from '../math.js';

export const terrain  = new Uint8Array(WORLD_W * WORLD_H);
export const terrainR = new Uint8Array(WORLD_W * WORLD_H);
export const terrainG = new Uint8Array(WORLD_W * WORLD_H);
export const terrainB = new Uint8Array(WORLD_W * WORLD_H);

const ANGLE_STEPS = 7200;
const surfaceRadii = new Float32Array(ANGLE_STEPS);

export const bgOff = document.createElement('canvas');
bgOff.width = WORLD_W; bgOff.height = WORLD_H;
const bgCtx = bgOff.getContext('2d');

export const terrOff = document.createElement('canvas');
terrOff.width = WORLD_W; terrOff.height = WORLD_H;
const terrCtx = terrOff.getContext('2d');

// P1: 재사용 ImageData (매 호출 10MB 할당 제거)
const terrImgData = terrCtx.createImageData(WORLD_W, WORLD_H);
const terrImgBuf = terrImgData.data;

let initialTerrainCount = 0;
let currentTerrainCount = 0;
let terrainPctCache = 100;

export function getTerrainPct() { return terrainPctCache; }

export function isSolid(x, y) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return false;
  return terrain[y * WORLD_W + x] === 1;
}

// Sweep a line segment against the terrain grid, 1px resolution.
// Returns { x, y } at first solid hit, or null. Prevents fast-mover tunneling.
export function raycastTerrain(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  const inv = 1 / steps;
  for (let i = 1; i <= steps; i++) {
    const t = i * inv;
    const x = x0 + dx * t, y = y0 + dy * t;
    if (isSolid(x, y)) return { x, y };
  }
  return null;
}

export function gravityAt(x, y) {
  const dx = CX - x, dy = CY - y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < 1) return { gx: 0, gy: 0 };
  return { gx: (dx / d) * GRAVITY, gy: (dy / d) * GRAVITY };
}

export function getSurfaceRadius(angle) {
  let a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return surfaceRadii[(a / (Math.PI * 2) * ANGLE_STEPS) | 0];
}

export function carveCircle(cx, cy, radius) {
  const r2 = radius * radius;
  const cr2 = CORE_RADIUS * CORE_RADIUS;
  const x0 = Math.max(0, (cx - radius) | 0);
  const x1 = Math.min(WORLD_W - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, (cy - radius) | 0);
  const y1 = Math.min(WORLD_H - 1, Math.ceil(cy + radius));
  let removed = 0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 < r2 && (x - CX) ** 2 + (y - CY) ** 2 >= cr2) {
        if (terrain[y * WORLD_W + x]) { terrain[y * WORLD_W + x] = 0; removed++; }
      }
    }
  return removed;
}

// P3: 재사용 출력 버퍼 (매 호출 Array 할당 제거)
const _cc = new Uint8Array(3);
function computeColor(x, y) {
  const d = dist(x, y, CX, CY);
  const angle = Math.atan2(y - CY, x - CX);
  const sr = getSurfaceRadius(angle);
  const depth = sr - d;
  const n1 = pseudoRand(x * 0.07 + y * 0.07);
  const n2 = pseudoRand(x * 0.13 + y * 0.11);

  if (depth < 3) { _cc[0] = 55 + n1 * 40 | 0; _cc[1] = 140 + n2 * 50 | 0; _cc[2] = 45; }
  else if (depth < 25) {
    const t = (depth - 3) / 22;
    _cc[0] = 145 - t * 40 + n1 * 15 | 0; _cc[1] = 95 - t * 25 + n2 * 10 | 0; _cc[2] = 45;
  }
  else if (d < CORE_RADIUS + 18) { _cc[0] = 180 + n1 * 60 | 0; _cc[1] = 60 + n2 * 50 | 0; _cc[2] = 15 + n1 * 20 | 0; }
  else { const n = n1 * 25; _cc[0] = 78 + n | 0; _cc[1] = 72 + n | 0; _cc[2] = 62 + n | 0; }
}

function rebuildColors() {
  for (let y = 0; y < WORLD_H; y++)
    for (let x = 0; x < WORLD_W; x++) {
      const i = y * WORLD_W + x;
      if (terrain[i]) {
        computeColor(x, y);
        terrainR[i] = _cc[0]; terrainG[i] = _cc[1]; terrainB[i] = _cc[2];
      }
    }
}

export function rebuildColorsRect(x0, y0, x1, y1) {
  x0 = Math.max(0, x0); y0 = Math.max(0, y0);
  x1 = Math.min(WORLD_W - 1, x1); y1 = Math.min(WORLD_H - 1, y1);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = y * WORLD_W + x;
      if (terrain[i]) {
        computeColor(x, y);
        terrainR[i] = _cc[0]; terrainG[i] = _cc[1]; terrainB[i] = _cc[2];
      }
    }
}

export function blitTerrain() {
  for (let i = 0, j = 0; i < WORLD_W * WORLD_H; i++, j += 4) {
    if (terrain[i]) {
      terrImgBuf[j] = terrainR[i];
      terrImgBuf[j + 1] = terrainG[i];
      terrImgBuf[j + 2] = terrainB[i];
      terrImgBuf[j + 3] = 255;
    } else {
      terrImgBuf[j + 3] = 0;  // 파괴된 지형은 투명으로 명시
    }
  }
  terrCtx.putImageData(terrImgData, 0, 0);
}

export function generateTerrain() {
  terrain.fill(0);
  const seed = Math.random() * 1000;
  for (let i = 0; i < ANGLE_STEPS; i++) {
    const a = (i / ANGLE_STEPS) * Math.PI * 2;
    const n = valueNoise(a / (Math.PI * 2) + seed, 6, 5, seed);
    surfaceRadii[i] = BASE_RADIUS + (n - 0.5) * 2 * SURFACE_NOISE;
  }
  for (let y = 0; y < WORLD_H; y++)
    for (let x = 0; x < WORLD_W; x++) {
      const d = dist(x, y, CX, CY);
      const angle = Math.atan2(y - CY, x - CX);
      if (d < getSurfaceRadius(angle)) terrain[y * WORLD_W + x] = 1;
    }
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = BASE_RADIUS * (0.35 + Math.random() * 0.4);
    carveCircle(CX + Math.cos(a) * r, CY + Math.sin(a) * r, 22 + Math.random() * 35);
  }
  rebuildColors();
  blitTerrain();
  initialTerrainCount = 0;
  for (let i = 0; i < WORLD_W * WORLD_H; i++) if (terrain[i]) initialTerrainCount++;
  currentTerrainCount = initialTerrainCount;
  terrainPctCache = 100;
}

export function recalcTerrainPercent(removedCount = 0) {
  if (removedCount > 0) {
    currentTerrainCount -= removedCount;
  } else {
    // fallback: 전수 순회 (초기화 등에서만 사용)
    currentTerrainCount = 0;
    for (let i = 0; i < WORLD_W * WORLD_H; i++) if (terrain[i]) currentTerrainCount++;
  }
  terrainPctCache = initialTerrainCount > 0
    ? Math.round(currentTerrainCount / initialTerrainCount * 100)
    : 100;
}

export function depositTerrainPixel(x, y) {
  if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H) return false;
  const i = y * WORLD_W + x;
  if (terrain[i]) return false;
  if (dist(x, y, CX, CY) < CORE_RADIUS) return false;
  terrain[i] = 1;
  computeColor(x, y);
  terrainR[i] = _cc[0]; terrainG[i] = _cc[1]; terrainB[i] = _cc[2];
  terrCtx.fillStyle = `rgb(${_cc[0]},${_cc[1]},${_cc[2]})`;
  terrCtx.fillRect(x, y, 1, 1);
  currentTerrainCount++;
  terrainPctCache = Math.round(currentTerrainCount / initialTerrainCount * 100);
  return true;
}

export function renderBackground() {
  bgCtx.fillStyle = '#030308';
  bgCtx.fillRect(0, 0, WORLD_W, WORLD_H);

  for (let i = 0; i < 500; i++) {
    const sx = Math.random() * WORLD_W, sy = Math.random() * WORLD_H;
    if (dist(sx, sy, CX, CY) < BASE_RADIUS + 80) continue;
    bgCtx.globalAlpha = 0.2 + Math.random() * 0.8;
    bgCtx.fillStyle = Math.random() > 0.9 ? '#aaccff' : Math.random() > 0.8 ? '#ffddaa' : '#fff';
    bgCtx.beginPath(); bgCtx.arc(sx, sy, Math.random() * 1.6, 0, Math.PI * 2); bgCtx.fill();
  }
  bgCtx.globalAlpha = 1;

  for (const [nx, ny, c] of [[0.15, 0.2, '#6644aa'], [0.85, 0.8, '#aa4466'], [0.5, 0.1, '#446688']]) {
    bgCtx.globalAlpha = 0.035;
    const g = bgCtx.createRadialGradient(WORLD_W * nx, WORLD_H * ny, 0, WORLD_W * nx, WORLD_H * ny, 250);
    g.addColorStop(0, c); g.addColorStop(1, 'transparent');
    bgCtx.fillStyle = g; bgCtx.fillRect(0, 0, WORLD_W, WORLD_H);
  }
  bgCtx.globalAlpha = 1;

  bgCtx.globalAlpha = 0.07;
  const atmo = bgCtx.createRadialGradient(CX, CY, BASE_RADIUS - 15, CX, CY, BASE_RADIUS + 60);
  atmo.addColorStop(0, '#55aaff'); atmo.addColorStop(0.6, '#3388cc'); atmo.addColorStop(1, 'transparent');
  bgCtx.fillStyle = atmo;
  bgCtx.beginPath(); bgCtx.arc(CX, CY, BASE_RADIUS + 60, 0, Math.PI * 2); bgCtx.fill();
  bgCtx.globalAlpha = 1;
}
