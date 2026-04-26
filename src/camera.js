// Camera: smooth follow, rotation, zoom. Screen↔world transforms.
import { VW, VH, CX, CY, REF_HZ } from './config.js';
import { ctx } from './dom.js';
import { lerpAngle } from './math.js';

const CAM_SMOOTH = 0.08;
const CAM_ROT_SMOOTH = 0.07;
export const MIN_ZOOM = 0.35, MAX_ZOOM = 2.5;

export const camera = {
  x: CX, y: CY, zoom: 1.0, rot: 0,
};

export function updateCamera(targetX, targetY, targetRot, dt) {
  const posFactor = 1 - Math.pow(1 - CAM_SMOOTH, dt * REF_HZ);
  camera.x += (targetX - camera.x) * posFactor;
  camera.y += (targetY - camera.y) * posFactor;
  const rotFactor = 1 - Math.pow(1 - CAM_ROT_SMOOTH, dt * REF_HZ);
  camera.rot = lerpAngle(camera.rot, targetRot, rotFactor);
}

export function applyCam() {
  ctx.translate(VW / 2, VH / 2);
  ctx.rotate(camera.rot);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
}

export function screenToWorld(sx, sy) {
  const dx = sx - VW / 2;
  const dy = sy - VH / 2;
  const cosR = Math.cos(-camera.rot);
  const sinR = Math.sin(-camera.rot);
  const rx = dx * cosR - dy * sinR;
  const ry = dx * sinR + dy * cosR;
  return {
    x: rx / camera.zoom + camera.x,
    y: ry / camera.zoom + camera.y,
  };
}

export function adjustZoom(delta) {
  camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom + delta));
}
