// Top-right minimap: planet outline, enemies, player, camera viewport.
import { VW, VH, WORLD_W, CX, CY, BASE_RADIUS } from './config.js';
import { ctx } from './dom.js';
import { camera } from './camera.js';
import { state } from './state.js';

export function drawMinimap() {
  const mSize = 100, mPad = 10;
  const mx = VW - mSize - mPad, my = mPad;
  const scale = mSize / WORLD_W;

  ctx.save();
  ctx.globalAlpha = 0.8;

  ctx.fillStyle = '#0a0a1a';
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(mx + mSize / 2, my + mSize / 2, mSize / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#3a5a3a';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(mx + CX * scale, my + CY * scale, BASE_RADIUS * scale, 0, Math.PI * 2);
  ctx.stroke();

  for (const e of state.enemies) {
    ctx.fillStyle = e.isLarge ? '#228822' : '#44cc44';
    ctx.beginPath();
    ctx.arc(mx + e.x * scale, my + e.y * scale, e.isLarge ? 4 : 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const player = state.player;
  if (player && player.hp > 0) {
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(mx + player.x * scale, my + player.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const vw = VW / camera.zoom, vh = VH / camera.zoom;
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(mx + (camera.x - vw / 2) * scale, my + (camera.y - vh / 2) * scale, vw * scale, vh * scale);

  ctx.globalAlpha = 1;
  ctx.restore();
}
