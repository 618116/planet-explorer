// Falling terrain chunks + float-detection after terrain changes.
import {
  WORLD_W, WORLD_H, CX, CY, CORE_RADIUS,
  TERRAIN_FALL_SPEED, CHUNK_GRAVITY, MIN_CHUNK_SIZE,
} from '../config.js';
import { dist } from '../math.js';
import {
  terrain, terrainR, terrainG, terrainB,
  blitTerrain, carveCircle, rebuildColorsRect,
} from './heightmap.js';

const DX4 = [1, -1, 0, 0], DY4 = [0, 0, 1, -1];

export const fallingChunks = [];
const floatState = { pending: false };

export function getPendingFloat() { return floatState.pending; }
export function clearPendingFloat() { floatState.pending = false; }

export function resetFalling() {
  fallingChunks.length = 0;
  floatState.pending = false;
}

export class FallingChunk {
  constructor(pixels) {
    let minX = WORLD_W, maxX = 0, minY = WORLD_H, maxY = 0;
    for (const p of pixels) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    this.originX = minX; this.originY = minY;
    this.w = maxX - minX + 1; this.h = maxY - minY + 1;
    this.grid = new Uint8Array(this.w * this.h);
    this.colR = new Uint8Array(this.w * this.h);
    this.colG = new Uint8Array(this.w * this.h);
    this.colB = new Uint8Array(this.w * this.h);
    let cmx = 0, cmy = 0, cnt = 0;
    for (const p of pixels) {
      const lx = p.x - minX, ly = p.y - minY, li = ly * this.w + lx;
      this.grid[li] = 1; this.colR[li] = p.r; this.colG[li] = p.g; this.colB[li] = p.b;
      cmx += p.x; cmy += p.y; cnt++;
    }
    this.cmx = cmx / cnt; this.cmy = cmy / cnt;
    this.offsetX = 0; this.offsetY = 0;
    this.prevOffsetX = 0; this.prevOffsetY = 0;
    this.vx = 0; this.vy = 0;
    this.settled = false;
    // P4: 오프스크린 캔버스에 미리 렌더 (대량 drawcall 제거)
    this._canvas = (() => {
      const c = document.createElement('canvas');
      c.width = this.w; c.height = this.h;
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(this.w, this.h);
      const d = img.data;
      for (let ly = 0; ly < this.h; ly++)
        for (let lx = 0; lx < this.w; lx++) {
          const li = ly * this.w + lx;
          if (this.grid[li]) {
            const j = li * 4;
            d[j] = this.colR[li]; d[j + 1] = this.colG[li];
            d[j + 2] = this.colB[li]; d[j + 3] = 255;
          }
        }
      ctx.putImageData(img, 0, 0);
      return c;
    })();
  }
  update(dt) {
    if (this.settled) return;
    this.prevOffsetX = this.offsetX; this.prevOffsetY = this.offsetY;
    const wx = this.cmx + this.offsetX, wy = this.cmy + this.offsetY;
    const dx = CX - wx, dy = CY - wy, d = Math.sqrt(dx * dx + dy * dy);
    if (d > 1) { this.vx += (dx / d) * CHUNK_GRAVITY * dt; this.vy += (dy / d) * CHUNK_GRAVITY * dt; }
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > TERRAIN_FALL_SPEED) {
      this.vx = (this.vx / sp) * TERRAIN_FALL_SPEED;
      this.vy = (this.vy / sp) * TERRAIN_FALL_SPEED;
    }
    const steps = Math.max(1, Math.ceil(sp));
    const svx = this.vx / steps, svy = this.vy / steps;
    for (let s = 0; s < steps; s++) {
      this.offsetX += svx; this.offsetY += svy;
      if (this._check()) {
        this.offsetX -= svx; this.offsetY -= svy;
        this._settle();
        return;
      }
    }
    if (dist(wx, wy, CX, CY) > WORLD_W) this.settled = true;
  }
  _check() {
    const bx = Math.round(this.offsetX), by = Math.round(this.offsetY);
    for (let ly = 0; ly < this.h; ly++) for (let lx = 0; lx < this.w; lx++) {
      if (!this.grid[ly * this.w + lx]) continue;
      const wx = this.originX + lx + bx, wy = this.originY + ly + by;
      if (wx >= 0 && wx < WORLD_W && wy >= 0 && wy < WORLD_H && terrain[wy * WORLD_W + wx]) return true;
    }
    return false;
  }
  _settle() {
    this.settled = true;
    const bx = Math.round(this.offsetX), by = Math.round(this.offsetY);
    let rx0 = WORLD_W, ry0 = WORLD_H, rx1 = 0, ry1 = 0;
    for (let ly = 0; ly < this.h; ly++) for (let lx = 0; lx < this.w; lx++) {
      const li = ly * this.w + lx; if (!this.grid[li]) continue;
      const wx = this.originX + lx + bx, wy = this.originY + ly + by;
      if (wx < 0 || wx >= WORLD_W || wy < 0 || wy >= WORLD_H) continue;
      const wi = wy * WORLD_W + wx;
      terrain[wi] = 1;
      terrainR[wi] = this.colR[li];
      terrainG[wi] = this.colG[li];
      terrainB[wi] = this.colB[li];
      if (wx < rx0) rx0 = wx; if (wx > rx1) rx1 = wx;
      if (wy < ry0) ry0 = wy; if (wy > ry1) ry1 = wy;
    }
    rebuildColorsRect(rx0 - 2, ry0 - 4, rx1 + 2, ry1 + 4);
    blitTerrain();
    floatState.pending = true;
  }
  draw(ctx, alpha = 1) {
    if (this.settled) return;
    const ox = this.prevOffsetX + (this.offsetX - this.prevOffsetX) * alpha;
    const oy = this.prevOffsetY + (this.offsetY - this.prevOffsetY) * alpha;
    ctx.drawImage(this._canvas,
      this.originX + Math.round(ox),
      this.originY + Math.round(oy));
  }
}

export function detectFloatingTerrain() {
  const grounded = new Uint8Array(WORLD_W * WORLD_H);
  const queue = new Int32Array(WORLD_W * WORLD_H * 2);
  let qH = 0, qT = 0;
  const cr = CORE_RADIUS;
  for (let y = Math.max(0, CY - cr | 0); y <= Math.min(WORLD_H - 1, CY + cr | 0); y++)
    for (let x = Math.max(0, CX - cr | 0); x <= Math.min(WORLD_W - 1, CX + cr | 0); x++) {
      if (dist(x, y, CX, CY) <= cr) {
        const i = y * WORLD_W + x;
        if (terrain[i] && !grounded[i]) { grounded[i] = 1; queue[qT++] = x; queue[qT++] = y; }
      }
    }
  while (qH < qT) {
    const qx = queue[qH++], qy = queue[qH++];
    for (let d = 0; d < 4; d++) {
      const nx = qx + DX4[d], ny = qy + DY4[d];
      if (nx < 0 || nx >= WORLD_W || ny < 0 || ny >= WORLD_H) continue;
      const ni = ny * WORLD_W + nx;
      if (terrain[ni] && !grounded[ni]) { grounded[ni] = 1; queue[qT++] = nx; queue[qT++] = ny; }
    }
  }
  const visited = new Uint8Array(WORLD_W * WORLD_H);
  let found = false;
  for (let y = 0; y < WORLD_H; y++) for (let x = 0; x < WORLD_W; x++) {
    const i = y * WORLD_W + x;
    if (!terrain[i] || grounded[i] || visited[i]) continue;
    const px = []; const cq = [x, y]; visited[i] = 1; let ch = 0;
    while (ch < cq.length) {
      const cx = cq[ch++], cy = cq[ch++], ci = cy * WORLD_W + cx;
      px.push({ x: cx, y: cy, r: terrainR[ci], g: terrainG[ci], b: terrainB[ci] });
      terrain[ci] = 0;
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX4[d], ny = cy + DY4[d];
        if (nx < 0 || nx >= WORLD_W || ny < 0 || ny >= WORLD_H) continue;
        const ni = ny * WORLD_W + nx;
        if (terrain[ni] && !grounded[ni] && !visited[ni]) { visited[ni] = 1; cq.push(nx, ny); }
      }
    }
    if (px.length >= MIN_CHUNK_SIZE) { fallingChunks.push(new FallingChunk(px)); found = true; }
  }
  if (found) blitTerrain();
}

export function carveTerrain(cx, cy, radius) {
  const removed = carveCircle(cx, cy, radius);
  blitTerrain();
  floatState.pending = true;
  return removed;
}
